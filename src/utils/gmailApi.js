/**
 * Gmail API Integration
 * Handles OAuth authentication and fetching email data from Gmail
 * Uses Google Identity Services (GIS) for authentication
 */

import Papa from 'papaparse';

// Gmail API Scopes
const SCOPES = 'https://www.googleapis.com/auth/gmail.readonly';

let gapiInitialized = false;
let currentAccessToken = null;
let currentUserEmail = null;
let tokenClient = null; // Store token client for refresh
let clientId = null; // Store client ID for token refresh

/**
 * Initialize Google API Client (without auth2)
 * @param {string} apiKey - Google API Key
 * @param {Function} onLoadCallback - Callback when API is loaded
 */
export function initGmailAPI(apiKey, onLoadCallback) {
  if (!window.gapi) {
    console.error('Google API client library not loaded');
    return;
  }

  if (gapiInitialized) {
    if (onLoadCallback) onLoadCallback();
    return;
  }

  window.gapi.load('client', () => {
    window.gapi.client.init({
      apiKey: apiKey,
      discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/gmail/v1/rest']
    }).then(() => {
      gapiInitialized = true;
      if (onLoadCallback) onLoadCallback();
    }).catch((error) => {
      console.error('Error initializing Gmail API:', error);
    });
  });
}

/**
 * Check if user is signed in
 * @returns {boolean}
 */
export function isSignedIn() {
  return currentAccessToken !== null;
}

/**
 * Get current user's email
 * @returns {string|null}
 */
export function getCurrentUserEmail() {
  return currentUserEmail;
}

/**
 * Fetch and update the current user's email from Gmail profile
 * @returns {Promise<string>} User email address
 */
export async function fetchUserEmail() {
  if (!isSignedIn() || !currentAccessToken) {
    throw new Error('User not signed in');
  }

  if (!gapiInitialized || !window.gapi || !window.gapi.client) {
    throw new Error('Gmail API not initialized');
  }

  try {
    // Set token for API calls
    window.gapi.client.setToken({ access_token: currentAccessToken });
    
    // Get user email from Gmail profile (works with gmail.readonly scope)
    // Note: userinfo endpoint requires additional OAuth scopes (profile/email)
    // which we don't request, so we only use Gmail profile
    const profileResponse = await window.gapi.client.gmail.users.getProfile({
      userId: 'me'
    });
    
    const emailAddress = profileResponse.result?.emailAddress;
    if (emailAddress) {
      currentUserEmail = emailAddress;
      return emailAddress;
    }
    
    throw new Error('Email address not found in Gmail profile');
  } catch (error) {
    console.error('Error fetching user email from Gmail profile:', error);
    
    // Don't try userinfo endpoint - it requires additional OAuth scopes
    // that we don't have (would get 401 Unauthorized)
    throw new Error('Could not fetch user email. Gmail profile API call failed.');
  }
}

/**
 * Get current access token (for use by other integrations like MailSuite)
 * @returns {string|null}
 */
export function getAccessToken() {
  return currentAccessToken;
}

/**
 * Sign in with Google using Google Identity Services
 * @param {string} clientIdParam - Google OAuth Client ID
 * @returns {Promise}
 */
export function signIn(clientIdParam) {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google Identity Services not loaded. Please refresh the page.'));
      return;
    }

    if (!gapiInitialized) {
      reject(new Error('Gmail API not initialized. Please wait a moment and try again.'));
      return;
    }

    clientId = clientIdParam;

    // Use Google Identity Services for authentication
    tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        
        currentAccessToken = response.access_token;
        
        // Fetch user email asynchronously (don't block sign-in)
        // Use Gmail API profile (works with gmail.readonly scope)
        // Note: userinfo endpoint requires additional OAuth scopes (profile/email) which we don't request
        const fetchEmail = async () => {
          try {
            // Wait a bit to ensure gapi.client is fully ready
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Retry logic for Gmail profile fetch
            let retries = 3;
            while (retries > 0) {
              try {
                // Use Gmail API profile (uses existing Gmail scope - no additional scopes needed)
                if (window.gapi && window.gapi.client && gapiInitialized) {
                  window.gapi.client.setToken({ access_token: currentAccessToken });
                  
                  const profileResponse = await window.gapi.client.gmail.users.getProfile({
                    userId: 'me'
                  });
                  
                  const emailAddress = profileResponse.result?.emailAddress;
                  if (emailAddress) {
                    currentUserEmail = emailAddress;
                    return; // Success!
                  }
                }
                
                // If we get here, gapi might not be ready yet
                if (retries > 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              } catch (profileError) {
                // If it's an auth error, don't retry
                if (profileError.message && (
                  profileError.message.includes('401') || 
                  profileError.message.includes('UNAUTHENTICATED')
                )) {
                  throw profileError;
                }
                
                // For other errors, retry
                if (retries > 1) {
                  await new Promise(resolve => setTimeout(resolve, 500));
                } else {
                  throw profileError;
                }
              }
              
              retries--;
            }
            
            // If all retries failed, set to Unknown
            console.warn('Could not fetch email from Gmail profile after retries');
            currentUserEmail = 'Unknown';
          } catch (error) {
            console.warn('Could not fetch user email from Gmail profile:', error);
            // Don't try userinfo endpoint - it requires additional OAuth scopes
            currentUserEmail = 'Unknown';
          }
        };
        
        // Fetch email in background (don't block sign-in)
        fetchEmail();
        
        resolve(response);
      },
      error_callback: (error) => {
        reject(new Error(error || 'Authentication failed'));
      }
    });

    // Request access token
    tokenClient.requestAccessToken({ prompt: 'consent' });
  });
}

