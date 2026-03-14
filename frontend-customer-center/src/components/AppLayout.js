import React, { useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../api/axiosInstance';
import {
  Layout, Menu, Avatar, Dropdown, Button, Typography, Tooltip, Divider, Tag
} from 'antd';
import {
  DashboardOutlined,
  LogoutOutlined, MoonOutlined, SunOutlined, MenuFoldOutlined,
  MenuUnfoldOutlined, QuestionCircleOutlined, RocketOutlined,
  SettingOutlined, SearchOutlined, HistoryOutlined,
  KeyOutlined, TeamOutlined, LockOutlined
} from '@ant-design/icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSite } from '../context/SiteContext';
import { usePermissions } from '../context/PermissionsContext';
import { colors } from '../theme/tokens';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

const BRAND   = '#6C63FF';
const BRAND2  = '#4facfe';

const AppLayout = ({ children }) => {
  const navigate       = useNavigate();
  const location       = useLocation();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { siteConfig } = useSite();
  const { getFeatureAccess } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);

  const handleLogout = useCallback(async () => {
    try {
      await axiosInstance.post('/api/v1/auth/customer/logout');
    } catch {
      // Ignore — we still want to clear local state
    }
    logout();
    navigate('/login', { replace: true });
  }, [logout, navigate]);

  /* ── helper: compact usage pill for sidebar ── */
  const usagePill = (featureKey) => {
    if (collapsed) return null;
    const a = getFeatureAccess(featureKey);
    if (a.state === 'locked') return <LockOutlined style={{ fontSize: 11, color: colors.muted }} />;
    if (a.unlimited || !a.limit) return null;
    const pct = (a.used / a.limit) * 100;
    const pillColor = pct >= 90 ? colors.danger : pct >= 60 ? colors.warning : colors.success;
    return (
      <Tag style={{ fontSize: 10, lineHeight: '18px', padding: '0 6px', borderRadius: 99, fontWeight: 600, border: 'none', background: `${pillColor}18`, color: pillColor, marginLeft: 'auto' }}>
        {a.used}/{a.limit}
      </Tag>
    );
  };

  /* ── Feature menu (top section — main product features) ── */
  const featureItems = [
    { key: '/dashboard', icon: <DashboardOutlined />, label: 'Dashboard' },
  ];

  /* ── SEO Tools section ── */
  const seoToolItems = [
    { key: '/audit',       icon: <SearchOutlined />,  label: <span style={{ display: 'flex', alignItems: 'center' }}>Listing Audit{usagePill('listing_audit')}</span> },
    { key: '/history',     icon: <HistoryOutlined />,  label: 'Analysis History' },
    { key: '/keywords',    icon: <KeyOutlined />,     label: <span style={{ display: 'flex', alignItems: 'center' }}>Keywords{usagePill('keyword_search')}</span> },
    { key: '/competitors', icon: <TeamOutlined />,    label: <span style={{ display: 'flex', alignItems: 'center' }}>Competitors{usagePill('competitor_tracking')}</span> },
  ];

  /* ── Account menu (bottom section — user/account related) ── */
  const accountItems = [
    { key: '/settings', icon: <SettingOutlined />, label: 'Settings' },
  ];

  const userMenuItems = [
    { type: 'divider' },
    { key: 'logout',   icon: <LogoutOutlined style={{ color: '#ff4d4f' }} />, label: <span style={{ color: '#ff4d4f' }}>Logout</span>, onClick: handleLogout },
  ];

  const siderStyle = {
    background:    isDark ? '#1a1a2e' : '#fff',
    borderRight:   `1px solid ${isDark ? '#2e2e4a' : '#f0f0f5'}`,
    boxShadow:     isDark ? 'none' : '2px 0 12px rgba(108,99,255,0.06)',
    overflow:      'hidden',
    height:        '100vh',
    position:      'sticky',
    top:           0,
    left:          0,
    display:       'flex',
    flexDirection: 'column',
  };

  const headerStyle = {
    background:    isDark ? '#1a1a2e' : '#fff',
    borderBottom:  `1px solid ${isDark ? '#2e2e4a' : '#f0f0f5'}`,
    boxShadow:     isDark ? 'none' : '0 2px 8px rgba(108,99,255,0.06)',
    padding:       '0 24px',
    display:       'flex',
    alignItems:    'center',
    justifyContent:'space-between',
    height:        64,
    position:      'sticky',
    top:           0,
    zIndex:        100,
  };

  const sectionLabel = (text) =>
    !collapsed ? (
      <div style={{
        padding: '12px 24px 4px',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: isDark ? '#6a6a8a' : '#a0a0b8',
        userSelect: 'none',
      }}>
        {text}
      </div>
    ) : (
      <Divider style={{ margin: '8px 16px', borderColor: isDark ? '#2e2e4a' : '#f0f0f5' }} />
    );

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()
    : user?.email?.[0]?.toUpperCase() || 'U';

  return (
    <Layout style={{ minHeight: '100vh', background: isDark ? '#0f0f1a' : '#f5f5fa' }}>
      {/* ── Sidebar ── */}
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={240}
        collapsedWidth={72}
        style={siderStyle}
      >
        {/* Logo */}
        <div style={{
          height: 64, display: 'flex', alignItems: 'center',
          padding: '0 20px', flexShrink: 0,
          borderBottom: `1px solid ${isDark ? '#2e2e4a' : '#f0f0f5'}`,
          gap: 10,
        }}>
          {siteConfig?.logoUrl ? (
            <img
              src={siteConfig.logoUrl}
              alt={siteConfig?.siteName || 'Logo'}
              style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                objectFit: 'contain',
              }}
            />
          ) : (
            <div style={{
              width: 36, height: 36, borderRadius: 10, flexShrink: 0,
              background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(108,99,255,0.4)',
            }}>
              <RocketOutlined style={{ color: '#fff', fontSize: 18 }} />
            </div>
          )}
          {!collapsed && (
            <Text strong style={{ fontSize: 17, background: `linear-gradient(90deg,${BRAND},${BRAND2})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              {siteConfig?.siteName || 'AppCenter'}
            </Text>
          )}
        </div>

        {/* User badge */}
        {user && (
          <div style={{
            padding: collapsed ? '16px 18px' : '16px 20px', flexShrink: 0,
            borderBottom: `1px solid ${isDark ? '#2e2e4a' : '#f0f0f5'}`,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            <Avatar
              size={collapsed ? 36 : 40}
              style={{ background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`, fontWeight: 700, flexShrink: 0 }}
            >
              {initials}
            </Avatar>
            {!collapsed && (
              <div style={{ minWidth: 0 }}>
                <Text strong ellipsis style={{ display: 'block', fontSize: 13 }}>{user.name || 'User'}</Text>
                <Text type="secondary" ellipsis style={{ display: 'block', fontSize: 11 }}>{user.email}</Text>
              </div>
            )}
          </div>
        )}

        {/* ── Features section (top, scrollable) ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
          {sectionLabel('Menu')}
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={featureItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', border: 'none', fontSize: 14 }}
            theme={isDark ? 'dark' : 'light'}
          />

          {sectionLabel('SEO Tools')}
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={seoToolItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', border: 'none', fontSize: 14 }}
            theme={isDark ? 'dark' : 'light'}
          />
        </div>

        {/* ── Account section (bottom, fixed) ── */}
        <div style={{ flexShrink: 0 }}>
          {sectionLabel('Account')}
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={accountItems}
            onClick={({ key }) => navigate(key)}
            style={{ background: 'transparent', border: 'none', fontSize: 14 }}
            theme={isDark ? 'dark' : 'light'}
          />

          {/* Help */}
          {!collapsed && (
            <div style={{ padding: '8px 16px 16px' }}>
              <a
                href={siteConfig?.supportEmail ? `mailto:${siteConfig.supportEmail}` : '#'}
                target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <div style={{
                  background: isDark ? 'rgba(108,99,255,0.12)' : 'rgba(108,99,255,0.08)',
                  borderRadius: 12, padding: '12px 14px',
                  border: `1px solid ${isDark ? 'rgba(108,99,255,0.2)' : 'rgba(108,99,255,0.15)'}`,
                  cursor: 'pointer',
                }}>
                  <QuestionCircleOutlined style={{ color: BRAND, marginRight: 8 }} />
                  <Text style={{ fontSize: 12, color: isDark ? '#c0b8ff' : BRAND }}>Help & Support</Text>
                </div>
              </a>
            </div>
          )}
        </div>
      </Sider>

      <Layout>
        {/* ── Header ── */}
        <Header style={headerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 16, width: 40, height: 40, color: isDark ? '#e8e8f0' : '#333' }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* Theme toggle */}
            <Tooltip title={isDark ? 'Light Mode' : 'Dark Mode'}>
              <Button
                type="text" shape="circle"
                icon={isDark ? <SunOutlined /> : <MoonOutlined />}
                onClick={toggleTheme}
                style={{ fontSize: 17, color: isDark ? '#e8e8f0' : '#555', width: 40, height: 40 }}
              />
            </Tooltip>



            {/* User avatar dropdown */}
            <Dropdown menu={{ items: userMenuItems }} trigger={['click']} placement="bottomRight">
              <Avatar
                size={38}
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${BRAND2})`,
                  fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 2px 8px rgba(108,99,255,0.35)',
                }}
              >
                {initials}
              </Avatar>
            </Dropdown>
          </div>
        </Header>

        {/* ── Main Content ── */}
        <Content style={{
          margin: '24px',
          minHeight: 'calc(100vh - 112px)',
        }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;
