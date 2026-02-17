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

  // Upload preview modal (before Gmail/MailSuite upload)
  const [uploadPreview, setUploadPreview] = useState({
    open: false,
    type: null,
    file: null,
    total: 0,
    toUpload: 0,
    toSkip: 0,
    filterString: null,
    userFilterOverride: '',
    domainsToSkip: '',
    records: [],
    skippedRecords: [],
    selectedIndices: new Set(),
  });

  // Pre-upload filters (common for Gmail and MailSuite, persisted to database)
  const [uploadTabFilters, setUploadTabFilters] = useState({ warmupFilter: '', domainsToSkip: '' });
  const [filtersSaved, setFiltersSaved] = useState(false);
  const [filtersLoadError, setFiltersLoadError] = useState('');
  const [savingFilters, setSavingFilters] = useState(false);
  const [toast, setToast] = useState({ open: false, message: '', type: 'success' });

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

  // Load saved upload filters from database when user is available
  useEffect(() => {
    if (!userId) return;
    const loadFilters = async () => {
      try {
        setFiltersLoadError('');
        const saved = await dataApi.getUploadFilters();
        setUploadTabFilters({
          warmupFilter: saved.warmupFilter || '',
          domainsToSkip: saved.domainsToSkip || '',
        });
      } catch (_) {
        // Silently fallback - user may not have token (email-only login)
      }
    };
    loadFilters();
  }, [userId]);

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

  const getEmailBodyFromRecord = (record) => {
    if (!record || typeof record !== 'object') return '';
    return record['Body'] || record['body'] || record['Email Body'] || record['email_body'] ||
      record['Message'] || record['message'] || record['Content'] || record['content'] ||
      record['Snippet'] || record['snippet'] || '';
  };

  const getDisplayEmail = (record) => {
    if (!record || typeof record !== 'object') return '';
    const direct = record['Recipient Email'] || record['recipient_email'] || record['Email'] || record['email'] || record['To'] || record['to'] || '';
    if (direct && direct.includes('@')) return direct.trim();
    const combined = record['Recipient'] || record['recipient'] || record['To'] || record['to'] || record['Recipient Name'] || record['recipient_name'] || '';
    const match = String(combined).match(/[a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+/);
    return match ? match[0] : '';
  };

  const getDomainFromRecord = (record) => {
    if (!record || typeof record !== 'object') return '';
    const domain = record['Domain'] || record['domain'] || '';
    if (domain) return String(domain).toLowerCase().trim();
    const email = record['Recipient Email'] || record['recipient_email'] || record['Email'] || record['email'] || '';
    if (email && email.includes('@')) return email.split('@')[1].toLowerCase().trim();
    const recipient = record['Recipient'] || record['recipient'] || '';
    const match = recipient.match(/@([^\s,]+)/);
    return match ? match[1].toLowerCase().trim() : '';
  };

  const parseDomainsToSkip = (str) => {
    if (!str || !str.trim()) return new Set();
    return new Set(
      str
        .split(/[\n,]+/)
        .map((d) => d.trim().toLowerCase())
        .filter((d) => d && !d.startsWith('@'))
    );
  };

  const isWarmupRecord = (record, filterString) => {
    if (!filterString || !filterString.trim()) return false;
    const body = getEmailBodyFromRecord(record);
    if (!body) return false;
    return String(body).toLowerCase().includes(filterString.trim().toLowerCase());
  };

  const computePreviewFromRecords = (records, effectiveFilter, domainsToSkipStr) => {
    const recs = Array.isArray(records) ? records : [];
    const skipDomains = parseDomainsToSkip(domainsToSkipStr);
    const warmupIndices = new Set();
    const domainSkipIndices = new Set();
    recs.forEach((r, i) => {
      if (r && isWarmupRecord(r, effectiveFilter)) warmupIndices.add(i);
      const dom = getDomainFromRecord(r);
      if (dom && skipDomains.has(dom)) domainSkipIndices.add(i);
    });
    const excludeIndices = new Set([...warmupIndices, ...domainSkipIndices]);
    const selectedIndices = new Set();
    recs.forEach((_, i) => {
      if (!excludeIndices.has(i)) selectedIndices.add(i);
    });
    const toSkip = recs.length - selectedIndices.size;
    const toUpload = selectedIndices.size;
    const skippedRecords = [...excludeIndices].slice(0, 100).map(i => ({
      ...(recs[i] || {}),
      _row: i + 2,
    }));
    return { toUpload, toSkip, skippedRecords, selectedIndices };
  };

  const buildUploadPreview = async (file, type) => {
    if (!file || typeof file.text !== 'function') {
      throw new Error('Invalid file');
    }
    const text = await file.text();
    if (!text || typeof text !== 'string') {
      throw new Error('File is empty');
    }
    let parsed;
    try {
      parsed = Papa.parse(text, { header: true, skipEmptyLines: true });
    } catch (e) {
      throw new Error('Failed to parse CSV: ' + (e?.message || 'Invalid format'));
    }
    const records = Array.isArray(parsed?.data) ? parsed.data : [];
    if (records.length === 0) {
      throw new Error('No records found in CSV');
    }
    let filterString = null;
    try {
      const { filterString: fs } = await dataApi.getWarmupFilter();
      filterString = fs ?? null;
    } catch (_) {
      filterString = null;
    }
    const { toUpload, toSkip, skippedRecords, selectedIndices } = computePreviewFromRecords(records, filterString, '');
    return {
      open: true,
      type,
      file,
      total: records.length,
      toUpload,
      toSkip,
      filterString,
      userFilterOverride: '',
      domainsToSkip: '',
      records,
      skippedRecords,
      selectedIndices: selectedIndices instanceof Set ? selectedIndices : new Set(),
    };
  };

  const handleUserFilterChange = (value) => {
    setUploadPreview((prev) => {
      const effectiveFilter = (value || '').trim() ? (value || '').trim() : prev.filterString;
      const { toUpload, toSkip, skippedRecords, selectedIndices } = computePreviewFromRecords(prev.records || [], effectiveFilter, prev.domainsToSkip || '');
      return {
        ...prev,
        userFilterOverride: value ?? '',
        toUpload,
        toSkip,
        skippedRecords,
        selectedIndices,
      };
    });
  };

  const handleDomainsToSkipChange = (value) => {
    setUploadPreview((prev) => {
      const effectiveFilter = (prev.userFilterOverride || '').trim() ? (prev.userFilterOverride || '').trim() : prev.filterString;
      const { toUpload, toSkip, skippedRecords, selectedIndices } = computePreviewFromRecords(prev.records || [], effectiveFilter, value || '');
      return {
        ...prev,
        domainsToSkip: value ?? '',
        toUpload,
        toSkip,
        skippedRecords,
        selectedIndices,
      };
    });
  };

  const handleToggleRecord = (index) => {
    setUploadPreview((prev) => {
      const current = prev.selectedIndices instanceof Set ? prev.selectedIndices : new Set();
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      const recCount = Array.isArray(prev.records) ? prev.records.length : 0;
      return {
        ...prev,
        selectedIndices: next,
        toUpload: next.size,
        toSkip: recCount - next.size,
      };
    });
  };

  const handleSelectAll = () => {
    setUploadPreview((prev) => {
      const records = prev.records || [];
      const next = new Set(records.map((_, i) => i));
      return { ...prev, selectedIndices: next, toUpload: next.size, toSkip: 0 };
    });
  };

  const handleDeselectAll = () => {
    setUploadPreview((prev) => ({
      ...prev,
      selectedIndices: new Set(),
      toUpload: 0,
      toSkip: prev.records?.length || 0,
    }));
  };

  const handleSelectNonWarmup = () => {
    setUploadPreview((prev) => {
      const effectiveFilter = (prev.userFilterOverride || '').trim() ? (prev.userFilterOverride || '').trim() : prev.filterString;
      const { toUpload, toSkip, selectedIndices } = computePreviewFromRecords(prev.records || [], effectiveFilter, prev.domainsToSkip || '');
      return { ...prev, selectedIndices, toUpload, toSkip };
    });
  };

  const handleSaveUploadFilters = async () => {
    setSavingFilters(true);
    setFiltersLoadError('');
    try {
      await dataApi.saveUploadFilters({
        warmupFilter: uploadTabFilters.warmupFilter || '',
        domainsToSkip: uploadTabFilters.domainsToSkip || '',
      });
      setFiltersSaved(true);
      setTimeout(() => setFiltersSaved(false), 2000);
      setToast({ open: true, message: 'Filters saved successfully', type: 'success' });
      setTimeout(() => setToast(t => ({ ...t, open: false })), 3000);
    } catch (err) {
      setFiltersLoadError(err.message || 'Failed to save filters');
      setToast({ open: true, message: err.message || 'Failed to save filters', type: 'error' });
      setTimeout(() => setToast(t => ({ ...t, open: false })), 4000);
    } finally {
      setSavingFilters(false);
    }
  };

  const handleGmailSendUpload = async () => {
    if (!gmailSendFile || (!user?._id && !user?.id)) {
      setUploadError({ ...uploadError, gmail: "Please select a file" });
      return;
    }
    setUploadError({ ...uploadError, gmail: "" });
    try {
      const preview = await buildUploadPreview(gmailSendFile, 'gmail');
      const warmup = (uploadTabFilters.warmupFilter || '').trim();
      const domains = uploadTabFilters.domainsToSkip || '';
      preview.userFilterOverride = warmup;
      preview.domainsToSkip = domains;
      const { toUpload, toSkip, skippedRecords, selectedIndices } = computePreviewFromRecords(
        preview.records || [], warmup || preview.filterString, domains
      );
      preview.toUpload = toUpload;
      preview.toSkip = toSkip;
      preview.skippedRecords = skippedRecords;
      preview.selectedIndices = selectedIndices;
      setUploadPreview(preview);
    } catch (err) {
      setUploadError({ ...uploadError, gmail: err.message || "Failed to load preview" });
    }
  };

  const handleApproveAndUpload = async () => {
    const { type, file, records, selectedIndices } = uploadPreview;
    if (!file || !type || (!user?._id && !user?.id)) return;
    const sel = selectedIndices instanceof Set ? selectedIndices : new Set();
    if (sel.size === 0) {
      setUploadError({ ...uploadError, [type === 'gmail' ? 'gmail' : 'mailsuite']: "Select at least one record to upload" });
      return;
    }
    const recs = Array.isArray(records) ? records : [];
    const selectedRecords = recs.filter((_, i) => sel.has(i));
    if (selectedRecords.length === 0) {
      setUploadError({ ...uploadError, [type === 'gmail' ? 'gmail' : 'mailsuite']: "No valid records to upload" });
      return;
    }
    let csv;
    try {
      const columns = recs.length && selectedRecords.length && recs[0] ? Object.keys(recs[0]).filter(k => k !== '_row') : [];
      csv = columns.length ? Papa.unparse(selectedRecords, { columns }) : Papa.unparse(selectedRecords);
    } catch (e) {
      setUploadError({ ...uploadError, [type === 'gmail' ? 'gmail' : 'mailsuite']: "Failed to prepare upload: " + (e?.message || "Unknown error") });
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const uploadFile = new File([blob], file.name || "upload.csv", { type: "text/csv" });
    setUploadPreview({ ...uploadPreview, open: false });
    if (type === 'gmail') {
      setUploadingGmail(true);
      setUploadError({ ...uploadError, gmail: "" });
      setUploadSuccess({ ...uploadSuccess, gmail: false });
      try {
        const sdrId = user._id || user.id;
        await dataApi.uploadGmailSend(sdrId, uploadFile);
        setUploadSuccess({ ...uploadSuccess, gmail: true });
        setGmailSendFile(null);
        setGmailFetchedData(null);
        loadStats();
        setTimeout(() => setUploadSuccess({ ...uploadSuccess, gmail: false }), 3000);
      } catch (err) {
        setUploadError({ ...uploadError, gmail: err.message || "Failed to upload file" });
      } finally {
        setUploadingGmail(false);
      }
    } else if (type === 'mailsuite') {
      setUploadingMailSuite(true);
      setUploadError({ ...uploadError, mailsuite: "" });
      setUploadSuccess({ ...uploadSuccess, mailsuite: false });
      try {
        const sdrId = user._id || user.id;
        await dataApi.uploadMailSuite(sdrId, uploadFile);
        setUploadSuccess({ ...uploadSuccess, mailsuite: true });
        setMailsuiteFile(null);
        loadStats();
        setTimeout(() => setUploadSuccess({ ...uploadSuccess, mailsuite: false }), 3000);
      } catch (err) {
        setUploadError({ ...uploadError, mailsuite: err.message || "Failed to upload file" });
      } finally {
        setUploadingMailSuite(false);
      }
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
      
      // Set the file - user must click "Upload" to see preview and approve
      setGmailSendFile(file);
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
    if (!mailsuiteFile || (!user?._id && !user?.id)) {
      setUploadError({ ...uploadError, mailsuite: "Please select a file" });
      return;
    }
    setUploadError({ ...uploadError, mailsuite: "" });
    try {
      const preview = await buildUploadPreview(mailsuiteFile, 'mailsuite');
      const warmup = (uploadTabFilters.warmupFilter || '').trim();
      const domains = uploadTabFilters.domainsToSkip || '';
      preview.userFilterOverride = warmup;
      preview.domainsToSkip = domains;
      const { toUpload, toSkip, skippedRecords, selectedIndices } = computePreviewFromRecords(
        preview.records || [], warmup || preview.filterString, domains
      );
      preview.toUpload = toUpload;
      preview.toSkip = toSkip;
      preview.skippedRecords = skippedRecords;
      preview.selectedIndices = selectedIndices;
      setUploadPreview(preview);
    } catch (err) {
      setUploadError({ ...uploadError, mailsuite: err.message || "Failed to load preview" });
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
    "harshit.gupta@loopwork.co",
    "anirudh.vashishth@loopwork.co"
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
      {/* Toast notification */}
      {toast.open && (
        <div
          className={`fixed bottom-6 right-6 z-[60] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 transition-all duration-300 ${
            toast.type === 'success'
              ? 'bg-green-600 text-white'
              : 'bg-red-600 text-white'
          }`}
          role="alert"
        >
          {toast.type === 'success' ? (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          ) : (
            <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Upload Preview Modal */}
      {uploadPreview.open && (
        <div className="fixed inset-0 z-50 bg-black/30">
          <div className="absolute inset-0 bg-white overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {uploadPreview.type === 'gmail' ? 'Gmail' : 'MailSuite'} Upload Preview
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                Select or deselect records. Only selected records will be uploaded.
              </p>
            </div>
            <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Total Records</p>
                  <p className="text-lg font-bold text-gray-900">{uploadPreview.total}</p>
                </div>
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">To Upload</p>
                  <p className="text-lg font-bold text-green-700">{uploadPreview.toUpload}</p>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">Excluded</p>
                  <p className="text-lg font-bold text-amber-700">{uploadPreview.toSkip}</p>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-gray-500 mb-2">Filter String</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={uploadPreview.userFilterOverride}
                      onChange={(e) => handleUserFilterChange(e.target.value)}
                      placeholder={uploadPreview.filterString || "Enter string to filter warmup emails (e.g. warmup)"}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {uploadPreview.filterString && !uploadPreview.userFilterOverride
                      ? `Server default: "${uploadPreview.filterString}"`
                      : uploadPreview.userFilterOverride
                        ? `Using: "${uploadPreview.userFilterOverride}"`
                        : "Leave empty or enter a string. Emails whose body contains it will be skipped."}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <p className="text-xs text-gray-500 mb-2">Domains to skip</p>
                  <textarea
                    value={uploadPreview.domainsToSkip || ''}
                    onChange={(e) => handleDomainsToSkipChange(e.target.value)}
                    placeholder={"Enter domains to exclude (one per line or comma-separated)\ne.g. example.com, test.org"}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Records whose email domain matches any of these will be excluded from upload.
                  </p>
                </div>
              </div>
              <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold text-gray-700">
                      Select records to upload ({uploadPreview.toUpload} selected)
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleSelectAll}
                        className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded hover:bg-blue-100"
                      >
                        Select All
                      </button>
                      <button
                        type="button"
                        onClick={handleDeselectAll}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded hover:bg-gray-200"
                      >
                        Deselect All
                      </button>
                      <button
                        type="button"
                        onClick={handleSelectNonWarmup}
                        className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded hover:bg-amber-100"
                      >
                        Select Non-Warmup
                      </button>
                    </div>
                  </div>
                  <div className="border border-gray-200 rounded-lg overflow-hidden max-h-[60vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 sticky top-0">
                        <tr>
                          <th className="px-3 py-2 text-left w-10">
                            <input
                              type="checkbox"
                              checked={(uploadPreview.records?.length || 0) > 0 && (uploadPreview.selectedIndices?.size || 0) === (uploadPreview.records?.length || 0)}
                              onChange={(e) => (e.target.checked ? handleSelectAll() : handleDeselectAll())}
                              className="rounded border-gray-300"
                            />
                          </th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Row</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Recipient</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Email</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-600">Body (snippet)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(uploadPreview.records || []).map((r, i) => {
                          const isSelected = uploadPreview.selectedIndices?.has(i);
                          const body = getEmailBodyFromRecord(r);
                          const snippet = body ? (body.length > 60 ? body.slice(0, 60) + '…' : body) : '-';
                          return (
                            <tr
                              key={i}
                              className={`border-t border-gray-100 ${isSelected ? 'bg-green-50/50 hover:bg-green-50' : 'bg-amber-50/30 hover:bg-amber-50'}`}
                            >
                              <td className="px-3 py-2">
                                <input
                                  type="checkbox"
                                  checked={!!isSelected}
                                  onChange={() => handleToggleRecord(i)}
                                  className="rounded border-gray-300"
                                />
                              </td>
                              <td className="px-3 py-2 text-gray-600">{i + 2}</td>
                              <td className="px-3 py-2 truncate max-w-[100px]" title={r['Recipient Name'] || r['recipient_name'] || r['Recipient'] || r['recipient'] || r['To'] || r['to'] || ''}>
                                {r['Recipient Name'] || r['recipient_name'] || r['Recipient'] || r['recipient'] || r['To'] || r['to'] || '-'}
                              </td>
                              <td className="px-3 py-2 truncate max-w-[150px]" title={getDisplayEmail(r)}>
                                {getDisplayEmail(r) || '-'}
                              </td>
                              <td className="px-3 py-2 text-gray-600 whitespace-nowrap">
                                {r['Date'] || r['sent_date'] || r['Sent'] || r['Sent Date'] || '-'}
                              </td>
                              <td className="px-3 py-2 text-gray-500 truncate max-w-[200px]" title={body || ''}>
                                {snippet}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setUploadPreview({ ...uploadPreview, open: false })}
                className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium transition"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveAndUpload}
                disabled={(uploadPreview.selectedIndices?.size || 0) === 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve & Upload {uploadPreview.toUpload > 0 && `(${uploadPreview.toUpload})`}
              </button>
            </div>
          </div>
        </div>
      )}

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
                        referrerPolicy="no-referrer"
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
                  
                  {/* Reminder: Exclude warmup & filter by domain */}
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <span>⚠️</span>
                      Remember to exclude warmup emails and filter by domain before uploading for accurate analytics.
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Set your filters below — they will be applied in the upload preview.
                    </p>
                  </div>

                  {/* Pre-upload filters on tab */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Pre-upload filters</p>
                      <button
                        type="button"
                        onClick={handleSaveUploadFilters}
                        disabled={savingFilters}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
                      >
                        {savingFilters ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Saving...
                          </>
                        ) : (
                          filtersSaved ? "✓ Saved" : "Save"
                        )}
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Warmup filter (e.g. warmup, instantly)</label>
                      <input
                        type="text"
                        value={uploadTabFilters.warmupFilter || ''}
                        onChange={(e) => setUploadTabFilters(prev => ({ ...prev, warmupFilter: e.target.value }))}
                        placeholder="Enter string to exclude warmup emails from body"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Domains to exclude (one per line or comma-separated)</label>
                      <textarea
                        value={uploadTabFilters.domainsToSkip || ''}
                        onChange={(e) => setUploadTabFilters(prev => ({ ...prev, domainsToSkip: e.target.value }))}
                        placeholder="e.g. warmup.com, test.org"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-y"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Saved filters apply to both Gmail and MailSuite uploads. Stored in database.</p>
                    {filtersLoadError && (
                      <p className="text-xs text-red-600">{filtersLoadError}</p>
                    )}
                  </div>

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
                  
                  {/* Reminder: Exclude warmup & filter by domain */}
                  <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm font-medium text-amber-800 flex items-center gap-2">
                      <span>⚠️</span>
                      Remember to exclude warmup emails and filter by domain before uploading for accurate analytics.
                    </p>
                    <p className="text-xs text-amber-700 mt-1">
                      Set your filters below — they will be applied in the upload preview.
                    </p>
                  </div>

                  {/* Pre-upload filters on tab */}
                  <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-gray-700">Pre-upload filters</p>
                      <button
                        type="button"
                        onClick={handleSaveUploadFilters}
                        disabled={savingFilters}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[80px] justify-center"
                      >
                        {savingFilters ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                            Saving...
                          </>
                        ) : (
                          filtersSaved ? "✓ Saved" : "Save"
                        )}
                      </button>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Warmup filter (e.g. warmup, instantly)</label>
                      <input
                        type="text"
                        value={uploadTabFilters.warmupFilter || ''}
                        onChange={(e) => setUploadTabFilters(prev => ({ ...prev, warmupFilter: e.target.value }))}
                        placeholder="Enter string to exclude warmup emails from body"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Domains to exclude (one per line or comma-separated)</label>
                      <textarea
                        value={uploadTabFilters.domainsToSkip || ''}
                        onChange={(e) => setUploadTabFilters(prev => ({ ...prev, domainsToSkip: e.target.value }))}
                        placeholder="e.g. warmup.com, test.org"
                        rows={2}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-y"
                      />
                    </div>
                    <p className="text-xs text-gray-500">Saved filters apply to both Gmail and MailSuite uploads. Stored in database.</p>
                    {filtersLoadError && (
                      <p className="text-xs text-red-600">{filtersLoadError}</p>
                    )}
                  </div>

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
