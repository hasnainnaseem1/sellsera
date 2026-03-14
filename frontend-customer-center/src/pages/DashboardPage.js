import React, { useState, useEffect } from "react";
import {
  Row, Col, Card, Statistic, Button, Typography,
  Tag, Progress, theme, Alert, Space, List, Empty
} from "antd";
import {
  ThunderboltOutlined, RocketOutlined,
  CrownOutlined, CalendarOutlined, CreditCardOutlined, ClockCircleOutlined,
  ArrowRightOutlined, SyncOutlined, SearchOutlined, KeyOutlined,
  TeamOutlined, HistoryOutlined, EyeOutlined, LockOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import SuccessTracker from "../components/dashboard/SuccessTracker";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSite } from "../context/SiteContext";
import { usePermissions } from "../context/PermissionsContext";
import { colors, radii } from "../theme/tokens";
import analysisApi from "../api/analysisApi";

const { Title, Text } = Typography;
const BRAND = "#6C63FF";

const DashboardPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { siteConfig } = useSite();
  const { getFeatureAccess } = usePermissions();
  const { token: tok } = theme.useToken();
  const navigate = useNavigate();
  const analysisEnabled = siteConfig?.enableAnalysis !== false;
  const subscriptionsEnabled = siteConfig?.enableSubscriptions !== false;

  const [recentAnalyses, setRecentAnalyses] = useState([]);

  const usagePct = user ? Math.round((user.analysisCount / (user.analysisLimit || 1)) * 100) : 0;
  const subStatus = user?.subscriptionStatus || "inactive";
  const planName = user?.planSnapshot?.planName || user?.plan || "Free";
  const billingCycle = user?.billingCycle || 'none';
  const renewsAt = user?.subscriptionExpiresAt;
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86400000)) : null;
  const isActive = subStatus === 'active';
  const isCancelled = subStatus === 'cancelled';
  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

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

      {/* Welcome + Plan Banner */}
      <Card
        style={{
          ...card,
          background: `linear-gradient(135deg, ${BRAND} 0%, #A78BFA 100%)`,
          marginBottom: 24,
        }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <Row align="middle" gutter={[24, 16]}>
          <Col xs={24} md={16}>
            <Title level={3} style={{ color: "#fff", margin: 0 }}>
              Welcome back, {user?.name?.split(" ")[0] || "there"}!
            </Title>
            <Space style={{ marginTop: 8 }} wrap>
              <Tag color="rgba(255,255,255,0.25)" style={{ color: "#fff", border: "none", fontWeight: 600 }}>
                <CrownOutlined /> {planName} Plan
              </Tag>
              <Tag
                color={
                  subStatus === "active" ? "green"
                    : subStatus === "trial" ? "purple"
                      : subStatus === "cancelled" ? "orange"
                        : subStatus === "expired" ? "red"
                          : "default"
                }
              >
                {subStatus.replace("_", " ").toUpperCase()}
              </Tag>
              {billingCycle !== 'none' && (isActive || isCancelled) && (
                <Tag color="rgba(255,255,255,0.25)" style={{ color: '#fff', border: 'none' }}>
                  <CalendarOutlined /> {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                </Tag>
              )}
              {subStatus === "trial" && daysLeft !== null && (
                <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                  <CalendarOutlined /> {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
                </Text>
              )}
              {isActive && renewsAt && (
                <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                  <SyncOutlined /> Renews {formatDate(renewsAt)}
                </Text>
              )}
              {isCancelled && renewsAt && (
                <Text style={{ color: "rgba(255,255,255,0.85)" }}>
                  <ClockCircleOutlined /> Ends {formatDate(renewsAt)}
                </Text>
              )}
            </Space>
          </Col>
          <Col xs={24} md={8} style={{ textAlign: "right" }}>
            <Space>
              {subscriptionsEnabled && (
                <Button ghost icon={<CrownOutlined />} onClick={() => navigate("/settings?tab=subscription")}>
                  My Subscription
                </Button>
              )}
              {subscriptionsEnabled && (
                <Button
                  type="default"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate("/settings?tab=plans")}
                  style={{ fontWeight: 600 }}
                >
                  {subStatus === "active" ? "Change Plan" : "Upgrade"}
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Stats Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {analysisEnabled && (
        <Col xs={24} sm={12} md={6}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Usage</Text>}
              value={user?.analysisCount || 0}
              suffix={<Text type="secondary">/ {user?.analysisLimit || 1}</Text>}
              prefix={<ThunderboltOutlined style={{ color: BRAND }} />}
              styles={{ content: { color: BRAND, fontWeight: 700 } }}
            />
            <Progress
              percent={Math.min(usagePct, 100)}
              showInfo={false}
              strokeColor={usagePct >= 90 ? "#ff4d4f" : { from: BRAND, to: "#A78BFA" }}
              size="small" style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        )}
        {subscriptionsEnabled && (
        <Col xs={24} sm={12} md={6}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }} hoverable onClick={() => navigate("/settings?tab=subscription")}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Current Plan</Text>}
              value={planName}
              prefix={<RocketOutlined style={{ color: "#52c41a" }} />}
              styles={{ content: { color: "#52c41a", fontWeight: 700 } }}
            />
          </Card>
        </Col>
        )}
        {subscriptionsEnabled && (
        <Col xs={24} sm={12} md={6}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }} hoverable onClick={() => navigate("/settings?tab=billing")}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Billing</Text>}
              value="View History"
              prefix={<CreditCardOutlined style={{ color: "#faad14" }} />}
              styles={{ content: { color: "#faad14", fontWeight: 700, fontSize: 14 } }}
            />
          </Card>
        </Col>
        )}
        {analysisEnabled && (
        <Col xs={24} sm={12} md={6}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Next Reset</Text>}
              value={user?.monthlyResetDate
                ? new Date(user.monthlyResetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : "N/A"
              }
              prefix={<SyncOutlined style={{ color: "#722ed1" }} />}
              styles={{ content: { color: "#722ed1", fontWeight: 700, fontSize: 16 } }}
            />
          </Card>
        </Col>
        )}
      </Row>

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
