import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Table, Tag, Typography, Row, Col, Avatar,
  Space, Empty, Statistic, message, theme, Tooltip, Badge, Popconfirm, Modal, Spin,
} from 'antd';
import {
  PlusOutlined, ShopOutlined, TrophyOutlined, StarFilled,
  RiseOutlined, FallOutlined, DeleteOutlined, TeamOutlined,
  ReloadOutlined, DollarOutlined, LinkOutlined, HeartOutlined,
  EyeOutlined, TagOutlined, CrownOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const CompetitorTrackerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, plan } = usePermissions();
  const access = getFeatureAccess('competitor_tracking');
  const navigate = useNavigate();

  const [shopUrl, setShopUrl] = useState('');
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState(null);
  const [refreshingAll, setRefreshingAll] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  /* ─── Fetch watch list ─── */

  const fetchWatchList = useCallback(async () => {
    try {
      const res = await etsyApi.getWatchList();
      const list = (res.data?.watches || []).map(w => ({
        key: w._id,
        _id: w._id,
        shopName: w.shopName,
        etsyShopId: w.etsyShopId,
        iconUrl: w.iconUrl || '',
        shopCountry: w.shopCountry || '',
        totalSales: w.latestSnapshot?.totalSales || 0,
        totalListings: w.latestSnapshot?.totalListings || 0,
        avgPrice: w.latestSnapshot?.avgPrice || 0,
        rating: w.latestSnapshot?.rating || 0,
        reviewCount: w.latestSnapshot?.reviewCount || 0,
        dailySalesDelta: w.latestSnapshot?.dailySalesDelta || 0,
        capturedAt: w.latestSnapshot?.capturedAt || w.addedAt,
        status: w.status || 'active',
        addedAt: w.addedAt,
      }));
      setShops(list);
    } catch (err) {
      if (err?.response?.status !== 401) {
        console.warn('Failed to load watch list');
      }
    } finally {
      setFetchLoading(false);
    }
  }, []);

  useEffect(() => { fetchWatchList(); }, [fetchWatchList]);

  /* ─── Add competitor ─── */

  const handleAdd = async () => {
    const raw = shopUrl.trim();
    if (!raw) { message.warning('Enter an Etsy shop URL or name'); return; }
    setLoading(true);
    try {
      let shopName = raw;
      // Extract shop name from various URL formats
      const urlMatch = raw.match(/etsy\.com\/shop\/([A-Za-z0-9_-]+)/i);
      if (urlMatch) shopName = urlMatch[1];
      else shopName = raw.replace(/[^a-zA-Z0-9\-_]/g, '');

      await etsyApi.addCompetitor({ shopName });
      incrementUsage('competitor_tracking');
      message.success(`Now tracking ${shopName}`);
      setShopUrl('');
      fetchWatchList();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to add competitor');
    } finally {
      setLoading(false);
    }
  };

  /* ─── Remove competitor ─── */

  const handleRemove = async (record) => {
    try {
      await etsyApi.removeCompetitor(record._id);
      setShops(prev => prev.filter(s => s.key !== record.key));
      message.success(`${record.shopName} removed`);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to remove competitor');
    }
  };

  /* ─── Refresh single ─── */

  const handleRefresh = async (record) => {
    setRefreshingId(record._id);
    try {
      await etsyApi.refreshCompetitor(record._id);
      message.success(`${record.shopName} refreshed`);
      fetchWatchList();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Refresh failed');
    } finally {
      setRefreshingId(null);
    }
  };

  /* ─── Refresh all ─── */

  const handleRefreshAll = async () => {
    setRefreshingAll(true);
    try {
      const res = await etsyApi.refreshAllCompetitors();
      const d = res.data || {};
      message.success(`Refreshed ${d.refreshed || 0} shops${d.failed ? ` (${d.failed} failed)` : ''}`);
      fetchWatchList();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Refresh all failed');
    } finally {
      setRefreshingAll(false);
    }
  };

  /* ─── Stats ─── */

  const totalSales = shops.reduce((s, r) => s + r.totalSales, 0);
  const avgRating = shops.length
    ? Math.round(shops.reduce((s, r) => s + r.rating, 0) / shops.length * 10) / 10
    : 0;
  const avgPrice = shops.length
    ? Math.round(shops.reduce((s, r) => s + r.avgPrice, 0) / shops.length * 100) / 100
    : 0;

  /* ─── Feature access (for listings modal) ─── */

  const listingAccess = getFeatureAccess('competitor_listing_limit');
  const tagAccess = getFeatureAccess('competitor_tag_limit');
  const detailAccess = getFeatureAccess('competitor_detail_access');

  const listingLimit = (listingAccess.state === 'unlocked' && listingAccess.limit) ? listingAccess.limit : 10;
  const tagLimit = (tagAccess.state === 'unlocked' && tagAccess.limit) ? tagAccess.limit : 5;
  const tagUnlimited = tagAccess.state === 'unlocked' && (tagAccess.unlimited || !tagAccess.limit);
  const hasDetailAccess = detailAccess.state === 'unlocked';

  /* ─── Listings modal state ─── */

  const [listingsModal, setListingsModal] = useState({ open: false, record: null });
  const [listingsData, setListingsData] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);
  const [allListingsModal, setAllListingsModal] = useState({ open: false, record: null });
  const [allListingsData, setAllListingsData] = useState([]);
  const [allListingsLoading, setAllListingsLoading] = useState(false);

  const openListingsModal = async (record) => {
    setListingsModal({ open: true, record });
    setListingsData([]);
    setListingsLoading(true);
    try {
      const res = await etsyApi.getCompetitorDetail(record._id);
      setListingsData(res.data?.topListings || []);
    } catch { setListingsData([]); }
    finally { setListingsLoading(false); }
  };

  const handleLoadMore = async () => {
    if (!hasDetailAccess) {
      Modal.info({
        title: 'Upgrade to Pro Plus',
        icon: <CrownOutlined style={{ color: colors.brand }} />,
        content: (
          <div>
            <Text style={{ display: 'block', marginBottom: 12 }}>
              Access all competitor listings with detailed insights on the Pro Plus plan.
            </Text>
            <Text type="secondary">
              Current Plan: <Tag color={colors.brand}>{plan.name}</Tag>
            </Text>
          </div>
        ),
        okText: 'Upgrade Plan',
        onOk: () => navigate('/settings?tab=plans'),
      });
      return;
    }
    const record = listingsModal.record;
    setAllListingsModal({ open: true, record });
    setAllListingsLoading(true);
    try {
      const res = await etsyApi.getCompetitorDetail(record._id);
      setAllListingsData(res.data?.topListings || []);
    } catch { message.error('Failed to load all listings'); }
    finally { setAllListingsLoading(false); }
  };

  const renderTags = (tags) => {
    const allTags = tags || [];
    if (tagUnlimited) {
      return (
        <Space size={2} wrap>
          {allTags.map((t, i) => (
            <Tag key={i} style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>{t}</Tag>
          ))}
        </Space>
      );
    }
    const visible = allTags.slice(0, tagLimit);
    const remaining = allTags.length - tagLimit;
    return (
      <Space size={2} wrap>
        {visible.map((t, i) => (
          <Tag key={i} style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>{t}</Tag>
        ))}
        {remaining > 0 && (
          <Tooltip title="Upgrade to Pro to see all tags">
            <Tag
              style={{ fontSize: 10, margin: 0, lineHeight: '18px', cursor: 'pointer', color: colors.brand, borderColor: colors.brand }}
              onClick={(e) => {
                e.stopPropagation();
                Modal.info({
                  title: 'Upgrade to Pro',
                  icon: <CrownOutlined style={{ color: colors.brand }} />,
                  content: (
                    <div>
                      <Text style={{ display: 'block', marginBottom: 12 }}>
                        See all tags on competitor listings with the Pro plan.
                      </Text>
                      <Text type="secondary">
                        Current Plan: <Tag color={colors.brand}>{plan.name}</Tag>
                      </Text>
                    </div>
                  ),
                  okText: 'Upgrade Plan',
                  onOk: () => navigate('/settings?tab=plans'),
                });
              }}
            >
              +{remaining}
            </Tag>
          </Tooltip>
        )}
      </Space>
    );
  };

  const listingColumns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (t, r) => (
        <a
          href={`https://www.etsy.com/listing/${r.listingId}`}
          target="_blank" rel="noopener noreferrer"
          style={{ color: colors.brand, fontSize: 12 }}
        >
          {t} <LinkOutlined style={{ fontSize: 9, opacity: 0.5 }} />
        </a>
      ),
    },
    {
      title: 'Price',
      dataIndex: 'price',
      key: 'price',
      width: 80,
      align: 'right',
      render: v => <Text style={{ fontSize: 12 }}>${v?.toFixed(2)}</Text>,
    },
    {
      title: <><EyeOutlined /> Views</>,
      dataIndex: 'views',
      key: 'views',
      width: 80,
      align: 'center',
      render: v => <Text style={{ fontSize: 12 }}>{(v || 0).toLocaleString()}</Text>,
    },
    {
      title: <><HeartOutlined /> Faves</>,
      dataIndex: 'favorites',
      key: 'favorites',
      width: 80,
      align: 'center',
      render: v => <Text style={{ fontSize: 12 }}>{(v || 0).toLocaleString()}</Text>,
    },
    {
      title: <><TagOutlined /> Tags</>,
      dataIndex: 'tags',
      key: 'tags',
      width: 200,
      render: (tags) => renderTags(tags),
    },
  ];

  /* ─── Main table columns ─── */

  const columns = [
    {
      title: 'Shop',
      dataIndex: 'shopName',
      key: 'shopName',
      render: (text, record) => (
        <Space>
          <Avatar
            src={record.iconUrl || undefined}
            icon={!record.iconUrl && <ShopOutlined />}
            size={36}
            style={{ background: !record.iconUrl ? colors.brand : undefined }}
          />
          <div style={{ lineHeight: 1.3 }}>
            <a
              href={`https://www.etsy.com/shop/${encodeURIComponent(text)}`}
              target="_blank" rel="noopener noreferrer"
              style={{ fontWeight: 600, fontSize: 13, color: 'inherit' }}
            >
              {text} <LinkOutlined style={{ fontSize: 10, opacity: 0.5 }} />
            </a>
            {record.shopCountry && (
              <div>
                <Text type="secondary" style={{ fontSize: 11 }}>
                  📍 {record.shopCountry}
                </Text>
              </div>
            )}
          </div>
        </Space>
      ),
    },
    {
      title: 'Total Sales',
      dataIndex: 'totalSales',
      key: 'totalSales',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.totalSales - b.totalSales,
      render: v => <Text strong>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Listings',
      dataIndex: 'totalListings',
      key: 'totalListings',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.totalListings - b.totalListings,
      render: v => v.toLocaleString(),
    },
    {
      title: 'Daily Δ',
      dataIndex: 'dailySalesDelta',
      key: 'dailySalesDelta',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.dailySalesDelta - b.dailySalesDelta,
      render: v => {
        if (v > 0) return <Tag color="success" style={{ fontWeight: 600 }}><RiseOutlined /> +{v}</Tag>;
        if (v < 0) return <Tag color="error" style={{ fontWeight: 600 }}><FallOutlined /> {v}</Tag>;
        return <Tag>0</Tag>;
      },
    },
    {
      title: 'Avg Price',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.avgPrice - b.avgPrice,
      render: v => <Text>${v.toFixed(2)}</Text>,
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.rating - b.rating,
      render: (v, record) => (
        <Tooltip title={`${record.reviewCount.toLocaleString()} reviews`}>
          <Tag color="gold" style={{ fontWeight: 600 }}>
            <StarFilled /> {v > 0 ? v.toFixed(1) : '—'}
          </Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 80,
      align: 'center',
      render: v => (
        <Badge
          status={v === 'active' ? 'success' : 'error'}
          text={<Text style={{ fontSize: 12 }}>{v === 'active' ? 'Active' : 'Error'}</Text>}
        />
      ),
    },
    {
      title: 'Last Synced',
      dataIndex: 'capturedAt',
      key: 'capturedAt',
      width: 120,
      render: v => (
        <Tooltip title={v ? dayjs(v).format('MMM D, YYYY h:mm A') : '—'}>
          <Text type="secondary" style={{ fontSize: 12 }}>{v ? dayjs(v).fromNow() : '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Actions',
      key: 'action',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space size={4}>
          <Tooltip title="Top Listings">
            <Button
              type="text" size="small"
              icon={<TrophyOutlined />}
              onClick={() => openListingsModal(record)}
              style={{ color: colors.brand }}
            />
          </Tooltip>
          <Tooltip title="Refresh data">
            <Button
              type="text" size="small"
              icon={<ReloadOutlined spin={refreshingId === record._id} />}
              onClick={() => handleRefresh(record)}
              disabled={refreshingId === record._id}
            />
          </Tooltip>
          <Popconfirm
            title="Remove this shop?"
            onConfirm={() => handleRemove(record)}
            okText="Remove"
            cancelText="Cancel"
          >
            <Button type="text" size="small" icon={<DeleteOutlined />} danger />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TeamOutlined style={{ color: colors.brand, marginRight: 8 }} />
            Shop Tracker
          </Title>
          <Text type="secondary">Monitor competitor shops, listings, prices, and daily sales</Text>
        </div>
        <Space>
          {shops.length > 0 && (
            <Button
              icon={<ReloadOutlined spin={refreshingAll} />}
              onClick={handleRefreshAll}
              loading={refreshingAll}
              style={{ borderRadius: radii.sm }}
            >
              Refresh All
            </Button>
          )}
          {access.state === 'unlocked' && (
            <UsageBadge used={access.used} limit={access.unlimited ? null : access.limit} showLabel />
          )}
        </Space>
      </div>

      <QuotaBanner featureKey="competitor_tracking" featureName="Tracked Shops" />

      <FeatureGate featureKey="competitor_tracking">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Tracked Shops</Text>}
                value={shops.length}
                prefix={<ShopOutlined style={{ color: colors.brand }} />}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Total Sales</Text>}
                value={totalSales}
                prefix={<TrophyOutlined style={{ color: colors.success }} />}
                formatter={v => Number(v).toLocaleString()}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Avg Rating</Text>}
                value={avgRating || '—'}
                prefix={<StarFilled style={{ color: '#faad14' }} />}
                precision={avgRating ? 1 : 0}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Avg Price</Text>}
                value={avgPrice}
                prefix={<DollarOutlined style={{ color: colors.brand }} />}
                precision={2}
              />
            </Card>
          </Col>
        </Row>

        {/* Add shop */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={16}>
              <Input
                placeholder="Enter Etsy shop URL or name (e.g. CraftedByEmma or https://etsy.com/shop/CraftedByEmma)"
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
              pagination={shops.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
              size="middle"
              loading={fetchLoading}
              scroll={{ x: 900 }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    No shops tracked yet
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Add a competitor's Etsy shop above to start monitoring their sales, listings, and pricing.
                  </Text>
                </div>
              }
            />
          )}
        </Card>

        {/* ─── Top Listings Modal ─── */}
        <Modal
          open={listingsModal.open}
          onCancel={() => setListingsModal({ open: false, record: null })}
          footer={null}
          width={900}
          destroyOnClose
          title={null}
          closable
          styles={{ body: { padding: 0 }, header: { display: 'none' } }}
        >
          {listingsModal.record && (
            <>
              <div style={{
                background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight || '#8B83FF'})`,
                padding: '20px 24px',
                borderRadius: '8px 8px 0 0',
                color: '#fff',
              }}>
                <Space size={16} align="start">
                  <Avatar
                    src={listingsModal.record.iconUrl || undefined}
                    icon={!listingsModal.record.iconUrl && <ShopOutlined />}
                    size={48}
                    style={{ background: 'rgba(255,255,255,0.2)', border: '2px solid rgba(255,255,255,0.3)' }}
                  />
                  <div>
                    <Text style={{ color: '#fff', fontSize: 18, fontWeight: 700, display: 'block', lineHeight: 1.3 }}>
                      {listingsModal.record.shopName}
                    </Text>
                    <Space size={16} style={{ marginTop: 4 }}>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                        <TrophyOutlined /> {listingsModal.record.totalSales.toLocaleString()} sales
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                        <StarFilled /> {listingsModal.record.rating > 0 ? listingsModal.record.rating.toFixed(1) : '—'}
                      </Text>
                      <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                        {listingsModal.record.totalListings} listings
                      </Text>
                    </Space>
                  </div>
                </Space>
              </div>

              <div style={{ padding: '16px 24px 24px' }}>
                {listingsLoading ? (
                  <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                ) : listingsData.length === 0 ? (
                  <Text type="secondary">No listing data captured yet. Try refreshing the shop.</Text>
                ) : (
                  <>
                    <Text strong style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
                      Top Listings ({Math.min(listingsData.length, listingLimit)} of {listingsData.length} available)
                    </Text>
                    <Table
                      dataSource={listingsData.slice(0, listingLimit).map((l, i) => ({ key: i, ...l }))}
                      columns={listingColumns}
                      pagination={false}
                      size="small"
                    />
                    {listingsData.length > listingLimit && (
                      <div style={{ textAlign: 'center', marginTop: 16 }}>
                        <Button
                          type="primary"
                          ghost
                          icon={hasDetailAccess ? <TrophyOutlined /> : <CrownOutlined />}
                          onClick={handleLoadMore}
                          style={{ borderColor: colors.brand, color: colors.brand, fontWeight: 600 }}
                        >
                          {hasDetailAccess
                            ? `View All ${listingsData.length} Listings`
                            : `Unlock All ${listingsData.length} Listings — Upgrade to Pro Plus`}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </Modal>

        {/* ─── All Listings Modal (Pro Plus) ─── */}
        <Modal
          open={allListingsModal.open}
          onCancel={() => setAllListingsModal({ open: false, record: null })}
          footer={null}
          width={950}
          destroyOnClose
          title={`All Listings — ${allListingsModal.record?.shopName || ''}`}
        >
          {allListingsLoading ? (
            <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
          ) : (
            <Table
              dataSource={allListingsData.map((l, i) => ({ key: i, ...l }))}
              columns={listingColumns}
              pagination={allListingsData.length > 25 ? { pageSize: 25, showSizeChanger: false } : false}
              size="small"
              scroll={{ y: 500 }}
            />
          )}
        </Modal>
      </FeatureGate>
    </AppLayout>
  );
};

export default CompetitorTrackerPage;
