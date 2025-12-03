import React, { useMemo, useState } from "react";
import {
  Alert,
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
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  Zoom,
} from "@mui/material";
import {
  Phone as PhoneIcon,
  Upload as UploadIcon,
  Settings as SettingsIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  TrendingUp,
} from "@mui/icons-material";
import Plot from "react-plotly.js";
import UploadCard from "../components/UploadCard";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import { useDataContext } from "../context/DataContext";
import { validateCallsHeaders } from "../utils/csvValidation";
import {
  callsPerDay,
  filterCalls,
  processCallsCsv,
} from "../utils/callsProcessor";
import demoCallsData from "../demo/callsDemo.json";

const callsTemplate =
  "Assigned,Call Disposition,Date,Company / Account,Contact,Call Duration,Notes\nCasey SDR,Connected,2025-07-05T15:40:00Z,Acme Corp,Alex Rivera,420,Great conversation";

function CallsAnalyticsPage() {
  const { callsData, setCallsData } = useDataContext();

  const [mode, setMode] = useState("upload");
  const [callFile, setCallFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [filters, setFilters] = useState({
    assigned: "",
    disposition: "",
    company: "",
  });

  const hasData = Boolean(callsData?.rows?.length);
  const canProcess = mode === "upload" && !!callFile && !loading;

  const filteredRows = useMemo(() => {
    if (!hasData) return [];
    return filterCalls(callsData.rows, filters);
  }, [callsData, filters, hasData]);

  const chartData = useMemo(
    () => callsPerDay(filteredRows),
    [filteredRows]
  );

  const handleProcess = async () => {
    if (!canProcess) return;
    setLoading(true);
    setError("");
    try {
      const text = await callFile.text();
      validateCallsHeaders(text);
      const result = await processCallsCsv(text);
      setCallsData(result);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error(e);
      setError(e.message || "Failed to process calls file");
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDemo = () => {
    setCallsData(demoCallsData);
    setMode("demo");
    setError("");
  };

  const handleDownloadTemplate = () => {
    const blob = new Blob([callsTemplate], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "calls_template.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const stats = callsData?.stats || {};

  // Get unique values for filter dropdowns
  const uniqueAssigned = useMemo(() => {
    if (!hasData) return [];
    return Array.from(new Set(callsData.rows.map((r) => r.Assigned).filter(Boolean))).sort();
  }, [callsData, hasData]);

  const uniqueDispositions = useMemo(() => {
    if (!hasData) return [];
    return Array.from(
      new Set(callsData.rows.map((r) => r["Call Disposition"]).filter(Boolean))
    ).sort();
  }, [callsData, hasData]);

  const uniqueCompanies = useMemo(() => {
    if (!hasData) return [];
    return Array.from(
      new Set(callsData.rows.map((r) => r["Company / Account"]).filter(Boolean))
    ).sort();
  }, [callsData, hasData]);

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f1faee",
        backgroundImage:
          "radial-gradient(circle at 20% 50%, rgba(69, 123, 157, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(168, 218, 220, 0.05) 0%, transparent 50%)",
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
                  📞 Calls Analytics Dashboard
                </Typography>
                <Typography variant="h6" sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 400 }}>
                  Monitor SDR calling activity, dispositions, and connect rates
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
                  Upload Calls CSV or configure data source
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
                    bgcolor: "#457b9d",
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
                          bgcolor: "#457b9d",
                          color: "white",
                          "&:hover": {
                            bgcolor: "#1d3557",
                          },
                        },
                      },
                    }}
                  >
                    <ToggleButton value="upload">📤 Upload Calls CSV</ToggleButton>
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
                      Demo calls loaded. Switch back to &quot;Upload Calls CSV&quot; to process your own file.
                    </Alert>
                  )}
                </CardContent>
              </Card>

              {mode === "upload" && (
                <>
                  <UploadCard
                    label="Calls CSV"
                    fileName={callFile?.name}
                    status={callFile ? "Ready" : "Pending"}
                    description="Requires Assigned, Call Disposition, Date, Company / Account, Contact, Call Duration."
                    onFileChange={setCallFile}
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
                      {loading ? "⏳ Processing…" : "🚀 Process Calls File"}
                    </Button>
                  </Card>
                  {error && (
                    <Alert severity="error" variant="outlined" sx={{ borderRadius: 2 }}>
                      {error}
                    </Alert>
                  )}
                  <Button
                    variant="outlined"
                    fullWidth
                    onClick={handleDownloadTemplate}
                    sx={{
                      borderColor: "#457b9d",
                      color: "#457b9d",
                      fontWeight: 600,
                      "&:hover": {
                        borderColor: "#1d3557",
                        bgcolor: "rgba(69, 123, 157, 0.1)",
                      },
                    }}
                  >
                    📥 Download Calls Template
                  </Button>
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
              onClick={() => setModalOpen(false)}
              variant="contained"
              size="large"
              sx={{ fontWeight: 600, bgcolor: "#457b9d" }}
            >
              Done
            </Button>
          </DialogActions>
        </Dialog>

        {/* Main Content */}
        <Box>
          {hasData ? (
            <Stack spacing={4}>
              {/* Filters Section */}
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
                        <FilterIcon sx={{ fontSize: 28, color: "#457b9d" }} />
                      </Box>
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="h5" sx={{ fontWeight: 700, color: "#1d3557", mb: 0.5 }}>
                          Filters & Search
                        </Typography>
                        <Typography variant="body2" sx={{ color: "#1d3557" }}>
                          Filter calls by assigned SDR, disposition, or company
                        </Typography>
                      </Box>
                      <Chip
                        label={`${filteredRows.length.toLocaleString()} calls`}
                        sx={{
                          bgcolor: "white",
                          color: "#457b9d",
                          fontWeight: 600,
                          border: "1px solid #457b9d",
                        }}
                        size="medium"
                      />
                    </Stack>
                    <Grid container spacing={2.5}>
                      <Grid item xs={12} md={4}>
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
                            👤 Assigned SDR
                          </Typography>
                          <FormControl fullWidth size="small">
                            <Select
                              value={filters.assigned}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, assigned: e.target.value }))
                              }
                              displayEmpty
                              sx={{
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#E0E0E0",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#457b9d",
                                },
                              }}
                            >
                              <MenuItem value="">🌐 All SDRs</MenuItem>
                              {uniqueAssigned.map((sdr) => (
                                <MenuItem key={sdr} value={sdr}>
                                  👤 {sdr}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
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
                            📞 Disposition
                          </Typography>
                          <FormControl fullWidth size="small">
                            <Select
                              value={filters.disposition}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, disposition: e.target.value }))
                              }
                              displayEmpty
                              sx={{
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#E0E0E0",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#457b9d",
                                },
                              }}
                            >
                              <MenuItem value="">🌐 All Dispositions</MenuItem>
                              {uniqueDispositions.map((disp) => (
                                <MenuItem key={disp} value={disp}>
                                  {disp}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Box>
                      </Grid>
                      <Grid item xs={12} md={4}>
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
                            🏢 Company
                          </Typography>
                          <FormControl fullWidth size="small">
                            <Select
                              value={filters.company}
                              onChange={(e) =>
                                setFilters((prev) => ({ ...prev, company: e.target.value }))
                              }
                              displayEmpty
                              sx={{
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#E0E0E0",
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: "#457b9d",
                                },
                              }}
                            >
                              <MenuItem value="">🌐 All Companies</MenuItem>
                              {uniqueCompanies.slice(0, 50).map((company) => (
                                <MenuItem key={company} value={company}>
                                  🏢 {company}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
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
                          <Button
                            fullWidth
                            variant="contained"
                            size="medium"
                            onClick={() =>
                              setFilters({
                                assigned: "",
                                disposition: "",
                                company: "",
                              })
                            }
                            sx={{
                              height: 40,
                              fontWeight: 600,
                              bgcolor: "#457b9d",
                              boxShadow: "0 4px 12px rgba(69, 123, 157, 0.3)",
                              "&:hover": {
                                bgcolor: "#1d3557",
                                boxShadow: "0 6px 16px rgba(69, 123, 157, 0.4)",
                                transform: "translateY(-2px)",
                              },
                              transition: "all 0.2s",
                            }}
                          >
                            🔄 Reset All Filters
                          </Button>
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
                      color: "#1d3557",
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
                        title: "Total Calls",
                        value: (stats.totalCalls || 0).toLocaleString(),
                        helper: "All call records",
                        delay: 0,
                        color: "primary",
                      },
                      {
                        title: "Unique Companies",
                        value: (stats.uniqueCompanies || 0).toLocaleString(),
                        helper: "Companies contacted",
                        delay: 100,
                        color: "primary",
                      },
                      {
                        title: "Connect Rate",
                        value: `${(stats.connectRate || 0).toFixed(1)}%`,
                        helper: "Connected calls",
                        delay: 200,
                        color: "success",
                      },
                      {
                        title: "Duration (hrs)",
                        value: (stats.durationHours || 0).toFixed(2),
                        helper: "Total call time",
                        delay: 300,
                        color: "info",
                      },
                      {
                        title: "Unique Contacts",
                        value: (stats.uniqueContacts || 0).toLocaleString(),
                        helper: "Contacts reached",
                        delay: 400,
                        color: "primary",
                      },
                      {
                        title: "Top Disposition",
                        value: stats.topDisposition || "N/A",
                        helper: "Most common",
                        delay: 500,
                        color: "info",
                      },
                      {
                        title: "Disposition Types",
                        value: (stats.dispositionTypes || 0).toLocaleString(),
                        helper: "Unique dispositions",
                        delay: 600,
                        color: "info",
                      },
                      {
                        title: "Daily Avg",
                        value: (stats.dailyAvg || 0).toFixed(1),
                        helper: "Calls per day",
                        delay: 700,
                        color: "info",
                      },
                    ].map((kpi, idx) => (
                      <Grid item xs={12} sm={6} md={4} lg={3} key={kpi.title}>
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

              {/* Calls Trend Chart */}
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
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#1d3557", mb: 0.5 }}>
                      📈 Calls Trend Analysis
                    </Typography>
                    <Typography variant="caption" sx={{ color: "#1d3557" }}>
                      Daily call volume over time
                    </Typography>
                  </Box>
                  <CardContent>
                    <Plot
                      data={[
                        {
                          type: "bar",
                          x: chartData.labels,
                          y: chartData.values,
                          marker: {
                            color: "#457b9d",
                            line: { color: "#1d3557", width: 1 },
                          },
                        },
                      ]}
                      layout={{
                        height: 400,
                        margin: { t: 30, r: 30, l: 60, b: 100 },
                        paper_bgcolor: "transparent",
                        plot_bgcolor: "#FFFFFF",
                        font: { color: "#424242", family: "Inter, system-ui, sans-serif", size: 12 },
                        xaxis: {
                          tickangle: -90,
                          showgrid: true,
                          gridcolor: "#E0E0E0",
                          tickfont: { color: "#616161", size: 10 },
                          title: { text: "Date", font: { color: "#424242", size: 13 } },
                        },
                        yaxis: {
                          showgrid: true,
                          gridcolor: "#E0E0E0",
                          tickfont: { color: "#616161", size: 11 },
                          title: {
                            text: "Number of Calls",
                            font: { color: "#424242", size: 13 },
                          },
                        },
                        hovermode: "x unified",
                        hoverlabel: {
                          bgcolor: "rgba(0,0,0,0.8)",
                          bordercolor: "#457b9d",
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
                      }}
                    />
                  </CardContent>
                </Card>
              </Grow>

              {/* Filtered Calls Table */}
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
                      bgcolor: "#f1faee",
                      p: 2,
                      borderBottom: "2px solid #a8dadc",
                    }}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 700, color: "#1d3557", mb: 0.5 }}>
                      📋 Filtered Calls
                    </Typography>
                    <Typography variant="caption" sx={{ color: "text.secondary" }}>
                      {filteredRows.length.toLocaleString()} call records
                    </Typography>
                  </Box>
                  <CardContent>
                    <DataTable
                      columns={[
                        { key: "Date", label: "Date" },
                        { key: "Assigned", label: "Assigned" },
                        { key: "Call Disposition", label: "Disposition" },
                        { key: "Company / Account", label: "Company / Account" },
                        { key: "Contact", label: "Contact" },
                        { key: "Call Duration", label: "Duration (s)" },
                      ]}
                      rows={filteredRows}
                      emptyMessage="No calls match your filters."
                    />
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
                  <PhoneIcon sx={{ fontSize: 48, color: "#1d3557" }} />
                </Box>
                <Typography variant="h5" gutterBottom sx={{ fontWeight: 700, color: "#1d3557", mb: 2 }}>
                  Get Started with Calls Analytics
                </Typography>
                <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 500, mx: "auto", mb: 3 }}>
                  Upload your Calls CSV file using the button above, or load demo data to see the dashboard in action.
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Chip label="📞 Calls CSV" sx={{ bgcolor: "#a8dadc", color: "#1d3557", fontWeight: 600 }} />
                </Stack>
              </CardContent>
            </Card>
          )}
        </Box>
      </Container>
    </Box>
  );
}

export default CallsAnalyticsPage;


