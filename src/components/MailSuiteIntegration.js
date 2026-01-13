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
  Visibility,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from "@mui/icons-material";
import Papa from "papaparse";
import { fetchMailSuiteDataAsCSV } from "../utils/mailSuiteApi";

function MailSuiteIntegration({ onDataFetched, dateRange }) {
  const [mailSuiteUsername, setMailSuiteUsername] = useState("");
  const [mailSuitePassword, setMailSuitePassword] = useState("");
  const [mailSuiteAuthenticated, setMailSuiteAuthenticated] = useState(false);
  const [mailSuiteLoading, setMailSuiteLoading] = useState(false);
  const [mailSuiteFetching, setMailSuiteFetching] = useState(false);
  const [fetchedCsvData, setFetchedCsvData] = useState(null);
  const [tableData, setTableData] = useState([]);
  const [tableHeaders, setTableHeaders] = useState([]);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState("");
  
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

  // Handle MailSuite Pro authentication
  const handleMailSuiteAuthenticate = async () => {
    if (!mailSuiteUsername || !mailSuitePassword) {
      setError("Please enter both username and password");
      return;
    }

    try {
      setMailSuiteLoading(true);
      setError("");

      // Test authentication by trying to fetch a small date range
      // If successful, mark as authenticated
      const testEndDate = new Date();
      const testStartDate = new Date();
      testStartDate.setDate(testStartDate.getDate() - 1);

      await fetchMailSuiteDataAsCSV({
        startDate: testStartDate,
        endDate: testEndDate,
        username: mailSuiteUsername,
        password: mailSuitePassword,
      });

      // If we get here, authentication was successful
      setMailSuiteAuthenticated(true);
    } catch (error) {
      console.error("MailSuite authentication error:", error);
      setError(error.message || "Authentication failed. Please check your credentials.");
      setMailSuiteAuthenticated(false);
    } finally {
      setMailSuiteLoading(false);
    }
  };

  // Handle MailSuite sign out
  const handleMailSuiteSignOut = () => {
    setMailSuiteAuthenticated(false);
    setMailSuitePassword(""); // Clear password for security
    setFetchedCsvData(null);
    setTableData([]);
    setTableHeaders([]);
    setShowTable(false);
    setError("");
  };

  // Fetch MailSuite data and convert to CSV
  const handleFetchMailSuiteData = async () => {
    if (!mailSuiteAuthenticated || !mailSuiteUsername || !mailSuitePassword) {
      setError("Please authenticate with MailSuite Pro first");
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

    try {
      setMailSuiteFetching(true);
      setError("");

      const csvData = await fetchMailSuiteDataAsCSV({
        startDate,
        endDate,
        username: mailSuiteUsername,
        password: mailSuitePassword,
      });
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
          }
        },
        error: (error) => {
          console.error("Error parsing CSV:", error);
        },
      });

      // Create a File object from the CSV string
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], `mailsuite-opens-${Date.now()}.csv`, { type: "text/csv" });

      // Call the callback to notify parent component
      if (onDataFetched) {
        onDataFetched(file);
      }
    } catch (error) {
      console.error("Error fetching MailSuite data:", error);
      setError(`Failed to fetch MailSuite data: ${error.message || "Unknown error"}`);
    } finally {
      setMailSuiteFetching(false);
    }
  };

  // Download CSV data
  const handleDownloadCsv = () => {
    if (!fetchedCsvData) return;

    const blob = new Blob([fetchedCsvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `mailsuite-opens-${new Date().toISOString().split("T")[0]}.csv`;
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
        border: "2px solid #9C27B0",
        overflow: "hidden",
        bgcolor: "white",
      }}
    >
      <Box
        sx={{
          bgcolor: "#9C27B0",
          p: 2,
          color: "white",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 1 }}>
          <Visibility /> MailSuite Pro Integration
        </Typography>
        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.9)" }}>
          Authenticate with your MailSuite Pro credentials to fetch tracking data (opens & clicks).
        </Typography>
      </Box>
      <CardContent sx={{ p: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            {error}
          </Alert>
        )}

        {!mailSuiteAuthenticated ? (
          <Stack spacing={2}>
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              <Typography variant="body2">
                <strong>MailSuite Pro Authentication Required</strong><br />
                Enter your MailSuite Pro username (email) and password to access tracking data.
                MailSuite Pro uses its own authentication system, separate from Google OAuth.
              </Typography>
            </Alert>
            
            <TextField
              fullWidth
              label="MailSuite Pro Username (Email)"
              type="email"
              value={mailSuiteUsername}
              onChange={(e) => {
                setMailSuiteUsername(e.target.value);
                setError("");
              }}
              placeholder="your-email@example.com"
              sx={{
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#E0E0E0",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#9C27B0",
                },
              }}
            />
            
            <TextField
              fullWidth
              label="MailSuite Pro Password"
              type="password"
              value={mailSuitePassword}
              onChange={(e) => {
                setMailSuitePassword(e.target.value);
                setError("");
              }}
              placeholder="Enter your password"
              sx={{
                "& .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#E0E0E0",
                },
                "&:hover .MuiOutlinedInput-notchedOutline": {
                  borderColor: "#9C27B0",
                },
              }}
            />
            
            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<AccountCircle />}
              onClick={handleMailSuiteAuthenticate}
              disabled={mailSuiteLoading || !mailSuiteUsername || !mailSuitePassword}
              sx={{
                bgcolor: "#9C27B0",
                color: "white",
                fontWeight: 600,
                py: 1.5,
                "&:hover": {
                  bgcolor: "#7B1FA2",
                },
                "&:disabled": {
                  bgcolor: "#cccccc",
                },
              }}
            >
              {mailSuiteLoading ? "Authenticating..." : "Authenticate with MailSuite Pro"}
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
                <AccountCircle sx={{ color: "#9C27B0", fontSize: 32 }} />
                <Box>
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    {mailSuiteUsername}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    Authenticated with MailSuite Pro
                  </Typography>
                </Box>
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={handleMailSuiteSignOut}
                sx={{ borderColor: "#9C27B0", color: "#9C27B0" }}
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
                        borderColor: "#9C27B0",
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
                        borderColor: "#9C27B0",
                      },
                    }}
                  />
                </Grid>
              </Grid>
              <Typography variant="caption" sx={{ color: "text.secondary", mt: 1, display: "block" }}>
                Tracking data (opens & clicks) will be fetched for the selected date range
              </Typography>
            </Box>

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<CloudDownload />}
              onClick={handleFetchMailSuiteData}
              disabled={mailSuiteFetching || !startDate || !endDate}
              sx={{
                bgcolor: "#9C27B0",
                color: "white",
                fontWeight: 600,
                py: 1.5,
                "&:hover": {
                  bgcolor: "#7B1FA2",
                },
                "&:disabled": {
                  bgcolor: "#cccccc",
                },
              }}
            >
              {mailSuiteFetching ? "Fetching tracking data..." : "Fetch Opens & Clicks from MailSuite"}
            </Button>

            {mailSuiteFetching && <LinearProgress sx={{ mt: 1 }} />}

            {fetchedCsvData && (
              <Box
                sx={{
                  p: 2,
                  bgcolor: "#f3e5f5",
                  borderRadius: 2,
                  border: "1px solid #9C27B0",
                }}
              >
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, color: "#7B1FA2" }}>
                  ✓ Tracking data fetched successfully!
                </Typography>
                <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 2 }}>
                  {tableData.length} records found
                </Typography>
                <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
                  <Button
                    variant="outlined"
                    fullWidth
                    startIcon={<DownloadIcon />}
                    onClick={handleDownloadCsv}
                    sx={{
                      borderColor: "#9C27B0",
                      color: "#7B1FA2",
                      fontWeight: 600,
                      "&:hover": {
                        borderColor: "#7B1FA2",
                        bgcolor: "rgba(156, 39, 176, 0.1)",
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
                      borderColor: "#9C27B0",
                      color: "#7B1FA2",
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

export default MailSuiteIntegration;

