import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Segmented, message, Card, Table, Tag, Empty, Statistic, Typography,
  Avatar, Timeline, Tooltip, Badge, Tabs, Space, Button, Progress, List, Descriptions,
} from 'antd';
import {
  ThunderboltOutlined, ApiOutlined, TeamOutlined, UserOutlined,
  DollarOutlined, ArrowUpOutlined, ArrowDownOutlined,
  ClockCircleOutlined, CrownOutlined, TrophyOutlined, ReloadOutlined,
  BarChartOutlined, RiseOutlined, LineChartOutlined,
  CheckCircleOutlined, WarningOutlined, LockOutlined,
  PieChartOutlined, FundOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import GrowthChart from '../components/charts/GrowthChart';
import DistributionChart from '../components/charts/DistributionChart';
import PermissionGuard from '../components/guards/PermissionGuard';
import { usePermission } from '../hooks/usePermission';
import analyticsApi from '../api/analyticsApi';
import { formatNumber } from '../utils/helpers';

const { Text, Title } = Typography;

// ─── Dynamic chart imports ───
let Line, Pie, Column;
try {
  const charts = require('@ant-design/charts');
  Line = charts.Line;
  Pie = charts.Pie;
  Column = charts.Column;
} catch {
  Line = null;
  Pie = null;
  Column = null;
}

// ─── Stat Card ───
const StatCard = ({ title, value, icon, color, prefix, suffix, onClick, loading: cardLoading }) => (
  <Card
    hoverable={!!onClick}
    onClick={onClick}
    style={{ cursor: onClick ? 'pointer' : 'default', height: '100%', borderTop: `3px solid ${color}` }}
    styles={{ body: { padding: '20px 24px' } }}
    loading={cardLoading}
  >
    <Statistic
      title={<Text type="secondary" style={{ fontSize: 13 }}>{title}</Text>}
      value={value ?? 0}
      formatter={(val) => (prefix ? `${prefix}${formatNumber(val)}` : formatNumber(val))}
      prefix={
        <span style={{
          color, marginRight: 8, fontSize: 20, background: `${color}15`,
          padding: '6px 8px', borderRadius: 8, display: 'inline-flex',
        }}>
          {icon}
        </span>
      }
      valueStyle={{ fontSize: 28, fontWeight: 700 }}
    />
    {suffix && <div style={{ marginTop: 4 }}>{suffix}</div>}
  </Card>
);

// ─── Mini Line Chart ───
const MiniLineChart = ({ data, xField, yField, height = 250, color, loading }) => {
  if (!Line || !data?.length) {
    return <Card loading={loading}><Empty description="No data" /></Card>;
  }
  return (
    <Line
      data={data}
      xField={xField}
      yField={yField}
      smooth
      height={height}
      style={{ lineWidth: 2 }}
      color={color}
      point={{ shapeField: 'square', sizeField: 2 }}
      interaction={{ tooltip: { marker: true } }}
    />
  );
};

const AnalyticsPage = () => {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30d');
  const [activeTab, setActiveTab] = useState('overview');

  // Data states
  const [overview, setOverview] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [planDistribution, setPlanDistribution] = useState(null);
  const [usageStats, setUsageStats] = useState(null);
  const [topCustomers, setTopCustomers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [loginAnalytics, setLoginAnalytics] = useState(null);
  const [featureAdoption, setFeatureAdoption] = useState(null);
  const [perPlanUsage, setPerPlanUsage] = useState(null);
  const [revenueStats, setRevenueStats] = useState(null);
  const [advancedRevenue, setAdvancedRevenue] = useState(null);

  const navigate = useNavigate();
  const { hasPermission } = usePermission();

  // RBAC
  const getCurrentUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
      return user.role || 'viewer';
    } catch { return 'viewer'; }
  };
  const userRole = getCurrentUserRole();
  const canSeeRevenue = userRole === 'admin' || userRole === 'super_admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const calls = [
        analyticsApi.getOverview(timeframe),
        analyticsApi.getUsersGrowth(timeframe),
        analyticsApi.getSubscriptionDistribution(),
        analyticsApi.getPlanDistribution(),
        analyticsApi.getUsageStats(timeframe),
        analyticsApi.getTopCustomers(10),
        analyticsApi.getRecentActivities(15),
        analyticsApi.getLoginAnalytics(timeframe),
        analyticsApi.getFeatureAdoption(timeframe),
        analyticsApi.getPerPlanUsage(timeframe),
      ];
      // Revenue — admin/super_admin only
      if (canSeeRevenue) {
        calls.push(analyticsApi.getRevenueStats(timeframe));
        calls.push(analyticsApi.getRevenueAdvanced(timeframe));
      }

      const results = await Promise.allSettled(calls);

      if (results[0].status === 'fulfilled') setOverview(results[0].value.overview);
      if (results[1].status === 'fulfilled') setGrowthData(results[1].value.data || []);
      if (results[2].status === 'fulfilled') setDistributionData(results[2].value.distribution || []);
      if (results[3].status === 'fulfilled') setPlanDistribution(results[3].value);
      if (results[4].status === 'fulfilled') setUsageStats(results[4].value);
      if (results[5].status === 'fulfilled') setTopCustomers(results[5].value.topCustomers || []);
      if (results[6].status === 'fulfilled') setRecentActivities(results[6].value.activities || []);
      if (results[7].status === 'fulfilled') setLoginAnalytics(results[7].value.loginAnalytics);
      if (results[8].status === 'fulfilled') setFeatureAdoption(results[8].value);
      if (results[9].status === 'fulfilled') setPerPlanUsage(results[9].value);
      if (results[10]?.status === 'fulfilled') setRevenueStats(results[10].value.revenue);
      if (results[11]?.status === 'fulfilled') setAdvancedRevenue(results[11].value.advanced);
    } catch {
      message.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [timeframe, canSeeRevenue]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ═══════════════════════════════════════════════════════════
  // TAB 1: OVERVIEW & USERS
  // ═══════════════════════════════════════════════════════════
  const renderOverviewTab = () => {
    const activityColor = (action) => {
      if (action?.includes('login')) return 'green';
      if (action?.includes('create')) return 'blue';
      if (action?.includes('delete')) return 'red';
      if (action?.includes('update') || action?.includes('edit')) return 'orange';
      return 'gray';
    };

    return (
      <>
        {/* KPI Row */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Total Users"
              value={overview?.users?.total}
              icon={<TeamOutlined />}
              color="#7C3AED"
              onClick={() => navigate('/users')}
              loading={loading}
              suffix={overview?.users?.growth && overview.users.growth !== '0%' ? (
                <Text style={{ fontSize: 12, color: '#52c41a' }}><ArrowUpOutlined /> {overview.users.growth} growth</Text>
              ) : null}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Active Customers"
              value={overview?.customers?.active}
              icon={<UserOutlined />}
              color="#3B82F6"
              onClick={() => navigate('/customers')}
              loading={loading}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard
              title="Feature Usage"
              value={usageStats?.totalUsageEvents}
              icon={<ThunderboltOutlined />}
              color="#10B981"
              loading={loading}
              suffix={usageStats?.usageStats?.length ? (
                <Text style={{ fontSize: 12, color: '#8c8c8c' }}>{usageStats.usageStats.length} active features</Text>
              ) : null}
            />
          </Col>
          {canSeeRevenue ? (
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Monthly Revenue"
                value={overview?.revenue?.monthly}
                icon={<DollarOutlined />}
                color="#F59E0B"
                prefix="$"
                loading={loading}
              />
            </Col>
          ) : (
            <Col xs={24} sm={12} lg={6}>
              <StatCard
                title="Conversion Rate"
                value={overview?.subscriptions?.conversionRate?.replace('%', '')}
                icon={<RiseOutlined />}
                color="#F59E0B"
                loading={loading}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>{overview?.subscriptions?.active || 0} active subs</Text>}
              />
            </Col>
          )}
        </Row>

        {/* User Growth + Subscription Distribution */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={14}>
            <GrowthChart data={growthData} loading={loading} />
          </Col>
          <Col xs={24} lg={10}>
            <DistributionChart data={distributionData} loading={loading} />
          </Col>
        </Row>

        {/* Login Trend + Most Active Users */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={<><LineChartOutlined style={{ marginRight: 8, color: '#10B981' }} />Login Activity Trend</>}
              loading={loading}
            >
              {loginAnalytics?.trend?.length > 0 && Line ? (
                <MiniLineChart data={loginAnalytics.trend} xField="date" yField="logins" color="#10B981" />
              ) : (
                <Empty description="No login data" />
              )}
              {loginAnalytics?.stats && (
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={8}>
                    <Statistic title="Successful" value={loginAnalytics.stats.success || 0} valueStyle={{ color: '#52c41a', fontSize: 18 }} />
                  </Col>
                  <Col span={8}>
                    <Statistic title="Failed" value={loginAnalytics.stats.failed || 0} valueStyle={{ color: '#ff4d4f', fontSize: 18 }} />
                  </Col>
                  <Col span={8}>
                    <Statistic
                      title="Failure Rate"
                      value={
                        (loginAnalytics.stats.success || 0) + (loginAnalytics.stats.failed || 0) > 0
                          ? (((loginAnalytics.stats.failed || 0) / ((loginAnalytics.stats.success || 0) + (loginAnalytics.stats.failed || 0))) * 100).toFixed(1)
                          : 0
                      }
                      suffix="%"
                      valueStyle={{ fontSize: 18 }}
                    />
                  </Col>
                </Row>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={<><TrophyOutlined style={{ marginRight: 8, color: '#F59E0B' }} />Most Active Users (by Logins)</>}
              loading={loading}
            >
              {loginAnalytics?.topUsers?.length > 0 ? (
                <Table
                  dataSource={loginAnalytics.topUsers}
                  columns={[
                    {
                      title: '#', key: 'rank', width: 40,
                      render: (_, __, i) => <Badge count={i + 1} style={{ backgroundColor: i < 3 ? '#faad14' : '#d9d9d9' }} />,
                    },
                    { title: 'User', dataIndex: 'userName', key: 'userName', ellipsis: true },
                    { title: 'Logins', dataIndex: 'loginCount', key: 'loginCount', width: 80, sorter: (a, b) => a.loginCount - b.loginCount, defaultSortOrder: 'descend' },
                    {
                      title: 'Last Login', dataIndex: 'lastLogin', key: 'lastLogin', width: 150,
                      render: (d) => d ? new Date(d).toLocaleDateString() : '—',
                    },
                  ]}
                  rowKey="_id"
                  pagination={false}
                  size="small"
                />
              ) : (
                <Empty description="No login data" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Top Customers + Recent Activity */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <PermissionGuard permission="customers.view" fallback={null}>
            <Col xs={24} lg={12}>
              <Card
                title={<><CrownOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Top Customers</>}
                loading={loading}
                extra={<Button type="link" size="small" onClick={() => navigate('/customers')}>View All</Button>}
              >
                {topCustomers.length > 0 ? (
                  <Table
                    dataSource={topCustomers}
                    columns={[
                      {
                        title: '#', key: 'rank', width: 50,
                        render: (_, __, i) => <Badge count={i + 1} style={{ backgroundColor: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#d48806' : '#d9d9d9' }} />,
                      },
                      {
                        title: 'Customer', key: 'name',
                        render: (_, record) => (
                          <Space>
                            <Avatar size="small" style={{ backgroundColor: '#7C3AED' }}>
                              {(record.customer?.name || record.customer?.email || '?')[0].toUpperCase()}
                            </Avatar>
                            <div>
                              <Text strong>{record.customer?.name || 'Unknown'}</Text>
                              <br /><Text type="secondary" style={{ fontSize: 12 }}>{record.customer?.email}</Text>
                            </div>
                          </Space>
                        ),
                      },
                      {
                        title: 'Plan', key: 'plan', width: 90,
                        render: (_, record) => <Tag color="blue">{record.customer?.plan || 'Free'}</Tag>,
                      },
                      { title: 'Usage', dataIndex: 'totalAnalyses', key: 'totalAnalyses', width: 80 },
                      { title: 'Avg Score', dataIndex: 'averageScore', key: 'averageScore', width: 90 },
                    ]}
                    rowKey={(r) => r.customer?.email || Math.random()}
                    pagination={false}
                    size="small"
                  />
                ) : (
                  <Empty description="No customer data" />
                )}
              </Card>
            </Col>
          </PermissionGuard>

          <PermissionGuard permission="logs.view" fallback={null}>
            <Col xs={24} lg={12}>
              <Card
                title={<><ClockCircleOutlined style={{ marginRight: 8, color: '#3B82F6' }} />Recent Activity</>}
                loading={loading}
                extra={<Button type="link" size="small" onClick={() => navigate('/logs')}>View All</Button>}
                styles={{ body: { maxHeight: 450, overflowY: 'auto' } }}
              >
                {recentActivities.length > 0 ? (
                  <Timeline
                    items={recentActivities.map((a) => ({
                      color: activityColor(a.action),
                      children: (
                        <div>
                          <Text strong>{a.action}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {a.performedBy?.name || a.userName || 'System'} — {new Date(a.createdAt).toLocaleString()}
                          </Text>
                          {a.description && <><br /><Text type="secondary" style={{ fontSize: 11 }}>{a.description}</Text></>}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty description="No recent activity" />
                )}
              </Card>
            </Col>
          </PermissionGuard>
        </Row>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // TAB 2: FEATURES & USAGE
  // ═══════════════════════════════════════════════════════════
  const renderFeaturesTab = () => (
    <>
      {/* Feature Usage Overview (horizontal bars) */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={12}>
          <Card
            title={<><ThunderboltOutlined style={{ marginRight: 8, color: '#10B981' }} />Feature Usage Overview</>}
            loading={loading}
            extra={usageStats && <Text type="secondary">Total: {formatNumber(usageStats.totalUsageEvents || 0)} events</Text>}
          >
            {usageStats?.usageStats?.length > 0 ? (
              <div>
                {usageStats.usageStats.map((f, i) => {
                  const maxUsage = Math.max(...usageStats.usageStats.map((s) => s.totalUsage), 1);
                  const pct = Math.round((f.totalUsage / maxUsage) * 100);
                  return (
                    <div key={f._id || i} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text strong style={{ fontSize: 13 }}>{f.featureName || f._id}</Text>
                        <Space size={12}>
                          <Tooltip title="Unique Users"><Text type="secondary" style={{ fontSize: 12 }}><UserOutlined /> {f.uniqueUsers}</Text></Tooltip>
                          <Text style={{ fontSize: 13, fontWeight: 600 }}>{formatNumber(f.totalUsage)}</Text>
                        </Space>
                      </div>
                      <div style={{ background: '#f5f5f5', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                        <div style={{
                          width: `${pct}%`, height: '100%', borderRadius: 4,
                          background: 'linear-gradient(90deg, #10B981, #3B82F6)',
                          transition: 'width 0.5s ease',
                        }} />
                      </div>
                      {f.limitReached > 0 && (
                        <Text type="warning" style={{ fontSize: 11 }}><WarningOutlined /> {f.limitReached} limit hits</Text>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty description="No feature usage data yet" />
            )}
          </Card>
        </Col>

        {/* Feature Adoption Rates */}
        <Col xs={24} lg={12}>
          <Card
            title={<><RiseOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Feature Adoption Rate</>}
            loading={loading}
            extra={featureAdoption && <Text type="secondary">{featureAdoption.totalCustomers} total customers</Text>}
          >
            {featureAdoption?.features?.length > 0 ? (
              <div>
                {featureAdoption.features.map((f, i) => (
                  <div key={f.featureKey || i} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong style={{ fontSize: 13 }}>{f.featureName}</Text>
                      <Text style={{ fontSize: 13 }}>{f.adoptionRate}%</Text>
                    </div>
                    <Progress
                      percent={f.adoptionRate}
                      showInfo={false}
                      strokeColor={f.adoptionRate > 60 ? '#52c41a' : f.adoptionRate > 30 ? '#faad14' : '#ff4d4f'}
                      size="small"
                    />
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      {f.uniqueUsers} users / {formatNumber(f.totalUsage)} total uses
                    </Text>
                  </div>
                ))}
              </div>
            ) : (
              <Empty description="No adoption data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Per-Plan Usage */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={<><PieChartOutlined style={{ marginRight: 8, color: '#3B82F6' }} />Per-Plan Feature Usage</>}
            loading={loading}
          >
            {perPlanUsage?.perPlanUsage && Object.keys(perPlanUsage.perPlanUsage).length > 0 ? (
              <Tabs
                type="card"
                items={Object.entries(perPlanUsage.perPlanUsage).map(([planName, features]) => ({
                  key: planName,
                  label: <Tag color="blue">{planName || 'Unknown'}</Tag>,
                  children: (
                    <Table
                      dataSource={features}
                      columns={[
                        { title: 'Feature', dataIndex: 'featureName', key: 'featureName', render: (name, r) => <Text strong>{name || r.featureKey}</Text> },
                        { title: 'Total Usage', dataIndex: 'totalUsage', key: 'totalUsage', sorter: (a, b) => a.totalUsage - b.totalUsage, defaultSortOrder: 'descend', render: (v) => formatNumber(v) },
                        { title: 'Unique Users', dataIndex: 'uniqueUsers', key: 'uniqueUsers' },
                        {
                          title: 'Limit', dataIndex: 'avgLimit', key: 'avgLimit',
                          render: (val) => val ? formatNumber(val) : <Tag>Unlimited</Tag>,
                        },
                        {
                          title: 'Limit Hits', dataIndex: 'limitReached', key: 'limitReached',
                          render: (val) => val > 0 ? <Tag color="orange"><WarningOutlined /> {val}</Tag> : <Tag color="green">0</Tag>,
                        },
                      ]}
                      rowKey="featureKey"
                      pagination={false}
                      size="small"
                    />
                  ),
                }))}
              />
            ) : (
              <Empty description="No per-plan usage data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* Full Feature Usage Table */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24}>
          <Card
            title={<><BarChartOutlined style={{ marginRight: 8, color: '#F59E0B' }} />Feature Usage Details</>}
            loading={loading}
          >
            {usageStats?.usageStats?.length > 0 ? (
              <Table
                dataSource={usageStats.usageStats}
                columns={[
                  {
                    title: 'Feature', dataIndex: 'featureName', key: 'featureName',
                    render: (name, record) => (
                      <div>
                        <Text strong>{name || record._id}</Text>
                        <br /><Text type="secondary" style={{ fontSize: 12 }}>{record._id}</Text>
                      </div>
                    ),
                  },
                  { title: 'Total Usage', dataIndex: 'totalUsage', key: 'totalUsage', sorter: (a, b) => a.totalUsage - b.totalUsage, defaultSortOrder: 'descend', render: (v) => formatNumber(v) },
                  { title: 'Unique Users', dataIndex: 'uniqueUsers', key: 'uniqueUsers', sorter: (a, b) => a.uniqueUsers - b.uniqueUsers },
                  {
                    title: 'Limit Reached', dataIndex: 'limitReached', key: 'limitReached',
                    render: (val) => val > 0 ? <Tag color="orange">{val}</Tag> : <Tag>0</Tag>,
                  },
                ]}
                rowKey="_id"
                pagination={{ pageSize: 10, showSizeChanger: true }}
                size="small"
              />
            ) : (
              <Empty description="No usage data yet" />
            )}
          </Card>
        </Col>
      </Row>
    </>
  );

  // ═══════════════════════════════════════════════════════════
  // TAB 3: PLANS & SUBSCRIPTIONS
  // ═══════════════════════════════════════════════════════════
  const renderPlansTab = () => {
    const subscriptionStatusData = [];
    if (overview?.subscriptions) {
      const subs = overview.subscriptions;
      if (subs.active) subscriptionStatusData.push({ status: 'Active', count: subs.active });
      const total = overview.users?.customers || 0;
      const inactive = total - (subs.active || 0);
      if (inactive > 0) subscriptionStatusData.push({ status: 'Inactive / Free', count: inactive });
    }

    return (
      <>
        {/* Plan Distribution Table + Pie */}
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={14}>
            <Card
              title={<><ApiOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Plan Distribution</>}
              loading={loading}
              extra={<Button type="link" size="small" onClick={() => navigate('/plans')}>Manage Plans</Button>}
            >
              {planDistribution?.distribution?.length > 0 ? (
                <>
                  <Row gutter={16} style={{ marginBottom: 16 }}>
                    <Col span={8}>
                      <Statistic title="Total Plans" value={planDistribution.distribution.length} valueStyle={{ color: '#7C3AED' }} />
                    </Col>
                    {canSeeRevenue && (
                      <Col span={8}>
                        <Statistic title="Est. Monthly Revenue" value={planDistribution.totalMonthlyRevenue || 0} prefix="$" valueStyle={{ color: '#52c41a' }} />
                      </Col>
                    )}
                    <Col span={8}>
                      <Statistic title="Conversion Rate" value={overview?.subscriptions?.conversionRate || '0%'} />
                    </Col>
                  </Row>
                  <Table
                    dataSource={planDistribution.distribution}
                    columns={[
                      {
                        title: 'Plan', dataIndex: 'planName', key: 'planName',
                        render: (name) => <Tag color={name === 'Unassigned (Legacy)' ? 'default' : 'purple'}>{name}</Tag>,
                      },
                      { title: 'Customers', dataIndex: 'count', key: 'count', sorter: (a, b) => a.count - b.count },
                      {
                        title: 'Monthly / Yearly', key: 'price',
                        render: (_, record) => (
                          <span>
                            {record.priceMonthly > 0 ? `$${record.priceMonthly}/mo` : 'Free'}
                            {record.priceYearly > 0 && ` · $${record.priceYearly}/yr`}
                          </span>
                        ),
                      },
                      ...(canSeeRevenue ? [{
                        title: 'Est. Revenue', dataIndex: 'revenue', key: 'revenue',
                        render: (val) => <Text strong style={{ color: val > 0 ? '#52c41a' : undefined }}>${val}</Text>,
                      }] : []),
                    ]}
                    rowKey={(r) => r.planId || 'unassigned'}
                    pagination={false}
                    size="small"
                  />
                </>
              ) : (
                <Empty description="No plan data" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={10}>
            <Card title={<><PieChartOutlined style={{ marginRight: 8, color: '#3B82F6' }} />Plan Distribution Chart</>} loading={loading}>
              {planDistribution?.distribution?.length > 0 && Pie ? (
                <Pie
                  data={planDistribution.distribution.map((p) => ({ plan: p.planName, count: p.count }))}
                  angleField="count"
                  colorField="plan"
                  radius={0.85}
                  innerRadius={0.55}
                  height={300}
                  label={{ text: 'count', style: { fontWeight: 'bold' } }}
                  legend={{ color: { position: 'bottom', layout: { justifyContent: 'center' } } }}
                  tooltip={{ title: 'plan' }}
                />
              ) : (
                <Empty description="No data" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Subscription Status */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card title={<><CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />Subscription Status</>} loading={loading}>
              <Row gutter={16}>
                <Col span={8}>
                  <Statistic title="Active Subs" value={overview?.subscriptions?.active || 0} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
                </Col>
                <Col span={8}>
                  <Statistic title="Pending" value={overview?.customers?.pendingVerification || 0} valueStyle={{ color: '#faad14' }} prefix={<ClockCircleOutlined />} />
                </Col>
                <Col span={8}>
                  <Statistic title="Suspended" value={overview?.customers?.suspended || 0} valueStyle={{ color: '#ff4d4f' }} prefix={<WarningOutlined />} />
                </Col>
              </Row>
              {subscriptionStatusData.length > 0 && Pie && (
                <div style={{ marginTop: 16 }}>
                  <Pie
                    data={subscriptionStatusData}
                    angleField="count"
                    colorField="status"
                    radius={0.8}
                    innerRadius={0.6}
                    height={200}
                    legend={{ color: { position: 'bottom' } }}
                  />
                </div>
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title={<><FundOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Customer Overview</>} loading={loading}>
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Total Customers">{overview?.users?.customers || 0}</Descriptions.Item>
                <Descriptions.Item label="Active">{overview?.customers?.active || 0}</Descriptions.Item>
                <Descriptions.Item label="Pending Verification">{overview?.customers?.pendingVerification || 0}</Descriptions.Item>
                <Descriptions.Item label="Suspended">{overview?.customers?.suspended || 0}</Descriptions.Item>
                <Descriptions.Item label="Free-Tier Users">{overview?.subscriptions?.free || 0}</Descriptions.Item>
                <Descriptions.Item label="Paid Subscribers">{overview?.subscriptions?.active || 0}</Descriptions.Item>
                <Descriptions.Item label="Conversion Rate">{overview?.subscriptions?.conversionRate || '0%'}</Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
        </Row>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // TAB 4: REVENUE & BILLING (admin/super_admin ONLY)
  // ═══════════════════════════════════════════════════════════
  const renderRevenueTab = () => {
    if (!canSeeRevenue) {
      return (
        <Card>
          <Empty
            image={<LockOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />}
            description={<Text type="secondary">Revenue data is restricted to Admin and Super Admin roles.</Text>}
          />
        </Card>
      );
    }

    return (
      <>
        {/* Revenue KPIs */}
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="MRR" value={revenueStats?.mrr} icon={<DollarOutlined />} color="#7C3AED" prefix="$" loading={loading}
              suffix={revenueStats?.mrrGrowth && revenueStats.mrrGrowth !== '0%' ? (
                <Text style={{ fontSize: 12, color: parseFloat(revenueStats.mrrGrowth) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                  {parseFloat(revenueStats.mrrGrowth) >= 0 ? <ArrowUpOutlined /> : <ArrowDownOutlined />} {revenueStats.mrrGrowth} vs last month
                </Text>
              ) : null}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="ARR" value={revenueStats?.arr} icon={<FundOutlined />} color="#3B82F6" prefix="$" loading={loading} />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="ARPU" value={revenueStats?.arpu} icon={<UserOutlined />} color="#10B981" prefix="$" loading={loading}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>per paying customer/month</Text>}
            />
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <StatCard title="Total Revenue" value={revenueStats?.totalAllTime} icon={<CrownOutlined />} color="#F59E0B" prefix="$" loading={loading}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{formatNumber(revenueStats?.totalPayments || 0)} payments</Text>}
            />
          </Col>
        </Row>

        {/* Revenue Trend Chart */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24}>
            <Card
              title={<><LineChartOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Revenue Trend</>}
              loading={loading}
            >
              {revenueStats?.trend?.length > 0 && Line ? (
                <Line
                  data={revenueStats.trend}
                  xField="date"
                  yField="revenue"
                  smooth
                  height={300}
                  style={{ lineWidth: 2 }}
                  color="#7C3AED"
                  point={{ shapeField: 'square', sizeField: 2 }}
                  interaction={{ tooltip: { marker: true } }}
                  area={{ style: { fill: 'l(270) 0:#7C3AED20 1:#7C3AED05' } }}
                />
              ) : (
                <Empty description="No revenue data for this period" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Advanced Metrics Row */}
        {advancedRevenue && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Net Revenue" value={advancedRevenue.netRevenue} icon={<DollarOutlined />} color="#10B981" prefix="$" loading={loading} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Churn Rate" value={advancedRevenue.churnRate} icon={<ArrowDownOutlined />} color="#ff4d4f" loading={loading}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>{advancedRevenue.churnedCustomers} churned</Text>}
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Est. LTV" value={advancedRevenue.ltv} icon={<FundOutlined />} color="#7C3AED" prefix="$" loading={loading}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>lifetime value per customer</Text>}
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Avg Transaction" value={advancedRevenue.averageTransaction} icon={<DollarOutlined />} color="#3B82F6" prefix="$" loading={loading} />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Success Rate" value={advancedRevenue.paymentSuccessRate} icon={<CheckCircleOutlined />} color="#52c41a" loading={loading}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>{advancedRevenue.succeededPayments} / {advancedRevenue.succeededPayments + advancedRevenue.failedPayments}</Text>}
              />
            </Col>
            <Col xs={24} sm={12} lg={4}>
              <StatCard title="Refunds" value={advancedRevenue.refunds?.total} icon={<WarningOutlined />} color="#F59E0B" prefix="$" loading={loading}
                suffix={<Text type="secondary" style={{ fontSize: 12 }}>{advancedRevenue.refunds?.count || 0} refunded</Text>}
              />
            </Col>
          </Row>
        )}

        {/* Monthly Revenue Trend (bar chart) + Revenue by Cycle */}
        {advancedRevenue && (
          <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
            <Col xs={24} lg={14}>
              <Card
                title={<><BarChartOutlined style={{ marginRight: 8, color: '#10B981' }} />Monthly Revenue (Last 12 Months)</>}
                loading={loading}
              >
                {advancedRevenue.monthlyRevenueTrend?.length > 0 && Column ? (
                  <Column
                    data={advancedRevenue.monthlyRevenueTrend}
                    xField="month"
                    yField="revenue"
                    height={280}
                    color="#7C3AED"
                    label={{ text: (d) => `$${d.revenue}`, position: 'outside' }}
                    interaction={{ tooltip: { marker: true } }}
                  />
                ) : (
                  <Empty description="No monthly data" />
                )}
              </Card>
            </Col>
            <Col xs={24} lg={10}>
              <Card
                title={<><PieChartOutlined style={{ marginRight: 8, color: '#3B82F6' }} />Revenue by Billing Cycle</>}
                loading={loading}
              >
                {advancedRevenue.revenueByCycle?.length > 0 ? (
                  <>
                    {Pie && (
                      <Pie
                        data={advancedRevenue.revenueByCycle.map((c) => ({ cycle: c.cycle, revenue: c.revenue }))}
                        angleField="revenue"
                        colorField="cycle"
                        radius={0.85}
                        innerRadius={0.55}
                        height={220}
                        label={{ text: (d) => `$${d.revenue}`, style: { fontWeight: 'bold' } }}
                        legend={{ color: { position: 'bottom' } }}
                      />
                    )}
                    <div style={{ marginTop: 12 }}>
                      {advancedRevenue.revenueByCycle.map((c) => (
                        <div key={c.cycle} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #f0f0f0' }}>
                          <Text style={{ textTransform: 'capitalize' }}>{c.cycle}</Text>
                          <Space size={16}>
                            <Text type="secondary">{c.count} payments</Text>
                            <Text strong style={{ color: '#52c41a' }}>${formatNumber(c.revenue)}</Text>
                          </Space>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <Empty description="No data" />
                )}
              </Card>
            </Col>
          </Row>
        )}

        {/* Revenue by Plan + Payment Status */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={12}>
            <Card
              title={<><PieChartOutlined style={{ marginRight: 8, color: '#3B82F6' }} />Revenue by Plan</>}
              loading={loading}
            >
              {revenueStats?.byPlan?.length > 0 ? (
                <>
                  {Pie && (
                    <Pie
                      data={revenueStats.byPlan.map((p) => ({ plan: p.plan, revenue: p.revenue }))}
                      angleField="revenue"
                      colorField="plan"
                      radius={0.85}
                      innerRadius={0.55}
                      height={250}
                      label={{ text: (d) => `$${d.revenue}`, style: { fontWeight: 'bold' } }}
                      legend={{ color: { position: 'bottom' } }}
                    />
                  )}
                  <Table
                    dataSource={revenueStats.byPlan}
                    columns={[
                      { title: 'Plan', dataIndex: 'plan', key: 'plan', render: (p) => <Tag color="purple">{p}</Tag> },
                      { title: 'Revenue', dataIndex: 'revenue', key: 'revenue', render: (v) => <Text strong style={{ color: '#52c41a' }}>${formatNumber(v)}</Text> },
                      { title: 'Transactions', dataIndex: 'count', key: 'count' },
                    ]}
                    rowKey="plan"
                    pagination={false}
                    size="small"
                    style={{ marginTop: 16 }}
                  />
                </>
              ) : (
                <Empty description="No revenue data" />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={<><CheckCircleOutlined style={{ marginRight: 8, color: '#52c41a' }} />Payment Status Breakdown</>}
              loading={loading}
            >
              {revenueStats?.paymentStatus?.length > 0 ? (
                <>
                  {revenueStats.paymentStatus.map((s) => {
                    const color = { succeeded: '#52c41a', pending: '#faad14', failed: '#ff4d4f', refunded: '#1890ff', cancelled: '#8c8c8c' }[s.status] || '#d9d9d9';
                    return (
                      <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <Space>
                          <Badge color={color} />
                          <Text style={{ textTransform: 'capitalize' }}>{s.status}</Text>
                        </Space>
                        <Space size={20}>
                          <Text type="secondary">{s.count} payments</Text>
                          <Text strong>${formatNumber(s.total)}</Text>
                        </Space>
                      </div>
                    );
                  })}
                </>
              ) : (
                <Empty description="No payment data" />
              )}
            </Card>
          </Col>
        </Row>

        {/* Recent Payments */}
        <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
          <Col xs={24} lg={advancedRevenue?.topPayers?.length > 0 ? 14 : 24}>
            <Card
              title={<><ClockCircleOutlined style={{ marginRight: 8, color: '#F59E0B' }} />Recent Payments</>}
              loading={loading}
            >
              {revenueStats?.recentPayments?.length > 0 ? (
                <Table
                  dataSource={revenueStats.recentPayments}
                  columns={[
                    {
                      title: 'Customer', key: 'user',
                      render: (_, record) => (
                        <Space>
                          <Avatar size="small" style={{ backgroundColor: '#7C3AED' }}>
                            {(record.user?.name || record.user?.email || '?')[0].toUpperCase()}
                          </Avatar>
                          <div>
                            <Text strong>{record.user?.name || 'Unknown'}</Text>
                            <br /><Text type="secondary" style={{ fontSize: 12 }}>{record.user?.email}</Text>
                          </div>
                        </Space>
                      ),
                    },
                    {
                      title: 'Amount', dataIndex: 'amount', key: 'amount',
                      render: (v) => <Text strong style={{ color: '#52c41a' }}>${v}</Text>,
                    },
                    { title: 'Plan', dataIndex: 'planName', key: 'planName', render: (p) => <Tag color="blue">{p || '—'}</Tag> },
                    {
                      title: 'Cycle', dataIndex: 'billingCycle', key: 'billingCycle',
                      render: (c) => <Tag>{c}</Tag>,
                    },
                    {
                      title: 'Date', dataIndex: 'paidAt', key: 'paidAt',
                      render: (d) => d ? new Date(d).toLocaleDateString() : '—',
                    },
                  ]}
                  rowKey="_id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                />
              ) : (
                <Empty description="No payments yet" />
              )}
            </Card>
          </Col>

          {/* Top Paying Customers */}
          {advancedRevenue?.topPayers?.length > 0 && (
            <Col xs={24} lg={10}>
              <Card
                title={<><TrophyOutlined style={{ marginRight: 8, color: '#F59E0B' }} />Top Paying Customers</>}
                loading={loading}
              >
                <Table
                  dataSource={advancedRevenue.topPayers}
                  columns={[
                    {
                      title: '#', key: 'rank', width: 40,
                      render: (_, __, i) => <Badge count={i + 1} style={{ backgroundColor: i < 3 ? '#faad14' : '#d9d9d9' }} />,
                    },
                    {
                      title: 'Customer', key: 'name',
                      render: (_, r) => (
                        <div>
                          <Text strong>{r.name}</Text>
                          <br /><Text type="secondary" style={{ fontSize: 11 }}>{r.email}</Text>
                        </div>
                      ),
                    },
                    {
                      title: 'Total Spent', dataIndex: 'totalSpent', key: 'totalSpent',
                      render: (v) => <Text strong style={{ color: '#52c41a' }}>${formatNumber(v)}</Text>,
                      sorter: (a, b) => a.totalSpent - b.totalSpent,
                      defaultSortOrder: 'descend',
                    },
                    { title: 'Payments', dataIndex: 'payments', key: 'payments', width: 80 },
                    {
                      title: 'Plan', dataIndex: 'planName', key: 'planName', width: 80,
                      render: (p) => <Tag color="purple">{p || '—'}</Tag>,
                    },
                  ]}
                  rowKey="userId"
                  pagination={false}
                  size="small"
                />
              </Card>
            </Col>
          )}
        </Row>
      </>
    );
  };

  // ═══════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════
  const tabItems = [
    {
      key: 'overview',
      label: <span><BarChartOutlined /> Overview & Users</span>,
      children: renderOverviewTab(),
    },
    {
      key: 'features',
      label: <span><ThunderboltOutlined /> Features & Usage</span>,
      children: renderFeaturesTab(),
    },
    {
      key: 'plans',
      label: <span><CrownOutlined /> Plans & Subscriptions</span>,
      children: renderPlansTab(),
    },
    {
      key: 'revenue',
      label: (
        <span>
          <DollarOutlined /> Revenue & Billing
          {!canSeeRevenue && <LockOutlined style={{ marginLeft: 4, fontSize: 11 }} />}
        </span>
      ),
      children: renderRevenueTab(),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Analytics Dashboard"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Analytics' }]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Refresh</Button>
            <Segmented
              options={[
                { label: '7 Days', value: '7d' },
                { label: '30 Days', value: '30d' },
                { label: '90 Days', value: '90d' },
              ]}
              value={timeframe}
              onChange={setTimeframe}
            />
          </Space>
        }
      />

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        type="card"
        size="large"
        items={tabItems}
        style={{ marginTop: 8 }}
      />
    </div>
  );
};

export default AnalyticsPage;
