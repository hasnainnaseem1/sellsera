import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from './components/layout/AppLayout';
import ProtectedRoute from './components/guards/ProtectedRoute';
import PermissionGuard from './components/guards/PermissionGuard';
import LoginPage from './pages/LoginPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import NotFoundPage from './pages/NotFoundPage';
import DashboardPage from './pages/DashboardPage';
import UsersListPage from './pages/users/UsersListPage';
import UserDetailPage from './pages/users/UserDetailPage';
import CustomersListPage from './pages/customers/CustomersListPage';
import CustomerDetailPage from './pages/customers/CustomerDetailPage';
import RolesListPage from './pages/roles/RolesListPage';
import AnalyticsPage from './pages/AnalyticsPage';
import LogsListPage from './pages/logs/LogsListPage';
import SettingsPage from './pages/SettingsPage';
import DepartmentsPage from './pages/settings/DepartmentsPage';
import PlansListPage from './pages/plans/PlansListPage';
import PlanFormPage from './pages/plans/PlanFormPage';
import FeaturesListPage from './pages/features/FeaturesListPage';
import MarketingPagesListPage from './pages/marketing/MarketingPagesListPage';
import MarketingPageFormPage from './pages/marketing/MarketingPageFormPage';
import MarketingNavigationPage from './pages/marketing/MarketingNavigationPage';
import MarketingBrandingPage from './pages/marketing/MarketingBrandingPage';
import BlogPostsListPage from './pages/blog/BlogPostsListPage';
import BlogPostFormPage from './pages/blog/BlogPostFormPage';
import SeoSettingsPage from './pages/seo/SeoSettingsPage';
import SeoDebugPage from './pages/seo/SeoDebugPage';
import RedirectsPage from './pages/seo/RedirectsPage';
import NotificationsPage from './pages/notifications/NotificationsPage';
import AdminProfilePage from './pages/profile/ProfilePage';
import IntegrationsPage from './pages/integrations/IntegrationsPage';
import { PERMISSIONS } from './utils/permissions';
import { FeatureProvider } from './contexts/FeatureContext';
import './App.css';

function App() {
  return (
    <FeatureProvider>
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/" element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<PermissionGuard permission={PERMISSIONS.USERS_VIEW}><UsersListPage /></PermissionGuard>} />
          <Route path="users/:id" element={<PermissionGuard permission={PERMISSIONS.USERS_VIEW}><UserDetailPage /></PermissionGuard>} />
          <Route path="plans" element={<PermissionGuard permission={PERMISSIONS.PLANS_VIEW}><PlansListPage /></PermissionGuard>} />
          <Route path="plans/new" element={<PermissionGuard permission={PERMISSIONS.PLANS_CREATE}><PlanFormPage /></PermissionGuard>} />
          <Route path="plans/:id/edit" element={<PermissionGuard permission={PERMISSIONS.PLANS_EDIT}><PlanFormPage /></PermissionGuard>} />
          <Route path="features" element={<PermissionGuard permission={PERMISSIONS.FEATURES_VIEW}><FeaturesListPage /></PermissionGuard>} />
          <Route path="marketing/pages" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><MarketingPagesListPage /></PermissionGuard>} />
          <Route path="marketing/pages/new" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}><MarketingPageFormPage /></PermissionGuard>} />
          <Route path="marketing/pages/:id/edit" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}><MarketingPageFormPage /></PermissionGuard>} />
          <Route path="marketing/navigation" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><MarketingNavigationPage /></PermissionGuard>} />
          <Route path="marketing/branding" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><MarketingBrandingPage /></PermissionGuard>} />
          <Route path="blog/posts" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><BlogPostsListPage /></PermissionGuard>} />
          <Route path="blog/posts/new" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}><BlogPostFormPage /></PermissionGuard>} />
          <Route path="blog/posts/:id/edit" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}><BlogPostFormPage /></PermissionGuard>} />
          <Route path="seo/settings" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><SeoSettingsPage /></PermissionGuard>} />
          <Route path="seo/redirects" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><RedirectsPage /></PermissionGuard>} />
          <Route path="seo/debug" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><SeoDebugPage /></PermissionGuard>} />
          <Route path="customers" element={<PermissionGuard permission={PERMISSIONS.CUSTOMERS_VIEW}><CustomersListPage /></PermissionGuard>} />
          <Route path="customers/:id" element={<PermissionGuard permission={PERMISSIONS.CUSTOMERS_VIEW}><CustomerDetailPage /></PermissionGuard>} />
          <Route path="roles" element={<PermissionGuard permission={PERMISSIONS.ROLES_VIEW}><RolesListPage /></PermissionGuard>} />
          <Route path="analytics" element={<PermissionGuard permission={PERMISSIONS.ANALYTICS_VIEW}><AnalyticsPage /></PermissionGuard>} />
          <Route path="logs" element={<PermissionGuard permission={PERMISSIONS.LOGS_VIEW}><LogsListPage /></PermissionGuard>} />
          <Route path="settings" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><SettingsPage /></PermissionGuard>} />
          <Route path="departments" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><DepartmentsPage /></PermissionGuard>} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<AdminProfilePage />} />
          <Route path="integrations" element={<PermissionGuard permission={PERMISSIONS.SETTINGS_VIEW}><IntegrationsPage /></PermissionGuard>} />
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
    </FeatureProvider>
  );
}

export default App;
