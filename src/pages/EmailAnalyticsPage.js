import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
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
  const [filters, setFilters] = useState({ search: "", metric: "Views" });
  const [tableTab, setTableTab] = useState(0);

  const hasResults = Boolean(emailData.stats);
  const readySdrs = sdrs.every((sdr) => sdr.sendFile && sdr.openFile);
  const canProcess =
    mode === "upload" && !!contactsFile && readySdrs && !loading;

  const derivedMetrics = useMemo(() => {
    if (!hasResults) {
      return {
        totalSends: 0,
        totalViews: 0,
        totalClicks: 0,
        totalProspects: 0,
        openRate: 0,
        contactMatch: 0,
        highEngagement: 0,
      };
    }
    const totalViews = emailData.successful.reduce(
      (sum, row) => sum + (Number(row.Views) || 0),
      0
    );
    const totalClicks = emailData.successful.reduce(
      (sum, row) => sum + (Number(row.Clicks) || 0),
      0
    );
    const highEngagement = emailData.successful.filter(
      (row) => Number(row.Views) >= 5
    ).length;
    const totalProspects = emailData.successful.length;
    const openRate = emailData.stats.total_send_records
      ? (emailData.stats.send_open_success / emailData.stats.total_send_records) *
        100
      : 0;
    const contactMatch = emailData.stats.send_open_success
      ? (emailData.stats.contact_join_success /
          emailData.stats.send_open_success) *
        100
      : 0;
    return {
      totalSends: emailData.stats.total_send_records,
      totalViews,
      totalClicks,
      totalProspects,
      openRate,
      contactMatch,
      highEngagement,
    };
  }, [emailData, hasResults]);

  const filteredSuccess = useMemo(() => {
    const term = filters.search.toLowerCase();
    if (!term) return emailData.successful;
    return emailData.successful.filter((row) => {
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
  }, [emailData.successful, filters.search]);

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
    () => buildTrend(emailData.successful, filters.metric),
    [emailData.successful, filters.metric]
  );

  const sdrMatrix = useMemo(
    () => buildSdrMatrix(emailData.successful),
    [emailData.successful]
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
      setEmailData({
        successful: result.successful,
        failed: result.failed,
        stats: result.stats,
        sdrStats: result.sdrStats || [],
      });
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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Email Analytics
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Upload SDR CSVs or load demo data to see send-open-contact performance.
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
                  <ToggleButton value="upload">Upload SDR Files</ToggleButton>
                  <ToggleButton value="demo">Pre-processed Demo</ToggleButton>
                </ToggleButtonGroup>
                {mode === "demo" && (
                  <Alert severity="info" sx={{ mt: 2 }}>
                    Demo data loaded. Switch back to &quot;Upload SDR Files&quot;
                    to process your own CSVs.
                  </Alert>
                )}
              </CardContent>
            </Card>

            {mode === "upload" && (
              <>
                <Card variant="outlined">
                  <CardContent>
                    <Stack
                      direction={{ xs: "column", sm: "row" }}
                      justifyContent="space-between"
                      alignItems={{ xs: "flex-start", sm: "center" }}
                      spacing={1}
                      mb={2}
                    >
                      <Box>
                        <Typography variant="subtitle2">
                          SDR Managers
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Add each SDR’s Send & Open exports.
                        </Typography>
                      </Box>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setSdrs((prev) => [...prev, createSdrEntry()])}
                      >
                        + Add SDR
                      </Button>
                    </Stack>
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
                <Stack direction="row" spacing={1}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={handleProcess}
                    disabled={!canProcess}
                  >
                    {loading ? "Processing…" : "Process Email Files"}
                  </Button>
                </Stack>
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
        </Grid>

        <Grid item xs={12} md={8} lg={9}>
          {hasResults ? (
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard title="Total Sends" value={derivedMetrics.totalSends} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard title="Total Views" value={derivedMetrics.totalViews} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Open Rate"
                        value={`${formatPercent(derivedMetrics.openRate)}`}
                        helper="Send → Open match"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Contact Match %"
                        value={`${formatPercent(derivedMetrics.contactMatch)}`}
                        helper="Send/Open with contacts"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Total Prospects"
                        value={derivedMetrics.totalProspects}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard title="Clicks" value={derivedMetrics.totalClicks} />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="High Engagement"
                        value={derivedMetrics.highEngagement}
                        helper="≥ 5 Views"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <KpiCard
                        title="Failures"
                        value={emailData.failed.length}
                        helper="Send/Open join issues"
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>

              {emailData.sdrStats?.length ? (
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom>
                      SDR Join Summary
                    </Typography>
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
              ) : null}

              <Card>
                <CardContent>
                  <Stack
                    direction={{ xs: "column", md: "row" }}
                    spacing={2}
                    alignItems={{ md: "center" }}
                    justifyContent="space-between"
                    mb={2}
                  >
                    <Typography variant="h6">Engagement Trend</Typography>
                    <Stack direction="row" spacing={2}>
                      <TextField
                        size="small"
                        label="Search"
                        value={filters.search}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, search: e.target.value }))
                        }
                      />
                      <TextField
                        select
                        size="small"
                        label="Metric"
                        value={filters.metric}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, metric: e.target.value }))
                        }
                      >
                        {metricOptions.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </TextField>
                    </Stack>
                  </Stack>
                  <Plot
                    data={[
                      {
                        type: "scatter",
                        mode: "lines+markers",
                        x: trendData.labels,
                        y: trendData.values,
                        marker: { color: "#1976d2" },
                      },
                    ]}
                    layout={{
                      height: 320,
                      autosize: true,
                      margin: { t: 10, r: 16, l: 40, b: 40 },
                    }}
                    style={{ width: "100%" }}
                    useResizeHandler
                  />
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    SDR Performance Matrix
                  </Typography>
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

              <Card>
                <CardContent>
                  <Tabs
                    value={tableTab}
                    onChange={(_, value) => setTableTab(value)}
                    textColor="primary"
                  >
                    <Tab label={`Successful (${filteredSuccess.length})`} />
                    <Tab label={`Failed (${filteredFailed.length})`} />
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
            </Stack>
          ) : (
            <Card sx={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CardContent sx={{ textAlign: "center" }}>
                <Typography variant="h6" gutterBottom>
                  Provide Send, Open, and Contacts CSVs
                </Typography>
                <Typography variant="body2" color="textSecondary">
                  Use the panel on the left to upload your SDR exports or load demo data.
                  You will see KPIs, trends, and tables as soon as processing completes.
                </Typography>
              </CardContent>
            </Card>
          )}
        </Grid>
      </Grid>
    </Container>
  );
}

