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
 * Sign in with Google using Google Identity Services
 * @param {string} clientId - Google OAuth Client ID
 * @returns {Promise}
 */
export function signIn(clientId) {
  return new Promise((resolve, reject) => {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
      reject(new Error('Google Identity Services not loaded. Please refresh the page.'));
      return;
    }

    if (!gapiInitialized) {
      reject(new Error('Gmail API not initialized. Please wait a moment and try again.'));
      return;
    }

    // Use Google Identity Services for authentication
    const tokenClient = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        
        currentAccessToken = response.access_token;
        
        // Get user info using fetch (more reliable)
        fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
          headers: {
            'Authorization': `Bearer ${currentAccessToken}`
          }
        })
        .then(res => res.json())
        .then((userInfo) => {
          currentUserEmail = userInfo.email || 'Unknown';
          resolve(response);
        })
        .catch((error) => {
          console.warn('Could not fetch user email:', error);
          currentUserEmail = 'Unknown';
          resolve(response);
        });
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
    });
  } else {
    currentAccessToken = null;
    currentUserEmail = null;
  }
}

/**
 * Fetch sent emails from Gmail
 * @param {Object} options - Query options
 * @param {string} options.query - Gmail search query (e.g., 'in:sent after:2024/1/1')
 * @param {number} options.maxResults - Maximum number of results (default: 500)
 * @returns {Promise<Array>} Array of email objects
 */
export async function fetchSentEmails(options = {}) {
  const { query = 'in:sent', maxResults = 500 } = options;
  
  if (!isSignedIn() || !currentAccessToken) {
    throw new Error('User not signed in');
  }

  try {
    // Set the access token for API calls
    window.gapi.client.setToken({ access_token: currentAccessToken });

    // First, get list of message IDs
    const response = await window.gapi.client.gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: Math.min(maxResults, 500) // Gmail API limit is 500
    });

    const messages = response.result.messages || [];
    const emailPromises = messages.map(msg => 
      window.gapi.client.gmail.users.messages.get({
        userId: 'me',
        id: msg.id,
        format: 'full'
      })
    );

    // Fetch all messages in batches to avoid overwhelming the API
    const batchSize = 50;
    const allEmails = [];
    
    for (let i = 0; i < emailPromises.length; i += batchSize) {
      const batch = emailPromises.slice(i, i + batchSize);
      const batchResults = await Promise.all(batch);
      allEmails.push(...batchResults.map(r => r.result));
    }

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
  let recipientEmail = '';
  let recipientName = '';
  
  if (to) {
    // Handle formats like "Name <email@domain.com>" or "email@domain.com"
    const emailMatch = to.match(/<([^>]+)>/) || to.match(/([\w\.-]+@[\w\.-]+\.\w+)/);
    if (emailMatch) {
      recipientEmail = emailMatch[1] || emailMatch[0];
    }
    
    const nameMatch = to.match(/^([^<]+)</);
    if (nameMatch) {
      recipientName = nameMatch[1].trim().replace(/"/g, '');
    }
  }

  // Extract domain from email
  const domain = recipientEmail.includes('@') 
    ? recipientEmail.split('@')[1] 
    : '';

  // Parse date
  let parsedDate = null;
  if (date) {
    parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      parsedDate = new Date(message.internalDate ? parseInt(message.internalDate) : Date.now());
    }
  } else if (message.internalDate) {
    parsedDate = new Date(parseInt(message.internalDate));
  }

  // Format date as DD/MM/YYYY HH:MM:SS
  let formattedDate = '';
  if (parsedDate && !isNaN(parsedDate.getTime())) {
    const dd = String(parsedDate.getDate()).padStart(2, '0');
    const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
    const yyyy = parsedDate.getFullYear();
    const HH = String(parsedDate.getHours()).padStart(2, '0');
    const MM = String(parsedDate.getMinutes()).padStart(2, '0');
    const SS = String(parsedDate.getSeconds()).padStart(2, '0');
    formattedDate = `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  }

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
 * Convert Gmail messages to Send CSV format
 * @param {Array} messages - Array of Gmail message objects
 * @returns {string} CSV string
 */
export function convertToSendCSV(messages) {
  const rows = messages
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

  // Use PapaParse to convert to CSV
  return Papa.unparse(rows, {
    header: true,
    columns: ['Recipient Name', 'Date', 'Recipient Email', 'Domain', 'Subject', 'Thread ID']
  });
  const headers = ['Recipient Name', 'Date', 'Recipient Email', 'Domain', 'Subject', 'Thread ID'];
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        const value = row[header] || '';
        // Escape commas and quotes
        return `"${String(value).replace(/"/g, '""')}"`;
      }).join(',')
    )
  ];
  return csvRows.join('\n');
}

/**
 * Fetch and convert Gmail sent emails to CSV
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @returns {Promise<string>} CSV string
 */
export async function fetchGmailDataAsCSV(options = {}) {
  const { startDate, endDate } = options;
  
  // Build Gmail query
  let query = 'in:sent';
  
  if (startDate) {
    const startStr = startDate.toISOString().split('T')[0].replace(/-/g, '/');
    query += ` after:${startStr}`;
  }
  
  if (endDate) {
    const endStr = endDate.toISOString().split('T')[0].replace(/-/g, '/');
    query += ` before:${endStr}`;
  }

  const messages = await fetchSentEmails({ query, maxResults: 1000 });
  return convertToSendCSV(messages);
}

