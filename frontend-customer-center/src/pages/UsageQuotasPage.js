import React from 'react';
import {
  Card, Typography, Row, Col, Progress, Statistic, Button,
  Tag, Table, Space, theme, Divider,
} from 'antd';
import {
  ThunderboltOutlined, CrownOutlined, CalendarOutlined,
  CheckCircleOutlined, ArrowRightOutlined,
  RocketOutlined, SyncOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { usePermissions } from '../context/PermissionsContext';
import { colors, radii, usageColor } from '../theme/tokens';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const UsageQuotasPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { features, plan } = usePermissions();
  const { token: tok } = theme.useToken();
  const navigate = useNavigate();

  const card = {
    border: `1px solid ${isDark ? '#2e2e4a' : '#ebebf8'}`,
    borderRadius: radii.lg,
    background: tok.colorBgContainer,
    boxShadow: isDark ? 'none' : '0 2px 12px rgba(108,99,255,0.06)',
  };

  /* ── Build quota rows from permissions features ── */
  const featureLabels = {
    connect_shops:        'Connected Shops',
    listing_audit:        'Listing Audits',
    keyword_search:       'Keyword Searches',
    keyword_deep_analysis:'Deep Analyses',
    bulk_rank_check:      'Bulk Rank Checks',
    tag_analysis:         'Tag Analyses',
    listing_sync:         'Active Listings',
    competitor_tracking:  'Competitor Tracks',
    competitor_sales:     'Sales Trackers',
  };

  const quotaRows = Object.entries(features)
    .filter(([, f]) => f.enabled)
    .map(([key, f]) => {
      const pct = f.unlimited ? 0 : f.limit ? Math.round((f.used / f.limit) * 100) : 0;
      return {
        key,
        label: featureLabels[key] || f.featureName || key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        used: f.used || 0,
        limit: f.limit,
        unlimited: f.unlimited,
        pct,
        color: f.unlimited ? colors.success : usageColor(f.used || 0, f.limit),
      };
    });

  /* ── Usage table columns ── */
  const quotaColumns = [
    {
      title: 'Feature',
      dataIndex: 'label',
      key: 'label',
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 280,
      render: (_, row) => (
        <div>
          {row.unlimited ? (
            <Space size={4}>
              <CheckCircleOutlined style={{ color: colors.success }} />
              <Text type="secondary">Unlimited</Text>
            </Space>
          ) : (
            <>
              <Progress
                percent={Math.min(row.pct, 100)}
                size="small"
                showInfo={false}
                strokeColor={row.color}
                style={{ marginBottom: 2, maxWidth: 200 }}
              />
              <Text style={{ fontSize: 12, color: row.color, fontWeight: 600 }}>
                {row.used} / {row.limit} used
              </Text>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, row) => {
        if (row.unlimited) return <Tag color="green">Unlimited</Tag>;
        if (row.pct >= 100) return <Tag color="red">Limit Reached</Tag>;
        if (row.pct >= 80) return <Tag color="orange">Running Low</Tag>;
        return <Tag color="green">Available</Tag>;
      },
    },
  ];

  /* ── Plan state ── */
  const planName = plan?.name || user?.planSnapshot?.planName || 'Free';
  const planStatus = plan?.status || user?.subscriptionStatus || 'none';
  const isActive = planStatus === 'active';
  const isTrial = planStatus === 'trial';
  const resetDate = plan?.monthlyResetDate || user?.monthlyResetDate;

  const statusConfig = {
    active:    { color: 'green',   text: 'Active' },
    trial:     { color: 'purple',  text: 'Trial' },
    cancelled: { color: 'orange',  text: 'Cancelled' },
    expired:   { color: 'red',     text: 'Expired' },
    none:      { color: 'default', text: 'No Plan' },
  };
  const sc = statusConfig[planStatus] || statusConfig.none;

  /* ── Highest usage feature (for the upgrade nudge) ── */
  const highUsage = quotaRows
    .filter(r => !r.unlimited && r.pct >= 70)
    .sort((a, b) => b.pct - a.pct);

  return (
    <AppLayout>
      <Title level={3} style={{ marginBottom: 4 }}>
        <CrownOutlined style={{ color: BRAND, marginRight: 10 }} />
        Usage &amp; Quotas
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        Monitor your quotas and manage your subscription in one place.
      </Text>

      {/* ── Plan Summary Row ── */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Current Plan</Text>}
              value={planName}
              prefix={<RocketOutlined style={{ color: BRAND }} />}
              suffix={<Tag color={sc.color} style={{ marginLeft: 8 }}>{sc.text}</Tag>}
              styles={{ content: { fontWeight: 700 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Next Quota Reset</Text>}
              value={resetDate
                ? new Date(resetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                : 'N/A'
              }
              prefix={<CalendarOutlined style={{ color: colors.info }} />}
              styles={{ content: { fontWeight: 700, fontSize: 16 } }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>Billing Cycle</Text>}
              value={user?.billingCycle === 'yearly' ? 'Annual' : user?.billingCycle === 'monthly' ? 'Monthly' : 'None'}
              prefix={<SyncOutlined style={{ color: colors.warning }} />}
              styles={{ content: { fontWeight: 700, fontSize: 16 } }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Upgrade Nudge (only when near limits) ── */}
      {highUsage.length > 0 && !isTrial && (
        <Card
          style={{
            ...card,
            marginBottom: 24,
            background: isDark ? `${BRAND}12` : `linear-gradient(135deg, ${BRAND}08, #A78BFA10)`,
            border: `1px solid ${BRAND}25`,
          }}
          styles={{ body: { padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 } }}
        >
          <div>
            <Text strong style={{ fontSize: 15 }}>
              <RocketOutlined style={{ color: BRAND, marginRight: 8 }} />
              You're using {highUsage[0].pct}% of your {highUsage[0].label} quota
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 13 }}>
              Upgrade for higher limits and unlock premium features.
            </Text>
          </div>
          <Button
            type="primary"
            icon={<ArrowRightOutlined />}
            onClick={() => navigate('/settings?tab=plans')}
            style={{
              background: `linear-gradient(135deg, ${BRAND}, #A78BFA)`,
              border: 'none', fontWeight: 600,
              boxShadow: '0 4px 16px rgba(108,99,255,0.35)',
            }}
          >
            View Plans
          </Button>
        </Card>
      )}

      {/* ── Trial nudge ── */}
      {isTrial && (
        <Card
          style={{
            ...card,
            marginBottom: 24,
            background: `linear-gradient(135deg, ${BRAND}, #A78BFA)`,
          }}
          styles={{ body: { padding: '20px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 } }}
        >
          <div>
            <Text strong style={{ fontSize: 15, color: '#fff' }}>
              <CrownOutlined style={{ marginRight: 8 }} />
              You're on a free trial
            </Text>
            <br />
            <Text style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
              Pick a plan to keep all your data and unlock full quotas.
            </Text>
          </div>
          <Button
            size="large"
            onClick={() => navigate('/settings?tab=plans')}
            style={{ fontWeight: 600, borderRadius: radii.md }}
          >
            Choose a Plan
          </Button>
        </Card>
      )}

      {/* ── Feature Quotas Table ── */}
      <Card
        style={{ ...card, marginBottom: 24 }}
        title={
          <Space>
            <ThunderboltOutlined style={{ color: BRAND }} />
            <Text strong>Feature Quotas</Text>
            {isActive && <Tag color="green" style={{ marginLeft: 8 }}>Active</Tag>}
          </Space>
        }
      >
        {quotaRows.length > 0 ? (
          <Table
            dataSource={quotaRows}
            columns={quotaColumns}
            pagination={false}
            size="middle"
            showHeader
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '32px 0' }}>
            <Text type="secondary">No features on your current plan.</Text>
            <br />
            <Button type="link" onClick={() => navigate('/settings?tab=plans')}>
              Explore Plans
            </Button>
          </div>
        )}
      </Card>

      <Divider style={{ margin: '12px 0 24px' }} />

      {/* ── Quick Links ── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={8}>
          <Button block size="large" onClick={() => navigate('/settings?tab=subscription')}
            style={{ borderRadius: radii.md, textAlign: 'left' }}>
            <CrownOutlined style={{ color: BRAND, marginRight: 8 }} />
            Manage Subscription
          </Button>
        </Col>
        <Col xs={24} sm={8}>
          <Button block size="large" onClick={() => navigate('/settings?tab=billing')}
            style={{ borderRadius: radii.md, textAlign: 'left' }}>
            <CalendarOutlined style={{ color: colors.warning, marginRight: 8 }} />
            Payment History
          </Button>
        </Col>
        <Col xs={24} sm={8}>
          <Button block size="large" onClick={() => navigate('/settings?tab=plans')}
            style={{ borderRadius: radii.md, textAlign: 'left' }}>
            <RocketOutlined style={{ color: colors.success, marginRight: 8 }} />
            Compare Plans
          </Button>
        </Col>
      </Row>
    </AppLayout>
  );
};

export default UsageQuotasPage;
