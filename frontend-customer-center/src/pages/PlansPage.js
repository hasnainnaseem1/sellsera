import React, { useEffect, useState } from 'react';
import {
  Card, Row, Col, Typography, Button, Tag, Space, Spin, Switch,
  List, theme, Badge, message
} from 'antd';
import {
  CrownOutlined, CheckCircleOutlined, CloseCircleOutlined,
  ArrowRightOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import plansApi from '../api/plansApi';
import billingApi from '../api/billingApi';

const { Title, Text, Paragraph } = Typography;
const BRAND = '#6C63FF';

const PlansPage = () => {
  const { token } = useAuth();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => {
    loadPlans();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = token
        ? await plansApi.getPlans()
        : await plansApi.getPublicPlans();
      setPlans(data.plans || []);
    } catch {
      message.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectPlan = async (plan) => {
    if (plan.isCurrent) return;
    if (plan.price?.monthly === 0 && plan.price?.yearly === 0) {
      message.info('You are already on the free plan or it requires no payment.');
      return;
    }
    try {
      setCheckoutLoading(plan._id);
      const data = await billingApi.createCheckout({
        planId: plan._id,
        billingCycle,
      });
      if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        message.error(data.message || 'Failed to start checkout');
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Checkout error');
    } finally {
      setCheckoutLoading(null);
    }
  };

  const card = {
    border: `1px solid ${isDark ? '#2e2e4a' : '#ebebf8'}`,
    borderRadius: 16,
    background: tok.colorBgContainer,
    boxShadow: isDark ? 'none' : '0 2px 12px rgba(108,99,255,0.06)',
  };

  const getPrice = (plan) => {
    if (!plan.price) return 0;
    return billingCycle === 'yearly'
      ? (plan.price.yearly || 0)
      : (plan.price.monthly || 0);
  };

  if (loading) {
    return (
      <AppLayout>
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin size="large" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Title level={2} style={{ margin: 0 }}>
            <CrownOutlined style={{ color: BRAND, marginRight: 10 }} />
            Choose Your Plan
          </Title>
          <Paragraph type="secondary" style={{ fontSize: 16, marginTop: 8 }}>
            Pick the plan that fits your needs. Upgrade or downgrade anytime.
          </Paragraph>

          {/* Billing toggle */}
          <Space style={{ marginTop: 16 }}>
            <Text strong style={{ color: billingCycle === 'monthly' ? BRAND : undefined }}>
              Monthly
            </Text>
            <Switch
              checked={billingCycle === 'yearly'}
              onChange={(checked) => setBillingCycle(checked ? 'yearly' : 'monthly')}
            />
            <Text strong style={{ color: billingCycle === 'yearly' ? BRAND : undefined }}>
              Yearly
            </Text>
            {billingCycle === 'yearly' && (
              <Tag color="green" style={{ marginLeft: 4 }}>Save with annual billing</Tag>
            )}
          </Space>
        </div>

        {/* Plan Cards */}
        <Row gutter={[20, 20]} justify="center">
          {plans.map((plan) => {
            const price = getPrice(plan);
            const isCurrent = plan.isCurrent;
            const isFree = price === 0;
            const isPopular = plan.isPopular || plan.name.toLowerCase() === 'pro';

            return (
              <Col xs={24} sm={12} lg={6} key={plan._id}>
                <Badge.Ribbon
                  text="Popular"
                  color={BRAND}
                  style={{ display: isPopular ? 'block' : 'none' }}
                >
                  <Card
                    hoverable={!isCurrent}
                    style={{
                      ...card,
                      ...(isCurrent ? { borderColor: BRAND, borderWidth: 2 } : {}),
                      ...(isPopular ? {
                        background: `linear-gradient(135deg, ${BRAND} 0%, #4facfe 100%)`,
                      } : {}),
                      height: '100%',
                    }}
                    styles={{ body: { padding: '28px 24px', display: 'flex', flexDirection: 'column', height: '100%' } }}
                  >
                    {/* Plan name */}
                    <div style={{ marginBottom: 16 }}>
                      <Title level={4} style={{
                        margin: 0,
                        color: isPopular ? '#fff' : undefined,
                      }}>
                        {plan.name}
                      </Title>
                      {plan.description && (
                        <Text style={{
                          fontSize: 13,
                          color: isPopular ? 'rgba(255,255,255,0.8)' : undefined,
                        }} type={!isPopular ? 'secondary' : undefined}>
                          {plan.description}
                        </Text>
                      )}
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom: 20 }}>
                      <span style={{
                        fontSize: 42,
                        fontWeight: 900,
                        color: isPopular ? '#fff' : tok.colorText,
                        lineHeight: 1,
                      }}>
                        ${price}
                      </span>
                      {!isFree && (
                        <Text style={{
                          fontSize: 16,
                          color: isPopular ? 'rgba(255,255,255,0.7)' : undefined,
                        }} type={!isPopular ? 'secondary' : undefined}>
                          /{billingCycle === 'yearly' ? 'year' : 'mo'}
                        </Text>
                      )}
                    </div>

                    {/* Trial info */}
                    {plan.trialDays > 0 && !isCurrent && (
                      <Tag color="blue" style={{ marginBottom: 12, alignSelf: 'flex-start' }}>
                        {plan.trialDays}-day free trial
                      </Tag>
                    )}

                    {/* Features */}
                    <div style={{ flex: 1, marginBottom: 20 }}>
                      <List
                        size="small"
                        dataSource={plan.features || []}
                        renderItem={(f) => (
                          <List.Item style={{
                            padding: '6px 0',
                            border: 'none',
                            color: isPopular ? '#fff' : undefined,
                          }}>
                            {f.enabled ? (
                              <CheckCircleOutlined style={{
                                color: isPopular ? '#ffd666' : '#52c41a',
                                marginRight: 8,
                              }} />
                            ) : (
                              <CloseCircleOutlined style={{
                                color: isPopular ? 'rgba(255,255,255,0.35)' : '#d9d9d9',
                                marginRight: 8,
                              }} />
                            )}
                            <Text style={{
                              color: isPopular
                                ? (f.enabled ? '#fff' : 'rgba(255,255,255,0.4)')
                                : (f.enabled ? undefined : tok.colorTextDisabled),
                              fontSize: 13,
                            }}>
                              {f.featureName}
                              {f.limit !== null && f.limit !== undefined && f.enabled && (
                                <Text style={{
                                  fontSize: 11,
                                  color: isPopular ? 'rgba(255,255,255,0.7)' : undefined,
                                }} type={!isPopular ? 'secondary' : undefined}>
                                  {' '}({f.limit === -1 ? 'Unlimited' : f.limit})
                                </Text>
                              )}
                            </Text>
                          </List.Item>
                        )}
                      />
                    </div>

                    {/* CTA */}
                    <Button
                      type={isCurrent ? 'default' : 'primary'}
                      block
                      size="large"
                      disabled={isCurrent}
                      loading={checkoutLoading === plan._id}
                      onClick={() => handleSelectPlan(plan)}
                      icon={isCurrent ? <CheckCircleOutlined /> : <ArrowRightOutlined />}
                      style={{
                        fontWeight: 700,
                        height: 46,
                        borderRadius: 10,
                        ...(isPopular && !isCurrent ? {
                          background: '#fff',
                          color: BRAND,
                          border: 'none',
                        } : {}),
                        ...(isCurrent ? { borderColor: BRAND, color: BRAND } : {}),
                      }}
                    >
                      {isCurrent ? 'Current Plan' : isFree ? 'Get Started' : 'Select Plan'}
                    </Button>
                  </Card>
                </Badge.Ribbon>
              </Col>
            );
          })}
        </Row>
      </div>
    </AppLayout>
  );
};

export default PlansPage;