/**
 * Sign out
 */
export function signOut() {
  if (currentAccessToken && window.google) {
    window.google.accounts.oauth2.revoke(currentAccessToken, () => {
      currentAccessToken = null;
      currentUserEmail = null;
      tokenClient = null;
      clientId = null;
    });
  } else {
    currentAccessToken = null;
    currentUserEmail = null;
    tokenClient = null;
    clientId = null;
  }
}

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} Result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, baseDelay = 1000) {
  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on authentication errors
      const errorMessage = error.message || JSON.stringify(error);
      const errorResult = error.result || error;
      const isAuthError = errorMessage.includes('401') || 
                         errorMessage.includes('UNAUTHENTICATED') ||
                         errorMessage.includes('authentication credential') ||
                         (errorResult && errorResult.error && (
                           errorResult.error.code === 401 ||
                           errorResult.error.status === 'UNAUTHENTICATED'
                         ));
      
      if (isAuthError || attempt === maxRetries) {
        throw error;
      }
      
      // Check if it's a rate limit error (429)
      const isRateLimit = errorMessage.includes('429') || 
                         errorMessage.includes('rateLimitExceeded') ||
                         (errorResult && errorResult.error && errorResult.error.code === 429);
      
      if (isRateLimit) {
        // Longer delay for rate limits
        const delay = baseDelay * Math.pow(2, attempt) * 2;
        console.log(`Rate limit hit, waiting ${delay}ms before retry ${attempt + 1}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        // Exponential backoff for other errors
        const delay = baseDelay * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

/**
 * Make an authenticated Gmail API request with automatic token refresh on 401
 * @param {Function} apiCall - Function that makes the API call
 * @returns {Promise} API response
 */
async function makeAuthenticatedRequest(apiCall) {
  if (!isSignedIn() || !currentAccessToken) {
    throw new Error('User not signed in');
  }

  if (!window.gapi || !window.gapi.client) {
    throw new Error('Gmail API client not initialized');
  }

  try {
    // Set the access token for API calls
    window.gapi.client.setToken({ access_token: currentAccessToken });
    
    // Make the API call with retry logic
    return await retryWithBackoff(apiCall);
  } catch (error) {
    // Check if it's a 401 authentication error
    const errorMessage = error.message || JSON.stringify(error);
    const errorResult = error.result || error;
    const isAuthError = errorMessage.includes('401') || 
                       errorMessage.includes('UNAUTHENTICATED') ||
                       errorMessage.includes('authentication credential') ||
                       (errorResult && errorResult.error && (
                         errorResult.error.code === 401 ||
                         errorResult.error.status === 'UNAUTHENTICATED'
                       ));
    
    if (isAuthError) {
      console.log('Authentication error detected, token may have expired');
      
      // Clear the expired token
      const expiredToken = currentAccessToken;
      currentAccessToken = null;
      currentUserEmail = null;
      
      // Try to get a new token silently if we have the client ID
      if (clientId && window.google && window.google.accounts && window.google.accounts.oauth2) {
        try {
          // Attempt silent token refresh
          await new Promise((resolve, reject) => {
            let resolved = false;
            const timeout = setTimeout(() => {
              if (!resolved) {
                resolved = true;
                reject(new Error('Token refresh timeout'));
              }
            }, 5000); // 5 second timeout
            
            const refreshTokenClient = window.google.accounts.oauth2.initTokenClient({
              client_id: clientId,
              scope: SCOPES,
              callback: (response) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                
                if (response.error) {
                  reject(new Error('Token refresh failed'));
                  return;
                }
                currentAccessToken = response.access_token;
                tokenClient = refreshTokenClient;
                resolve();
              },
              error_callback: (err) => {
                if (resolved) return;
                resolved = true;
                clearTimeout(timeout);
                reject(new Error('Token refresh failed'));
              }
            });
            
            refreshTokenClient.requestAccessToken({ prompt: '' });
          });
          
          // Retry the API call with the new token
          window.gapi.client.setToken({ access_token: currentAccessToken });
          return await apiCall();
        } catch (refreshError) {
          // Silent refresh failed - user needs to sign in again
          throw new Error('Your session has expired. Please sign in again to continue.');
        }
      } else {
        // No client ID available, user must sign in again
        throw new Error('Your session has expired. Please sign in again to continue.');
      }
    }
    
    // If it's not an auth error, throw the original error
    throw error;
  }
}

/**
 * Fetch sent emails from Gmail with pagination support and optimized for large datasets
 * @param {Object} options - Query options
 * @param {string} options.query - Gmail search query (e.g., 'in:sent after:2024/1/1')
 * @param {number} options.maxResults - Maximum number of results (default: unlimited)
 * @param {Function} options.onProgress - Optional progress callback (current, total, message)
 * @param {Function} options.onBatchProcessed - Optional callback when a batch is processed (processedCount, totalCount)
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchSentEmails(options = {}) {
  const { query = 'in:sent', maxResults = null, onProgress, onBatchProcessed } = options;
  
  if (!isSignedIn() || !currentAccessToken) {
    throw new Error('User not signed in');
  }

  if (!window.gapi || !window.gapi.client) {
    throw new Error('Gmail API client not initialized');
  }

  try {
    const allMessageIds = [];
    let nextPageToken = null;
    const pageSize = 500; // Gmail API limit per page
    let totalEstimated = null;
    
    // Step 1: Fetch all message IDs with pagination
    if (onProgress) {
      onProgress(0, null, 'Discovering emails...');
    }
    
    do {
      const listParams = {
        userId: 'me',
        q: query,
        maxResults: pageSize
      };
      
      if (nextPageToken) {
        listParams.pageToken = nextPageToken;
      }
      
      const listResponse = await makeAuthenticatedRequest(() => 
        window.gapi.client.gmail.users.messages.list(listParams)
      );

      const messages = listResponse.result.messages || [];
      allMessageIds.push(...messages.map(msg => msg.id));
      
      // Get estimated total if available
      if (listResponse.result.resultSizeEstimate && totalEstimated === null) {
        totalEstimated = listResponse.result.resultSizeEstimate;
      }
      
      nextPageToken = listResponse.result.nextPageToken;
      
      // Stop if we've reached the maxResults limit
      if (maxResults && allMessageIds.length >= maxResults) {
        allMessageIds.splice(maxResults);
        break;
      }
      
      // Call progress callback if provided
      if (onProgress) {
        const total = totalEstimated || allMessageIds.length;
        onProgress(allMessageIds.length, total, `Found ${allMessageIds.length} emails...`);
      }
      
      // Small delay between pagination requests to avoid rate limits
      if (nextPageToken) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } while (nextPageToken && (!maxResults || allMessageIds.length < maxResults));
    
    if (allMessageIds.length === 0) {
      if (onProgress) {
        onProgress(0, 0, 'No emails found');
      }
      return [];
    }
    
    const totalMessages = allMessageIds.length;
    
    // Step 2: Fetch messages in optimized batches
    // Use smaller batches for very large datasets to avoid memory issues
    const batchSize = totalMessages > 5000 ? 25 : 50; // Smaller batches for large datasets
    const allEmails = [];
    let processedCount = 0;
    let failedCount = 0;
    
    // Add delay between batches to respect rate limits (250 quota units per second)
    // Each message.get() costs 5 quota units, so 50 messages = 250 units
    // We'll add a 1 second delay between batches for large datasets
    const delayBetweenBatches = totalMessages > 1000 ? 1200 : 200; // 1.2s for large, 200ms for small
    
    for (let i = 0; i < allMessageIds.length; i += batchSize) {
      const batch = allMessageIds.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(allMessageIds.length / batchSize);
      
      // Call progress callback if provided
      if (onProgress) {
        onProgress(processedCount, totalMessages, 
          `Fetching batch ${batchNumber}/${totalBatches} (${processedCount}/${totalMessages} emails)...`);
      }
      
      // Fetch batch with individual error handling
      const emailPromises = batch.map(msgId => 
        makeAuthenticatedRequest(() =>
          window.gapi.client.gmail.users.messages.get({
            userId: 'me',
            id: msgId,
            format: 'full'
          })
        ).catch(error => {
          // Log error but don't fail the entire batch
          failedCount++;
          console.warn(`Failed to fetch message ${msgId}:`, error);
          return null; // Return null for failed messages
        })
      );
      
      const batchResults = await Promise.all(emailPromises);
      
      // Filter out null results (failed messages) and extract results
      const successfulResults = batchResults
        .filter(r => r !== null && r.result)
        .map(r => r.result);
      
      allEmails.push(...successfulResults);
      processedCount += successfulResults.length;
      
      // Call batch processed callback if provided
      if (onBatchProcessed) {
        onBatchProcessed(processedCount, totalMessages);
      }
      
      // Add delay between batches to respect rate limits (except for last batch)
      if (i + batchSize < allMessageIds.length) {
        await new Promise(resolve => setTimeout(resolve, delayBetweenBatches));
      }
    }

    // Final progress update
    if (onProgress) {
      onProgress(processedCount, totalMessages, 
        `Completed! Fetched ${processedCount} emails${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
    }

    console.log(`Successfully fetched ${processedCount} of ${totalMessages} emails${failedCount > 0 ? ` (${failedCount} failed)` : ''}`);
    
    return allEmails;
  } catch (error) {
    console.error('Error fetching sent emails:', error);
    throw error;
  }
}

/**
 * Parse Gmail message to extract email data
 * @param {Object} message - Gmail message object
 * @returns {Object|null} Parsed email data
 */
export function parseGmailMessage(message) {
  if (!message || !message.payload) return null;

  const headers = message.payload.headers || [];
  const getHeader = (name) => {
    const header = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
    return header ? header.value : '';
  };

  const to = getHeader('To');
  const subject = getHeader('Subject');
  const date = getHeader('Date');
  const from = getHeader('From');
  const messageId = message.id;
  const threadId = message.threadId;

  // Parse recipient email and name
  // Handle multiple recipients (comma-separated)
  let recipientEmail = '';
  let recipientName = '';
  
  if (to) {
    // Split by comma to handle multiple recipients, take the first one
    const firstRecipient = to.split(',')[0].trim();
    
    // Handle formats like "Name <email@domain.com>" or "email@domain.com"
    const emailMatch = firstRecipient.match(/<([^>]+)>/) || firstRecipient.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
    if (emailMatch) {
      recipientEmail = emailMatch[1] || emailMatch[0];
    }
    
    const nameMatch = firstRecipient.match(/^([^<]+)</);
    if (nameMatch) {
      recipientName = nameMatch[1].trim().replace(/"/g, '');
    }
  }

  // Extract domain from email
  const domain = recipientEmail.includes('@') 
    ? recipientEmail.split('@')[1] 
    : '';

  // Parse date - prefer internalDate (more reliable) over header date
  let parsedDate = null;
  
  // First try internalDate (Unix timestamp in milliseconds)
  if (message.internalDate) {
    const timestamp = parseInt(message.internalDate);
    if (!isNaN(timestamp)) {
      parsedDate = new Date(timestamp);
      // Validate the parsed date
      if (isNaN(parsedDate.getTime())) {
        parsedDate = null;
      }
    }
  }
  
  // Fallback to Date header if internalDate is not available or invalid
  if (!parsedDate && date) {
    parsedDate = new Date(date);
    // Validate the parsed date
    if (isNaN(parsedDate.getTime())) {
      parsedDate = null;
    }
  }
  
  // Final fallback to current date if both fail
  if (!parsedDate) {
    parsedDate = new Date();
  }

  // Format date as DD/MM/YYYY HH:MM:SS (consistent with expected CSV format)
  const dd = String(parsedDate.getDate()).padStart(2, '0');
  const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
  const yyyy = parsedDate.getFullYear();
  const HH = String(parsedDate.getHours()).padStart(2, '0');
  const MM = String(parsedDate.getMinutes()).padStart(2, '0');
  const SS = String(parsedDate.getSeconds()).padStart(2, '0');
  const formattedDate = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;

  return {
    'Recipient Name': recipientName || recipientEmail || '',
    'Date': formattedDate,
    'Recipient Email': recipientEmail,
    'Domain': domain,
    'Subject': subject || '',
    'Thread ID': threadId || '',
    'From': from || '',
    'Message ID': messageId || ''
  };
}

/**
 * Convert Gmail messages to Send CSV format (optimized for large datasets)
 * @param {Array} messages - Array of Gmail message objects
 * @param {Function} onProgress - Optional progress callback (processed, total)
 * @returns {string} CSV string
 */
export function convertToSendCSV(messages, onProgress) {
  if (!messages || messages.length === 0) {
    return Papa.unparse([], {
      header: true,
      columns: ['Recipient Name', 'Date', 'Recipient Email', 'Domain', 'Subject', 'Thread ID']
    });
  }
  
  // Process in chunks for very large datasets to avoid blocking
  const chunkSize = 1000;
  const rows = [];
  
  for (let i = 0; i < messages.length; i += chunkSize) {
    const chunk = messages.slice(i, i + chunkSize);
    
    const chunkRows = chunk
      .map(parseGmailMessage)
      .filter(msg => msg && msg['Recipient Email']) // Filter out invalid messages
      .map(msg => ({
        'Recipient Name': msg['Recipient Name'],
        'Date': msg['Date'],
        'Recipient Email': msg['Recipient Email'],
        'Domain': msg['Domain'],
        'Subject': msg['Subject'],
        'Thread ID': msg['Thread ID']
      }));
    
    rows.push(...chunkRows);
    
    // Call progress callback if provided
    if (onProgress && (i + chunkSize) % 500 === 0) {
      onProgress(Math.min(i + chunkSize, messages.length), messages.length);
    }
  }

  // Use PapaParse to convert to CSV
  return Papa.unparse(rows, {
    header: true,
    columns: ['Recipient Name', 'Date', 'Recipient Email', 'Domain', 'Subject', 'Thread ID']
  });
}

/**
 * Fetch and convert Gmail sent emails to CSV (optimized for thousands of emails)
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @param {Function} options.onProgress - Optional progress callback (current, total, message)
 * @returns {Promise<string>} CSV string
 */
export async function fetchGmailDataAsCSV(options = {}) {
  const { startDate, endDate, onProgress } = options;
  
  // Validate dates
  if (startDate && (!(startDate instanceof Date) || isNaN(startDate.getTime()))) {
    throw new Error('Invalid start date');
  }
  
  if (endDate && (!(endDate instanceof Date) || isNaN(endDate.getTime()))) {
    throw new Error('Invalid end date');
  }
  
  if (startDate && endDate && startDate > endDate) {
    throw new Error('Start date must be before end date');
  }
  
  // Build Gmail query
  let query = 'in:sent';
  
  if (startDate) {
    // Format date as YYYY/MM/DD for Gmail query
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    const startStr = `${year}/${month}/${day}`;
    query += ` after:${startStr}`;
  }
  
  if (endDate) {
    // Gmail's 'before:' is exclusive, so add 1 day to make endDate inclusive
    const endDateInclusive = new Date(endDate);
    endDateInclusive.setDate(endDateInclusive.getDate() + 1);
    const year = endDateInclusive.getFullYear();
    const month = String(endDateInclusive.getMonth() + 1).padStart(2, '0');
    const day = String(endDateInclusive.getDate()).padStart(2, '0');
    const endStr = `${year}/${month}/${day}`;
    query += ` before:${endStr}`;
  }

  // Enhanced progress callback that includes conversion step
  let fetchProgressCallback = null;
  if (onProgress) {
    fetchProgressCallback = (current, total, message) => {
      onProgress(current, total, `Fetching: ${message}`);
    };
  }

  // Fetch all emails (no limit for large datasets, pagination handles it)
  const messages = await fetchSentEmails({ 
    query, 
    maxResults: null, // No limit - fetch all emails in date range
    onProgress: fetchProgressCallback
  });
  
  if (messages.length === 0) {
    throw new Error('No emails found for the selected date range');
  }
  
  // Convert to CSV with progress tracking
  if (onProgress) {
    onProgress(messages.length, messages.length, `Converting ${messages.length} emails to CSV...`);
  }
  
  const csvConversionProgress = onProgress ? 
    (processed, total) => {
      if (processed % 500 === 0 || processed === total) {
        onProgress(processed, total, `Converting to CSV: ${processed}/${total}...`);
      }
    } : null;
  
  const csvData = convertToSendCSV(messages, csvConversionProgress);
  
  if (onProgress) {
    onProgress(messages.length, messages.length, `Completed! Generated CSV with ${messages.length} emails`);
  }
  
  return csvData;
}

