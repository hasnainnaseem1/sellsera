import React, { useState, useEffect, useCallback } from 'react';
import { Row, Col, Card, Table, Segmented, Tag, message, Statistic, Space, Typography, Avatar, Badge, Empty, Button } from 'antd';
import {
  TeamOutlined, UserOutlined, ThunderboltOutlined, DollarOutlined,
  ArrowUpOutlined, CrownOutlined, ClockCircleOutlined,
  TrophyOutlined, ReloadOutlined, RiseOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/common/PageHeader';
import GrowthChart from '../components/charts/GrowthChart';
import DistributionChart from '../components/charts/DistributionChart';
import TrendChart from '../components/charts/TrendChart';
import PermissionGuard from '../components/guards/PermissionGuard';
import analyticsApi from '../api/analyticsApi';
import { timeAgo, formatNumber } from '../utils/helpers';
import StatusTag from '../components/common/StatusTag';

const { Text } = Typography;

// ─── KPI Stat Card ───
const KpiCard = ({ title, value, icon, color, prefix, suffix, onClick, loading: cardLoading }) => (
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

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState('30d');
  const [overview, setOverview] = useState(null);
  const [growthData, setGrowthData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [distributionData, setDistributionData] = useState([]);
  const [topCustomers, setTopCustomers] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [planDistribution, setPlanDistribution] = useState(null);

  const navigate = useNavigate();

  // Get user role for RBAC
  const getCurrentUserRole = () => {
    try {
      const user = JSON.parse(localStorage.getItem('admin_user') || '{}');
      return user.role || 'viewer';
    } catch {
      return 'viewer';
    }
  };
  const userRole = getCurrentUserRole();
  const canSeeRevenue = userRole === 'admin' || userRole === 'super_admin';

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRes, growthRes, trendRes, distRes, topRes, recentRes, planRes] = await Promise.allSettled([
        analyticsApi.getOverview(timeframe),
        analyticsApi.getUsersGrowth(timeframe),
        analyticsApi.getAnalysesTrend(timeframe),
        analyticsApi.getSubscriptionDistribution(),
        analyticsApi.getTopCustomers(5),
        analyticsApi.getRecentActivities(10),
        analyticsApi.getPlanDistribution(),
      ]);

      if (overviewRes.status === 'fulfilled') setOverview(overviewRes.value.overview);
      if (growthRes.status === 'fulfilled') setGrowthData(growthRes.value.data || []);
      if (trendRes.status === 'fulfilled') setTrendData(trendRes.value.data || []);
      if (distRes.status === 'fulfilled') setDistributionData(distRes.value.distribution || []);
      if (topRes.status === 'fulfilled') setTopCustomers(topRes.value.topCustomers || []);
      if (recentRes.status === 'fulfilled') setRecentActivities(recentRes.value.activities || []);
      if (planRes.status === 'fulfilled') setPlanDistribution(planRes.value);
    } catch {
      message.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Activity Table Columns ───
  const activityColumns = [
    {
      title: 'User',
      dataIndex: 'userName',
      key: 'userName',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Action',
      dataIndex: 'action',
      key: 'action',
      width: 150,
      render: (action) => <Tag>{action}</Tag>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Time',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date) => timeAgo(date),
    },
  ];

  // ─── Top Customer Columns ───
  const topCustomerColumns = [
    {
      title: '#',
      key: 'rank',
      width: 50,
      render: (_, __, i) => (
        <Badge
          count={i + 1}
          style={{
            backgroundColor: i === 0 ? '#faad14' : i === 1 ? '#bfbfbf' : i === 2 ? '#d48806' : '#d9d9d9',
          }}
        />
      ),
    },
    {
      title: 'Customer',
      key: 'name',
      render: (_, record) => (
        <Space>
          <Avatar size="small" style={{ backgroundColor: '#7C3AED' }}>
            {(record.customer?.name || record.customer?.email || '?')[0].toUpperCase()}
          </Avatar>
          <div>
            <Text strong>{record.customer?.name || 'Unknown'}</Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>{record.customer?.email}</Text>
          </div>
        </Space>
      ),
    },
    {
      title: 'Plan',
      key: 'plan',
      render: (_, record) => <Tag color="blue">{record.customer?.plan || 'Free'}</Tag>,
      width: 90,
    },
    {
      title: 'Usage',
      dataIndex: 'totalAnalyses',
      key: 'totalAnalyses',
      width: 80,
    },
    {
      title: 'Avg Score',
      dataIndex: 'averageScore',
      key: 'averageScore',
      width: 90,
    },
  ];

  // ─── Quick Plan Distribution Columns ───
  const planColumns = [
    {
      title: 'Plan',
      dataIndex: 'planName',
      key: 'planName',
      render: (name) => <Tag color={name === 'Unassigned (Legacy)' ? 'default' : 'purple'}>{name}</Tag>,
    },
    {
      title: 'Customers',
      dataIndex: 'count',
      key: 'count',
      sorter: (a, b) => a.count - b.count,
    },
    {
      title: 'Price',
      dataIndex: 'priceMonthly',
      key: 'priceMonthly',
      render: (val) => (val > 0 ? `$${val}/mo` : <Tag>Free</Tag>),
    },
    ...(canSeeRevenue
      ? [{
          title: 'Est. Revenue',
          dataIndex: 'revenue',
          key: 'revenue',
          render: (val) => (
            <Text strong style={{ color: val > 0 ? '#52c41a' : undefined }}>${val}</Text>
          ),
        }]
      : []),
  ];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        breadcrumbs={[{ label: 'Dashboard' }]}
        extra={
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} size="small">Refresh</Button>
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

      {/* ─── KPI Row ─── */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Total Users"
            value={overview?.users?.total}
            icon={<TeamOutlined />}
            color="#7C3AED"
            onClick={() => navigate('/users')}
            loading={loading}
            suffix={overview?.users?.growth && overview.users.growth !== '0%' ? (
              <Text style={{ fontSize: 12, color: '#52c41a' }}>
                <ArrowUpOutlined /> {overview.users.growth} growth
              </Text>
            ) : null}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Active Customers"
            value={overview?.customers?.active}
            icon={<UserOutlined />}
            color="#3B82F6"
            onClick={() => navigate('/customers')}
            loading={loading}
            suffix={overview?.customers?.pendingVerification > 0 ? (
              <Text style={{ fontSize: 12, color: '#faad14' }}>
                {overview.customers.pendingVerification} pending
              </Text>
            ) : null}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <KpiCard
            title="Feature Usage"
            value={overview?.usage?.totalEvents}
            icon={<ThunderboltOutlined />}
            color="#10B981"
            onClick={() => navigate('/analytics')}
            loading={loading}
          />
        </Col>
        {canSeeRevenue && (
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Monthly Revenue"
              value={overview?.revenue?.monthly}
              icon={<DollarOutlined />}
              color="#F59E0B"
              prefix="$"
              onClick={() => navigate('/analytics')}
              loading={loading}
            />
          </Col>
        )}
        {!canSeeRevenue && (
          <Col xs={24} sm={12} lg={6}>
            <KpiCard
              title="Subscription Rate"
              value={overview?.subscriptions?.conversionRate?.replace('%', '')}
              icon={<RiseOutlined />}
              color="#F59E0B"
              loading={loading}
              suffix={<Text type="secondary" style={{ fontSize: 12 }}>{overview?.subscriptions?.active || 0} active subs</Text>}
            />
          </Col>
        )}
      </Row>

      {/* ─── Charts: User Growth + Subscription Distribution ─── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <GrowthChart data={growthData} loading={loading} />
        </Col>
        <Col xs={24} lg={10}>
          <DistributionChart data={distributionData} loading={loading} />
        </Col>
      </Row>

      {/* ─── Charts: Analysis Trends + Quick Plan Distribution ─── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <Col xs={24} lg={14}>
          <TrendChart data={trendData} loading={loading} />
        </Col>
        <Col xs={24} lg={10}>
          <Card
            title={<><CrownOutlined style={{ marginRight: 8, color: '#7C3AED' }} />Plan Distribution</>}
            loading={loading}
            extra={<Button type="link" size="small" onClick={() => navigate('/plans')}>Manage</Button>}
          >
            {planDistribution?.distribution?.length > 0 ? (
              <Table
                dataSource={planDistribution.distribution}
                columns={planColumns}
                rowKey={(r) => r.planId || 'unassigned'}
                pagination={false}
                size="small"
              />
            ) : (
              <Empty description="No plan data" />
            )}
          </Card>
        </Col>
      </Row>

      {/* ─── Top Customers + Recent Activity ─── */}
      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        <PermissionGuard permission="customers.view" fallback={null}>
          <Col xs={24} lg={12}>
            <Card
              title={<><TrophyOutlined style={{ marginRight: 8, color: '#F59E0B' }} />Top Customers</>}
              loading={loading}
              extra={<Button type="link" size="small" onClick={() => navigate('/customers')}>View All</Button>}
            >
              {topCustomers.length > 0 ? (
                <Table
                  dataSource={topCustomers}
                  columns={topCustomerColumns}
                  pagination={false}
                  size="small"
                  rowKey={(r) => r.customer?.email || Math.random()}
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
            >
              {recentActivities.length > 0 ? (
                <Table
                  dataSource={recentActivities}
                  columns={activityColumns}
                  pagination={false}
                  size="small"
                  rowKey={(r) => r._id || Math.random()}
                />
              ) : (
                <Empty description="No recent activity" />
              )}
            </Card>
          </Col>
        </PermissionGuard>
      </Row>
    </div>
  );
};

export default DashboardPage;
