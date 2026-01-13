/**
 * MailSuite Pro API Integration
 * Fetches email tracking data (opens & clicks) from MailSuite Pro using Web API
 * 
 * MailSuite Pro offers multiple APIs:
 * - Web API: For HTTP/HTTPS REST-based communication
 * - REST API: For manipulating accounts and domains
 * - PHP API: For server-side PHP applications
 * - JavaScript API: For client-side integration
 * 
 * This implementation uses MailSuite Pro Web API.
 * Documentation: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/using-web-api
 */

import Papa from 'papaparse';

// MailSuite Pro Web API configuration
// Set REACT_APP_MAILSUITE_API_URL to your MailSuite Pro server URL
// Example: https://your-server.com/mailsuite or https://mailsuite.yourdomain.com
let mailSuiteApiUrl = process.env.REACT_APP_MAILSUITE_API_URL || '';

// MailSuite Pro Web API typically uses these endpoint patterns
// The actual structure depends on your MailSuite Pro installation
const MAILSUITE_WEB_API_PATHS = [
  '/api/web/v1',  // Web API v1
  '/api/web',     // Web API
  '/api/v1',      // General API v1
  '/api',         // General API
];

/**
 * Authenticate with MailSuite Pro Web API
 * MailSuite Pro Web API requires username/password or API credentials
 * @param {string} baseUrl - MailSuite Pro server URL
 * @param {string} username - MailSuite Pro username/email
 * @param {string} password - MailSuite Pro password
 * @returns {Promise<string>} MailSuite Pro authentication token
 */
async function authenticateMailSuitePro(baseUrl, username, password) {
  if (!username || !password) {
    throw new Error('MailSuite Pro username and password are required');
  }

  // MailSuite Pro Web API login endpoints
  // Documentation: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/using-web-api
  const loginEndpoints = [
    '/api/web/v1/login',
    '/api/web/login',
    '/api/v1/login',
    '/api/login',
    '/webmail/api/v1/login',
    '/webmail/api/login',
  ];

  // Normalize baseUrl - remove trailing slashes
  const normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');

  for (const endpoint of loginEndpoints) {
    try {
      const url = `${normalizedBaseUrl}${endpoint}`;
      
      // MailSuite Pro Web API typically expects JSON with Email and Password
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          Email: username,
          Password: password,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        // MailSuite Pro typically returns a token in the response
        // Common field names: Token, token, AuthToken, authToken, AccessToken, accessToken
        const token = data.Token || data.token || data.AuthToken || data.authToken || 
                     data.AccessToken || data.accessToken || data.Result?.Token;
        
        if (token) {
          return token;
        }
        
        // Some MailSuite Pro versions might return token in a nested structure
        if (data.Result && data.Result.Token) {
          return data.Result.Token;
        }
        
        // If no token found but response is OK, try using session ID or other auth mechanism
        throw new Error('Authentication successful but no token received. Please check MailSuite Pro API documentation.');
      } else if (response.status === 401) {
        throw new Error('Invalid MailSuite Pro username or password');
      } else if (response.status === 403) {
        throw new Error('Access denied. Please check your MailSuite Pro account permissions.');
      } else {
        // Try next endpoint
        continue;
      }
    } catch (error) {
      // If it's an authentication error, throw it immediately
      if (error.message.includes('Invalid') || error.message.includes('Access denied') || 
          error.message.includes('Authentication successful')) {
        throw error;
      }
      // Otherwise, try next endpoint
      continue;
    }
  }

  throw new Error(
    'Unable to authenticate with MailSuite Pro API.\n\n' +
    'Please verify:\n' +
    '1. MailSuite Pro server URL is correct\n' +
    '2. MailSuite Pro Web API is enabled\n' +
    '3. Username and password are correct\n' +
    '4. Your account has API access permissions\n\n' +
    'Check MailSuite Pro documentation: https://afterlogic.com/docs/mailsuite-pro-8/developers-guide/using-web-api'
  );
}

/**
 * Fetch tracking data from MailSuite Pro Web API
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @param {string} options.username - MailSuite Pro username/email
 * @param {string} options.password - MailSuite Pro password
 * @returns {Promise<Array>} Array of tracking records
 */
