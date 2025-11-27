import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
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

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Calls Analytics
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Monitor SDR calling activity, dispositions, and connect rates.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={handleLoadDemo}>
          Load Demo Data
        </Button>
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4} lg={3}>
          <Stack spacing={2}>
            <Card>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom>
                  Data Source
                </Typography>
                <ToggleButtonGroup
                  fullWidth
                  size="small"
                  color="primary"
                  value={mode}
                  exclusive
                  onChange={(_, value) => value && setMode(value)}
                >
                  <ToggleButton value="upload">Upload Calls CSV</ToggleButton>
                  <ToggleButton value="demo">Pre-processed Demo</ToggleButton>
                </ToggleButtonGroup>
                {mode === "demo" && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Demo calls loaded. Switch back to upload mode to process your
                    own file.
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
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleProcess}
                  disabled={!canProcess}
                >
                  {loading ? "Processing…" : "Process Calls File"}
                </Button>
                {error && (
                  <Alert severity="error" variant="outlined">
                    {error}
                  </Alert>
                )}
                <Button variant="text" onClick={handleDownloadTemplate}>
                  Download Calls Template
                </Button>
              </>
            )}
          </Stack>
        </Grid>

        <Grid item xs={12} md={8} lg={9}>
          {hasData ? (
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard title="Total Calls" value={stats.totalCalls || 0} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Unique Companies"
                        value={stats.uniqueCompanies || 0}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Connect Rate"
                        value={`${(stats.connectRate || 0).toFixed(1)}%`}
                        helper="Disposition contains 'connect'"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Duration (hrs)"
                        value={(stats.durationHours || 0).toFixed(2)}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Unique Contacts"
                        value={stats.uniqueContacts || 0}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Top Disposition"
                        value={stats.topDisposition || "N/A"}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Disposition Types"
                        value={stats.dispositionTypes || 0}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Daily Avg"
                        value={(stats.dailyAvg || 0).toFixed(1)}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    mb={2}
                  >
                    <TextField
                      size="small"
                      label="Filter by Assigned"
                      value={filters.assigned}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, assigned: e.target.value }))
                      }
                    />
                    <TextField
                      size="small"
                      label="Filter by Disposition"
                      value={filters.disposition}
                      onChange={(e) =>
                        setFilters((prev) => ({
                          ...prev,
                          disposition: e.target.value,
                        }))
                      }
                    />
                    <TextField
                      size="small"
                      label="Filter by Company"
                      value={filters.company}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, company: e.target.value }))
                      }
                    />
                  </Stack>
                  <Plot
                    data={[
                      {
                        type: "bar",
                        x: chartData.labels,
                        y: chartData.values,
                        marker: { color: "#33a1fd" },
                      },
                    ]}
                    layout={{
                      height: 300,
                      margin: { t: 20, r: 10, l: 40, b: 40 },
                    }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Filtered Calls
                  </Typography>
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
            </Stack>
          ) : (
            <Card sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h6" gutterBottom>
                  Upload a Calls CSV to get started
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Use the panel on the left to add the required Calls CSV. We will
                  validate headers, compute KPIs, and visualize connect rates and
                  dispositions instantly.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}

export default CallsAnalyticsPage;


