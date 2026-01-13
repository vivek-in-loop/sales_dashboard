import React, { useState, useEffect } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack,
  Typography,
  TextField,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Collapse,
  IconButton,
} from "@mui/material";
import {
  Email,
  AccountCircle,
  CloudDownload,
  Download as DownloadIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import Papa from "papaparse";
import {
  initGmailAPI,
  isSignedIn,
  signIn,
  signOut,
  getCurrentUserEmail,
  fetchGmailDataAsCSV,
  fetchUserEmail,
} from "../utils/gmailApi";

function GmailIntegration({ onDataFetched, dateRange }) {
  const [gmailSignedIn, setGmailSignedIn] = useState(false);
  const [gmailUserEmail, setGmailUserEmail] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailFetching, setGmailFetching] = useState(false);
  const [fetchedCsvData, setFetchedCsvData] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState("");
  const [fetchProgress, setFetchProgress] = useState({ current: 0, total: 0, message: "" });
  
  // Date range state - default to last 30 days
  const getDefaultStartDate = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date;
  };
  
  const [startDate, setStartDate] = useState(() => {
    if (dateRange?.start) {
      return dateRange.start;
    }
    return getDefaultStartDate();
  });
  
  const [endDate, setEndDate] = useState(() => {
    if (dateRange?.end) {
      return dateRange.end;
    }
    return new Date();
  });

  // Check shared sign-in state periodically
  useEffect(() => {
    const checkSignInStatus = () => {
      if (isSignedIn()) {
        setGmailSignedIn(true);
        setGmailUserEmail(getCurrentUserEmail());
      } else {
        setGmailSignedIn(false);
        setGmailUserEmail(null);
      }
    };

    // Check immediately
    checkSignInStatus();

    // Check periodically to sync with other components
    const interval = setInterval(checkSignInStatus, 1000);

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
          if (isSignedIn()) {
            setGmailSignedIn(true);
            let email = getCurrentUserEmail();
            
            // If email is "Unknown", try to fetch it
            if (!email || email === 'Unknown') {
              try {
                email = await fetchUserEmail();
              } catch (error) {
                console.warn('Could not fetch user email:', error);
                email = getCurrentUserEmail(); // Use whatever we have
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

  // Handle Gmail sign in
  const handleGmailSignIn = async () => {
    try {
      setGmailLoading(true);
      setError("");

      const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID || "";
      if (!clientId) {
        setError("Google Client ID not configured. Please set REACT_APP_GOOGLE_CLIENT_ID in .env file");
        return;
      }

      if (!window.google || !window.google.accounts) {
        setError("Google Identity Services not loaded. Please refresh the page.");
        return;
      }

      await signIn(clientId);
      
      // Try to fetch email if it's still Unknown
      let email = getCurrentUserEmail();
      if (!email || email === 'Unknown') {
        try {
          email = await fetchUserEmail();
        } catch (error) {
          console.warn('Could not fetch user email after sign in:', error);
        }
      }
      
      // State will be updated by the checkSignInStatus effect
    } catch (error) {
      console.error("Gmail sign-in error:", error);
      setError(`Failed to sign in with Google: ${error.message || "Unknown error"}`);
    } finally {
      setGmailLoading(false);
    }
  };

  // Handle Gmail sign out
  const handleGmailSignOut = () => {
    signOut();
    // State will be updated by the checkSignInStatus effect
    setFetchedCsvData(null);
    setTableData([]);
    setTableHeaders([]);
    setShowTable(false);
  };

  // Fetch Gmail data and convert to CSV
  const handleFetchGmailData = async () => {
    if (!gmailSignedIn) {
      setError("Please sign in with Google first");
      return;
    }

    // Validate date range
    if (!startDate || !endDate) {
      setError("Please select both start and end dates");
      return;
    }

    if (startDate > endDate) {
      setError("Start date must be before end date");
      return;
    }

    // Validate dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      setError("Invalid date selected");
      return;
    }

    try {
      setGmailFetching(true);
      setError("");
      setFetchedCsvData(null);
      setTableData([]);
      setTableHeaders([]);

      // Progress callback for user feedback
      const progressCallback = (current, total, message) => {
        setFetchProgress({
          current: current || 0,
          total: total || 0,
          message: message || ""
        });
        console.log(`Progress: ${current || 0}/${total || '?'} - ${message || ''}`);
      };

      const csvData = await fetchGmailDataAsCSV({ 
        startDate, 
        endDate,
        onProgress: progressCallback
      });
      
      if (!csvData || csvData.trim().length === 0) {
        throw new Error('No email data retrieved');
      }
      
      setFetchedCsvData(csvData);

      // Parse CSV data for table view
      Papa.parse(csvData, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.data && results.data.length > 0) {
            setTableHeaders(Object.keys(results.data[0]));
            setTableData(results.data);
            setShowTable(true);
          } else {
            setError("No email data found in the fetched results");
            setFetchedCsvData(null);
          }
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
          setError(`Failed to parse email data: ${error.message || "Unknown error"}`);
          setFetchedCsvData(null);
        },
      });

      // Create a File object from the CSV string
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], `gmail-sent-emails-${Date.now()}.csv`, { type: "text/csv" });

      // Call the callback to notify parent component
      if (onDataFetched) {
        onDataFetched(file);
      }
    } catch (error) {
      console.error("Error fetching Gmail data:", error);
      
      // Provide user-friendly error messages
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
      
      setError(errorMessage);
      setFetchedCsvData(null);
      setTableData([]);
      setTableHeaders([]);
      setFetchProgress({ current: 0, total: 0, message: "" });
    } finally {
      setGmailFetching(false);
    }
  };

  // Download CSV data
  const handleDownloadCsv = () => {
    if (!fetchedCsvData) return;

    const blob = new Blob([fetchedCsvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gmail-sent-emails-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      elevation={2}
      sx={{
        borderRadius: 3,
        border: "2px solid #4285F4",
        overflow: "hidden",
        bgcolor: "white",
      }}
    >
      <Box
        sx={{
          bgcolor: "#4285F4",
          p: 2,
          color: "white",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <Email /> Gmail Integration
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
          Connect your Gmail account to automatically fetch sent emails
        </Typography>
      </Box>
      <CardContent sx={{ p: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {!gmailSignedIn ? (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                Sign in with Google to fetch your sent emails directly from Gmail. This will automatically populate your Send CSV data.
              </Typography>
            </Alert>
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<AccountCircle />}
              onClick={handleGmailSignIn}
              disabled={gmailLoading}
              sx={{
                bgcolor: "#4285F4",
                color: "white",
                fontWeight: 600,
                py: 1.5,
                "&:hover": {
                  bgcolor: "#357AE8",
                },
              }}
            >
              {gmailLoading ? "Signing in..." : "Sign in with Google"}
            </Button>
          </Stack>
        ) : (
          <Stack spacing={2}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                p: 2,
                bgcolor: "#f5f5f5",
                borderRadius: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <AccountCircle sx={{ color: "#4285F4", fontSize: 32 }} />
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {gmailUserEmail}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Connected to Gmail
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleGmailSignOut}
                sx={{ borderColor: "#4285F4", color: "#4285F4" }}
              >
                Sign Out
              </Button>
            </Box>

            {/* Date Range Selection */}
            <Box
              sx={{
                p: 2,
                bgcolor: "#f9f9f9",
                borderRadius: 2,
                border: "1px solid #E0E0E0",
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 2, color: "#616161" }}>
                📅 Select Date Range
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="Start Date"
                    value={startDate ? startDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setStartDate(date);
                      setError("");
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E0E0E0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#4285F4",
                      },
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    label="End Date"
                    value={endDate ? endDate.toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const date = e.target.value ? new Date(e.target.value) : null;
                      setEndDate(date);
                      setError("");
                    }}
                    InputLabelProps={{ shrink: true }}
                    sx={{
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#E0E0E0",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "#4285F4",
                      },
                    }}
                  />
                </Grid>
              </Grid>
              <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                Emails will be fetched for the selected date range
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<CloudDownload />}
              onClick={handleFetchGmailData}
              disabled={gmailFetching || !startDate || !endDate}
              sx={{
                bgcolor: "#34A853",
                color: "white",
                fontWeight: 600,
                py: 1.5,
                "&:hover": {
                  bgcolor: "#2E8B47",
                },
                "&:disabled": {
                  bgcolor: "#cccccc",
                },
              }}
            >
              {gmailFetching ? "Fetching emails..." : "Fetch Sent Emails from Gmail"}
            </Button>

            {gmailFetching && (
              <Box sx={{ mt: 1 }}>
                <LinearProgress 
                  variant={fetchProgress.total > 0 ? "determinate" : "indeterminate"}
                  value={fetchProgress.total > 0 ? (fetchProgress.current / fetchProgress.total) * 100 : 0}
                  sx={{ mb: 1 }}
                />
                {fetchProgress.message && (
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mt: 0.5 }}>
                    {fetchProgress.message}
                    {fetchProgress.total > 0 && ` (${fetchProgress.current}/${fetchProgress.total})`}
                  </Typography>
                )}
                {fetchProgress.total > 1000 && (
                  <Alert severity="info" sx={{ mt: 1, fontSize: "0.75rem" }}>
                    Large dataset detected. This may take several minutes. Please keep this window open.
                  </Alert>
                )}
              </Box>
            )}

            {fetchedCsvData && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#e8f5e9",
                  borderRadius: 2,
                  border: "1px solid #4CAF50",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "#2E7D32" }}>
                  ✓ Email data fetched successfully!
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
                  {tableData.length} emails found
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadCsv}
                    sx={{
                      borderColor: "#4CAF50",
                      color: "#2E7D32",
                      fontWeight: 600,
                      "&:hover": {
                        borderColor: "#2E7D32",
                        bgcolor: "rgba(46, 125, 50, 0.1)",
                      },
                    }}
                  >
                    Download CSV
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={() => setShowTable(!showTable)}
                    startIcon={showTable ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    sx={{
                      borderColor: "#4CAF50",
                      color: "#2E7D32",
                      minWidth: 120,
                    }}
                  >
                    {showTable ? "Hide" : "View"} Table
                  </Button>
                </Stack>
                
                {/* Table View */}
                <Collapse in={showTable}>
                  <TableContainer
                    component={Paper}
                    sx={{
                      maxHeight: 400,
                      mt: 2,
                      border: "1px solid #E0E0E0",
                      borderRadius: 1,
                    }}
                  >
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow>
                          {tableHeaders.map((header) => (
                            <TableCell
                              key={header}
                              sx={{
                                bgcolor: "#f5f5f5",
                                fontWeight: 600,
                                fontSize: "0.75rem",
                              }}
                            >
                              {header}
                            </TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tableData.slice(0, 100).map((row, idx) => (
                          <TableRow key={idx} hover>
                            {tableHeaders.map((header) => (
                              <TableCell
                                key={header}
                                sx={{
                                  fontSize: "0.75rem",
                                  maxWidth: 200,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                                title={row[header]}
                              >
                                {row[header] || "-"}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  {tableData.length > 100 && (
                    <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                      Showing first 100 of {tableData.length} records. Download CSV to see all.
                    </Typography>
                  )}
                </Collapse>
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default GmailIntegration;

