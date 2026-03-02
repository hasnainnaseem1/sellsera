import React, { useMemo } from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  UserOutlined,
  SafetyOutlined,
  BarChartOutlined,
  FileTextOutlined,
  SettingOutlined,
  ApartmentOutlined,
  CrownOutlined,
  ExperimentOutlined,
  GlobalOutlined,
  FileOutlined,
  ReadOutlined,
  BellOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePermission } from '../../hooks/usePermission';
import { PERMISSIONS } from '../../utils/permissions';
import { useFeatures } from '../../contexts/FeatureContext';

const { Sider } = Layout;

const AppSider = ({ collapsed }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasPermission } = usePermission();
  const { features } = useFeatures();

  // Build grouped menu items based on permissions
  const menuItems = useMemo(() => {
    const items = [];

    // Dashboard — always visible
    items.push({
      key: '/',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    });

    // User Management group
    const userChildren = [];
    if (hasPermission(PERMISSIONS.USERS_VIEW)) {
      userChildren.push({ key: '/users', label: 'Admin Users' });
    }
    if (hasPermission(PERMISSIONS.CUSTOMERS_VIEW)) {
      userChildren.push({ key: '/customers', label: 'Customers' });
    }
    if (userChildren.length > 0) {
      items.push({
        key: 'user-mgmt',
        icon: <TeamOutlined />,
        label: 'User Management',
        children: userChildren,
      });
    }

    // Subscription group
    const subChildren = [];
    if (hasPermission(PERMISSIONS.PLANS_VIEW)) {
      subChildren.push({ key: '/plans', label: 'Plans' });
    }
    if (hasPermission(PERMISSIONS.FEATURES_VIEW)) {
      subChildren.push({ key: '/features', label: 'Features' });
    }
    if (subChildren.length > 0) {
      items.push({
        key: 'subscription',
        icon: <CrownOutlined />,
        label: 'Subscription',
        children: subChildren,
      });
    }

    // Marketing Site group
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW)) {
      items.push({
        key: 'marketing',
        icon: <GlobalOutlined />,
        label: 'Marketing Site',
        children: [
          { key: '/marketing/pages', label: 'Pages' },
          { key: '/blog/posts', label: 'Blog Posts' },
          { key: '/seo/settings', label: 'SEO Settings' },
          { key: '/seo/redirects', label: 'Redirects' },
          { key: '/seo/debug', label: 'SEO Debug' },
          { key: '/marketing/navigation', label: 'Navigation' },
          { key: '/marketing/branding', label: 'Branding' },
        ],
      });
    }

    // Reports group
    const reportChildren = [];
    if (hasPermission(PERMISSIONS.ANALYTICS_VIEW)) {
      reportChildren.push({ key: '/analytics', label: 'Analytics' });
    }
    if (hasPermission(PERMISSIONS.LOGS_VIEW) && features.enableActivityLogs !== false) {
      reportChildren.push({ key: '/logs', label: 'Activity Logs' });
    }
    if (reportChildren.length > 0) {
      items.push({
        key: 'reports',
        icon: <BarChartOutlined />,
        label: 'Reports',
        children: reportChildren,
      });
    }

    // Notifications
    if (hasPermission(PERMISSIONS.NOTIFICATIONS_VIEW)) {
      items.push({
        key: '/notifications',
        icon: <BellOutlined />,
        label: 'Notifications',
      });
    }

    // Profile — always visible
    items.push({
      key: '/profile',
      icon: <UserOutlined />,
      label: 'My Profile',
    });

    // Administration group
    const adminChildren = [];
    if (hasPermission(PERMISSIONS.ROLES_VIEW) && features.enableCustomRoles !== false) {
      adminChildren.push({ key: '/roles', label: 'Roles & Permissions' });
    }
    if (hasPermission(PERMISSIONS.SETTINGS_VIEW)) {
      adminChildren.push({ key: '/departments', label: 'Departments' });
      adminChildren.push({ key: '/settings', label: 'Settings' });
      adminChildren.push({ key: '/integrations', label: 'Integrations', icon: <ApiOutlined /> });
    }
    if (adminChildren.length > 0) {
      items.push({
        key: 'admin',
        icon: <SettingOutlined />,
        label: 'Administration',
        children: adminChildren,
      });
    }

    return items;
  }, [hasPermission, features]);

  // Determine selected key from current path
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path === '/') return '/';
    // Check for exact or prefix match against all leaf keys
    const allLeafKeys = [];
    menuItems.forEach((item) => {
      if (item.children) {
        item.children.forEach((child) => allLeafKeys.push(child.key));
      } else {
        allLeafKeys.push(item.key);
      }
    });
    const match = allLeafKeys
      .filter((k) => k !== '/')
      .sort((a, b) => b.length - a.length) // longest match first
      .find((k) => path.startsWith(k));
    return match || '/';
  };

  // Determine which sub-menu should be open based on current path
  const getOpenKeys = () => {
    const path = location.pathname;
    const openKeys = [];
    menuItems.forEach((item) => {
      if (item.children) {
        const hasActiveChild = item.children.some((child) => path.startsWith(child.key));
        if (hasActiveChild) openKeys.push(item.key);
      }
    });
    return openKeys;
  };

  return (
    <Sider
      trigger={null}
      collapsible
      collapsed={collapsed}
      breakpoint="lg"
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'sticky',
        top: 0,
        left: 0,
      }}
    >
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: collapsed ? 16 : 18,
          fontWeight: 700,
          borderBottom: '1px solid rgba(255,255,255,0.1)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          padding: '0 16px',
        }}
      >
        {collapsed ? 'AC' : 'Admin Center'}
      </div>
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[getSelectedKey()]}
        defaultOpenKeys={getOpenKeys()}
        items={menuItems}
        onClick={({ key }) => {
          // Only navigate for leaf items (not group headers)
          if (!key.startsWith('user-mgmt') && !key.startsWith('subscription') && !key.startsWith('marketing') && !key.startsWith('reports') && !key.startsWith('admin')) {
            navigate(key);
          }
        }}
      />
    </Sider>
  );
};

export default AppSider;
