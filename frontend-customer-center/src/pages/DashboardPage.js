import React from "react";
import {
  Row, Col, Card, Statistic, Button, Typography,
  Tag, Progress, theme, Alert, Space
} from "antd";
import {
  ThunderboltOutlined, RocketOutlined,
  CrownOutlined, CalendarOutlined, CreditCardOutlined, ClockCircleOutlined,
  ArrowRightOutlined, SyncOutlined
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSite } from "../context/SiteContext";

const { Title, Text } = Typography;
const BRAND = "#6C63FF";

const DashboardPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { siteConfig } = useSite();
  const { token: tok } = theme.useToken();
  const navigate = useNavigate();
  const analysisEnabled = siteConfig?.enableAnalysis !== false;
  const subscriptionsEnabled = siteConfig?.enableSubscriptions !== false;

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
    borderRadius: 16,
    background: tok.colorBgContainer,
    boxShadow: isDark ? "none" : "0 2px 12px rgba(108,99,255,0.06)",
  };

  return (
    <AppLayout>
      {/* Trial / Expired Alert */}
      {subStatus === "trial" && daysLeft !== null && daysLeft <= 3 && (
        <Alert
          type="warning" showIcon icon={<ClockCircleOutlined />}
          message={`Trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
          description="Upgrade now to keep all features."
          action={<Button type="primary" size="small" onClick={() => navigate("/plans")}>Upgrade</Button>}
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}
      {subStatus === "expired" && (
        <Alert
          type="error" showIcon
          message="Your trial has expired"
          description="Choose a paid plan to continue."
          action={<Button type="primary" danger size="small" onClick={() => navigate("/plans")}>Choose Plan</Button>}
          style={{ marginBottom: 20, borderRadius: 12 }}
        />
      )}

      {/* Welcome + Plan Banner */}
      <Card
        style={{
          ...card,
          background: `linear-gradient(135deg, ${BRAND} 0%, #4facfe 100%)`,
          marginBottom: 24,
        }}
        styles={{ body: { padding: "24px 28px" } }}
      >
        <Row align="middle" gutter={[24, 16]}>
          <Col xs={24} md={16}>
            <Title level={3} style={{ color: "#fff", margin: 0 }}>
              Welcome back, {user?.name?.split(" ")[0] || "there"}!
            </Title>
            <Space style={{ marginTop: 8 }}>
              <Tag color="rgba(255,255,255,0.25)" style={{ color: "#fff", border: "none", fontWeight: 600 }}>
                <CrownOutlined /> {planName} Plan
              </Tag>
              <Tag
                color={
                  subStatus === "active" ? "green"
                    : subStatus === "trial" ? "blue"
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
                <Button ghost icon={<CrownOutlined />} onClick={() => navigate("/subscription")}>
                  My Subscription
                </Button>
              )}
              {subscriptionsEnabled && (
                <Button
                  type="default"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate("/plans")}
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
              strokeColor={usagePct >= 90 ? "#ff4d4f" : { from: BRAND, to: "#4facfe" }}
              size="small" style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
        )}
        {subscriptionsEnabled && (
        <Col xs={24} sm={12} md={6}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }} hoverable onClick={() => navigate("/subscription")}>
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
          <Card style={card} styles={{ body: { padding: "20px 24px" } }} hoverable onClick={() => navigate("/billing")}>
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
    </AppLayout>
  );
};

export default DashboardPage;