export async function fetchMailSuiteTrackingData(options = {}) {
  const { startDate, endDate, username, password } = options;
  
  // MailSuite Pro Web API requires server URL
  if (!mailSuiteApiUrl) {
    throw new Error(
      'MailSuite Pro API URL not configured.\n\n' +
      'Please set REACT_APP_MAILSUITE_API_URL in your .env file.\n\n' +
      'Example: REACT_APP_MAILSUITE_API_URL=https://your-server.com/mailsuite\n\n' +
      'Or export tracking data from MailSuite Pro as CSV and upload it manually.'
    );
  }

  // MailSuite Pro requires username and password
  if (!username || !password) {
    throw new Error(
      'MailSuite Pro credentials required.\n\n' +
      'Please provide your MailSuite Pro username and password.\n\n' +
      'Note: MailSuite Pro Web API uses its own authentication system, not Google OAuth.'
    );
  }

  try {
    // Authenticate with MailSuite Pro using username/password
    const mailSuiteToken = await authenticateMailSuitePro(
      mailSuiteApiUrl,
      username,
      password
    );

    // Fetch tracking data using MailSuite Pro Web API
    return await fetchFromMailSuiteProWebAPI(
      mailSuiteApiUrl,
      mailSuiteToken,
      startDate,
      endDate
    );
  } catch (error) {
    console.error('MailSuite Pro API error:', error);
    throw error; // Re-throw to preserve original error message
  }
}

/**
 * Fetch tracking data from MailSuite Pro Web API
 * @param {string} baseUrl - MailSuite Pro server URL
 * @param {string} authToken - MailSuite Pro authentication token
 * @param {Date} startDate - Start date
 * @param {Date} endDate - End date
 * @returns {Promise<Array>} Array of tracking records
 */
async function fetchFromMailSuiteProWebAPI(baseUrl, authToken, startDate, endDate) {
  const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
  const endStr = endDate ? endDate.toISOString().split('T')[0] : '';

  // Normalize baseUrl - remove trailing slashes
  let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');

  // MailSuite Pro Web API endpoints for tracking data
  // These may vary based on your MailSuite Pro version and configuration
  const trackingEndpoints = [
    '/api/web/v1/tracking/emails',
    '/api/web/v1/emails/tracking',
    '/api/web/tracking/emails',
    '/api/web/emails/tracking',
    '/api/v1/tracking/emails',
    '/api/tracking/emails',
    '/api/v1/emails/tracking',
    '/api/emails/tracking',
  ];

  for (const endpoint of trackingEndpoints) {
    try {
      const url = `${normalizedBaseUrl}${endpoint}`;
      const params = new URLSearchParams();
      if (startStr) params.append('start_date', startStr);
      if (endStr) params.append('end_date', endStr);

      const response = await fetch(`${url}?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'X-Auth-Token': authToken, // Some MailSuite Pro versions use this header
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        return transformMailSuiteResponse(data);
      } else if (response.status === 401) {
        throw new Error('Authentication failed. Please check your MailSuite Pro credentials.');
      }
    } catch (error) {
      if (error.message.includes('Authentication failed')) {
        throw error;
      }
      // Try next endpoint
      continue;
    }
  }

  throw new Error('MailSuite Pro tracking endpoint not found. Please check your API configuration.');
}

/**
 * Legacy function - kept for compatibility
 * @deprecated Use fetchFromMailSuiteProWebAPI instead
 */
async function fetchFromMailSuiteAPI(baseUrl, accessToken, startDate, endDate) {
  return fetchFromMailSuiteProWebAPI(baseUrl, accessToken, startDate, endDate);
  const startStr = startDate ? startDate.toISOString().split('T')[0] : '';
  const endStr = endDate ? endDate.toISOString().split('T')[0] : '';

  // Normalize baseUrl - remove trailing slashes and /api if present
  let normalizedBaseUrl = baseUrl.trim().replace(/\/+$/, '');
  const hasApiInBase = normalizedBaseUrl.endsWith('/api');
  if (hasApiInBase) {
    normalizedBaseUrl = normalizedBaseUrl.replace(/\/api$/, '');
  }

  // Try different possible API endpoint patterns
  const endpoints = [
    '/api/v1/tracking/emails',
    '/api/tracking/emails',
    '/api/v1/emails/tracking',
    '/api/emails/tracking',
    '/tracking',
    '/api/tracking',
    '/v1/tracking/emails',
    '/tracking/emails',
  ];

  for (const endpoint of endpoints) {
    try {
      // Construct URL properly - avoid double /api/
      const url = `${normalizedBaseUrl}${endpoint}`;
      const params = new URLSearchParams();
      if (startStr) params.append('start_date', startStr);
      if (endStr) params.append('end_date', endStr);

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), 3000); // Reduced to 3 seconds
      });

      // Wrap fetch in try-catch to suppress all errors
      let response = null;
      try {
        response = await Promise.race([
          fetch(`${url}?${params}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
            mode: 'cors',
          }).catch(() => {
            // Silently catch all network errors (expected - MailSuite API doesn't exist)
            return null;
          }),
          timeoutPromise,
        ]).catch(() => {
          // Silently catch timeout and other errors
          return null;
        });
      } catch (err) {
        // Silently catch any other errors
        response = null;
      }

      if (response && response.ok) {
        const data = await response.json();
        return transformMailSuiteResponse(data);
      }
    } catch (error) {
      // Silently continue to next endpoint (all failures are expected)
      // Don't log anything - these are normal when API doesn't exist
      continue;
    }
  }

  throw new Error('MailSuite API endpoint not found');
}

