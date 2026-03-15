import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Space,
  theme, Select, Table, Empty, Spin,
} from 'antd';
import {
  EnvironmentOutlined, DollarOutlined, ShoppingOutlined,
  GlobalOutlined, TrophyOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const SalesMapPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [period, setPeriod] = useState('30d');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await etsyApi.getSalesMap({ period });
      const regions = (res.data?.regions || res.regions || []).map((r, i) => ({
        key: i,
        region: r.region || r.country || 'Unknown',
        flag: r.flag || '🌍',
        orders: r.orders || r.count || 0,
        revenue: r.revenue || 0,
        pct: r.pct || r.percentage || 0,
        topCity: r.topCity || '—',
      }));
      setData(regions);
    } catch (err) {
      if (err?.response?.status !== 401) console.warn('Failed to load sales map');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const topRegion = data[0] || { region: '—' };
  const countries = data.filter(d => d.region !== 'Other').length;

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

      <FeatureGate featureKey="sales_map">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Total Orders" value={totalOrders} prefix={<ShoppingOutlined style={{ color: BRAND }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Total Revenue" value={totalRevenue} prefix={<DollarOutlined style={{ color: colors.success }} />} valueStyle={{ color: colors.success, fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Countries" value={countries} prefix={<GlobalOutlined style={{ color: colors.info }} />} valueStyle={{ fontWeight: 700 }} />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic title="Top Region" value={topRegion.region} prefix={<TrophyOutlined style={{ color: colors.warning }} />} valueStyle={{ fontSize: 16, fontWeight: 700 }} />
            </Card>
          </Col>
        </Row>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : data.length > 0 ? (
          <>
            {/* Visual region breakdown */}
            <Card style={{ ...card, marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>Sales by Region</Title>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.map((d) => (
                  <div
                    key={d.key}
                    style={{
                      flex: `${Math.max(d.pct, 4)} 0 0`,
                      minWidth: 60,
                      background: `linear-gradient(135deg, ${BRAND}${Math.min(20 + d.pct, 99).toString(16)}, ${colors.brandLight}${Math.min(20 + d.pct, 99).toString(16)})`,
                      borderRadius: radii.sm,
                      padding: '12px 10px',
                      textAlign: 'center',
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
              <Table columns={columns} dataSource={data} pagination={false} size="middle" />
            </Card>
          </>
        ) : (
          <Card style={card}>
            <Empty description="No sales data available. Sales geography will appear once you have orders." />
          </Card>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default SalesMapPage;
