import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Table, Tag, Space,
  Input, theme, Progress, Empty, Spin,
} from 'antd';
import {
  TruckOutlined, CheckCircleOutlined,
  SendOutlined, InboxOutlined, SearchOutlined,
  EnvironmentOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const statusConfig = {
  processing:  { color: colors.muted, icon: <InboxOutlined />, label: 'Processing' },
  shipped:     { color: colors.info, icon: <SendOutlined />, label: 'Shipped' },
  in_transit:  { color: BRAND, icon: <TruckOutlined />, label: 'In Transit' },
  delivered:   { color: colors.success, icon: <CheckCircleOutlined />, label: 'Delivered' },
  delayed:     { color: colors.danger, icon: <ExclamationCircleOutlined />, label: 'Delayed' },
};

const DeliveryStatusPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [search, setSearch] = useState('');
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await etsyApi.getDeliveryStatus({ search: search || undefined });
      const rows = (res.data?.orders || res.orders || []).map((o, i) => ({
        key: o.receiptId || o._id || i,
        orderId: o.receiptId ? `#${o.receiptId}` : `#${i}`,
        buyer: o.buyerName || o.buyer || '—',
        item: o.items?.[0]?.title || o.item || '—',
        status: o.shipmentStatus || o.status || 'processing',
        carrier: o.carrier || '—',
        tracking: o.trackingNumber || '—',
        eta: o.estimatedDelivery ? new Date(o.estimatedDelivery).toLocaleDateString() : '—',
        destination: o.destination || o.shipTo || '—',
      }));
      setOrders(rows);
    } catch (err) {
      if (err?.response?.status !== 401) console.warn('Failed to load delivery status');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const filtered = search
    ? orders.filter(o =>
        o.orderId.toLowerCase().includes(search.toLowerCase()) ||
        o.buyer.toLowerCase().includes(search.toLowerCase()) ||
        o.item.toLowerCase().includes(search.toLowerCase())
      )
    : orders;

  const delivered = orders.filter(o => o.status === 'delivered').length;
  const inTransit = orders.filter(o => o.status === 'in_transit' || o.status === 'shipped').length;
  const delayed = orders.filter(o => o.status === 'delayed').length;
  const processing = orders.filter(o => o.status === 'processing').length;

  const columns = [
    {
      title: 'Order', dataIndex: 'orderId', key: 'orderId', width: 80,
      render: (t) => <Text strong style={{ color: BRAND }}>{t}</Text>,
    },
    {
      title: 'Item', dataIndex: 'item', key: 'item', ellipsis: true,
      render: (t) => <Text style={{ fontSize: 13 }}>{t}</Text>,
    },
    {
      title: 'Buyer', dataIndex: 'buyer', key: 'buyer', width: 110,
      render: (t) => <Text>{t}</Text>,
    },
    {
      title: 'Destination', dataIndex: 'destination', key: 'destination', width: 140,
      render: (t) => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: colors.muted, fontSize: 12 }} />
          <Text style={{ fontSize: 12 }}>{t}</Text>
        </Space>
      ),
    },
    {
      title: 'Carrier', dataIndex: 'carrier', key: 'carrier', width: 80, align: 'center',
      render: (t) => <Tag style={{ borderRadius: radii.pill }}>{t}</Tag>,
    },
    {
      title: 'ETA', dataIndex: 'eta', key: 'eta', width: 80, align: 'center',
      render: (t) => <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text>,
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 120, align: 'center',
      render: (s) => {
        const cfg = statusConfig[s] || statusConfig.processing;
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TruckOutlined style={{ marginRight: 10, color: BRAND }} />
            Delivery Status
          </Title>
          <Text type="secondary">Track all your order shipments & delivery progress</Text>
        </div>
      </div>

      <FeatureGate featureKey="delivery_tracking">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Processing" value={processing} prefix={<InboxOutlined style={{ color: colors.muted }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="In Transit" value={inTransit} prefix={<TruckOutlined style={{ color: BRAND }} />} valueStyle={{ color: BRAND, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Delivered" value={delivered} prefix={<CheckCircleOutlined style={{ color: colors.success }} />} valueStyle={{ color: colors.success, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Delayed" value={delayed} prefix={<ExclamationCircleOutlined style={{ color: colors.danger }} />} valueStyle={{ color: delayed > 0 ? colors.danger : colors.success, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>

        {/* Fulfillment progress */}
        {orders.length > 0 && (
          <Card style={{ ...card, marginBottom: 24 }}>
            <Title level={5} style={{ marginBottom: 12 }}>Fulfillment Rate</Title>
            <Progress
              percent={Math.round((delivered / orders.length) * 100)}
              strokeColor={{ from: BRAND, to: colors.brandLight }}
              format={(pct) => `${pct}% delivered`}
            />
          </Card>
        )}

        {/* Table */}
        <Card style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Title level={5} style={{ margin: 0 }}>All Shipments</Title>
            <Input
              prefix={<SearchOutlined style={{ color: colors.muted }} />}
              placeholder="Search orders..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ width: 240, borderRadius: radii.sm }}
            />
          </div>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
          ) : filtered.length > 0 ? (
            <Table columns={columns} dataSource={filtered} pagination={{ pageSize: 10 }} size="middle" />
          ) : (
            <Empty description="No shipments found. Orders will appear here once your Etsy shop has receipts." />
          )}
        </Card>
      </FeatureGate>
    </AppLayout>
  );
};

export default DeliveryStatusPage;
