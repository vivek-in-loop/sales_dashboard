import React, { useState, useEffect } from "react";
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

const emailSectionNavItems = [
  { id: "section-overview", label: "Overview" },
  { id: "section-filters", label: "Filters" },
  { id: "section-kpis", label: "KPIs" },
  { id: "section-leaderboard", label: "SDR Leaderboard" },
  { id: "section-trends", label: "Engagement Trend" },
  { id: "section-companies", label: "Company Engagement" },
  { id: "section-prospects", label: "Prospects" },
  { id: "detailed-records", label: "Detailed Records" },
];

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
  const [emailSection, setEmailSection] = useState("section-overview");
  const navigate = useNavigate();
  const location = useLocation();
  const muiTheme = useMuiTheme();
  const isMobile = useMediaQuery(muiTheme.breakpoints.down("md"));

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  useEffect(() => {
    const handler = (event) => {
      if (event.detail && event.detail.id) {
        setEmailSection(event.detail.id);
      }
    };
    window.addEventListener("email-section-change", handler);
    return () => window.removeEventListener("email-section-change", handler);
  }, []);

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
      <List sx={{ px: 1.5, py: 2 }}>
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
                  borderRadius: 999,
                  color: "white",
                  bgcolor: isActive ? "rgba(255, 255, 255, 0.15)" : "transparent",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                  py: 0.75,
                  px: 1.5,
                  minHeight: 36,
                  transition: "all 0.2s",
                  border: isActive ? "1px solid rgba(255, 255, 255, 0.3)" : "1px solid transparent",
                }}
              >
                <ListItemIcon sx={{ color: "white", minWidth: 32 }}>
                  {React.cloneElement(item.icon, { fontSize: "small" })}
                </ListItemIcon>
                <ListItemText
                  primary={item.text}
                  primaryTypographyProps={{
                    fontWeight: isActive ? 700 : 500,
                    fontSize: "0.85rem",
                  }}
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider sx={{ borderColor: "rgba(255, 255, 255, 0.1)", mx: 2 }} />

      {/* Email sections nav (only on Email Analytics page) */}
      {(location.pathname === "/email" || location.pathname === "/") && (
        <>
          <Box sx={{ px: 2, pt: 2, pb: 1 }}>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: 600 }}
            >
              Email Sections
            </Typography>
          </Box>
          <List sx={{ px: 1, pb: 2 }}>
            {emailSectionNavItems.map((item) => {
              const isActive = emailSection === item.id;
              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      if (location.pathname !== "/email") {
                        navigate("/email");
                      }
                      const scrollToSection = () => {
                        const el = document.getElementById(item.id);
                        if (el) {
                          el.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }
                      };
                      // Give React time to render section after navigation
                      setTimeout(scrollToSection, 200);
                    }}
                    sx={{
                      borderRadius: 10,
                      py: 0.5,
                      px: 2,
                      minHeight: 32,
                      color: "rgba(255,255,255,0.9)",
                      bgcolor: isActive
                        ? "rgba(255,255,255,0.18)"
                        : "transparent",
                      "&:hover": {
                        bgcolor: "rgba(255,255,255,0.12)",
                      },
                    }}
                  >
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{
                        fontSize: "0.8rem",
                        fontWeight: isActive ? 700 : 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </>
      )}

      <Box sx={{ p: 3, mt: "auto" }}>
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
