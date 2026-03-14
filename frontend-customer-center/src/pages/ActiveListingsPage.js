import React, { useState } from 'react';
import {
  Card, Table, Typography, Tag, Progress, Row, Col, Statistic,
  Button, theme, Input, message,
} from 'antd';
import {
  ShopOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined,
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

const MOCK_LISTINGS = [
  { key: 1, title: 'Handmade Ceramic Mug - Custom Name', views: 1420, favorites: 89, seoScore: 92, revenue: 285, status: 'active', tags: 8 },
  { key: 2, title: 'Personalized Gold Necklace', views: 3200, favorites: 214, seoScore: 88, revenue: 1240, status: 'active', tags: 12 },
  { key: 3, title: 'Vintage Leather Journal', views: 890, favorites: 42, seoScore: 54, revenue: 156, status: 'active', tags: 5 },
  { key: 4, title: 'Boho Macrame Wall Hanging', views: 2100, favorites: 156, seoScore: 76, revenue: 680, status: 'active', tags: 10 },
  { key: 5, title: 'Custom Pet Portrait Pillow', views: 650, favorites: 28, seoScore: 41, revenue: 89, status: 'inactive', tags: 3 },
  { key: 6, title: 'Minimalist Silver Ring Set', views: 1800, favorites: 132, seoScore: 85, revenue: 920, status: 'active', tags: 13 },
];

const scoreColor = (s) => (s >= 80 ? colors.success : s >= 60 ? colors.warning : colors.danger);

const ActiveListingsPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess } = usePermissions();
  getFeatureAccess('active_listings');

  const [listings] = useState(MOCK_LISTINGS);
  const [search, setSearch] = useState('');

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const filtered = search
    ? listings.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))
    : listings;

  const totalViews = listings.reduce((s, l) => s + l.views, 0);
  const avgScore = Math.round(listings.reduce((s, l) => s + l.seoScore, 0) / listings.length);
  const needsFix = listings.filter(l => l.seoScore < 60).length;

  const columns = [
    {
      title: 'Listing', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (t) => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
    },
    {
      title: 'SEO Score', dataIndex: 'seoScore', key: 'seoScore', width: 130, align: 'center',
      sorter: (a, b) => a.seoScore - b.seoScore,
      render: (s) => (
        <Progress
          type="circle" size={40} percent={s}
          strokeColor={scoreColor(s)}
          format={() => s}
        />
      ),
    },
    {
      title: 'Views', dataIndex: 'views', key: 'views', width: 90, align: 'center',
      sorter: (a, b) => a.views - b.views,
      render: (v) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Favorites', dataIndex: 'favorites', key: 'favorites', width: 90, align: 'center',
      render: (f) => <Text>{f}</Text>,
    },
    {
      title: 'Tags', dataIndex: 'tags', key: 'tags', width: 80, align: 'center',
      render: (t) => (
        <Tag style={{
          background: t >= 10 ? `${colors.success}18` : t >= 6 ? `${colors.warning}18` : `${colors.danger}18`,
          color: t >= 10 ? colors.success : t >= 6 ? colors.warning : colors.danger,
          border: 'none', borderRadius: radii.pill, fontWeight: 600,
        }}>
          {t}/13
        </Tag>
      ),
    },
    {
      title: 'Revenue', dataIndex: 'revenue', key: 'revenue', width: 100,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (r) => <Text strong style={{ color: colors.success }}>${r}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 90, align: 'center',
      render: (s) => (
        <Tag
          icon={s === 'active' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
          color={s === 'active' ? 'green' : 'default'}
          style={{ borderRadius: radii.pill }}
        >
          {s}
        </Tag>
      ),
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="active_listings" featureName="Active listings sync" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ShopOutlined style={{ marginRight: 10, color: BRAND }} />
            Active Listings
          </Title>
          <Text type="secondary">Monitor all your Etsy listings, SEO scores & performance</Text>
        </div>
        <UsageBadge featureKey="active_listings" />
      </div>

      <FeatureGate featureKey="active_listings">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Total Listings" value={listings.length} prefix={<ShopOutlined style={{ color: BRAND }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Total Views" value={totalViews} prefix={<EyeOutlined style={{ color: colors.info }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Avg SEO Score" value={avgScore} suffix="/100" valueStyle={{ color: scoreColor(avgScore), fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Need Fixing" value={needsFix} valueStyle={{ color: needsFix > 0 ? colors.danger : colors.success, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Input
              prefix={<SearchOutlined style={{ color: colors.muted }} />}
              placeholder="Search listings..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 280, borderRadius: radii.sm }}
            />
            <Button icon={<ReloadOutlined />} onClick={() => message.info('Syncing listings...')}>
              Sync
            </Button>
          </div>
          <Table
            columns={columns}
            dataSource={filtered}
            pagination={{ pageSize: 10 }}
            size="middle"
          />
        </Card>
      </FeatureGate>
    </AppLayout>
  );
};

export default ActiveListingsPage;
