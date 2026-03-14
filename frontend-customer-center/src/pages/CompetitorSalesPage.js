import React, { useState } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Table, Space,
  Input, Button, Empty, message, theme, Tooltip,
} from 'antd';
import {
  LineChartOutlined, RiseOutlined, FallOutlined, MinusOutlined,
  ShopOutlined, TrophyOutlined,
  PlusOutlined, DeleteOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const MOCK_DATA = [
  {
    key: 1, name: 'CraftedByEmma', dailySales: 42, revenue: 1680, topListing: 'Gold Chain Necklace',
    topListingSales: 128, avgPrice: 40, trend: 'up', trendPct: 14, listings: 142,
  },
  {
    key: 2, name: 'VintageFindsShop', dailySales: 18, revenue: 720, topListing: 'Vintage Clock',
    topListingSales: 67, avgPrice: 40, trend: 'down', trendPct: -5, listings: 89,
  },
  {
    key: 3, name: 'ArtisanWoods', dailySales: 31, revenue: 1240, topListing: 'Wooden Serving Board',
    topListingSales: 94, avgPrice: 40, trend: 'up', trendPct: 22, listings: 67,
  },
  {
    key: 4, name: 'ModernMacrame', dailySales: 24, revenue: 960, topListing: 'Large Wall Hanging',
    topListingSales: 53, avgPrice: 40, trend: 'stable', trendPct: 1, listings: 48,
  },
];

const CompetitorSalesPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, refresh } = usePermissions();
  getFeatureAccess('competitor_sales');

  const [data, setData] = useState(MOCK_DATA);
  const [shopUrl, setShopUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleAdd = async () => {
    if (!shopUrl.trim()) { message.warning('Enter an Etsy shop URL or name'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1000));
    setData(prev => [...prev, {
      key: Date.now(),
      name: shopUrl.replace('https://www.etsy.com/shop/', '').replace(/\//g, ''),
      dailySales: Math.floor(Math.random() * 50) + 5,
      revenue: Math.floor(Math.random() * 2000) + 200,
      topListing: 'Sample Listing',
      topListingSales: Math.floor(Math.random() * 100) + 10,
      avgPrice: Math.floor(Math.random() * 50) + 15,
      trend: 'up',
      trendPct: Math.floor(Math.random() * 25),
      listings: Math.floor(Math.random() * 200) + 20,
    }]);
    setShopUrl('');
    setLoading(false);
    refresh();
    message.success('Shop added to sales tracking');
  };

  const totalDailySales = data.reduce((s, d) => s + d.dailySales, 0);
  const topShop = data.length ? data.reduce((a, b) => a.dailySales > b.dailySales ? a : b) : null;

  const columns = [
    {
      title: 'Shop', dataIndex: 'name', key: 'name',
      render: (t) => (
        <Space>
          <ShopOutlined style={{ color: BRAND }} />
          <Text strong style={{ fontSize: 13 }}>{t}</Text>
        </Space>
      ),
    },
    {
      title: 'Daily Sales', dataIndex: 'dailySales', key: 'dailySales', width: 110, align: 'center',
      sorter: (a, b) => a.dailySales - b.dailySales,
      render: (v) => <Text strong style={{ fontSize: 14, color: BRAND }}>{v}</Text>,
    },
    {
      title: 'Est. Revenue', dataIndex: 'revenue', key: 'revenue', width: 120,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (v) => <Text strong style={{ color: colors.success }}>${v.toLocaleString()}</Text>,
    },
    {
      title: 'Top Listing', dataIndex: 'topListing', key: 'topListing', ellipsis: true,
      render: (t, row) => (
        <Tooltip title={`${row.topListingSales} sales`}>
          <Space>
            <TrophyOutlined style={{ color: colors.warning }} />
            <Text style={{ fontSize: 12 }}>{t}</Text>
          </Space>
        </Tooltip>
      ),
    },
    {
      title: 'Trend', key: 'trend', width: 100, align: 'center',
      render: (_, row) => (
        <Space size={4}>
          {row.trend === 'up' ? <RiseOutlined style={{ color: colors.success }} /> :
            row.trend === 'down' ? <FallOutlined style={{ color: colors.danger }} /> :
              <MinusOutlined style={{ color: colors.muted }} />}
          <Text style={{
            color: row.trendPct > 0 ? colors.success : row.trendPct < 0 ? colors.danger : colors.muted,
            fontWeight: 600, fontSize: 12,
          }}>
            {row.trendPct > 0 ? '+' : ''}{row.trendPct}%
          </Text>
        </Space>
      ),
    },
    {
      title: '', key: 'action', width: 50,
      render: (_, row) => (
        <Button
          type="text" danger size="small"
          icon={<DeleteOutlined />}
          onClick={() => {
            setData(prev => prev.filter(d => d.key !== row.key));
            message.success('Shop removed');
          }}
        />
      ),
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="competitor_sales" featureName="Competitor sales tracking" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 10, color: BRAND }} />
            Competitor Sales Tracker
          </Title>
          <Text type="secondary">Track daily sales, revenue estimates & top listings of competitor shops</Text>
        </div>
        <UsageBadge featureKey="competitor_sales" />
      </div>

      <FeatureGate featureKey="competitor_sales">
        {/* Add shop */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Input
                size="large"
                prefix={<ShopOutlined style={{ color: colors.muted }} />}
                placeholder="Enter Etsy shop URL or name to track sales..."
                value={shopUrl}
                onChange={e => setShopUrl(e.target.value)}
                onPressEnter={handleAdd}
                style={{ borderRadius: radii.sm }}
              />
            </Col>
            <Col>
              <Button
                type="primary" size="large" loading={loading}
                icon={<PlusOutlined />}
                onClick={handleAdd}
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                }}
              >
                Track Sales
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title="Shops Tracked"
                value={data.length}
                prefix={<ShopOutlined style={{ color: BRAND }} />}
                valueStyle={{ fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title="Total Daily Sales"
                value={totalDailySales}
                valueStyle={{ color: BRAND, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title="Top Performer"
                value={topShop?.name || '—'}
                prefix={<TrophyOutlined style={{ color: colors.warning }} />}
                valueStyle={{ fontSize: 16, fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        {data.length > 0 ? (
          <Card style={card}>
            <Table columns={columns} dataSource={data} pagination={false} size="middle" />
          </Card>
        ) : (
          <Card style={card}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Add competitor shops to start tracking sales" />
          </Card>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default CompetitorSalesPage;
