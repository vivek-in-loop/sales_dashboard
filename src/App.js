import React, { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Email as EmailIcon,
  Menu as MenuIcon,
  BarChart as BarChartIcon,
  AccountCircle as AccountCircleIcon,
  Chat as ChatIcon,
} from "@mui/icons-material";
import EmailAnalyticsPage from "./pages/EmailAnalyticsPage";
import ProfilePage from "./pages/ProfilePage";
import AdminPage from "./pages/AdminPage";
import AIChatPage from "./pages/AIChatPage";
import LoginPage from "./pages/LoginPage";
import { DataProvider } from "./context/DataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import "./App.css";

const queryClient = new QueryClient();
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
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DataProvider>
          <BrowserRouter>
            <AppLayout />
          </BrowserRouter>
        </DataProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function AppLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [emailSection, setEmailSection] = useState("section-overview");
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const { user } = useAuth();

  // Define allowed admin emails
  const adminEmails = [
    "vivek.kumar@loopwork.co",
    "vipul.babar@loopwork.co",
    "harshit.gupta@loopwork.co"
  ];

  const isAdmin = user && adminEmails.includes(user.email?.toLowerCase());

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

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

  const baseMenuItems = [
    { text: "Email Analytics", icon: <EmailIcon />, path: "/email" },
    { text: "AI Assistant", icon: <ChatIcon />, path: "/ai-chat" },
    { text: "Profile", icon: <AccountCircleIcon />, path: "/profile" },
  ];

  const menuItems = isAdmin
    ? [...baseMenuItems, { text: "Admin Panel", icon: <BarChartIcon />, path: "/admin" }]
    : baseMenuItems;

  const drawer = (
    <div className="h-screen bg-white border-r border-gray-200 text-gray-900 flex flex-col w-[260px] overflow-y-auto shadow-sm">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center gap-3 mb-1">
        <img src="https://cdn.prod.website-files.com/625e799b877c107387cdf3ac/64d64c3870a418ff730a354c_91ae17956a95542ff4276cdbb7f25676_loop.png" alt="Sales Dashboard" />
          
        </div>
        <div>
            <h1 className="text-xl font-extrabold text-gray-900">OB Sales Dashboard</h1>
            <p className="text-xs text-gray-500">Analytics Platform</p>
          </div>
      </div>

      {/* Main Navigation */}
      <div className="px-3 py-4 flex-1 overflow-y-auto">
        <nav className="space-y-1">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path || (location.pathname === "/" && item.path === "/email");
            return (
              <button
                key={item.text}
                onClick={() => {
                  navigate(item.path);
                  if (isMobile) setMobileOpen(false);
                }}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200
                  ${isActive 
                    ? "bg-blue-600 text-white font-semibold shadow-sm" 
                    : "bg-transparent text-gray-700 font-medium hover:bg-gray-100 hover:text-gray-900"
                  }
                  text-sm
                `}
              >
                <span className={isActive ? "text-white" : "text-gray-600"} style={{ fontSize: "18px" }}>
                  {React.cloneElement(item.icon, { fontSize: "small" })}
                </span>
                <span>{item.text}</span>
              </button>
            );
          })}
        </nav>

        {/* Divider */}
        <div className="border-t border-gray-200 my-4 mx-4"></div>

        {/* Email sections nav (only on Email Analytics page) */}
        {(location.pathname === "/email" || location.pathname === "/") && (
          <div>
            <div className="px-4 pt-4 pb-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email Sections</p>
            </div>
            <nav className="px-2 pb-4 space-y-1">
              {emailSectionNavItems.map((item) => {
                const isActive = emailSection === item.id;
                return (
                  <button
                    key={item.id}
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
                    className={`
                      w-full text-left py-2 px-4 rounded-lg text-xs transition-all duration-200
                      ${isActive
                        ? "bg-blue-50 text-blue-600 font-semibold border-l-2 border-blue-600"
                        : "bg-transparent text-gray-600 font-medium hover:bg-gray-100 hover:text-gray-900"
                      }
                    `}
                  >
                    {item.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-6 mt-auto border-t border-gray-200 bg-gray-50">
        <p className="text-xs text-gray-500">© 2025 Sales Dashboard</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen overflow-x-hidden">
      {/* Mobile Menu Button */}
      {isMobile && (
        <button
          onClick={handleDrawerToggle}
          className="fixed top-4 left-4 z-50 bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors border border-gray-200"
          aria-label="Toggle menu"
        >
          <MenuIcon className="text-slate-700" />
        </button>
      )}

      {/* Mobile Overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={handleDrawerToggle}
        ></div>
      )}

      {/* Side Drawer */}
      <nav className={`
        ${isMobile 
          ? `fixed top-0 left-0 h-screen z-50 transform transition-transform duration-300 ease-in-out ${
              mobileOpen ? 'translate-x-0' : '-translate-x-full'
            }`
          : 'hidden md:block md:fixed md:left-0 md:top-0 md:h-screen'
        }
        w-[260px] flex-shrink-0 z-30
      `}>
        {drawer}
      </nav>

      {/* Main Content */}
      <main className={`
        flex-grow min-h-screen bg-slate-50 w-full max-w-full overflow-x-hidden
        ${isMobile ? '' : 'md:ml-[260px] md:w-[calc(100%-260px)]'}
      `}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route 
            path="/" 
            element={
              <ProtectedRoute>
                <EmailAnalyticsPage />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/email" 
            element={
              <ProtectedRoute>
                <EmailAnalyticsPage />
              </ProtectedRoute>
            } 
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <AdminPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/ai-chat"
            element={
              <ProtectedRoute>
                <AIChatPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  );
}

export default App;
