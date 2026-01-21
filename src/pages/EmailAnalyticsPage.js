import React, { useMemo, useState } from "react";
import Papa from "papaparse";
import { useEffect } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Fade,
  FormControl,
  Grid,
  Grow,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Slide,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Zoom,
} from "@mui/material";
import {
  TrendingUp,
  Visibility,
  TouchApp,
  Business,
  Email,
  Close as CloseIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  VerifiedUser as VerifiedUserIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
  InfoOutlined,
  Leaderboard,
  AccountCircle,
  CloudDownload,
} from "@mui/icons-material";
import { startOfWeek, startOfMonth, format, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval } from "date-fns";
import Plot from "react-plotly.js";
import UploadCard from "../components/UploadCard";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import SdrCard from "../components/SdrCard";
import GmailIntegration from "../components/GmailIntegration";
import MailSuiteIntegration from "../components/MailSuiteIntegration";
import { processMultiSdrPipeline } from "../emailProcessor";
import { useDataContext } from "../context/DataContext";
import {
  validateContactsHeaders,
  validateOpenHeaders,
  validateSendHeaders,
} from "../utils/csvValidation";
import {
  runDataValidation,
  formatValidationReport,
} from "../utils/dataChecker";
import { dataApi } from "../utils/api";

const metricOptions = [
  { value: "Views", label: "Views" },
  { value: "Clicks", label: "Clicks" },
  { value: "total_sends", label: "Total Sends" },
];

const templateMap = {
  send: "Recipient Name,Date,Recipient Email,Domain\nJane Doe,03/07/2025 09:14:21,jane@example.com,example.com",
  open: "Recipient,Sent,Opens,Clicks,Last Opened\nJane Doe,03/07/2025 09:14:25,3,1,03/07/2025 09:20:10",
  contacts:
    "Email,Company,Account Owner,Title,Company URL ID\njane@example.com,Example Inc,Alex SDR,VP,URL-123",
};

const SECTION_NAV = [
  { id: "section-overview", label: "Overview" },
  { id: "section-filters", label: "Filters" },
  { id: "section-kpis", label: "KPIs" },
  { id: "section-leaderboard", label: "SDR Leaderboard" },
  { id: "section-trends", label: "Engagement Trend" },
  { id: "section-companies", label: "Company Engagement" },
  { id: "section-prospects", label: "Prospects" },
  { id: "detailed-records", label: "Detailed Records" },
];

const createSdrEntry = () => ({
  id: Math.random().toString(36).slice(2),
  name: "",
  sendFile: null,
  openFile: null,
});

