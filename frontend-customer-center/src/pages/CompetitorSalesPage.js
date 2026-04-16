import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Typography, Row, Col, Statistic, Table, Space,
  Empty, theme, Tooltip, Tag, Avatar,
} from 'antd';
import {
  LineChartOutlined, RiseOutlined, FallOutlined, MinusOutlined,
  ShopOutlined, TrophyOutlined, DollarOutlined, StarFilled,
  LinkOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;

const CompetitorSalesPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess } = usePermissions();
  const access = getFeatureAccess('competitor_sales');

  const [data, setData] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  /* ─── Fetch sales overview (single API call) ─── */

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await etsyApi.getSalesOverview();
      const d = res.data || {};
      const rows = (d.shops || []).map(s => ({ key: s._id, ...s }));
      setData(rows);
      setSummary({
        shopCount: d.shopCount || rows.length,
        totalDailySales: d.totalDailySales || 0,
        totalEstRevenue: d.totalEstRevenue || 0,
        topPerformer: d.topPerformer || '—',
      });
    } catch (err) {
      if (err?.response?.status !== 401) {
        console.warn('Failed to load sales overview');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  /* ─── Stats ─── */

  const { shopCount = 0, totalDailySales = 0, totalEstRevenue = 0, topPerformer = '—' } = summary;

  /* ─── Table columns ─── */

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
            size={32}
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
                <Text type="secondary" style={{ fontSize: 11 }}>📍 {record.shopCountry}</Text>
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
      render: v => <Text>{(v || 0).toLocaleString()}</Text>,
    },
    {
      title: 'Daily Sales',
      dataIndex: 'dailySales',
      key: 'dailySales',
      width: 110,
      align: 'center',
      sorter: (a, b) => a.dailySales - b.dailySales,
      defaultSortOrder: 'descend',
      render: v => {
        if (v > 0) return <Tag color="success" style={{ fontWeight: 700, fontSize: 13 }}><RiseOutlined /> +{v}</Tag>;
        if (v < 0) return <Tag color="error" style={{ fontWeight: 700, fontSize: 13 }}><FallOutlined /> {v}</Tag>;
        return <Tag style={{ fontWeight: 600 }}>0</Tag>;
      },
    },
    {
      title: 'Est. Revenue',
      dataIndex: 'estRevenue',
      key: 'estRevenue',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.estRevenue - b.estRevenue,
      render: v => (
        <Text strong style={{ color: (v || 0) > 0 ? colors.success : 'inherit' }}>
          ${(v || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </Text>
      ),
    },
    {
      title: 'Avg Price',
      dataIndex: 'avgPrice',
      key: 'avgPrice',
      width: 90,
      align: 'right',
      sorter: (a, b) => a.avgPrice - b.avgPrice,
      render: v => <Text>${(v || 0).toFixed(2)}</Text>,
    },
    {
      title: 'Rating',
      dataIndex: 'rating',
      key: 'rating',
      width: 90,
      align: 'center',
      sorter: (a, b) => a.rating - b.rating,
      render: v => (
        <Tag color="gold" style={{ fontWeight: 600 }}>
          <StarFilled /> {(v || 0) > 0 ? v.toFixed(1) : '—'}
        </Tag>
      ),
    },
    {
      title: 'Trend',
      key: 'trend',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.trendPct || 0) - (b.trendPct || 0),
      render: (_, row) => (
        <Space size={4}>
          {row.trend === 'up' ? <RiseOutlined style={{ color: colors.success }} /> :
            row.trend === 'down' ? <FallOutlined style={{ color: colors.danger }} /> :
              <MinusOutlined style={{ color: colors.muted }} />}
          <Text style={{
            color: (row.trendPct || 0) > 0 ? colors.success : (row.trendPct || 0) < 0 ? colors.danger : colors.muted,
            fontWeight: 600, fontSize: 12,
          }}>
            {(row.trendPct || 0) > 0 ? '+' : ''}{row.trendPct || 0}%
          </Text>
        </Space>
      ),
    },
    {
      title: 'Top Listing',
      dataIndex: 'topListing',
      key: 'topListing',
      ellipsis: true,
      width: 200,
      render: (listing) => {
        if (!listing) return <Text type="secondary" style={{ fontSize: 12 }}>—</Text>;
        return (
          <Tooltip title={`$${listing.price?.toFixed(2)} · ${listing.favorites || 0} favorites`}>
            <Space size={4}>
              <TrophyOutlined style={{ color: colors.warning, fontSize: 12 }} />
              <Text style={{ fontSize: 12 }} ellipsis>{listing.title}</Text>
            </Space>
          </Tooltip>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="competitor_sales" featureName="Competitor sales tracking" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <LineChartOutlined style={{ marginRight: 10, color: colors.brand }} />
            Sales Tracker
          </Title>
          <Text type="secondary">Compare daily sales, revenue estimates & trends across all tracked shops</Text>
        </div>
        {access.state === 'unlocked' && (
          <UsageBadge used={access.used} limit={access.unlimited ? null : access.limit} showLabel />
        )}
      </div>

      <FeatureGate featureKey="competitor_sales">
        {/* Stats */}
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Shops Tracked</Text>}
                value={shopCount}
                prefix={<ShopOutlined style={{ color: colors.brand }} />}
                valueStyle={{ fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Total Daily Sales</Text>}
                value={totalDailySales}
                prefix={totalDailySales > 0
                  ? <RiseOutlined style={{ color: colors.success }} />
                  : <MinusOutlined style={{ color: colors.muted }} />
                }
                valueStyle={{ color: colors.brand, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Est. Daily Revenue</Text>}
                value={totalEstRevenue}
                prefix={<DollarOutlined style={{ color: colors.success }} />}
                precision={2}
                valueStyle={{ color: colors.success, fontWeight: 700 }}
              />
            </Card>
          </Col>
          <Col xs={12} md={6}>
            <Card style={card}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 12 }}>Top Performer</Text>}
                value={topPerformer}
                prefix={<TrophyOutlined style={{ color: colors.warning }} />}
                valueStyle={{ fontSize: 15, fontWeight: 700 }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card style={card}>
          {data.length > 0 ? (
            <Table
              columns={columns}
              dataSource={data}
              pagination={data.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
              size="middle"
              loading={loading}
              scroll={{ x: 1000 }}
            />
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div style={{ textAlign: 'center' }}>
                  <Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
                    No sales data yet
                  </Text>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Add competitor shops from the Shop Tracker page to start seeing sales data here.
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

export default CompetitorSalesPage;
