import React, { useState } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Space,
  theme, Select, Table,
} from 'antd';
import {
  EnvironmentOutlined, DollarOutlined, ShoppingOutlined,
  GlobalOutlined, TrophyOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const MOCK_MAP_DATA = [
  { key: 1, region: 'United States', flag: '🇺🇸', orders: 142, revenue: 5680, pct: 45, topCity: 'New York' },
  { key: 2, region: 'United Kingdom', flag: '🇬🇧', orders: 38, revenue: 1520, pct: 12, topCity: 'London' },
  { key: 3, region: 'Canada', flag: '🇨🇦', orders: 34, revenue: 1360, pct: 11, topCity: 'Toronto' },
  { key: 4, region: 'Australia', flag: '🇦🇺', orders: 28, revenue: 1120, pct: 9, topCity: 'Sydney' },
  { key: 5, region: 'Germany', flag: '🇩🇪', orders: 22, revenue: 880, pct: 7, topCity: 'Berlin' },
  { key: 6, region: 'France', flag: '🇫🇷', orders: 18, revenue: 720, pct: 6, topCity: 'Paris' },
  { key: 7, region: 'Japan', flag: '🇯🇵', orders: 12, revenue: 480, pct: 4, topCity: 'Tokyo' },
  { key: 8, region: 'Other', flag: '🌍', orders: 22, revenue: 880, pct: 6, topCity: '—' },
];

const SalesMapPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [period, setPeriod] = useState('30d');

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const totalOrders = MOCK_MAP_DATA.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = MOCK_MAP_DATA.reduce((s, d) => s + d.revenue, 0);
  const topRegion = MOCK_MAP_DATA[0];
  const countries = MOCK_MAP_DATA.filter(d => d.region !== 'Other').length;

  const columns = [
    {
      title: 'Region', key: 'region',
      render: (_, row) => (
        <Space>
          <span style={{ fontSize: 18 }}>{row.flag}</span>
          <Text strong style={{ fontSize: 13 }}>{row.region}</Text>
        </Space>
      ),
    },
    {
      title: 'Orders', dataIndex: 'orders', key: 'orders', width: 90, align: 'center',
      sorter: (a, b) => a.orders - b.orders,
      render: (v) => <Text strong>{v}</Text>,
    },
    {
      title: 'Revenue', dataIndex: 'revenue', key: 'revenue', width: 110,
      sorter: (a, b) => a.revenue - b.revenue,
      render: (v) => <Text strong style={{ color: colors.success }}>${v.toLocaleString()}</Text>,
    },
    {
      title: 'Share', dataIndex: 'pct', key: 'pct', width: 120,
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            height: 8, borderRadius: 4, flex: 1, background: isDark ? '#2e2e4a' : '#f0f0f5',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${p}%`,
              background: `linear-gradient(90deg, ${BRAND}, ${colors.brandLight})`,
              borderRadius: 4,
            }} />
          </div>
          <Text style={{ fontSize: 11, minWidth: 32 }}>{p}%</Text>
        </div>
      ),
    },
    {
      title: 'Top City', dataIndex: 'topCity', key: 'topCity', width: 110,
      render: (t) => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: colors.muted, fontSize: 11 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <EnvironmentOutlined style={{ marginRight: 10, color: BRAND }} />
            Sales Map
          </Title>
          <Text type="secondary">See where your customers are ordering from around the world</Text>
        </div>
        <Select
          value={period}
          onChange={setPeriod}
          style={{ width: 140 }}
          options={[
            { value: '7d', label: 'Last 7 days' },
            { value: '30d', label: 'Last 30 days' },
            { value: '90d', label: 'Last 90 days' },
            { value: 'all', label: 'All time' },
          ]}
        />
      </div>

      {/* Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Total Orders"
              value={totalOrders}
              prefix={<ShoppingOutlined style={{ color: BRAND }} />}
              valueStyle={{ fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Total Revenue"
              value={totalRevenue}
              prefix={<DollarOutlined style={{ color: colors.success }} />}
              valueStyle={{ color: colors.success, fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Countries"
              value={countries}
              prefix={<GlobalOutlined style={{ color: colors.info }} />}
              valueStyle={{ fontWeight: 700 }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={card}>
            <Statistic
              title="Top Region"
              value={topRegion.region}
              prefix={<TrophyOutlined style={{ color: colors.warning }} />}
              valueStyle={{ fontSize: 16, fontWeight: 700 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Visual region breakdown */}
      <Card style={{ ...card, marginBottom: 24 }}>
        <Title level={5} style={{ marginBottom: 16 }}>Sales by Region</Title>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MOCK_MAP_DATA.map((d) => (
            <div
              key={d.key}
              style={{
                flex: `${d.pct} 0 0`,
                minWidth: 60,
                background: `linear-gradient(135deg, ${BRAND}${Math.min(20 + d.pct, 99).toString(16)}, ${colors.brandLight}${Math.min(20 + d.pct, 99).toString(16)})`,
                borderRadius: radii.sm,
                padding: '12px 10px',
                textAlign: 'center',
                transition: 'transform 0.2s',
                cursor: 'default',
              }}
            >
              <div style={{ fontSize: 20 }}>{d.flag}</div>
              <Text style={{ fontSize: 11, fontWeight: 600, display: 'block', color: isDark ? '#e8e8f0' : '#333' }}>
                {d.pct}%
              </Text>
            </div>
          ))}
        </div>
      </Card>

      {/* Table */}
      <Card style={card}>
        <Title level={5} style={{ marginBottom: 16 }}>Region Details</Title>
        <Table
          columns={columns}
          dataSource={MOCK_MAP_DATA}
          pagination={false}
          size="middle"
        />
      </Card>
    </AppLayout>
  );
};

export default SalesMapPage;
