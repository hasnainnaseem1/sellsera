import React, { useState } from 'react';
import {
  Card, Input, Button, Typography, Tag, Progress, Row, Col,
  Space, Empty, Statistic, message, theme, Table, Tooltip,
} from 'antd';
import {
  TagsOutlined, ThunderboltOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;
const { TextArea } = Input;
const BRAND = '#6C63FF';

const MOCK_ANALYSIS = [
  { key: 1, tag: 'handmade jewelry', score: 92, volume: 74200, competition: 85, status: 'excellent' },
  { key: 2, tag: 'custom necklace', score: 78, volume: 41500, competition: 72, status: 'good' },
  { key: 3, tag: 'gift for her', score: 65, volume: 89100, competition: 91, status: 'fair' },
  { key: 4, tag: 'unique earrings', score: 84, volume: 33800, competition: 58, status: 'good' },
  { key: 5, tag: 'boho bracelet', score: 45, volume: 18400, competition: 44, status: 'poor' },
  { key: 6, tag: 'dainty', score: 32, volume: 62000, competition: 95, status: 'poor' },
  { key: 7, tag: 'minimalist ring', score: 71, volume: 28900, competition: 63, status: 'good' },
];

const statusConfig = {
  excellent: { color: colors.success, icon: <CheckCircleOutlined />, label: 'Excellent' },
  good:      { color: BRAND, icon: <CheckCircleOutlined />, label: 'Good' },
  fair:      { color: colors.warning, icon: <WarningOutlined />, label: 'Fair' },
  poor:      { color: colors.danger, icon: <CloseCircleOutlined />, label: 'Poor' },
};

const TagAnalyzerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, refresh } = usePermissions();
  getFeatureAccess('tag_analysis');

  const [tags, setTags] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleAnalyze = async () => {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!tagList.length) { message.warning('Enter tags separated by commas'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1200));
    setResults(MOCK_ANALYSIS.slice(0, Math.min(tagList.length, MOCK_ANALYSIS.length)));
    setLoading(false);
    refresh();
  };

  const avgScore = results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0;
  const excellentCount = results.filter(r => r.score >= 80).length;

  const columns = [
    {
      title: 'Tag', dataIndex: 'tag', key: 'tag',
      render: (t) => (
        <Tag style={{
          padding: '3px 10px', borderRadius: radii.pill, fontSize: 13,
          background: isDark ? colors.brandBgDark : colors.brandBg,
          color: BRAND, border: 'none', fontWeight: 500,
        }}>
          {t}
        </Tag>
      ),
    },
    {
      title: 'Score', dataIndex: 'score', key: 'score', width: 140,
      render: (s) => (
        <Space size={8}>
          <Progress
            type="circle" size={36} percent={s}
            strokeColor={s >= 80 ? colors.success : s >= 60 ? colors.warning : colors.danger}
            format={() => s}
          />
        </Space>
      ),
    },
    {
      title: 'Volume', dataIndex: 'volume', key: 'volume', width: 100,
      render: (v) => <Text>{v.toLocaleString()}</Text>,
    },
    {
      title: 'Competition', dataIndex: 'competition', key: 'competition', width: 130,
      render: (c) => (
        <Progress
          percent={c} size="small" showInfo
          strokeColor={c >= 70 ? colors.danger : c >= 40 ? colors.warning : colors.success}
        />
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 110,
      render: (s) => {
        const cfg = statusConfig[s] || statusConfig.fair;
        return (
          <Tag icon={cfg.icon} style={{
            background: `${cfg.color}18`, color: cfg.color,
            border: 'none', borderRadius: radii.pill, fontWeight: 600,
          }}>
            {cfg.label}
          </Tag>
        );
      },
    },
  ];

  return (
    <AppLayout>
      <QuotaBanner featureKey="tag_analysis" featureName="Tag analyses" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <TagsOutlined style={{ marginRight: 10, color: BRAND }} />
            Tag Analyzer
          </Title>
          <Text type="secondary">Evaluate your listing tags for search performance & optimization opportunities</Text>
        </div>
        <UsageBadge featureKey="tag_analysis" />
      </div>

      <FeatureGate featureKey="tag_analysis">
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={16}>
            <Col xs={24} md={16}>
              <TextArea
                rows={3}
                placeholder="Paste your listing tags, separated by commas...&#10;handmade jewelry, custom necklace, gift for her, unique earrings"
                value={tags}
                onChange={e => setTags(e.target.value)}
                style={{ borderRadius: radii.sm, fontSize: 13 }}
              />
              <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                {tags.split(',').filter(t => t.trim()).length} / 13 tags entered (Etsy allows 13)
              </Text>
            </Col>
            <Col xs={24} md={8} style={{ display: 'flex', alignItems: 'flex-start' }}>
              <Button
                type="primary" size="large" loading={loading} block
                icon={<ThunderboltOutlined />}
                onClick={handleAnalyze}
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600, height: 48,
                  boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                }}
              >
                Analyze Tags
              </Button>
            </Col>
          </Row>
        </Card>

        {results.length > 0 && (
          <>
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={8}>
                <Card style={card}>
                  <Statistic title="Avg Quality Score" value={avgScore} suffix="/ 100" valueStyle={{ color: BRAND, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col xs={8}>
                <Card style={card}>
                  <Statistic title="High-Quality Tags" value={excellentCount} suffix={`/ ${results.length}`} valueStyle={{ color: colors.success, fontWeight: 700 }} />
                </Card>
              </Col>
              <Col xs={8}>
                <Card style={card}>
                  <Statistic title="Tags Analyzed" value={results.length} valueStyle={{ fontWeight: 700 }} />
                </Card>
              </Col>
            </Row>

            <Card style={card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Title level={5} style={{ margin: 0 }}>Tag Performance</Title>
                <Tooltip title="AI tip: Replace low-scoring tags to improve visibility">
                  <Tag icon={<BulbOutlined />} color="purple" style={{ borderRadius: radii.pill }}>
                    AI Tip
                  </Tag>
                </Tooltip>
              </div>
              <Table
                columns={columns}
                dataSource={results}
                pagination={false}
                size="middle"
              />
            </Card>
          </>
        )}

        {!results.length && !loading && (
          <Card style={card}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Paste your listing tags above to see their performance" />
          </Card>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default TagAnalyzerPage;
