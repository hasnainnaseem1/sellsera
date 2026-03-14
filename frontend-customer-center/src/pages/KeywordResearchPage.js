import React, { useState } from 'react';
import {
  Card, Input, Select, Button, Table, Tag, Typography, Row, Col,
  Space, Empty, message, theme,
} from 'antd';
import {
  SearchOutlined, GlobalOutlined, KeyOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;

const COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
];

// Mock keyword data for demonstration
const MOCK_KEYWORDS = [
  { keyword: 'handmade jewelry', searches: 74200, clicks: 52340, ctr: '71%', competition: 85, trend: 'up' },
  { keyword: 'custom necklace', searches: 41500, clicks: 28200, ctr: '68%', competition: 72, trend: 'up' },
  { keyword: 'personalized gift', searches: 89100, clicks: 61000, ctr: '69%', competition: 91, trend: 'stable' },
  { keyword: 'unique earrings', searches: 33800, clicks: 22100, ctr: '65%', competition: 58, trend: 'up' },
  { keyword: 'boho bracelet', searches: 18400, clicks: 11200, ctr: '61%', competition: 44, trend: 'down' },
  { keyword: 'minimalist ring', searches: 28900, clicks: 19800, ctr: '69%', competition: 63, trend: 'up' },
  { keyword: 'vintage brooch', searches: 12600, clicks: 8100, ctr: '64%', competition: 31, trend: 'stable' },
  { keyword: 'crystal pendant', searches: 21300, clicks: 14500, ctr: '68%', competition: 52, trend: 'up' },
];

const compColor = (comp) => {
  if (comp >= 70) return colors.danger;
  if (comp >= 40) return colors.warning;
  return colors.success;
};

const KeywordResearchPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess } = usePermissions();
  const access = getFeatureAccess('keyword_search');

  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleSearch = async () => {
    if (!keyword.trim()) { message.warning('Enter a keyword to search'); return; }
    setLoading(true);
    setSearched(true);
    // Simulate API delay — will be replaced with real endpoint
    await new Promise(r => setTimeout(r, 1200));
    setResults(MOCK_KEYWORDS.map((k, i) => ({
      ...k,
      key: i,
      keyword: i === 0 ? keyword.trim() : k.keyword,
    })));
    setLoading(false);
  };

  const columns = [
    {
      title: 'Keyword',
      dataIndex: 'keyword',
      key: 'keyword',
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Avg. Searches',
      dataIndex: 'searches',
      key: 'searches',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.searches - b.searches,
      render: (v) => <Tag color="purple" style={{ fontWeight: 600 }}>{v.toLocaleString()}</Tag>,
    },
    {
      title: 'Avg. Clicks',
      dataIndex: 'clicks',
      key: 'clicks',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.clicks - b.clicks,
      render: (v) => v.toLocaleString(),
    },
    {
      title: 'CTR',
      dataIndex: 'ctr',
      key: 'ctr',
      width: 80,
      align: 'center',
    },
    {
      title: 'Competition',
      dataIndex: 'competition',
      key: 'competition',
      width: 130,
      align: 'center',
      sorter: (a, b) => a.competition - b.competition,
      render: (comp) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          <div style={{
            width: 60, height: 6, borderRadius: 3,
            background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${comp}%`, height: '100%', borderRadius: 3,
              background: compColor(comp),
            }} />
          </div>
          <Text style={{ fontSize: 12, fontWeight: 600, color: compColor(comp) }}>{comp}%</Text>
        </div>
      ),
    },
    {
      title: 'Trend',
      dataIndex: 'trend',
      key: 'trend',
      width: 80,
      align: 'center',
      render: (t) => (
        <Tag color={t === 'up' ? 'green' : t === 'down' ? 'red' : 'default'} style={{ fontSize: 11 }}>
          {t === 'up' ? '↑ Up' : t === 'down' ? '↓ Down' : '→ Stable'}
        </Tag>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <KeyOutlined style={{ color: colors.brand, marginRight: 8 }} />
            Keyword Research
          </Title>
          <Text type="secondary">Discover high-traffic keywords shoppers use on Etsy</Text>
        </div>
        {access.state === 'unlocked' && (
          <UsageBadge used={access.used} limit={access.unlimited ? null : access.limit} showLabel />
        )}
      </div>

      <QuotaBanner featureKey="keyword_search" featureName="Keyword Searches" />

      <FeatureGate featureKey="keyword_search">
        {/* Search Bar */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12}>
              <Input
                placeholder="Enter a keyword (e.g. handmade jewelry)"
                prefix={<SearchOutlined />}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                onPressEnter={handleSearch}
                size="large"
              />
            </Col>
            <Col xs={12} md={6}>
              <Select
                value={country}
                onChange={setCountry}
                options={COUNTRIES}
                size="large"
                style={{ width: '100%' }}
                prefix={<GlobalOutlined />}
              />
            </Col>
            <Col xs={12} md={6}>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearch}
                loading={loading}
                size="large"
                block
                style={{
                  background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600,
                }}
              >
                Search
              </Button>
            </Col>
          </Row>
        </Card>

        {/* Results */}
        <Card style={card}>
          {results.length > 0 ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary">{results.length} keywords found</Text>
              </div>
              <Table
                columns={columns}
                dataSource={results}
                loading={loading}
                pagination={false}
                size="middle"
              />
            </>
          ) : (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <Space direction="vertical" size={4}>
                  <Text type="secondary">
                    {searched ? 'No keywords found' : 'Enter a keyword above to start your research'}
                  </Text>
                </Space>
              }
            />
          )}
        </Card>
      </FeatureGate>
    </AppLayout>
  );
};

export default KeywordResearchPage;
