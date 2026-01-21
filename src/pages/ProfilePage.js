import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { sdrApi, dataApi } from "../utils/api";
import {
  initGmailAPI,
  isSignedIn,
  signIn,
  signOut,
  getCurrentUserEmail,
  fetchGmailDataAsCSV,
  fetchUserEmail,
  isGmailAPIReady,
  waitForGmailAPI,
} from "../utils/gmailApi";
import Papa from "papaparse";

function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("profile");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [stats, setStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [uploadHistory, setUploadHistory] = useState([]);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    team: "",
    role: "",
  });

  // File upload state
  const [gmailSendFile, setGmailSendFile] = useState(null);
  const [mailsuiteFile, setMailsuiteFile] = useState(null);
  const [contactsFile, setContactsFile] = useState(null);
  const [uploadingGmail, setUploadingGmail] = useState(false);
  const [uploadingMailSuite, setUploadingMailSuite] = useState(false);
  const [uploadingContacts, setUploadingContacts] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState({ gmail: false, mailsuite: false, contacts: false });
  const [uploadError, setUploadError] = useState({ gmail: "", mailsuite: "", contacts: "" });

  // Gmail integration state
  const [gmailSignedIn, setGmailSignedIn] = useState(false);
  const [gmailUserEmail, setGmailUserEmail] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailFetching, setGmailFetching] = useState(false);
  const [gmailFetchProgress, setGmailFetchProgress] = useState({ current: 0, total: 0, message: "" });
  const [gmailFetchedData, setGmailFetchedData] = useState(null);
  const [gmailTableData, setGmailTableData] = useState([]);
  const [gmailTableHeaders, setGmailTableHeaders] = useState([]);
  const [gmailAPIReady, setGmailAPIReady] = useState(false);
  const [gmailStartDate, setGmailStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [gmailEndDate, setGmailEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Load SDR profile and stats
  const userId = user?._id || user?.id;
  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || "",
        email: user.email || "",
        team: user.team || "",
        role: user.role || "",
      });
      // Initialize upload history from user data
      setUploadHistory(user.upload_history || []);
      loadStats();
    }
  }, [userId]); // Only run when user ID changes

  // Check Gmail sign-in status periodically
  useEffect(() => {
    const checkGmailSignIn = () => {
      if (isSignedIn()) {
        setGmailSignedIn(true);
        setGmailUserEmail(getCurrentUserEmail());
      } else {
        setGmailSignedIn(false);
        setGmailUserEmail(null);
      }
    };

    checkGmailSignIn();
    const interval = setInterval(checkGmailSignIn, 1000);
    return () => clearInterval(interval);
  }, []);

  // Initialize Gmail API
  useEffect(() => {
    const initializeGmail = () => {
      const apiKey = process.env.REACT_APP_GOOGLE_API_KEY || "";

      if (!apiKey) {
        console.warn("Google API key not configured. Set REACT_APP_GOOGLE_API_KEY in .env file");
        return;
      }

      if (window.gapi) {
        initGmailAPI(apiKey, async () => {
          setGmailAPIReady(true);
          if (isSignedIn()) {
            setGmailSignedIn(true);
            let email = getCurrentUserEmail();
            
            if (!email || email === 'Unknown') {
              try {
                email = await fetchUserEmail();
              } catch (error) {
                console.warn('Could not fetch user email:', error);
                email = getCurrentUserEmail();
              }
            }
            
            setGmailUserEmail(email);
          }
        });
      } else {
        setTimeout(initializeGmail, 500);
      }
    };

    const checkLibraries = setInterval(() => {
      if (window.gapi && window.google && window.google.accounts) {
        clearInterval(checkLibraries);
        initializeGmail();
      }
    }, 100);

    const timeout = setTimeout(() => {
      clearInterval(checkLibraries);
      if (!window.gapi || !window.google) {
        console.error("Google API libraries failed to load");
      }
    }, 10000);

    return () => {
      clearInterval(checkLibraries);
      clearTimeout(timeout);
    };
  }, []);

  const loadStats = async () => {
    if (!user?._id && !user?.id) return;
    
    setStatsLoading(true);
    try {
      const sdrId = user._id || user.id;
      const statistics = await dataApi.getStats(sdrId);
      setStats(statistics);
      
      // Reload user data to get upload history
      const updatedSdr = await sdrApi.getById(sdrId);
      if (updatedSdr && updatedSdr.upload_history) {
        // Update upload history state without triggering user state change
        setUploadHistory(updatedSdr.upload_history);
      }
    } catch (err) {
      console.log("Stats not available:", err.message);
    } finally {
      setStatsLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user?._id && !user?.id) return;
    
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const sdrId = user._id || user.id;
      const updated = await sdrApi.update(sdrId, formData);
      updateUser(updated);
      setSuccess("Profile updated successfully!");
      setTimeout(() => setSuccess(""), 3000);
    } catch (err) {
      setError(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleGmailSendUpload = async () => {
    if (!gmailSendFile || !user?._id && !user?.id) {
      setUploadError({ ...uploadError, gmail: "Please select a file" });
      return;
    }

    setUploadingGmail(true);
    setUploadError({ ...uploadError, gmail: "" });
    setUploadSuccess({ ...uploadSuccess, gmail: false });

    try {
      const sdrId = user._id || user.id;
      const result = await dataApi.uploadGmailSend(sdrId, gmailSendFile);
      setUploadSuccess({ ...uploadSuccess, gmail: true });
      setGmailSendFile(null);
      setGmailFetchedData(null);
      loadStats();
      setTimeout(() => setUploadSuccess({ ...uploadSuccess, gmail: false }), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError({ ...uploadError, gmail: err.message || "Failed to upload file" });
    } finally {
      setUploadingGmail(false);
    }
  };

  // Gmail integration handlers
  const handleGmailSignIn = async () => {
    try {
      setGmailLoading(true);
      setUploadError({ ...uploadError, gmail: "" });

      const apiKey = process.env.REACT_APP_GOOGLE_API_KEY || "";
      if (!apiKey) {
        setUploadError({ ...uploadError, gmail: "Google API Key not configured. Please set REACT_APP_GOOGLE_API_KEY in .env file" });
        setGmailLoading(false);
        return;
      }

      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
      if (!clientId) {
        setUploadError({ ...uploadError, gmail: "Google Client ID not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in .env file" });
        setGmailLoading(false);
        return;
      }

      if (!window.google || !window.google.accounts) {
        setUploadError({ ...uploadError, gmail: "Google Identity Services not loaded. Please refresh the page." });
        setGmailLoading(false);
        return;
      }

      // Ensure Gmail API is initialized
      if (!gmailAPIReady) {
        if (!window.gapi) {
          setUploadError({ ...uploadError, gmail: "Google API libraries not loaded. Please refresh the page." });
          setGmailLoading(false);
          return;
        }

        // Try to initialize if not already done
        if (!isGmailAPIReady()) {
          initGmailAPI(apiKey, () => {
            setGmailAPIReady(true);
          });
          
          // Wait for initialization
          const isReady = await waitForGmailAPI(10000);
          if (!isReady) {
            setUploadError({ ...uploadError, gmail: "Gmail API initialization timed out. Please refresh the page and try again." });
            setGmailLoading(false);
            return;
          }
          setGmailAPIReady(true);
        }
      }

      await signIn(clientId, 10000);
      
      let email = getCurrentUserEmail();
      if (!email || email === 'Unknown') {
        try {
          email = await fetchUserEmail();
        } catch (error) {
          console.warn('Could not fetch user email after sign in:', error);
        }
      }
    } catch (error) {
      console.error("Gmail sign-in error:", error);
      setUploadError({ ...uploadError, gmail: `Failed to sign in with Google: ${error.message || "Unknown error"}` });
    } finally {
      setGmailLoading(false);
    }
  };

  const handleGmailSignOut = () => {
    signOut();
    setGmailFetchedData(null);
  };

  const handleFetchGmailData = async () => {
    if (!gmailSignedIn) {
      setUploadError({ ...uploadError, gmail: "Please sign in with Google first" });
      return;
    }

    if (!gmailStartDate || !gmailEndDate) {
      setUploadError({ ...uploadError, gmail: "Please select both start and end dates" });
      return;
    }

    const start = new Date(gmailStartDate);
    const end = new Date(gmailEndDate);

    if (start > end) {
      setUploadError({ ...uploadError, gmail: "Start date must be before end date" });
      return;
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setUploadError({ ...uploadError, gmail: "Invalid date selected" });
      return;
    }

    try {
      setGmailFetching(true);
      setUploadError({ ...uploadError, gmail: "" });
      setGmailFetchedData(null);

      const progressCallback = (current, total, message) => {
        setGmailFetchProgress({
          current: current || 0,
          total: total || 0,
          message: message || ""
        });
      };

      const csvData = await fetchGmailDataAsCSV({ 
        startDate: start, 
        endDate: end,
        onProgress: progressCallback
      });
      
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('No email data retrieved');
      }
      
      setGmailFetchedData(csvData);

      // Parse CSV data for table view
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setGmailTableHeaders(Object.keys(results.data[0]));
            setGmailTableData(results.data);
          } else {
            setGmailTableData([]);
            setGmailTableHeaders([]);
          }
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          setGmailTableData([]);
          setGmailTableHeaders([]);
        },
      });

      // Create a File object from the CSV string and attach to upload field
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], `gmail-sent-emails-${Date.now()}.csv`, { type: "text/csv" });
      
      // Always set the file to the upload field
      setGmailSendFile(file);
      
      // Auto-upload the fetched data
      if (user?._id || user?.id) {
        setUploadingGmail(true);
        setUploadError({ ...uploadError, gmail: "" });
        setUploadSuccess({ ...uploadSuccess, gmail: false });

        try {
          const sdrId = user._id || user.id;
          const result = await dataApi.uploadGmailSend(sdrId, file);
          setUploadSuccess({ ...uploadSuccess, gmail: true });
          loadStats();
          setTimeout(() => setUploadSuccess({ ...uploadSuccess, gmail: false }), 3000);
        } catch (err) {
          console.error('Upload error:', err);
          setUploadError({ ...uploadError, gmail: err.message || "Failed to upload file" });
        } finally {
          setUploadingGmail(false);
        }
      }
    } catch (error) {
      console.error("Error fetching Gmail data:", error);
      
      let errorMessage = "Failed to fetch Gmail data";
      if (error.message) {
        if (error.message.includes("not signed in") || error.message.includes("expired")) {
          errorMessage = "Your session has expired. Please sign in again.";
        } else if (error.message.includes("No emails found")) {
          errorMessage = "No emails found for the selected date range. Please try a different date range.";
        } else if (error.message.includes("rate limit") || error.message.includes("429")) {
          errorMessage = "Gmail API rate limit reached. Please wait a few minutes and try again. For large datasets, the process may take longer.";
        } else {
          errorMessage = error.message;
        }
      }
      
      setUploadError({ ...uploadError, gmail: errorMessage });
      setGmailFetchedData(null);
      setGmailFetchProgress({ current: 0, total: 0, message: "" });
    } finally {
      setGmailFetching(false);
    }
  };

  const handleMailSuiteUpload = async () => {
    if (!mailsuiteFile || !user?._id && !user?.id) {
      setUploadError({ ...uploadError, mailsuite: "Please select a file" });
      return;
    }

    setUploadingMailSuite(true);
    setUploadError({ ...uploadError, mailsuite: "" });
    setUploadSuccess({ ...uploadSuccess, mailsuite: false });

    try {
      const sdrId = user._id || user.id;
      const result = await dataApi.uploadMailSuite(sdrId, mailsuiteFile);
      setUploadSuccess({ ...uploadSuccess, mailsuite: true });
      setMailsuiteFile(null);
      loadStats();
      setTimeout(() => setUploadSuccess({ ...uploadSuccess, mailsuite: false }), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError({ ...uploadError, mailsuite: err.message || "Failed to upload file" });
    } finally {
      setUploadingMailSuite(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleContactsUpload = async () => {
    if (!contactsFile) {
      setUploadError({ ...uploadError, contacts: "Please select a file" });
      return;
    }

    setUploadingContacts(true);
    setUploadError({ ...uploadError, contacts: "" });
    setUploadSuccess({ ...uploadSuccess, contacts: false });

    try {
      const result = await dataApi.uploadContacts(contactsFile);
      setUploadSuccess({ ...uploadSuccess, contacts: true });
      setContactsFile(null);
      loadStats();
      setTimeout(() => setUploadSuccess({ ...uploadSuccess, contacts: false }), 3000);
    } catch (err) {
      console.error('Upload error:', err);
      setUploadError({ ...uploadError, contacts: err.message || "Failed to upload file" });
    } finally {
      setUploadingContacts(false);
    }
  };

  // Define allowed admin emails for contacts upload
  const adminEmails = [
    "vivek.kumar@loopwork.co",
    "vipul.babar@loopwork.co",
    "harshit.gupta@loopwork.co"
  ];

  const isAdmin = user && adminEmails.includes(user.email?.toLowerCase());

  const tabs = [
    { id: "profile", label: "Profile", icon: "👤" },
    { id: "gmail", label: "Gmail Data", icon: "📧" },
    { id: "mailsuite", label: "MailSuite Data", icon: "📊" },
    ...(isAdmin ? [{ id: "contacts", label: "Contacts", icon: "👥" }] : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">My Profile</h1>
              {isAdmin && (
                <span className="px-2 py-1 bg-purple-100 text-purple-700 text-sm font-medium rounded-full">
                  Admin
                </span>
              )}
            </div>
            <p className="text-gray-600">Manage your profile and upload data files</p>
          </div>
          <button
            onClick={() => {
              logout();
              navigate("/login");
            }}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            Logout
          </button>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Gmail Send Records</p>
                  <p className="text-3xl font-bold text-blue-600 mt-2">
                    {stats.gmail_send_records || 0}
                  </p>
                  {user?.last_gmail_upload && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(user.last_gmail_upload).toLocaleDateString()} {new Date(user.last_gmail_upload).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="text-4xl">📧</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">MailSuite Records</p>
                  <p className="text-3xl font-bold text-purple-600 mt-2">
                    {stats.mailsuite_records || 0}
                  </p>
                  {user?.last_mailsuite_upload && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(user.last_mailsuite_upload).toLocaleDateString()} {new Date(user.last_mailsuite_upload).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="text-4xl">📊</div>
              </div>
            </div>
            <div className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Contact Records</p>
                  <p className="text-3xl font-bold text-green-600 mt-2">
                    {stats.contact_records || 0}
                  </p>
                  {user?.last_contacts_upload && (
                    <p className="text-xs text-gray-500 mt-1">
                      Last: {new Date(user.last_contacts_upload).toLocaleDateString()} {new Date(user.last_contacts_upload).toLocaleTimeString()}
                    </p>
                  )}
                </div>
                <div className="text-4xl">👥</div>
              </div>
            </div>
          </div>
        )}

        {/* Upload History Section */}
        {uploadHistory && uploadHistory.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Upload History</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Uploaded At
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Total Records
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Inserted
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Skipped
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                      Filename
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {uploadHistory
                    .slice()
                    .sort((a, b) => new Date(b.uploaded_at) - new Date(a.uploaded_at))
                    .slice(0, 20)
                    .map((upload, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            upload.type === 'gmail_send' ? 'bg-blue-100 text-blue-800' :
                            upload.type === 'mailsuite' ? 'bg-purple-100 text-purple-800' :
                            'bg-green-100 text-green-800'
                          }`}>
                            {upload.type === 'gmail_send' ? '📧 Gmail' :
                             upload.type === 'mailsuite' ? '📊 MailSuite' :
                             '👥 Contacts'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {new Date(upload.uploaded_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                          {upload.total_records.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-green-700 whitespace-nowrap font-medium">
                          {upload.inserted.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {upload.skipped.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 truncate max-w-xs" title={upload.filename || ''}>
                          {upload.filename || '-'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            {uploadHistory.length > 20 && (
              <p className="text-xs text-gray-500 mt-3 text-center">
                Showing last 20 uploads of {uploadHistory.length} total
              </p>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex-1 py-4 px-6 text-center font-medium text-sm transition-colors
                    ${
                      activeTab === tab.id
                        ? "text-blue-600 border-b-2 border-blue-600"
                        : "text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }
                  `}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {/* Alerts */}
            {error && (
              <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                {success}
              </div>
            )}

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Profile Information</h2>
                  
                  {/* Profile Picture */}
                  <div className="mb-6 flex items-center space-x-4">
                    {user?.picture ? (
                      <img
                        src={user.picture}
                        alt={user.name || user.email || "Profile"}
                        className="w-20 h-20 rounded-full object-cover border-4 border-blue-200 shadow-md"
                        onError={(e) => {
                          // Fallback to default avatar if image fails to load
                          e.target.onerror = null;
                          e.target.src = '';
                          e.target.style.display = 'none';
                          const fallback = e.target.parentElement.querySelector('.profile-avatar-fallback');
                          if (fallback) fallback.style.display = 'flex';
                        }}
                      />
                    ) : null}
                    <div className={`flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 border-4 border-blue-200 shadow-md profile-avatar-fallback ${user?.picture ? 'hidden' : 'flex'}`}>
                      <span className="text-blue-600 font-bold text-3xl">
                        {(user?.name || user?.email || "U")[0].toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Profile Picture</p>
                      <p className="text-xs text-gray-500">From Google Account</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        SDR Name *
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Email
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Team</label>
                      <input
                        type="text"
                        value={formData.team}
                        onChange={(e) => setFormData({ ...formData, team: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                      <input
                        type="text"
                        value={formData.role}
                        onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="mt-6 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? "Saving..." : "Save Profile"}
                  </button>
                </div>
              </div>
            )}

            {/* Gmail Tab */}
            {activeTab === "gmail" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Gmail Send CSV</h2>
                  
                  {/* Gmail Integration Section */}
                  <div className="mb-6 border-2 border-blue-500 rounded-lg overflow-hidden bg-white">
                    <div className="bg-blue-600 px-4 py-3">
                      <h3 className="text-lg font-bold text-white flex items-center">
                        <span className="mr-2">📧</span>
                        Gmail Integration
                      </h3>
                    </div>
                    
                    <div className="p-4 space-y-4">
                      {uploadError.gmail && (
                        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                          {uploadError.gmail}
                        </div>
                      )}

                      {!gmailSignedIn ? (
                        <div className="space-y-3">
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                            Sign in with Google to fetch your sent emails directly from Gmail. This will automatically populate and upload your Send CSV data.
                          </div>
                          <button
                            onClick={handleGmailSignIn}
                            disabled={gmailLoading}
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {gmailLoading ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Signing in...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                                Sign in with Google
                              </>
                            )}
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {/* Connected Status */}
                          <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                <svg className="w-6 h-6 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                </svg>
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900">{gmailUserEmail || "Connected"}</p>
                                <p className="text-xs text-gray-600">Connected to Gmail</p>
                              </div>
                            </div>
                            <button
                              onClick={handleGmailSignOut}
                              className="px-3 py-1.5 text-sm border border-blue-600 text-blue-600 rounded-lg hover:bg-blue-50 transition"
                            >
                              Sign Out
                            </button>
                          </div>

                          {/* Date Range Selection */}
                          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                            <p className="text-sm font-semibold text-gray-700 mb-3">📅 Select Date Range</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">Start Date</label>
                                <input
                                  type="date"
                                  value={gmailStartDate}
                                  onChange={(e) => {
                                    setGmailStartDate(e.target.value);
                                    setUploadError({ ...uploadError, gmail: "" });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                              </div>
                              <div>
                                <label className="block text-xs text-gray-600 mb-1">End Date</label>
                                <input
                                  type="date"
                                  value={gmailEndDate}
                                  onChange={(e) => {
                                    setGmailEndDate(e.target.value);
                                    setUploadError({ ...uploadError, gmail: "" });
                                  }}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none text-sm"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-gray-500 mt-2">
                              Emails will be fetched for the selected date range
                            </p>
                          </div>

                          {/* Fetch Button */}
                          <button
                            onClick={handleFetchGmailData}
                            disabled={gmailFetching || !gmailStartDate || !gmailEndDate}
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                          >
                            {gmailFetching ? (
                              <>
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                                Fetching emails...
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                Fetch Sent Emails from Gmail
                              </>
                            )}
                          </button>

                          {/* Progress Indicator */}
                          {gmailFetching && (
                            <div className="space-y-2">
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: gmailFetchProgress.total > 0
                                      ? `${(gmailFetchProgress.current / gmailFetchProgress.total) * 100}%`
                                      : "100%"
                                  }}
                                ></div>
                              </div>
                              {gmailFetchProgress.message && (
                                <p className="text-xs text-gray-600">
                                  {gmailFetchProgress.message}
                                  {gmailFetchProgress.total > 0 && ` (${gmailFetchProgress.current.toLocaleString()}/${gmailFetchProgress.total.toLocaleString()})`}
                                </p>
                              )}
                              {gmailFetchProgress.total > 1000 && (
                                <div className="bg-blue-50 border border-blue-200 rounded-lg p-2 text-xs text-blue-800">
                                  ⚠️ Large dataset detected. This may take several minutes. Please keep this window open.
                                </div>
                              )}
                            </div>
                          )}

                          {/* Success Message */}
                          {gmailFetchedData && !gmailFetching && (
                            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                              <p className="text-sm font-semibold text-green-800 mb-1">
                                ✓ Email data fetched successfully!
                              </p>
                              <p className="text-xs text-green-700">
                                {gmailTableData.length > 0
                                  ? `${gmailTableData.length.toLocaleString()} emails found and uploaded`
                                  : "Data uploaded successfully"}
                              </p>
                            </div>
                          )}

                          {/* Data Table */}
                          {gmailTableData.length > 0 && !gmailFetching && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-sm font-semibold text-gray-900">
                                  Fetched Email Records ({gmailTableData.length.toLocaleString()})
                                </h4>
                              </div>
                              <div className="border border-gray-200 rounded-lg overflow-hidden">
                                <div className="overflow-x-auto max-h-96 overflow-y-auto">
                                  <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50 sticky top-0">
                                      <tr>
                                        {gmailTableHeaders.map((header, idx) => (
                                          <th
                                            key={idx}
                                            className="px-4 py-3 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap"
                                          >
                                            {header}
                                          </th>
                                        ))}
                                      </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                      {gmailTableData.map((row, rowIdx) => (
                                        <tr
                                          key={rowIdx}
                                          className="hover:bg-gray-50 transition-colors"
                                        >
                                          {gmailTableHeaders.map((header, colIdx) => (
                                            <td
                                              key={colIdx}
                                              className="px-4 py-3 text-xs text-gray-700 whitespace-nowrap max-w-xs truncate"
                                              title={row[header] || ""}
                                            >
                                              {row[header] || "-"}
                                            </td>
                                          ))}
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                                {gmailTableData.length > 100 && (
                                  <div className="bg-gray-50 px-4 py-2 border-t border-gray-200">
                                    <p className="text-xs text-gray-600 text-center">
                                      Showing all {gmailTableData.length.toLocaleString()} records. Scroll to see more.
                                    </p>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300"></div>
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-4 bg-white text-gray-500 font-medium">OR</span>
                    </div>
                  </div>

                  {/* Manual Upload Section */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-3">Manual Upload</h3>
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Gmail Send CSV File
                        </label>
                        <div className="flex items-center space-x-4">
                          <label className="flex-1 cursor-pointer">
                            <input
                              type="file"
                              accept=".csv"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0] || null;
                                setGmailSendFile(file);
                                setUploadError({ ...uploadError, gmail: "" });
                              }}
                            />
                            <div className={`w-full px-4 py-3 border-2 border-dashed rounded-lg transition text-center ${
                              gmailSendFile && gmailFetchedData
                                ? "border-green-500 bg-green-50"
                                : "border-gray-300 hover:border-blue-500"
                            }`}>
                              {gmailSendFile ? (
                                <div className="flex items-center justify-center space-x-2">
                                  <span>{gmailSendFile.name}</span>
                                  {gmailFetchedData && (
                                    <span className="text-xs text-green-600 font-medium">(from Gmail)</span>
                                  )}
                                </div>
                              ) : (
                                "Choose File"
                              )}
                            </div>
                          </label>
                        </div>
                      </div>

                      {uploadSuccess.gmail && (
                        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                          ✓ Gmail send CSV uploaded successfully!
                        </div>
                      )}

                      <button
                        onClick={handleGmailSendUpload}
                        disabled={!gmailSendFile || uploadingGmail}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {uploadingGmail ? "Uploading..." : "Upload Gmail Send CSV"}
                      </button>

                      {uploadingGmail && (
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div className="bg-blue-600 h-2 rounded-full animate-pulse" style={{ width: "100%" }}></div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MailSuite Tab */}
            {activeTab === "mailsuite" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload MailSuite CSV</h2>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select MailSuite CSV File
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setMailsuiteFile(file);
                              setUploadError({ ...uploadError, mailsuite: "" });
                            }}
                          />
                          <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 transition text-center">
                            {mailsuiteFile ? mailsuiteFile.name : "Choose File"}
                          </div>
                        </label>
                      </div>
                    </div>

                    {uploadSuccess.mailsuite && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                        ✓ MailSuite CSV uploaded successfully!
                      </div>
                    )}

                    {uploadError.mailsuite && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {uploadError.mailsuite}
                      </div>
                    )}

                    <button
                      onClick={handleMailSuiteUpload}
                      disabled={!mailsuiteFile || uploadingMailSuite}
                      className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingMailSuite ? "Uploading..." : "Upload MailSuite CSV"}
                    </button>

                    {uploadingMailSuite && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-purple-600 h-2 rounded-full animate-pulse" style={{ width: "100%" }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Contacts Tab */}
            {activeTab === "contacts" && (
              <div className="space-y-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Contacts CSV</h2>
                  <p className="text-sm text-gray-600 mb-4">
                    Upload a contacts CSV file. Contacts are shared across all SDRs and used for matching email analytics data.
                  </p>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Contacts CSV File
                      </label>
                      <div className="flex items-center space-x-4">
                        <label className="flex-1 cursor-pointer">
                          <input
                            type="file"
                            accept=".csv"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setContactsFile(file);
                              setUploadError({ ...uploadError, contacts: "" });
                            }}
                          />
                          <div className="w-full px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 transition text-center">
                            {contactsFile ? contactsFile.name : "Choose File"}
                          </div>
                        </label>
                      </div>
                    </div>

                    {uploadSuccess.contacts && (
                      <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
                        ✓ Contacts CSV uploaded successfully!
                      </div>
                    )}

                    {uploadError.contacts && (
                      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {uploadError.contacts}
                      </div>
                    )}

                    <button
                      onClick={handleContactsUpload}
                      disabled={!contactsFile || uploadingContacts}
                      className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-4 rounded-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {uploadingContacts ? "Uploading..." : "Upload Contacts CSV"}
                    </button>

                    {uploadingContacts && (
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div className="bg-green-600 h-2 rounded-full animate-pulse" style={{ width: "100%" }}></div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
