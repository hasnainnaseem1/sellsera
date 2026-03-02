import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Select,
  Switch,
  Button,
  Space,
  Row,
  Col,
  Spin,
  Result,
  Divider,
  Table,
  Tag,
  message,
  Typography,
  Tooltip,
} from 'antd';
import {
  SaveOutlined,
  ArrowLeftOutlined,
  CrownOutlined,
  QuestionCircleOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import plansApi from '../../api/plansApi';

const { TextArea } = Input;
const { Text } = Typography;

const PlanFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const isEditing = Boolean(id);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notFound, setNotFound] = useState(false);

  // Available features from backend
  const [availableFeatures, setAvailableFeatures] = useState([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);

  // Feature configuration for the plan (keyed by featureId)
  const [featureConfig, setFeatureConfig] = useState({});

  // Load available features
  const fetchFeatures = useCallback(async () => {
    setFeaturesLoading(true);
    try {
      const data = await plansApi.getFeatures({ isActive: 'true' });
      setAvailableFeatures(data.features || []);
    } catch {
      message.error('Failed to load features');
    } finally {
      setFeaturesLoading(false);
    }
  }, []);

  // Load plan data if editing
  const fetchPlan = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await plansApi.getPlan(id);
      const plan = data.plan;

      form.setFieldsValue({
        name: plan.name,
        description: plan.description,
        priceMonthly: plan.price?.monthly || 0,
        priceYearly: plan.price?.yearly || 0,
        currency: plan.currency || 'USD',
        billingCycle: plan.billingCycle || 'both',
        isDefault: plan.isDefault || false,
        displayOrder: plan.displayOrder || 0,
        trialDays: plan.trialDays || 0,
        lsMonthlyVariantId: plan.metadata?.lemonSqueezy?.monthlyVariantId || '',
        lsYearlyVariantId: plan.metadata?.lemonSqueezy?.yearlyVariantId || '',
        lsProductId: plan.metadata?.lemonSqueezy?.productId || '',
      });

      // Build feature config from plan features
      const config = {};
      (plan.features || []).forEach((f) => {
        config[f.featureId] = {
          enabled: f.enabled,
          limit: f.limit,
          value: f.value,
        };
      });
      setFeatureConfig(config);
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        message.error('Failed to load plan');
      }
    } finally {
      setLoading(false);
    }
  }, [id, form]);

  useEffect(() => {
    fetchFeatures();
    if (isEditing) {
      fetchPlan();
    }
  }, [fetchFeatures, fetchPlan, isEditing]);

  // Toggle a feature on/off for this plan
  const handleToggleFeature = (featureId, checked) => {
    setFeatureConfig((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        enabled: checked,
        limit: prev[featureId]?.limit ?? null,
        value: prev[featureId]?.value ?? null,
      },
    }));
  };

  // Update feature limit
  const handleLimitChange = (featureId, limit) => {
    setFeatureConfig((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        limit,
      },
    }));
  };

  // Update feature value
  const handleValueChange = (featureId, value) => {
    setFeatureConfig((prev) => ({
      ...prev,
      [featureId]: {
        ...prev[featureId],
        value,
      },
    }));
  };

  // Submit the form
  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      // Build features array from config
      const features = Object.entries(featureConfig)
        .filter(([, config]) => config.enabled)
        .map(([featureId, config]) => ({
          featureId,
          enabled: true,
          limit: config.limit,
          value: config.value,
        }));

      // Also include disabled features that were explicitly toggled off
      availableFeatures.forEach((f) => {
        const fId = f._id;
        if (featureConfig[fId] && !featureConfig[fId].enabled) {
          features.push({
            featureId: fId,
            enabled: false,
            limit: null,
            value: null,
          });
        }
      });

      // Build LemonSqueezy metadata
      const lemonSqueezyMeta = {};
      if (values.lsMonthlyVariantId) lemonSqueezyMeta.monthlyVariantId = values.lsMonthlyVariantId.trim();
      if (values.lsYearlyVariantId) lemonSqueezyMeta.yearlyVariantId = values.lsYearlyVariantId.trim();
      if (values.lsProductId) lemonSqueezyMeta.productId = values.lsProductId.trim();

      const payload = {
        name: values.name,
        description: values.description || '',
        price: {
          monthly: values.priceMonthly || 0,
          yearly: values.priceYearly || 0,
        },
        currency: values.currency || 'USD',
        billingCycle: values.billingCycle || 'both',
        isDefault: values.isDefault || false,
        displayOrder: values.displayOrder || 0,
        trialDays: values.trialDays || 0,
        features,
        metadata: {
          lemonSqueezy: Object.keys(lemonSqueezyMeta).length > 0 ? lemonSqueezyMeta : undefined,
        },
      };

      if (isEditing) {
        await plansApi.updatePlan(id, payload);
        message.success('Plan updated successfully');
      } else {
        await plansApi.createPlan(payload);
        message.success('Plan created successfully');
      }

      navigate('/plans');
    } catch (err) {
      const msg = err?.response?.data?.message || `Failed to ${isEditing ? 'update' : 'create'} plan`;
      message.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (notFound) {
    return (
      <Result
        status="404"
        title="Plan Not Found"
        extra={
          <Button type="primary" onClick={() => navigate('/plans')}>
            Back to Plans
          </Button>
        }
      />
    );
  }

  // Feature table columns
  const featureColumns = [
    {
      title: 'Feature',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <Text strong>{name}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>
            {record.featureKey}
          </Text>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'numeric' ? 'blue' : type === 'boolean' ? 'green' : 'orange'}>
          {type}
        </Tag>
      ),
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 120,
    },
    {
      title: 'Enabled',
      key: 'enabled',
      width: 80,
      align: 'center',
      render: (_, record) => (
        <Switch
          checked={featureConfig[record._id]?.enabled || false}
          onChange={(checked) => handleToggleFeature(record._id, checked)}
          size="small"
        />
      ),
    },
    {
      title: 'Limit / Value',
      key: 'limitValue',
      width: 180,
      render: (_, record) => {
        const config = featureConfig[record._id];
        const isEnabled = config?.enabled;

        if (!isEnabled) {
          return <Text type="secondary">—</Text>;
        }

        if (record.type === 'numeric') {
          return (
            <Space size="small">
              <InputNumber
                min={0}
                placeholder="Unlimited"
                value={config?.limit}
                onChange={(val) => handleLimitChange(record._id, val)}
                style={{ width: 120 }}
                size="small"
              />
              {record.unit && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {record.unit}
                </Text>
              )}
            </Space>
          );
        }

        if (record.type === 'text') {
          return (
            <Input
              placeholder="Value"
              value={config?.value || ''}
              onChange={(e) => handleValueChange(record._id, e.target.value)}
              style={{ width: 160 }}
              size="small"
            />
          );
        }

        // boolean — just enabled/disabled, no extra value
        return <Tag color="green">Yes</Tag>;
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title={isEditing ? 'Edit Plan' : 'Create Plan'}
        subtitle={isEditing ? 'Modify plan details and features' : 'Set up a new subscription plan'}
        breadcrumbs={[
          { label: 'Plans', path: '/plans' },
          { label: isEditing ? 'Edit' : 'Create' },
        ]}
        extra={
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/plans')}>
            Back to Plans
          </Button>
        }
      />

      <Spin spinning={loading}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            priceMonthly: 0,
            priceYearly: 0,
            currency: 'USD',
            billingCycle: 'both',
            isDefault: false,
            displayOrder: 0,
            trialDays: 0,
            lsMonthlyVariantId: '',
            lsYearlyVariantId: '',
            lsProductId: '',
          }}
        >
          {/* Basic Information */}
          <Card
            title={
              <Space>
                <CrownOutlined />
                Plan Details
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <Row gutter={24}>
              <Col xs={24} md={12}>
                <Form.Item
                  name="name"
                  label="Plan Name"
                  rules={[{ required: true, message: 'Please enter a plan name' }]}
                >
                  <Input placeholder="e.g. Pro, Starter, Enterprise" />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="displayOrder" label="Display Order">
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={6}>
                <Form.Item name="isDefault" label="Default Plan" valuePropName="checked">
                  <Switch checkedChildren="Yes" unCheckedChildren="No" />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="description" label="Description">
              <TextArea rows={3} placeholder="Brief description of what this plan offers" />
            </Form.Item>
          </Card>

          {/* Pricing */}
          <Card title="Pricing" style={{ marginBottom: 24 }}>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="priceMonthly"
                  label="Monthly Price ($)"
                  rules={[{ required: true, message: 'Required' }]}
                >
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="priceYearly" label="Yearly Price ($)">
                  <InputNumber min={0} precision={2} style={{ width: '100%' }} placeholder="0.00" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item name="currency" label="Currency">
                  <Select
                    options={[
                      { value: 'USD', label: 'USD ($)' },
                      { value: 'EUR', label: 'EUR (€)' },
                      { value: 'GBP', label: 'GBP (£)' },
                    ]}
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item name="billingCycle" label="Billing Cycle">
                  <Select
                    options={[
                      { value: 'monthly', label: 'Monthly Only' },
                      { value: 'yearly', label: 'Yearly Only' },
                      { value: 'both', label: 'Both' },
                    ]}
                  />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item 
                  name="trialDays" 
                  label={
                    <Space>
                      Trial Period (Days)
                      <Tooltip title="How long customers can use this plan for free before needing to pay or upgrade. Set to 0 for no trial. For FREE plans: after trial expires, user must upgrade to continue. For PAID plans: user tries the plan free, then must pay to keep it.">
                        <QuestionCircleOutlined style={{ color: '#8c8c8c' }} />
                      </Tooltip>
                    </Space>
                  }
                >
                  <InputNumber min={0} style={{ width: '100%' }} placeholder="0" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* LemonSqueezy Integration */}
          <Card
            title={
              <Space>
                <ShoppingCartOutlined />
                LemonSqueezy Variant IDs
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            <p style={{ marginBottom: 16, color: '#666' }}>
              If you use LemonSqueezy as a payment gateway, enter the variant IDs from your LemonSqueezy product here.
              Find them in <strong>LemonSqueezy Dashboard → Products → Your Product → Variants</strong>.
            </p>
            <Row gutter={24}>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="lsMonthlyVariantId"
                  label="Monthly Variant ID"
                  extra="Variant ID for monthly billing"
                >
                  <Input placeholder="e.g. 123456" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="lsYearlyVariantId"
                  label="Yearly Variant ID"
                  extra="Variant ID for yearly billing"
                >
                  <Input placeholder="e.g. 123457" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={8}>
                <Form.Item
                  name="lsProductId"
                  label="Product ID (Optional)"
                  extra="LemonSqueezy Product ID for reference"
                >
                  <Input placeholder="e.g. 98765" />
                </Form.Item>
              </Col>
            </Row>
          </Card>

          {/* Features */}
          <Card title="Feature Allocation" style={{ marginBottom: 24 }}>
            {availableFeatures.length === 0 && !featuresLoading ? (
              <Result
                status="info"
                title="No Features Available"
                subTitle="Create features in the Features section first, then attach them to plans."
              />
            ) : (
              <>
                <p style={{ marginBottom: 16, color: '#666' }}>
                  Toggle features on/off for this plan. For numeric features, set the usage limit (leave empty for unlimited).
                </p>
                <Table
                  rowKey="_id"
                  dataSource={availableFeatures}
                  columns={featureColumns}
                  loading={featuresLoading}
                  pagination={false}
                  size="small"
                  scroll={{ x: 600 }}
                />
              </>
            )}
          </Card>

          {/* Submit */}
          <Card>
            <Space>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={saving}
                size="large"
              >
                {isEditing ? 'Update Plan' : 'Create Plan'}
              </Button>
              <Button size="large" onClick={() => navigate('/plans')}>
                Cancel
              </Button>
            </Space>
          </Card>
        </Form>
      </Spin>
    </div>
  );
};

export default PlanFormPage;
