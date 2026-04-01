import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Space,
  theme, Select, Table, Empty, Spin, Tag, Tooltip,
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

const SalesMapPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [period, setPeriod] = useState('30d');
  const [regions, setRegions] = useState([]);
  const [countries, setCountries] = useState([]);
  const [stats, setStats] = useState({ totalOrders: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  /* ─── Fetch data ─── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await etsyApi.getSalesMap({ period });
      const d = res.data || {};
      setRegions((d.regions || []).map((r, i) => ({ key: i, ...r })));
      setCountries(d.countries || []);
      setStats({ totalOrders: d.totalOrders || 0, totalRevenue: d.totalRevenue || 0 });
    } catch (err) {
      if (err?.response?.status !== 401) console.warn('Failed to load sales map');
      setRegions([]);
      setCountries([]);
      setStats({ totalOrders: 0, totalRevenue: 0 });
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Derived stats ─── */

  const { totalOrders, totalRevenue } = stats;
  const uniqueCountries = countries.length;
  const topRegion = regions.length > 0 ? regions[0] : null;

  /* ─── Region table columns ─── */

  const regionColumns = [
    {
      title: 'Region',
      key: 'region',
      render: (_, row) => (
        <Space>
          <span style={{ fontSize: 20 }}>{row.flag}</span>
          <Text strong style={{ fontSize: 13 }}>{row.region}</Text>
        </Space>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.orders - b.orders,
      defaultSortOrder: 'descend',
      render: v => <Text strong>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: v => <Text strong style={{ color: colors.success }}>${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'Share',
      dataIndex: 'pct',
      key: 'pct',
      width: 140,
      render: p => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            height: 8, borderRadius: 4, flex: 1,
            background: isDark ? '#2e2e4a' : '#f0f0f5',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${Math.min(p, 100)}%`,
              background: `linear-gradient(90deg, ${colors.brand}, ${colors.brandLight})`,
              borderRadius: 4,
            }} />
          </div>
          <Text style={{ fontSize: 11, minWidth: 36, textAlign: 'right' }}>{p}%</Text>
        </div>
      ),
    },
    {
      title: 'Top City',
      dataIndex: 'topCity',
      key: 'topCity',
      width: 130,
      render: t => (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: colors.muted, fontSize: 11 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text>
        </Space>
      ),
    },
  ];

  /* ─── Country table columns ─── */

  const countryColumns = [
    {
      title: 'Country',
      dataIndex: 'countryIso',
      key: 'countryIso',
      render: (iso, row) => (
        <Space size={6}>
          <Text strong style={{ fontSize: 13 }}>{iso}</Text>
          <Tag style={{ fontSize: 10, lineHeight: '16px' }}>{row.region}</Tag>
        </Space>
      ),
    },
    {
      title: 'Orders',
      dataIndex: 'orders',
      key: 'orders',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.orders - b.orders,
      defaultSortOrder: 'descend',
      render: v => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Revenue',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 110,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: v => <Text style={{ color: colors.success }}>${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>,
    },
    {
      title: 'Top City',
      dataIndex: 'topCity',
      key: 'topCity',
      width: 120,
      render: t => t ? (
        <Space size={4}>
          <EnvironmentOutlined style={{ color: colors.muted, fontSize: 11 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>{t}</Text>
        </Space>
      ) : <Text type="secondary">—</Text>,
    },
  ];

  return (
    <AppLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <EnvironmentOutlined style={{ marginRight: 10, color: colors.brand }} />
            Sales Map
          </Title>
          <Text type="secondary">See where your customers are ordering from around the world</Text>
        </div>
        <Select
          value={period}
          onChange={setPeriod}
          style={{ width: 150 }}
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
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Total Orders</Text>}
                value={totalOrders}
                prefix={<ShoppingOutlined style={{ color: colors.brand }} />}
                valueStyle={{ fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Total Revenue</Text>}
                value={totalRevenue}
                prefix={<DollarOutlined style={{ color: colors.success }} />}
                precision={2}
                valueStyle={{ color: colors.success, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Countries</Text>}
                value={uniqueCountries}
                prefix={<GlobalOutlined style={{ color: colors.info }} />}
                valueStyle={{ fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Top Region</Text>}
                value={topRegion ? `${topRegion.flag} ${topRegion.region}` : '—'}
                prefix={<TrophyOutlined style={{ color: colors.warning }} />}
                valueStyle={{ fontSize: 15, fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 48 }}><Spin size="large" /></div>
        ) : regions.length > 0 ? (
          <>
            {/* Visual region breakdown bar */}
            <Card style={{ ...card, marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>Sales by Region</Title>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {regions.map(d => {
                  const opacity = Math.min(20 + Math.round(d.pct * 2), 99);
                  return (
                    <Tooltip key={d.key} title={`${d.region}: ${d.orders} orders · $${d.revenue.toLocaleString()}`}>
                      <div style={{
                        flex: `${Math.max(d.pct, 5)} 0 0`,
                        minWidth: 60,
                        background: `linear-gradient(135deg, ${colors.brand}${opacity.toString(16).padStart(2, '0')}, ${colors.brandLight}${opacity.toString(16).padStart(2, '0')})`,
                        borderRadius: radii.sm,
                        padding: '14px 10px',
                        textAlign: 'center',
                        cursor: 'default',
                        transition: 'transform 0.2s',
                      }}>
                        <div style={{ fontSize: 22 }}>{d.flag}</div>
                        <Text style={{ fontSize: 12, fontWeight: 700, display: 'block', color: isDark ? '#e8e8f0' : '#333' }}>
                          {d.pct}%
                        </Text>
                        <Text style={{ fontSize: 10, display: 'block', color: isDark ? '#aaa' : '#666' }}>
                          {d.orders} orders
                        </Text>
                      </div>
                    </Tooltip>
                  );
                })}
              </div>
            </Card>

            {/* Region table */}
            <Card style={{ ...card, marginBottom: 24 }}>
              <Title level={5} style={{ marginBottom: 16 }}>Region Details</Title>
              <Table
                columns={regionColumns}
                dataSource={regions}
                pagination={false}
                size="middle"
              />
            </Card>

            {/* Country breakdown */}
            {countries.length > 0 && (
              <Card style={card}>
                <Title level={5} style={{ marginBottom: 16 }}>Country Breakdown</Title>
                <Table
                  columns={countryColumns}
                  dataSource={countries.map((c, i) => ({ key: i, ...c }))}
                  pagination={countries.length > 15 ? { pageSize: 15, showSizeChanger: false } : false}
                  size="small"
                />
              </Card>
            )}
          </>
        ) : (
          <Card style={card}>
            <Empty
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    No sales data available
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Sales geography will appear once you have orders. Sync your orders from the Delivery Status page.
                  </Text>
                </div>
              }
            />
          </Card>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default SalesMapPage;
