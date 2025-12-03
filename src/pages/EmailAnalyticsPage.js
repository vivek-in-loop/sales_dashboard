import React, { useMemo, useState } from "react";
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
  Typography,
  Zoom,
} from "@mui/material";
import {
  EmojiEvents,
  TrendingUp,
  Visibility,
  TouchApp,
  Business,
  Email,
  LocalFireDepartment,
  Close as CloseIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  VerifiedUser as VerifiedUserIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Warning as WarningIcon,
} from "@mui/icons-material";
import { startOfWeek, startOfMonth, format, eachWeekOfInterval, eachMonthOfInterval, isWithinInterval } from "date-fns";
import Plot from "react-plotly.js";
import UploadCard from "../components/UploadCard";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import SdrCard from "../components/SdrCard";
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
import demoEmailData from "../demo/emailDemo.json";

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
  const [filters, setFilters] = useState({
    search: "",
    metric: "Views",
    timePeriod: "day", // 'day', 'week', 'month'
    dateRange: null, // { start: Date, end: Date }
    sdrFilter: "all", // 'all' or specific SDR name
  });
  const [tableTab, setTableTab] = useState(0);
  const [validationReport, setValidationReport] = useState(null);
  const [showValidation, setShowValidation] = useState(false);

  const hasResults = Boolean(emailData.stats);
  const readySdrs = sdrs.every((sdr) => sdr.sendFile && sdr.openFile);
  const canProcess =
    mode === "upload" && !!contactsFile && readySdrs && !loading;

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
        contactMatch: 0,
        accountsOwned: 0,
        highEngagement: 0,
      };
    }
    
    // final_data = Send + Open + Contacts joined (filtered)
    const final_data = filteredForAnalysis;
    
    // Stage 1: Total Sends (from send data - use stats or filtered data length)
    const totalSends = final_data.length;
    
    // Stage 1: Total Prospect Count - unique Recipient Emails
    const totalProspects = new Set(
      final_data.map(r => r["Recipient Email"] || r.Email).filter(Boolean)
    ).size;
    
    // Stage 2: Records with actual opens (non-null, non-empty Views)
    const recordsWithOpens = final_data.filter(r => {
      const views = r.Views;
      return views != null && views !== '' && Number(views) > 0;
    });
    
    // Stage 1: Open Rate = (records with non-NULL Views / total_sends) * 100
    const openRate = totalSends > 0
      ? (recordsWithOpens.length / totalSends) * 100
      : 0;
    
    // Stage 2: Opened Prospect Count - unique prospects with non-null Views
    const openedProspects = new Set(
      recordsWithOpens.map(r => r["Recipient Email"] || r.Email).filter(Boolean)
    ).size;
    
    // Stage 2: Prospect Opened % = (opened_prospect_count / total_prospect_count) * 100
    const prospectOpenedRate = totalProspects > 0
      ? (openedProspects / totalProspects) * 100
      : 0;
    
    // Stage 2: Total Views (sum from send-open data)
    const totalViews = final_data.reduce(
      (sum, row) => sum + (Number(row.Views) || 0),
      0
    );
    
    // Total Clicks
    const totalClicks = final_data.reduce(
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
    // Use stats if available, otherwise calculate from data
    const contactMatch = emailData.stats?.send_open_success
      ? (emailData.stats.contact_join_success / emailData.stats.send_open_success) * 100
      : (final_data.filter(r => r.Email || r["Recipient Email"]).length / Math.max(1, final_data.length)) * 100;
    
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
      contactMatch,
      accountsOwned,
      highEngagement,
    };
  }, [emailData, hasResults, filteredForAnalysis]);

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

  const filteredFailed = useMemo(() => {
    const term = filters.search.toLowerCase();
    if (!term) return emailData.failed;
    return emailData.failed.filter((row) => {
      const haystack = [
        row.recipient_name,
        row["Recipient Email"],
        row.failure_reason,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [emailData.failed, filters.search]);

  const trendData = useMemo(
    () => buildTrend(filteredForAnalysis, filters.metric, filters.timePeriod, filters.dateRange),
    [filteredForAnalysis, filters.metric, filters.timePeriod, filters.dateRange]
  );

  const sdrMatrix = useMemo(
    () => buildSdrMatrix(emailData.successful),
    [emailData.successful]
  );

  const companyEngagement = useMemo(
    () => buildCompanyEngagement(filteredForAnalysis),
    [filteredForAnalysis]
  );

  const highEngagementProspects = useMemo(
    () => buildHighEngagementProspects(filteredForAnalysis),
    [filteredForAnalysis]
  );

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

      const result = await processMultiSdrPipeline(sdrPayload, contactsText);
      const processedData = {
        successful: result.successful,
        failed: result.failed,
        stats: result.stats,
        sdrStats: result.sdrStats || [],
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

  const handleLoadDemo = () => {
    setEmailData({
      ...demoEmailData,
      sdrStats: demoEmailData.sdrStats || [],
    });
    setMode("demo");
    setError("");
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
        bgcolor: "#f1faee",
        backgroundImage: "radial-gradient(circle at 20% 50%, rgba(69, 123, 157, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(168, 218, 220, 0.05) 0%, transparent 50%)",
      }}
    >
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Fade in timeout={400}>
          <Paper
            elevation={4}
            sx={{
              background: "linear-gradient(135deg, #1d3557 0%, #457b9d 100%)",
              border: "3px solid #1d3557",
              p: 4,
              mb: 4,
              borderRadius: 4,
              position: "relative",
              overflow: "hidden",
              "&::before": {
                content: '""',
                position: "absolute",
                top: -50,
                right: -50,
                width: 200,
                height: 200,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.1)",
              },
              "&::after": {
                content: '""',
                position: "absolute",
                bottom: -30,
                left: -30,
                width: 150,
                height: 150,
                borderRadius: "50%",
                bgcolor: "rgba(255, 255, 255, 0.08)",
              },
            }}
          >
            <Stack
              direction={{ xs: "column", md: "row" }}
              justifyContent="space-between"
              alignItems={{ xs: "flex-start", md: "center" }}
              spacing={2}
              sx={{ position: "relative", zIndex: 1 }}
            >
              <Box>
                <Typography variant="h3" gutterBottom sx={{ fontWeight: 800, color: "white", mb: 1 }}>
                  📊 Email Analytics Dashboard
                </Typography>
                <Typography variant="h6" sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 400 }}>
                  Upload SDR CSVs or load demo data to see send-open-contact performance metrics
                </Typography>
              </Box>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<UploadIcon />}
                  onClick={() => setModalOpen(true)}
                  sx={{
                    bgcolor: "#e63946",
                    color: "white",
                    fontWeight: 700,
                    py: 1.5,
                    px: 4,
                    borderRadius: 3,
                    boxShadow: "0 4px 16px rgba(230, 57, 70, 0.3)",
                    "&:hover": {
                      bgcolor: "#d62839",
                      transform: "translateY(-2px)",
                      boxShadow: "0 6px 20px rgba(230, 57, 70, 0.4)",
                    },
                    transition: "all 0.3s",
                  }}
                >
                  Upload Data
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={handleLoadDemo}
                  sx={{
                    borderColor: "#f1faee",
                    color: "#f1faee",
                    fontWeight: 700,
                    py: 1.5,
                    px: 4,
                    borderRadius: 3,
                    borderWidth: 2,
                    "&:hover": {
                      borderWidth: 2,
                      borderColor: "#f1faee",
                      bgcolor: "rgba(241, 250, 238, 0.1)",
                      transform: "translateY(-2px)",
                    },
                    transition: "all 0.3s",
                  }}
                >
                  🎯 Demo Data
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </Fade>

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
            <Card
              elevation={3}
              sx={{
                borderRadius: 3,
                border: "2px solid #457b9d",
                overflow: "hidden",
                background: "linear-gradient(135deg, #FFFFFF 0%, #f1faee 100%)",
              }}
            >
              <Box
                sx={{
                  bgcolor: "#000000",
                  p: 2,
                  color: "white",
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
                  📂 Data Source
                </Typography>
              </Box>
              <CardContent sx={{ p: 2.5 }}>
                <ToggleButtonGroup
                  fullWidth
                  size="medium"
                  color="primary"
                  value={mode}
                  exclusive
                  onChange={(_, value) => value && setMode(value)}
                  sx={{
                    "& .MuiToggleButton-root": {
                      fontWeight: 600,
                      py: 1.5,
                      "&.Mui-selected": {
                        bgcolor: "#000000",
                        color: "white",
                        "&:hover": {
                          bgcolor: "#000000",
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="upload">📤 Upload SDR Files</ToggleButton>
                  <ToggleButton value="demo">🎯 Pre-processed Demo</ToggleButton>
                </ToggleButtonGroup>
                {mode === "demo" && (
                  <Alert
                    severity="info"
                    sx={{
                      mt: 2,
                      borderRadius: 2,
                      "& .MuiAlert-icon": {
                        fontSize: 24,
                      },
                    }}
                  >
                    Demo data loaded. Switch back to &quot;Upload SDR Files&quot;
                    to process your own CSVs.
                  </Alert>
                )}
              </CardContent>
            </Card>

            {mode === "upload" && (
              <>
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
              </>
            )}
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

        {/* Main Content */}
        <Box>
          {hasResults ? (
            <Stack spacing={4}>
              {/* Filters Section - Moved to Top */}
              <Fade in timeout={400}>
                <Card
                  elevation={3}
                  sx={{
                    background: "linear-gradient(135deg, #f1faee 0%, #a8dadc 100%)",
                    border: "2px solid #457b9d",
                    borderRadius: 3,
                    transition: "all 0.3s ease-in-out",
                    position: "relative",
                    overflow: "hidden",
                    "&:hover": {
                      transform: "translateY(-3px)",
                      boxShadow: "0 8px 24px rgba(69, 123, 157, 0.25)",
                    },
                    "&::before": {
                      content: '""',
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: "4px",
                      background: "linear-gradient(90deg, #457b9d 0%, #1d3557 100%)",
                    },
                  }}
                >
                  <CardContent sx={{ pt: 3 }}>
                    <Stack direction="row" alignItems="center" spacing={2} mb={2}>
                      <Box
                        sx={{
                          width: 48,
                          height: 48,
                          borderRadius: 2,
                          bgcolor: "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 4px 12px rgba(69, 123, 157, 0.3)",
                        }}
                      >
                        <Typography sx={{ fontSize: 28 }}>🔍</Typography>
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                          Advanced Analytics & Filtering
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#000000" }}>
                          Analyze performance by week, month, or custom date ranges
                        </Typography>
                      </Box>
                    </Stack>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={6}>
                        <Box
                          sx={{
                            bgcolor: "white",
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid #E0E0E0",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: "#457b9d",
                              boxShadow: "0 2px 8px rgba(69, 123, 157, 0.15)",
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                            📅 Time Period
                          </Typography>
                          <FormControl fullWidth size="small">
                            <Select
                              value={filters.timePeriod}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, timePeriod: e.target.value }))
                              }
                              sx={{
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#E0E0E0",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#457b9d",
                                },
                              }}
                            >
                              <MenuItem value="day">📆 Daily</MenuItem>
                              <MenuItem value="week">📊 Week-by-Week</MenuItem>
                              <MenuItem value="month">📈 Month-by-Month</MenuItem>
                            </Select>
                          </FormControl>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box
                          sx={{
                            bgcolor: "white",
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid #E0E0E0",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: "#457b9d",
                              boxShadow: "0 2px 8px rgba(69, 123, 157, 0.15)",
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                            📊 Metric
                          </Typography>
                          <FormControl fullWidth size="small">
                            <Select
                              value={filters.metric}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, metric: e.target.value }))
                              }
                              sx={{
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#E0E0E0",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#457b9d",
                                },
                              }}
                            >
                              {metricOptions.map((opt) => (
                                <MenuItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box
                          sx={{
                            bgcolor: "white",
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid #E0E0E0",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: "#457b9d",
                              boxShadow: "0 2px 8px rgba(69, 123, 157, 0.15)",
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                            🗓️ Start Date
                          </Typography>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={filters.dateRange?.start ? format(filters.dateRange.start, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const start = e.target.value ? new Date(e.target.value) : null;
                              setFilters((prev) => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, start },
                              }));
                            }}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "#E0E0E0",
                              },
                              "&:hover .MuiOutlinedInput-notchedOutline": {
                                borderColor: "#457b9d",
                              },
                            }}
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Box
                          sx={{
                            bgcolor: "white",
                            p: 2,
                            borderRadius: 2,
                            border: "1px solid #E0E0E0",
                            transition: "all 0.2s",
                            "&:hover": {
                              borderColor: "#457b9d",
                              boxShadow: "0 2px 8px rgba(69, 123, 157, 0.15)",
                            },
                          }}
                        >
                          <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                            📆 End Date
                          </Typography>
                          <TextField
                            fullWidth
                            size="small"
                            type="date"
                            value={filters.dateRange?.end ? format(filters.dateRange.end, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const end = e.target.value ? new Date(e.target.value) : null;
                              setFilters((prev) => ({
                                ...prev,
                                dateRange: { ...prev.dateRange, end },
                              }));
                            }}
                            InputLabelProps={{ shrink: true }}
                            sx={{
                              "& .MuiOutlinedInput-notchedOutline": {
                                borderColor: "#E0E0E0",
                              },
                              "&:hover .MuiOutlinedInput-notchedOutline": {
                                borderColor: "#457b9d",
                              },
                            }}
                          />
                        </Box>
                      </Grid>
                      <Grid item xs={12}>
                        <Box
                          sx={{
                            bgcolor: "white",
                            p: 2.5,
                            borderRadius: 2,
                            border: "1px solid #E0E0E0",
                          }}
                        >
                          <Grid container spacing={2} alignItems="flex-end">
                            <Grid item xs={12} sm={6} md={4}>
                              <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                                👤 SDR Filter
                              </Typography>
                              <FormControl fullWidth size="small">
                                <Select
                                  value={filters.sdrFilter}
                                  onChange={(e) =>
                                    setFilters((prev) => ({ ...prev, sdrFilter: e.target.value }))
                                  }
                                  sx={{
                                    "& .MuiOutlinedInput-notchedOutline": {
                                      borderColor: "#E0E0E0",
                                    },
                                    "&:hover .MuiOutlinedInput-notchedOutline": {
                                      borderColor: "#457b9d",
                                    },
                                  }}
                                >
                                  <MenuItem value="all">🌐 All SDRs</MenuItem>
                                  {Array.from(
                                    new Set(
                                      emailData.successful
                                        .map((r) => r.SDR_Name || r["Account Owner"] || "Unassigned")
                                        .filter(Boolean)
                                    )
                                  ).map((sdr) => (
                                    <MenuItem key={sdr} value={sdr}>
                                      👤 {sdr}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </FormControl>
                            </Grid>
                            <Grid item xs={12} sm={6} md={5}>
                              <Typography variant="caption" sx={{ color: "#616161", fontWeight: 600, mb: 1, display: "block" }}>
                                🔎 Search
                              </Typography>
                              <TextField
                                fullWidth
                                size="small"
                                placeholder="Search by name, company, email..."
                                value={filters.search}
                                onChange={(e) =>
                                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                                }
                                sx={{
                                  "& .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "#E0E0E0",
                                  },
                                  "&:hover .MuiOutlinedInput-notchedOutline": {
                                    borderColor: "#457b9d",
                                  },
                                }}
                              />
                            </Grid>
                            <Grid item xs={12} sm={12} md={3}>
                              <Button
                                fullWidth
                                variant="contained"
                                color="primary"
                                size="medium"
                                onClick={() =>
                                  setFilters({
                                    search: "",
                                    metric: "Views",
                                    timePeriod: "day",
                                    dateRange: null,
                                    sdrFilter: "all",
                                  })
                                }
                                sx={{
                                  height: 40,
                                  fontWeight: 600,
                                  bgcolor: "#000000",
                                  boxShadow: "0 4px 12px rgba(69, 123, 157, 0.3)",
                                  "&:hover": {
                                    bgcolor: "#000000",
                                    boxShadow: "0 6px 16px rgba(69, 123, 157, 0.4)",
                                    transform: "translateY(-2px)",
                                  },
                                  transition: "all 0.2s",
                                }}
                              >
                                🔄 Reset All
                              </Button>
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>
                    </Grid>
                  </CardContent>
                </Card>
              </Fade>

              {/* Key Performance Indicators */}
              <Fade in timeout={600}>
                <Box>
                  <Typography
                    variant="h5"
                    sx={{
                      fontWeight: 700,
                      color: "#000000",
                      mb: 3,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                    }}
                  >
                    📊 Key Performance Indicators
                  </Typography>
                  <Grid container spacing={2.5}>
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
                          color: "warning",
                        },
                      ].map((kpi, idx) => (
                        <Grid item xs={12} sm={6} md={4} lg={2.4} key={kpi.title}>
                          <Zoom in timeout={600} style={{ transitionDelay: `${kpi.delay}ms` }}>
                            <Box>
                              <KpiCard
                                title={kpi.title}
                                value={kpi.value}
                                helper={kpi.helper}
                                color={kpi.color}
                              />
                            </Box>
                          </Zoom>
                        </Grid>
                      ))}
                  </Grid>
                </Box>
              </Fade>

              {/* SDR Leaderboard - Top Section */}
              {sdrMatrix.length > 0 && (
                <Grow in timeout={600}>
                  <Box>
                    <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                      <Box
                        sx={{
                          width: 56,
                          height: 56,
                          borderRadius: 3,
                          bgcolor: "#f1faee",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          border: "2px solid #e63946",
                        }}
                      >
                        <EmojiEvents sx={{ fontSize: 32, color: "#e63946" }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h4" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                          🏆 SDR Leaderboard
                        </Typography>
                        <Typography variant="body1" sx={{ color: "text.secondary" }}>
                          Top performers ranked by engagement, views, and overall activity
                        </Typography>
                      </Box>
                      <Chip
                        label={`${sdrMatrix.length} SDRs Total`}
                        sx={{
                          bgcolor: "#000000",
                          color: "white",
                          fontWeight: 600,
                          fontSize: "0.875rem",
                          px: 1,
                        }}
                      />
                    </Stack>

                    {/* Top 3 Podium Cards */}
                    {sdrMatrix.length >= 3 && (
                      <Grid container spacing={3} sx={{ mb: 4 }}>
                          {[
                            { idx: 1, rank: 2 },
                            { idx: 0, rank: 1 },
                            { idx: 2, rank: 3 },
                          ].map(({ idx, rank }) => {
                            const sdr = sdrMatrix[idx];
                            const medalThemes = {
                              1: {
                                bg: "#FFF9C4",
                                border: "#FFD700",
                                icon: "#F57F17",
                                gradient: "linear-gradient(135deg, #FFF9C4 0%, #FFF59D 100%)",
                                shadow: "0 8px 24px rgba(255, 215, 0, 0.3)",
                              },
                              2: {
                                bg: "#F5F5F5",
                                border: "#C0C0C0",
                                icon: "#616161",
                                gradient: "linear-gradient(135deg, #FAFAFA 0%, #EEEEEE 100%)",
                                shadow: "0 6px 20px rgba(192, 192, 192, 0.3)",
                              },
                              3: {
                                bg: "#FFE0B2",
                                border: "#CD7F32",
                                icon: "#E65100",
                                gradient: "linear-gradient(135deg, #FFE0B2 0%, #FFCC80 100%)",
                                shadow: "0 6px 20px rgba(205, 127, 50, 0.3)",
                              },
                            };
                            const theme = medalThemes[rank];

                            return (
                              <Grid item xs={12} sm={4} key={sdr.sdr}>
                                <Card
                                  elevation={0}
                                  sx={{
                                    background: theme.gradient,
                                    border: `3px solid ${theme.border}`,
                                    borderRadius: 4,
                                    transition: "all 0.4s cubic-bezier(0.4, 0, 0.2, 1)",
                                    position: "relative",
                                    overflow: "visible",
                                    "&:hover": {
                                      transform: rank === 1 ? "scale(1.08) translateY(-8px)" : "scale(1.05) translateY(-6px)",
                                      boxShadow: theme.shadow,
                                    },
                                    "&::before": {
                                      content: '""',
                                      position: "absolute",
                                      top: -10,
                                      right: -10,
                                      width: 40,
                                      height: 40,
                                      borderRadius: "50%",
                                      bgcolor: theme.border,
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      boxShadow: 2,
                                    },
                                  }}
                                >
                                  <CardContent sx={{ textAlign: "center", p: 3, pt: 4 }}>
                                    <Box
                                      sx={{
                                        width: 64,
                                        height: 64,
                                        borderRadius: "50%",
                                        bgcolor: theme.border,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        mx: "auto",
                                        mb: 2,
                                        boxShadow: `0 4px 12px ${theme.border}40`,
                                      }}
                                    >
                                      <Typography variant="h3" sx={{ fontWeight: 900, color: "white" }}>
                                        {rank}
                                      </Typography>
                                    </Box>
                                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                                      {sdr.sdr}
                                    </Typography>
                                    <Chip
                                      label={`Score: ${Math.round(sdr.score).toLocaleString()}`}
                                      size="small"
                                      sx={{
                                        bgcolor: "rgba(0,0,0,0.08)",
                                        fontWeight: 600,
                                        fontSize: "0.75rem",
                                        mb: 2,
                                      }}
                                    />
                                    <Grid container spacing={2} sx={{ mt: 1 }}>
                                      <Grid item xs={6}>
                                        <Box
                                          sx={{
                                            bgcolor: "rgba(255,255,255,0.7)",
                                            borderRadius: 2,
                                            p: 1.5,
                                            border: "1px solid rgba(0,0,0,0.08)",
                                          }}
                                        >
                                          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mb={0.5}>
                                            <Visibility sx={{ fontSize: 16, color: theme.icon }} />
                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                                              Views
                                            </Typography>
                                          </Stack>
                                          <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                                            {sdr.views.toLocaleString()}
                                          </Typography>
                                        </Box>
                                      </Grid>
                                      <Grid item xs={6}>
                                        <Box
                                          sx={{
                                            bgcolor: "rgba(255,255,255,0.7)",
                                            borderRadius: 2,
                                            p: 1.5,
                                            border: "1px solid rgba(0,0,0,0.08)",
                                          }}
                                        >
                                          <Stack direction="row" alignItems="center" justifyContent="center" spacing={0.5} mb={0.5}>
                                            <TouchApp sx={{ fontSize: 16, color: theme.icon }} />
                                            <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
                                              Clicks
                                            </Typography>
                                          </Stack>
                                          <Typography variant="h5" sx={{ fontWeight: 700, color: "#000000" }}>
                                            {sdr.clicks.toLocaleString()}
                                          </Typography>
                                        </Box>
                                      </Grid>
                                    </Grid>
                                    <Box sx={{ mt: 2 }}>
                                      <Typography variant="caption" sx={{ color: "text.secondary", mb: 0.5, display: "block", fontWeight: 600 }}>
                                        Engagement Rate
                                      </Typography>
                                      <LinearProgress
                                        variant="determinate"
                                        value={Math.min(sdr.engagementRate, 100)}
                                        sx={{
                                          height: 10,
                                          borderRadius: 5,
                                          bgcolor: "rgba(0,0,0,0.08)",
                                          boxShadow: "inset 0 2px 4px rgba(0,0,0,0.1)",
                                          "& .MuiLinearProgress-bar": {
                                            bgcolor: theme.border,
                                            borderRadius: 5,
                                            boxShadow: `0 2px 8px ${theme.border}60`,
                                          },
                                        }}
                                      />
                                      <Typography variant="body2" sx={{ color: theme.icon, mt: 0.5, fontWeight: 700 }}>
                                        {sdr.engagementRate.toFixed(1)}%
                                      </Typography>
                                    </Box>
                                  </CardContent>
                                </Card>
                              </Grid>
                            );
                          })}
                      </Grid>
                    )}

                    {/* Full Leaderboard Table */}
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: "#FFFFFF",
                        border: "1px solid #E0E0E0",
                        borderRadius: 3,
                        overflow: "hidden",
                        transition: "all 0.3s",
                        "&:hover": {
                          boxShadow: 4,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          bgcolor: "#a8dadc",
                          p: 2,
                          borderBottom: "2px solid #457b9d",
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                          Complete Rankings
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          All SDRs sorted by performance score
                        </Typography>
                      </Box>
                      <TableContainer>
                        <Table>
                          <TableHead>
                            <TableRow
                              sx={{
                                bgcolor: "#000000",
                              }}
                            >
                              <TableCell sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>Rank</TableCell>
                              <TableCell sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>SDR Name</TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                  <Visibility fontSize="small" />
                                  Views
                                </Stack>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>
                                <Stack direction="row" spacing={0.5} justifyContent="flex-end" alignItems="center">
                                  <TouchApp fontSize="small" />
                                  Clicks
                                </Stack>
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>
                                Engagement Rate
                              </TableCell>
                              <TableCell align="right" sx={{ fontWeight: 700, color: "white", fontSize: "0.875rem", py: 2 }}>
                                Performance Score
                              </TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {sdrMatrix.slice(0, 10).map((sdr, idx) => {
                              const rank = idx + 1;
                              const isTopThree = rank <= 3;
                              const medalColors = {
                                1: "#FFD700",
                                2: "#C0C0C0",
                                3: "#CD7F32",
                              };

                              return (
                                <TableRow
                                  key={sdr.sdr}
                                  sx={{
                                    "&:hover": {
                                      bgcolor: isTopThree ? "#a8dadc" : "#F5F5F5",
                                      transform: "scale(1.01)",
                                    },
                                    transition: "all 0.3s",
                                    borderLeft: isTopThree ? `5px solid ${medalColors[rank]}` : "5px solid transparent",
                                    bgcolor: isTopThree ? "#FAFAFA" : "white",
                                  }}
                                >
                                  <TableCell sx={{ py: 2 }}>
                                    <Stack direction="row" spacing={1.5} alignItems="center">
                                      {isTopThree ? (
                                        <Avatar
                                          sx={{
                                            bgcolor: medalColors[rank],
                                            width: 40,
                                            height: 40,
                                            fontSize: "0.95rem",
                                            fontWeight: 700,
                                            color: "white",
                                            boxShadow: `0 4px 12px ${medalColors[rank]}60`,
                                          }}
                                        >
                                          {rank}
                                        </Avatar>
                                      ) : (
                                        <Box
                                          sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            bgcolor: "#F5F5F5",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                          }}
                                        >
                                          <Typography
                                            sx={{
                                              color: "text.secondary",
                                              fontWeight: 600,
                                              fontSize: "0.875rem",
                                            }}
                                          >
                                            {rank}
                                          </Typography>
                                        </Box>
                                      )}
                                    </Stack>
                                  </TableCell>
                                  <TableCell sx={{ py: 2 }}>
                                    <Typography
                                      sx={{
                                        color: "text.primary",
                                        fontWeight: isTopThree ? 700 : 500,
                                        fontSize: "0.95rem",
                                      }}
                                    >
                                      {sdr.sdr}
                                    </Typography>
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 2 }}>
                                    <Chip
                                      icon={<Visibility sx={{ fontSize: 16 }} />}
                                      label={sdr.views.toLocaleString()}
                                      size="small"
                                      sx={{
                                        bgcolor: "#a8dadc",
                                        color: "#000000",
                                        fontWeight: 600,
                                        fontSize: "0.8rem",
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 2 }}>
                                    <Chip
                                      icon={<TouchApp sx={{ fontSize: 16 }} />}
                                      label={sdr.clicks.toLocaleString()}
                                      size="small"
                                      sx={{
                                        bgcolor: "#E0F7FA",
                                        color: "#000000",
                                        fontWeight: 600,
                                        fontSize: "0.8rem",
                                      }}
                                    />
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 2 }}>
                                    <Box sx={{ minWidth: 140 }}>
                                      <Stack direction="row" alignItems="center" spacing={1} justifyContent="flex-end">
                                        <Box sx={{ flexGrow: 1 }}>
                                          <LinearProgress
                                            variant="determinate"
                                            value={Math.min(sdr.engagementRate, 100)}
                                            sx={{
                                              height: 10,
                                              borderRadius: 5,
                                              bgcolor: "#E0E0E0",
                                              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                                              "& .MuiLinearProgress-bar": {
                                                bgcolor: rank === 1 ? "#FFD700" : rank === 2 ? "#C0C0C0" : rank === 3 ? "#CD7F32" : "#4CAF50",
                                                borderRadius: 5,
                                              },
                                            }}
                                          />
                                        </Box>
                                        <Typography
                                          variant="body2"
                                          sx={{ color: "text.primary", fontWeight: 700, fontSize: "0.85rem", minWidth: 45 }}
                                        >
                                          {sdr.engagementRate.toFixed(1)}%
                                        </Typography>
                                      </Stack>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="right" sx={{ py: 2 }}>
                                    <Chip
                                      label={Math.round(sdr.score).toLocaleString()}
                                      size="medium"
                                      sx={{
                                        bgcolor: isTopThree ? "#FFF3E0" : "#F5F5F5",
                                        color: isTopThree ? "#E65100" : "text.primary",
                                        fontWeight: 700,
                                        border: isTopThree ? "2px solid #FF9800" : "1px solid #E0E0E0",
                                        fontSize: "0.85rem",
                                        px: 1.5,
                                      }}
                                    />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                      {sdrMatrix.length > 10 && (
                        <Box sx={{ p: 2, textAlign: "center", borderTop: "1px solid #E0E0E0", bgcolor: "#FAFAFA" }}>
                          <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 500 }}>
                            Showing top 10 of {sdrMatrix.length} SDRs • Ranked by performance score
                          </Typography>
                        </Box>
                      )}
                    </Card>
                  </Box>
                </Grow>
              )}

              {emailData.sdrStats?.length ? (
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
              ) : null}


              {/* Daily/Monthly Engagement Trend */}
              <Grow in timeout={800}>
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
                      bgcolor: "#a8dadc",
                      p: 2,
                      borderBottom: "2px solid #457b9d",
                    }}
                  >
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      justifyContent="space-between"
                      spacing={2}
                    >
                      <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                          📈 Engagement Trend Analysis
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          {filters.timePeriod === "week"
                            ? "Week-by-Week Performance Analysis"
                            : filters.timePeriod === "month"
                            ? "Month-by-Month Performance Analysis"
                            : "Daily Performance Analysis"}
                        </Typography>
                      </Box>
                      <Chip
                        label={`${filteredForAnalysis.length.toLocaleString()} records`}
                        sx={{
                          bgcolor: "white",
                          color: "#000000",
                          fontWeight: 600,
                          border: "1px solid #457b9d",
                        }}
                        size="medium"
                      />
                    </Stack>
                  </Box>
                  <CardContent>
                    {trendData.labels.length > 0 ? (
                      <Box
                        sx={{
                          bgcolor: "#FAFAFA",
                          borderRadius: 2,
                          p: 2,
                          border: "1px solid #E0E0E0",
                        }}
                      >
                        <Plot
                          data={[
                            {
                              type: filters.timePeriod === "day" ? "scatter" : "bar",
                              mode: filters.timePeriod === "day" ? "lines+markers" : undefined,
                              x: trendData.labels,
                              y: trendData.values,
                              marker: {
                                color: filters.timePeriod === "week" ? "#FF9800" : filters.timePeriod === "month" ? "#E91E63" : "#457b9d",
                                size: filters.timePeriod === "day" ? 8 : undefined,
                              },
                              line: filters.timePeriod === "day" ? { shape: "spline", smoothing: 0.6, width: 2, color: "#000000" } : undefined,
                              fill: filters.timePeriod === "day" ? "tonexty" : undefined,
                              fillcolor: filters.timePeriod === "day" ? "rgba(33, 150, 243, 0.1)" : undefined,
                            },
                          ]}
                          layout={{
                            height: 450,
                            autosize: true,
                            margin: { t: 30, r: 30, l: 60, b: 100 },
                            paper_bgcolor: "transparent",
                            plot_bgcolor: "#FFFFFF",
                            font: { color: "#424242", family: "Inter, system-ui, sans-serif", size: 12 },
                            xaxis: {
                              tickangle: -90,
                              showgrid: true,
                              gridcolor: "#E0E0E0",
                              tickfont: { color: "#616161", size: 10 },
                              title: { text: "Time Period", font: { color: "#424242", size: 13 } },
                            },
                            yaxis: {
                              showgrid: true,
                              gridcolor: "#E0E0E0",
                              tickfont: { color: "#616161", size: 11 },
                              title: {
                                text: filters.metric === "Views" ? "Views" : filters.metric === "Clicks" ? "Clicks" : "Count",
                                font: { color: "#424242", size: 13 },
                              },
                            },
                            hovermode: "x unified",
                            hoverlabel: {
                              bgcolor: "rgba(0,0,0,0.8)",
                              bordercolor: "#000000",
                              font: { color: "white" },
                            },
                            showlegend: false,
                          }}
                          style={{ width: "100%" }}
                          useResizeHandler
                          config={{
                            displayModeBar: true,
                            displaylogo: false,
                            modeBarButtonsToRemove: ["pan2d", "lasso2d"],
                            toImageButtonOptions: {
                              format: "png",
                              filename: "engagement-trend",
                              height: 450,
                              width: 1200,
                            },
                          }}
                        />
                      </Box>
                    ) : (
                      <Box
                        sx={{
                          height: 450,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          bgcolor: "#FAFAFA",
                          borderRadius: 2,
                          border: "1px solid #E0E0E0",
                        }}
                      >
                        <Typography variant="h6" sx={{ color: "#000000", mb: 1 }}>
                          No Data Available
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Try adjusting your filters or date range
                        </Typography>
                      </Box>
                    )}
                  </CardContent>
                </Card>
              </Grow>

              {/* Week-by-Week Analysis Section */}
              <Fade in timeout={1000}>
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
                      bgcolor: "#FFF3E0",
                      p: 2,
                      borderBottom: "2px solid #FF9800",
                    }}
                  >
                    <Stack direction="row" alignItems="center" spacing={2}>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000", flexGrow: 1 }}>
                        📅 Week-by-Week Analysis
                      </Typography>
                      <Chip
                        label="Detailed Weekly Breakdown"
                        size="small"
                        sx={{
                          bgcolor: "white",
                          color: "#000000",
                          fontWeight: 600,
                          border: "1px solid #FF9800",
                        }}
                      />
                    </Stack>
                  </Box>
                  <CardContent>
                    {(() => {
                      const weekData = buildTrend(filteredForAnalysis, filters.metric, "week", filters.dateRange);
                      return weekData.labels.length > 0 ? (
                        <Box
                          sx={{
                            bgcolor: "#FAFAFA",
                            borderRadius: 2,
                            p: 2,
                            border: "1px solid #E0E0E0",
                          }}
                        >
                          <Plot
                            data={[
                              {
                                type: "bar",
                                x: weekData.labels,
                                y: weekData.values,
                                marker: {
                                  color: "#FF9800",
                                  line: { color: "#F57C00", width: 1 },
                                },
                              },
                            ]}
                            layout={{
                              height: 400,
                              autosize: true,
                              margin: { t: 20, r: 30, l: 60, b: 120 },
                              paper_bgcolor: "transparent",
                              plot_bgcolor: "#FFFFFF",
                              font: { color: "#424242", family: "Inter, system-ui, sans-serif", size: 12 },
                              xaxis: {
                                tickangle: -45,
                                showgrid: true,
                                gridcolor: "#E0E0E0",
                                tickfont: { color: "#616161", size: 10 },
                                title: { text: "Week", font: { color: "#424242", size: 13 } },
                              },
                              yaxis: {
                                showgrid: true,
                                gridcolor: "#E0E0E0",
                                tickfont: { color: "#616161", size: 11 },
                                title: {
                                  text: filters.metric === "Views" ? "Views" : filters.metric === "Clicks" ? "Clicks" : "Count",
                                  font: { color: "#424242", size: 13 },
                                },
                              },
                              hovermode: "x unified",
                              hoverlabel: {
                                bgcolor: "rgba(0,0,0,0.8)",
                                bordercolor: "#FF9800",
                                font: { color: "white" },
                              },
                            }}
                            style={{ width: "100%" }}
                            useResizeHandler
                          />
                        </Box>
                      ) : (
                        <Box sx={{ p: 3, textAlign: "center", bgcolor: "#FAFAFA", borderRadius: 2 }}>
                          <Typography variant="body2" color="text.secondary">
                            No weekly data available
                          </Typography>
                        </Box>
                      );
                    })()}
                  </CardContent>
                </Card>
              </Fade>

              <Slide direction="up" in timeout={800}>
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
                      bgcolor: "#E0F7FA",
                      p: 2,
                      borderBottom: "2px solid #00BCD4",
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                      📊 SDR Performance Matrix
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      Detailed performance metrics for all SDRs
                    </Typography>
                  </Box>
                  <CardContent>
                    <DataTable
                      columns={[
                        { key: "sdr", label: "SDR / Owner" },
                        { key: "sends", label: "Matched Sends" },
                        { key: "views", label: "Views" },
                        { key: "clicks", label: "Clicks" },
                      ]}
                      rows={sdrMatrix}
                      emptyMessage="No SDR data available."
                    />
                  </CardContent>
                </Card>
              </Slide>


              {/* Company Engagement Analysis */}
              <Fade in timeout={1200}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        bgcolor: "#FFF3E0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #FF9800",
                      }}
                    >
                      <LocalFireDepartment sx={{ fontSize: 32, color: "#F57C00" }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                        🔥 Company Engagement Analysis
                      </Typography>
                      <Typography variant="body1" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                        📊 <strong>{companyEngagement.totalCompanies.toLocaleString()}</strong> companies analyzed •{" "}
                        <strong>{companyEngagement.highEngagementCount.toLocaleString()}</strong> high engagement accounts (Views &gt; 2×
                        Emails)
                      </Typography>
                    </Box>
                  </Stack>

                  {companyEngagement.highEngagementCompanies.length > 0 ? (
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: "#FFFFFF",
                        borderRadius: 3,
                        border: "2px solid #FF9800",
                        overflow: "hidden",
                        transition: "all 0.3s",
                        "&:hover": {
                          boxShadow: 6,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          bgcolor: "#FFF3E0",
                          p: 2,
                          borderBottom: "2px solid #FF9800",
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                          High Engagement Companies
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Companies with engagement rate &gt; 200%
                        </Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>
                        <Stack spacing={2.5}>
                          {companyEngagement.highEngagementCompanies.map((company, idx) => (
                            <Paper
                              key={company.company}
                              elevation={0}
                              sx={{
                                p: 3,
                                bgcolor: idx % 2 === 0 ? "#FAFAFA" : "#FFFFFF",
                                borderRadius: 2,
                                border: "1px solid #E0E0E0",
                                borderLeft: "4px solid #FF9800",
                                transition: "all 0.3s ease-in-out",
                                "&:hover": {
                                  bgcolor: "#FFF8E1",
                                  transform: "translateX(8px)",
                                  borderLeftColor: "#F57C00",
                                  boxShadow: "0 4px 16px rgba(255, 152, 0, 0.2)",
                                },
                              }}
                            >
                              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
                                <Box
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 2,
                                    bgcolor: "#FFF3E0",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "2px solid #FF9800",
                                    flexShrink: 0,
                                  }}
                                >
                                  <LocalFireDepartment sx={{ fontSize: 28, color: "#F57C00" }} />
                                </Box>
                                <Box sx={{ flexGrow: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} mb={1}>
                                    <Typography
                                      variant="h6"
                                      sx={{
                                        fontWeight: 700,
                                        fontSize: "1.15rem",
                                        color: "#000000",
                                      }}
                                    >
                                      {company.company}
                                    </Typography>
                                    <Chip
                                      label="HIGH"
                                      size="small"
                                      sx={{
                                        bgcolor: "#FF9800",
                                        color: "white",
                                        fontWeight: 700,
                                        fontSize: "0.7rem",
                                        height: 24,
                                      }}
                                    />
                                    <Chip
                                      label={`${company.engagementRate.toFixed(0)}%`}
                                      size="small"
                                      sx={{
                                        bgcolor: "#FFF3E0",
                                        color: "#000000",
                                        fontWeight: 700,
                                        border: "1px solid #FF9800",
                                        fontSize: "0.8rem",
                                      }}
                                    />
                                  </Stack>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      color: "text.primary",
                                      fontWeight: 500,
                                      fontSize: "0.95rem",
                                      lineHeight: 1.8,
                                    }}
                                  >
                                    📧 <strong>{company.emails}</strong> {company.emails === 1 ? "email" : "emails"} │ 👁️{" "}
                                    <strong>{company.views.toFixed(1)}</strong> views │ 🖱️ <strong>{company.clicks.toFixed(1)}</strong>{" "}
                                    clicks │ 📊 <strong>{company.engagementRate.toFixed(1)}%</strong> rate
                                  </Typography>
                                  <Box sx={{ mt: 1.5 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.min((company.engagementRate / 20) * 100, 100)}
                                      sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: "#E0E0E0",
                                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                                        "& .MuiLinearProgress-bar": {
                                          bgcolor: "#FF9800",
                                          borderRadius: 4,
                                          boxShadow: "0 2px 8px rgba(255, 152, 0, 0.4)",
                                        },
                                      }}
                                    />
                                  </Box>
                                </Box>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  ) : (
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: "#FFFFFF",
                        borderRadius: 3,
                        border: "2px solid #E0E0E0",
                      }}
                    >
                      <Box
                        sx={{
                          p: 6,
                          textAlign: "center",
                        }}
                      >
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            bgcolor: "#F5F5F5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mx: "auto",
                            mb: 2,
                          }}
                        >
                          <LocalFireDepartment sx={{ fontSize: 48, color: "#BDBDBD" }} />
                        </Box>
                        <Typography variant="h6" sx={{ color: "#000000", mb: 1, fontWeight: 600 }}>
                          No High Engagement Companies Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Companies with Views &gt; 2× Emails will appear here
                        </Typography>
                      </Box>
                    </Card>
                  )}
                </Box>
              </Fade>

              {/* High Engagement Prospects */}
              <Fade in timeout={1400}>
                <Box>
                  <Stack direction="row" alignItems="center" spacing={2} mb={3}>
                    <Box
                      sx={{
                        width: 56,
                        height: 56,
                        borderRadius: 3,
                        bgcolor: "#E3F2FD",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "2px solid #457b9d",
                      }}
                    >
                      <TrendingUp sx={{ fontSize: 32, color: "#000000" }} />
                    </Box>
                    <Box>
                      <Typography variant="h4" sx={{ fontWeight: 700, color: "#000000", mb: 0.5 }}>
                        ⭐ High Engagement Prospects
                      </Typography>
                      <Typography variant="body1" sx={{ color: "text.secondary", lineHeight: 1.6 }}>
                        📊 <strong>{highEngagementProspects.totalProspects.toLocaleString()}</strong> prospects analyzed •{" "}
                        <strong>{highEngagementProspects.highEngagementCount.toLocaleString()}</strong> high engagement prospects (Views &gt; 2×
                        Emails)
                      </Typography>
                    </Box>
                  </Stack>

                  {highEngagementProspects.highEngagementProspects.length > 0 ? (
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: "#FFFFFF",
                        borderRadius: 3,
                        border: "2px solid #457b9d",
                        overflow: "hidden",
                        transition: "all 0.3s",
                        "&:hover": {
                          boxShadow: 6,
                        },
                      }}
                    >
                      <Box
                        sx={{
                          bgcolor: "#E3F2FD",
                          p: 2,
                          borderBottom: "2px solid #457b9d",
                        }}
                      >
                        <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                          High Engagement Prospects
                        </Typography>
                        <Typography variant="caption" sx={{ color: "text.secondary" }}>
                          Prospects with engagement rate &gt; 200%
                        </Typography>
                      </Box>
                      <Box sx={{ p: 3 }}>
                        <Stack spacing={2.5}>
                          {highEngagementProspects.highEngagementProspects.map((prospect, idx) => (
                            <Paper
                              key={prospect.prospectKey}
                              elevation={0}
                              sx={{
                                p: 3,
                                bgcolor: idx % 2 === 0 ? "#FAFAFA" : "#FFFFFF",
                                borderRadius: 2,
                                border: "1px solid #E0E0E0",
                                borderLeft: "4px solid #457b9d",
                                transition: "all 0.3s ease-in-out",
                                "&:hover": {
                                  bgcolor: "#E3F2FD",
                                  transform: "translateX(8px)",
                                  borderLeftColor: "#1d3557",
                                  boxShadow: "0 4px 16px rgba(69, 123, 157, 0.2)",
                                },
                              }}
                            >
                              <Stack direction={{ xs: "column", sm: "row" }} alignItems={{ xs: "flex-start", sm: "center" }} spacing={2}>
                                <Box
                                  sx={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: 2,
                                    bgcolor: "#E3F2FD",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "2px solid #457b9d",
                                    flexShrink: 0,
                                  }}
                                >
                                  <TrendingUp sx={{ fontSize: 28, color: "#000000" }} />
                                </Box>
                                <Box sx={{ flexGrow: 1 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} mb={1} flexWrap="wrap">
                                    <Typography
                                      variant="h6"
                                      sx={{
                                        fontWeight: 700,
                                        fontSize: "1.15rem",
                                        color: "#000000",
                                      }}
                                    >
                                      {prospect.prospectName !== "N/A" ? prospect.prospectName : prospect.prospectEmail}
                                    </Typography>
                                    <Chip
                                      label="HIGH"
                                      size="small"
                                      sx={{
                                        bgcolor: "#000000",
                                        color: "white",
                                        fontWeight: 700,
                                        fontSize: "0.7rem",
                                        height: 24,
                                      }}
                                    />
                                    <Chip
                                      label={`${prospect.engagementRate.toFixed(0)}%`}
                                      size="small"
                                      sx={{
                                        bgcolor: "#E3F2FD",
                                        color: "#000000",
                                        fontWeight: 700,
                                        border: "1px solid #457b9d",
                                        fontSize: "0.8rem",
                                      }}
                                    />
                                  </Stack>
                                  <Typography
                                    variant="body2"
                                    sx={{
                                      color: "text.secondary",
                                      mb: 1,
                                      fontWeight: 500,
                                    }}
                                  >
                                    📧 {prospect.prospectEmail} {prospect.company !== "Unknown" && `• 🏢 ${prospect.company}`}
                                  </Typography>
                                  <Typography
                                    variant="body1"
                                    sx={{
                                      color: "text.primary",
                                      fontWeight: 500,
                                      fontSize: "0.95rem",
                                      lineHeight: 1.8,
                                    }}
                                  >
                                    📧 <strong>{prospect.emails}</strong> {prospect.emails === 1 ? "email" : "emails"} │ 👁️{" "}
                                    <strong>{prospect.views.toFixed(1)}</strong> views │ 🖱️ <strong>{prospect.clicks.toFixed(1)}</strong>{" "}
                                    clicks │ 📊 <strong>{prospect.engagementRate.toFixed(1)}%</strong> rate
                                  </Typography>
                                  <Box sx={{ mt: 1.5 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.min((prospect.engagementRate / 20) * 100, 100)}
                                      sx={{
                                        height: 8,
                                        borderRadius: 4,
                                        bgcolor: "#E0E0E0",
                                        boxShadow: "inset 0 1px 3px rgba(0,0,0,0.1)",
                                        "& .MuiLinearProgress-bar": {
                                          bgcolor: "#000000",
                                          borderRadius: 4,
                                          boxShadow: "0 2px 8px rgba(69, 123, 157, 0.4)",
                                        },
                                      }}
                                    />
                                  </Box>
                                </Box>
                              </Stack>
                            </Paper>
                          ))}
                        </Stack>
                      </Box>
                    </Card>
                  ) : (
                    <Card
                      elevation={2}
                      sx={{
                        bgcolor: "#FFFFFF",
                        borderRadius: 3,
                        border: "2px solid #E0E0E0",
                      }}
                    >
                      <Box
                        sx={{
                          p: 6,
                          textAlign: "center",
                        }}
                      >
                        <Box
                          sx={{
                            width: 80,
                            height: 80,
                            borderRadius: "50%",
                            bgcolor: "#F5F5F5",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            mx: "auto",
                            mb: 2,
                          }}
                        >
                          <TrendingUp sx={{ fontSize: 48, color: "#BDBDBD" }} />
                        </Box>
                        <Typography variant="h6" sx={{ color: "#000000", mb: 1, fontWeight: 600 }}>
                          No High Engagement Prospects Found
                        </Typography>
                        <Typography variant="body2" sx={{ color: "text.secondary" }}>
                          Prospects with Views &gt; 2× Emails will appear here
                        </Typography>
                      </Box>
                    </Card>
                  )}
                </Box>
              </Fade>

              <Fade in timeout={1000}>
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
                      bgcolor: "#E8F5E9",
                      p: 2,
                      borderBottom: "2px solid #4CAF50",
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#000000" }}>
                      📋 Detailed Records
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      View successful and failed email processing records
                    </Typography>
                  </Box>
                  <CardContent>
                    <Tabs
                      value={tableTab}
                      onChange={(_, value) => setTableTab(value)}
                      textColor="primary"
                      indicatorColor="primary"
                      sx={{
                        mb: 2,
                        "& .MuiTab-root": {
                          fontWeight: 700,
                          textTransform: "none",
                          fontSize: "0.95rem",
                          "&.Mui-selected": {
                            color: "#000000",
                          },
                        },
                        "& .MuiTabs-indicator": {
                          height: 3,
                          borderRadius: "3px 3px 0 0",
                        },
                      }}
                    >
                      <Tab
                        label={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <span>Successful</span>
                            <Chip
                              label={filteredSuccess.length.toLocaleString()}
                              size="small"
                              sx={{
                                bgcolor: "#E8F5E9",
                                color: "#000000",
                                fontWeight: 700,
                                height: 24,
                              }}
                            />
                          </Stack>
                        }
                      />
                      <Tab
                        label={
                          <Stack direction="row" alignItems="center" spacing={1}>
                            <span>Failed</span>
                            <Chip
                              label={filteredFailed.length.toLocaleString()}
                              size="small"
                              sx={{
                                bgcolor: filteredFailed.length > 0 ? "#FFEBEE" : "#F5F5F5",
                                color: filteredFailed.length > 0 ? "#C62828" : "text.secondary",
                                fontWeight: 700,
                                height: 24,
                              }}
                            />
                          </Stack>
                        }
                      />
                    </Tabs>
                    <Box mt={2}>
                      {tableTab === 0 ? (
                        <DataTable
                          columns={[
                            { key: "recipient_name", label: "Recipient" },
                            { key: "Recipient Email", label: "Recipient Email" },
                            { key: "Company", label: "Company" },
                            { key: "Views", label: "Views" },
                            { key: "Clicks", label: "Clicks" },
                          ]}
                          rows={filteredSuccess}
                          emptyMessage="No successful records match your filters."
                        />
                      ) : (
                        <DataTable
                          columns={[
                            { key: "recipient_name", label: "Recipient" },
                            { key: "Recipient Email", label: "Recipient Email" },
                            { key: "failure_reason", label: "Failure Reason" },
                          ]}
                          rows={filteredFailed}
                          emptyMessage="No failed records."
                        />
                      )}
                    </Box>
                  </CardContent>
                </Card>
              </Fade>
            </Stack>
          ) : (
            <Card
              elevation={2}
              sx={{
                minHeight: 480,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#FAFAFA",
                border: "2px dashed #E0E0E0",
                borderRadius: 3,
              }}
            >
              <CardContent sx={{ textAlign: "center", p: 6 }}>
                <Box
                  sx={{
                    width: 100,
                    height: 100,
                    borderRadius: "50%",
                    bgcolor: "#a8dadc",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    mx: "auto",
                    mb: 3,
                    border: "3px solid #457b9d",
                  }}
                >
                  <Typography variant="h2" sx={{ color: "#000000" }}>
                    📊
                  </Typography>
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: "#000000", mb: 2 }}>
                  Get Started with Email Analytics
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 500, mx: "auto", mb: 3 }}>
                  Upload your SDR Send, Open, and Contacts CSV files using the panel on the left, or load demo data to see the
                  dashboard in action.
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Chip label="📧 Send CSV" sx={{ bgcolor: "#a8dadc", color: "#000000", fontWeight: 600 }} />
                  <Chip label="👁️ Open CSV" sx={{ bgcolor: "#E0F7FA", color: "#000000", fontWeight: 600 }} />
                  <Chip label="👥 Contacts CSV" sx={{ bgcolor: "#E8F5E9", color: "#000000", fontWeight: 600 }} />
                </Stack>
              </CardContent>
            </Card>
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
        totalRecords: 0,
      });
    }
    const agg = map.get(key);
    agg.sends += 1;
    agg.totalRecords += 1;
    agg.views += Number(row.Views) || 0;
    agg.clicks += Number(row.Clicks) || 0;
    if (Number(row.Views) >= 5) {
      agg.highEngagement += 1;
    }
  });

  const results = [...map.values()].map((item) => {
    const engagementRate = item.sends > 0 ? (item.views / item.sends) * 100 : 0;
    const clickRate = item.views > 0 ? (item.clicks / item.views) * 100 : 0;
    const highEngagementRate = item.sends > 0 ? (item.highEngagement / item.sends) * 100 : 0;
    
    // Calculate score for ranking (weighted combination)
    const score = 
      item.views * 0.4 + 
      item.clicks * 0.3 + 
      item.highEngagement * 0.2 + 
      engagementRate * 0.1;

    return {
      ...item,
      engagementRate,
      clickRate,
      highEngagementRate,
      score,
    };
  });

  return results.sort((a, b) => b.score - a.score);
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


