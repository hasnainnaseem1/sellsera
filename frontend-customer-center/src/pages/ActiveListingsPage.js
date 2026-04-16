import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Row, Col, Statistic,
  Button, theme, Input, message, Empty, Spin, Space, Popconfirm, Tooltip,
} from 'antd';
import {
  ShopOutlined, CheckCircleOutlined,
  ExclamationCircleOutlined, SearchOutlined, ReloadOutlined,
  EyeOutlined, ExportOutlined, PlusOutlined, SendOutlined,
  EditOutlined, PauseCircleOutlined,
  StarOutlined, StarFilled,
  UploadOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import CreateListingModal from '../components/CreateListingModal';
import EditListingModal from '../components/EditListingModal';
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
  const [editOpen, setEditOpen] = useState(false);
  const [editListingId, setEditListingId] = useState(null);
  const [publishing, setPublishing] = useState(null);
  const [uploading, setUploading] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [deactivating, setDeactivating] = useState(null);
  const [reactivating, setReactivating] = useState(null);


  const handleFileUpload = (listingId, autoPublish = false) => {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.zip,.pdf,.epub,.jpg,.jpeg,.png,.gif,.svg,.psd,.ai,.doc,.docx,.xls,.xlsx,.mp3,.wav,.mp4,.mov,.txt,.csv';
      input.onchange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) { resolve(false); return; }
        setUploading(listingId);
        try {
          await etsyApi.uploadListingFile(listingId, file);
          message.success(`File "${file.name}" uploaded successfully!`);
          resolve(true);
        } catch (err) {
          message.error(err?.response?.data?.message || 'Failed to upload file');
          resolve(false);
        } finally {
          setUploading(null);
        }
      };
      input.oncancel = () => resolve(false);
      input.click();
    });
  };

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
        fetchListings();
      } else if (errMsg.toLowerCase().includes('upload a file')) {
        message.info('This digital listing needs a file. Please select a file to upload.');
        setPublishing(null);
        const uploaded = await handleFileUpload(listingId);
        if (uploaded) {
          // Auto-retry publish after successful file upload
          setPublishing(listingId);
          try {
            await etsyApi.publishListing(listingId);
            message.success('Listing published successfully!');
            fetchListings();
          } catch (retryErr) {
            message.error(retryErr?.response?.data?.message || 'Failed to publish after file upload. You may need to add an image too.');
          } finally {
            setPublishing(null);
          }
        }
        return; // skip the finally below since we handled setPublishing above
      } else {
        message.error(errMsg);
      }
    } finally {
      setPublishing(null);
    }
  };

  const handleDeactivate = async (listingId) => {
    setDeactivating(listingId);
    try {
      await etsyApi.deactivateListing(listingId);
      message.success('Listing deactivated successfully!');
      fetchListings();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to deactivate listing');
    } finally {
      setDeactivating(null);
    }
  };

  const handleReactivate = async (listingId) => {
    setReactivating(listingId);
    try {
      await etsyApi.publishListing(listingId);
      message.success('Listing reactivated successfully!');
      fetchListings();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to reactivate listing');
    } finally {
      setReactivating(null);
    }
  };

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleSync = async () => {
    setSyncing(true);
    const hide = message.loading('Syncing listings from Etsy...', 0);
    try {
      const res = await etsyApi.sync();
      const jobId = res.data?.jobId || res.jobId;
      if (!jobId) {
        hide();
        message.success('Sync completed!');
        fetchListings();
        setSyncing(false);
        return;
      }
      const poll = setInterval(async () => {
        try {
          const status = await etsyApi.getSyncStatus(jobId);
          const st = status.data?.status || status.status;
          if (st === 'completed') {
            clearInterval(poll);
            hide();
            message.success('Listings synced successfully!');
            fetchListings();
            setSyncing(false);
          } else if (st === 'failed') {
            clearInterval(poll);
            hide();
            message.error(status.data?.error || status.error || 'Sync failed');
            setSyncing(false);
          }
        } catch {
          clearInterval(poll);
          hide();
          message.error('Failed to check sync status');
          setSyncing(false);
        }
      }, 3000);
      // Safety timeout — 5 minutes
      setTimeout(() => {
        clearInterval(poll);
        hide();
        setSyncing(false);
      }, 5 * 60 * 1000);
    } catch (err) {
      hide();
      message.error(err?.response?.data?.message || 'Failed to start sync');
      setSyncing(false);
    }
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
        isDigital: l.isDigital || false,
        featuredRank: l.featuredRank || 0,
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
        { text: 'Inactive', value: 'inactive' },
        { text: 'Draft', value: 'draft' },
        { text: 'Edit', value: 'edit' },
        { text: 'Sold Out', value: 'sold_out' },
        { text: 'Expired', value: 'expired' },
      ],
      onFilter: (value, record) => record.status === value,
      render: (s) => {
        const cfg = {
          active: { icon: <CheckCircleOutlined />, color: 'green' },
          draft: { icon: <EditOutlined />, color: 'orange' },
          inactive: { icon: <PauseCircleOutlined />, color: 'red' },
          edit: { icon: <EditOutlined />, color: 'orange' },
          sold_out: { icon: <ExclamationCircleOutlined />, color: 'volcano' },
          expired: { icon: <ExclamationCircleOutlined />, color: 'default' },
        };
        const { icon, color } = cfg[s] || { icon: <ExclamationCircleOutlined />, color: 'default' };
        return (
          <Tag icon={icon} color={color} style={{ borderRadius: radii.pill }}>
            {s === 'sold_out' ? 'sold out' : s}
          </Tag>
        );
      },
    },
    {
      title: '', key: 'action', width: 380, align: 'center',
      render: (_, record) => (
        <Space size={4}>
          {record.listingId && record.status === 'active' && getFeatureAccess('edit_listing').state === 'unlocked' && (
            <Tooltip title="Feature/unfeature is temporarily unavailable via Etsy API. Use Etsy Shop Manager instead.">
              <Button
                size="small"
                type="text"
                icon={record.featuredRank > 0 ? <StarFilled style={{ color: '#faad14' }} /> : <StarOutlined style={{ color: '#d9d9d9' }} />}
                disabled
                style={{ borderRadius: radii.pill, cursor: 'not-allowed' }}
              />
            </Tooltip>
          )}
          {record.listingId && getFeatureAccess('edit_listing').state === 'unlocked' && (
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => { setEditListingId(record.listingId); setEditOpen(true); }}
              style={{ borderRadius: radii.pill, fontSize: 12 }}
            >
              Edit
            </Button>
          )}
          {record.status === 'active' && record.listingId && getFeatureAccess('edit_listing').state === 'unlocked' && (
            <Popconfirm
              title="Deactivate this listing?"
              description="The listing will be hidden from your Etsy shop."
              onConfirm={() => handleDeactivate(record.listingId)}
              okText="Deactivate"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
            >
              <Button
                size="small"
                icon={<PauseCircleOutlined />}
                loading={deactivating === record.listingId}
                style={{ borderRadius: radii.pill, fontSize: 12 }}
              >
                Deactivate
              </Button>
            </Popconfirm>
          )}
          {!['active', 'draft'].includes(record.status) && record.listingId && getFeatureAccess('edit_listing').state === 'unlocked' && (
            <Popconfirm
              title="Reactivate this listing?"
              description="The listing will be visible on your Etsy shop again."
              onConfirm={() => handleReactivate(record.listingId)}
              okText="Reactivate"
              cancelText="Cancel"
            >
              <Button
                type="primary" size="small"
                icon={<CheckCircleOutlined />}
                loading={reactivating === record.listingId}
                style={{ background: colors.success, borderColor: colors.success, borderRadius: radii.pill, fontSize: 12 }}
              >
                Reactivate
              </Button>
            </Popconfirm>
          )}
          {record.status === 'draft' && record.isDigital && (
            <Button
              size="small"
              icon={<UploadOutlined />}
              loading={uploading === record.listingId}
              onClick={() => handleFileUpload(record.listingId)}
              style={{ borderRadius: radii.pill, fontSize: 12 }}
            >
              Upload File
            </Button>
          )}
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
              {getFeatureAccess('create_listing').state === 'unlocked' && (
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => setCreateOpen(true)}
                  style={{ background: BRAND, borderColor: BRAND, borderRadius: radii.sm }}
                >
                  Create Listing
                </Button>
              )}
              <Button icon={<ReloadOutlined />} loading={syncing} onClick={handleSync}>
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

      <EditListingModal
        open={editOpen}
        onClose={() => { setEditOpen(false); setEditListingId(null); }}
        onSuccess={() => { setEditOpen(false); setEditListingId(null); fetchListings(); }}
        listingId={editListingId}
      />
    </AppLayout>
  );
};

export default ActiveListingsPage;
