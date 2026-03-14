import React, { useState } from 'react';
import {
  Card, Input, Button, Table, Tag, Typography, Row, Col,
  Space, Empty, Statistic, message, theme,
} from 'antd';
import {
  PlusOutlined, ShopOutlined, TrophyOutlined,
  RiseOutlined, DeleteOutlined, TeamOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;

// Mock tracked shops for demonstration
const MOCK_SHOPS = [
  { key: 1, name: 'CraftedByEmma', listings: 142, sales: 4820, rating: 4.9, trend: '+12%', topCategory: 'Jewelry' },
  { key: 2, name: 'VintageFindsShop', listings: 89, sales: 2340, rating: 4.7, trend: '+5%', topCategory: 'Home & Living' },
  { key: 3, name: 'ArtisanWoods', listings: 67, sales: 1890, rating: 4.8, trend: '+18%', topCategory: 'Art & Collectibles' },
];

const CompetitorTrackerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess } = usePermissions();
  const access = getFeatureAccess('competitor_tracking');

  const [shopUrl, setShopUrl] = useState('');
  const [shops, setShops] = useState(MOCK_SHOPS);
  const [loading, setLoading] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleAdd = async () => {
    if (!shopUrl.trim()) { message.warning('Enter an Etsy shop URL or name'); return; }
    setLoading(true);
    // Simulate API delay — will be replaced with real endpoint
    await new Promise(r => setTimeout(r, 1000));
    const newShop = {
      key: Date.now(),
      name: shopUrl.replace('https://www.etsy.com/shop/', '').replace(/\//g, ''),
      listings: Math.floor(Math.random() * 200) + 20,
      sales: Math.floor(Math.random() * 5000) + 500,
      rating: (4.5 + Math.random() * 0.5).toFixed(1),
      trend: `+${Math.floor(Math.random() * 20)}%`,
      topCategory: 'Jewelry',
    };
    setShops(prev => [...prev, newShop]);
    setShopUrl('');
    setLoading(false);
    message.success(`Now tracking ${newShop.name}`);
  };

  const handleRemove = (key) => {
    setShops(prev => prev.filter(s => s.key !== key));
    message.success('Shop removed');
  };

  const columns = [
    {
      title: 'Shop',
      dataIndex: 'name',
      key: 'name',
      render: (text) => (
        <Space>
          <ShopOutlined style={{ color: colors.brand }} />
          <Text strong style={{ fontSize: 13 }}>{text}</Text>
        </Space>
      ),
    },
    {
      title: 'Listings',
      dataIndex: 'listings',
      key: 'listings',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.listings - b.listings,
    },
    {
      title: 'Sales',
      dataIndex: 'sales',
      key: 'sales',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.sales - b.sales,
      render: (v) => v.toLocaleString(),
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 80,
      align: 'center',
      render: (v) => <Tag color="gold">★ {v}</Tag>,
    },
    {
      title: 'Trend',
      dataIndex: 'trend',
      key: 'trend',
      width: 100,
      align: 'center',
      render: (t) => <Tag color="green"><RiseOutlined /> {t}</Tag>,
    },
    {
      title: 'Top Category',
      dataIndex: 'topCategory',
      key: 'topCategory',
      width: 140,
      render: (c) => <Tag>{c}</Tag>,
    },
    {
      title: '',
      key: 'action',
      width: 50,
      render: (_, record) => (
        <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={() => handleRemove(record.key)} />
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ color: colors.brand, marginRight: 8 }} />
            Competitor Tracker
          </Title>
          <Text type="secondary">Monitor competitor shops and stay ahead of the market</Text>
        </div>
        {access.state === 'unlocked' && (
          <UsageBadge used={access.used} limit={access.unlimited ? null : access.limit} showLabel />
        )}
      </div>

      <QuotaBanner featureKey="competitor_tracking" featureName="Tracked Shops" />

      <FeatureGate featureKey="competitor_tracking">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Tracked Shops</Text>}
                value={shops.length}
                prefix={<ShopOutlined style={{ color: colors.brand }} />}
              />
            </Card>
          </Col>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Total Competitor Sales</Text>}
                value={shops.reduce((sum, s) => sum + s.sales, 0)}
                prefix={<TrophyOutlined style={{ color: colors.success }} />}
              />
            </Card>
          </Col>
          <Col xs={8}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Avg. Listings</Text>}
                value={Math.round(shops.reduce((sum, s) => sum + s.listings, 0) / (shops.length || 1))}
                prefix={<RiseOutlined style={{ color: colors.warning }} />}
              />
            </Card>
          </Col>
        </Row>

        {/* Add shop */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={16}>
              <Input
                placeholder="Enter Etsy shop URL or name (e.g. CraftedByEmma)"
                prefix={<ShopOutlined />}
                value={shopUrl}
                onChange={(e) => setShopUrl(e.target.value)}
                onPressEnter={handleAdd}
                size="large"
              />
            </Col>
            <Col xs={24} md={8}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                loading={loading}
                size="large"
                block
                style={{
                  background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600,
                }}
              >
                Track Shop
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Table */}
        <Card style={card}>
          {shops.length > 0 ? (
            <Table
              columns={columns}
              dataSource={shops}
              pagination={false}
              size="middle"
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={<Text type="secondary">No shops tracked yet. Add a competitor above to start.</Text>}
            />
          )}
        </Card>
      </FeatureGate>
    </AppLayout>
  );
};

export default CompetitorTrackerPage;
