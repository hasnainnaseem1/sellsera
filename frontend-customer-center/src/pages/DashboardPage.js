import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Button, Typography,
  Tag, Progress, theme, Alert, Space, List, Empty, message,
  Modal, Tooltip, Spin,
} from "antd";
import {
  ThunderboltOutlined, RocketOutlined,
  ClockCircleOutlined,
  SyncOutlined, SearchOutlined, KeyOutlined,
  TeamOutlined, HistoryOutlined, EyeOutlined, LockOutlined,
  ShopOutlined, DisconnectOutlined, ExportOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { useNavigate, useSearchParams } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SuccessTracker from "../components/dashboard/SuccessTracker";
import DashboardBanner from "../components/dashboard/DashboardBanner";
import ConnectShopPrompt from "../components/ConnectShopPrompt";
import SyncingState from "../components/SyncingState";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSite } from "../context/SiteContext";
import { usePermissions } from "../context/PermissionsContext";
import { useShop } from "../context/ShopContext";
import { colors, radii } from "../theme/tokens";
import analysisApi from "../api/analysisApi";
import etsyApi from "../api/etsyApi";

const { Title, Text } = Typography;
const BRAND = "#6C63FF";

/* Pulse keyframe for active shop dot — injected once */
if (typeof document !== 'undefined' && !document.getElementById('sellsera-pulse-style')) {
  const style = document.createElement('style');
  style.id = 'sellsera-pulse-style';
  style.textContent = `
    @keyframes sellseraPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.45); }
      50%      { box-shadow: 0 0 0 4px rgba(16,185,129,0); }
    }
  `;
  document.head.appendChild(style);
}