/**
 * Transform MailSuite API response to expected format
 * @param {Object|Array} data - Raw MailSuite API response
 * @returns {Array} Transformed tracking records
 */
function transformMailSuiteResponse(data) {
  // If data is already an array, use it directly
  if (Array.isArray(data)) {
    return data.map(transformRecord);
  }

  // If data has a results/records property
  if (data.results || data.records || data.data) {
    const records = data.results || data.records || data.data;
    return Array.isArray(records) ? records.map(transformRecord) : [];
  }

  return [];
}

/**
 * Transform a single MailSuite record to our CSV format
 * @param {Object} record - Raw MailSuite record
 * @returns {Object} Transformed record
 */
function transformRecord(record) {
  // Map MailSuite fields to our expected CSV format
  // Adjust field names based on MailSuite's actual API response
  return {
    'Recipient': record.recipient_name || record.recipient || record.to_name || '',
    'Recipient Email': record.recipient_email || record.email || record.to_email || '',
    'Sent': formatDate(record.sent_date || record.sent_at || record.date_sent),
    'Opens': record.views || record.opens || record.open_count || 0,
    'Clicks': record.clicks || record.click_count || 0,
    'Last Opened': formatDate(record.last_opened || record.last_open_at),
  };
}

/**
 * Format date to DD/MM/YYYY HH:MM:SS format
 * @param {string|Date|number} date - Date value
 * @returns {string} Formatted date string
 */
function formatDate(date) {
  if (!date) return '';
  
  try {
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    const HH = String(d.getHours()).padStart(2, '0');
    const MM = String(d.getMinutes()).padStart(2, '0');
    const SS = String(d.getSeconds()).padStart(2, '0');
    
    return `${dd}/${mm}/${yyyy} ${HH}:${MM}:${SS}`;
  } catch (e) {
    return '';
  }
}

/**
 * Convert MailSuite tracking data to Opens CSV format
 * @param {Array} records - Array of tracking records
 * @returns {string} CSV string
 */
export function convertToOpensCSV(records) {
  if (!Array.isArray(records) || records.length === 0) {
    // Return empty CSV with headers
    return 'Recipient,Sent,Opens,Clicks,Last Opened\n';
  }

  const rows = records
    .filter(record => record && record['Recipient Email']) // Filter out invalid records
    .map(record => ({
      'Recipient': record['Recipient'] || record['Recipient Email'] || '',
      'Sent': record['Sent'] || '',
      'Opens': record['Opens'] || 0,
      'Clicks': record['Clicks'] || 0,
      'Last Opened': record['Last Opened'] || '',
    }));

  // Use PapaParse to convert to CSV
  return Papa.unparse(rows, {
    header: true,
    columns: ['Recipient', 'Sent', 'Opens', 'Clicks', 'Last Opened']
  });
}

/**
 * Fetch and convert MailSuite tracking data to CSV
 * @param {Object} options - Query options
 * @param {Date} options.startDate - Start date for filtering
 * @param {Date} options.endDate - End date for filtering
 * @param {string} options.username - MailSuite Pro username/email
 * @param {string} options.password - MailSuite Pro password
 * @returns {Promise<string>} CSV string
 */
export async function fetchMailSuiteDataAsCSV(options = {}) {
  try {
    // Fetch tracking data using MailSuite Pro credentials
    const records = await fetchMailSuiteTrackingData(options);
    
    if (!records || records.length === 0) {
      throw new Error(
        'No MailSuite tracking data found for the selected date range.\n\n' +
        'This could mean:\n' +
        '1. No emails were sent with MailSuite tracking in this date range\n' +
        '2. MailSuite Pro API returned no data\n' +
        '3. Date range has no tracking records\n\n' +
        'Please try:\n' +
        '- Export tracking data from MailSuite Pro as CSV and upload it manually\n' +
        '- Try a different date range\n' +
        '- Verify emails were sent with MailSuite tracking enabled'
      );
    }
    
    return convertToOpensCSV(records);
  } catch (error) {
    // Re-throw with original error message
    throw error;
  }
}


