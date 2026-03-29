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
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const BRAND = '#6C63FF';

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
    try {
      const res = await etsyApi.analyzeTags({ tags: tagList });
      if (res.success === false) {
        message.error(res.message || 'Unable to analyze tags');
        setResults([]);
        return;
      }
      const rows = (res.data?.tags || res.tags || []).map((t, i) => {
        const score = t.score || t.overallScore || t.qualityScore || 0;
        return {
          key: i,
          tag: t.tag || t.name || tagList[i] || '',
          score,
          volume: t.volume || t.totalResults || 0,
          competition: t.competition || 0,
          status: score >= 80 ? 'excellent' : score >= 60 ? 'good' : score >= 40 ? 'fair' : 'poor',
        };
      });
      setResults(rows);
      if (!rows.length) message.info('No tag analysis data found');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Tag analysis failed');
      setResults([]);
    } finally {
      setLoading(false);
      refresh();
    }
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
