import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Table, Tag, Space,
  Input, theme, Progress, Empty, Spin, Select, Button, Tooltip,
  message, Badge,
} from 'antd';
import {
  TruckOutlined, CheckCircleOutlined,
  SendOutlined, InboxOutlined, SearchOutlined,
  EnvironmentOutlined, ExclamationCircleOutlined,
  ReloadOutlined, DollarOutlined, ClockCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

dayjs.extend(relativeTime);

const { Title, Text } = Typography;

const statusConfig = {
  paid:        { color: colors.warning,  icon: <ClockCircleOutlined />, label: 'Paid / Processing' },
  shipped:     { color: colors.info,     icon: <SendOutlined />,        label: 'Shipped' },
  in_transit:  { color: colors.brand,    icon: <TruckOutlined />,       label: 'In Transit' },
  delivered:   { color: colors.success,  icon: <CheckCircleOutlined />, label: 'Delivered' },
  completed:   { color: colors.success,  icon: <CheckCircleOutlined />, label: 'Completed' },
  cancelled:   { color: colors.muted,    icon: <CloseCircleOutlined />, label: 'Cancelled' },
  refunded:    { color: colors.danger,   icon: <ExclamationCircleOutlined />, label: 'Refunded' },
};

const DeliveryStatusPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState(null);
  const [orders, setOrders] = useState([]);
  const [summary, setSummary] = useState({});
  const [pagination, setPagination] = useState({ page: 1, limit: 25, total: 0, pages: 0 });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  /* ─── Fetch orders ─── */

  const fetchOrders = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = { page, limit: 25 };
      if (statusFilter) params.status = statusFilter;
      if (search.trim()) params.search = search.trim();

      const res = await etsyApi.getDeliveryStatus(params);
      const d = res.data || {};
      setOrders((d.orders || []).map((o, i) => ({ key: o._id || o.receiptId || i, ...o })));
      setSummary(d.summary || {});
      setPagination(d.pagination || { page: 1, limit: 25, total: 0, pages: 0 });
    } catch (err) {
      if (err?.response?.status !== 401) console.warn('Failed to load delivery status');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => { fetchOrders(1); }, [fetchOrders]);

  /* ─── Sync receipts ─── */

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await etsyApi.syncReceipts();
      message.success(res.message || `Synced ${res.data?.syncedCount || 0} receipts`);
      fetchOrders(1);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  /* ─── Stats from summary ─── */

  const getCount = (key) => summary[key]?.count || 0;
  const processing = getCount('paid');
  const inTransit = getCount('in_transit') + getCount('shipped');
  const delivered = getCount('delivered') + getCount('completed');
  const cancelled = getCount('cancelled') + getCount('refunded');
  const totalOrders = Object.values(summary).reduce((s, v) => s + (v.count || 0), 0);
  const totalRevenue = Object.values(summary).reduce((s, v) => s + (v.revenue || 0), 0);
  const fulfillPct = totalOrders > 0 ? Math.round((delivered / totalOrders) * 100) : 0;

  /* ─── Table columns ─── */

  const columns = [
    {
      title: 'Order',
      dataIndex: 'receiptId',
      key: 'receiptId',
      width: 100,
      render: t => <Text strong style={{ color: colors.brand, fontSize: 13 }}>#{t}</Text>,
    },
    {
      title: 'Item(s)',
      key: 'items',
      ellipsis: true,
      render: (_, row) => {
        const items = row.items || [];
        if (!items.length) return <Text type="secondary">—</Text>;
        const first = items[0];
        return (
          <div style={{ lineHeight: 1.3 }}>
            <Text style={{ fontSize: 13 }}>{first.title}</Text>
            {items.length > 1 && (
              <Text type="secondary" style={{ fontSize: 11, display: 'block' }}>
                +{items.length - 1} more item{items.length > 2 ? 's' : ''}
              </Text>
            )}
          </div>
        );
      },
    },
    {
      title: 'Amount',
      dataIndex: 'grandTotal',
      key: 'grandTotal',
      width: 90,
      align: 'right',
      sorter: (a, b) => (a.grandTotal || 0) - (b.grandTotal || 0),
      render: (v, row) => (
        <Text strong style={{ fontSize: 13 }}>
          {row.currencyCode === 'USD' ? '$' : row.currencyCode + ' '}{(v || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: 'Destination',
      dataIndex: 'destination',
      key: 'destination',
      width: 160,
      ellipsis: true,
      render: t => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: colors.muted, fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{t}</Text>
        </Space>
      ),
    },
    {
      title: 'Carrier',
      dataIndex: 'carrier',
      key: 'carrier',
      width: 100,
      align: 'center',
      render: t => t ? <Tag style={{ borderRadius: radii.pill }}>{t}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Tracking',
      dataIndex: 'trackingCode',
      key: 'trackingCode',
      width: 120,
      ellipsis: true,
      render: t => t
        ? <Text copyable={{ text: t }} style={{ fontSize: 11, fontFamily: 'monospace' }}>{t}</Text>
        : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
    {
      title: 'ETA',
      key: 'eta',
      width: 110,
      render: (_, row) => {
        if (row.deliveredAt) return (
          <Tooltip title={dayjs(row.deliveredAt).format('MMM D, YYYY')}>
            <Tag color="success" style={{ fontSize: 11 }}>
              <CheckCircleOutlined /> Delivered
            </Tag>
          </Tooltip>
        );
        if (row.estimatedDelivery) return (
          <Tooltip title={dayjs(row.estimatedDelivery).format('MMM D, YYYY')}>
            <Text style={{ fontSize: 12 }}>{dayjs(row.estimatedDelivery).fromNow()}</Text>
          </Tooltip>
        );
        return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
      },
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: t => (
        <Tooltip title={t ? dayjs(t).format('MMM D, YYYY h:mm A') : '—'}>
          <Text type="secondary" style={{ fontSize: 12 }}>{t ? dayjs(t).fromNow() : '—'}</Text>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 130,
      align: 'center',
      render: s => {
        const cfg = statusConfig[s] || statusConfig.paid;
        return (
          <Tag
            icon={cfg.icon}
            style={{
              background: `${cfg.color}18`, color: cfg.color, border: 'none',
              borderRadius: radii.pill, fontWeight: 600, fontSize: 11,
            }}
          >
            {cfg.label}
          </Tag>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TruckOutlined style={{ marginRight: 10, color: colors.brand }} />
            Delivery Status
          </Title>
          <Text type="secondary">Track all your order shipments & delivery progress</Text>
        </div>
        <Button
          icon={<ReloadOutlined spin={syncing} />}
          onClick={handleSync}
          loading={syncing}
          style={{ borderRadius: radii.sm }}
        >
          Sync Orders
        </Button>
      </div>

      <FeatureGate featureKey="delivery_tracking">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Processing</Text>}
                value={processing}
                prefix={<InboxOutlined style={{ color: colors.warning }} />}
                valueStyle={{ fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>In Transit</Text>}
                value={inTransit}
                prefix={<TruckOutlined style={{ color: colors.brand }} />}
                valueStyle={{ color: colors.brand, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Delivered</Text>}
                value={delivered}
                prefix={<CheckCircleOutlined style={{ color: colors.success }} />}
                valueStyle={{ color: colors.success, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Cancelled / Refunded</Text>}
                value={cancelled}
                prefix={<ExclamationCircleOutlined style={{ color: cancelled > 0 ? colors.danger : colors.muted }} />}
                valueStyle={{ color: cancelled > 0 ? colors.danger : 'inherit', fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Revenue + fulfillment */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={24} md={12}>
            <Card style={card}>
              <Row align="middle" justify="space-between">
                <Col>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Total Revenue</Text>}
                    value={totalRevenue}
                    prefix={<DollarOutlined style={{ color: colors.success }} />}
                    precision={2}
                    valueStyle={{ color: colors.success, fontWeight: 700 }}
                  />
                </Col>
                <Col>
                  <Badge
                    count={`${totalOrders} orders`}
                    style={{ backgroundColor: colors.brand, fontSize: 11 }}
                  />
                </Col>
              </Row>
            </Card>
          </Col>
          <Col xs={24} md={12}>
            <Card style={card}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>Fulfillment Rate</Text>
              <Progress
                percent={fulfillPct}
                strokeColor={{ from: colors.brand, to: colors.brandLight }}
                format={pct => `${pct}%`}
                style={{ marginBottom: 0 }}
              />
              <Text type="secondary" style={{ fontSize: 11 }}>
                {delivered} of {totalOrders} orders delivered
              </Text>
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <Title level={5} style={{ margin: 0 }}>All Shipments</Title>
            <Space size={8}>
              <Select
                allowClear
                placeholder="Filter by status"
                value={statusFilter}
                onChange={v => setStatusFilter(v || null)}
                style={{ width: 160 }}
                options={[
                  { value: 'paid', label: 'Processing' },
                  { value: 'shipped', label: 'Shipped' },
                  { value: 'in_transit', label: 'In Transit' },
                  { value: 'delivered', label: 'Delivered' },
                  { value: 'completed', label: 'Completed' },
                  { value: 'cancelled', label: 'Cancelled' },
                  { value: 'refunded', label: 'Refunded' },
                ]}
              />
              <Input
                prefix={<SearchOutlined style={{ color: colors.muted }} />}
                placeholder="Search orders..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onPressEnter={() => fetchOrders(1)}
                style={{ width: 200, borderRadius: radii.sm }}
                allowClear
              />
            </Space>
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
          ) : orders.length > 0 ? (
            <Table
              columns={columns}
              dataSource={orders}
              size="middle"
              scroll={{ x: 1000 }}
              pagination={{
                current: pagination.page,
                pageSize: pagination.limit,
                total: pagination.total,
                showTotal: (t) => `${t} orders`,
                onChange: (p) => fetchOrders(p),
              }}
            />
          ) : (
            <Empty
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    No shipments found
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Orders will appear here once your Etsy shop has receipts. Click "Sync Orders" to pull latest data.
                  </Text>
                </div>
              }
            />
          )}
        </Card>
      </FeatureGate>
    </AppLayout>
  );
};

export default DeliveryStatusPage;
