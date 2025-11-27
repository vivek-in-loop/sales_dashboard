import React, { useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import Plot from "react-plotly.js";
import { useDataContext } from "../context/DataContext";
import KpiCard from "../components/KpiCard";
import DataTable from "../components/DataTable";
import demoCombinedData from "../demo/combinedDemo.json";
import {
  buildCombinedRecords,
  groupByCompany,
} from "../utils/combinedProcessor";



function CombinedAnalyticsPage() {
  const { combinedData, setCombinedData, emailData, callsData } =
    useDataContext();

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const hasCombined = Boolean(combinedData?.records?.length);

  const filteredRecords = useMemo(() => {
    if (!hasCombined) return [];
    const term = search.toLowerCase();
    if (!term) return combinedData.records;
    return combinedData.records.filter((row) => {
      const haystack = [
        row.recipient_name,
        row["Recipient Email"],
        row.Company,
        row._companyLabel,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [combinedData, hasCombined, search]);

  const companyGroups = useMemo(
    () => groupByCompany(filteredRecords),
    [filteredRecords]
  );

  const chartData = useMemo(() => {
    const topCompanies = companyGroups.slice(0, 8);
    return {
      labels: topCompanies.map((c) => c.company),
      calls: topCompanies.map((c) => c.totalCalls),
      views: topCompanies.map((c) => c.totalViews),
    };
  }, [companyGroups]);

  const handleLoadDemo = () => {
    setCombinedData(demoCombinedData);
  };

  const handleCreateCombined = () => {
    if (!emailData.successful.length || !callsData?.rows?.length) return;
    setLoading(true);
    const result = buildCombinedRecords(emailData.successful, callsData.rows);
    setCombinedData(result);
    setLoading(false);
  };

  const canCreate =
    emailData.successful.length > 0 && callsData?.rows?.length > 0;

  const stats = combinedData?.stats || {
    totalEmailRecords: 0,
    emailCallMatches: 0,
    emailOnlyCount: 0,
    joinSuccessRate: 0,
    totalCalls: 0,
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Combined Analytics
          </Typography>
          <Typography variant="body2" color="textSecondary">
            Join processed email outcomes with call activity for a 360° view.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" size="small" onClick={handleLoadDemo}>
            Load Demo Combined Data
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={handleCreateCombined}
            disabled={!canCreate || loading}
          >
            {loading ? "Combining…" : "Create Combined Analytics"}
          </Button>
        </Stack>
      </Stack>

      {!canCreate && !hasCombined && (
        <Alert severity="info" sx={{ mb: 3 }}>
          Process the Email and Calls tabs first (or load demo data) to unlock
          combined insights.
        </Alert>
      )}

      {hasCombined ? (
        <Stack spacing={3}>
          <Card>
            <CardContent>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    title="Total Email Records"
                    value={stats.totalEmailRecords}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    title="Email + Call Matches"
                    value={stats.emailCallMatches}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    title="Join Success Rate"
                    value={`${stats.joinSuccessRate.toFixed(1)}%`}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    title="Email-only Records"
                    value={stats.emailOnlyCount}
                  />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <KpiCard
                    title="Total Calls"
                    value={stats.totalCalls}
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
                alignItems={{ md: "center" }}
                justifyContent="space-between"
                mb={2}
              >
                <Typography variant="h6">Company Engagement Snapshot</Typography>
                <TextField
                  size="small"
                  label="Search company or email"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Stack>
              <Plot
                data={[
                  {
                    type: "bar",
                    name: "Calls",
                    x: chartData.labels,
                    y: chartData.calls,
                    marker: { color: "#1976d2" },
                  },
                  {
                    type: "bar",
                    name: "Views",
                    x: chartData.labels,
                    y: chartData.views,
                    marker: { color: "#9c27b0" },
                  },
                ]}
                layout={{
                  barmode: "group",
                  height: 320,
                  margin: { t: 20, r: 10, l: 40, b: 40 },
                  legend: { orientation: "h", y: -0.2 },
                }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Combined Records
              </Typography>
              <DataTable
                columns={[
                  { key: "recipient_name", label: "Recipient" },
                  { key: "Recipient Email", label: "Recipient Email" },
                  { key: "Company", label: "Company" },
                  { key: "Views", label: "Views" },
                  { key: "Clicks", label: "Clicks" },
                  { key: "total_calls", label: "Calls" },
                  { key: "connected_calls", label: "Connected" },
                  { key: "total_call_duration", label: "Call Duration (s)" },
                ]}
                rows={filteredRecords}
                emptyMessage="No combined records match your search."
              />
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Engagement by Company
              </Typography>
              {companyGroups.length === 0 && (
                <Typography variant="body2" color="textSecondary">
                  No data available for the current filters.
                </Typography>
              )}
              {companyGroups.map((group, idx) => (
                <Accordion
                  key={group.company}
                  expanded={expanded === group.company}
                  onChange={() =>
                    setExpanded(
                      expanded === group.company ? false : group.company
                    )
                  }
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Stack
                      direction="row"
                      spacing={3}
                      sx={{ width: "100%", alignItems: "center" }}
                    >
                      <Box sx={{ flexGrow: 1 }}>
                        <Typography variant="subtitle1">
                          {idx + 1}. {group.company}
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          {group.emails.length} emails · {group.totalCalls} calls
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={2}>
                        <MetricChip label="Views" value={group.totalViews} />
                        <MetricChip label="Clicks" value={group.totalClicks} />
                        <MetricChip label="Calls" value={group.totalCalls} />
                        <MetricChip
                          label="Connected"
                          value={group.connectedCalls}
                        />
                      </Stack>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <DataTable
                      columns={[
                        { key: "recipient_name", label: "Recipient" },
                        { key: "Recipient Email", label: "Email" },
                        { key: "Views", label: "Views" },
                        { key: "Clicks", label: "Clicks" },
                        { key: "total_calls", label: "Calls" },
                        { key: "connected_calls", label: "Connected" },
                        { key: "latest_call_date", label: "Latest Call" },
                      ]}
                      rows={group.emails}
                      emptyMessage="No records."
                    />
                  </AccordionDetails>
                </Accordion>
              ))}
            </CardContent>
          </Card>
        </Stack>
      ) : (
        <Card
          sx={{
            minHeight: 360,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <CardContent sx={{ textAlign: "center", maxWidth: 560 }}>
            <Typography variant="h6" gutterBottom>
              Combine Email + Calls for richer insights
            </Typography>
            <Typography variant="body2" color="textSecondary">
              Once you have processed email and calls data (or loaded the demo),
              click &quot;Create Combined Analytics&quot; to build cross-channel
              KPIs, tables, and company engagement views.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Container>
  );
}

function MetricChip({ label, value }) {
  return (
    <Stack spacing={0.5} alignItems="center">
      <Typography variant="caption" color="textSecondary">
        {label}
      </Typography>
      <Typography variant="subtitle2">{value}</Typography>
    </Stack>
  );
}

export default CombinedAnalyticsPage;


