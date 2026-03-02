import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Button, Space, Spin, message, Tag, Timeline, Popconfirm, Row, Col, Result, Avatar, Typography, Statistic, Tooltip,
  Progress, Tabs, Drawer, Form, Select, Input, List, Table,
} from 'antd';
import {
  ArrowLeftOutlined, SwapOutlined, SyncOutlined, CheckCircleOutlined, StopOutlined,
  UserOutlined, MailOutlined, IdcardOutlined, SafetyOutlined, CalendarOutlined,
  EnvironmentOutlined, CheckCircleOutlined as VerifiedIcon, ClockCircleOutlined,
  BarChartOutlined, CrownOutlined, ExperimentOutlined, DownloadOutlined, GlobalOutlined,
  ThunderboltOutlined, PieChartOutlined, DollarOutlined, CreditCardOutlined,
  WalletOutlined, RiseOutlined, FileTextOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import PlanTag from '../../components/common/PlanTag';
import PermissionGuard from '../../components/guards/PermissionGuard';
import DateTimeRangePicker from '../../components/common/DateTimeRangePicker';
import customersApi from '../../api/customersApi';
import plansApi from '../../api/plansApi';
import { PERMISSIONS } from '../../utils/permissions';
import { formatDateTime, timeAgo, formatIPAddress } from '../../utils/helpers';

const { Title, Text } = Typography;

const CustomerDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [allActivity, setAllActivity] = useState([]);
  const [activity, setActivity] = useState([]);
  const [activityDateRange, setActivityDateRange] = useState(null);
  const [loginHistory, setLoginHistory] = useState([]);
  const [loginHistoryLoading, setLoginHistoryLoading] = useState(false);
  const [exportingActivity, setExportingActivity] = useState(false);
  const [error, setError] = useState(false);
  
  // Plan change
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [planForm] = Form.useForm();
  
  // Usage analytics
  const [usageAnalytics, setUsageAnalytics] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [featureUsage, setFeatureUsage] = useState([]);

  // Payment data
  const [paymentData, setPaymentData] = useState(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentPage, setPaymentPage] = useState(1);

  const fetchCustomer = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.getCustomer(id);
      setCustomer(data.customer);
      setAnalytics(data.analytics);
      setAllActivity(data.recentActivity || []);
      setActivity(data.recentActivity || []);
      // Store feature usage from API
      if (data.featureUsage) {
        setFeatureUsage(data.featureUsage);
      }
      setError(false);
    } catch {
      setError(true);
      message.error('Failed to load customer');
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchLoginHistory = useCallback(async () => {
    setLoginHistoryLoading(true);
    try {
      const data = await customersApi.getLoginHistory(id, 10);
      if (data.success) {
        setLoginHistory(data.loginHistory || []);
      }
    } catch (err) {
      console.error('Failed to fetch login history:', err);
    } finally {
      setLoginHistoryLoading(false);
    }
  }, [id]);

  const fetchUsageAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await customersApi.getUsageAnalytics(id);
      if (data.success) {
        setUsageAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Failed to fetch usage analytics:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [id]);

  const fetchPayments = useCallback(async (page = 1) => {
    setPaymentLoading(true);
    try {
      const data = await customersApi.getCustomerPayments(id, { page, limit: 10 });
      if (data.success) {
        setPaymentData(data);
      }
    } catch (err) {
      console.error('Failed to fetch payments:', err);
    } finally {
      setPaymentLoading(false);
    }
  }, [id]);

  const fetchPlans = useCallback(async () => {
    try {
      const data = await plansApi.getPlans({ limit: 100, isActive: 'true' });
      setAvailablePlans(data.plans || []);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    fetchCustomer();
    fetchLoginHistory();
    fetchUsageAnalytics();
    fetchPayments();
    fetchPlans();
  }, [fetchCustomer, fetchLoginHistory, fetchUsageAnalytics, fetchPayments, fetchPlans]);

  // Filter activity based on date range
  useEffect(() => {
    if (!activityDateRange || activityDateRange.length !== 2) {
      setActivity(allActivity);
      return;
    }

    const [start, end] = activityDateRange;
    const filtered = allActivity.filter((log) => {
      const logDate = new Date(log.createdAt);
      return logDate >= start.toDate() && logDate <= end.toDate();
    });
    setActivity(filtered);
  }, [activityDateRange, allActivity]);

  const handleAssignPlan = async (values) => {
    setPlanLoading(true);
    try {
      await customersApi.assignPlan(id, values.planId, values.reason);
      message.success('Plan assigned successfully');
      setPlanModalOpen(false);
      planForm.resetFields();
      fetchCustomer();
      fetchUsageAnalytics();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to assign plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleResetUsage = async () => {
    try {
      await customersApi.resetUsage(id);
      message.success('Usage reset successfully');
      fetchCustomer();
      fetchUsageAnalytics();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to reset usage');
    }
  };

  const handleVerifyEmail = async () => {
    try {
      await customersApi.verifyEmail(id);
      message.success('Email verified successfully');
      fetchCustomer();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to verify email');
    }
  };

  const handleSuspend = async () => {
    try {
      await customersApi.updateStatus(id, 'suspended');
      message.success('Customer suspended');
      fetchCustomer();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to suspend customer');
    }
  };

  const handleActivate = async () => {
    try {
      await customersApi.updateStatus(id, 'active');
      message.success('Customer activated');
      fetchCustomer();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to activate customer');
    }
  };

  const handleExportActivity = async () => {
    setExportingActivity(true);
    try {
      const params = { customerId: id };
      if (activityDateRange && activityDateRange.length === 2) {
        params.startDate = activityDateRange[0].toISOString();
        params.endDate = activityDateRange[1].toISOString();
      }
      await customersApi.exportCustomerActivity(params);
      message.success('Activity logs exported successfully');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to export activity');
    } finally {
      setExportingActivity(false);
    }
  };

  if (loading) return <Spin size="large" style={{ display: 'block', margin: '100px auto' }} />;
  if (error || !customer) return <Result status="error" title="Customer not found" extra={<Button onClick={() => navigate('/customers')}>Back to Customers</Button>} />;

  const getInitials = (name) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const planName = customer.planSnapshot?.planName || customer.currentPlanDetails?.name || customer.plan || 'None';
  const planPrice = customer.currentPlanDetails?.price?.monthly;
  const planFeatures = customer.planSnapshot?.features || [];
  const enabledFeatures = planFeatures.filter(f => f.enabled);
  const totalUsed = featureUsage.reduce((sum, f) => sum + (f.used || 0), 0);
  const totalLimit = featureUsage.reduce((sum, f) => sum + (f.limit || 0), 0);
  const overallUsagePercent = totalLimit > 0 ? Math.round((totalUsed / totalLimit) * 100) : 0;

  // Subscription status helpers
  const getSubscriptionLabel = () => {
    const status = customer.subscriptionStatus;
    if (status === 'trial') {
      const daysLeft = customer.trialEndsAt
        ? Math.max(0, Math.ceil((new Date(customer.trialEndsAt) - new Date()) / (1000 * 60 * 60 * 24)))
        : 0;
      return `Trial (${daysLeft} days left)`;
    }
    if (status === 'active') return 'Active';
    if (status === 'expired') return 'Expired';
    if (status === 'cancelled') return 'Cancelled';
    return 'No Subscription';
  };

  const getSubscriptionColor = () => {
    const status = customer.subscriptionStatus;
    if (status === 'active') return 'success';
    if (status === 'trial') return 'processing';
    if (status === 'expired') return 'error';
    if (status === 'cancelled') return 'warning';
    return 'default';
  };

  return (
    <div>
      <PageHeader
        title="Customer Details"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Customers', path: '/customers' }, { label: customer.name }]}
        extra={
          <Space>
            <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/customers')}>Back</Button>
            <PermissionGuard permission={PERMISSIONS.CUSTOMERS_PLANS}>
              <Button type="primary" icon={<SwapOutlined />} onClick={() => setPlanModalOpen(true)}>Change Plan</Button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
              <Popconfirm title="Reset monthly usage?" onConfirm={handleResetUsage}>
                <Button icon={<SyncOutlined />}>Reset Usage</Button>
              </Popconfirm>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.CUSTOMERS_VERIFY}>
              {!customer.isEmailVerified && (
                <Popconfirm title="Verify email manually?" onConfirm={handleVerifyEmail}>
                  <Button icon={<CheckCircleOutlined />}>Verify Email</Button>
                </Popconfirm>
              )}
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
              {customer.status === 'active' && (
                <Popconfirm title="Suspend this customer?" onConfirm={handleSuspend}>
                  <Button icon={<StopOutlined />} danger>Suspend</Button>
                </Popconfirm>
              )}
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
              {customer.status === 'suspended' && (
                <Popconfirm title="Activate this customer?" onConfirm={handleActivate}>
                  <Button icon={<CheckCircleOutlined />} type="primary" style={{ background: '#52c41a', borderColor: '#52c41a' }}>Activate</Button>
                </Popconfirm>
              )}
            </PermissionGuard>
          </Space>
        }
      />

      {/* Profile Header Card */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={24} align="middle">
          <Col>
            <Avatar 
              size={80} 
              style={{ backgroundColor: '#7C3AED', fontSize: 32 }}
              icon={<UserOutlined />}
            >
              {getInitials(customer.name)}
            </Avatar>
          </Col>
          <Col flex="auto">
            <Title level={3} style={{ marginBottom: 4 }}>{customer.name}</Title>
            <Space size={16} wrap>
              <Space>
                <MailOutlined style={{ color: '#8c8c8c' }} />
                <Text>{customer.email}</Text>
              </Space>
              <Space>
                <IdcardOutlined style={{ color: '#8c8c8c' }} />
                <Text>Customer Account</Text>
              </Space>
            </Space>
            <div style={{ marginTop: 12 }}>
              <Space size={8}>
                <StatusTag status={customer.status} />
                <PlanTag plan={planName} />
                {customer.isEmailVerified && <Tag icon={<VerifiedIcon />} color="success">Email Verified</Tag>}
                <Tag color={getSubscriptionColor()}>
                  {getSubscriptionLabel()}
                </Tag>
              </Space>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {/* Left Column - Information Cards */}
        <Col xs={24} lg={16}>
          {/* Account Details */}
          <Card title={<Space><SafetyOutlined />Account Details</Space>} style={{ marginBottom: 16 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>SUBSCRIPTION PLAN</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space>
                      <CrownOutlined style={{ color: '#7C3AED' }} />
                      <Text strong>{planName}</Text>
                      {planPrice !== undefined && planPrice !== null && (
                        <Tag color="purple">${planPrice}/mo</Tag>
                      )}
                    </Space>
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>SUBSCRIPTION STATUS</Text>
                  <div style={{ marginTop: 4 }}>
                    <Tag color={getSubscriptionColor()}>
                      {getSubscriptionLabel()}
                    </Tag>
                  </div>
                </div>
                {customer.trialEndsAt && customer.subscriptionStatus === 'trial' && (
                  <div style={{ marginBottom: 16 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>TRIAL EXPIRES</Text>
                    <div style={{ marginTop: 4 }}>
                      <Text strong>{formatDateTime(customer.trialEndsAt)}</Text>
                    </div>
                  </div>
                )}
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>EMAIL VERIFIED</Text>
                  <div style={{ marginTop: 4 }}>
                    {customer.isEmailVerified ? (
                      <Tag icon={<CheckCircleOutlined />} color="success">Verified</Tag>
                    ) : (
                      <Tag color="error">Not Verified</Tag>
                    )}
                  </div>
                </div>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>ACCOUNT STATUS</Text>
                  <div style={{ marginTop: 4 }}>
                    <StatusTag status={customer.status} />
                  </div>
                </div>
              </Col>
            </Row>
            {customer.planSnapshot?.assignedAt && (
              <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
                <Space direction="vertical" size={4} style={{ width: '100%' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    Plan assigned: {formatDateTime(customer.planSnapshot.assignedAt)}
                  </Text>
                  {customer.subscriptionStartDate && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Subscription started: {formatDateTime(customer.subscriptionStartDate)}
                    </Text>
                  )}
                  {customer.subscriptionExpiresAt && (
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      Expires: {formatDateTime(customer.subscriptionExpiresAt)}
                    </Text>
                  )}
                </Space>
              </div>
            )}
          </Card>

          {/* Billing Summary */}
          <Card 
            title={<Space><DollarOutlined style={{ color: '#52c41a' }} />Billing Summary</Space>} 
            style={{ marginBottom: 16 }}
            loading={paymentLoading}
          >
            {paymentData?.stats ? (
              <>
                <Row gutter={[16, 16]}>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Total Spent" 
                      value={paymentData.stats.totalSpent} 
                      prefix="$" 
                      valueStyle={{ color: '#3f8600', fontWeight: 600 }} 
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Payments" 
                      value={paymentData.stats.totalPayments} 
                      valueStyle={{ color: '#1890ff' }} 
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Avg Payment" 
                      value={paymentData.stats.avgPaymentAmount} 
                      prefix="$" 
                      precision={2}
                      valueStyle={{ color: '#722ed1' }} 
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Net Revenue" 
                      value={paymentData.stats.netRevenue} 
                      prefix="$" 
                      valueStyle={{ color: '#3f8600' }} 
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Refunds" 
                      value={paymentData.stats.totalRefunded} 
                      prefix="$" 
                      valueStyle={{ color: paymentData.stats.totalRefunded > 0 ? '#cf1322' : '#8c8c8c' }} 
                    />
                  </Col>
                  <Col xs={12} sm={8}>
                    <Statistic 
                      title="Failed" 
                      value={paymentData.stats.failedPayments} 
                      valueStyle={{ color: paymentData.stats.failedPayments > 0 ? '#cf1322' : '#8c8c8c' }} 
                    />
                  </Col>
                </Row>
                {paymentData.stats.lastPaymentDate && (
                  <div style={{ marginTop: 16, padding: 10, background: '#f6ffed', borderRadius: 6, border: '1px solid #b7eb8f' }}>
                    <Space>
                      <CalendarOutlined style={{ color: '#52c41a' }} />
                      <Text type="secondary" style={{ fontSize: 12 }}>
                        Last payment: {formatDateTime(paymentData.stats.lastPaymentDate)}
                      </Text>
                      {paymentData.stats.firstPaymentDate && (
                        <Text type="secondary" style={{ fontSize: 12 }}>
                          &nbsp;|&nbsp; First payment: {formatDateTime(paymentData.stats.firstPaymentDate)}
                        </Text>
                      )}
                    </Space>
                  </div>
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '30px 0', color: '#8c8c8c' }}>
                <DollarOutlined style={{ fontSize: 40, color: '#d9d9d9', marginBottom: 12 }} />
                <div>No payment records yet</div>
              </div>
            )}
          </Card>

          {/* Feature Usage Statistics */}
          <Card title={<Space><BarChartOutlined />Feature Usage</Space>} style={{ marginBottom: 16 }}>
            {featureUsage.length > 0 ? (
              <>
                {featureUsage.map((f, idx) => (
                  <div key={idx} style={{ marginBottom: 20 }}>
                    <Row justify="space-between" align="middle" style={{ marginBottom: 4 }}>
                      <Col>
                        <Text strong>{f.featureName}</Text>
                        <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>({f.featureKey})</Text>
                      </Col>
                      <Col>
                        <Text style={{ color: f.percentage >= 90 ? '#cf1322' : f.percentage >= 70 ? '#fa8c16' : '#3f8600' }}>
                          {f.used}{f.limit !== null ? ` / ${f.limit}` : ' (unlimited)'}
                        </Text>
                      </Col>
                    </Row>
                    {f.limit !== null && (
                      <Progress 
                        percent={f.percentage} 
                        status={f.percentage >= 100 ? 'exception' : f.percentage >= 90 ? 'exception' : 'active'}
                        strokeColor={f.percentage >= 90 ? '#cf1322' : f.percentage >= 70 ? '#fa8c16' : '#1890ff'}
                        size="small"
                      />
                    )}
                  </div>
                ))}
                <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 16, marginTop: 8 }}>
                  <Row gutter={16}>
                    <Col xs={8}>
                      <Statistic title="Total Used" value={totalUsed} valueStyle={{ color: '#1890ff' }} />
                    </Col>
                    <Col xs={8}>
                      <Statistic 
                        title="Overall Usage" 
                        value={overallUsagePercent} 
                        suffix="%" 
                        valueStyle={{ color: overallUsagePercent > 80 ? '#cf1322' : '#1890ff' }} 
                      />
                    </Col>
                    <Col xs={8}>
                      <Statistic title="Features" value={enabledFeatures.length} suffix="enabled" valueStyle={{ color: '#8c8c8c' }} />
                    </Col>
                  </Row>
                </div>
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <BarChartOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div>{enabledFeatures.length > 0 ? 'No feature usage recorded yet' : 'No features enabled on current plan'}</div>
              </div>
            )}
            {customer.monthlyResetDate && (
              <div style={{ marginTop: 12, color: '#8c8c8c', fontSize: 12 }}>
                Usage resets on: {formatDateTime(customer.monthlyResetDate)}
              </div>
            )}
          </Card>

          {/* Activity Information */}
          <Card title={<Space><ClockCircleOutlined />Activity Information</Space>} style={{ marginBottom: 16 }}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>LAST LOGIN</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space>
                      <CalendarOutlined style={{ color: '#1890ff' }} />
                      <Text strong>{customer.lastLogin ? formatDateTime(customer.lastLogin) : 'Never'}</Text>
                    </Space>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>CREATED</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space>
                      <CalendarOutlined style={{ color: '#8c8c8c' }} />
                      <Text>{formatDateTime(customer.createdAt)}</Text>
                    </Space>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={12}>
                <div style={{ marginBottom: 16 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>LAST LOGIN IP</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space>
                      <EnvironmentOutlined style={{ color: '#1890ff' }} />
                      <Text strong>{formatIPAddress(customer.lastLoginIP)}</Text>
                    </Space>
                  </div>
                </div>
                <div>
                  <Text type="secondary" style={{ fontSize: 12 }}>LAST UPDATED</Text>
                  <div style={{ marginTop: 4 }}>
                    <Space>
                      <CalendarOutlined style={{ color: '#8c8c8c' }} />
                      <Text>{formatDateTime(customer.updatedAt)}</Text>
                    </Space>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>

          {/* Plan Features */}
          {enabledFeatures.length > 0 && (
            <Card title={<Space><ExperimentOutlined />Plan Features ({enabledFeatures.length})</Space>} style={{ marginBottom: 16 }}>
              <Space wrap>
                {enabledFeatures.map((f, idx) => (
                  <Tag key={idx} color="green" style={{ marginBottom: 8 }}>
                    ✓ {f.featureName}
                    {f.limit !== null && f.limit !== undefined && f.limit < 999999 && ` (${f.limit})`}
                  </Tag>
                ))}
              </Space>
            </Card>
          )}

          {/* Usage & Payment Analytics */}
          <Card title={<Space><BarChartOutlined />Usage & Payment Analytics</Space>} loading={analyticsLoading}>
              <Tabs defaultActiveKey={usageAnalytics ? "1" : "5"}>
                <Tabs.TabPane tab="Feature Usage" key="1">
                  {usageAnalytics?.featureUsageDetails && usageAnalytics.featureUsageDetails.length > 0 ? (
                    <List
                      dataSource={usageAnalytics.featureUsageDetails}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta
                            title={item.featureName}
                            description={
                              <Space direction="vertical" size={0}>
                                <Text type="secondary" style={{ fontSize: 12 }}>{item.featureKey}</Text>
                                {item.limit !== null && (
                                  <Progress 
                                    percent={item.percentage} 
                                    size="small" 
                                    status={item.percentage >= 100 ? 'exception' : 'active'}
                                    style={{ width: 200 }}
                                  />
                                )}
                              </Space>
                            }
                          />
                          <div style={{ textAlign: 'right' }}>
                            <Statistic 
                              value={item.used} 
                              suffix={item.limit !== null ? `/ ${item.limit}` : '(unlimited)'} 
                              valueStyle={{ fontSize: 16 }}
                            />
                            {item.lastUsed && (
                              <Text type="secondary" style={{ fontSize: 11 }}>Last: {timeAgo(item.lastUsed)}</Text>
                            )}
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                      <PieChartOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No feature usage data available</div>
                    </div>
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab="Monthly Trend" key="2">
                  {usageAnalytics?.usageByMonth && usageAnalytics.usageByMonth.length > 0 ? (
                    <List
                      dataSource={usageAnalytics.usageByMonth}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta title={item.month} />
                          <div>
                            <Statistic value={item.count} suffix="feature uses" />
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                      <BarChartOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No monthly data available</div>
                    </div>
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab="Activity Types" key="3">
                  {usageAnalytics?.activityByType && usageAnalytics.activityByType.length > 0 ? (
                    <List
                      dataSource={usageAnalytics.activityByType}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta title={item.type || 'Unknown'} />
                          <div>
                            <Statistic value={item.count} suffix="actions" />
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                      <PieChartOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No activity data available</div>
                    </div>
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab="Usage Actions" key="4">
                  {usageAnalytics?.usageByAction && usageAnalytics.usageByAction.length > 0 ? (
                    <List
                      dataSource={usageAnalytics.usageByAction}
                      renderItem={(item) => (
                        <List.Item>
                          <List.Item.Meta 
                            title={
                              <Tag color={
                                item.action === 'used' ? 'green' : 
                                item.action === 'limit_reached' ? 'orange' : 
                                item.action === 'exceeded' ? 'red' : 'blue'
                              }>
                                {item.action}
                              </Tag>
                            } 
                          />
                          <div>
                            <Statistic value={item.count} suffix="times" />
                          </div>
                        </List.Item>
                      )}
                    />
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                      <PieChartOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No usage action data available</div>
                    </div>
                  )}
                </Tabs.TabPane>
                <Tabs.TabPane tab={<span><DollarOutlined style={{ marginRight: 4 }} />Payment History</span>} key="5">
                  {paymentData && paymentData.payments && paymentData.payments.length > 0 ? (
                    <>
                      <Table
                        dataSource={paymentData.payments}
                        rowKey={(r) => r.id}
                        size="small"
                        pagination={{
                          current: paymentPage,
                          pageSize: 10,
                          total: paymentData.pagination?.totalCount || 0,
                          onChange: (pg) => { setPaymentPage(pg); fetchPayments(pg); },
                          showSizeChanger: false,
                          showTotal: (total) => `${total} payments`,
                        }}
                        columns={[
                          {
                            title: 'Date',
                            dataIndex: 'paidAt',
                            key: 'date',
                            width: 150,
                            render: (val, record) => (
                              <Space direction="vertical" size={0}>
                                <Text style={{ fontSize: 13 }}>{formatDateTime(val || record.createdAt)}</Text>
                                <Text type="secondary" style={{ fontSize: 11 }}>{timeAgo(val || record.createdAt)}</Text>
                              </Space>
                            ),
                          },
                          {
                            title: 'Amount',
                            dataIndex: 'amount',
                            key: 'amount',
                            width: 100,
                            render: (val, record) => (
                              <Text strong style={{ color: '#3f8600', fontSize: 14 }}>
                                ${val?.toFixed(2)} <Text type="secondary" style={{ fontSize: 11 }}>{record.currency?.toUpperCase()}</Text>
                              </Text>
                            ),
                          },
                          {
                            title: 'Plan',
                            dataIndex: 'planName',
                            key: 'plan',
                            width: 100,
                            render: (val) => val ? <Tag color="purple">{val}</Tag> : <Text type="secondary">—</Text>,
                          },
                          {
                            title: 'Cycle',
                            dataIndex: 'billingCycle',
                            key: 'cycle',
                            width: 90,
                            render: (val) => (
                              <Tag color={val === 'yearly' ? 'gold' : val === 'monthly' ? 'blue' : 'default'}>
                                {val || 'N/A'}
                              </Tag>
                            ),
                          },
                          {
                            title: 'Status',
                            dataIndex: 'status',
                            key: 'status',
                            width: 100,
                            render: (val) => {
                              const colorMap = { succeeded: 'success', pending: 'processing', failed: 'error', refunded: 'warning', cancelled: 'default' };
                              return <Tag color={colorMap[val] || 'default'}>{val}</Tag>;
                            },
                          },
                          {
                            title: 'Actions',
                            key: 'actions',
                            width: 100,
                            render: (_, record) => (
                              <Space size={4}>
                                {record.receiptUrl && (
                                  <Tooltip title="View Receipt">
                                    <Button type="link" size="small" icon={<FileTextOutlined />} href={record.receiptUrl} target="_blank" />
                                  </Tooltip>
                                )}
                                {record.invoiceUrl && (
                                  <Tooltip title="View Invoice">
                                    <Button type="link" size="small" icon={<DownloadOutlined />} href={record.invoiceUrl} target="_blank" />
                                  </Tooltip>
                                )}
                              </Space>
                            ),
                          },
                        ]}
                      />
                      {paymentData.billingBreakdown && paymentData.billingBreakdown.length > 0 && (
                        <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                            <CreditCardOutlined style={{ marginRight: 6 }} />Billing Cycle Breakdown
                          </Text>
                          <Row gutter={16}>
                            {paymentData.billingBreakdown.map((b) => (
                              <Col key={b.cycle} xs={8}>
                                <Statistic
                                  title={b.cycle.charAt(0).toUpperCase() + b.cycle.slice(1)}
                                  value={b.total}
                                  prefix="$"
                                  suffix={<Text type="secondary" style={{ fontSize: 11 }}>({b.count}×)</Text>}
                                  valueStyle={{ fontSize: 16 }}
                                />
                              </Col>
                            ))}
                          </Row>
                        </div>
                      )}
                      {paymentData.monthlyTrend && paymentData.monthlyTrend.length > 0 && (
                        <div style={{ marginTop: 16, padding: 12, background: '#fafafa', borderRadius: 6 }}>
                          <Text strong style={{ fontSize: 13, marginBottom: 8, display: 'block' }}>
                            <RiseOutlined style={{ marginRight: 6 }} />Monthly Spending Trend
                          </Text>
                          <List
                            size="small"
                            dataSource={paymentData.monthlyTrend}
                            renderItem={(item) => (
                              <List.Item>
                                <List.Item.Meta title={item.month} />
                                <Space>
                                  <Text strong style={{ color: '#3f8600' }}>${item.amount.toFixed(2)}</Text>
                                  <Text type="secondary" style={{ fontSize: 11 }}>({item.count} payment{item.count > 1 ? 's' : ''})</Text>
                                </Space>
                              </List.Item>
                            )}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div style={{ padding: '40px 0', textAlign: 'center', color: '#8c8c8c' }}>
                      <WalletOutlined style={{ fontSize: 48, marginBottom: 16, color: '#d9d9d9' }} />
                      <div>No payment records found</div>
                    </div>
                  )}
                </Tabs.TabPane>
              </Tabs>
            </Card>
        </Col>

        {/* Right Column - Activity Timeline */}
        <Col xs={24} lg={8}>
          <Card 
            title="Recent Activity"
            extra={
              <Button 
                icon={<DownloadOutlined />} 
                onClick={handleExportActivity}
                loading={exportingActivity}
                size="small"
              >
                Export
              </Button>
            }
            style={{ position: 'sticky', top: 16, marginBottom: 16 }}
          >
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>FILTER BY DATE RANGE</Text>
              <DateTimeRangePicker
                value={activityDateRange}
                onChange={setActivityDateRange}
                placeholder={['Start Date & Time', 'End Date & Time']}
                use24HourFormat={false}
              />
            </Space>
            
            {activity.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <ClockCircleOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div style={{ color: '#8c8c8c' }}>No recent activity</div>
              </div>
            ) : (
              <Timeline
                items={activity.map((a) => ({
                  color: a.status === 'success' ? 'green' : a.status === 'failed' ? 'red' : 'gray',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500 }}>{a.action}</div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>{a.description}</div>
                      {a.ipAddress && (
                        <div style={{ fontSize: 11, color: '#1890ff', marginTop: 2 }}>
                          <GlobalOutlined style={{ marginRight: 4 }} />
                          {formatIPAddress(a.ipAddress)}
                        </div>
                      )}
                      <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>{timeAgo(a.createdAt)}</div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Login History */}
          <Card 
            title={<Space><GlobalOutlined />Login History</Space>} 
            loading={loginHistoryLoading}
            style={{ position: 'sticky', top: 16 }}
          >
            {loginHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <GlobalOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div style={{ color: '#8c8c8c' }}>No login history available</div>
              </div>
            ) : (
              <Timeline
                items={loginHistory.map((login) => ({
                  color: login.status === 'success' ? 'green' : 'red',
                  children: (
                    <div>
                      <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <GlobalOutlined style={{ color: '#1890ff' }} />
                        {formatIPAddress(login.ipAddress)}
                      </div>
                      <div style={{ fontSize: 12, color: '#8c8c8c', marginTop: 4 }}>
                        {login.description || 'Customer login'}
                      </div>
                      <div style={{ fontSize: 11, color: '#bfbfbf', marginTop: 2 }}>
                        {formatDateTime(login.createdAt)}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>
        </Col>
      </Row>

      {/* Change Plan Modal */}
      <Drawer
        title="Change Subscription Plan"
        open={planModalOpen}
        onClose={() => {
          setPlanModalOpen(false);
          planForm.resetFields();
        }}
        width={500}
        footer={
          <Space style={{ float: 'right' }}>
            <Button onClick={() => setPlanModalOpen(false)}>Cancel</Button>
            <Button type="primary" loading={planLoading} onClick={() => planForm.submit()} icon={<ThunderboltOutlined />}>
              Change Plan
            </Button>
          </Space>
        }
      >
        <Form form={planForm} layout="vertical" onFinish={handleAssignPlan}>
          <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
            <Text strong>{customer.name}</Text>
            <div style={{ fontSize: 12, color: '#8c8c8c' }}>{customer.email}</div>
            <div style={{ marginTop: 8 }}>
              Current Plan: <Tag color="purple">{planName}</Tag>
            </div>
          </div>
          
          <Form.Item
            name="planId"
            label="Select New Plan"
            rules={[{ required: true, message: 'Please select a plan' }]}
          >
            <Select
              placeholder="Choose a plan..."
              size="large"
              options={availablePlans.map((p) => ({
                value: p._id,
                label: `${p.name} — $${p.price?.monthly || 0}/mo (${(p.features || []).filter(f => f.enabled).length} features)`,
              }))}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea rows={3} placeholder="Reason for plan change..." />
          </Form.Item>
        </Form>
      </Drawer>
    </div>
  );
};

export default CustomerDetailPage;
