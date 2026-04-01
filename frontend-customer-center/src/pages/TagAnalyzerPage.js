import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Input, Button, Typography, Tag, Progress, Row, Col,
  Space, Empty, Statistic, message, theme, Table, Tooltip,
  Select, Tabs, Modal, Spin,
} from 'antd';
import {
  TagsOutlined, ThunderboltOutlined, CheckCircleOutlined,
  WarningOutlined, CloseCircleOutlined,
  BulbOutlined, GlobalOutlined, LockOutlined, CrownOutlined,
  HistoryOutlined, ShopOutlined, InfoCircleOutlined,
  CalendarOutlined, ExpandOutlined,
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
import dayjs from 'dayjs';

const { Title, Text } = Typography;
const { TextArea } = Input;
const BRAND = '#6C63FF';

const FALLBACK_COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
];

const statusConfig = {
  excellent:  { color: colors.success, icon: <CheckCircleOutlined />, label: 'Excellent' },
  good:       { color: BRAND, icon: <CheckCircleOutlined />, label: 'Good' },
  needs_work: { color: colors.danger, icon: <CloseCircleOutlined />, label: 'Needs Work' },
  fair:       { color: colors.warning, icon: <WarningOutlined />, label: 'Fair' },
  poor:       { color: colors.danger, icon: <CloseCircleOutlined />, label: 'Poor' },
};

const TagAnalyzerPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, refresh, plan } = usePermissions();
  const navigate = useNavigate();
  getFeatureAccess('tag_analysis');

  // Core state
  const [tags, setTags] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('');
  const [results, setResults] = useState([]);
  const [summary, setSummary] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);

  // Country
  const [country, setCountry] = useState('US');
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockedCountry, setLockedCountry] = useState(null);

  // Listing picker
  const [listings, setListings] = useState([]);
  const [selectedListing, setSelectedListing] = useState(null);

  // History
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  // Tab
  const [activeTab, setActiveTab] = useState('results');

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  // Fetch countries + listings on mount
  useEffect(() => {
    etsyApi.getCountries()
      .then(res => { if (res.success && res.data?.length) setCountries(res.data); })
      .catch(() => {});
    etsyApi.getListings({ limit: 200 })
      .then(res => {
        const items = res.data?.listings || res.listings || [];
        setListings(items);
      })
      .catch(() => {});
  }, []);

  // ── Analyze Tags ──
  const handleAnalyze = async () => {
    const tagList = tags.split(',').map(t => t.trim()).filter(Boolean);
    if (!tagList.length) { message.warning('Enter tags separated by commas'); return; }
    setLoading(true);
    try {
      const res = await etsyApi.analyzeTags({ tags: tagList, title, category, country });
      if (res.success === false) {
        if (res.errorCode === 'UPGRADE_REQUIRED') {
          message.warning(res.message);
        } else {
          message.error(res.message || 'Unable to analyze tags');
        }
        setResults([]);
        setSummary(null);
        setSuggestions([]);
        return;
      }
      const rawTags = res.data?.tags || res.tags || [];
      const rows = rawTags.map((t, i) => ({
        key: i,
        tag: t.tag || t.name || tagList[i] || '',
        score: t.score || t.overallScore || t.qualityScore || 0,
        volume: t.volume || t.totalResults || 0,
        competition: t.competition || 0,
        competitionLevel: t.competitionLevel || 'unknown',
        status: t.status || (t.score >= 80 ? 'excellent' : t.score >= 60 ? 'good' : 'needs_work'),
        suggestion: t.suggestion || null,
        details: t.details || null,
      }));
      setResults(rows);
      setSummary(res.data?.summary || null);
      setSuggestions(res.data?.suggestedReplacements || []);
      if (rows.length) incrementUsage('tag_analysis');
      if (!rows.length) message.info('No tag analysis data found');
      setActiveTab('results');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Tag analysis failed');
      setResults([]);
      setSummary(null);
      setSuggestions([]);
    } finally {
      setLoading(false);
      refresh();
    }
  };

  // ── Fetch History ──
  const fetchHistory = useCallback(async (page = 1) => {
    setHistoryLoading(true);
    try {
      const res = await etsyApi.getTagHistory({ page, limit: 10 });
      setHistory(res.data?.analyses || []);
      setHistoryTotal(res.data?.pagination?.total || 0);
      setHistoryPage(page);
    } catch {
      message.error('Failed to load history');
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === 'history' && history.length === 0) fetchHistory(1);
  };

  // ── Computed Stats ──
  const tagCount = tags.split(',').filter(t => t.trim()).length;
  const missingTags = Math.max(0, 13 - tagCount);
  const avgScore = summary?.averageScore || (results.length ? Math.round(results.reduce((s, r) => s + r.score, 0) / results.length) : 0);
  const excellentCount = summary?.excellent || results.filter(r => r.status === 'excellent').length;
  const needsWorkCount = summary?.needsWork || results.filter(r => r.status === 'needs_work').length;

  // ── Country grouped options ──
  const countryOptions = (() => {
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
  })();

  // ── Results Table Columns ──
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
      title: 'Score', dataIndex: 'score', key: 'score', width: 100,
      render: (s, row) => (
        <Tooltip
          title={row.details ? (
            <div style={{ fontSize: 12 }}>
              <div>{row.details.lengthOk ? '✓' : '✗'} Length {row.details.lengthOk ? '(good)' : '(too short/long)'}</div>
              <div>📝 {row.details.wordCount} word{row.details.wordCount !== 1 ? 's' : ''}</div>
              <div>🎯 Relevance: {row.details.relevance}%</div>
              <div>{row.details.categoryMatch ? '✓' : '✗'} Category match</div>
            </div>
          ) : 'Analyze with a title for detailed breakdown'}
        >
          <Space size={8} style={{ cursor: 'help' }}>
            <Progress
              type="circle" size={36} percent={s}
              strokeColor={s >= 80 ? colors.success : s >= 60 ? colors.warning : colors.danger}
              format={() => s}
            />
          </Space>
        </Tooltip>
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
      title: 'Status', dataIndex: 'status', key: 'status', width: 120,
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
    {
      title: 'Tip', dataIndex: 'suggestion', key: 'suggestion', width: 220,
      render: (s) => s ? (
        <Text style={{ fontSize: 12, color: colors.warning }}>
          <BulbOutlined style={{ marginRight: 4 }} />{s}
        </Text>
      ) : <Text type="secondary" style={{ fontSize: 12 }}>—</Text>,
    },
  ];

  // ── History Table Columns ──
  const historyColumns = [
    {
      title: 'Date', dataIndex: 'analyzedAt', key: 'date', width: 170,
      render: (d) => <Text style={{ fontSize: 12 }}><CalendarOutlined style={{ marginRight: 4 }} />{dayjs(d).format('MMM D, YYYY h:mm A')}</Text>,
    },
    {
      title: 'Title', dataIndex: 'listingTitle', key: 'title',
      render: (t) => <Text style={{ fontSize: 12 }}>{t || <i>No title</i>}</Text>,
    },
    {
      title: 'Country', dataIndex: 'country', key: 'country', width: 80, align: 'center',
      render: (c) => <Tag style={{ fontSize: 11 }}>{c || 'US'}</Tag>,
    },
    {
      title: 'Tags', key: 'tagCount', width: 70, align: 'center',
      render: (_, row) => <Text>{row.summary?.totalTags || row.tags?.length || 0}</Text>,
    },
    {
      title: 'Avg Score', key: 'avgScore', width: 90, align: 'center',
      render: (_, row) => {
        const avg = row.summary?.averageScore;
        if (avg == null) return <Text type="secondary">—</Text>;
        return <Text strong style={{ color: avg >= 80 ? colors.success : avg >= 60 ? colors.warning : colors.danger }}>{avg}</Text>;
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
        {/* ── Input Section ── */}
        <Card style={{ ...card, marginBottom: 24 }}>
          <Row gutter={[16, 16]}>
            {/* Country Select */}
            <Col xs={24} md={8}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Market</Text>
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
                options={countryOptions}
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
            {/* Listing Picker */}
            <Col xs={24} md={16}>
              <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Auto-load from Listing</Text>
              <Select
                value={selectedListing?.listingId || selectedListing?.etsyListingId || 'none'}
                onChange={(val) => {
                  if (val === 'none') {
                    setSelectedListing(null);
                    return;
                  }
                  const l = listings.find(li => String(li.listingId || li.etsyListingId) === String(val));
                  if (l) {
                    setSelectedListing(l);
                    setTags((l.tags || []).join(', '));
                    setTitle(l.title || '');
                    setCategory(l.taxonomyPath?.[0] || '');
                  }
                }}
                size="large"
                style={{ width: '100%' }}
                prefix={<ShopOutlined />}
                showSearch
                optionFilterProp="label"
                placeholder="Select a listing to auto-fill tags"
                options={[
                  { value: 'none', label: '📝 Enter tags manually' },
                  ...listings.map(l => ({
                    value: String(l.listingId || l.etsyListingId),
                    label: l.title || `Listing #${l.listingId || l.etsyListingId}`,
                  })),
                ]}
              />
            </Col>
          </Row>

          <div style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              {/* Title Input */}
              <Col xs={24} md={12}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Listing Title (for relevance scoring)</Text>
                <Input
                  placeholder="e.g. Handmade Silver Earrings — Boho Gift for Her"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  style={{ borderRadius: radii.sm, fontSize: 13 }}
                  size="large"
                />
              </Col>
              {/* Category Input */}
              <Col xs={24} md={12}>
                <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>Category (optional)</Text>
                <Input
                  placeholder="e.g. Jewelry, Home Decor"
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  style={{ borderRadius: radii.sm, fontSize: 13 }}
                  size="large"
                />
              </Col>
            </Row>
          </div>

          <div style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col xs={24} md={18}>
                <TextArea
                  rows={3}
                  placeholder="Paste your listing tags, separated by commas...&#10;handmade jewelry, custom necklace, gift for her, unique earrings"
                  value={tags}
                  onChange={e => setTags(e.target.value)}
                  style={{ borderRadius: radii.sm, fontSize: 13 }}
                />
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  {tagCount} / 13 tags entered (Etsy allows 13)
                </Text>
              </Col>
              <Col xs={24} md={6} style={{ display: 'flex', alignItems: 'flex-start' }}>
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
          </div>

          {/* Missing Tags Warning */}
          {tagCount > 0 && tagCount < 13 && (
            <div style={{
              marginTop: 12,
              background: isDark ? 'rgba(255,165,0,0.08)' : '#fff8e6',
              border: `1px solid ${isDark ? 'rgba(255,165,0,0.2)' : '#ffe0a0'}`,
              borderRadius: radii.sm, padding: '10px 14px',
            }}>
              <Text style={{ fontSize: 13, color: isDark ? '#FFB347' : '#B8860B' }}>
                <InfoCircleOutlined style={{ marginRight: 6 }} />
                You're using <strong>{tagCount}/13</strong> tags. Add <strong>{missingTags}</strong> more tag{missingTags !== 1 ? 's' : ''} to maximize your listing's visibility!
              </Text>
            </div>
          )}
        </Card>

        {/* ── Stat Cards ── */}
        {results.length > 0 && (
          <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
            <Col xs={12} sm={6}>
              <Card style={card}>
                <Statistic title="Avg Quality Score" value={avgScore} suffix="/ 100" valueStyle={{ color: BRAND, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={card}>
                <Statistic title="Excellent Tags" value={excellentCount} suffix={`/ ${results.length}`} valueStyle={{ color: colors.success, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={card}>
                <Statistic title="Needs Work" value={needsWorkCount} suffix={`/ ${results.length}`} valueStyle={{ color: needsWorkCount > 0 ? colors.danger : colors.success, fontWeight: 700 }} />
              </Card>
            </Col>
            <Col xs={12} sm={6}>
              <Card style={card}>
                <Statistic
                  title="Missing Tags"
                  value={summary?.missingTags ?? missingTags}
                  suffix="/ 13"
                  valueStyle={{ color: (summary?.missingTags ?? missingTags) > 0 ? colors.warning : colors.success, fontWeight: 700 }}
                />
              </Card>
            </Col>
          </Row>
        )}

        {/* ── Tabs ── */}
        <Tabs
          activeKey={activeTab}
          onChange={handleTabChange}
          style={{ marginBottom: 24 }}
          items={[
            /* ── Results Tab ── */
            {
              key: 'results',
              label: <span><TagsOutlined /> Results</span>,
              children: results.length > 0 ? (
                <>
                  <Card style={card}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Title level={5} style={{ margin: 0 }}>Tag Performance</Title>
                      <Tooltip title="Hover over scores to see detailed breakdown">
                        <Tag icon={<BulbOutlined />} color="purple" style={{ borderRadius: radii.pill }}>
                          Hover scores for details
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

                  {/* ── Suggested Replacements ── */}
                  {suggestions.length > 0 && (
                    <Card style={{ ...card, marginTop: 16 }}>
                      <Title level={5} style={{ marginBottom: 12 }}>
                        <BulbOutlined style={{ marginRight: 8, color: BRAND }} />
                        Suggested Replacement Keywords
                      </Title>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
                        Based on your keyword research history — click to copy, then replace a low-scoring tag.
                      </Text>
                      <Space wrap size={[8, 8]}>
                        {suggestions.map((s, i) => (
                          <Tooltip key={i} title={
                            <div style={{ fontSize: 12 }}>
                              <div>Score: {s.score}</div>
                              <div>Est. Volume: {(s.estimatedVolume || 0).toLocaleString()}</div>
                              <div>Competition: {s.competitionLevel}</div>
                            </div>
                          }>
                            <Tag
                              style={{
                                padding: '6px 14px', fontSize: 13, cursor: 'pointer',
                                borderRadius: radii.pill, fontWeight: 500,
                                background: isDark ? 'rgba(108,99,255,0.12)' : '#f0eeff',
                                color: BRAND, border: `1px solid ${BRAND}40`,
                                transition: 'all 0.2s',
                              }}
                              onClick={() => {
                                navigator.clipboard.writeText(s.keyword);
                                message.success(`Copied "${s.keyword}" — paste it in place of a low-scoring tag`);
                              }}
                            >
                              {s.keyword}
                              <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>
                                {s.competitionLevel === 'low' ? '🟢' : s.competitionLevel === 'medium' ? '🟡' : '🔴'}
                              </span>
                            </Tag>
                          </Tooltip>
                        ))}
                      </Space>
                    </Card>
                  )}
                </>
              ) : !loading ? (
                <Card style={card}>
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Paste your listing tags above to see their performance" />
                </Card>
              ) : null,
            },
            /* ── History Tab ── */
            {
              key: 'history',
              label: <span><HistoryOutlined /> History</span>,
              children: (
                <Card style={card}>
                  <Title level={5} style={{ marginBottom: 16 }}>Analysis History</Title>
                  {historyLoading ? (
                    <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
                  ) : history.length > 0 ? (
                    <Table
                      columns={historyColumns}
                      dataSource={history.map((h, i) => ({ ...h, key: h._id || i }))}
                      size="middle"
                      pagination={{
                        current: historyPage,
                        total: historyTotal,
                        pageSize: 10,
                        onChange: (p) => fetchHistory(p),
                        showSizeChanger: false,
                      }}
                      expandable={{
                        expandedRowRender: (record) => (
                          <div style={{ padding: '8px 0' }}>
                            <Row gutter={[8, 8]}>
                              {(record.tags || []).map((t, i) => (
                                <Col xs={24} sm={12} md={8} key={i}>
                                  <div style={{
                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                    padding: '6px 12px', borderRadius: radii.sm,
                                    background: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9fb',
                                  }}>
                                    <Text style={{ fontSize: 12 }}>{t.tag}</Text>
                                    <Space size={8}>
                                      <Tag style={{
                                        fontWeight: 700, fontSize: 11, borderRadius: radii.pill, border: 'none', padding: '1px 8px',
                                        background: t.score >= 80 ? `${colors.success}18` : t.score >= 60 ? `${colors.warning}18` : `${colors.danger}18`,
                                        color: t.score >= 80 ? colors.success : t.score >= 60 ? colors.warning : colors.danger,
                                      }}>
                                        {t.score}
                                      </Tag>
                                      {(() => {
                                        const cfg = statusConfig[t.status] || statusConfig.fair;
                                        return <Text style={{ fontSize: 11, color: cfg.color, fontWeight: 600 }}>{cfg.label}</Text>;
                                      })()}
                                    </Space>
                                  </div>
                                </Col>
                              ))}
                            </Row>
                          </div>
                        ),
                        expandIcon: ({ expanded, onExpand, record }) => (
                          <ExpandOutlined
                            style={{ color: BRAND, cursor: 'pointer', transform: expanded ? 'rotate(90deg)' : undefined, transition: 'transform 0.2s' }}
                            onClick={e => onExpand(record, e)}
                          />
                        ),
                      }}
                    />
                  ) : (
                    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No analysis history yet. Analyze your tags to see history here." />
                  )}
                </Card>
              ),
            },
          ]}
        />
      </FeatureGate>

      {/* ── Country Upgrade Modal ── */}
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
            International tag analysis is reserved for our premium sellers.
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
              to analyze tags in <strong>{lockedCountry?.name}</strong>.
            </Text>
          </div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
            <Tag style={{ fontSize: 12, padding: '2px 10px' }}>Current Plan: {plan?.name || 'Free'}</Tag>
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

export default TagAnalyzerPage;
