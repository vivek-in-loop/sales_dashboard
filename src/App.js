import React, { useState } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  CssBaseline,
  IconButton,
  useMediaQuery,
  useTheme as useMuiTheme,
} from "@mui/material";
import {
  Email as EmailIcon,
  Phone as PhoneIcon,
  Dashboard as DashboardIcon,
  Menu as MenuIcon,
  BarChart as BarChartIcon,
} from "@mui/icons-material";
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
      default: "#f1faee",
    },
    primary: {
      main: "#457b9d",
      dark: "#1d3557",
      light: "#a8dadc",
    },
    secondary: {
      main: "#e63946",
    },
  },
  typography: {
    fontFamily: '"Inter","Segoe UI",system-ui,-apple-system,sans-serif',
  },
});

const drawerWidth = 260;

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <QueryClientProvider client={queryClient}>
        <DataProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </DataProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: "Email Analytics", icon: <EmailIcon />, path: "/email" },
    { text: "Calls Analytics", icon: <PhoneIcon />, path: "/calls" },
    { text: "Combined Analytics", icon: <DashboardIcon />, path: "/combined" },
  ];

  const drawer = (
    <Box sx={{ height: "100%", bgcolor: "#1d3557", color: "white" }}>
      <Box
        sx={{
          p: 3,
          background: "linear-gradient(135deg, #1d3557 0%, #457b9d 100%)",
          borderBottom: "2px solid rgba(255, 255, 255, 0.1)",
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <BarChartIcon sx={{ fontSize: 40, color: "white" }} />
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: "white" }}>
              Sales Dashboard
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.8)" }}>
              Analytics Platform
            </Typography>
          </Box>
        </Box>
      </Box>
      <List sx={{ px: 2, py: 3 }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path || (location.pathname === "/" && item.path === "/email");
          return (
            <ListItem key={item.text} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                sx={{
                  borderRadius: 2,
                  color: "white",
                  bgcolor: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                  py: 1.5,
                  px: 2,
                  transition: "all 0.2s",
                  border: isActive ? "2px solid rgba(255, 255, 255, 0.3)" : "2px solid transparent",
                }}
              >
                <ListItemIcon sx={{ color: "white", minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.95rem",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)", mx: 2 }} />
      <Box sx={{ p: 3 }}>
        <Typography variant="caption" sx={{ color: "rgba(255, 255, 255, 0.7)" }}>
          © 2025 Sales Dashboard
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh" }}>
      {/* Mobile Menu Button */}
      {isMobile && (
        <Box
          sx={{
            position: "fixed",
            top: 16,
            left: 16,
            zIndex: 1300,
          }}
        >
          <IconButton
            color="primary"
            onClick={handleDrawerToggle}
            sx={{
              bgcolor: "white",
              boxShadow: 3,
              "&:hover": {
                bgcolor: "#F5F5F5",
              },
            }}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      )}

      {/* Side Drawer */}
      <Box
        component="nav"
        sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}
      >
        {/* Mobile Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{
            keepMounted: true, // Better mobile performance
          }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
            },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": {
              boxSizing: "border-box",
              width: drawerWidth,
              border: "none",
            },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", md: `calc(100% - ${drawerWidth}px)` },
          minHeight: "100vh",
          bgcolor: "#f1faee",
        }}
      >
        <Routes>
          <Route path="/" element={<EmailAnalyticsPage />} />
          <Route path="/email" element={<EmailAnalyticsPage />} />
          <Route path="/calls" element={<CallsAnalyticsPage />} />
          <Route path="/combined" element={<CombinedAnalyticsPage />} />
        </Routes>
      </Box>
    </Box>
  );
}

export default App;
