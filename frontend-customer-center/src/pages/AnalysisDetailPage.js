import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Typography, Tag, Progress, Tabs, Space, Button,
  Collapse, List, Spin, message, theme,
} from 'antd';
import {
  ArrowLeftOutlined, CopyOutlined, FileTextOutlined, BulbOutlined,
  TagsOutlined, DollarOutlined, TrophyOutlined, CalendarOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import analysisApi from '../api/analysisApi';

const { Title, Text, Paragraph } = Typography;

const scoreColor = (score) => {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.danger;
};

const AnalysisDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  useEffect(() => {
    const fetch = async () => {
      try {
        const data = await analysisApi.getById(id);
        setAnalysis(data.analysis);
      } catch {
        message.error('Analysis not found');
        navigate('/history');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [id, navigate]);

  const copyText = (text) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  if (loading) return <AppLayout><div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div></AppLayout>;
  if (!analysis) return null;

  const rec = analysis.recommendations;
  const orig = analysis.originalListing;

  return (
    <AppLayout>
      <div style={{ marginBottom: 20 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/history')} style={{ marginBottom: 12 }}>
          Back to History
        </Button>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <Title level={3} style={{ margin: 0 }}>{orig.title}</Title>
            <Space>
              <Tag>{orig.category}</Tag>
              <Text type="secondary" style={{ fontSize: 13 }}>
                <CalendarOutlined /> {new Date(analysis.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </Text>
            </Space>
          </div>
        </div>
      </div>

      <Row gutter={[24, 24]}>
        <Col xs={24} md={8}>
          <Card style={card}>
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Progress
                type="dashboard"
                percent={analysis.score}
                strokeColor={scoreColor(analysis.score)}
                format={(pct) => (
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 800, color: scoreColor(analysis.score) }}>{pct}</div>
                    <div style={{ fontSize: 12, color: tok.colorTextSecondary }}>SEO Score</div>
                  </div>
                )}
                size={180}
                strokeWidth={8}
              />
              <div style={{ marginTop: 12 }}>
                <Tag
                  color={analysis.score >= 80 ? 'green' : analysis.score >= 60 ? 'gold' : 'red'}
                  style={{ fontSize: 13, padding: '2px 14px' }}
                >
                  {analysis.score >= 80 ? 'Excellent' : analysis.score >= 60 ? 'Good' : 'Needs Work'}
                </Tag>
              </div>
            </div>
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
                        {orig.title}
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
                              <Text type="secondary" style={{ fontSize: 12, marginTop: 4, display: 'block' }}>{t.reasoning}</Text>
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
                            <div style={{ fontSize: 22, fontWeight: 700 }}>${orig.price}</div>
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
                                <Tag color={item.priority === 'high' ? 'red' : item.priority === 'medium' ? 'gold' : 'blue'}
                                  style={{ textTransform: 'capitalize', fontSize: 11 }}>
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
    </AppLayout>
  );
};

export default AnalysisDetailPage;
