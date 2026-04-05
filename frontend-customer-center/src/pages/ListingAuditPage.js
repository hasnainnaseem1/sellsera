import React, { useState, useEffect, useCallback } from 'react';
import {
  Row, Col, Card, Form, Input, InputNumber, Select, Button, Typography,
  Tag, Progress, Tabs, List, Space, message, theme, Collapse, Cascader,
  Spin, Avatar,
} from 'antd';
import {
  SearchOutlined, ThunderboltOutlined, TagsOutlined, DollarOutlined,
  CheckCircleOutlined, CopyOutlined, ArrowLeftOutlined, RocketOutlined,
  BulbOutlined, TrophyOutlined, FileTextOutlined, ShopOutlined,
  ImportOutlined, DownloadOutlined,
} from '@ant-design/icons';

import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import QuotaBanner from '../components/common/QuotaBanner';
import UsageBadge from '../components/common/UsageBadge';
import { usePermissions } from '../context/PermissionsContext';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import analysisApi from '../api/analysisApi';
import etsyApi from '../api/etsyApi';

const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const scoreColor = (score) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.danger;
};

const ListingAuditPage = () => {
  const [form] = Form.useForm();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const { getFeatureAccess, incrementUsage, refresh } = usePermissions();
  const access = getFeatureAccess('listing_audit');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  // Categories (Etsy taxonomy)
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  // Import from shop
  const [shopListings, setShopListings] = useState([]);
  const [listingsLoading, setListingsLoading] = useState(false);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  /* ─── Fetch categories ─── */
  useEffect(() => {
    let mounted = true;
    setCategoriesLoading(true);
    etsyApi.getCategories()
      .then(res => { if (mounted) setCategories(res.data || []); })
      .catch(() => {})
      .finally(() => { if (mounted) setCategoriesLoading(false); });
    return () => { mounted = false; };
  }, []);

  /* ─── Fetch shop listings ─── */
  const fetchListings = useCallback(async (search = '') => {
    setListingsLoading(true);
    try {
      const res = await etsyApi.getListings({ search, limit: 50 });
      setShopListings(res.data?.listings || []);
    } catch { setShopListings([]); }
    finally { setListingsLoading(false); }
  }, []);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  /* ─── Import a listing into the form ─── */
  const [importedMeta, setImportedMeta] = useState(null);
  const importListing = async (listing) => {
    try {
      const res = await etsyApi.getListingById(listing.listingId);
      const d = res.data;
      const catPath = d.category ? d.category.split(' > ') : [];
      form.setFieldsValue({
        title: d.title || '',
        description: d.description || '',
        tags: d.tags || [],
        price: d.price || undefined,
        category: catPath,
      });
      setImportedMeta({
        imageCount: d.images?.length || d.imageCount || 0,
        freeShipping: d.shippingProfile?.freeShipping || d.freeShipping || false,
        processingDays: d.shippingProfile?.processingDays || d.processingDays || null,
        returnsAccepted: d.returnsAccepted || false,
      });
      message.success(`Imported "${d.title?.substring(0, 40)}..."`);
    } catch {
      // Fallback: use the data we already have from the listing table
      form.setFieldsValue({
        title: listing.title || '',
        tags: listing.tags || [],
        price: listing.price || undefined,
      });
      setImportedMeta(null);
      message.info('Imported basic details (full description requires sync)');
    }
  };

  /* ─── Submit ─── */
  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      // Convert cascader array to string for backend
      const categoryStr = Array.isArray(values.category)
        ? values.category.join(' > ')
        : values.category || '';

      const data = await analysisApi.analyze({
        title: values.title,
        description: values.description,
        tags: values.tags || [],
        price: values.price,
        category: categoryStr,
        ...(importedMeta || {}),
      });
      setResult(data);
      incrementUsage('listing_audit');
      refresh();
      message.success('Analysis complete!');
    } catch (err) {
      const msg = err.response?.data?.message || 'Analysis failed';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  /* ── Score Gauge ── */
  const ScoreGauge = ({ score }) => (
    <div style={{ textAlign: 'center', padding: '24px 0' }}>
      <Progress
        type="dashboard"
        percent={score}
        strokeColor={scoreColor(score)}
        format={(pct) => (
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(score) }}>{pct}</div>
            <div style={{ fontSize: 12, color: tok.colorTextSecondary }}>SEO Score</div>
          </div>
        )}
        size={180}
        strokeWidth={8}
      />
      <div style={{ marginTop: 12 }}>
        <Tag
          color={score >= 80 ? 'green' : score >= 60 ? 'gold' : 'red'}
          style={{ fontSize: 13, padding: '2px 14px' }}
        >
          {score >= 80 ? 'Excellent' : score >= 60 ? 'Good — Room to Improve' : 'Needs Work'}
        </Tag>
      </div>
    </div>
  );

  /* ── Results View ── */
  const ResultsView = () => {
    const { analysis, usage } = result;
    const rec = analysis.recommendations;

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => setResult(null)}>
            New Audit
          </Button>
          {usage && (
            <UsageBadge used={usage.used} limit={usage.unlimited ? null : usage.limit} showLabel />
          )}
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} md={8}>
            <Card style={card}>
              <ScoreGauge score={analysis.score} />
            </Card>
          </Col>
          <Col xs={24} md={16}>
            <Card style={card} styles={{ body: { padding: 0 } }}>
              <Tabs
                defaultActiveKey="title"
                style={{ padding: '0 24px' }}
                items={[
                  {
                    key: 'title',
                    label: <span><FileTextOutlined /> Title</span>,
                    children: (
                      <div style={{ padding: '16px 0 24px' }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>ORIGINAL</Text>
                        <Paragraph style={{
                          background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                          padding: 12, borderRadius: radii.sm, marginBottom: 16,
                        }}>
                          {form.getFieldValue('title')}
                        </Paragraph>
                        <Text type="secondary" style={{ fontSize: 12 }}>OPTIMIZED</Text>
                        <div style={{
                          background: isDark ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.04)',
                          padding: 12, borderRadius: radii.sm, marginBottom: 8,
                          border: `1px solid ${isDark ? 'rgba(108,99,255,0.2)' : 'rgba(108,99,255,0.1)'}`,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8,
                        }}>
                          <Text strong>{rec.optimizedTitle}</Text>
                          <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(rec.optimizedTitle)} />
                        </div>
                        <Collapse ghost items={[{
                          key: 'reasoning',
                          label: <Text type="secondary" style={{ fontSize: 12 }}>Why this works →</Text>,
                          children: <Text type="secondary" style={{ fontSize: 13 }}>{rec.titleReasoning}</Text>,
                        }]} />
                      </div>
                    ),
                  },
                  {
                    key: 'description',
                    label: <span><BulbOutlined /> Description</span>,
                    children: (
                      <div style={{ padding: '16px 0 24px' }}>
                        <div style={{
                          background: isDark ? 'rgba(108,99,255,0.08)' : 'rgba(108,99,255,0.04)',
                          padding: 16, borderRadius: radii.sm, marginBottom: 8,
                          border: `1px solid ${isDark ? 'rgba(108,99,255,0.2)' : 'rgba(108,99,255,0.1)'}`,
                          whiteSpace: 'pre-wrap', lineHeight: 1.7,
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                            <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(rec.optimizedDescription)}>
                              Copy
                            </Button>
                          </div>
                          {rec.optimizedDescription}
                        </div>
                        <Collapse ghost items={[{
                          key: 'reasoning',
                          label: <Text type="secondary" style={{ fontSize: 12 }}>Why this works →</Text>,
                          children: <Text type="secondary" style={{ fontSize: 13 }}>{rec.descriptionReasoning}</Text>,
                        }]} />
                      </div>
                    ),
                  },
                  {
                    key: 'tags',
                    label: <span><TagsOutlined /> Tags ({rec.optimizedTags?.length || 0})</span>,
                    children: (
                      <div style={{ padding: '16px 0 24px' }}>
                        <Row gutter={[12, 12]}>
                          {rec.optimizedTags?.map((t, i) => (
                            <Col xs={24} sm={12} key={i}>
                              <div style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : '#fafafa',
                                borderRadius: radii.sm, padding: '12px 14px',
                                border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Tag color={colors.brand} style={{ fontWeight: 600 }}>{t.tag}</Tag>
                                  <Button type="text" size="small" icon={<CopyOutlined />} onClick={() => copyText(t.tag)} />
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>
                                  {t.reasoning}
                                </Text>
                              </div>
                            </Col>
                          ))}
                        </Row>
                      </div>
                    ),
                  },
                  {
                    key: 'pricing',
                    label: <span><DollarOutlined /> Pricing</span>,
                    children: (
                      <div style={{ padding: '16px 0 24px' }}>
                        <Row gutter={[24, 16]}>
                          <Col xs={8}>
                            <Card size="small" style={{ textAlign: 'center', borderRadius: radii.sm }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Your Price</Text>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>${form.getFieldValue('price')}</div>
                            </Card>
                          </Col>
                          <Col xs={8}>
                            <Card size="small" style={{ textAlign: 'center', borderRadius: radii.sm, borderColor: colors.brand }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Suggested</Text>
                              <div style={{ fontSize: 22, fontWeight: 700, color: colors.brand }}>
                                ${rec.pricingRecommendation?.suggestedPrice}
                              </div>
                            </Card>
                          </Col>
                          <Col xs={8}>
                            <Card size="small" style={{ textAlign: 'center', borderRadius: radii.sm }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>Market Avg</Text>
                              <div style={{ fontSize: 22, fontWeight: 700 }}>
                                ${rec.pricingRecommendation?.competitorRange?.average}
                              </div>
                            </Card>
                          </Col>
                        </Row>
                        <Paragraph type="secondary" style={{ marginTop: 16, fontSize: 13 }}>
                          {rec.pricingRecommendation?.reasoning}
                        </Paragraph>
                      </div>
                    ),
                  },
                  {
                    key: 'actions',
                    label: <span><TrophyOutlined /> Actions</span>,
                    children: (
                      <div style={{ padding: '16px 0 24px' }}>
                        <List
                          dataSource={rec.actionItems || []}
                          renderItem={(item) => (
                            <List.Item style={{ padding: '12px 0' }}>
                              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <Tag color={
                                    item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'gold' : 'purple'
                                  } style={{ textTransform: 'capitalize', fontSize: 11 }}>
                                    {item.priority}
                                  </Tag>
                                  <Text strong style={{ fontSize: 14 }}>{item.action}</Text>
                                </div>
                                <Text type="secondary" style={{ fontSize: 12, paddingLeft: 4 }}>
                                  Impact: {item.impact}
                                </Text>
                              </Space>
                            </List.Item>
                          )}
                        />
                      </div>
                    ),
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>

        {/* Competitors */}
        {analysis.competitors?.length > 0 && (
          <Card style={{ ...card, marginTop: 24 }} title={<><TrophyOutlined /> Competitor Benchmarks</>}>
            <Row gutter={[16, 16]}>
              {analysis.competitors.map((c, i) => (
                <Col xs={24} sm={12} md={8} key={i}>
                  <Card size="small" style={{ borderRadius: radii.sm }}>
                    <Text strong ellipsis style={{ display: 'block', marginBottom: 4 }}>{c.title}</Text>
                    <Space>
                      <Tag color="green">${c.price?.toFixed(2)}</Tag>
                      <Tag>{c.sales} sales</Tag>
                      <Tag color={colors.brand}>#{c.ranking}</Tag>
                    </Space>
                  </Card>
                </Col>
              ))}
            </Row>
          </Card>
        )}
      </div>
    );
  };

  /* ── Input Form ── */
  const AuditForm = () => (
    <Row gutter={[24, 24]}>
      <Col xs={24} lg={16}>
        <Card style={card}>
          {/* ─ Quick Import Strip ─ */}
          <div style={{
            background: isDark
              ? 'linear-gradient(135deg, rgba(108,99,255,0.10), rgba(108,99,255,0.04))'
              : 'linear-gradient(135deg, rgba(108,99,255,0.06), rgba(108,99,255,0.02))',
            border: `1px solid ${isDark ? 'rgba(108,99,255,0.18)' : 'rgba(108,99,255,0.12)'}`,
            borderRadius: radii.sm, padding: '14px 18px', marginBottom: 28,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <DownloadOutlined style={{ color: '#fff', fontSize: 13 }} />
              </div>
              <Text strong style={{ fontSize: 14 }}>Quick Import</Text>
              <Text type="secondary" style={{ fontSize: 12 }}>— select a listing to auto-fill all fields</Text>
            </div>
            <Select
              showSearch
              placeholder="Search your shop listings..."
              size="large"
              style={{ width: '100%' }}
              loading={listingsLoading}
              filterOption={(input, option) =>
                option?.title?.toLowerCase().includes(input.toLowerCase())
              }
              notFoundContent={listingsLoading ? <Spin size="small" /> : 'No listings found'}
              onChange={(listingId) => {
                const listing = shopListings.find(l => String(l.listingId) === String(listingId));
                if (listing) importListing(listing);
              }}
              optionLabelProp="title"
              value={null}
            >
              {shopListings.map(listing => (
                <Select.Option
                  key={listing.listingId}
                  value={listing.listingId}
                  title={listing.title}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0' }}>
                    <Avatar
                      shape="square" size={36}
                      src={listing.images?.[0]?.url}
                      icon={<ShopOutlined />}
                      style={{ flexShrink: 0, borderRadius: 6 }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontWeight: 600, fontSize: 13,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {listing.title}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 1 }}>
                        <span style={{ fontSize: 11, color: tok.colorTextSecondary }}>${listing.price}</span>
                        <span style={{ fontSize: 11, color: tok.colorTextSecondary }}>
                          {listing.tags?.length || 0}/13 tags
                        </span>
                        <Tag
                          color={listing.state === 'active' ? 'green' : 'default'}
                          style={{ fontSize: 10, lineHeight: '16px', margin: 0 }}
                        >
                          {listing.state}
                        </Tag>
                      </div>
                    </div>
                    <ImportOutlined style={{ color: colors.brand, fontSize: 14 }} />
                  </div>
                </Select.Option>
              ))}
            </Select>
          </div>

          {/* ─ Form ─ */}
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            autoComplete="off"
          >
            <Form.Item
              name="title" label="Listing Title"
              rules={[{ required: true, message: 'Title is required' }]}
            >
              <Input
                placeholder="e.g. Handmade Ceramic Coffee Mug — Unique Gift for Her"
                maxLength={140} showCount
                size="large"
              />
            </Form.Item>

            <Form.Item
              name="description" label="Description"
              rules={[{ required: true, message: 'Description is required' }]}
            >
              <TextArea
                placeholder="Describe your product in detail..."
                rows={5} maxLength={4000} showCount
                size="large"
              />
            </Form.Item>

            <Row gutter={16}>
              <Col xs={12}>
                <Form.Item
                  name="price" label="Price ($)"
                  rules={[{ required: true, message: 'Price is required' }]}
                >
                  <InputNumber
                    placeholder="29.99"
                    min={0.01} step={0.01} precision={2}
                    style={{ width: '100%' }} size="large"
                    prefix={<DollarOutlined />}
                  />
                </Form.Item>
              </Col>
              <Col xs={12}>
                <Form.Item
                  name="category" label="Category"
                  rules={[{ required: true, message: 'Category is required' }]}
                >
                  <Cascader
                    options={categories}
                    placeholder="Select category"
                    size="large"
                    showSearch={{
                      filter: (input, path) =>
                        path.some(opt => opt.label.toLowerCase().includes(input.toLowerCase())),
                    }}
                    changeOnSelect
                    loading={categoriesLoading}
                    fieldNames={{ label: 'label', value: 'label', children: 'children' }}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="tags" label="Current Tags (optional)">
              <Select
                mode="tags"
                placeholder="Type a tag and press Enter"
                maxTagCount={13}
                tokenSeparators={[',']}
                size="large"
              />
            </Form.Item>

            <Button
              type="primary" htmlType="submit"
              icon={<ThunderboltOutlined />}
              loading={loading} size="large" block
              disabled={access.state === 'limit_reached'}
              style={{
                background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                border: 'none', borderRadius: radii.sm,
                fontWeight: 600, height: 52,
                boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
              }}
            >
              Analyze Listing
            </Button>
          </Form>
        </Card>
      </Col>

      <Col xs={24} lg={8}>
        {/* Tips */}
        <Card style={card} title={<><BulbOutlined style={{ color: colors.warning }} /> Pro Tips</>}>
          <Space direction="vertical" size={12} style={{ width: '100%' }}>
            {[
              'Use all 140 characters in your title',
              'Include buyer-trigger words: "Gift", "Handmade", "Premium"',
              'Add 13 tags — Etsy allows up to 13',
              'Mention shipping speed in your description',
              'Price 10-25% above competitors for premium positioning',
            ].map((tip, i) => (
              <div key={i} style={{ display: 'flex', gap: 8 }}>
                <CheckCircleOutlined style={{ color: colors.success, marginTop: 3 }} />
                <Text style={{ fontSize: 13 }}>{tip}</Text>
              </div>
            ))}
          </Space>
        </Card>

        {/* What you get */}
        <Card style={{ ...card, marginTop: 16 }} title={<><RocketOutlined style={{ color: colors.brand }} /> What You'll Get</>}>
          <Space direction="vertical" size={8} style={{ width: '100%' }}>
            {['Optimized title with buyer triggers', 'SEO-friendly description', '13 high-traffic tags', 'Pricing recommendation', 'Priority action items'].map((item, i) => (
              <Text key={i} style={{ fontSize: 13 }}>• {item}</Text>
            ))}
          </Space>
        </Card>
      </Col>
    </Row>
  );

  return (
    <AppLayout>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <SearchOutlined style={{ marginRight: 10, color: colors.brand }} />
            Listing Audit
          </Title>
          <Text type="secondary">Optimize your Etsy listing for maximum visibility and sales</Text>
        </div>
        {access.state === 'unlocked' && (
          <UsageBadge used={access.used} limit={access.unlimited ? null : access.limit} showLabel />
        )}
      </div>

      <QuotaBanner featureKey="listing_audit" featureName="Listing Audits" />

      <FeatureGate featureKey="listing_audit">
        {result ? <ResultsView /> : <AuditForm />}
      </FeatureGate>
    </AppLayout>
  );
};

export default ListingAuditPage;
