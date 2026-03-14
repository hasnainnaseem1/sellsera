import React, { useState } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Table, Tag, Space,
  Input, theme, Progress,
} from 'antd';
import {
  TruckOutlined, CheckCircleOutlined,
  SendOutlined, InboxOutlined, SearchOutlined,
  EnvironmentOutlined, ExclamationCircleOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const MOCK_ORDERS = [
  { key: 1, orderId: '#8421', buyer: 'Sarah M.', item: 'Handmade Ceramic Mug', status: 'delivered', carrier: 'USPS', tracking: '9400111899223...', shipped: 'Mar 8', eta: 'Mar 11', destination: 'New York, NY' },
  { key: 2, orderId: '#8420', buyer: 'James L.', item: 'Gold Chain Necklace', status: 'in_transit', carrier: 'UPS', tracking: '1Z999AA10123...', shipped: 'Mar 10', eta: 'Mar 14', destination: 'Los Angeles, CA' },
  { key: 3, orderId: '#8419', buyer: 'Emily R.', item: 'Custom Pet Portrait', status: 'in_transit', carrier: 'USPS', tracking: '9400111899224...', shipped: 'Mar 9', eta: 'Mar 13', destination: 'Chicago, IL' },
  { key: 4, orderId: '#8418', buyer: 'Mike T.', item: 'Vintage Leather Journal', status: 'shipped', carrier: 'FedEx', tracking: '7489234091...', shipped: 'Mar 12', eta: 'Mar 16', destination: 'Houston, TX' },
  { key: 5, orderId: '#8417', buyer: 'Lisa K.', item: 'Boho Macrame Hanging', status: 'processing', carrier: '—', tracking: '—', shipped: '—', eta: 'Mar 18', destination: 'Phoenix, AZ' },
  { key: 6, orderId: '#8416', buyer: 'David W.', item: 'Silver Ring Set', status: 'delivered', carrier: 'USPS', tracking: '9400111899225...', shipped: 'Mar 5', eta: 'Mar 8', destination: 'Seattle, WA' },
  { key: 7, orderId: '#8415', buyer: 'Anna P.', item: 'Crystal Earrings', status: 'delayed', carrier: 'USPS', tracking: '9400111899226...', shipped: 'Mar 3', eta: 'Mar 7', destination: 'Denver, CO' },
];

const statusConfig = {
  processing:  { color: colors.muted, icon: <InboxOutlined />, label: 'Processing', step: 0 },
  shipped:     { color: colors.info, icon: <SendOutlined />, label: 'Shipped', step: 1 },
  in_transit:  { color: BRAND, icon: <TruckOutlined />, label: 'In Transit', step: 2 },
  delivered:   { color: colors.success, icon: <CheckCircleOutlined />, label: 'Delivered', step: 3 },
  delayed:     { color: colors.danger, icon: <ExclamationCircleOutlined />, label: 'Delayed', step: 2 },
};

const DeliveryStatusPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [search, setSearch] = useState('');

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const filtered = search
    ? MOCK_ORDERS.filter(o =>
        o.orderId.toLowerCase().includes(search.toLowerCase()) ||
        o.buyer.toLowerCase().includes(search.toLowerCase()) ||
        o.item.toLowerCase().includes(search.toLowerCase())
      )
    : MOCK_ORDERS;

  const delivered = MOCK_ORDERS.filter(o => o.status === 'delivered').length;
  const inTransit = MOCK_ORDERS.filter(o => o.status === 'in_transit' || o.status === 'shipped').length;
  const delayed = MOCK_ORDERS.filter(o => o.status === 'delayed').length;
  const processing = MOCK_ORDERS.filter(o => o.status === 'processing').length;

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

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Processing"
              value={processing}
              prefix={<InboxOutlined style={{ color: colors.muted }} />}
              valueStyle={{ fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="In Transit"
              value={inTransit}
              prefix={<TruckOutlined style={{ color: BRAND }} />}
              valueStyle={{ color: BRAND, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Delivered"
              value={delivered}
              prefix={<CheckCircleOutlined style={{ color: colors.success }} />}
              valueStyle={{ color: colors.success, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Delayed"
              value={delayed}
              prefix={<ExclamationCircleOutlined style={{ color: colors.danger }} />}
              valueStyle={{ color: delayed > 0 ? colors.danger : colors.success, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Fulfillment progress */}
      <Card style={{ ...card, marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 12 }}>Fulfillment Rate</Title>
        <Progress
          percent={Math.round((delivered / MOCK_ORDERS.length) * 100)}
          strokeColor={{ from: BRAND, to: colors.brandLight }}
          format={(pct) => `${pct}% delivered`}
        />
      </Card>

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
        <Table
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10 }}
          size="middle"
        />
      </Card>
    </AppLayout>
  );
};

export default DeliveryStatusPage;
