import React, { useState, useEffect } from 'react';
import {
  Card, Input, Select, Button, Typography, Row, Col, Tag, Progress,
  Space, Empty, Statistic, message, theme, Tabs, Tooltip, Modal,
} from 'antd';
import {
  SearchOutlined, BarChartOutlined, RiseOutlined,
  FallOutlined, MinusOutlined, FireOutlined,
  ThunderboltOutlined, CopyOutlined, GlobalOutlined,
  LockOutlined, CrownOutlined, TrophyOutlined,
  LinkOutlined, DollarOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
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

const FALLBACK_COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
];

const compColor = (c) => (c >= 70 ? colors.danger : c >= 40 ? colors.warning : colors.success);
const seoColor = (s) => (s >= 80 ? colors.success : s >= 50 ? colors.warning : colors.danger);
const trendIcon = (t) => {
  if (t === 'up' || t === 'rising') return <RiseOutlined style={{ color: colors.success }} />;
  if (t === 'down' || t === 'declining') return <FallOutlined style={{ color: colors.danger }} />;
  return <MinusOutlined style={{ color: colors.muted }} />;
};
const signalBadge = (signal) => {
  if (signal === 'hot') return <Tag color="red">🔥 Hot</Tag>;
  if (signal === 'warm') return <Tag color="orange">🟡 Warm</Tag>;
  if (signal === 'stagnant') return <Tag color="default">⚪ Stagnant</Tag>;
  return null;
};

const DeepKeywordAnalyzerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, refresh, plan } = usePermissions();
  const navigate = useNavigate();
  getFeatureAccess('keyword_deep_analysis');

  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Upgrade modal state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockedCountry, setLockedCountry] = useState(null);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  useEffect(() => {
    etsyApi.getCountries()
      .then(res => {
        if (res.success && res.data?.length) setCountries(res.data);
      })
      .catch(() => {});
  }, []);

  const handleAnalyze = async (kw) => {
    const targetKeyword = kw || keyword;
    if (!targetKeyword.trim()) { message.warning('Enter a keyword to analyze'); return; }
    setKeyword(targetKeyword);
    setLoading(true);
    try {
      const res = await etsyApi.deepAnalysis({ keyword: targetKeyword.trim(), country });
      if (res.success === false) {
        if (res.errorCode === 'UPGRADE_REQUIRED') {
          message.warning(res.message);
        } else {
          message.error(res.message || 'Unable to fetch keyword data');
        }
        setResult(null);
        return;
      }
      const d = res.data || res;
      setResult({
        keyword: targetKeyword.trim(),
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
        priceDistribution: d.priceDistribution || null,
        competitors: d.competitors || [],
        snapshot: d.snapshot || null,
      });
      incrementUsage('keyword_deep_analysis');
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

  /* ── Volume bar chart helpers ── */
  const maxVol = result && result.monthlyData.length > 0
    ? Math.max(...result.monthlyData.map(m => m.vol), 1)
    : 1;

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
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={10}>
              <Input
                size="large"
                prefix={<SearchOutlined style={{ color: colors.muted }} />}
                placeholder="Enter a keyword or phrase to deep-analyze..."
                value={keyword}
                onChange={e => setKeyword(e.target.value)}
                onPressEnter={() => handleAnalyze()}
                style={{ borderRadius: radii.sm }}
              />
            </Col>
            <Col xs={12} md={8}>
              <Select
                value={country}
                onChange={(val) => {
                  const c = countries.find(ct => ct.value === val);
                  if (c?.isLocked) {
                    setLockedCountry(c);
                    setUpgradeOpen(true);
                    return;
                  }
                  setCountry(val);
                }}
                options={(() => {
                  const pinned = ['Global', 'US'];
                  const unlocked = countries.filter(c => !c.isLocked);
                  const locked = countries.filter(c => c.isLocked);
                  const pinnedItems = unlocked.filter(c => pinned.includes(c.value));
                  const otherUnlocked = unlocked.filter(c => !pinned.includes(c.value));
                  const groups = [];
                  if (pinnedItems.length || otherUnlocked.length) {
                    groups.push({
                      label: <span style={{ fontSize: 11, fontWeight: 700, color: colors.brand, textTransform: 'uppercase', letterSpacing: 0.5 }}>Available in Your Plan</span>,
                      options: [...pinnedItems, ...otherUnlocked].map(c => ({ value: c.value, label: c.label })),
                    });
                  }
                  if (locked.length) {
                    groups.push({
                      label: <span style={{ fontSize: 11, fontWeight: 700, color: isDark ? '#6B7280' : '#9CA3AF', textTransform: 'uppercase', letterSpacing: 0.5 }}>Premium Markets</span>,
                      options: locked.map(c => ({ value: c.value, label: c.label })),
                    });
                  }
                  return groups;
                })()}
                size="large"
                style={{ width: '100%' }}
                prefix={<GlobalOutlined />}
                showSearch
                optionFilterProp="label"
                optionRender={(option) => {
                  const c = countries.find(ct => ct.value === option.value);
                  const isLocked = c?.isLocked;
                  return (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: isLocked ? (isDark ? '#6B7280' : '#9CA3AF') : undefined }}>{option.label}</span>
                      {isLocked && <LockOutlined style={{ fontSize: 12, color: isDark ? '#6B7280' : '#9CA3AF', marginLeft: 8 }} />}
                    </div>
                  );
                }}
              />
            </Col>
            <Col xs={12} md={6}>
              <Button
                type="primary" size="large" loading={loading} block
                icon={<ThunderboltOutlined />}
                onClick={() => handleAnalyze()}
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
              <Col xs={12} sm={8} md={5}>
                <Card style={card}>
                  <Statistic
                    title="Monthly Volume"
                    value={result.volume}
                    prefix={<BarChartOutlined style={{ color: BRAND }} />}
                    valueStyle={{ color: BRAND, fontWeight: 700 }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={8} md={5}>
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
              <Col xs={12} sm={8} md={5}>
                <Card style={card}>
                  <Tooltip title={result.priceDistribution ? `Min: $${result.priceDistribution.min} — Max: $${result.priceDistribution.max} — Median: $${result.priceDistribution.median}` : 'Average price'}>
                    <Statistic
                      title="Avg. Price"
                      value={result.avgPrice}
                      prefix="$"
                      valueStyle={{ color: colors.success, fontWeight: 700 }}
                    />
                  </Tooltip>
                  {result.priceDistribution && (
                    <Text type="secondary" style={{ fontSize: 11 }}>
                      ${result.priceDistribution.min} – ${result.priceDistribution.max}
                    </Text>
                  )}
                </Card>
              </Col>
              <Col xs={12} sm={8} md={5}>
                <Card style={card}>
                  <Statistic
                    title="Trend"
                    value={`${result.trendPct}%`}
                    prefix={trendIcon(result.trend)}
                    valueStyle={{ color: result.trend === 'rising' ? colors.success : result.trend === 'declining' ? colors.danger : colors.muted, fontWeight: 700 }}
                  />
                  <Text type="secondary" style={{ fontSize: 11 }}>{result.seasonality}</Text>
                </Card>
              </Col>
              {result.snapshot?.fusionScore != null && (
                <Col xs={12} sm={8} md={4}>
                  <Card style={card}>
                    <Statistic
                      title="Fusion Score"
                      value={result.snapshot.fusionScore}
                      prefix={<ThunderboltOutlined style={{ color: BRAND }} />}
                      suffix="/ 100"
                      valueStyle={{ color: BRAND, fontWeight: 700 }}
                    />
                    {result.snapshot.marketSignal && signalBadge(result.snapshot.marketSignal)}
                  </Card>
                </Col>
              )}
            </Row>

            <Tabs
              defaultActiveKey="trends"
              style={{ marginBottom: 24 }}
              items={[
                /* ── Volume Trend Tab ── */
                {
                  key: 'trends',
                  label: <span><RiseOutlined /> Volume Trend</span>,
                  children: (
                    <Card style={card}>
                      <Title level={5} style={{ marginBottom: 16 }}>Monthly Search Interest (Google Trends)</Title>
                      {result.monthlyData.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                          {result.monthlyData.map((m, i) => (
                            <Tooltip key={i} title={`${m.month}: ${m.vol}`}>
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
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No monthly trend data available for this keyword" />
                      )}
                    </Card>
                  ),
                },
                /* ── Price Distribution Tab ── */
                {
                  key: 'pricing',
                  label: <span><DollarOutlined /> Price Analysis</span>,
                  children: (
                    <Card style={card}>
                      <Title level={5} style={{ marginBottom: 16 }}>Price Distribution</Title>
                      {result.priceDistribution ? (
                        <>
                          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
                            <Col span={6}>
                              <Statistic title="Min" value={result.priceDistribution.min} prefix="$" valueStyle={{ fontSize: 18 }} />
                            </Col>
                            <Col span={6}>
                              <Statistic title="Median" value={result.priceDistribution.median} prefix="$" valueStyle={{ fontSize: 18, color: BRAND }} />
                            </Col>
                            <Col span={6}>
                              <Statistic title="Avg" value={result.priceDistribution.avg} prefix="$" valueStyle={{ fontSize: 18 }} />
                            </Col>
                            <Col span={6}>
                              <Statistic title="Max" value={result.priceDistribution.max} prefix="$" valueStyle={{ fontSize: 18 }} />
                            </Col>
                          </Row>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {result.priceDistribution.ranges.map((r, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <Text style={{ width: 70, fontSize: 12, textAlign: 'right' }}>{r.range}</Text>
                                <div style={{ flex: 1, height: 22, background: isDark ? 'rgba(255,255,255,0.06)' : '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                                  <div style={{
                                    width: `${Math.max(r.pct, 2)}%`,
                                    height: '100%',
                                    background: `linear-gradient(90deg, ${BRAND}, ${colors.brandLight})`,
                                    borderRadius: 6,
                                    transition: 'width 0.4s',
                                  }} />
                                </div>
                                <Text style={{ width: 50, fontSize: 12 }}>{r.pct}% ({r.count})</Text>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No pricing data available" />
                      )}
                    </Card>
                  ),
                },
                /* ── Competitors Tab ── */
                {
                  key: 'competitors',
                  label: <span><TrophyOutlined /> Competitors</span>,
                  children: (
                    <Card style={card}>
                      <Title level={5} style={{ marginBottom: 16 }}>Top 5 Competitor Listings</Title>
                      {result.competitors.length > 0 ? (
                        <Row gutter={[16, 16]}>
                          {result.competitors.map((comp, i) => (
                            <Col xs={24} key={i}>
                              <Card
                                size="small"
                                style={{
                                  borderRadius: radii.md,
                                  border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
                                }}
                              >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                      <Tag color={i === 0 ? 'gold' : 'default'} style={{ margin: 0, fontWeight: 600 }}>#{i + 1}</Tag>
                                      <Text strong style={{ fontSize: 13 }} ellipsis={{ tooltip: comp.title }}>
                                        {comp.title}
                                      </Text>
                                    </div>
                                    <Space size={16} wrap>
                                      <Text type="secondary" style={{ fontSize: 12 }}>${comp.price}</Text>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{comp.views?.toLocaleString()} views</Text>
                                      <Text type="secondary" style={{ fontSize: 12 }}>{comp.favorites?.toLocaleString()} ♥</Text>
                                      {comp.listingAge != null && (
                                        <Text type="secondary" style={{ fontSize: 12 }}>{comp.listingAge}d old</Text>
                                      )}
                                      <a href={comp.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: BRAND }}>
                                        <LinkOutlined /> View on Etsy
                                      </a>
                                    </Space>
                                  </div>
                                  <Tooltip
                                    title={
                                      <div>
                                        <div>Tags: {comp.seoBreakdown?.tags}/30</div>
                                        <div>Title: {comp.seoBreakdown?.title}/25</div>
                                        <div>Engagement: {comp.seoBreakdown?.engagement}/25</div>
                                        <div>Price: {comp.seoBreakdown?.price}/20</div>
                                      </div>
                                    }
                                  >
                                    <div style={{ textAlign: 'center', minWidth: 64 }}>
                                      <Progress
                                        type="circle"
                                        percent={comp.seoScore}
                                        size={52}
                                        strokeColor={seoColor(comp.seoScore)}
                                        format={p => <span style={{ fontSize: 13, fontWeight: 700, color: seoColor(comp.seoScore) }}>{p}</span>}
                                      />
                                      <div style={{ fontSize: 10, color: colors.muted, marginTop: 2 }}>SEO</div>
                                    </div>
                                  </Tooltip>
                                </div>
                              </Card>
                            </Col>
                          ))}
                        </Row>
                      ) : (
                        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No competitor data available" />
                      )}
                    </Card>
                  ),
                },
                /* ── Related Keywords Tab ── */
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
                              hoverable
                              onClick={() => handleAnalyze(rk.keyword)}
                              style={{
                                borderRadius: radii.md,
                                border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
                                cursor: 'pointer',
                              }}
                            >
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <Text strong style={{ fontSize: 13 }}>{rk.keyword}</Text>
                                <ThunderboltOutlined style={{ color: BRAND, fontSize: 12 }} />
                              </div>
                              <Space size={12}>
                                <Text type="secondary" style={{ fontSize: 11 }}>Vol: {(rk.searches || 0).toLocaleString()}</Text>
                                <Text style={{ fontSize: 11, color: compColor(rk.competition || 0) }}>Comp: {rk.competition || 0}/100</Text>
                              </Space>
                            </Card>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  ),
                },
                /* ── Suggested Tags Tab ── */
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

      {/* Country Upgrade Modal */}
      <Modal
        open={upgradeOpen}
        onCancel={() => setUpgradeOpen(false)}
        footer={null}
        centered
        width={480}
        styles={{
          content: {
            borderRadius: radii.lg,
            background: isDark ? tok.colorBgContainer : '#fff',
            padding: 0,
            overflow: 'hidden',
          },
        }}
      >
        <div style={{
          background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
          padding: '32px 32px 24px',
          textAlign: 'center',
        }}>
          <span style={{ fontSize: 40, display: 'block', marginBottom: 12 }}>🌍</span>
          <Title level={3} style={{ color: '#fff', margin: 0 }}>
            Unlock {lockedCountry?.name || 'International'} Market Data!
          </Title>
          <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, display: 'block', marginTop: 8 }}>
            International keyword analytics are reserved for our premium sellers.
          </Text>
        </div>
        <div style={{ padding: '24px 32px 32px' }}>
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9fb',
            borderRadius: radii.sm,
            padding: '16px 20px',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            <Text style={{ fontSize: 14 }}>
              Upgrade to the <Tag color="purple" style={{ fontWeight: 600, fontSize: 13 }}>{lockedCountry?.requiredPlan}</Tag> plan
              to analyze keywords in <strong>{lockedCountry?.name}</strong>.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
            <Tag style={{ fontSize: 12, padding: '2px 10px' }}>Current Plan: {plan.name}</Tag>
          </div>
          <Button
            type="primary" block size="large" icon={<CrownOutlined />}
            onClick={() => { setUpgradeOpen(false); navigate('/settings?tab=plans'); }}
            style={{
              background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
              border: 'none', borderRadius: radii.sm,
              fontWeight: 600, height: 48,
              boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
            }}
          >
            View Upgrade Plans
          </Button>
        </div>
      </Modal>
    </AppLayout>
  );
};

export default DeepKeywordAnalyzerPage;
