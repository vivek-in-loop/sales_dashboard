import React from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  AppBar,
  Box,
  Toolbar,
  Typography,
  Button,
  Stack,
  CssBaseline,
} from "@mui/material";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import EmailAnalyticsPage from "./pages/EmailAnalyticsPage";
import CallsAnalyticsPage from "./pages/CallsAnalyticsPage";
import CombinedAnalyticsPage from "./pages/CombinedAnalyticsPage";
import { DataProvider } from "./context/DataContext";
import "./App.css";

const queryClient = new QueryClient();
const theme = createTheme({
  palette: {
    background: {
      default: "#f6f8fb",
    },
  },
  typography: {
    fontFamily: '"Inter","Segoe UI",system-ui,-apple-system,sans-serif',
  },
});

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <BrowserRouter>
            <Box sx={{ flexGrow: 1 }}>
              <AppBar position="static" color="default" elevation={1}>
                <Toolbar>
                  <Typography variant="h6" sx={{ flexGrow: 1 }}>
                    Sales Dashboard
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <NavButton to="/email" label="Email" />
                    <NavButton to="/calls" label="Calls" />
                    <NavButton to="/combined" label="Combined" />
                  </Stack>
                </Toolbar>
              </AppBar>
              <Box sx={{ mt: 3 }}>
                <Routes>
                  <Route path="/" element={<EmailAnalyticsPage />} />
                  <Route path="/email" element={<EmailAnalyticsPage />} />
                  <Route path="/calls" element={<CallsAnalyticsPage />} />
                  <Route path="/combined" element={<CombinedAnalyticsPage />} />
                </Routes>
              </Box>
            </Box>
          </BrowserRouter>
        </DataProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function NavButton({ to, label }) {
  return (
    <Button
      component={NavLink}
      to={to}
      size="small"
      color="inherit"
      sx={{
        borderRadius: 2,
        textTransform: "none",
        "&.active": {
          fontWeight: 600,
          color: "primary.main",
        },
      }}
    >
      {label}
    </Button>
  );
}

export default App;
