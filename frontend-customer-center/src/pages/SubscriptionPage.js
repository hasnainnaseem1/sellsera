import React, { useEffect, useState, useRef } from 'react';
import {
  Card, Row, Col, Typography, Progress, Button, Tag, Statistic, Space,
  Alert, theme, message, Modal, Descriptions
} from 'antd';
import {
  RocketOutlined, ThunderboltOutlined, CrownOutlined, CalendarOutlined,
  CreditCardOutlined, ArrowRightOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ExclamationCircleOutlined, SyncOutlined,
  StopOutlined, PlayCircleOutlined, DollarOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import billingApi from '../api/billingApi';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const statusColors = {
  active: 'green',
  trial: 'blue',
  expired: 'red',
  cancelled: 'orange',
  past_due: 'volcano',
  inactive: 'default',
  none: 'default',
};

const statusIcons = {
  active: <CheckCircleOutlined />,
  trial: <ClockCircleOutlined />,
  expired: <ExclamationCircleOutlined />,
  cancelled: <ExclamationCircleOutlined />,
  past_due: <ExclamationCircleOutlined />,
};

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
};

const SubscriptionPage = () => {
  const { user, fetchMe, token } = useAuth();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const navigate = useNavigate();
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchMe(token);
    }
  }, [token, fetchMe]);

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const data = await billingApi.createPortal();
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        message.error(data.message || 'Could not open billing portal');
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Could not open billing portal. You may need an active subscription first.';
      message.error(msg);
    } finally {
      setPortalLoading(false);
    }
  };

  // Derived state
  const usagePct = user ? Math.round((user.analysisCount / (user.analysisLimit || 1)) * 100) : 0;
  const subStatus = user?.subscriptionStatus || 'none';
  const planName = user?.planSnapshot?.planName || user?.plan || 'Free';
  const billingCycle = user?.billingCycle || 'none';
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86400000)) : null;
  const renewsAt = user?.subscriptionExpiresAt;
  const startedAt = user?.subscriptionStartDate;
  const isActive = subStatus === 'active';
  const isTrial = subStatus === 'trial';
  const isCancelled = subStatus === 'cancelled';
  const isPastDue = subStatus === 'past_due';
  const isExpired = subStatus === 'expired';
  const hasSubscription = isActive || isTrial || isCancelled || isPastDue;

  const handleCancelSubscription = () => {
    Modal.confirm({
      title: 'Cancel Subscription',
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to cancel your <strong>{planName}</strong> subscription?</p>
          <p style={{ color: '#8c8c8c', fontSize: 13 }}>
            Your subscription will remain active until the end of your current billing period
            {renewsAt && <> (<strong>{formatDate(renewsAt)}</strong>)</>}.
            You can resume anytime before it expires.
          </p>
        </div>
      ),
      okText: 'Yes, Cancel',
      okButtonProps: { danger: true },
      cancelText: 'Keep Subscription',
      onOk: async () => {
        setCancelLoading(true);
        try {
          const data = await billingApi.cancelSubscription({ immediate: false });
          message.success(data.message || 'Subscription will be cancelled at period end.');
          if (token) await fetchMe(token);
        } catch (err) {
          message.error(err.response?.data?.message || 'Failed to cancel subscription');
        } finally {
          setCancelLoading(false);
        }
      },
    });
  };

  const handleResumeSubscription = async () => {
    setResumeLoading(true);
    try {
      const data = await billingApi.resumeSubscription();
      message.success(data.message || 'Subscription resumed successfully!');
      if (token) await fetchMe(token);
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to resume subscription');
    } finally {
      setResumeLoading(false);
    }
  };

  const card = {
    border: `1px solid ${isDark ? '#2e2e4a' : '#ebebf8'}`,
    borderRadius: 16,
    background: tok.colorBgContainer,
    boxShadow: isDark ? 'none' : '0 2px 12px rgba(108,99,255,0.06)',
  };

  return (
    <AppLayout>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            <CrownOutlined style={{ color: BRAND }} /> My Subscription
          </Title>
          <Text type="secondary">Manage your plan, view usage, and billing details</Text>
        </div>

        {/* Trial Warning */}
        {isTrial && daysLeft !== null && daysLeft <= 3 && (
          <Alert
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
            message={`Trial expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
            description="Upgrade now to keep using all features without interruption."
            action={
              <Button type="primary" size="small" onClick={() => navigate('/plans')}>
                Upgrade Now
              </Button>
            }
            style={{ marginBottom: 20, borderRadius: 12 }}
          />
        )}

        {isExpired && (
          <Alert
            type="error"
            showIcon
            message="Your subscription has expired"
            description="Upgrade to a paid plan to continue using the platform."
            action={
              <Button type="primary" danger size="small" onClick={() => navigate('/plans')}>
                Choose a Plan
              </Button>
            }
            style={{ marginBottom: 20, borderRadius: 12 }}
          />
        )}

        {isCancelled && (
          <Alert
            type="warning"
            showIcon
            icon={<ExclamationCircleOutlined />}
            message="Your subscription is set to cancel"
            description={
              renewsAt
                ? `Your access will end on ${formatDate(renewsAt)}. Resume your subscription to keep your plan.`
                : 'Your access will end at the end of the current billing period.'
            }
            action={
              <Button type="primary" size="small" onClick={handleResumeSubscription} loading={resumeLoading}>
                Resume Subscription
              </Button>
            }
            style={{ marginBottom: 20, borderRadius: 12 }}
          />
        )}

        {isPastDue && (
          <Alert
            type="error"
            showIcon
            message="Payment past due"
            description="Your last payment failed. Please update your payment method to avoid service interruption."
            action={
              <Button type="primary" danger size="small" onClick={handleManageBilling} loading={portalLoading}>
                Update Payment
              </Button>
            }
            style={{ marginBottom: 20, borderRadius: 12 }}
          />
        )}

        {/* Plan Card */}
        <Card
          style={{
            ...card,
            background: `linear-gradient(135deg, ${BRAND} 0%, #4facfe 100%)`,
            marginBottom: 24,
          }}
          styles={{ body: { padding: 28 } }}
        >
          <Row gutter={[24, 24]} align="middle">
            <Col xs={24} md={14}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <RocketOutlined style={{ fontSize: 28, color: '#fff' }} />
                <div>
                  <Title level={3} style={{ color: '#fff', margin: 0 }}>{planName} Plan</Title>
                  <Space size={4} style={{ marginTop: 4 }}>
                    <Tag color={statusColors[subStatus]} icon={statusIcons[subStatus]}>
                      {subStatus.replace('_', ' ').toUpperCase()}
                    </Tag>
                    {billingCycle !== 'none' && hasSubscription && (
                      <Tag color="rgba(255,255,255,0.25)" style={{ color: '#fff', border: 'none' }}>
                        <CalendarOutlined /> {billingCycle === 'yearly' ? 'Yearly' : 'Monthly'}
                      </Tag>
                    )}
                  </Space>
                </div>
              </div>
              {isTrial && daysLeft !== null && (
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <CalendarOutlined /> Trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? 's' : ''}</strong>
                </Text>
              )}
              {isActive && renewsAt && (
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <SyncOutlined /> Renews on <strong>{formatDate(renewsAt)}</strong>
                </Text>
              )}
              {isCancelled && renewsAt && (
                <Text style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <CalendarOutlined /> Access ends <strong>{formatDate(renewsAt)}</strong>
                </Text>
              )}
            </Col>
            <Col xs={24} md={10} style={{ textAlign: 'right' }}>
              <Space wrap>
                <Button
                  type="default"
                  icon={<ArrowRightOutlined />}
                  onClick={() => navigate('/plans')}
                  style={{ fontWeight: 600 }}
                >
                  {isActive ? 'Change Plan' : 'Upgrade'}
                </Button>
                {hasSubscription && (
                  <Button
                    icon={<CreditCardOutlined />}
                    onClick={handleManageBilling}
                    loading={portalLoading}
                    style={{ fontWeight: 600 }}
                  >
                    Manage Billing
                  </Button>
                )}
                {isCancelled && (
                  <Button
                    type="primary"
                    icon={<PlayCircleOutlined />}
                    onClick={handleResumeSubscription}
                    loading={resumeLoading}
                    style={{ fontWeight: 600, background: '#52c41a', borderColor: '#52c41a' }}
                  >
                    Resume
                  </Button>
                )}
                {(isActive || isTrial) && (
                  <Button
                    danger
                    icon={<StopOutlined />}
                    onClick={handleCancelSubscription}
                    loading={cancelLoading}
                    style={{ fontWeight: 600 }}
                  >
                    Cancel
                  </Button>
                )}
              </Space>
            </Col>
          </Row>
        </Card>

        {/* Subscription Details */}
        {hasSubscription && (
          <Card style={{ ...card, marginBottom: 24 }} styles={{ body: { padding: '20px 28px' } }}>
            <Title level={5} style={{ marginBottom: 16 }}>
              <DollarOutlined style={{ color: BRAND, marginRight: 8 }} />
              Subscription Details
            </Title>
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
              <Descriptions.Item label="Plan">{planName}</Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={statusColors[subStatus]} icon={statusIcons[subStatus]}>
                  {subStatus.replace('_', ' ').toUpperCase()}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Billing Cycle">
                {billingCycle === 'yearly' ? 'Yearly' : billingCycle === 'monthly' ? 'Monthly' : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {formatDate(startedAt)}
              </Descriptions.Item>
              <Descriptions.Item label={isCancelled ? 'Ends On' : 'Renews On'}>
                {formatDate(renewsAt)}
              </Descriptions.Item>
              {isTrial && (
                <Descriptions.Item label="Trial Ends">
                  {formatDate(user?.trialEndsAt)}
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {/* Usage Stats */}
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card style={card} styles={{ body: { padding: '24px 28px' } }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Usage This Month</Text>}
                value={user?.analysisCount || 0}
                suffix={<Text type="secondary">/ {user?.analysisLimit || 0}</Text>}
                prefix={<ThunderboltOutlined style={{ color: BRAND }} />}
                styles={{ content: { color: BRAND, fontWeight: 700 } }}
              />
              <Progress
                percent={Math.min(usagePct, 100)}
                showInfo={false}
                strokeColor={usagePct >= 90 ? '#ff4d4f' : { from: BRAND, to: '#4facfe' }}
                size="small"
                style={{ marginTop: 10 }}
              />
              {usagePct >= 90 && (
                <Text type="danger" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                  You're running low on analyses. Consider upgrading.
                </Text>
              )}
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card style={card} styles={{ body: { padding: '24px 28px' } }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Next Usage Reset</Text>}
                value={user?.monthlyResetDate
                  ? new Date(user.monthlyResetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                  : 'N/A'
                }
                prefix={<SyncOutlined style={{ color: '#52c41a' }} />}
                styles={{ content: { fontWeight: 700, fontSize: 18 } }}
              />
              <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: 'block' }}>
                Your usage counter resets on this date each month.
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Quick Actions */}
        <Card style={{ ...card, marginBottom: 24 }} styles={{ body: { padding: '20px 28px' } }}>
          <Title level={5} style={{ marginBottom: 16 }}>Quick Actions</Title>
          <Space wrap size="middle">
            <Button icon={<CrownOutlined />} onClick={() => navigate('/plans')}>
              View Plans
            </Button>
            <Button icon={<CreditCardOutlined />} onClick={() => navigate('/billing')}>
              Payment History
            </Button>
            {hasSubscription && (
              <Button icon={<CreditCardOutlined />} onClick={handleManageBilling} loading={portalLoading}>
                Update Payment Method
              </Button>
            )}
          </Space>
        </Card>

        {/* Features */}
        {user?.planSnapshot?.features?.length > 0 && (
          <Card
            style={card}
            styles={{ body: { padding: '24px 28px' } }}
            title={<span><CheckCircleOutlined style={{ color: BRAND, marginRight: 8 }} />Plan Features</span>}
          >
            <Row gutter={[16, 12]}>
              {user.planSnapshot.features.map((f, i) => (
                <Col xs={24} sm={12} key={i}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 12px',
                    background: isDark ? '#0f0f1a' : '#f7f7ff',
                    borderRadius: 8,
                  }}>
                    <CheckCircleOutlined style={{ color: f.enabled ? '#52c41a' : '#d9d9d9' }} />
                    <Text style={{ flex: 1 }}>{f.featureName || f.featureKey}</Text>
                    {f.limit !== null && f.limit !== undefined && (
                      <Tag color="blue">{f.limit === -1 ? 'Unlimited' : f.limit}</Tag>
                    )}
                  </div>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default SubscriptionPage;
