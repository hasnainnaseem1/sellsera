import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme as antTheme } from 'antd';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SiteProvider, useSite } from './context/SiteContext';

import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import MaintenancePage from './pages/MaintenancePage';
import DashboardPage from './pages/DashboardPage';
import VerifyEmailSentPage from './pages/VerifyEmailSentPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import CheckoutSuccessPage from './pages/CheckoutSuccessPage';
import CheckoutCancelPage from './pages/CheckoutCancelPage';
import AccountSettingsPage from './pages/AccountSettingsPage';
import ListingAuditPage from './pages/ListingAuditPage';
import AnalysisDetailPage from './pages/AnalysisDetailPage';
import HistoryPage from './pages/HistoryPage';
import KeywordResearchPage from './pages/KeywordResearchPage';
import CompetitorTrackerPage from './pages/CompetitorTrackerPage';
import DeepKeywordAnalyzerPage from './pages/DeepKeywordAnalyzerPage';
import BulkRankCheckerPage from './pages/BulkRankCheckerPage';
import TagAnalyzerPage from './pages/TagAnalyzerPage';
import ActiveListingsPage from './pages/ActiveListingsPage';
import CompetitorSalesPage from './pages/CompetitorSalesPage';
import DeliveryStatusPage from './pages/DeliveryStatusPage';
import SalesMapPage from './pages/SalesMapPage';
import UsageQuotasPage from './pages/UsageQuotasPage';
import { PermissionsProvider } from './context/PermissionsContext';
import { ShopProvider } from './context/ShopContext';

// ── Theme tokens ──────────────────────────────────────────────────────────────
const BRAND_PRIMARY = '#6C63FF';

const lightToken = {
  colorPrimary:   BRAND_PRIMARY,
  colorSuccess:   '#52c41a',
  colorWarning:   '#faad14',
  colorError:     '#ff4d4f',
  borderRadius:   10,
  fontFamily:     "'Inter', 'Segoe UI', sans-serif",
};

const darkToken = {
  ...lightToken,
  colorBgBase:        '#0f0f1a',
  colorBgContainer:   '#1a1a2e',
  colorBgElevated:    '#16213e',
  colorBgLayout:      '#0f0f1a',
  colorText:          '#e8e8f0',
  colorTextSecondary: '#9090a8',
  colorBorder:        '#2e2e4a',
};

// ── Protected Route ───────────────────────────────────────────────────────────
const ProtectedRoute = ({ children }) => {
  const { token, loading, user } = useAuth();
  // If we have a cached user in localStorage, show content immediately
  // instead of flashing blank while fetchMe is in flight
  if (loading && !user) return null;
  if (!token) return <Navigate to="/login" replace />;
  return children;
};

// ── Public Route (redirect if already logged in) ─────────────────────────────
const PublicRoute = ({ children }) => {
  const { token, loading } = useAuth();
  if (loading) return null;
  if (token) return <Navigate to="/dashboard" replace />;
  return children;
};

// ── Conditionally wraps children with GoogleOAuthProvider only when a clientId exists.
// This prevents the "Missing required parameter client_id" crash when Google SSO is
// disabled or the site config hasn't resolved yet.
const MaybeGoogleProvider = ({ clientId, children }) => {
  if (!clientId) return children;
  return <GoogleOAuthProvider clientId={clientId}>{children}</GoogleOAuthProvider>;
};

// ── Inner app — must be inside ThemeProvider to read isDark ──────────────────
const AppWithTheme = () => {
  const { isDark } = useTheme();
  const { siteConfig, loaded } = useSite();
  const googleClientId = siteConfig?.googleSSO?.enabled ? (siteConfig?.googleSSO?.clientId || '') : '';
  const isMaintenanceMode = loaded && siteConfig?.maintenance?.enabled;

  // Show maintenance page for non-admin users when maintenance is on
  if (isMaintenanceMode) {
    return (
      <ConfigProvider
        theme={{
          algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
          token:     isDark ? darkToken : lightToken,
        }}
      >
        <MaintenancePage message={siteConfig?.maintenance?.message} />
      </ConfigProvider>
    );
  }

  return (
    <MaybeGoogleProvider clientId={googleClientId}>
    <ConfigProvider
      theme={{
        algorithm: isDark ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token:     isDark ? darkToken : lightToken,
      }}
    >
      <Router>
        <Routes>
          {/* Public Auth Routes */}
          <Route path="/login"               element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/signup"              element={<PublicRoute><SignupPage /></PublicRoute>} />
          <Route path="/verify-email-sent"   element={<VerifyEmailSentPage />} />
          <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
          <Route path="/forgot-password"     element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />
          <Route path="/reset-password/:token" element={<ResetPasswordPage />} />

          {/* Protected App Routes */}
          <Route path="/dashboard"    element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/settings"     element={<ProtectedRoute><AccountSettingsPage /></ProtectedRoute>} />
          <Route path="/audit"        element={<ProtectedRoute><ListingAuditPage /></ProtectedRoute>} />
          <Route path="/history"      element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />
          <Route path="/history/:id"  element={<ProtectedRoute><AnalysisDetailPage /></ProtectedRoute>} />
          <Route path="/keywords"     element={<ProtectedRoute><KeywordResearchPage /></ProtectedRoute>} />
          <Route path="/keywords/deep" element={<ProtectedRoute><DeepKeywordAnalyzerPage /></ProtectedRoute>} />
          <Route path="/keywords/bulk" element={<ProtectedRoute><BulkRankCheckerPage /></ProtectedRoute>} />
          <Route path="/keywords/tags" element={<ProtectedRoute><TagAnalyzerPage /></ProtectedRoute>} />
          <Route path="/competitors"  element={<ProtectedRoute><CompetitorTrackerPage /></ProtectedRoute>} />
          <Route path="/competitors/sales" element={<ProtectedRoute><CompetitorSalesPage /></ProtectedRoute>} />
          <Route path="/listings/active" element={<ProtectedRoute><ActiveListingsPage /></ProtectedRoute>} />
          <Route path="/delivery"     element={<ProtectedRoute><DeliveryStatusPage /></ProtectedRoute>} />
          <Route path="/sales-map"    element={<ProtectedRoute><SalesMapPage /></ProtectedRoute>} />
          <Route path="/usage"        element={<ProtectedRoute><UsageQuotasPage /></ProtectedRoute>} />

          {/* Legacy redirects → Settings tabs */}
          <Route path="/profile"       element={<Navigate to="/settings?tab=profile" replace />} />
          <Route path="/subscription"  element={<Navigate to="/settings?tab=subscription" replace />} />
          <Route path="/plans"         element={<Navigate to="/settings?tab=plans" replace />} />
          <Route path="/billing"       element={<Navigate to="/settings?tab=billing" replace />} />

          <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccessPage /></ProtectedRoute>} />
          <Route path="/checkout/cancel"  element={<ProtectedRoute><CheckoutCancelPage /></ProtectedRoute>} />

          {/* Fallback */}
          <Route path="/"  element={<Navigate to="/dashboard" replace />} />
          <Route path="*"  element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </ConfigProvider>
    </MaybeGoogleProvider>
  );
};

function App() {
  return (
    <SiteProvider>
      <ThemeProvider>
        <AuthProvider>
          <PermissionsProvider>
            <ShopProvider>
              <AppWithTheme />
            </ShopProvider>
          </PermissionsProvider>
        </AuthProvider>
      </ThemeProvider>
    </SiteProvider>
  );
}

export default App;