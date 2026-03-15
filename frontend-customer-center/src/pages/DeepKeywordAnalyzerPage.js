import React, { useState } from 'react';
import {
  Card, Input, Button, Typography, Row, Col, Tag, Progress,
  Space, Empty, Statistic, message, theme, Tabs, Tooltip,
} from 'antd';
import {
  SearchOutlined, BarChartOutlined, RiseOutlined,
  FallOutlined, MinusOutlined, FireOutlined,
  ThunderboltOutlined, CopyOutlined,
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text, Paragraph } = Typography;

const BRAND = '#6C63FF';

const compColor = (c) => (c >= 70 ? colors.danger : c >= 40 ? colors.warning : colors.success);
const trendIcon = (t) => {
  if (t === 'up' || t === 'rising') return <RiseOutlined style={{ color: colors.success }} />;
  if (t === 'down') return <FallOutlined style={{ color: colors.danger }} />;
  return <MinusOutlined style={{ color: colors.muted }} />;
};

const DeepKeywordAnalyzerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, refresh } = usePermissions();
  getFeatureAccess('keyword_deep_analysis');

  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleAnalyze = async () => {
    if (!keyword.trim()) { message.warning('Enter a keyword to analyze'); return; }
    setLoading(true);
    try {
      const res = await etsyApi.deepAnalysis({ keyword: keyword.trim() });
      const d = res.data || res;
      setResult({
        keyword: keyword.trim(),
        volume: d.volume || 0,
        competition: d.competition || 0,
        avgPrice: d.avgPrice || 0,
        totalListings: d.totalListings || 0,
        ctr: d.ctr || '—',
        seasonality: d.seasonality || '—',
        trend: d.trend || 'stable',
        trendPct: d.trendPct || 0,
        monthlyData: d.monthlyData || [],
        relatedKeywords: d.relatedKeywords || [],
        suggestedTags: d.suggestedTags || [],
      });
    } catch (err) {
      message.error(err?.response?.data?.message || 'Deep analysis failed');
      setResult(null);
    } finally {
      setLoading(false);
      refresh();
    }
  };

  const copyTags = () => {
    if (!result) return;
    navigator.clipboard.writeText(result.suggestedTags.join(', '));
    message.success('Tags copied to clipboard!');
  };

  /* ── Volume bar chart (simple CSS bar chart) ── */
  const maxVol = result ? Math.max(...result.monthlyData.map(m => m.vol)) : 1;

  return (
    <AppLayout>
      <QuotaBanner featureKey="keyword_deep_analysis" featureName="Deep keyword analyses" />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BarChartOutlined style={{ marginRight: 10, color: BRAND }} />
            Deep Keyword Analyzer
          </Title>
          <Text type="secondary">Analyze search volume, competition, trends & get optimized tag suggestions</Text>
        </div>
        <UsageBadge featureKey="keyword_deep_analysis" />
      </div>

      <FeatureGate featureKey="keyword_deep_analysis">
        {/* Search bar */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={16} align="middle">
            <Col flex="auto">
              <Input
                size="large"
                prefix={<SearchOutlined style={{ color: colors.muted }} />}
                placeholder="Enter a keyword or phrase to deep-analyze..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={handleAnalyze}
                style={{ borderRadius: radii.sm }}
              />
            </Col>
            <Col>
              <Button
                type="primary" size="large" loading={loading}
                icon={<ThunderboltOutlined />}
                onClick={handleAnalyze}
                style={{
                  background: `linear-gradient(135deg, ${BRAND}, ${colors.brandLight})`,
                  border: 'none', borderRadius: radii.sm, fontWeight: 600,
                  boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
                }}
              >
                Analyze
              </Button>
            </Col>
          </Row>
        </Card>

        {!result && !loading && (
          <Card style={card}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description="Enter a keyword to see volume, competition & trend data"
            />
          </Card>
        )}

        {result && (
          <>
            {/* ── Overview Stats ── */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} sm={8} md={6}>
                <Card style={card}>
                  <Statistic
                    title="Monthly Volume"
                    value={result.volume}
                    prefix={<BarChartOutlined style={{ color: BRAND }} />}
                    valueStyle={{ color: BRAND, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Card style={card}>
                  <Statistic title="Competition" value={result.competition} suffix="/ 100" />
                  <Progress
                    percent={result.competition}
                    strokeColor={compColor(result.competition)}
                    showInfo={false} size="small"
                    style={{ marginTop: 4 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Card style={card}>
                  <Statistic
                    title="Avg. Price"
                    value={result.avgPrice}
                    prefix="$"
                    valueStyle={{ color: colors.success, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} md={6}>
                <Card style={card}>
                  <Statistic
                    title="Trend"
                    value={`${result.trendPct}%`}
                    prefix={trendIcon(result.trend)}
                    valueStyle={{ color: result.trend === 'rising' || result.trend === 'up' ? colors.success : colors.muted, fontWeight: 700 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>{result.seasonality}</Text>
                </Card>
              </Col>
            </Row>

            <Tabs
              defaultActiveKey="trends"
              style={{ marginBottom: 24 }}
              items={[
                {
                  key: 'trends',
                  label: <span><RiseOutlined /> Volume Trend</span>,
                  children: (
                    <Card style={card}>
                      <Title level={5} style={{ marginBottom: 16 }}>Monthly Search Volume</Title>
                      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                        {result.monthlyData.map((m, i) => (
                          <Tooltip key={i} title={`${m.month}: ${m.vol.toLocaleString()}`}>
                            <div style={{ flex: 1, textAlign: 'center' }}>
                              <div style={{
                                height: Math.max((m.vol / maxVol) * 130, 8),
                                background: `linear-gradient(180deg, ${BRAND}, ${colors.brandLight})`,
                                borderRadius: '6px 6px 0 0',
                                transition: 'height 0.3s',
                                opacity: 0.85,
                              }} />
                              <Text style={{ fontSize: 10, display: 'block', marginTop: 4 }}>{m.month}</Text>
                            </div>
                          </Tooltip>
                        ))}
                      </div>
                    </Card>
                  ),
                },
                {
                  key: 'related',
                  label: <span><SearchOutlined /> Related Keywords</span>,
                  children: (
                    <Card style={card}>
                      <Title level={5} style={{ marginBottom: 16 }}>Related Keywords</Title>
                      <Row gutter={[12, 12]}>
                        {result.relatedKeywords.map((rk, i) => (
                          <Col xs={24} sm={12} md={8} key={i}>
                            <Card
                              size="small"
                              style={{
                                borderRadius: radii.md,
                                border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13 }}>{rk.kw}</Text>
                                {trendIcon(rk.trend)}
                              </div>
                              <Space size={12}>
                                <Text type="secondary" style={{ fontSize: 11 }}>Vol: {rk.vol.toLocaleString()}</Text>
                                <Text style={{ fontSize: 11, color: compColor(rk.comp) }}>Comp: {rk.comp}/100</Text>
                              </Space>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  ),
                },
                {
                  key: 'tags',
                  label: <span><FireOutlined /> Suggested Tags</span>,
                  children: (
                    <Card style={card}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Title level={5} style={{ margin: 0 }}>Optimized Tag Suggestions</Title>
                        <Button icon={<CopyOutlined />} onClick={copyTags} size="small">Copy All</Button>
                      </div>
                      <Paragraph type="secondary" style={{ marginBottom: 16, fontSize: 13 }}>
                        These tags are optimized for your keyword. Use them in your Etsy listing for best visibility.
                      </Paragraph>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {result.suggestedTags.map((tag, i) => (
                          <Tag
                            key={i}
                            style={{
                              padding: '4px 12px', borderRadius: radii.pill, fontSize: 13,
                              background: isDark ? colors.brandBgDark : colors.brandBg,
                              color: BRAND, border: 'none', cursor: 'pointer', fontWeight: 500,
                            }}
                            onClick={() => { navigator.clipboard.writeText(tag); message.success(`Copied: ${tag}`); }}
                          >
                            {tag}
                          </Tag>
                        ))}
                      </div>
                    </Card>
                  ),
                },
              ]}
            />
          </>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default DeepKeywordAnalyzerPage;
