/**
 * API service for backend communication
 */

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4030/api';

/**
 * Get authorization headers for authenticated requests
 */
const getAuthHeaders = (includeContentType = true) => {
  const token = localStorage.getItem('authToken');
  const headers = {};

  if (includeContentType) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = () => {
  return !!localStorage.getItem('authToken');
};

/**
 * SDR API functions
 */
export const sdrApi = {
  /**
   * Get all SDRs
   */
  getAll: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/sdrs`, {
        headers: getAuthHeaders(),
      });
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const errorData = contentType?.includes("application/json") 
          ? await response.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || 'Failed to fetch SDRs');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Get SDR by ID
   */
  getById: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sdrs/${id}`, {
        headers: getAuthHeaders(),
      });
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('SDR not found');
        }
        // Check if response is HTML (error page)
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const errorData = contentType?.includes("application/json") 
          ? await response.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || `Failed to fetch SDR: ${response.statusText}`);
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Create new SDR
   */
  create: async (sdrData) => {
    try {
      const response = await fetch(`${API_BASE_URL}/sdrs`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(sdrData),
      });
      
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const error = contentType?.includes("application/json")
          ? await response.json().catch(() => ({ error: 'Failed to create SDR' }))
          : { error: `Create failed: ${response.statusText}` };
        throw new Error(error.error || 'Failed to create SDR');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Update SDR
   */
  update: async (id, sdrData) => {
    const response = await fetch(`${API_BASE_URL}/sdrs/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(sdrData),
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to update SDR' }));
      throw new Error(error.error || 'Failed to update SDR');
    }
    return response.json();
  },

  /**
   * Delete SDR
   */
  delete: async (id) => {
    const response = await fetch(`${API_BASE_URL}/sdrs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      throw new Error('Failed to delete SDR');
    }
    return response.json();
  },
};

/**
 * Data API functions
 */
export const dataApi = {
  /**
   * Upload Gmail send CSV
   */
  uploadGmailSend: async (sdrId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/data/gmail-send/${sdrId}`, {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const error = contentType?.includes("application/json")
          ? await response.json().catch(() => ({ error: 'Failed to upload file' }))
          : { error: `Upload failed: ${response.statusText}` };
        throw new Error(error.error || 'Failed to upload Gmail send CSV');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Upload MailSuite CSV
   */
  uploadMailSuite: async (sdrId, file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/data/mailsuite/${sdrId}`, {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const error = contentType?.includes("application/json")
          ? await response.json().catch(() => ({ error: 'Failed to upload file' }))
          : { error: `Upload failed: ${response.statusText}` };
        throw new Error(error.error || 'Failed to upload MailSuite CSV');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Get Gmail send data as CSV
   */
  getGmailSend: async (sdrId) => {
    const response = await fetch(`${API_BASE_URL}/data/gmail-send/${sdrId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No Gmail send data found');
      }
      throw new Error('Failed to fetch Gmail send data');
    }
    return response.text();
  },

  /**
   * Get MailSuite data as CSV
   */
  getMailSuite: async (sdrId) => {
    const response = await fetch(`${API_BASE_URL}/data/mailsuite/${sdrId}`, {
      headers: getAuthHeaders(),
    });
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('No MailSuite data found');
      }
      throw new Error('Failed to fetch MailSuite data');
    }
    return response.text();
  },

  /**
   * Get data statistics
   */
  getStats: async (sdrId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/data/stats/${sdrId}`, {
        headers: getAuthHeaders(),
      });
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const errorData = contentType?.includes("application/json")
          ? await response.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || 'Failed to fetch statistics');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Upload contacts CSV
   */
  uploadContacts: async (file) => {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch(`${API_BASE_URL}/data/contacts`, {
        method: 'POST',
        body: formData,
      });

      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const error = contentType?.includes("application/json")
          ? await response.json().catch(() => ({ error: 'Failed to upload file' }))
          : { error: `Upload failed: ${response.statusText}` };
        throw new Error(error.error || 'Failed to upload contacts CSV');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Get all SDRs with their data counts
   */
  getAllSdrs: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/data/all-sdrs`, {
        headers: getAuthHeaders(),
      });
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const errorData = contentType?.includes("application/json")
          ? await response.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || 'Failed to fetch SDRs');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },

  /**
   * Get all email analytics data
   */
  getAllEmailAnalytics: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/data/all-email-analytics`, {
        headers: getAuthHeaders(),
      });
      const contentType = response.headers.get("content-type");
      
      if (!response.ok) {
        if (contentType && contentType.includes("text/html")) {
          throw new Error(`API endpoint not found. Is the backend server running on ${API_BASE_URL}?`);
        }
        const errorData = contentType?.includes("application/json")
          ? await response.json().catch(() => ({}))
          : {};
        throw new Error(errorData.error || 'Failed to fetch email analytics');
      }
      
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error('Invalid response format from server');
      }
      
      return response.json();
    } catch (error) {
      if (error.message.includes('fetch')) {
        throw new Error(`Cannot connect to backend API. Please ensure the server is running on ${API_BASE_URL}`);
      }
      throw error;
    }
  },
};

// Export utility functions
export { getAuthHeaders };