const DashboardPage = () => {
  const { user, fetchMe, token } = useAuth();
  const { isDark } = useTheme();
  useSite();
  const { getFeatureAccess } = usePermissions();
  const { shops, activeShop, shopLimit, shopLimitUnlimited, loading: shopLoading, selectShop, refresh: refreshShops } = useShop();
  const { token: tok } = theme.useToken();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [recentAnalyses, setRecentAnalyses] = useState([]);
  const [shopSyncing, setShopSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(null);
  const [syncingShop, setSyncingShop] = useState(null);

  const subStatus = user?.subscriptionStatus || "inactive";
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86400000)) : null;

  // Detect OAuth callback redirect — ?etsy_connected=true&shop=ShopName
  useEffect(() => {
    const connected = searchParams.get('etsy_connected');
    const etsyError = searchParams.get('etsy_error');
    if (connected === 'true') {
      const shopName = searchParams.get('shop');
      message.success(`Etsy shop${shopName ? ` "${shopName}"` : ''} connected! Syncing your data...`);
      setShopSyncing(true);
      fetchMe(token);
      refreshShops();
      setSearchParams({}, { replace: true });
    } else if (etsyError) {
      const errorMessages = {
        access_denied: 'You declined the Etsy authorization request.',
        connection_failed: 'Failed to connect your Etsy shop. Please try again.',
      };
      message.error(errorMessages[etsyError] || 'Something went wrong connecting your Etsy shop.');
      setSearchParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Determine if user has connected their shop
  const hasShop = !!user?.etsyConnected;

  const card = {
    border: `1px solid ${isDark ? "#2e2e4a" : "#ebebf8"}`,
    borderRadius: radii.lg,
    background: tok.colorBgContainer,
    boxShadow: isDark ? "none" : "0 2px 12px rgba(108,99,255,0.06)",
  };

  // Fetch recent analyses
  useEffect(() => {
    analysisApi.getHistory({ page: 1, limit: 5 })
      .then(res => setRecentAnalyses(res.analyses || []))
      .catch(() => {});
  }, []);

  // Disconnect a specific shop
  const handleDisconnect = (shop) => {
    Modal.confirm({
      title: 'Disconnect Etsy Shop',
      content: `Are you sure you want to disconnect "${shop.shopName}"? You can reconnect anytime.`,
      okText: 'Disconnect',
      okButtonProps: { danger: true },
      onOk: async () => {
        setDisconnecting(shop.id);
        try {
          const res = await etsyApi.disconnect(shop.id);
          if (res.success) {
            message.success(`"${shop.shopName}" disconnected`);
            refreshShops();
            fetchMe(token);
          }
        } catch {
          message.error('Failed to disconnect shop');
        } finally {
          setDisconnecting(null);
        }
      },
    });
  };

  // Manual sync handler for a specific shop (with background job polling)
  const handleSync = async (shop) => {
    setSyncingShop(shop.id);
    try {
      const res = await etsyApi.syncShop(shop.id);
      if (res.success && res.data?.jobId) {
        message.loading({ content: `Syncing "${shop.shopName}"...`, key: 'sync', duration: 0 });
        // Poll for completion
        const jobId = res.data.jobId;
        const poll = setInterval(async () => {
          try {
            const status = await etsyApi.getSyncStatus(jobId);
            if (status.data?.status === 'completed') {
              clearInterval(poll);
              const count = status.data?.result?.syncedCount || 0;
              message.success({ content: `"${shop.shopName}" synced — ${count} listings updated!`, key: 'sync' });
              setSyncingShop(null);
              refreshShops();
            } else if (status.data?.status === 'failed') {
              clearInterval(poll);
              message.error({ content: status.data?.error || 'Sync failed', key: 'sync' });
              setSyncingShop(null);
            }
          } catch {
            clearInterval(poll);
            setSyncingShop(null);
          }
        }, 3000);
        // Safety timeout — stop polling after 5 minutes
        setTimeout(() => { clearInterval(poll); setSyncingShop(null); }, 300000);
      } else if (res.success) {
        message.success(res.message || `"${shop.shopName}" synced!`);
        refreshShops();
        setSyncingShop(null);
      } else {
        message.error(res.message || 'Sync failed');
        setSyncingShop(null);
      }
    } catch (err) {
      // If shop is already syncing, show status instead of error
      if (err?.response?.status === 409) {
        message.info(err.response.data.message || 'Shop is already syncing');
      } else {
        message.error(err?.response?.data?.message || 'Failed to sync listings');
      }
      setSyncingShop(null);
    }
  };

  // Add another shop handler
  const handleAddShop = async () => {
    if (!shopLimitUnlimited && shops.length >= shopLimit) {
      message.warning(`You've reached your shop limit (${shops.length}/${shopLimit}). Upgrade your plan to connect more shops.`);
      return;
    }
    try {
      const res = await etsyApi.getAuthUrl();
      if (res.success && res.data?.authUrl) {
        window.location.href = res.data.authUrl;
      }
    } catch (err) {
      if (err?.response?.data?.code === 'SHOP_LIMIT_REACHED') {
        message.warning(err.response.data.message);
      } else {
        message.error('Failed to start shop connection');
      }
    }
  };

  /* ── Command Center Cards ── */
  const commandCards = [
    {
      key: 'listing_audit',
      title: 'Audit a Listing',
      desc: 'Get AI-powered SEO recommendations for your Etsy listing',
      icon: <SearchOutlined style={{ fontSize: 28 }} />,
      route: '/audit',
      gradient: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
    },
    {
      key: 'keyword_search',
      title: 'Research Keywords',
      desc: 'Find high-traffic keywords that drive sales',
      icon: <KeyOutlined style={{ fontSize: 28 }} />,
      route: '/keywords',
      gradient: `linear-gradient(135deg, ${colors.success}, #34D399)`,
    },
    {
      key: 'competitor_tracking',
      title: 'Track Competitors',
      desc: 'Monitor competitor shops and stay ahead',
      icon: <TeamOutlined style={{ fontSize: 28 }} />,
      route: '/competitors',
      gradient: `linear-gradient(135deg, ${colors.warning}, #FB923C)`,
    },
  ];

  // If user hasn't connected any Etsy shop, show the onboarding flow
  if (!hasShop && !shopSyncing) {
    return (
      <AppLayout>
        <ConnectShopPrompt
          onConnect={handleAddShop}
        />
      </AppLayout>
    );
  }

  if (shopSyncing) {
    return (
      <AppLayout>
        <SyncingState
          onComplete={() => setShopSyncing(false)}
        />
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      {/* Trial / Expired Alert */}
      {subStatus === "trial" && daysLeft !== null && daysLeft <= 3 && (
        <Alert
          type="warning" showIcon icon={<ClockCircleOutlined />}
          message={`Trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
          description="Upgrade now to keep all features."
          action={<Button type="primary" size="small" onClick={() => navigate("/settings?tab=plans")}>Upgrade</Button>}
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}
      {subStatus === "expired" && (
        <Alert
          type="error" showIcon
          message="Your trial has expired"
          description="Choose a paid plan to continue."
          action={<Button type="primary" danger size="small" onClick={() => navigate("/settings?tab=plans")}>Choose Plan</Button>}
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}

      {/* Success Tracker — Onboarding Gamification */}
      <SuccessTracker />

      {/* Dismissible Welcome Banner */}
      <DashboardBanner />

      {/* ── Connected Shops Manager ────────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShopOutlined style={{ color: BRAND, fontSize: 16 }} />
            <Text strong style={{ fontSize: 15 }}>Connected Shops</Text>
            <Text type="secondary" style={{ fontSize: 13, fontWeight: 500 }}>
              {shops.length}{shopLimitUnlimited ? '' : ` / ${shopLimit}`}
            </Text>
          </div>
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAddShop}
            disabled={!shopLimitUnlimited && shops.length >= shopLimit}
            style={{ color: BRAND, fontWeight: 600 }}
          >
            Add Shop
          </Button>
        </div>

        {/* Slim quota bar */}
        {!shopLimitUnlimited && (
          <Progress
            percent={Math.round((shops.length / Math.max(shopLimit, 1)) * 100)}
            showInfo={false}
            size="small"
            strokeColor={BRAND}
            trailColor={isDark ? '#2e2e4a' : '#ebebf8'}
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Shop rows */}
        {shopLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>
        ) : shops.length > 0 ? (
          <div style={{
            border: `1px solid ${isDark ? '#2e2e4a' : '#ebebf8'}`,
            borderRadius: radii.lg,
            background: tok.colorBgContainer,
            overflow: 'hidden',
          }}>
            {shops.map((shop, idx) => {
              const isActive = activeShop?.id === shop.id;
              return (
                <div
                  key={shop.id}
                  onClick={() => selectShop(shop.id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '12px 20px',
                    cursor: 'pointer',
                    transition: 'background 0.2s, border-color 0.2s',
                    borderBottom: idx < shops.length - 1 ? `1px solid ${isDark ? '#2e2e4a' : '#f0f0f5'}` : 'none',
                    borderLeft: `3px solid ${isActive ? BRAND : 'transparent'}`,
                    background: isActive
                      ? (isDark ? 'rgba(108,99,255,0.10)' : 'rgba(108,99,255,0.05)')
                      : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isActive) {
                      e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(108,99,255,0.025)';
                      e.currentTarget.style.borderLeftColor = isDark ? '#4a4a6a' : '#c4b5fd';
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isActive
                      ? (isDark ? 'rgba(108,99,255,0.10)' : 'rgba(108,99,255,0.05)')
                      : 'transparent';
                    e.currentTarget.style.borderLeftColor = isActive ? BRAND : 'transparent';
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 36, height: 36, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${BRAND}, ${colors.brandLight})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: isActive ? `0 0 0 2px ${BRAND}33` : 'none',
                  }}>
                    <ShopOutlined style={{ fontSize: 16, color: '#fff' }} />
                  </div>

                  {/* Name + active indicator */}
                  <div style={{ flex: '1 1 auto', minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Text strong style={{ fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {shop.shopName}
                      </Text>
                      {isActive && (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 600, color: colors.success,
                        }}>
                          <span style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: colors.success, display: 'inline-block',
                            animation: 'sellseraPulse 2s ease-in-out infinite',
                          }} />
                          Active
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Compact stats */}
                  <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', flexShrink: 0 }}>
                    {shop.listingCount ?? 0} listings · {shop.totalSales ?? 0} sales
                  </Text>

                  {/* Action icons — ghost style */}
                  <div
                    className="shop-row-actions"
                    style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0, opacity: 0.45, transition: 'opacity 0.15s' }}
                    onClick={e => e.stopPropagation()}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.45}
                  >
                    <Tooltip title="Sync listings">
                      <Button
                        type="text" size="small"
                        icon={<SyncOutlined spin={syncingShop === shop.id} />}
                        loading={syncingShop === shop.id}
                        onClick={() => handleSync(shop)}
                        style={{ color: tok.colorTextSecondary }}
                      />
                    </Tooltip>
                    <Tooltip title="View on Etsy">
                      <Button
                        type="text" size="small"
                        icon={<ExportOutlined />}
                        href={`https://www.etsy.com/shop/${shop.shopName}`}
                        target="_blank"
                        style={{ color: tok.colorTextSecondary }}
                      />
                    </Tooltip>
                    <Tooltip title="Disconnect">
                      <Button
                        type="text" size="small" danger
                        icon={<DisconnectOutlined />}
                        loading={disconnecting === shop.id}
                        onClick={() => handleDisconnect(shop)}
                      />
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <Card style={{ ...card, textAlign: 'center', padding: '20px 0' }}>
            <Text type="secondary">No shops connected yet</Text>
          </Card>
        )}
      </div>

      {/* Command Center — Feature Action Cards */}
      <Title level={4} style={{ marginBottom: 16 }}>
        <RocketOutlined style={{ color: BRAND, marginRight: 8 }} />
        Command Center
      </Title>
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {commandCards.map(cc => {
          const access = getFeatureAccess(cc.key);
          const isLocked = access.state === 'locked';
          return (
            <Col xs={24} sm={8} key={cc.key}>
              <Card
                hoverable
                style={{
                  ...card,
                  cursor: 'pointer',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  position: 'relative',
                  overflow: 'hidden',
                }}
                styles={{ body: { padding: '24px' } }}
                onClick={() => navigate(cc.route)}
              >
                <div style={{
                  width: 56, height: 56, borderRadius: 14,
                  background: cc.gradient,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', marginBottom: 16,
                  boxShadow: `0 4px 14px rgba(0,0,0,0.15)`,
                  opacity: isLocked ? 0.5 : 1,
                }}>
                  {cc.icon}
                </div>
                <Title level={5} style={{ margin: '0 0 4px', opacity: isLocked ? 0.6 : 1 }}>
                  {cc.title}
                  {isLocked && <LockOutlined style={{ marginLeft: 8, fontSize: 14, color: colors.muted }} />}
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>{cc.desc}</Text>
                {!isLocked && access.limit && !access.unlimited && (
                  <div style={{ marginTop: 12 }}>
                    <Progress
                      percent={Math.round((access.used / access.limit) * 100)}
                      size="small" showInfo={false}
                      strokeColor={cc.gradient}
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>{access.used}/{access.limit} used</Text>
                  </div>
                )}
                {isLocked && (
                  <Tag color="default" style={{ marginTop: 12, fontSize: 11 }}>
                    <LockOutlined /> Upgrade to unlock
                  </Tag>
                )}
              </Card>
            </Col>
          );
        })}
      </Row>

      {/* Recent Activity */}
      <Row gutter={[20, 20]}>
        <Col xs={24}>
          <Card
            style={card}
            title={<><HistoryOutlined style={{ color: BRAND, marginRight: 8 }} /> Recent Analyses</>}
            extra={recentAnalyses.length > 0 && <Button type="link" onClick={() => navigate('/history')}>View All</Button>}
          >
            {recentAnalyses.length > 0 ? (
              <List
                dataSource={recentAnalyses}
                renderItem={item => (
                  <List.Item
                    style={{ cursor: 'pointer', padding: '12px 0' }}
                    onClick={() => navigate(`/history/${item.id}`)}
                    actions={[
                      <Button type="text" size="small" icon={<EyeOutlined />} key="view">View</Button>
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong style={{ fontSize: 13 }}>{item.title}</Text>}
                      description={
                        <Space>
                          <Tag>{item.category}</Tag>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Text>
                        </Space>
                      }
                    />
                    <Tag
                      color={item.score >= 80 ? 'green' : item.score >= 60 ? 'gold' : 'red'}
                      style={{ fontWeight: 700, fontSize: 14, padding: '2px 12px' }}
                    >
                      {item.score}
                    </Tag>
                  </List.Item>
                )}
              />
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" size={8} style={{ textAlign: 'center' }}>
                    <Text type="secondary">No analyses yet</Text>
                    <Button type="primary" icon={<ThunderboltOutlined />} onClick={() => navigate('/audit')}
                      style={{ background: `linear-gradient(135deg, ${BRAND}, #A78BFA)`, border: 'none' }}>
                      Run Your First Audit
                    </Button>
                  </Space>
                }
              />
            )}
          </Card>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default DashboardPage;
