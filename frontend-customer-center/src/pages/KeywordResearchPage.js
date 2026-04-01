import React, { useState, useEffect } from 'react';
import {
  Card, Input, Select, Button, Table, Tag, Typography, Row, Col,
  Space, Empty, message, theme, Modal, Tooltip, Spin, Segmented,
} from 'antd';
import {
  SearchOutlined, GlobalOutlined, KeyOutlined, LockOutlined, CrownOutlined,
  FireOutlined, RiseOutlined, FallOutlined, ThunderboltOutlined,
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

const { Title, Text } = Typography;

// Fallback if API fails
const FALLBACK_COUNTRIES = [
  { value: 'US', label: '🇺🇸 United States' },
  { value: 'GB', label: '🇬🇧 United Kingdom' },
  { value: 'CA', label: '🇨🇦 Canada' },
  { value: 'AU', label: '🇦🇺 Australia' },
  { value: 'DE', label: '🇩🇪 Germany' },
  { value: 'FR', label: '🇫🇷 France' },
];

const compColor = (comp) => {
  if (comp >= 70) return colors.danger;
  if (comp >= 40) return colors.warning;
  return colors.success;
};

const KeywordResearchPage = () => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, plan } = usePermissions();
  const access = getFeatureAccess('keyword_search');
  const navigate = useNavigate();

  const [keyword, setKeyword] = useState('');
  const [country, setCountry] = useState('US');
  const [countries, setCountries] = useState(FALLBACK_COUNTRIES);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Upgrade modal state
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [lockedCountry, setLockedCountry] = useState(null);

  // Trending keywords state
  const [trending, setTrending] = useState([]);
  const [trendingLoading, setTrendingLoading] = useState(false);
  const [trendCategories, setTrendCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [trendLastUpdated, setTrendLastUpdated] = useState(null);

  useEffect(() => {
    etsyApi.getCountries()
      .then(res => {
        if (res.success && res.data?.length) setCountries(res.data);
      })
      .catch(() => {});
    // Load trending keywords on mount
    fetchTrending('all');
  }, []);

  const fetchTrending = async (category) => {
    setTrendingLoading(true);
    try {
      const params = { limit: 30 };
      if (category && category !== 'all') params.category = category;
      const res = await etsyApi.getTrendingKeywords(params);
      if (res.success) {
        setTrending(res.data?.trending || []);
        setTrendCategories(res.data?.categories || []);
        setTrendLastUpdated(res.data?.lastUpdated);
      }
    } catch {
      // silently fail — trending is supplementary
    } finally {
      setTrendingLoading(false);
    }
  };

  const handleCategoryChange = (val) => {
    setSelectedCategory(val);
    fetchTrending(val);
  };

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const handleSearch = async () => {
    if (!keyword.trim()) { message.warning('Enter a keyword to search'); return; }
    setLoading(true);
    setSearched(true);
    setCurrentPage(1);
    try {
      const res = await etsyApi.searchKeywords({ keyword: keyword.trim(), country });
      if (res.success === false) {
        message.error(res.message || 'Unable to fetch keyword data');
        setResults([]);
        return;
      }
      const rows = (res.data?.results || res.results || []).map((k, i) => ({
        key: i,
        keyword: k.keyword || k.query || keyword.trim(),
        searches: k.searches || k.volume || k.estimatedVolume || 0,
        clicks: k.clicks || 0,
        ctr: k.ctr || '—',
        competition: k.competition || k.competitionPct || 0,
        trend: k.trend || 'stable',
        opportunity: k.demandScore || k.opportunityScore || 0,
        fusionScore: k.fusionScore ?? null,
        googleTrends: k.googleTrendsInterest ?? null,
        googleTrendDir: k.googleTrendDirection ?? null,
        freshness: k.marketFreshness ?? null,
        velocity: k.velocityPerDay ?? null,
      }));
      setResults(rows);
      if (rows.length) incrementUsage('keyword_search');
      if (!rows.length) message.info('No results found for this keyword. Try a different search term.');
    } catch (err) {
      const msg = err?.response?.data?.message || err?.response?.data?.detail || 'Search failed — check your connection';
      message.error(msg);
      setResults([]);
    } finally {
      setLoading(false);
    }
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
      width: 100,
      align: 'center',
      render: (t, row) => {
        // Use Google Trends direction if available from snapshot
        const dir = row.googleTrendDir || t;
        const icon = dir === 'rising' ? <RiseOutlined /> : dir === 'declining' ? <FallOutlined /> : null;
        const label = dir === 'rising' ? 'Rising' : dir === 'declining' ? 'Declining' : 'Stable';
        const color = dir === 'rising' ? 'green' : dir === 'declining' ? 'red' : 'default';
        return (
          <Tooltip title={row.googleTrends != null ? `Google Trends: ${row.googleTrends}/100` : 'Based on Etsy data'}>
            <Tag color={color} style={{ fontSize: 11 }}>
              {icon} {label}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Opportunity',
      dataIndex: 'opportunity',
      key: 'opportunity',
      width: 130,
      align: 'center',
      sorter: (a, b) => (a.fusionScore ?? a.opportunity) - (b.fusionScore ?? b.opportunity),
      defaultSortOrder: 'descend',
      render: (score, row) => {
        // Prefer fusion score from snapshot data if available
        const displayScore = row.fusionScore ?? score;
        const color = displayScore >= 75 ? colors.success : displayScore >= 40 ? colors.warning : colors.danger;
        const label = displayScore >= 75 ? 'Hot' : displayScore >= 40 ? 'Warm' : 'Low';
        const source = row.fusionScore != null ? '5-Layer AI' : 'Etsy Data';
        return (
          <Tooltip title={`${source} Score: ${displayScore}/100${row.freshness ? ` | Market: ${row.freshness}` : ''}${row.velocity != null ? ` | ${row.velocity} views/day` : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
              <div style={{
                width: 40, height: 6, borderRadius: 3,
                background: isDark ? 'rgba(255,255,255,0.1)' : '#f0f0f0',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${displayScore}%`, height: '100%', borderRadius: 3,
                  background: color,
                }} />
              </div>
              <Tag color={displayScore >= 75 ? 'green' : displayScore >= 40 ? 'orange' : 'red'}
                style={{ fontSize: 11, fontWeight: 600, margin: 0 }}>
                {displayScore} {label}
              </Tag>
              {row.fusionScore != null && (
                <ThunderboltOutlined style={{ fontSize: 10, color: colors.brand }} />
              )}
            </div>
          </Tooltip>
        );
      },
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
                onChange={(val) => {
                  const allItems = countries;
                  const c = allItems.find(ct => ct.value === val);
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
                  // Pin Global & US at top, then the rest alphabetically
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
                  const locked = c?.isLocked;
                  return (
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span style={{ color: locked ? (isDark ? '#6B7280' : '#9CA3AF') : undefined }}>
                        {option.label}
                      </span>
                      {locked && (
                        <LockOutlined style={{ fontSize: 12, color: isDark ? '#6B7280' : '#9CA3AF', marginLeft: 8 }} />
                      )}
                    </div>
                  );
                }}
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
                data-search-btn="true"
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

        {/* Trending Keywords Section */}
        {!searched && (
          <Card
            style={{ ...card, marginBottom: 24 }}
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FireOutlined style={{ color: '#ff4d4f', fontSize: 18 }} />
                <span style={{ fontWeight: 600, fontSize: 15 }}>Trending Keywords</span>
                {trendLastUpdated && (
                  <Text type="secondary" style={{ fontSize: 11, marginLeft: 'auto', fontWeight: 400 }}>
                    Updated: {new Date(trendLastUpdated).toLocaleDateString()}
                  </Text>
                )}
              </div>
            }
          >
            {trendCategories.length > 0 && (
              <div style={{ marginBottom: 16, overflowX: 'auto' }}>
                <Segmented
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  options={[
                    { label: 'All Categories', value: 'all' },
                    ...trendCategories.map(c => ({
                      label: c.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).trim(),
                      value: c,
                    })),
                  ]}
                  style={{ fontSize: 12 }}
                />
              </div>
            )}

            {trendingLoading ? (
              <div style={{ textAlign: 'center', padding: 40 }}>
                <Spin tip="Loading trending keywords..." />
              </div>
            ) : trending.length > 0 ? (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {trending.map((t, i) => {
                  const isRising = t.trendDirection === 'rising';
                  const isDeclining = t.trendDirection === 'declining';
                  const isNew = t.trendDirection === 'new';
                  const scoreColor = t.fusionScore >= 75 ? colors.success : t.fusionScore >= 40 ? colors.warning : colors.danger;
                  return (
                    <Tooltip
                      key={i}
                      title={
                        <div style={{ fontSize: 12 }}>
                          <div><strong>{t.keyword}</strong></div>
                          <div>Fusion Score: {t.fusionScore}/100</div>
                          {t.totalResults > 0 && <div>Etsy Results: {t.totalResults.toLocaleString()}</div>}
                          {t.googleTrends != null && <div>Google Trends: {t.googleTrends}/100</div>}
                          {t.freshness && <div>Market: {t.freshness}</div>}
                          {t.competition > 0 && <div>Competition: {t.competition}%</div>}
                          {t.fusionChange != null && <div>WoW Change: {t.fusionChange > 0 ? '+' : ''}{t.fusionChange}%</div>}
                        </div>
                      }
                    >
                      <Tag
                        style={{
                          cursor: 'pointer',
                          padding: '4px 12px',
                          fontSize: 13,
                          borderRadius: 16,
                          borderColor: isRising ? colors.success : isDeclining ? colors.danger : scoreColor,
                          background: isRising
                            ? (isDark ? 'rgba(82,196,26,0.1)' : '#f6ffed')
                            : isDeclining
                            ? (isDark ? 'rgba(255,77,79,0.1)' : '#fff2f0')
                            : (isDark ? 'rgba(108,99,255,0.1)' : '#f0f0ff'),
                        }}
                        onClick={() => {
                          setKeyword(t.keyword);
                          // Auto-search
                          setTimeout(() => {
                            const btn = document.querySelector('[data-search-btn]');
                            if (btn) btn.click();
                          }, 100);
                        }}
                      >
                        {isRising && <RiseOutlined style={{ color: colors.success, marginRight: 4 }} />}
                        {isDeclining && <FallOutlined style={{ color: colors.danger, marginRight: 4 }} />}
                        {isNew && <ThunderboltOutlined style={{ color: colors.brand, marginRight: 4 }} />}
                        {t.keyword}
                        <span style={{
                          fontSize: 10, marginLeft: 6, fontWeight: 700,
                          color: scoreColor,
                        }}>
                          {t.fusionScore}
                        </span>
                      </Tag>
                    </Tooltip>
                  );
                })}
              </div>
            ) : (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<Text type="secondary">No trending data yet — snapshots will appear after the daily cron runs</Text>}
              />
            )}
          </Card>
        )}

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
                size="middle"
                pagination={{
                  current: currentPage,
                  pageSize,
                  total: results.length,
                  onChange: (page, size) => {
                    setCurrentPage(page);
                    setPageSize(size);
                  },
                  showSizeChanger: true,
                  pageSizeOptions: ['10', '20', '50', '100'],
                  showTotal: (total, range) => (
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Showing {range[0]}–{range[1]} of {total} keywords
                    </Text>
                  ),
                  style: { marginTop: 16 },
                }}
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
          <Typography.Title level={3} style={{ color: '#fff', margin: 0 }}>
            Unlock {lockedCountry?.name || 'International'} Market Data!
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14, display: 'block', marginTop: 8 }}>
            International keyword analytics are reserved for our premium sellers.
          </Typography.Text>
        </div>

        <div style={{ padding: '24px 32px 32px' }}>
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.04)' : '#f9f9fb',
            borderRadius: radii.sm,
            padding: '16px 20px',
            marginBottom: 20,
            textAlign: 'center',
          }}>
            <Typography.Text style={{ fontSize: 14 }}>
              Upgrade to the <Tag color="purple" style={{ fontWeight: 600, fontSize: 13 }}>{lockedCountry?.requiredPlan}</Tag> plan
              to see what buyers in <strong>{lockedCountry?.name}</strong> are searching for.
            </Typography.Text>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
            <Tag style={{ fontSize: 12, padding: '2px 10px' }}>Current Plan: {plan.name}</Tag>
          </div>

          <Button
            type="primary"
            block
            size="large"
            icon={<CrownOutlined />}
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

export default KeywordResearchPage;
