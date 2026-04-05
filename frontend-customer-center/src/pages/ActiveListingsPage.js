import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Row, Col, Statistic,
  Button, theme, Input, message, Empty, Spin, Space,
} from 'antd';
import {
  ShopOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, ExportOutlined, PlusOutlined, SendOutlined,
  EditOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import CreateListingModal from '../components/CreateListingModal';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const ActiveListingsPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess } = usePermissions();
  getFeatureAccess('listing_sync');

  const [listings, setListings] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [publishing, setPublishing] = useState(null);

  const handlePublish = async (listingId) => {
    setPublishing(listingId);
    try {
      await etsyApi.publishListing(listingId);
      message.success('Listing published successfully!');
      fetchListings();
    } catch (err) {
      const errMsg = err?.response?.data?.message || 'Failed to publish. Ensure listing has at least one image.';
      if (err?.response?.status === 404) {
        message.warning(errMsg);
        fetchListings(); // Refresh to remove deleted listing
      } else {
        message.error(errMsg);
      }
    } finally {
      setPublishing(null);
    }
  };

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await etsyApi.getListings({ search: search || undefined });
      const rows = (res.data?.listings || []).map((l, i) => ({
        key: l.listingId || i,
        listingId: l.listingId,
        title: l.title || 'Untitled',
        views: l.views || 0,
        favorites: l.favorites || 0,
        tags: l.tags?.length || 0,
        status: l.state || 'active',
        price: l.price,
      }));
      setListings(rows);
    } catch (err) {
      if (err?.response?.status !== 401) {
        message.error(err?.response?.data?.message || 'Failed to load listings');
      }
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  const filtered = search
    ? listings.filter(l => l.title.toLowerCase().includes(search.toLowerCase()))
    : listings;

  const totalViews = listings.reduce((s, l) => s + l.views, 0);

  const columns = [
    {
      title: 'Listing', dataIndex: 'title', key: 'title', ellipsis: true,
      render: (t) => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
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
      title: 'Price', dataIndex: 'price', key: 'price', width: 100,
      render: (p) => <Text strong style={{ color: colors.success }}>{p ? `$${p}` : '—'}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 100, align: 'center',
      filters: [
        { text: 'Active', value: 'active' },
        { text: 'Draft', value: 'draft' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (s) => (
        <Tag
          icon={s === 'active' ? <CheckCircleOutlined /> : s === 'draft' ? <EditOutlined /> : <ExclamationCircleOutlined />}
          color={s === 'active' ? 'green' : s === 'draft' ? 'orange' : 'default'}
          style={{ borderRadius: radii.pill }}
        >
          {s}
        </Tag>
      ),
    },
    {
      title: '', key: 'action', width: 180, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {record.status === 'draft' && (
            <Button
              type="primary" size="small"
              icon={<SendOutlined />}
              loading={publishing === record.listingId}
              onClick={() => handlePublish(record.listingId)}
              style={{ background: BRAND, borderColor: BRAND, borderRadius: radii.pill, fontSize: 12 }}
            >
              Publish
            </Button>
          )}
          {record.listingId && (
            <a
              href={`https://www.etsy.com/listing/${record.listingId}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 12, color: BRAND, fontWeight: 500 }}
            >
              <ExportOutlined style={{ marginRight: 4 }} />View on Etsy
            </a>
          )}
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="listing_sync" featureName="Active listings sync" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <ShopOutlined style={{ marginRight: 10, color: BRAND }} />
            Active Listings
          </Title>
          <Text type="secondary">Monitor all your Etsy listings, SEO scores & performance</Text>
        </div>
        <UsageBadge featureKey="listing_sync" />
      </div>

      <FeatureGate featureKey="listing_sync">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={8}>
            <Card style={card}>
              <Statistic title="Total Listings" value={listings.length} prefix={<ShopOutlined style={{ color: BRAND }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={card}>
              <Statistic title="Total Views" value={totalViews} prefix={<EyeOutlined style={{ color: colors.info }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card style={card}>
              <Statistic title="Total Favorites" value={listings.reduce((s, l) => s + l.favorites, 0)} valueStyle={{ color: BRAND, fontWeight: 700 }} />
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
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateOpen(true)}
                style={{ background: BRAND, borderColor: BRAND, borderRadius: radii.sm }}
              >
                Create Listing
              </Button>
              <Button icon={<ReloadOutlined />} loading={loading} onClick={fetchListings}>
                Sync
              </Button>
            </Space>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
          ) : filtered.length > 0 ? (
            <Table
              columns={columns}
              dataSource={filtered}
              pagination={{ pageSize: 10 }}
              size="middle"
            />
          ) : (
            <Empty description="No listings found. Connect your Etsy shop and sync to see your listings here." />
          )}
        </Card>
      </FeatureGate>

      <CreateListingModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={() => { setCreateOpen(false); fetchListings(); }}
      />
    </AppLayout>
  );
};

export default ActiveListingsPage;
