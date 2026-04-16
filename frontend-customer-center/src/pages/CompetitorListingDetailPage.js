import React, { useState, useEffect } from 'react';
import {
  Card, Typography, Tag, Row, Col, Statistic, Button, Space, Spin, message, theme,
} from 'antd';
import {
  ArrowLeftOutlined, EyeOutlined, HeartOutlined, DollarOutlined,
  TagOutlined, LinkOutlined, ShopOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import FeatureGate from '../components/common/FeatureGate';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;

const CompetitorListingDetailPage = () => {
  const { watchId, listingId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();

  const passedListing = location.state?.listing || null;
  const passedShopName = location.state?.shopName || '';

  const [listing, setListing] = useState(passedListing);
  const [shopName, setShopName] = useState(passedShopName);
  const [loading, setLoading] = useState(!passedListing);

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  useEffect(() => {
    if (passedListing) return;
    (async () => {
      try {
        const res = await etsyApi.getCompetitorDetail(watchId);
        const data = res.data || {};
        setShopName(data.shopName || '');
        const found = (data.topListings || []).find(l => String(l.listingId) === String(listingId));
        setListing(found || null);
      } catch {
        message.error('Failed to load listing details');
      } finally {
        setLoading(false);
      }
    })();
  }, [watchId, listingId, passedListing]);

  return (
    <AppLayout>
      <FeatureGate featureKey="competitor_detail_access">
        <div style={{ marginBottom: 20 }}>
          <Button
            type="link"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/competitors')}
            style={{ padding: 0, fontWeight: 600, color: colors.brand }}
          >
            Back to Shop Tracker
          </Button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
        ) : !listing ? (
          <Card style={card}>
            <div style={{ textAlign: 'center', padding: 40 }}>
              <Text type="secondary">Listing not found. It may have been removed from the competitor's shop.</Text>
            </div>
          </Card>
        ) : (
          <>
            {/* Header */}
            <div style={{ marginBottom: 20 }}>
              <Title level={3} style={{ margin: 0 }}>
                <ShopOutlined style={{ color: colors.brand, marginRight: 8 }} />
                {shopName || 'Competitor Listing'}
              </Title>
              <Text type="secondary">Listing Detail</Text>
            </div>

            {/* Stats Row */}
            <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
              <Col xs={12} md={6}>
                <Card style={card}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Price</Text>}
                    value={listing.price || 0}
                    prefix={<DollarOutlined style={{ color: colors.brand }} />}
                    precision={2}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card style={card}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Views</Text>}
                    value={listing.views || 0}
                    prefix={<EyeOutlined style={{ color: colors.success }} />}
                    formatter={v => Number(v).toLocaleString()}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card style={card}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Favorites</Text>}
                    value={listing.favorites || 0}
                    prefix={<HeartOutlined style={{ color: '#ff4d4f' }} />}
                    formatter={v => Number(v).toLocaleString()}
                  />
                </Card>
              </Col>
              <Col xs={12} md={6}>
                <Card style={card}>
                  <Statistic
                    title={<Text type="secondary" style={{ fontSize: 12 }}>Tags</Text>}
                    value={(listing.tags || []).length}
                    prefix={<TagOutlined style={{ color: '#faad14' }} />}
                  />
                </Card>
              </Col>
            </Row>

            {/* Listing Card */}
            <Card style={card}>
              <div style={{ marginBottom: 16 }}>
                <Title level={4} style={{ margin: '0 0 4px' }}>
                  {listing.title}
                </Title>
                <a
                  href={`https://www.etsy.com/listing/${listing.listingId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: colors.brand, fontSize: 13 }}
                >
                  View on Etsy <LinkOutlined style={{ fontSize: 11 }} />
                </a>
              </div>

              {/* Tags */}
              <div>
                <Text strong style={{ display: 'block', marginBottom: 8, fontSize: 13 }}>
                  <TagOutlined style={{ marginRight: 6 }} />
                  All Tags ({(listing.tags || []).length})
                </Text>
                <Space size={[6, 6]} wrap>
                  {(listing.tags || []).map((t, i) => (
                    <Tag
                      key={i}
                      style={{
                        fontSize: 12,
                        padding: '2px 10px',
                        borderRadius: radii.sm,
                      }}
                    >
                      {t}
                    </Tag>
                  ))}
                  {(!listing.tags || listing.tags.length === 0) && (
                    <Text type="secondary">No tags available</Text>
                  )}
                </Space>
              </div>
            </Card>
          </>
        )}
      </FeatureGate>
    </AppLayout>
  );
};

export default CompetitorListingDetailPage;
