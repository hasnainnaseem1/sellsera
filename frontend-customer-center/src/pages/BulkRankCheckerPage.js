import React, { useState } from 'react';
import {
  Card, Input, Button, Table, Typography, Tag,
  Space, Empty, message, theme, Row, Col, Statistic,
} from 'antd';
import {
  OrderedListOutlined, ThunderboltOutlined, RiseOutlined,
  FallOutlined, MinusOutlined,
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
const { TextArea } = Input;
const BRAND = '#6C63FF';

const BulkRankCheckerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, refresh } = usePermissions();
  getFeatureAccess('bulk_rank_check');

  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleCheck = async () => {
    const kws = keywords.split('\n').map(k => k.trim()).filter(Boolean);
    if (!kws.length) { message.warning('Enter at least one keyword'); return; }
    setLoading(true);
    try {
      const res = await etsyApi.checkRankings({ keywords: kws });
      if (res.success === false) {
        message.error(res.message || 'Unable to check rankings');
        setResults([]);
        return;
      }
      const rows = (res.data?.results || res.results || []).map((r, i) => ({
        key: i,
        keyword: r.keyword || kws[i] || '',
        rank: r.rank || r.position || 0,
        page: r.page || (r.rank ? Math.ceil(r.rank / 48) : 0),
        volume: r.volume || r.totalResults || 0,
        change: r.change || 0,
        trend: r.trend || 'stable',
      }));
      setResults(rows);
      if (rows.length) incrementUsage('bulk_rank_check');
      if (!rows.length) message.info('No ranking data found');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Rank check failed');
      setResults([]);
    } finally {
      setLoading(false);
      refresh();
    }
  };

  const avgRank = results.length ? Math.round(results.reduce((s, r) => s + r.rank, 0) / results.length) : 0;
  const page1Count = results.filter(r => r.page === 1).length;

  const columns = [
    {
      title: 'Keyword', dataIndex: 'keyword', key: 'keyword',
      render: (t) => <Text strong style={{ fontSize: 13 }}>{t}</Text>,
    },
    {
      title: 'Rank', dataIndex: 'rank', key: 'rank', width: 80, align: 'center',
      render: (r) => (
        <Tag style={{
          fontWeight: 700, fontSize: 13, borderRadius: radii.pill,
          background: r <= 10 ? `${colors.success}18` : r <= 30 ? `${colors.warning}18` : `${colors.danger}18`,
          color: r <= 10 ? colors.success : r <= 30 ? colors.warning : colors.danger,
          border: 'none', padding: '2px 12px',
        }}>
          #{r}
        </Tag>
      ),
    },
    {
      title: 'Page', dataIndex: 'page', key: 'page', width: 70, align: 'center',
      render: (p) => <Text type="secondary">Page {p}</Text>,
    },
    {
      title: 'Volume', dataIndex: 'volume', key: 'volume', width: 100,
      render: (v) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Change', dataIndex: 'change', key: 'change', width: 90, align: 'center',
      render: (c, row) => (
        <Space size={4}>
          {row.trend === 'up' ? <RiseOutlined style={{ color: colors.success }} /> :
            row.trend === 'down' ? <FallOutlined style={{ color: colors.danger }} /> :
              <MinusOutlined style={{ color: colors.muted }} />}
          <Text style={{ color: c > 0 ? colors.success : c < 0 ? colors.danger : colors.muted, fontWeight: 600 }}>
            {c > 0 ? `+${c}` : c}
          </Text>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="bulk_rank_check" featureName="Bulk rank checks" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <OrderedListOutlined style={{ marginRight: 10, color: BRAND }} />
            Bulk Rank Checker
          </Title>
          <Text type="secondary">Check your ranking for multiple keywords at once</Text>
        </div>
        <UsageBadge featureKey="bulk_rank_check" />
      </div>

      <FeatureGate featureKey="bulk_rank_check">
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <TextArea
                rows={4}
                placeholder="Enter keywords, one per line...&#10;handmade earrings&#10;boho necklace&#10;personalized bracelet"
                value={keywords}
                onChange={e => setKeywords(e.target.value)}
                style={{ borderRadius: radii.sm, fontSize: 13 }}
              />
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                {keywords.split('\n').filter(k => k.trim()).length} keyword(s) entered
              </Text>
            </Col>
            <Col xs={24} md={8} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Button
                type="primary" size="large" loading={loading} block
                icon={<ThunderboltOutlined />}
                onClick={handleCheck}
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600, height: 48,
                  boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                }}
              >
                Check Rankings
              </Button>
            </Col>
          </Row>
        </Card>

        {results.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={8}>
              <Card style={card}>
                <Statistic title="Keywords Checked" value={results.length} valueStyle={{ color: BRAND, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card style={card}>
                <Statistic title="Avg Rank" value={avgRank} prefix="#" valueStyle={{ fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={8}>
              <Card style={card}>
                <Statistic title="On Page 1" value={page1Count} suffix={`/ ${results.length}`} valueStyle={{ color: colors.success, fontWeight: 700 }} />
              </Card>
            </Col>
          </Row>
        )}

        {results.length > 0 ? (
          <Card style={card}>
            <Table
              columns={columns}
              dataSource={results}
              pagination={false}
              size="middle"
            />
          </Card>
        ) : !loading && (
          <Card style={card}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Enter keywords above to check your rankings" />
          </Card>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default BulkRankCheckerPage;