function EmailAnalyticsPage() {
  const { emailData, setEmailData } = useDataContext();

  const [mode, setMode] = useState("upload");
  const [sdrs, setSdrs] = useState([createSdrEntry()]);
  const [contactsFile, setContactsFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [toolsDialogOpen, setToolsDialogOpen] = useState(false);
  const [pipelineReportOpen, setPipelineReportOpen] = useState(false);
  const [matchingMode, setMatchingMode] = useState('composite'); // 'email_only', 'timestamp', 'hybrid', 'relaxed', 'name_timestamp', 'composite'
  const [filters, setFilters] = useState({
    search: "",
    metric: "Views",
    timePeriod: "day", // 'day', 'week', 'month'
    dateRange: null, // { start: Date, end: Date }
    sdrFilter: "all", // 'all' or specific SDR name
  });
  const [tableTab, setTableTab] = useState(0);
  const [tablePage, setTablePage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [companyPage, setCompanyPage] = useState(0);
  const [companiesPerPage, setCompaniesPerPage] = useState(10);
  const [prospectPage, setProspectPage] = useState(0);
  const [prospectsPerPage, setProspectsPerPage] = useState(10);
  const [validationReport, setValidationReport] = useState(null);
  const [showValidation, setShowValidation] = useState(false);
  const [companyDetailsOpen, setCompanyDetailsOpen] = useState(false);
  const [selectedCompanyKey, setSelectedCompanyKey] = useState(null);
  const [selectedCompanyLabel, setSelectedCompanyLabel] = useState("");
  const [companyMatrixOpen, setCompanyMatrixOpen] = useState(false);
  const [prospectsMatrixOpen, setProspectsMatrixOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("section-overview");
  const [kpiInfoOpen, setKpiInfoOpen] = useState({ sendOpen: false, trackingData: false, contactMatch: false });
  const [databaseSdrs, setDatabaseSdrs] = useState([]);
  const [loadingDatabase, setLoadingDatabase] = useState(false);

  const hasResults = Boolean(emailData.stats);
  const readySdrs = sdrs.every((sdr) => sdr.sendFile && sdr.openFile);
  const canProcess =
    mode === "upload" && !!contactsFile && readySdrs && !loading;

  // Fetch SDRs and email analytics from database on mount
  useEffect(() => {
    const loadDatabaseData = async () => {
      setLoadingDatabase(true);
      try {
        // Fetch all SDRs with their data counts
        const allSdrs = await dataApi.getAllSdrs();
        setDatabaseSdrs(allSdrs);

        // Fetch all email analytics data
        const analytics = await dataApi.getAllEmailAnalytics();
        
        // Convert database data to format expected by emailProcessor
        if (analytics.gmail_send && analytics.mailsuite && analytics.contacts) {
          // Convert Gmail send data to CSV format
          const gmailSendCsv = Papa.unparse(
            analytics.gmail_send.map(record => ({
              "Recipient Name": record.recipient_name || "",
              "Date": record.sent_date || "",
              "Recipient Email": record.recipient_email || "",
              "Domain": record.domain || "",
              "Subject": record.subject || "",
              "SDR_Name": record.sdr_name || ""
            }))
          );

          // Convert MailSuite data to CSV format
          const mailsuiteCsv = Papa.unparse(
            analytics.mailsuite.map(record => ({
              "Recipient": record.recipient || "",
              "Sent": record.sent_date || "",
              "Opens": record.opens || 0,
              "Clicks": record.clicks || 0,
              "Last Opened": record.last_opened || "",
              "SDR_Name": record.sdr_name || ""
            }))
          );

          // Convert contacts to CSV format
          const contactsCsv = Papa.unparse(
            analytics.contacts.map(contact => ({
              "Email": contact.email || "",
              "Company Name": contact.company_name || "",
              "First Name": contact.first_name || "",
              "Last Name": contact.last_name || "",
              "Title": contact.title || "",
              "Company URL": contact.company_url || "",
              "Sales Status": contact.sales_status || "",
              "Account Source": contact.account_source || "",
              "Sub-Source": contact.sub_source || ""
            }))
          );

          // Group Gmail send and MailSuite data by SDR
          const sdrConfigs = allSdrs.map(sdr => {
            const sdrGmailData = analytics.gmail_send.filter(r => 
              (r.sdr_id?._id || r.sdr_id) === (sdr._id || sdr.id)
            );
            const sdrMailsuiteData = analytics.mailsuite.filter(r => 
              (r.sdr_id?._id || r.sdr_id) === (sdr._id || sdr.id)
            );

            const sdrGmailCsv = Papa.unparse(
              sdrGmailData.map(record => ({
                "Recipient Name": record.recipient_name || "",
                "Date": record.sent_date || "",
                "Recipient Email": record.recipient_email || "",
                "Domain": record.domain || "",
                "Subject": record.subject || ""
              }))
            );

            const sdrMailsuiteCsv = Papa.unparse(
              sdrMailsuiteData.map(record => ({
                "Recipient": record.recipient || "",
                "Sent": record.sent_date || "",
                "Opens": record.opens || 0,
                "Clicks": record.clicks || 0,
                "Last Opened": record.last_opened || ""
              }))
            );

            return {
              name: sdr.name || sdr.email || "Unknown",
              sendCsv: sdrGmailData.length > 0 ? sdrGmailCsv : null,
              openCsv: sdrMailsuiteData.length > 0 ? sdrMailsuiteCsv : null
            };
          }).filter(config => config.sendCsv && config.openCsv);

          // Process the data if we have SDRs with both send and open data
          if (sdrConfigs.length > 0 && contactsCsv) {
            try {
              const result = await processMultiSdrPipeline(
                sdrConfigs,
                contactsCsv,
                { matchingMode: matchingMode }
              );
              setEmailData({
                successful: result.successful || [],
                failed: result.failed || [],
                stats: result.stats || null,
                sdrStats: result.sdrStats || []
              });
            } catch (processError) {
              console.error("Error processing database data:", processError);
            }
          }
        }
      } catch (err) {
        console.error("Error loading database data:", err);
        // Don't show error to user - they can still use upload mode
      } finally {
        setLoadingDatabase(false);
      }
    };

    loadDatabaseData();
  }, [matchingMode]); // Re-fetch when matching mode changes

  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTION_NAV.map(({ id }) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const top = el.offsetTop;
        return { id, top };
      }).filter(Boolean);

      if (!sections.length) return;

      // Current scroll position plus small offset so change happens
      // when the heading passes under the navbar area.
      const current = window.scrollY + 140;

      // Pick the last section whose top is above the current position.
      let bestId = sections[0].id;
      sections.forEach((sec) => {
        if (sec.top <= current) {
          bestId = sec.id;
        }
      });

      setActiveSection((prev) => {
        if (prev === bestId) return prev;
        window.dispatchEvent(
          new CustomEvent("email-section-change", {
            detail: { id: bestId },
          })
        );
        return bestId;
      });
    };

    // Run once on mount (deferred to avoid setState during render)
    const timeoutId = setTimeout(() => {
      handleScroll();
    }, 0);

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Handle Gmail data fetched callback
  const handleGmailDataFetched = (file) => {
    // Auto-populate the first SDR's send file
    if (sdrs.length > 0) {
      setSdrs((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], sendFile: file };
        return updated;
      });
    }
  };

  // Handle MailSuite data fetched callback
  const handleMailSuiteDataFetched = (file) => {
    // Auto-populate the first SDR's opens file
    if (sdrs.length > 0) {
      setSdrs((prev) => {
        const updated = [...prev];
        updated[0] = { ...updated[0], openFile: file };
        return updated;
      });
    }
  };


  const filteredForAnalysis = useMemo(() => {
    let data = emailData.successful;
    
    // Apply SDR filter
    if (filters.sdrFilter !== "all") {
      data = data.filter((row) => {
        const sdr = row.SDR_Name || row["Account Owner"] || "Unassigned";
        return sdr === filters.sdrFilter;
      });
    }
    
    // Apply date range filter
    if (filters.dateRange?.start && filters.dateRange?.end) {
      data = data.filter((row) => {
        const raw = row.sent_date_parsed instanceof Date
          ? row.sent_date_parsed
          : row.sent_date ? new Date(row.sent_date) : null;
        if (!raw || isNaN(raw.getTime())) return false;
        return isWithinInterval(raw, {
          start: filters.dateRange.start,
          end: filters.dateRange.end,
        });
      });
    }
    
    return data;
  }, [emailData.successful, filters.sdrFilter, filters.dateRange]);

  // Reconstruct filtered send-open dataset (all sends, including those without contacts)
  const filteredSendOpen = useMemo(() => {
    const successful = emailData.successful || [];
    const contactFailures =
      (emailData.failed || []).filter(
        (row) => row.failure_reason === "Send email not found in contacts"
      );

    let data = [...successful, ...contactFailures];

    // Apply SDR filter
    if (filters.sdrFilter !== "all") {
      data = data.filter((row) => {
        const sdr = row.SDR_Name || row["Account Owner"] || "Unassigned";
        return sdr === filters.sdrFilter;
      });
    }

    // Apply date range filter
    if (filters.dateRange?.start && filters.dateRange?.end) {
      data = data.filter((row) => {
        const raw =
          row.sent_date_parsed instanceof Date
            ? row.sent_date_parsed
            : row.sent_date
            ? new Date(row.sent_date)
            : null;
        if (!raw || isNaN(raw.getTime())) return false;
        return isWithinInterval(raw, {
          start: filters.dateRange.start,
          end: filters.dateRange.end,
        });
      });
    }

    return data;
  }, [emailData.successful, emailData.failed, filters.sdrFilter, filters.dateRange]);

  // Count of send records after excluding @loopwork.co (from stats)
  const sendRecordsAfterLoopworkFilter = emailData.stats?.total_send_records_excluding_loopwork || 0;

  // Helper to derive normalized company key from a row (must mirror buildCompanyEngagement logic)
  function getCompanyNormalizedKey(row) {
    let companyKey =
      row.Company ||
      row["Company Name"] ||
      row["Company / Account"] ||
      row.company ||
      row["Account Name"] ||
      null;

    // Try to derive from Company URL if missing/unknown
    if (!companyKey || companyKey === "Unknown" || companyKey === "") {
      const companyUrl =
        row["Company URL"] || row.CompanyURL || row["company_url"] || null;
      if (companyUrl) {
        let domain = String(companyUrl).trim();
        domain = domain.replace(/^https?:\/\//, "");
        domain = domain.replace(/^www\./, "");
        domain = domain.split("/")[0];
        domain = domain.split(":")[0];
        if (domain) {
          companyKey = domain;
        }
      }
    }

    // Fallback to email domain
    if (!companyKey || companyKey === "Unknown" || companyKey === "") {
      const email = row["Recipient Email"] || row.email || row.Email || null;
      if (email) {
        const emailDomain = String(email).split("@")[1];
        if (emailDomain) {
          companyKey = emailDomain;
        }
      }
    }

    // Final fallback
    if (!companyKey || companyKey === "") {
      companyKey = "Unknown";
    }

    return companyKey.toLowerCase().trim();
  }

  // Helper to format sent date for detail rows
  function getSentDateDisplay(row) {
    const rawDate =
      row.sent_date_parsed instanceof Date
        ? row.sent_date_parsed
        : row.sent_date
        ? new Date(row.sent_date)
        : null;

    if (!rawDate || Number.isNaN(rawDate.getTime())) {
      return "";
    }

    return format(rawDate, "dd/MM/yyyy HH:mm");
  }

  // Derive metrics from filtered data - Following exact KPI specifications
  const derivedMetrics = useMemo(() => {
    if (!hasResults) {
      return {
        totalSends: 0,
        totalViews: 0,
        totalClicks: 0,
        totalProspects: 0,
        openedProspects: 0,
        prospectOpenedRate: 0,
        openRate: 0,
        trackedOpenRate: 0,
        trackingCoverage: 0,
        emailsWithTracking: 0,
        contactMatch: 0,
        accountsOwned: 0,
        highEngagement: 0,
      };
    }
    
    // final_data = Send + Open + Contacts joined (filtered)
    const final_data = filteredForAnalysis;
    // send_open_df = all filtered send records (with Views/Clicks, may be null)
    const send_open_df = filteredSendOpen;
    
    // Stage 1: Total Sends (from send data - filtered)
    const totalSends = send_open_df.length;
    
    // Stage 1: Total Prospect Count - unique Recipient Emails
    // Normalize emails (lowercase, trim) to match SDR leaderboard calculation
    const totalProspects = new Set(
      send_open_df
        .map((r) => {
          const email = r["Recipient Email"] || r.recipient_email || r.Email || r.email;
          return email ? String(email).toLowerCase().trim() : null;
        })
        .filter(Boolean)
    ).size;
    
    // Stage 2: Records with tracking data (non-null Views, including 0)
    // This matches Python's logic: counts emails with tracking data, not just opened emails
    const recordsWithOpens = send_open_df.filter((r) => {
      const views = r.Views;
      return views != null && views !== '';
    });
    
    // Stage 1: Open Rate = (records with non-NULL Views / total_sends) * 100
    const openRate = totalSends > 0
      ? (recordsWithOpens.length / totalSends) * 100
      : 0;
    
    // NEW: Count emails with tracking data (Views field exists, not null/undefined/empty)
    const emailsWithTracking = send_open_df.filter((r) => {
      const views = r.Views;
      return views != null && views !== ''; // Using != to check both null and undefined
    }).length;
    
    // NEW: Tracked Open Rate - only considers emails with tracking data
    const trackedOpenRate = emailsWithTracking > 0
      ? (recordsWithOpens.length / emailsWithTracking) * 100
      : 0;
    
    // NEW: Tracking Coverage - % of emails that have tracking data
    const trackingCoverage = totalSends > 0
      ? (emailsWithTracking / totalSends) * 100
      : 0;
    
    // Stage 2: Opened Prospect Count - unique prospects with non-null Views
    // Normalize emails (lowercase, trim) to match SDR leaderboard calculation
    const openedProspects = new Set(
      recordsWithOpens
        .map((r) => {
          const email = r["Recipient Email"] || r.recipient_email || r.Email || r.email;
          return email ? String(email).toLowerCase().trim() : null;
        })
        .filter(Boolean)
    ).size;
    
    // Stage 2: Prospect Opened % = (opened_prospect_count / total_prospect_count) * 100
    const prospectOpenedRate = totalProspects > 0
      ? (openedProspects / totalProspects) * 100
      : 0;
    
    // Stage 2: Total Views (sum from send-open data)
    const totalViews = send_open_df.reduce(
      (sum, row) => sum + (Number(row.Views) || 0),
      0
    );
    
    // Total Clicks
    const totalClicks = send_open_df.reduce(
      (sum, row) => sum + (Number(row.Clicks) || 0),
      0
    );
    
    // Stage 3: Accounts Owned - unique Company URL IDs
    const accountsOwned = new Set(
      final_data
        .map(r => r["Company URL ID"] || r["Company URL"])
        .filter(Boolean)
    ).size;
    
    // Stage 3: Contact Match Rate = (final_data.length / send_open_df.length) * 100
    const contactMatch =
      send_open_df.length > 0
        ? (final_data.length / send_open_df.length) * 100
        : 0;
    
    // Stage 3: High Engagement Accounts
    // Group by Company URL and filter where total_views > 2 * total_emails
    const companyGroups = final_data.reduce((acc, row) => {
      const companyUrl = row["Company URL"] || row["Company URL ID"] || "Unknown";
      if (!acc[companyUrl]) {
        acc[companyUrl] = [];
      }
      acc[companyUrl].push(row);
      return acc;
    }, {});
    
    const highEngagementCompanies = Object.entries(companyGroups).filter(([_, records]) => {
      const totalEmails = records.length;
      const totalViews = records.reduce((sum, r) => sum + (Number(r.Views) || 0), 0);
      return totalViews > (2 * totalEmails);
    });
    
    const highEngagement = highEngagementCompanies.length;
    
    return {
      totalSends,
      totalViews,
      totalClicks,
      totalProspects,
      openedProspects,
      prospectOpenedRate,
      openRate,
      trackedOpenRate,      // NEW: Realistic open rate (tracked emails only)
      trackingCoverage,     // NEW: % of emails with tracking data
      emailsWithTracking,   // NEW: Count of emails with tracking
      contactMatch,
      accountsOwned,
      highEngagement,
    };
  }, [hasResults, filteredForAnalysis, filteredSendOpen]);

  // Detail rows for the selected high engagement company (for "Know more" dialog)
  const companyDetailRows = useMemo(() => {
    if (!selectedCompanyKey) return [];

    return filteredForAnalysis
      .filter((row) => getCompanyNormalizedKey(row) === selectedCompanyKey)
      .map((row, idx) => ({
        id:
          row["Recipient Email"] ||
          row.Email ||
          row.email ||
          `row-${idx}`,
        sent_date: getSentDateDisplay(row),
        recipient_email:
          row["Recipient Email"] || row.Email || row.email || "",
        views:
          row.Views != null && row.Views !== ""
            ? Number(row.Views)
            : 0,
        clicks:
          row.Clicks != null && row.Clicks !== ""
            ? Number(row.Clicks)
            : 0,
      }));
  }, [selectedCompanyKey, filteredForAnalysis]);

  // Company & prospect engagement summaries (for sections + matrix)
  const companyEngagement = useMemo(
    () => buildCompanyEngagement(filteredForAnalysis),
    [filteredForAnalysis]
  );

  const highEngagementProspects = useMemo(
    () => buildHighEngagementProspects(filteredForAnalysis),
    [filteredForAnalysis]
  );

  // Rows for full High Engagement Companies matrix (table view)
  const companyMatrixRows = useMemo(() => {
    if (!companyEngagement || !companyEngagement.highEngagementCompanies) {
      return [];
    }

    return companyEngagement.highEngagementCompanies.map((company, idx) => ({
      id: company.company || `company-${idx}`,
      company: company.company,
      emails: company.emails,
      views:
        company.views != null && company.views !== ""
          ? Number(company.views)
          : 0,
      clicks:
        company.clicks != null && company.clicks !== ""
          ? Number(company.clicks)
          : 0,
      engagementRate:
        company.engagementRate != null && company.engagementRate !== ""
          ? Number(company.engagementRate).toFixed(1)
          : "0.0",
    }));
  }, [companyEngagement]);

  const handleExportHighEngagementCompanies = () => {
    if (!companyMatrixRows.length) {
      alert("No high engagement companies to export.");
      return;
    }

    const csv = Papa.unparse(companyMatrixRows);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "high-engagement-companies.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  // Rows for full High Engagement Prospects matrix (table view)
  const prospectsMatrixRows = useMemo(() => {
    if (
      !highEngagementProspects ||
      !highEngagementProspects.highEngagementProspects
    ) {
      return [];
    }

    return highEngagementProspects.highEngagementProspects.map(
      (prospect, idx) => ({
        id: prospect.prospectKey || `prospect-${idx}`,
        prospectName: prospect.prospectName,
        prospectEmail: prospect.prospectEmail,
        company: prospect.company,
        emails: prospect.emails,
        views:
          prospect.views != null && prospect.views !== ""
            ? Number(prospect.views)
            : 0,
        clicks:
          prospect.clicks != null && prospect.clicks !== ""
            ? Number(prospect.clicks)
            : 0,
        engagementRate:
          prospect.engagementRate != null && prospect.engagementRate !== ""
            ? Number(prospect.engagementRate).toFixed(1)
            : "0.0",
      })
    );
  }, [highEngagementProspects]);

  const handleExportHighEngagementProspects = () => {
    if (!prospectsMatrixRows.length) {
      alert("No high engagement prospects to export.");
      return;
    }

    const csv = Papa.unparse(prospectsMatrixRows);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "high-engagement-prospects.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const filteredSuccess = useMemo(() => {
    let data = filteredForAnalysis;
    const term = filters.search.toLowerCase();
    if (term) {
      data = data.filter((row) => {
        const haystack = [
          row.recipient_name,
          row["Recipient Email"],
          row.Company,
          row["Account Owner"],
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(term);
      });
    }
    return data;
  }, [filteredForAnalysis, filters.search]);

  // const filteredFailed = useMemo(() => {
  //   const term = filters.search.toLowerCase();
  //   if (!term) return emailData.failed;
  //   return emailData.failed.filter((row) => {
  //     const haystack = [
  //       row.recipient_name,
  //       row["Recipient Email"],
  //       row.failure_reason,
  //     ]
  //       .filter(Boolean)
  //       .join(" ")
  //       .toLowerCase();
  //     return haystack.includes(term);
  //   });
  // }, [emailData.failed, filters.search]);

  // useEffect(() => {
  //   console.log("Filtered failed emails (UI):", filteredFailed);
  
  //   if (!filteredFailed || filteredFailed.length === 0) return;
  
  //   // ❌ Exclude @loopwork.co ONLY for download
  //   const exportData = filteredFailed.filter((row) => {
  //     const email = row["Recipient Email"]?.toLowerCase();
  //     return !(email && email.endsWith("@loopwork.co"));
  //   });
  
  //   if (exportData.length === 0) return;
  
  //   const csv = Papa.unparse(exportData);
  
  //   const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  //   const url = URL.createObjectURL(blob);
  
  //   const link = document.createElement("a");
  //   link.href = url;
  //   link.download = "failed-emails.csv";
  //   link.click();
  
  //   URL.revokeObjectURL(url);
  // }, [filteredFailed]);
  
  const filteredFailed = useMemo(() => {
    const term = filters.search.toLowerCase();
  
    return emailData.failed.filter((row) => {
      const email = row["Recipient Email"]?.toLowerCase() || "";
  
      // ❌ exclude @loopwork.co emails
      if (email.endsWith("@loopwork.co")) {
        return false;
      }
  
      // If no search term, keep all non-loopwork emails
      if (!term) return true;
  
      const haystack = [
        row.recipient_name,
        email,
        row.failure_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
  
      return haystack.includes(term);
    });
  }, [emailData.failed, filters.search]);
  

  const handleDownloadSuccessfulContacts = () => {
    if (!filteredSuccess || filteredSuccess.length === 0) {
      alert("No successful contacts to download.");
      return;
    }

    const csv = Papa.unparse(filteredSuccess);

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "successful-emails.csv";
    link.click();

    URL.revokeObjectURL(url);
  };

  const handleDownloadFailedContacts = () => {
    if (!filteredFailed || filteredFailed.length === 0) return;
  
    // ❌ Exclude @loopwork.co ONLY for download
    const exportData = filteredFailed.filter((row) => {
      const email = row["Recipient Email"]?.toLowerCase();
      return !(email && email.endsWith("@loopwork.co"));
    });
  
    if (exportData.length === 0) {
      alert("No failed contacts to download after filtering.");
      return;
    }
  
    const csv = Papa.unparse(exportData);
  
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
  
    const link = document.createElement("a");
    link.href = url;
    link.download = "failed-emails.csv";
    link.click();
  
    URL.revokeObjectURL(url);
  };

  const trendData = useMemo(
    () =>
      buildTrend(
        filteredForAnalysis,
        filters.metric,
        filters.timePeriod,
        filters.dateRange
      ),
    [filteredForAnalysis, filters.metric, filters.timePeriod, filters.dateRange]
  );

  const sdrMatrix = useMemo(() => {
    // Build SDR matrix with sends/views/clicks from filteredSendOpen (all records)
    const matrix = buildSdrMatrix(filteredSendOpen);
    
    // Calculate High Engagement using filteredForAnalysis (only records with contacts/Company URL)
    // This matches the main dashboard calculation which uses filteredForAnalysis
    const highEngagementBySdr = buildHighEngagementBySdr(filteredForAnalysis);
    
    // Merge High Engagement counts into the matrix
    return matrix.map(sdr => {
      const highEngagement = highEngagementBySdr.get(sdr.sdr) || 0;
      // High Engagement Rate = (High Engagement Companies / Total Prospects) * 100
      const highEngagementRate = sdr.totalProspects > 0 
        ? (highEngagement / sdr.totalProspects) * 100 
        : 0;
      
      return {
        ...sdr,
        highEngagement,
        highEngagementRate,
      };
    });
  }, [filteredSendOpen, filteredForAnalysis]);

  const handleProcess = async () => {
    if (!canProcess) return;
    setLoading(true);
    setError("");
    try {
      const sdrPayload = [];

      for (let i = 0; i < sdrs.length; i += 1) {
        const sdr = sdrs[i];
        const sendText = await sdr.sendFile.text();
        const openText = await sdr.openFile.text();

        validateSendHeaders(sendText);
        validateOpenHeaders(openText);

        sdrPayload.push({
          name: sdr.name || `SDR ${i + 1}`,
          sendCsv: sendText,
          openCsv: openText,
        });
      }

      const contactsText = await contactsFile.text();

      validateContactsHeaders(contactsText);

      const result = await processMultiSdrPipeline(sdrPayload, contactsText, { matchingMode });
      const processedData = {
        successful: result.successful,
        failed: result.failed,
        stats: result.stats,
        sdrStats: result.sdrStats || [],
        matchingMode: result.matchingMode || matchingMode,
      };
      setEmailData(processedData);

      // Run data validation
      try {
        const validation = await runDataValidation(processedData, sdrPayload);
        setValidationReport(validation);
        
        // Log validation results
        if (!validation.overallPassed) {
          console.warn("Data validation failed:", formatValidationReport(validation));
        } else {
          console.log("Data validation passed:", formatValidationReport(validation));
        }
      } catch (validationError) {
        console.warn("Validation check failed:", validationError);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError(e.message || "Failed to process email files");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = async () => {
    setLoading(true);
    setError("");
    try {
      // Load demo CSVs from public folder
      const [sendRes, openRes, contactsRes] = await Promise.all([
        fetch("/harshit.gupta_send.csv"),
        fetch("/harshit.gupta_open-1.csv"),
        fetch("/contacts.csv"),
      ]);

      if (!sendRes.ok || !openRes.ok || !contactsRes.ok) {
        throw new Error("Failed to load demo CSV files from public folder");
      }

      const [sendCsv, openCsv, contactsCsv] = await Promise.all([
        sendRes.text(),
        openRes.text(),
        contactsRes.text(),
      ]);

      // Validate headers to match upload behaviour
      validateSendHeaders(sendCsv);
      validateOpenHeaders(openCsv);
      validateContactsHeaders(contactsCsv);

      // Build single-SDR config for demo
      const sdrPayload = [
        {
          name: "Harshit Gupta",
          sendCsv,
          openCsv,
        },
      ];

      const result = await processMultiSdrPipeline(sdrPayload, contactsCsv, { matchingMode });
      const processedData = {
        successful: result.successful,
        failed: result.failed,
        stats: result.stats,
        sdrStats: result.sdrStats || [],
        matchingMode: result.matchingMode || matchingMode,
      };
      setEmailData(processedData);
      setMode("demo");

      // Run data validation on demo as well
      try {
        const validation = await runDataValidation(processedData, sdrPayload);
        setValidationReport(validation);

        if (!validation.overallPassed) {
          console.warn(
            "Data validation (demo) failed:",
            formatValidationReport(validation)
          );
        } else {
          console.log(
            "Data validation (demo) passed:",
            formatValidationReport(validation)
          );
        }
      } catch (validationError) {
        console.warn("Validation check (demo) failed:", validationError);
      }
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError(e.message || "Failed to load demo data");
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadTemplate = (type) => {
    const content = templateMap[type];
    if (!content) return;
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${type}_template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8fafc",
        backgroundImage: "radial-gradient(circle at 20% 50%, rgba(59, 130, 246, 0.03) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(139, 92, 246, 0.03) 0%, transparent 50%)",
      }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <div
            id="section-overview"
          className="bg-white rounded-lg shadow-sm border border-gray-100 p-4 mb-6 relative overflow-hidden"
        >
          {/* Decorative elements */}
          <div className="absolute -top-8 -right-8 w-24 h-24 rounded-full bg-blue-50 opacity-40"></div>
          <div className="absolute -bottom-8 -left-8 w-20 h-20 rounded-full bg-blue-50 opacity-20"></div>
          
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="max-w-full md:max-w-lg">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                  Email Analytics
              </p>
              <h1 className="text-xl md:text-2xl font-bold text-gray-900 whitespace-nowrap">
                  📊 Email Analytics Dashboard
              </h1>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                {/* Matching Mode Selector */}
              <div className="relative">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                    Matching Algorithm
                </label>
                <select
                    value={matchingMode}
                    onChange={(e) => setMatchingMode(e.target.value)}
                  className="w-full sm:w-[280px] px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300 appearance-none bg-[url('data:image/svg+xml;charset=UTF-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%3E%3Cpath%20fill%3D%22%23666%22%20d%3D%22M6%209L1%204h10z%22%2F%3E%3C%2Fsvg%3E')] bg-no-repeat bg-right-3 bg-[length:12px] pr-8"
                  >
                  <option value="email_only">
                      📧 Email Only (Fast, Highest Match Rate)
                  </option>
                  <option value="timestamp">
                      ⏱️ Email + Timestamp (0-60s, Most Precise)
                  </option>
                  <option value="hybrid">
                      🔄 Hybrid (Timestamp First, Then Email)
                  </option>
                  <option value="relaxed">
                      🤝 Relaxed (Timestamp → ±5m nearest → Email Fallback)
                  </option>
                  <option value="name_timestamp">
                      🧭 Name + Timestamp (0-60s, for name-only opens)
                  </option>
                  <option value="composite">
                      🚀 Composite (Email→Name+Subject→Subject→Name, ~85% coverage)
                  </option>
                </select>
              </div>

              <button
                  onClick={() => setModalOpen(true)}
                className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm whitespace-nowrap flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                  Upload Data
              </button>

              <button
                  onClick={() => setToolsDialogOpen(true)}
                className="px-4 py-2 border border-blue-600 text-blue-600 hover:border-blue-700 hover:text-blue-700 hover:bg-blue-50 font-semibold rounded-lg transition-all duration-200 text-sm whitespace-nowrap flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                  Tools
              </button>
            </div>
          </div>
        </div>

        {/* SDRs from Database */}
        {databaseSdrs.length > 0 && (
          <div id="section-sdrs" className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center">
                  <AccountCircle className="text-gray-600" style={{ fontSize: 20 }} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">SDRs in Database</h2>
                  <p className="text-xs text-gray-500">All SDRs with their email analytics data counts</p>
                </div>
              </div>
              <span className="px-3 py-1 bg-gray-900 text-white font-semibold rounded-lg text-sm">
                {databaseSdrs.length} SDR{databaseSdrs.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* SDR Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {databaseSdrs.map((sdr) => (
                <div
                  key={sdr._id || sdr.id}
                  className="bg-white border border-gray-200 rounded-lg p-3 transition-all duration-200 hover:shadow-md hover:border-gray-300"
                >
                  <div className="space-y-2">
                    {/* SDR Profile Picture, Name and Email */}
                    <div className="flex items-center gap-2">
                      {sdr.picture ? (
                        <img
                          src={sdr.picture}
                          alt={sdr.name || sdr.email || "SDR"}
                          className="w-8 h-8 rounded-full object-cover border border-gray-200"
                          onError={(e) => {
                            e.target.onerror = null;
                            e.target.src = '';
                            e.target.style.display = 'none';
                            const fallback = e.target.parentElement.querySelector('.avatar-fallback');
                            if (fallback) fallback.style.display = 'flex';
                          }}
                        />
                      ) : null}
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full bg-gray-100 border border-gray-200 avatar-fallback ${sdr.picture ? 'hidden' : 'flex'}`}>
                        <span className="text-gray-600 font-semibold text-sm">
                          {(sdr.name || sdr.email || "U")[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 truncate">
                          {sdr.name || sdr.email || "Unknown"}
                        </h3>
                        {sdr.email && (
                          <p className="text-xs text-gray-500 truncate">{sdr.email}</p>
                        )}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">Gmail</p>
                        <p className="text-lg font-bold text-gray-900">
                          {sdr.total_gmail_records?.toLocaleString() || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-0.5">MailSuite</p>
                        <p className="text-lg font-bold text-gray-900">
                          {sdr.total_mailsuite_records?.toLocaleString() || 0}
                        </p>
                      </div>
                    </div>

                    {/* Team Badge */}
                    {sdr.team && (
                      <div className="pt-1">
                        <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-700 text-xs font-medium rounded">
                          {sdr.team}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Data Validation Button */}
        {hasResults && validationReport && (
          <Fade in timeout={400}>
            <Box sx={{ mb: 2, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="outlined"
                size="medium"
                startIcon={
                  validationReport.overallPassed ? (
                    <CheckCircleIcon sx={{ color: "#4CAF50" }} />
                  ) : (
                    <ErrorIcon sx={{ color: "#e63946" }} />
                  )
                }
                onClick={() => setShowValidation(true)}
                sx={{
                  borderColor: validationReport.overallPassed ? "#4CAF50" : "#e63946",
                  color: validationReport.overallPassed ? "#4CAF50" : "#e63946",
                  fontWeight: 600,
                  "&:hover": {
                    borderColor: validationReport.overallPassed ? "#4CAF50" : "#e63946",
                    bgcolor: validationReport.overallPassed
                      ? "rgba(76, 175, 80, 0.1)"
                      : "rgba(230, 57, 70, 0.1)",
                  },
                }}
              >
                {validationReport.overallPassed
                  ? "✅ Data Validated"
                  : "⚠️ Validation Issues"}
              </Button>
            </Box>
          </Fade>
        )}

        {/* Validation Report Dialog */}
        <Dialog
          open={showValidation}
          onClose={() => setShowValidation(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: validationReport?.overallPassed
                ? "linear-gradient(135deg, #4CAF50 0%, #66BB6A 100%)"
                : "linear-gradient(135deg, #e63946 0%, #f44336 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <VerifiedUserIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Data Validation Report
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  {validationReport?.summary?.status || "Validation results"}
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setShowValidation(false)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
            {validationReport && (
              <Box>
                {/* Summary */}
                <Card sx={{ mb: 2, bgcolor: "white" }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#000000" }}>
                      Summary
                    </Typography>
                    <Grid container spacing={2}>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Overall Status
                        </Typography>
                        <Typography
                          variant="h6"
                          sx={{
                            color: validationReport.overallPassed ? "#4CAF50" : "#e63946",
                            fontWeight: 700,
                          }}
                        >
                          {validationReport.overallPassed ? "✅ PASSED" : "❌ FAILED"}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Errors Found
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                          {validationReport.summary.totalErrors}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Warnings
                        </Typography>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                          {validationReport.summary.totalWarnings}
                        </Typography>
                      </Grid>
                      <Grid item xs={12} sm={6}>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Timestamp
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#000000" }}>
                          {new Date(validationReport.timestamp).toLocaleString()}
                        </Typography>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Basic Validation Results */}
                {validationReport.checks.basicValidation && (
                  <Card sx={{ mb: 2, bgcolor: "white" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#000000" }}>
                        Basic Validation
                      </Typography>
                      {validationReport.checks.basicValidation.summary && (
                        <Box sx={{ mb: 2 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Processed Total Sends
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {validationReport.checks.basicValidation.summary.processedTotalSends.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Stats Total Sends
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {validationReport.checks.basicValidation.summary.statsTotalSends.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Unique Recipients
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {validationReport.checks.basicValidation.summary.uniqueRecipients.toLocaleString()}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {validationReport.checks.basicValidation.errors.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ color: "#e63946", fontWeight: 700, mb: 1 }}>
                            Errors:
                          </Typography>
                          {validationReport.checks.basicValidation.errors.map((error, idx) => (
                            <Alert key={idx} severity="error" sx={{ mb: 1 }}>
                              {error}
                            </Alert>
                          ))}
                        </Box>
                      )}

                      {validationReport.checks.basicValidation.warnings.length > 0 && (
                        <Box sx={{ mb: 2 }}>
                          <Typography variant="subtitle2" sx={{ color: "#FF9800", fontWeight: 700, mb: 1 }}>
                            Warnings:
                          </Typography>
                          {validationReport.checks.basicValidation.warnings.map((warning, idx) => (
                            <Alert key={idx} severity="warning" sx={{ mb: 1 }}>
                              {warning}
                            </Alert>
                          ))}
                        </Box>
                      )}

                      {validationReport.checks.basicValidation.details?.sdrBreakdown && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "#000000" }}>
                            SDR Breakdown:
                          </Typography>
                          <TableContainer>
                            <Table size="small">
                              <TableHead>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 700 }}>SDR Name</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                                    Total Sends
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                                    Matched
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                                    Failures
                                  </TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 700 }}>
                                    Match Rate
                                  </TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {validationReport.checks.basicValidation.details.sdrBreakdown.map(
                                  (sdr, idx) => (
                                    <TableRow key={idx}>
                                      <TableCell>{sdr.name}</TableCell>
                                      <TableCell align="right">
                                        {sdr.total_send_records.toLocaleString()}
                                      </TableCell>
                                      <TableCell align="right">{sdr.matched.toLocaleString()}</TableCell>
                                      <TableCell align="right">{sdr.failures.toLocaleString()}</TableCell>
                                      <TableCell align="right">{sdr.matchRate}</TableCell>
                                    </TableRow>
                                  )
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* Raw vs Processed Comparison */}
                {validationReport.checks.rawVsProcessed && (
                  <Card sx={{ bgcolor: "white" }}>
                    <CardContent>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#000000" }}>
                        Raw vs Processed Comparison
                      </Typography>
                      {validationReport.checks.rawVsProcessed.comparison && (
                        <Box sx={{ mb: 2 }}>
                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Raw Total Sends
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {validationReport.checks.rawVsProcessed.comparison.totalRawSends.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Processed Total
                              </Typography>
                              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                {validationReport.checks.rawVsProcessed.comparison.processedTotal.toLocaleString()}
                              </Typography>
                            </Grid>
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                                Match Status
                              </Typography>
                              <Typography
                                variant="h6"
                                sx={{
                                  fontWeight: 700,
                                  color: validationReport.checks.rawVsProcessed.comparison.match
                                    ? "#4CAF50"
                                    : "#e63946",
                                }}
                              >
                                {validationReport.checks.rawVsProcessed.comparison.match ? "✅" : "❌"}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      )}

                      {validationReport.checks.rawVsProcessed.errors.length > 0 && (
                        <Box>
                          <Typography variant="subtitle2" sx={{ color: "#e63946", fontWeight: 700, mb: 1 }}>
                            Comparison Errors:
                          </Typography>
                          {validationReport.checks.rawVsProcessed.errors.map((error, idx) => (
                            <Alert key={idx} severity="error" sx={{ mb: 1 }}>
                              {error}
                            </Alert>
                          ))}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                )}
              </Box>
            )}
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              bgcolor: "#F5F5F5",
              borderTop: "1px solid #E0E0E0",
            }}
          >
            <Button
              onClick={() => {
                if (validationReport) {
                  const reportText = formatValidationReport(validationReport);
                  const blob = new Blob([reportText], { type: "text/plain" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `validation-report-${new Date().toISOString().split("T")[0]}.txt`;
                  link.click();
                  URL.revokeObjectURL(url);
                }
              }}
              variant="outlined"
              size="medium"
              sx={{ fontWeight: 600 }}
            >
              Download Report
            </Button>
            <Button
              onClick={() => setShowValidation(false)}
              variant="contained"
              size="medium"
              sx={{ fontWeight: 600, bgcolor: "#000000" }}
            >
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* Pipeline Stats Report Dialog */}
        <Dialog
          open={pipelineReportOpen}
          onClose={() => setPipelineReportOpen(false)}
          maxWidth="lg"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Leaderboard sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Pipeline Report
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  Send → Opens → Contacts Processing Statistics
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setPipelineReportOpen(false)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, bgcolor: "#f8f9fa" }}>
            {/* Pipeline Statistics Content */}
            <Box>
              {/* Matching Algorithm Info */}
              <Card sx={{ mb: 3, bgcolor: "white", boxShadow: 2, border: "1px solid #e0e0e0" }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                    <SettingsIcon /> Matching Algorithm
                  </Typography>
                  <Chip 
                    label={
                      matchingMode === 'email_only' ? '📧 Email Only' :
                      matchingMode === 'timestamp' ? '⏱️ Timestamp' :
                      matchingMode === 'hybrid' ? '🔄 Hybrid' :
                      matchingMode === 'relaxed' ? '🤝 Relaxed' :
                      matchingMode === 'name_timestamp' ? '🧭 Name + Timestamp' :
                      matchingMode === 'composite' ? '🎯 Composite' :
                      matchingMode
                    }
                    color="primary"
                    variant="outlined"
                    sx={{ fontWeight: 600, mb: 1 }}
                  />
                  <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
                    {matchingMode === 'email_only' && 'Matches by email address only for highest match rate.'}
                    {matchingMode === 'timestamp' && 'Matches by email address and timestamp (0-60 seconds) for precision.'}
                    {matchingMode === 'hybrid' && 'First attempts timestamp matching, then falls back to email-only.'}
                    {matchingMode === 'relaxed' && 'Timestamp matching with wider time windows and email fallback.'}
                    {matchingMode === 'name_timestamp' && 'Matches by name and timestamp for name-only opens.'}
                    {matchingMode === 'composite' && 'Multi-strategy cascade using 10 different matching approaches for maximum coverage.'}
                  </Typography>
                </CardContent>
              </Card>

              {/* Stage 1: Send CSV Stats */}
              <Card sx={{ mb: 3, bgcolor: "white", boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                    <Email /> Stage 1: Send CSV Processing
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Total Send Records
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                        {emailData.stats?.total_send_records?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        After Loopwork Filter
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                        {sendRecordsAfterLoopworkFilter.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Unique Emails
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                        {derivedMetrics.totalProspects?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Filter Rate
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {emailData.stats?.total_send_records 
                          ? `${((filteredSendOpen?.length / emailData.stats.total_send_records) * 100).toFixed(1)}%`
                          : "N/A"}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {/* Stage 2: Send-Open Join Stats */}
              <Card sx={{ mb: 3, bgcolor: "white", boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                    <Visibility /> Stage 2: Send-Open Join (MailSuite)
                  </Typography>
                  
                  {/* Matching Rate Summary */}
                  <Box sx={{ mb: 3, p: 2, bgcolor: "#f0f4ff", borderRadius: 2, border: "2px solid #667eea" }}>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            📊 Send-Open Match Rate
                          </Typography>
                          <Tooltip title="View detailed matching data">
                            <IconButton 
                              size="small" 
                              onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, sendOpen: true })}
                              sx={{ 
                                p: 0.5, 
                                color: "#667eea",
                                bgcolor: "rgba(102, 126, 234, 0.08)",
                                border: "1px solid rgba(102, 126, 234, 0.2)",
                                "&:hover": { 
                                  bgcolor: "rgba(102, 126, 234, 0.15)",
                                  border: "1px solid rgba(102, 126, 234, 0.4)",
                                  transform: "scale(1.1)"
                                },
                                transition: "all 0.2s"
                              }}
                            >
                              <InfoOutlined sx={{ fontSize: 18, fontWeight: 600 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "#667eea" }}>
                          {emailData.stats?.send_open_match_rate?.toFixed(1) || "N/A"}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {emailData.stats?.send_open_success?.toLocaleString() || 0} of {emailData.stats?.total_send_records?.toLocaleString() || 0} sends matched
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            📈 Opens with Tracking Data
                          </Typography>
                          <Tooltip title="View records with tracking data">
                            <IconButton 
                              size="small" 
                              onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, trackingData: true })}
                              sx={{ 
                                p: 0.5, 
                                color: "#4CAF50",
                                bgcolor: "rgba(76, 175, 80, 0.08)",
                                border: "1px solid rgba(76, 175, 80, 0.2)",
                                "&:hover": { 
                                  bgcolor: "rgba(76, 175, 80, 0.15)",
                                  border: "1px solid rgba(76, 175, 80, 0.4)",
                                  transform: "scale(1.1)"
                                },
                                transition: "all 0.2s"
                              }}
                            >
                              <InfoOutlined sx={{ fontSize: 18, fontWeight: 600 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                          {emailData.stats?.opens_data_match_rate?.toFixed(1) || "N/A"}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {emailData.stats?.opens_with_tracking_data?.toLocaleString() || 0} sends matched with opens that have tracking data (Views != NULL)
                        </Typography>
                      </Grid>
                      <Grid item xs={12} md={4}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                          <Typography variant="body2" sx={{ color: "text.secondary" }}>
                            🎯 Contact Match Rate
                          </Typography>
                          <Tooltip title="View contact matching data">
                            <IconButton 
                              size="small" 
                              onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, contactMatch: true })}
                              sx={{ 
                                p: 0.5, 
                                color: "#e63946",
                                bgcolor: "rgba(230, 57, 70, 0.08)",
                                border: "1px solid rgba(230, 57, 70, 0.2)",
                                "&:hover": { 
                                  bgcolor: "rgba(230, 57, 70, 0.15)",
                                  border: "1px solid rgba(230, 57, 70, 0.4)",
                                  transform: "scale(1.1)"
                                },
                                transition: "all 0.2s"
                              }}
                            >
                              <InfoOutlined sx={{ fontSize: 18, fontWeight: 600 }} />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "#e63946" }}>
                          {typeof emailData.stats?.contact_match_rate === 'number' 
                            ? emailData.stats.contact_match_rate.toFixed(1)
                            : emailData.stats?.contact_match_rate || "N/A"}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {emailData.stats?.contact_join_success?.toLocaleString() || 0} records matched with contacts
                        </Typography>
                      </Grid>
                    </Grid>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Total Opens Records
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                        {emailData.stats?.total_open_records?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Send Records Matched
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {emailData.stats?.send_open_success?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        With Views != NULL
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {(filteredSendOpen?.filter(r => r.Views != null && r.Views !== '').length || 0).toLocaleString()}
                        {filteredSendOpen?.length
                          ? ` (${((filteredSendOpen.filter(r => r.Views != null && r.Views !== '').length / filteredSendOpen.length) * 100).toFixed(1)}%)`
                          : ""}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={4}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Match Success Rate
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {emailData.stats?.send_open_success && filteredSendOpen?.length
                          ? `${((emailData.stats.send_open_success / filteredSendOpen.length) * 100).toFixed(1)}%`
                          : "N/A"}
                      </Typography>
                    </Grid>
                  </Grid>
                  
                  {/* Data Quality Warning */}
                  {emailData.stats?.opens_without_emails && emailData.stats?.total_open_records &&
                   (emailData.stats.opens_without_emails / emailData.stats.total_open_records) > 0.5 && (
                    <Alert severity="warning" sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        ⚠️ Data Quality Issue: {((emailData.stats.opens_without_emails / emailData.stats.total_open_records) * 100).toFixed(1)}% of Opens records have names only (no emails)
                      </Typography>
                      <Typography variant="caption">
                        Re-export Opens from MailSuite with "Include email addresses" enabled to improve open rate accuracy.
                      </Typography>
                    </Alert>
                  )}

                  {/* Matching Strategy Summary Table */}
                  {emailData.stats?.strategy_matches && (
                    <Box sx={{ mt: 3 }}>
                      <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                        <Leaderboard /> Matching Strategy Breakdown
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                        Summary of records matched by each strategy in composite mode.
                      </Typography>
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: "#f5f5f5" }}>
                              <TableCell sx={{ fontWeight: 700 }}>Step</TableCell>
                              <TableCell sx={{ fontWeight: 700 }}>Strategy</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Records Matched</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>Confidence</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>% of Total</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {[
                              { key: 'email', label: 'Email Match', confidence: '0.95', step: 1 },
                              { key: 'name_subject', label: 'Name + Subject', confidence: '0.8', step: 2 },
                              { key: 'subject_only', label: 'Subject Only', confidence: '0.5', step: 3 },
                              { key: 'name_only', label: 'Name Only', confidence: '0.4', step: 4 },
                              { key: 'fuzzy_subject', label: 'Fuzzy Subject', confidence: '0.3', step: 5 },
                              { key: 'domain_name', label: 'Domain + Name', confidence: '0.25', step: 6 },
                              { key: 'date_range', label: 'Date Range', confidence: '0.2', step: 7 },
                              { key: 'thread_id', label: 'Thread ID', confidence: '0.9', step: 8 },
                              { key: 'fuzzy_name', label: 'Fuzzy Name', confidence: '0.3', step: 9 },
                              { key: 'date_proximity', label: 'Date Proximity', confidence: '0.15', step: 10 },
                            ].map((strategy) => {
                              const count = emailData.stats.strategy_matches[strategy.key] || 0;
                              const total = emailData.stats.total_send_records || 1;
                              const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                              const cumulative = [
                                'email', 'name_subject', 'subject_only', 'name_only', 
                                'fuzzy_subject', 'domain_name', 'date_range', 
                                'thread_id', 'fuzzy_name', 'date_proximity'
                              ].slice(0, strategy.step).reduce((sum, k) => sum + (emailData.stats.strategy_matches[k] || 0), 0);
                              const cumulativePct = total > 0 ? ((cumulative / total) * 100).toFixed(1) : '0.0';
                              
                              return (
                                <TableRow key={strategy.key} hover>
                                  <TableCell>{strategy.step}</TableCell>
                                  <TableCell>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                                      {strategy.label}
                                      {count > 0 && (
                                        <Chip 
                                          label={`${cumulativePct}%`} 
                                          size="small" 
                                          color={strategy.step <= 3 ? "success" : strategy.step <= 6 ? "warning" : "default"}
                                          variant="outlined"
                                        />
                                      )}
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right">
                                    <Typography sx={{ fontWeight: count > 0 ? 600 : 400, color: count > 0 ? "#4CAF50" : "text.secondary" }}>
                                      {count.toLocaleString()}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right">{strategy.confidence}</TableCell>
                                  <TableCell align="right">{percentage}%</TableCell>
                                </TableRow>
                              );
                            })}
                            <TableRow sx={{ bgcolor: "#f9f9f9", borderTop: "2px solid #ddd" }}>
                              <TableCell colSpan={2} sx={{ fontWeight: 700 }}>Total Matched</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {emailData.stats.send_open_success?.toLocaleString() || 0}
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>-</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700 }}>
                                {emailData.stats.send_open_match_rate?.toFixed(1) || "0.0"}%
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell colSpan={2} sx={{ fontWeight: 600 }}>Unmatched</TableCell>
                              <TableCell align="right" sx={{ color: "#f44336", fontWeight: 600 }}>
                                {(emailData.stats.total_send_records - (emailData.stats.send_open_success || 0)).toLocaleString()}
                              </TableCell>
                              <TableCell align="right">-</TableCell>
                              <TableCell align="right" sx={{ color: "#f44336", fontWeight: 600 }}>
                                {((100 - parseFloat(emailData.stats.send_open_match_rate || 0)).toFixed(1))}%
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}

                  {/* Send-Open Matched Records Table */}
                  <Box sx={{ mt: 4 }}>
                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                      <Email /> Send-Open Matched Records
                    </Typography>
                    <Typography variant="body2" sx={{ color: "text.secondary", mb: 2 }}>
                      View all send records that were matched with open records. Records with Views = NULL indicate sends that matched but the open record had no tracking data.
                    </Typography>
                    <Box sx={{ mb: 1, display: "flex", gap: 1, flexWrap: "wrap" }}>
                      <Chip 
                        label={`Total: ${(filteredSendOpen || []).length.toLocaleString()}`} 
                        size="small" 
                        color="primary" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`With Views: ${(filteredSendOpen || []).filter(r => r.Views != null && r.Views !== '').length.toLocaleString()}`} 
                        size="small" 
                        color="success" 
                        variant="outlined"
                      />
                      <Chip 
                        label={`No Views: ${(filteredSendOpen || []).filter(r => r.Views == null || r.Views === '').length.toLocaleString()}`} 
                        size="small" 
                        color="warning" 
                        variant="outlined"
                      />
                    </Box>
                    <DataTable
                      columns={[
                        { key: "sent_date", label: "Send Date" },
                        { key: "recipient_name", label: "Recipient Name" },
                        { key: "Recipient Email", label: "Email" },
                        { key: "Subject", label: "Subject" },
                        { key: "SDR_Name", label: "SDR" },
                        { key: "Views", label: "Views" },
                        { key: "Clicks", label: "Clicks" },
                        { key: "last_opened", label: "Last Opened" },
                        { key: "Domain", label: "Domain" },
                      ]}
                      rows={filteredSendOpen || []}
                      maxHeight={500}
                      emptyMessage="No send-open matched records found."
                    />
                  </Box>
                </CardContent>
              </Card>

              {/* Stage 3: Contacts Join Stats */}
              <Card sx={{ mb: 3, bgcolor: "white", boxShadow: 2 }}>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: "#667eea", display: "flex", alignItems: "center", gap: 1 }}>
                    <Business /> Stage 3: Contacts Join
                  </Typography>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Total Contacts
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                        {emailData.stats?.total_contact_records?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Successful Matches
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {emailData.stats?.contact_join_success?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Failed Matches
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#f44336" }}>
                        {emailData.stats?.contact_join_failures?.toLocaleString() || "N/A"}
                      </Typography>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Typography variant="body2" sx={{ color: "text.secondary" }}>
                        Contact Match Rate
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#4CAF50" }}>
                        {derivedMetrics.contactMatch ? `${formatPercent(derivedMetrics.contactMatch)}` : "N/A"}
                      </Typography>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, bgcolor: "#f8f9fa" }}>
            <Button onClick={() => setPipelineReportOpen(false)} variant="contained">
              Close
            </Button>
          </DialogActions>
        </Dialog>

        {/* KPI Info Dialogs */}
        {/* Send-Open Match Rate Info */}
        <Dialog
          open={kpiInfoOpen.sendOpen}
          onClose={() => setKpiInfoOpen({ ...kpiInfoOpen, sendOpen: false })}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: "#667eea", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Email /> Send-Open Match Rate Details
            </Box>
            <IconButton onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, sendOpen: false })} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ mb: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: "#667eea" }}>
                Total Send-Open Matched Records: {emailData.stats?.send_open_success?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Filtered Records (after SDR/Date filters): {(filteredSendOpen || []).length.toLocaleString()}
              </Typography>
            </Box>
            <DataTable
              columns={[
                { key: "sent_date", label: "Send Date" },
                { key: "recipient_name", label: "Recipient Name" },
                { key: "Recipient Email", label: "Email" },
                { key: "Subject", label: "Subject" },
                { key: "SDR_Name", label: "SDR" },
                { key: "Views", label: "Views" },
                { key: "Clicks", label: "Clicks" },
                { key: "last_opened", label: "Last Opened" },
              ]}
              rows={filteredSendOpen || []}
              maxHeight={500}
              emptyMessage="No matched records found."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, sendOpen: false })}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Opens with Tracking Data Info */}
        <Dialog
          open={kpiInfoOpen.trackingData}
          onClose={() => setKpiInfoOpen({ ...kpiInfoOpen, trackingData: false })}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: "#4CAF50", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Visibility /> Opens with Tracking Data Details
            </Box>
            <IconButton onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, trackingData: false })} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ mb: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: "#4CAF50" }}>
                Total Records with Tracking Data: {emailData.stats?.opens_with_tracking_data?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Filtered Records (after SDR/Date filters): {(filteredSendOpen || []).filter(r => r.Views != null && r.Views !== '').length.toLocaleString()}
              </Typography>
            </Box>
            <DataTable
              columns={[
                { key: "sent_date", label: "Send Date" },
                { key: "recipient_name", label: "Recipient Name" },
                { key: "Recipient Email", label: "Email" },
                { key: "Subject", label: "Subject" },
                { key: "SDR_Name", label: "SDR" },
                { key: "Views", label: "Views" },
                { key: "Clicks", label: "Clicks" },
                { key: "last_opened", label: "Last Opened" },
              ]}
              rows={(filteredSendOpen || []).filter(r => r.Views != null && r.Views !== '')}
              maxHeight={500}
              emptyMessage="No records with tracking data found."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, trackingData: false })}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Contact Match Rate Info */}
        <Dialog
          open={kpiInfoOpen.contactMatch}
          onClose={() => setKpiInfoOpen({ ...kpiInfoOpen, contactMatch: false })}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle sx={{ bgcolor: "#e63946", color: "white", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Business /> Contact Match Rate Details
            </Box>
            <IconButton onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, contactMatch: false })} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3 }}>
            <Box sx={{ mb: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
              <Typography variant="body2" sx={{ mb: 1, fontWeight: 600, color: "#e63946" }}>
                Total Contact-Matched Records: {emailData.stats?.contact_join_success?.toLocaleString() || 0}
              </Typography>
              <Typography variant="body2" sx={{ color: "text.secondary" }}>
                Filtered Records (after SDR/Date filters): {(filteredForAnalysis || []).length.toLocaleString()}
              </Typography>
            </Box>
            <DataTable
              columns={[
                { key: "sent_date", label: "Send Date" },
                { key: "recipient_name", label: "Recipient Name" },
                { key: "Recipient Email", label: "Email" },
                { key: "Company Name", label: "Company" },
                { key: "First Name", label: "First Name" },
                { key: "Last Name", label: "Last Name" },
                { key: "Title", label: "Title" },
                { key: "Views", label: "Views" },
                { key: "Clicks", label: "Clicks" },
                { key: "SDR_Name", label: "SDR" },
              ]}
              rows={filteredForAnalysis || []}
              maxHeight={500}
              emptyMessage="No contact-matched records found."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setKpiInfoOpen({ ...kpiInfoOpen, contactMatch: false })}>Close</Button>
          </DialogActions>
        </Dialog>

        {/* Upload Data Modal */}
        <Dialog
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          maxWidth="md"
          fullWidth
          PaperProps={{
            sx: {
              borderRadius: 3,
              maxHeight: "90vh",
            },
          }}
        >
          <DialogTitle
            sx={{
              bgcolor: "linear-gradient(135deg, #1d3557 0%, #457b9d 100%)",
              background: "linear-gradient(135deg, #1d3557 0%, #457b9d 100%)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SettingsIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Data Configuration
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  Upload SDR files or configure data source
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setModalOpen(false)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              {/* Gmail Integration Component - HIDDEN
              <GmailIntegration
                onDataFetched={handleGmailDataFetched}
                dateRange={filters.dateRange}
              />

              <Divider sx={{ my: 1 }}>
                <Chip label="OR" size="small" />
              </Divider>

              MailSuite Integration Component - HIDDEN
              <MailSuiteIntegration
                onDataFetched={handleMailSuiteDataFetched}
                dateRange={filters.dateRange}
              />

              <Divider sx={{ my: 1 }}>
                <Chip label="OR" size="small" />
              </Divider>
              */}

                <Card
                  elevation={2}
                  sx={{
                    borderRadius: 3,
                    border: "1px solid #E0E0E0",
                    overflow: "hidden",
                  }}
                >
                  <Box
                    sx={{
                      bgcolor: "#a8dadc",
                      p: 2,
                      borderBottom: "2px solid #457b9d",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000", display: "flex", alignItems: "center", gap: 1 }}>
                          👥 SDR Managers
                        </Typography>
                        <Typography variant="caption" sx={{ color: "#000000" }}>
                          Add each SDR's Send & Open exports
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="contained"
                        sx={{
                          bgcolor: "#000000",
                          color: "white",
                          fontWeight: 600,
                          boxShadow: "0 2px 8px rgba(69, 123, 157, 0.3)",
                          "&:hover": {
                            bgcolor: "#000000",
                            boxShadow: "0 4px 12px rgba(69, 123, 157, 0.4)",
                          },
                        }}
                        onClick={() => setSdrs((prev) => [...prev, createSdrEntry()])}
                      >
                        ➕ Add SDR
                      </Button>
                    </Stack>
                  </Box>
                  <CardContent sx={{ p: 2.5 }}>
                    <Stack spacing={2}>
                      {sdrs.map((sdr, idx) => (
                        <SdrCard
                          key={sdr.id}
                          index={idx}
                          sdr={sdr}
                          canRemove={sdrs.length > 1}
                          onNameChange={(value) =>
                            setSdrs((prev) =>
                              prev.map((item) =>
                                item.id === sdr.id ? { ...item, name: value } : item
                              )
                            )
                          }
                          onSendFileChange={(file) =>
                            setSdrs((prev) =>
                              prev.map((item) =>
                                item.id === sdr.id ? { ...item, sendFile: file } : item
                              )
                            )
                          }
                          onOpenFileChange={(file) =>
                            setSdrs((prev) =>
                              prev.map((item) =>
                                item.id === sdr.id ? { ...item, openFile: file } : item
                              )
                            )
                          }
                          onRemove={() =>
                            setSdrs((prev) => prev.filter((item) => item.id !== sdr.id))
                          }
                        />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
                <UploadCard
                  label="Contacts CSV"
                  fileName={contactsFile?.name}
                  status={contactsFile ? "Ready" : "Pending"}
                  description="Requires Email column plus any company metadata."
                  onFileChange={setContactsFile}
                />
                <Card
                  elevation={3}
                  sx={{
                    bgcolor: canProcess ? "#e63946" : "#F5F5F5",
                    border: canProcess ? "2px solid #e63946" : "2px solid #E0E0E0",
                    borderRadius: 3,
                    overflow: "hidden",
                    transition: "all 0.3s",
                  }}
                >
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleProcess}
                    disabled={!canProcess || loading}
                    sx={{
                      py: 2,
                      fontSize: "1rem",
                      fontWeight: 700,
                      bgcolor: canProcess ? "#e63946" : undefined,
                      boxShadow: canProcess ? "0 4px 16px rgba(230, 57, 70, 0.4)" : "none",
                      "&:hover": {
                        bgcolor: canProcess ? "#d62839" : undefined,
                        transform: canProcess ? "translateY(-2px)" : "none",
                        boxShadow: canProcess ? "0 6px 20px rgba(230, 57, 70, 0.5)" : "none",
                      },
                      transition: "all 0.3s",
                    }}
                  >
                    {loading ? "⏳ Processing…" : "🚀 Process Email Files"}
                  </Button>
                </Card>
                {error && (
                  <Alert severity="error" variant="outlined">
                    {error}
                  </Alert>
                )}
                <Card variant="outlined">
                  <CardContent>
                    <Typography variant="subtitle2" gutterBottom>
                      Sample Templates
                    </Typography>
                    <Stack spacing={1}>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleDownloadTemplate("send")}
                      >
                        Download Send Template
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleDownloadTemplate("open")}
                      >
                        Download Open Template
                      </Button>
                      <Button
                        size="small"
                        variant="text"
                        onClick={() => handleDownloadTemplate("contacts")}
                      >
                        Download Contacts Template
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>
            </Stack>
          </DialogContent>
          <DialogActions
            sx={{
              px: 3,
              py: 2,
              bgcolor: "#F5F5F5",
              borderTop: "1px solid #E0E0E0",
            }}
          >
            <Button
              onClick={() => setModalOpen(false)}
              variant="outlined"
              size="large"
              sx={{ fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                setModalOpen(false);
              }}
              variant="contained"
              size="large"
              sx={{ fontWeight: 600 }}
            >
              Done
            </Button>
          </DialogActions>
        </Dialog>

        {/* Tools Dialog - Gmail Integration */}
        <Dialog
          open={toolsDialogOpen}
          onClose={() => setToolsDialogOpen(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle
            sx={{
              bgcolor: "#457b9d",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              py: 2,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <SettingsIcon sx={{ fontSize: 32 }} />
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  Tools
                </Typography>
                <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
                  Download data from Gmail
                </Typography>
              </Box>
            </Box>
            <IconButton onClick={() => setToolsDialogOpen(false)} sx={{ color: "white" }}>
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
            <Stack spacing={2.5} sx={{ mt: 2 }}>
              {/* Gmail Integration Component */}
              <GmailIntegration
                onDataFetched={handleGmailDataFetched}
                dateRange={filters.dateRange}
              />
            </Stack>
          </DialogContent>
        </Dialog>

        {/* Main Content */}
        <Box>
          {hasResults ? (
            <Stack spacing={4}>
              {/* Filters Section - Moved to Top */}
              <Fade in timeout={400}>
                <div
                  id="section-filters"
                  className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 relative overflow-hidden hover:shadow-md transition-all duration-300"
                >
                  {/* Top accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-600 to-slate-700"></div>
                  
                  <div className="p-5">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-50 to-slate-50 flex items-center justify-center border border-gray-100">
                        <span className="text-lg">🔍</span>
                      </div>
                      <div className="flex-1">
                        <h2 className="text-lg font-bold text-gray-900 mb-0.5 tracking-tight">
                          Advanced Analytics & Filtering
                        </h2>
                        <p className="text-xs text-gray-500">
                          Analyze performance by week, month, or custom date ranges
                        </p>
                      </div>
                    </div>
                    {/* Filters Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                      {/* Time Period */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            📅 Time Period
                        </label>
                        <select
                              value={filters.timePeriod}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, timePeriod: e.target.value }))
                              }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                            >
                          <option value="day">📆 Daily</option>
                          <option value="week">📊 Week-by-Week</option>
                          <option value="month">📈 Month-by-Month</option>
                        </select>
                      </div>

                      {/* Metric */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            📊 Metric
                        </label>
                        <select
                              value={filters.metric}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, metric: e.target.value }))
                              }
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                            >
                              {metricOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                  {opt.label}
                            </option>
                              ))}
                        </select>
                      </div>

                      {/* Start Date */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            🗓️ Start Date
                        </label>
                        <input
                            type="date"
                            value={filters.dateRange?.start ? format(filters.dateRange.start, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const start = e.target.value ? new Date(e.target.value) : null;
                              setFilters((prev) => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, start },
                              }));
                            }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                        />
                      </div>

                      {/* End Date */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                            📆 End Date
                        </label>
                        <input
                            type="date"
                            value={filters.dateRange?.end ? format(filters.dateRange.end, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const end = e.target.value ? new Date(e.target.value) : null;
                              setFilters((prev) => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, end },
                              }));
                            }}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                          />
                      </div>
                    </div>

                    {/* SDR Filter, Search, and Reset */}
                    <div className="bg-gradient-to-br from-slate-50/50 to-gray-50/30 p-4 rounded-lg border border-gray-100">
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3 items-end">
                        {/* SDR Filter */}
                        <div className="sm:col-span-1 md:col-span-4">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                👤 SDR Filter
                          </label>
                          <select
                                  value={filters.sdrFilter}
                                  onChange={(e) =>
                                    setFilters((prev) => ({ ...prev, sdrFilter: e.target.value }))
                                  }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                                >
                            <option value="all">🌐 All SDRs</option>
                                  {Array.from(
                                    new Set(
                                      emailData.successful
                                        .map((r) => r.SDR_Name || r["Account Owner"] || "Unassigned")
                                        .filter(Boolean)
                                    )
                                  ).map((sdr) => (
                              <option key={sdr} value={sdr}>
                                      👤 {sdr}
                              </option>
                                  ))}
                          </select>
                        </div>

                        {/* Search */}
                        <div className="sm:col-span-1 md:col-span-5">
                          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
                                🔎 Search
                          </label>
                          <input
                            type="text"
                                placeholder="Search by name, company, email..."
                                value={filters.search}
                                onChange={(e) =>
                                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                                }
                            className="w-full px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-900 text-sm font-medium placeholder-gray-400 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all duration-200 hover:border-gray-300"
                              />
                        </div>

                        {/* Reset Button */}
                        <div className="sm:col-span-2 md:col-span-3">
                          <button
                                onClick={() =>
                                  setFilters({
                                    search: "",
                                    metric: "Views",
                                    timePeriod: "day",
                                    dateRange: null,
                                    sdrFilter: "all",
                                  })
                                }
                            className="w-full px-4 py-2 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 text-white font-semibold rounded-lg shadow-sm hover:shadow-md transition-all duration-200 text-sm"
                              >
                                🔄 Reset All
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Fade>

              {/* Key Performance Indicators */}
              <div id="section-kpis" className="opacity-100">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                      📊 Key Performance Indicators
                  </h2>
                  <button
                      onClick={() => setPipelineReportOpen(true)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap"
                    >
                      📊 Detailed Pipeline Report
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
                      {[
                        { 
                          title: "Total Sends", 
                          value: derivedMetrics.totalSends.toLocaleString(), 
                          helper: "All filtered send records",
                          delay: 0, 
                          color: "primary" 
                        },
                        { 
                          title: "Total Prospects", 
                          value: derivedMetrics.totalProspects.toLocaleString(), 
                          helper: "Unique recipient emails",
                          delay: 100, 
                          color: "primary" 
                        },
                        {
                          title: "Open Rate",
                          value: `${formatPercent(derivedMetrics.openRate)}`,
                          helper: "% with non-null views",
                          delay: 200,
                          color: "success",
                        },
                        {
                          title: "Opened Prospects",
                          value: derivedMetrics.openedProspects.toLocaleString(),
                          helper: "Unique prospects opened",
                          delay: 300,
                          color: "success",
                        },
                        {
                          title: "Prospect Opened %",
                          value: `${formatPercent(derivedMetrics.prospectOpenedRate)}`,
                          helper: "% of prospects who opened",
                          delay: 400,
                          color: "success",
                        },
                        { 
                          title: "Total Views", 
                          value: derivedMetrics.totalViews.toLocaleString(), 
                          helper: "Sum of all views",
                          delay: 500, 
                          color: "info" 
                        },
                        { 
                          title: "Total Clicks", 
                          value: derivedMetrics.totalClicks.toLocaleString(), 
                          helper: "Sum of all clicks",
                          delay: 600, 
                          color: "info" 
                        },
                        {
                          title: "Accounts Owned",
                          value: derivedMetrics.accountsOwned.toLocaleString(),
                          helper: "Unique company IDs",
                          delay: 700,
                          color: "primary",
                        },
                        {
                          title: "Contact Match %",
                          value: `${formatPercent(derivedMetrics.contactMatch)}`,
                          helper: "Matched with contacts",
                          delay: 800,
                          color: "success",
                        },
                        {
                          title: "High Engagement",
                          value: derivedMetrics.highEngagement.toLocaleString(),
                          helper: "Views > 2× emails",
                          delay: 900,
                          color: "success",
                        },
                      ].map((kpi, idx) => (
                      <div 
                        key={kpi.title} 
                        className="opacity-0 animate-fade-in-up"
                        style={{ 
                          animationDelay: `${kpi.delay}ms`,
                          animationFillMode: 'forwards'
                        }}
                      >
                              <KpiCard
                                title={kpi.title}
                                value={kpi.value}
                                helper={kpi.helper}
                                color={kpi.color}
                              />
                      </div>
                      ))}
                </div>
              </div>

              {/* SDR Leaderboard - Top Section */}
              {sdrMatrix.length > 0 && (
                <div id="section-leaderboard" className="animate-fade-in-up">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="w-12 h-12 rounded-lg bg-green-50 border-2 border-red-500 flex items-center justify-center">
                        <Leaderboard sx={{ fontSize: 24, color: "#e63946" }} />
                      </div>
                      <div className="flex-1">
                        <h2 className="text-xl font-bold text-gray-900 mb-1">
                          SDR Leaderboard
                        </h2>
                        <p className="text-sm text-gray-600">
                          Top performers ranked by engagement, views, and overall activity
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1.5 bg-gray-900 text-white font-semibold rounded-lg text-sm">
                        {sdrMatrix.length} SDRs Total
                      </span>
                      <div className="relative group">
                        <button className="p-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors">
                          <InfoOutlined sx={{ fontSize: 20 }} />
                        </button>
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-lg shadow-xl border border-gray-200 p-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                          <p className="text-xs font-bold text-gray-900 mb-1">
                                How rankings are calculated
                          </p>
                          <p className="text-xs text-gray-600 mb-1">
                                Score = (Views × 0.4) + (Clicks × 0.3) + (High-engagement sends × 0.2) + (Engagement rate × 0.1).
                          </p>
                          <p className="text-xs text-gray-600">
                                High-engagement send = email with Views ≥ 5. SDRs are sorted by this score (highest first).
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                    {/* Top 3 Podium Cards */}
                    {sdrMatrix.length >= 3 && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                          {[
                            { idx: 1, rank: 2 },
                            { idx: 0, rank: 1 },
                            { idx: 2, rank: 3 },
                          ].map(({ idx, rank }) => {
                            const sdr = sdrMatrix[idx];
                            const medalThemes = {
                              1: {
                                bg: "from-yellow-50 to-yellow-100",
                                border: "border-yellow-400",
                                icon: "text-yellow-700",
                                badge: "bg-yellow-400",
                                shadow: "shadow-yellow-400/30",
                                hover: "hover:scale-105 hover:-translate-y-2",
                              },
                              2: {
                                bg: "from-gray-50 to-gray-100",
                                border: "border-gray-300",
                                icon: "text-gray-600",
                                badge: "bg-gray-300",
                                shadow: "shadow-gray-300/30",
                                hover: "hover:scale-105 hover:-translate-y-1",
                              },
                              3: {
                                bg: "from-orange-50 to-orange-100",
                                border: "border-orange-400",
                                icon: "text-orange-700",
                                badge: "bg-orange-400",
                                shadow: "shadow-orange-400/30",
                                hover: "hover:scale-105 hover:-translate-y-1",
                              },
                            };
                            const theme = medalThemes[rank];

                            return (
                              <div key={sdr.sdr} className={`relative bg-gradient-to-br ${theme.bg} border-4 ${theme.border} rounded-2xl transition-all duration-300 ${theme.hover} ${rank === 1 ? 'shadow-lg' : 'shadow-md'} ${theme.shadow}`}>
                                <div className={`absolute -top-3 -right-3 w-10 h-10 ${theme.badge} rounded-full shadow-lg flex items-center justify-center`}>
                                  <span className="text-white text-xs font-bold">{rank === 1 ? '🥇' : rank === 2 ? '🥈' : '🥉'}</span>
                                </div>
                                <div className="text-center p-4 pt-6">
                                  <div className={`w-16 h-16 ${theme.badge} rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg`}>
                                    <span className="text-white text-3xl font-black">{rank}</span>
                                  </div>
                                  <h3 className="text-lg font-bold text-gray-900 mb-1">{sdr.sdr}</h3>
                                  <span className="inline-block px-2 py-1 bg-black/10 text-gray-900 font-semibold rounded-lg text-xs mb-3">
                                    Score: {Math.round(sdr.score).toLocaleString()}
                                  </span>
                                  <div className="grid grid-cols-2 gap-2 mt-3">
                                    <div className="bg-white/70 rounded-lg p-2 border border-gray-200">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <Email sx={{ fontSize: 14, color: rank === 1 ? "#F57F17" : rank === 2 ? "#616161" : "#E65100" }} />
                                        <span className="text-gray-600 font-semibold text-xs">Sends</span>
                                      </div>
                                      <p className="text-lg font-bold text-gray-900">{sdr.sends.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/70 rounded-lg p-2 border border-gray-200">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <AccountCircle sx={{ fontSize: 14, color: rank === 1 ? "#F57F17" : rank === 2 ? "#616161" : "#E65100" }} />
                                        <span className="text-gray-600 font-semibold text-xs">Prospects</span>
                                      </div>
                                      <p className="text-lg font-bold text-gray-900">{sdr.totalProspects?.toLocaleString() || "0"}</p>
                                    </div>
                                    <div className="bg-white/70 rounded-lg p-2 border border-gray-200">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <Visibility sx={{ fontSize: 14, color: rank === 1 ? "#F57F17" : rank === 2 ? "#616161" : "#E65100" }} />
                                        <span className="text-gray-600 font-semibold text-xs">Views</span>
                                      </div>
                                      <p className="text-lg font-bold text-gray-900">{sdr.views.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/70 rounded-lg p-2 border border-gray-200">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <TouchApp sx={{ fontSize: 14, color: rank === 1 ? "#F57F17" : rank === 2 ? "#616161" : "#E65100" }} />
                                        <span className="text-gray-600 font-semibold text-xs">Clicks</span>
                                      </div>
                                      <p className="text-lg font-bold text-gray-900">{sdr.clicks.toLocaleString()}</p>
                                    </div>
                                    <div className="bg-white/70 rounded-lg p-2 border border-gray-200 col-span-2">
                                      <div className="flex items-center justify-center gap-1 mb-1">
                                        <TrendingUp sx={{ fontSize: 14, color: rank === 1 ? "#F57F17" : rank === 2 ? "#616161" : "#E65100" }} />
                                        <span className="text-gray-600 font-semibold text-xs">High Eng.</span>
                                      </div>
                                      <p className="text-lg font-bold text-gray-900">{sdr.highEngagement}</p>
                                    </div>
                                  </div>
                                  <div className="mt-3 p-2 bg-white/70 rounded-lg border border-gray-200">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-gray-600 font-semibold text-xs">Open Rate</span>
                                      <span className={`${theme.icon} font-bold text-sm`}>{(sdr.openRate || sdr.engagementRate).toFixed(1)}%</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                      <span className="text-gray-600 font-semibold text-xs">Prospect Opened %</span>
                                      <span className={`${theme.icon} font-bold text-sm`}>{(sdr.prospectOpenedRate || 0).toFixed(1)}%</span>
                                    </div>
                                  </div>
                                  <div className="mt-3">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-gray-600 font-semibold text-xs">Open Rate</span>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 shadow-inner">
                                      <div 
                                        className={`h-2.5 rounded-full ${rank === 1 ? 'bg-yellow-400' : rank === 2 ? 'bg-gray-400' : 'bg-orange-400'} shadow-sm`}
                                        style={{ width: `${Math.min(sdr.openRate || sdr.engagementRate, 100)}%` }}
                                      ></div>
                                    </div>
                                    <p className={`${theme.icon} font-bold text-sm mt-1`}>{(sdr.openRate || sdr.engagementRate).toFixed(1)}%</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}

                    {/* Full Leaderboard Table */}
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="p-5 border-b border-gray-100">
                        <h3 className="text-xl font-bold text-gray-900 mb-1">
                          Complete Rankings
                        </h3>
                        <p className="text-sm text-gray-500">
                          All SDRs sorted by performance score
                        </p>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Rank</th>
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SDR Name</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-1">
                                  <Email sx={{ fontSize: 14, color: "#6B7280" }} />
                                  Sends
                                </div>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-1">
                                  <AccountCircle sx={{ fontSize: 14, color: "#6B7280" }} />
                                  Prospects
                                </div>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-1">
                                  <Visibility sx={{ fontSize: 14, color: "#6B7280" }} />
                                  Views
                                </div>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                                <div className="flex items-center justify-end gap-1">
                                  <TouchApp sx={{ fontSize: 14, color: "#6B7280" }} />
                                  Clicks
                                </div>
                              </th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Open Rate</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Prospect Opened %</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">High Engagement</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance Score</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sdrMatrix.slice(0, 10).map((sdr, idx) => {
                              const rank = idx + 1;
                              const isTopThree = rank <= 3;
                              const medalColors = {
                                1: "#FFD700",
                                2: "#C0C0C0",
                                3: "#CD7F32",
                              };

                              return (
                                <tr
                                  key={sdr.sdr}
                                  className={`transition-all duration-300 hover:bg-gray-50 ${
                                    isTopThree ? "bg-gray-50 border-l-4" : "border-l-4 border-transparent"
                                  }`}
                                  style={{
                                    borderLeftColor: isTopThree ? medalColors[rank] : "transparent",
                                  }}
                                >
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                      {isTopThree ? (
                                        <div
                                          className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-lg"
                                          style={{
                                            backgroundColor: medalColors[rank],
                                            boxShadow: `0 4px 12px ${medalColors[rank]}60`,
                                          }}
                                        >
                                          {rank}
                                        </div>
                                      ) : (
                                        <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                                          <span className="text-gray-600 font-semibold text-sm">{rank}</span>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap">
                                    <span className={`text-gray-900 font-medium text-sm ${isTopThree ? "font-bold" : ""}`}>
                                      {sdr.sdr}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-900 font-semibold rounded-lg text-xs">
                                      <Email sx={{ fontSize: 14 }} />
                                      {sdr.sends.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-gray-900 font-semibold rounded-lg text-xs">
                                      <AccountCircle sx={{ fontSize: 14 }} />
                                      {sdr.totalProspects?.toLocaleString() || "0"}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-100 text-gray-900 font-semibold rounded-lg text-xs">
                                      <Visibility sx={{ fontSize: 14 }} />
                                      {sdr.views.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-cyan-50 text-gray-900 font-semibold rounded-lg text-xs">
                                      <TouchApp sx={{ fontSize: 14 }} />
                                      {sdr.clicks.toLocaleString()}
                                    </span>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-2 min-w-[120px]">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            rank === 1 ? "bg-yellow-500" : rank === 2 ? "bg-gray-400" : rank === 3 ? "bg-orange-500" : "bg-green-500"
                                          }`}
                                          style={{ width: `${Math.min(sdr.openRate || sdr.engagementRate, 100)}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-gray-900 font-bold text-xs min-w-[40px]">
                                          {(sdr.openRate || sdr.engagementRate).toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-2 min-w-[120px]">
                                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                                        <div
                                          className={`h-2 rounded-full ${
                                            rank === 1 ? "bg-yellow-500" : rank === 2 ? "bg-gray-400" : rank === 3 ? "bg-orange-500" : "bg-purple-500"
                                          }`}
                                          style={{ width: `${Math.min(sdr.prospectOpenedRate || 0, 100)}%` }}
                                        ></div>
                                      </div>
                                      <span className="text-gray-900 font-bold text-xs min-w-[40px]">
                                          {(sdr.prospectOpenedRate || 0).toFixed(1)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <span className="px-2 py-1 bg-orange-50 text-orange-700 font-semibold rounded-lg text-xs">
                                        {sdr.highEngagement}
                                      </span>
                                      <span className="text-gray-500 text-xs">
                                        ({sdr.highEngagementRate.toFixed(1)}%)
                                      </span>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-right">
                                    <span
                                      className={`inline-block px-3 py-1.5 font-bold rounded-lg text-sm ${
                                        isTopThree
                                          ? "bg-orange-50 text-orange-700 border-2 border-purple-600"
                                          : "bg-gray-100 text-gray-900 border border-gray-300"
                                      }`}
                                    >
                                      {Math.round(sdr.score).toLocaleString()}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      {sdrMatrix.length > 10 && (
                        <div className="p-4 text-center border-t border-gray-100 bg-gray-50/50">
                          <p className="text-xs text-gray-500 font-medium">
                            Showing top 10 of {sdrMatrix.length} SDRs • Ranked by performance score
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
              )}

              {/* {emailData.sdrStats?.length ? (
                <Slide direction="up" in timeout={600}>
                  <Card
                    elevation={2}
                    sx={{
                      bgcolor: "#FFFFFF",
                      border: "1px solid #E0E0E0",
                      borderRadius: 3,
                      overflow: "hidden",
                      transition: "all 0.3s ease-in-out",
                      "&:hover": {
                        boxShadow: 4,
                        transform: "translateY(-2px)",
                      },
                    }}
                  >
                    <Box
                      sx={{
                        bgcolor: "#E8EAF6",
                        p: 2,
                        borderBottom: "2px solid #3F51B5",
                      }}
                    >
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                        🔗 SDR Join Summary
                      </Typography>
                      <Typography variant="caption" sx={{ color: "text.secondary" }}>
                        Send-Open join statistics per SDR
                      </Typography>
                    </Box>
                    <CardContent>
                      <DataTable
                        columns={[
                          { key: "name", label: "SDR" },
                          { key: "total_send_records", label: "Total Sends" },
                          { key: "matched", label: "Matched" },
                          { key: "failures", label: "Failures" },
                        ]}
                        rows={emailData.sdrStats}
                        emptyMessage="No SDR stats available."
                      />
                    </CardContent>
                  </Card>
                </Slide>
              ) : null} */}


              {/* Daily/Monthly Engagement Trend */}
              <div id="section-trends" className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">
                          📈 Engagement Trend Analysis
                      </h2>
                      <p className="text-sm text-gray-500">
                          {filters.timePeriod === "week"
                            ? "Week-by-Week Performance Analysis"
                            : filters.timePeriod === "month"
                            ? "Month-by-Month Performance Analysis"
                            : "Daily Performance Analysis"}
                      </p>
                    </div>
                    <span className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg text-sm">
                      {filteredForAnalysis.length.toLocaleString()} records
                    </span>
                  </div>
                </div>
                <div className="p-5">
                    {trendData.labels.length > 0 ? (
                    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                        <Plot
                          data={[
                            {
                              type: filters.timePeriod === "day" ? "scatter" : "bar",
                              mode: filters.timePeriod === "day" ? "lines+markers" : undefined,
                              x: trendData.labels,
                              y: trendData.values,
                              marker: {
                                color: filters.timePeriod === "week" ? "#6366F1" : filters.timePeriod === "month" ? "#EC4899" : "#3B82F6",
                                size: filters.timePeriod === "day" ? 6 : undefined,
                                line: filters.timePeriod === "day" ? { color: "#1E40AF", width: 1.5 } : undefined,
                              },
                            line: filters.timePeriod === "day" ? { 
                              shape: "spline", 
                              smoothing: 0.6, 
                              width: 2.5, 
                              color: "#3B82F6" 
                            } : undefined,
                              fill: filters.timePeriod === "day" ? "tonexty" : undefined,
                            fillcolor: filters.timePeriod === "day" ? "rgba(59, 130, 246, 0.08)" : undefined,
                            },
                          ]}
                          layout={{
                            height: 450,
                            autosize: true,
                          margin: { t: 20, r: 20, l: 60, b: 80 },
                            paper_bgcolor: "transparent",
                          plot_bgcolor: "transparent",
                          font: { 
                            color: "#6B7280", 
                            family: "Inter, system-ui, sans-serif", 
                            size: 11 
                          },
                            xaxis: {
                            tickangle: filters.timePeriod === "day" ? -45 : -90,
                              showgrid: true,
                            gridcolor: "#E5E7EB",
                            gridwidth: 1,
                            tickfont: { color: "#9CA3AF", size: 10 },
                            title: { 
                              text: "Time Period", 
                              font: { color: "#374151", size: 12, family: "Inter, system-ui, sans-serif" } 
                            },
                            linecolor: "#E5E7EB",
                            linewidth: 1,
                            },
                            yaxis: {
                              showgrid: true,
                            gridcolor: "#E5E7EB",
                            gridwidth: 1,
                            tickfont: { color: "#9CA3AF", size: 10 },
                              title: {
                                text: filters.metric === "Views" ? "Views" : filters.metric === "Clicks" ? "Clicks" : "Count",
                              font: { color: "#374151", size: 12, family: "Inter, system-ui, sans-serif" },
                              },
                            linecolor: "#E5E7EB",
                            linewidth: 1,
                            },
                            hovermode: "x unified",
                            hoverlabel: {
                            bgcolor: "rgba(17, 24, 39, 0.9)",
                            bordercolor: filters.timePeriod === "week" ? "#6366F1" : filters.timePeriod === "month" ? "#EC4899" : "#3B82F6",
                            font: { color: "white", size: 11, family: "Inter, system-ui, sans-serif" },
                            padding: 8,
                            },
                            showlegend: false,
                          }}
                          style={{ width: "100%" }}
                          useResizeHandler
                          config={{
                            displayModeBar: true,
                            displaylogo: false,
                          modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
                            toImageButtonOptions: {
                              format: "png",
                              filename: "engagement-trend",
                              height: 450,
                              width: 1200,
                            scale: 2,
                            },
                          }}
                        />
                    </div>
                    ) : (
                    <div className="h-[450px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No Data Available
                      </h3>
                      <p className="text-sm text-gray-500">
                          Try adjusting your filters or date range
                      </p>
                    </div>
                    )}
                </div>
              </div>

              {/* Week-by-Week Analysis Section */}
              <div id="section-tables" className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up">
                <div className="p-5 border-b border-gray-100">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h2 className="text-xl font-bold text-gray-900 mb-1">
                        📅 Week-by-Week Analysis
                      </h2>
                      <p className="text-sm text-gray-500">
                        Detailed weekly breakdown of performance metrics
                      </p>
                    </div>
                    <span className="px-3 py-1.5 bg-white border border-gray-300 text-gray-700 font-semibold rounded-lg text-sm">
                      Detailed Weekly Breakdown
                    </span>
                  </div>
                </div>
                <div className="p-5">
                    {(() => {
                      const weekData = buildTrend(filteredForAnalysis, filters.metric, "week", filters.dateRange);
                      return weekData.labels.length > 0 ? (
                      <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                          <Plot
                            data={[
                              {
                                type: "bar",
                                x: weekData.labels,
                                y: weekData.values,
                                marker: {
                                color: "#6366F1",
                                line: { color: "#4F46E5", width: 1.5 },
                                },
                              },
                            ]}
                            layout={{
                              height: 400,
                              autosize: true,
                            margin: { t: 20, r: 20, l: 60, b: 100 },
                              paper_bgcolor: "transparent",
                            plot_bgcolor: "transparent",
                            font: { 
                              color: "#6B7280", 
                              family: "Inter, system-ui, sans-serif", 
                              size: 11 
                            },
                              xaxis: {
                                tickangle: -45,
                                showgrid: true,
                              gridcolor: "#E5E7EB",
                              gridwidth: 1,
                              tickfont: { color: "#9CA3AF", size: 10 },
                              title: { 
                                text: "Week", 
                                font: { color: "#374151", size: 12, family: "Inter, system-ui, sans-serif" } 
                              },
                              linecolor: "#E5E7EB",
                              linewidth: 1,
                              },
                              yaxis: {
                                showgrid: true,
                              gridcolor: "#E5E7EB",
                              gridwidth: 1,
                              tickfont: { color: "#9CA3AF", size: 10 },
                                title: {
                                  text: filters.metric === "Views" ? "Views" : filters.metric === "Clicks" ? "Clicks" : "Count",
                                font: { color: "#374151", size: 12, family: "Inter, system-ui, sans-serif" },
                                },
                              linecolor: "#E5E7EB",
                              linewidth: 1,
                              },
                              hovermode: "x unified",
                              hoverlabel: {
                              bgcolor: "rgba(17, 24, 39, 0.9)",
                              bordercolor: "#6366F1",
                              font: { color: "white", size: 11, family: "Inter, system-ui, sans-serif" },
                              padding: 8,
                              },
                            showlegend: false,
                            }}
                            style={{ width: "100%" }}
                            useResizeHandler
                          config={{
                            displayModeBar: true,
                            displaylogo: false,
                            modeBarButtonsToRemove: ["pan2d", "lasso2d", "select2d"],
                            toImageButtonOptions: {
                              format: "png",
                              filename: "week-by-week-analysis",
                              height: 400,
                              width: 1200,
                              scale: 2,
                            },
                          }}
                        />
                      </div>
                    ) : (
                      <div className="h-[400px] flex flex-col items-center justify-center bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-sm text-gray-500">
                            No weekly data available
                        </p>
                      </div>
                      );
                    })()}
                </div>
              </div>

              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                      📊 SDR Performance Matrix
                  </h2>
                  <p className="text-sm text-gray-500">
                      Detailed performance metrics for all SDRs
                  </p>
                </div>
                <div className="p-5">
                  {sdrMatrix.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-sm text-gray-500">
                        No SDR data available.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SDR / Owner</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Matched Sends</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</th>
                              <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                            </tr>
                          </thead>
                          <tbody className="bg-white divide-y divide-gray-200">
                            {sdrMatrix.map((row, idx) => (
                              <tr key={`${row.sdr || ""}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-4 py-3 whitespace-nowrap">
                                  <span className="text-sm font-medium text-gray-900">{row.sdr || "-"}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <span className="text-sm text-gray-900">{row.sends?.toLocaleString() || "0"}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <span className="text-sm text-gray-900">{row.views?.toLocaleString() || "0"}</span>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-right">
                                  <span className="text-sm text-gray-900">{row.clicks?.toLocaleString() || "0"}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </div>
              </div>


              {/* Company Engagement Analysis */}
              <Fade in timeout={1200}>
                <Box id="section-companies">
                  <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: 2,
                        bgcolor: "#E8EAF6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #6033d7",
                      }}
                    >
                      <Business sx={{ fontSize: 26, color: "#6033d7" }} />
                    </Box>
                    <Box>
                      <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                        Company Engagement Analysis
                      </Typography>
                      <Typography variant="body2" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                        <strong>{companyEngagement.totalCompanies.toLocaleString()}</strong> companies analyzed •{" "}
                        <strong>{companyEngagement.highEngagementCount.toLocaleString()}</strong> high engagement accounts (Views &gt; 2×
                        Emails)
                      </Typography>
                    </Box>
                  </Stack>

                  {companyEngagement.highEngagementCompanies.length > 0 ? (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="p-5 border-b border-gray-100">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                          <div>
                            <h2 className="text-xl font-bold text-gray-900 mb-1">
                            High Engagement Companies
                            </h2>
                            <p className="text-sm text-gray-500">
                            Companies with engagement rate &gt; 200%
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                            onClick={() => setCompanyMatrixOpen(true)}
                              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            View table
                            </button>
                            <button
                            onClick={handleExportHighEngagementCompanies}
                              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            Export
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="p-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                          {companyEngagement.highEngagementCompanies.slice(companyPage * companiesPerPage, companyPage * companiesPerPage + companiesPerPage).map((company, idx) => (
                            <div
                              key={company.company}
                              className="p-3 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm"
                            >
                              <div className="space-y-2">
                                {/* Header: Icon, Company Name, Badges, and Stats */}
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex items-center gap-2 flex-1 min-w-0">
                                    <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                      <Business sx={{ fontSize: 14, color: "#6B7280" }} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <h3 className="text-sm font-bold text-gray-900 truncate mb-1">
                                      {company.company}
                                      </h3>
                                      <div className="flex flex-wrap items-center gap-1.5">
                                        <span className="px-1.5 py-0.5 bg-purple-600 text-white font-semibold rounded text-xs">
                                          HIGH
                                        </span>
                                        <span className="px-1.5 py-0.5 bg-gray-100 text-gray-900 font-semibold border border-gray-300 rounded text-xs">
                                          {company.engagementRate.toFixed(0)}%
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center gap-1.5 justify-end flex-shrink-0">
                                    <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                      <span>📧</span>
                                      <span>{company.emails}</span>
                                    </span>
                                    <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                      <span>👁️</span>
                                      <span>{company.views.toFixed(1)}</span>
                                    </span>
                                    <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                      <span>🖱️</span>
                                      <span>{company.clicks.toFixed(1)}</span>
                                    </span>
                                  </div>
                                </div>
                                {/* Progress Bar */}
                                <div>
                                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                                    <div
                                      className="bg-indigo-600 h-1.5 rounded-full"
                                      style={{ width: `${Math.min((company.engagementRate / 20) * 100, 100)}%` }}
                                    ></div>
                                  </div>
                                </div>
                                {/* Know More Button */}
                                <button
                                      onClick={() => {
                                        const key = company.company
                                          ? String(company.company).toLowerCase().trim()
                                          : null;
                                        if (!key) return;
                                        setSelectedCompanyKey(key);
                                        setSelectedCompanyLabel(company.company);
                                        setCompanyDetailsOpen(true);
                                      }}
                                  className="w-full px-3 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                      Know more
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        {/* Pagination */}
                        {companyEngagement.highEngagementCompanies.length > companiesPerPage && (
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                            <div className="flex flex-1 justify-between sm:hidden">
                              <button
                                onClick={() => setCompanyPage(Math.max(0, companyPage - 1))}
                                disabled={companyPage === 0}
                                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setCompanyPage(Math.min(Math.ceil(companyEngagement.highEngagementCompanies.length / companiesPerPage) - 1, companyPage + 1))}
                                disabled={companyPage >= Math.ceil(companyEngagement.highEngagementCompanies.length / companiesPerPage) - 1}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-700">
                                  Showing <span className="font-medium">{companyPage * companiesPerPage + 1}</span> to{" "}
                                  <span className="font-medium">
                                    {Math.min((companyPage + 1) * companiesPerPage, companyEngagement.highEngagementCompanies.length)}
                                  </span>{" "}
                                  of <span className="font-medium">{companyEngagement.highEngagementCompanies.length}</span> companies
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700">Per page:</label>
                                <select
                                  value={companiesPerPage}
                                  onChange={(e) => {
                                    setCompaniesPerPage(Number(e.target.value));
                                    setCompanyPage(0);
                                  }}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value={6}>6</option>
                                  <option value={9}>9</option>
                                  <option value={12}>12</option>
                                  <option value={18}>18</option>
                                </select>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setCompanyPage(Math.max(0, companyPage - 1))}
                                    disabled={companyPage === 0}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setCompanyPage(Math.min(Math.ceil(companyEngagement.highEngagementCompanies.length / companiesPerPage) - 1, companyPage + 1))}
                                    disabled={companyPage >= Math.ceil(companyEngagement.highEngagementCompanies.length / companiesPerPage) - 1}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                      <div className="p-12 text-center">
                        <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                          <Business sx={{ fontSize: 40, color: "#9CA3AF" }} />
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No High Engagement Companies Found
                        </h3>
                        <p className="text-sm text-gray-500">
                          Companies with Views &gt; 2× Emails will appear here
                        </p>
                      </div>
                    </div>
                  )}
                </Box>
              </Fade>

      {/* High Engagement Companies Matrix Dialog */}
      <Dialog
        open={companyMatrixOpen}
        onClose={() => setCompanyMatrixOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#1d3557",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            High Engagement Companies Matrix
          </Typography>
          <IconButton
            onClick={() => setCompanyMatrixOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
          <Typography
            variant="body2"
            sx={{ mb: 2, color: "text.secondary" }}
          >
            All high engagement companies (Views &gt; 2× Emails) for the current
            filters.
          </Typography>
          <DataTable
            columns={[
              { key: "company", label: "Company" },
              { key: "emails", label: "Emails" },
              { key: "views", label: "Views" },
              { key: "clicks", label: "Clicks" },
              { key: "engagementRate", label: "Engagement Rate (%)" },
            ]}
            rows={companyMatrixRows}
            emptyMessage="No high engagement companies in the current filters."
          />
        </DialogContent>
      </Dialog>

      {/* High Engagement Company Details Dialog */}
      <Dialog
        open={companyDetailsOpen}
        onClose={() => {
          setCompanyDetailsOpen(false);
          setSelectedCompanyKey(null);
          setSelectedCompanyLabel("");
        }}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#1d3557",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            High Engagement Company Details
            {selectedCompanyLabel ? ` • ${selectedCompanyLabel}` : ""}
          </Typography>
          <IconButton
            onClick={() => {
              setCompanyDetailsOpen(false);
              setSelectedCompanyKey(null);
              setSelectedCompanyLabel("");
            }}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
          <Typography
            variant="body2"
            sx={{ mb: 2, color: "text.secondary" }}
          >
            Individual email sends contributing to this company&apos;s
            engagement, based on the current filters.
          </Typography>
          <DataTable
            columns={[
              { key: "sent_date", label: "Sent Date" },
              { key: "recipient_email", label: "Recipient Email" },
              { key: "views", label: "Views" },
              { key: "clicks", label: "Clicks" },
            ]}
            rows={companyDetailRows}
            emptyMessage="No email records for this company in the current filters."
          />
        </DialogContent>
      </Dialog>

      {/* High Engagement Prospects Matrix Dialog */}
      <Dialog
        open={prospectsMatrixOpen}
        onClose={() => setProspectsMatrixOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: "90vh",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: "#1d3557",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            py: 2,
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            High Engagement Prospects Matrix
          </Typography>
          <IconButton
            onClick={() => setProspectsMatrixOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent sx={{ p: 3, bgcolor: "#f1faee" }}>
          <Typography
            variant="body2"
            sx={{ mb: 2, color: "text.secondary" }}
          >
            All high engagement prospects (Views &gt; 2× Emails) for the
            current filters.
          </Typography>
          <DataTable
            columns={[
              { key: "prospectName", label: "Prospect Name" },
              { key: "prospectEmail", label: "Prospect Email" },
              { key: "company", label: "Company" },
              { key: "emails", label: "Emails" },
              { key: "views", label: "Views" },
              { key: "clicks", label: "Clicks" },
              { key: "engagementRate", label: "Engagement Rate (%)" },
            ]}
            rows={prospectsMatrixRows}
            emptyMessage="No high engagement prospects in the current filters."
          />
        </DialogContent>
      </Dialog>

              {/* High Engagement Prospects */}
              <div id="section-prospects" className="animate-fade-in-up">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-14 h-14 rounded-xl bg-gray-50 border-2 border-gray-200 flex items-center justify-center">
                      <TrendingUp sx={{ fontSize: 28, color: "#6B7280" }} />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold text-gray-900 mb-1">
                        ⭐ High Engagement Prospects
                      </h2>
                      <p className="text-sm text-gray-600">
                        📊 <strong>{highEngagementProspects.totalProspects.toLocaleString()}</strong> prospects analyzed •{" "}
                        <strong>{highEngagementProspects.highEngagementCount.toLocaleString()}</strong> high engagement prospects (Views &gt; 2×
                        Emails)
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                        onClick={() => setProspectsMatrixOpen(true)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        View table
                    </button>
                    <button
                        onClick={handleExportHighEngagementProspects}
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        Export
                    </button>
                  </div>
                </div>

                  {highEngagementProspects.highEngagementProspects.length > 0 ? (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                    <div className="p-5 border-b border-gray-100">
                      <h2 className="text-xl font-bold text-gray-900 mb-1">
                          High Engagement Prospects
                      </h2>
                      <p className="text-sm text-gray-500">
                          Prospects with engagement rate > 200%
                      </p>
                    </div>
                    <div className="p-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                          {highEngagementProspects.highEngagementProspects.slice(prospectPage * prospectsPerPage, prospectPage * prospectsPerPage + prospectsPerPage).map((prospect, idx) => (
                          <div
                              key={prospect.prospectKey}
                            className="p-4 bg-white rounded-lg border border-gray-200 hover:border-gray-300 transition-all duration-200 hover:shadow-sm"
                          >
                            <div className="space-y-2">
                              {/* Header: Icon, Prospect Name, Badges, and Stats */}
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                  <div className="w-7 h-7 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center flex-shrink-0">
                                    <TrendingUp sx={{ fontSize: 14, color: "#6B7280" }} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <h3 className="text-sm font-bold text-gray-900 truncate mb-1">
                                      {prospect.prospectName !== "N/A" ? prospect.prospectName : prospect.prospectEmail}
                                    </h3>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="px-1.5 py-0.5 bg-purple-600 text-white font-semibold rounded text-xs">
                                        HIGH
                                      </span>
                                      <span className="px-1.5 py-0.5 bg-gray-100 text-gray-900 font-semibold border border-gray-300 rounded text-xs">
                                        {prospect.engagementRate.toFixed(0)}%
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center gap-1.5 justify-end flex-shrink-0">
                                  <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                    <span>📧</span>
                                    <span>{prospect.emails}</span>
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                    <span>👁️</span>
                                    <span>{prospect.views.toFixed(1)}</span>
                                  </span>
                                  <span className="px-2 py-0.5 bg-gray-100 border border-gray-200 text-gray-700 font-semibold rounded-full text-xs flex items-center gap-1">
                                    <span>🖱️</span>
                                    <span>{prospect.clicks.toFixed(1)}</span>
                                  </span>
                                </div>
                              </div>
                              {/* Email and Company Info */}
                              <p className="text-xs text-gray-600">
                                    📧 {prospect.prospectEmail} {prospect.company !== "Unknown" && `• 🏢 ${prospect.company}`}
                              </p>
                              {/* Progress Bar */}
                              <div>
                                <div className="w-full bg-gray-200 rounded-full h-1.5">
                                  <div
                                    className="bg-indigo-600 h-1.5 rounded-full"
                                    style={{ width: `${Math.min((prospect.engagementRate / 20) * 100, 100)}%` }}
                                  ></div>
                                </div>
                              </div>
                            </div>
                          </div>
                          ))}
                        </div>

                        {/* Pagination */}
                        {highEngagementProspects.highEngagementProspects.length > prospectsPerPage && (
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                            <div className="flex flex-1 justify-between sm:hidden">
                              <button
                                onClick={() => setProspectPage(Math.max(0, prospectPage - 1))}
                                disabled={prospectPage === 0}
                                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setProspectPage(Math.min(Math.ceil(highEngagementProspects.highEngagementProspects.length / prospectsPerPage) - 1, prospectPage + 1))}
                                disabled={prospectPage >= Math.ceil(highEngagementProspects.highEngagementProspects.length / prospectsPerPage) - 1}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-700">
                                  Showing <span className="font-medium">{prospectPage * prospectsPerPage + 1}</span> to{" "}
                                  <span className="font-medium">
                                    {Math.min((prospectPage + 1) * prospectsPerPage, highEngagementProspects.highEngagementProspects.length)}
                                  </span>{" "}
                                  of <span className="font-medium">{highEngagementProspects.highEngagementProspects.length}</span> prospects
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label htmlFor="prospects-per-page" className="text-sm text-gray-700">
                                  Show:
                                </label>
                                <select
                                  id="prospects-per-page"
                                  value={prospectsPerPage}
                                  onChange={(e) => {
                                    setProspectsPerPage(Number(e.target.value));
                                    setProspectPage(0);
                                  }}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value={5}>5</option>
                                  <option value={10}>10</option>
                                  <option value={20}>20</option>
                                  <option value={50}>50</option>
                                </select>
                                <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                                  <button
                                    onClick={() => setProspectPage(Math.max(0, prospectPage - 1))}
                                    disabled={prospectPage === 0}
                                    className="relative inline-flex items-center rounded-l-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setProspectPage(Math.min(Math.ceil(highEngagementProspects.highEngagementProspects.length / prospectsPerPage) - 1, prospectPage + 1))}
                                    disabled={prospectPage >= Math.ceil(highEngagementProspects.highEngagementProspects.length / prospectsPerPage) - 1}
                                    className="relative inline-flex items-center rounded-r-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </nav>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                  <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
                    <div className="p-12 text-center">
                      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
                        <TrendingUp sx={{ fontSize: 40, color: "#9CA3AF" }} />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">
                          No High Engagement Prospects Found
                      </h3>
                      <p className="text-sm text-gray-500">
                          Prospects with Views &gt; 2× Emails will appear here
                      </p>
                    </div>
                  </div>
                  )}
              </div>

              <div id="detailed-records" className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-all duration-300 animate-fade-in-up">
                <div className="p-5 border-b border-gray-100">
                  <h2 className="text-xl font-bold text-gray-900 mb-1">
                      📋 Detailed Records
                  </h2>
                  <p className="text-sm text-gray-500">
                      View successful and failed email processing records
                  </p>
                </div>
                <div className="p-5">
                  {/* Tabs */}
                  <div className="border-b border-gray-200 mb-4">
                    <div className="flex space-x-1">
                      <button
                        onClick={() => {
                          setTableTab(0);
                          setTablePage(0); // Reset to first page when switching tabs
                        }}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                          tableTab === 0
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <span>Successful</span>
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-900 font-semibold rounded text-xs">
                            {filteredSuccess.length.toLocaleString()}
                          </span>
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDownloadSuccessfulContacts();
                              }}
                            className="ml-2 px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                            >
                              Export CSV
                          </button>
                        </div>
                      </button>
                      <button
                        onClick={() => {
                          setTableTab(1);
                          setTablePage(0); // Reset to first page when switching tabs
                        }}
                        className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                          tableTab === 1
                            ? "border-blue-600 text-blue-600"
                            : "border-transparent text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                            <span>Failed</span>
                          <span className={`px-2 py-0.5 font-semibold rounded text-xs ${
                            filteredFailed.length > 0
                              ? "bg-red-50 text-red-700"
                              : "bg-gray-100 text-gray-500"
                          }`}>
                            {filteredFailed.length.toLocaleString()}
                          </span>
                          <button
                              onClick={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                handleDownloadFailedContacts();
                              }}
                            className="ml-2 px-3 py-1 text-xs font-medium text-white bg-red-600 rounded hover:bg-red-700 transition-colors"
                            >
                              Export CSV
                          </button>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Table Content */}
                  <div className="mt-4">
                      {tableTab === 0 ? (
                      filteredSuccess.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">
                            No successful records match your filters.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Company</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Views</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Clicks</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {filteredSuccess.slice(tablePage * rowsPerPage, tablePage * rowsPerPage + rowsPerPage).map((row, idx) => (
                                  <tr key={`success-${tablePage * rowsPerPage + idx}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-gray-900">{row.recipient_name || "-"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-gray-900">{row["Recipient Email"] || row.recipient_email || "-"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-gray-900">{row.Company || row["Company Name"] || "-"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                      <span className="text-sm text-gray-900">{row.Views?.toLocaleString() || "0"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                      <span className="text-sm text-gray-900">{row.Clicks?.toLocaleString() || "0"}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Pagination */}
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                            <div className="flex flex-1 justify-between sm:hidden">
                              <button
                                onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                                disabled={tablePage === 0}
                                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setTablePage(Math.min(Math.ceil(filteredSuccess.length / rowsPerPage) - 1, tablePage + 1))}
                                disabled={tablePage >= Math.ceil(filteredSuccess.length / rowsPerPage) - 1}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-700">
                                  Showing <span className="font-medium">{tablePage * rowsPerPage + 1}</span> to{" "}
                                  <span className="font-medium">
                                    {Math.min((tablePage + 1) * rowsPerPage, filteredSuccess.length)}
                                  </span>{" "}
                                  of <span className="font-medium">{filteredSuccess.length}</span> results
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700">Rows per page:</label>
                                <select
                                  value={rowsPerPage}
                                  onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setTablePage(0);
                                  }}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value={10}>10</option>
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                                    disabled={tablePage === 0}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setTablePage(Math.min(Math.ceil(filteredSuccess.length / rowsPerPage) - 1, tablePage + 1))}
                                    disabled={tablePage >= Math.ceil(filteredSuccess.length / rowsPerPage) - 1}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    ) : (
                      filteredFailed.length === 0 ? (
                        <div className="p-8 text-center">
                          <p className="text-sm text-gray-500">
                            No failed records.
                          </p>
                        </div>
          ) : (
                        <>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead>
                                <tr className="bg-gray-50 border-b border-gray-200">
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Recipient Email</th>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Failure Reason</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {filteredFailed.slice(tablePage * rowsPerPage, tablePage * rowsPerPage + rowsPerPage).map((row, idx) => (
                                  <tr key={`failed-${tablePage * rowsPerPage + idx}`} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-gray-900">{row.recipient_name || "-"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-gray-900">{row["Recipient Email"] || row.recipient_email || "-"}</span>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <span className="text-sm text-red-600">{row.failure_reason || "Unknown error"}</span>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {/* Pagination */}
                          <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 sm:px-6 mt-4">
                            <div className="flex flex-1 justify-between sm:hidden">
                              <button
                                onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                                disabled={tablePage === 0}
                                className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Previous
                              </button>
                              <button
                                onClick={() => setTablePage(Math.min(Math.ceil(filteredFailed.length / rowsPerPage) - 1, tablePage + 1))}
                                disabled={tablePage >= Math.ceil(filteredFailed.length / rowsPerPage) - 1}
                                className="relative ml-3 inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                Next
                              </button>
                            </div>
                            <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                              <div>
                                <p className="text-sm text-gray-700">
                                  Showing <span className="font-medium">{tablePage * rowsPerPage + 1}</span> to{" "}
                                  <span className="font-medium">
                                    {Math.min((tablePage + 1) * rowsPerPage, filteredFailed.length)}
                                  </span>{" "}
                                  of <span className="font-medium">{filteredFailed.length}</span> results
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <label className="text-sm text-gray-700">Rows per page:</label>
                                <select
                                  value={rowsPerPage}
                                  onChange={(e) => {
                                    setRowsPerPage(Number(e.target.value));
                                    setTablePage(0);
                                  }}
                                  className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                  <option value={10}>10</option>
                                  <option value={25}>25</option>
                                  <option value={50}>50</option>
                                  <option value={100}>100</option>
                                </select>
                                <div className="flex gap-1">
                                  <button
                                    onClick={() => setTablePage(Math.max(0, tablePage - 1))}
                                    disabled={tablePage === 0}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Previous</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => setTablePage(Math.min(Math.ceil(filteredFailed.length / rowsPerPage) - 1, tablePage + 1))}
                                    disabled={tablePage >= Math.ceil(filteredFailed.length / rowsPerPage) - 1}
                                    className="relative inline-flex items-center rounded-md border border-gray-300 bg-white px-2 py-2 text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <span className="sr-only">Next</span>
                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </>
                      )
                    )}
                  </div>
                </div>
              </div>
            </Stack>
          ) : loadingDatabase ? (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm min-h-[480px] flex items-center justify-center">
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-gray-200 border-t-blue-600 mb-4"></div>
                <p className="text-sm font-medium text-gray-700">Loading dashboard data...</p>
                <p className="text-xs text-gray-500 mt-2">Fetching analytics from database</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-lg border-2 border-dashed border-gray-200 shadow-sm min-h-[480px] flex items-center justify-center">
              <div className="text-center max-w-lg px-6">
                <div className="w-24 h-24 rounded-full bg-gray-50 border-2 border-gray-200 flex items-center justify-center mx-auto mb-6">
                  <span className="text-5xl">📊</span>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-3">
                  Get Started with Email Analytics
                </h2>
                <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                  Upload your SDR Send, Open, and Contacts CSV files using the panel on the left, or load demo data to see the
                  dashboard in action.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm">
                    📧 Send CSV
                  </span>
                  <span className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm">
                    👁️ Open CSV
                  </span>
                  <span className="px-4 py-2 bg-gray-50 border border-gray-200 text-gray-700 font-semibold rounded-lg text-sm">
                    👥 Contacts CSV
                  </span>
                </div>
              </div>
            </div>
          )}
        </Box>
    </Container>
    </Box>
  );
}

function buildTrend(rows, metricKey, timePeriod = "day", dateRange = null) {
  if (!rows.length) return { labels: [], values: [] };

  // Filter by date range if provided
  let filteredRows = rows;
  if (dateRange?.start && dateRange?.end) {
    filteredRows = rows.filter((row) => {
      const raw = row.sent_date_parsed instanceof Date
        ? row.sent_date_parsed
        : row.sent_date ? new Date(row.sent_date) : null;
      if (!raw || isNaN(raw.getTime())) return false;
      return isWithinInterval(raw, { start: dateRange.start, end: dateRange.end });
    });
  }

  const buckets = new Map();

  filteredRows.forEach((row) => {
    const raw =
      row.sent_date_parsed instanceof Date
        ? row.sent_date_parsed
        : row.sent_date ? new Date(row.sent_date) : null;
    if (!raw || isNaN(raw.getTime())) return;

    let key;
    if (timePeriod === "week") {
      const weekStart = startOfWeek(raw, { weekStartsOn: 1 }); // Monday
      key = format(weekStart, "yyyy-MM-dd");
    } else if (timePeriod === "month") {
      const monthStart = startOfMonth(raw);
      key = format(monthStart, "yyyy-MM");
    } else {
      key = format(raw, "yyyy-MM-dd");
    }

    if (!buckets.has(key)) buckets.set(key, 0);
    const value = metricKey === "total_sends" ? 1 : Number(row[metricKey]) || 0;
    buckets.set(key, buckets.get(key) + value);
  });

  const sorted = [...buckets.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  // Format labels based on time period
  const labels = sorted.map(([key]) => {
    if (timePeriod === "week") {
      const date = new Date(key);
      const weekEnd = new Date(date);
      weekEnd.setDate(date.getDate() + 6);
      return `${format(date, "MMM d")} - ${format(weekEnd, "MMM d, yyyy")}`;
    } else if (timePeriod === "month") {
      return format(new Date(key + "-01"), "MMM yyyy");
    } else {
      return format(new Date(key), "MMM d, yyyy");
    }
  });

  return {
    labels,
    values: sorted.map(([, value]) => value),
  };
}

function buildSdrMatrix(rows) {
  // Robust numeric conversion matching main KPIs calculation
  const parseNum = (val) => {
    if (val == null || val === '') return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : num;
  };

  const map = new Map();
  rows.forEach((row) => {
    const key = row.SDR_Name || row["Account Owner"] || "Unassigned";
    if (!map.has(key)) {
      map.set(key, {
        sdr: key,
        sends: 0,
        views: 0,
        clicks: 0,
        highEngagement: 0,
        recordsWithOpens: 0, // Count records with non-NULL Views (matching main KPIs)
        prospects: new Set(), // Track unique recipient emails (matching main KPIs)
        openedProspects: new Set(), // Track unique prospects with non-null Views (for prospect opened rate)
        totalRecords: 0,
        companyGroups: new Map(), // Track companies for high engagement calculation (matching main KPIs)
      });
    }
    const agg = map.get(key);
    agg.sends += 1;
    agg.totalRecords += 1;
    
    // Track unique prospects (matching main KPIs: unique Recipient Emails)
    const email = row["Recipient Email"] || row.recipient_email || row.Email || row.email;
    if (email) {
      const emailLower = email.toLowerCase().trim();
      agg.prospects.add(emailLower);
      
      // Track opened prospects: unique prospects with non-null Views (matching main KPIs)
      if (row.Views != null && row.Views !== '') {
        agg.openedProspects.add(emailLower);
      }
    }
    
    // Calculate Views: Sum of all views (matching main KPIs calculation)
    const views = parseNum(row.Views);
    agg.views += views;
    
    // Calculate Clicks: Sum of all clicks using robust calculation (matching main KPIs)
    const clicks = parseNum(row.Clicks);
    agg.clicks += clicks;
    
    // Count records with non-NULL Views (for open rate calculation matching main KPIs)
    if (row.Views != null && row.Views !== '') {
      agg.recordsWithOpens += 1;
    }
    
    // Track companies for high engagement calculation (matching main KPIs logic)
    // High Engagement = Companies where totalViews > 2 * totalEmails
    const companyUrl = row["Company URL"] || row["Company URL ID"] || "Unknown";
    if (!agg.companyGroups.has(companyUrl)) {
      agg.companyGroups.set(companyUrl, {
        emails: 0,
        views: 0,
      });
    }
    const companyData = agg.companyGroups.get(companyUrl);
    companyData.emails += 1;
    companyData.views += views;
  });

  const results = [...map.values()].map((item) => {
    // Total Prospects: Unique recipient emails (matching main KPIs)
    const totalProspects = item.prospects.size;
    
    // Opened Prospects: Unique prospects with non-null Views (matching main KPIs)
    const openedProspects = item.openedProspects.size;
    
    // Open Rate: (records with non-NULL Views / total_sends) * 100 (matching main KPIs)
    const openRate = item.sends > 0 
      ? (item.recordsWithOpens / item.sends) * 100 
      : 0;
    
    // Prospect Opened Rate: (opened_prospect_count / total_prospect_count) * 100 (matching main KPIs)
    const prospectOpenedRate = totalProspects > 0
      ? (openedProspects / totalProspects) * 100
      : 0;
    
    // Click Rate: (Clicks / Views) * 100 (matching main KPIs matrix)
    const clickRate = item.views > 0 
      ? (item.clicks / item.views) * 100 
      : 0;
    
    // High Engagement: Count companies where totalViews > 2 * totalEmails (matching main KPIs logic)
    // This matches the main dashboard calculation: highEngagementCompanies.length
    const highEngagementCompanies = Array.from(item.companyGroups.entries()).filter(([_, companyData]) => {
      return companyData.views > (2 * companyData.emails);
    });
    const highEngagement = highEngagementCompanies.length;
    
    // High Engagement Rate = (High Engagement Companies / Total Prospects) * 100
    const highEngagementRate = totalProspects > 0 
      ? (highEngagement / totalProspects) * 100 
      : 0;
    
    // Calculate score for ranking (weighted combination)
    const score = 
      item.views * 0.4 + 
      item.clicks * 0.3 + 
      item.highEngagement * 0.2 + 
      openRate * 0.1;

    return {
      ...item,
      totalProspects, // Add total prospects
      openedProspects, // Add opened prospects count
      engagementRate: openRate, // Renamed for consistency with display
      openRate, // Add explicit openRate field
      prospectOpenedRate, // Add prospect opened rate
      clickRate,
      highEngagementRate,
      score,
    };
  });

  return results.sort((a, b) => b.score - a.score);
}

/**
 * Calculate High Engagement companies per SDR (matching main dashboard logic)
 * Uses filteredForAnalysis which has Company URL from contacts
 */
function buildHighEngagementBySdr(rows) {
  const sdrMap = new Map();
  
  // Group by SDR first
  rows.forEach((row) => {
    const sdrKey = row.SDR_Name || row["Account Owner"] || "Unassigned";
    if (!sdrMap.has(sdrKey)) {
      sdrMap.set(sdrKey, new Map()); // Map of companyUrl -> {emails, views}
    }
    
    const companyUrl = row["Company URL"] || row["Company URL ID"] || "Unknown";
    const companyGroups = sdrMap.get(sdrKey);
    
    if (!companyGroups.has(companyUrl)) {
      companyGroups.set(companyUrl, {
        emails: 0,
        views: 0,
      });
    }
    
    const companyData = companyGroups.get(companyUrl);
    companyData.emails += 1;
    companyData.views += (Number(row.Views) || 0);
  });
  
  // Calculate High Engagement per SDR (companies where views > 2 * emails)
  const result = new Map();
  sdrMap.forEach((companyGroups, sdrKey) => {
    const highEngagementCompanies = Array.from(companyGroups.entries()).filter(([_, companyData]) => {
      return companyData.views > (2 * companyData.emails);
    });
    result.set(sdrKey, highEngagementCompanies.length);
  });
  
  return result;
}

function buildCompanyEngagement(rows) {
  const companyMap = new Map();

  // Helper to extract domain from URL
  const extractDomain = (url) => {
    if (!url) return null;
    const urlStr = String(url).trim();
    // Remove protocol if present
    let domain = urlStr.replace(/^https?:\/\//, "");
    // Remove www. if present
    domain = domain.replace(/^www\./, "");
    // Get just the domain (remove path)
    domain = domain.split("/")[0];
    // Remove port if present
    domain = domain.split(":")[0];
    return domain || null;
  };

  rows.forEach((row) => {
    // Get company identifier - try multiple fields in priority order
    let companyKey = null;

    // Try direct company name fields first
    companyKey =
      row.Company ||
      row["Company Name"] ||
      row["Company / Account"] ||
      row.company ||
      row["Account Name"] ||
      null;

    // If no direct company name, try to extract from Company URL
    if (!companyKey || companyKey === "Unknown" || companyKey === "") {
      const companyUrl = row["Company URL"] || row.CompanyURL || row["company_url"] || null;
      if (companyUrl) {
        const domain = extractDomain(companyUrl);
        if (domain) {
          companyKey = domain;
        }
      }
    }

    // If still no company, try to extract from email domain
    if (!companyKey || companyKey === "Unknown" || companyKey === "") {
      const email = row["Recipient Email"] || row.email || row.Email || null;
      if (email) {
        const emailDomain = String(email).split("@")[1];
        if (emailDomain) {
          companyKey = emailDomain;
        }
      }
    }

    // Fallback to Unknown only if nothing found
    if (!companyKey || companyKey === "") {
      companyKey = "Unknown";
    }

    // Normalize company key (lowercase for grouping)
    const normalizedKey = companyKey.toLowerCase().trim();

    if (!companyMap.has(normalizedKey)) {
      companyMap.set(normalizedKey, {
        company: companyKey, // Keep original case for display
        emails: 0,
        views: 0,
        clicks: 0,
      });
    }

    const company = companyMap.get(normalizedKey);
    company.emails += 1;
    company.views += Number(row.Views) || 0;
    company.clicks += Number(row.Clicks) || 0;
  });

  // Calculate engagement rate and filter high engagement
  const companies = Array.from(companyMap.values())
    .filter((c) => c.company !== "Unknown") // Exclude Unknown companies
    .map((company) => {
      const engagementRate = company.emails > 0 ? (company.views / company.emails) * 100 : 0;
      const isHighEngagement = engagementRate > 200; // Views > 2× Emails means rate > 200%

      return {
        ...company,
        engagementRate,
        isHighEngagement,
      };
    });

  const highEngagementCompanies = companies
    .filter((c) => c.isHighEngagement)
    .sort((a, b) => b.engagementRate - a.engagementRate);

  return {
    totalCompanies: companies.length,
    highEngagementCount: highEngagementCompanies.length,
    highEngagementCompanies,
    allCompanies: companies.sort((a, b) => b.engagementRate - a.engagementRate),
  };
}

function buildHighEngagementProspects(rows) {
  const prospectMap = new Map();

  rows.forEach((row) => {
    // Get prospect identifier - use recipient email or name
    const prospectEmail = row["Recipient Email"] || row.Email || row.email || null;
    const prospectName = row.recipient_name || row["Recipient Name"] || row.name || null;
    
    // Use email as primary key, fallback to name
    const prospectKey = prospectEmail || prospectName || "Unknown";
    
    if (!prospectMap.has(prospectKey)) {
      prospectMap.set(prospectKey, {
        prospectKey,
        prospectEmail: prospectEmail || "N/A",
        prospectName: prospectName || "N/A",
        company: row.Company || row["Company Name"] || row["Company / Account"] || "Unknown",
        emails: 0,
        views: 0,
        clicks: 0,
        engagementRate: 0,
      });
    }

    const prospect = prospectMap.get(prospectKey);
    prospect.emails += 1;
    prospect.views += Number(row.Views) || 0;
    prospect.clicks += Number(row.Clicks) || 0;
  });

  // Calculate engagement rate and filter high engagement prospects
  // High engagement: Views > 2× Emails (same as company criteria)
  const prospects = Array.from(prospectMap.values()).map((prospect) => {
    const engagementRate = prospect.emails > 0
      ? (prospect.views / prospect.emails) * 100
      : 0;
    
    return {
      ...prospect,
      engagementRate,
      isHighEngagement: prospect.views > (2 * prospect.emails),
    };
  });

  const highEngagementProspects = prospects
    .filter((p) => p.isHighEngagement)
    .sort((a, b) => b.engagementRate - a.engagementRate);

  return {
    totalProspects: prospects.length,
    highEngagementCount: highEngagementProspects.length,
    highEngagementProspects,
    allProspects: prospects.sort((a, b) => b.engagementRate - a.engagementRate),
  };
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export default EmailAnalyticsPage;


