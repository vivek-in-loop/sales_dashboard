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
} from "@mui/material";
import {
  Email,
  AccountCircle,
  CloudDownload,
  Download as DownloadIcon,
} from "@mui/icons-material";
import {
  initGmailAPI,
  isSignedIn,
  signIn,
  signOut,
  getCurrentUserEmail,
  fetchGmailDataAsCSV,
} from "../utils/gmailApi";

function GmailIntegration({ onDataFetched, dateRange }) {
  const [gmailSignedIn, setGmailSignedIn] = useState(false);
  const [gmailUserEmail, setGmailUserEmail] = useState(null);
  const [gmailLoading, setGmailLoading] = useState(false);
  const [gmailFetching, setGmailFetching] = useState(false);
  const [fetchedCsvData, setFetchedCsvData] = useState(null);
  const [error, setError] = useState("");

  // Initialize Gmail API
  useEffect(() => {
    const initializeGmail = () => {
      const apiKey = process.env.REACT_APP_GOOGLE_API_KEY || "";

      if (!apiKey) {
        console.warn("Google API key not configured. Set REACT_APP_GOOGLE_API_KEY in .env file");
        return;
      }

      if (window.gapi) {
        initGmailAPI(apiKey, () => {
          if (isSignedIn()) {
            setGmailSignedIn(true);
            setGmailUserEmail(getCurrentUserEmail());
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
      setGmailSignedIn(true);
      setGmailUserEmail(getCurrentUserEmail());
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
    setGmailSignedIn(false);
    setGmailUserEmail(null);
    setFetchedCsvData(null);
  };

  // Fetch Gmail data and convert to CSV
  const handleFetchGmailData = async () => {
    if (!gmailSignedIn) {
      setError("Please sign in with Google first");
      return;
    }

    try {
      setGmailFetching(true);
      setError("");

      // Get date range from props or use default (last 30 days)
      const endDate = dateRange?.end || new Date();
      const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const csvData = await fetchGmailDataAsCSV({ startDate, endDate });
      setFetchedCsvData(csvData);

      // Create a File object from the CSV string
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const file = new File([blob], `gmail-sent-emails-${Date.now()}.csv`, { type: "text/csv" });

      // Call the callback to notify parent component
      if (onDataFetched) {
        onDataFetched(file);
      }
    } catch (error) {
      console.error("Error fetching Gmail data:", error);
      setError(`Failed to fetch Gmail data: ${error.message || "Unknown error"}`);
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

            <Button
              variant="contained"
              fullWidth
              size="large"
              startIcon={<CloudDownload />}
              onClick={handleFetchGmailData}
              disabled={gmailFetching}
              sx={{
                bgcolor: "#34A853",
                color: "white",
                fontWeight: 600,
                py: 1.5,
                "&:hover": {
                  bgcolor: "#2E8B47",
                },
              }}
            >
              {gmailFetching ? "Fetching emails..." : "Fetch Sent Emails from Gmail"}
            </Button>

            {gmailFetching && <LinearProgress sx={{ mt: 1 }} />}

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
                  {fetchedCsvData.split("\n").length - 1} emails found (excluding header)
                </Typography>
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
              </Box>
            )}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}

export default GmailIntegration;