function buildTrend(rows, metricKey) {
  const buckets = rows.reduce((acc, row) => {
    const raw =
      row.sent_date_parsed instanceof Date
        ? row.sent_date_parsed
        : row.sent_date || row.sent_date_parsed;
    const parsed = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(parsed.getTime())) return acc;
    const key = parsed.toISOString().split("T")[0];
    if (!acc.has(key)) acc.set(key, 0);
    const value =
      metricKey === "total_sends" ? 1 : Number(row[metricKey]) || 0;
    acc.set(key, acc.get(key) + value);
    return acc;
  }, new Map());

  const sorted = [...buckets.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  );
  return {
    labels: sorted.map(([date]) => date),
    values: sorted.map(([, value]) => value),
  };
}

function buildSdrMatrix(rows) {
  const map = new Map();
  rows.forEach((row) => {
    const key = row.SDR_Name || row["Account Owner"] || "Unassigned";
    if (!map.has(key)) {
      map.set(key, { sdr: key, sends: 0, views: 0, clicks: 0 });
    }
    const agg = map.get(key);
    agg.sends += 1;
    agg.views += Number(row.Views) || 0;
    agg.clicks += Number(row.Clicks) || 0;
  });
  return [...map.values()].sort(
    (a, b) => b.views - a.views || b.sends - a.sends
  );
}

function formatPercent(value) {
  return `${value.toFixed(1)}%`;
}

export default EmailAnalyticsPage;


