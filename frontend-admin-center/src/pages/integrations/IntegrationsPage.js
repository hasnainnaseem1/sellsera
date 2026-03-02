import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Tabs, Form, Input, Button, Typography, Row, Col, Switch,
  Table, Tag, Space, message, Alert, Descriptions, Tooltip, Badge,
  Popconfirm, Modal, Select, Divider, InputNumber, Radio,
} from 'antd';
import {
  CreditCardOutlined, MailOutlined, ClockCircleOutlined,
  SaveOutlined, ApiOutlined, PlayCircleOutlined, ReloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined,
  ThunderboltOutlined, SafetyOutlined, KeyOutlined, LinkOutlined,
  SettingOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  EyeOutlined, UndoOutlined, FileTextOutlined, CopyOutlined,
  ShoppingCartOutlined, SwapOutlined,
} from '@ant-design/icons';
import settingsApi from '../../api/settingsApi';

const { Title, Text, Paragraph } = Typography;
const BRAND = '#6C63FF';

/* ═══════════════════════════ Stripe Tab ═══════════════════════════ */
const StripeTab = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(null);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data.success) {
        const stripe = data.settings?.stripeSettings || {};
        setCurrentSettings(stripe);
        form.setFieldsValue({
          publicKey: stripe.publicKey || '',
          secretKey: '',
          webhookSecret: '',
        });
      }
    } catch {
      message.error('Failed to load Stripe settings');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = { publicKey: values.publicKey };
      if (values.secretKey) payload.secretKey = values.secretKey;
      if (values.webhookSecret) payload.webhookSecret = values.webhookSecret;
      const data = await settingsApi.updateStripe(payload);
      if (data.success) {
        message.success('Stripe settings saved successfully');
        form.setFieldsValue({ secretKey: '', webhookSecret: '' });
        fetchSettings();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save Stripe settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        showIcon
        icon={<CreditCardOutlined />}
        message="Stripe Payment Integration"
        description="Configure your Stripe API keys to enable payment processing. You can find your API keys in the Stripe Dashboard under Developers → API keys."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      {currentSettings?.publicKey && (
        <Card size="small" style={{ marginBottom: 20, borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ color: '#389e0d' }}>Stripe is configured</Text>
            <Text type="secondary">Public key: {currentSettings.publicKey?.slice(0, 12)}...{currentSettings.publicKey?.slice(-4)}</Text>
          </Space>
        </Card>
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Form.Item
          name="publicKey"
          label={<Space><KeyOutlined /> Publishable Key</Space>}
          rules={[{ required: true, message: 'Publishable key is required' }]}
          extra="Starts with pk_test_ or pk_live_"
        >
          <Input placeholder="pk_test_..." size="large" />
        </Form.Item>

        <Form.Item
          name="secretKey"
          label={<Space><SafetyOutlined /> Secret Key</Space>}
          extra="Leave blank to keep existing. Starts with sk_test_ or sk_live_"
        >
          <Input.Password placeholder={currentSettings?.publicKey ? '••••••••  (leave blank to keep existing)' : 'sk_test_...'} size="large" />
        </Form.Item>

        <Form.Item
          name="webhookSecret"
          label={<Space><LinkOutlined /> Webhook Signing Secret</Space>}
          extra="Leave blank to keep existing. Starts with whsec_"
        >
          <Input.Password placeholder={currentSettings?.publicKey ? '••••••••  (leave blank to keep existing)' : 'whsec_...'} size="large" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
            style={{ background: BRAND, borderColor: BRAND }}>
            Save Stripe Settings
          </Button>
        </Form.Item>
      </Form>

      <Card title="Webhook Setup" size="small" style={{ borderRadius: 12, marginTop: 12 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
          Point your Stripe webhook to:
        </Paragraph>
        <Input
          readOnly
          value={`${process.env.REACT_APP_API_URL || window.location.origin}/api/v1/webhooks/stripe`}
          style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13 }}
          addonAfter={
            <Tooltip title="Copy">
              <Button type="text" size="small" onClick={() => {
                navigator.clipboard.writeText(`${process.env.REACT_APP_API_URL || window.location.origin}/api/v1/webhooks/stripe`);
                message.success('Copied!');
              }}>
                Copy
              </Button>
            </Tooltip>
          }
        />
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Events to listen for: <code>checkout.session.completed</code>, <code>invoice.paid</code>, <code>invoice.payment_failed</code>, <code>customer.subscription.updated</code>, <code>customer.subscription.deleted</code>
        </Paragraph>
      </Card>
    </div>
  );
};

/* ═══════════════════════════ Email Tab ═══════════════════════════ */
const EmailTab = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState('');
  const [hasExistingPassword, setHasExistingPassword] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data.success) {
        const email = data.settings?.emailSettings || {};
        const port = email.smtpPort || 587;
        setHasExistingPassword(!!email.smtpUser);
        form.setFieldsValue({
          smtpHost: email.smtpHost || '',
          smtpPort: port,
          smtpUser: email.smtpUser || '',
          smtpPassword: '',
          fromName: email.fromName || '',
          fromEmail: email.fromEmail || '',
          smtpSecure: port === 465,
        });
      }
    } catch {
      message.error('Failed to load email settings');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  // Auto-set TLS toggle when port changes
  const handlePortChange = (value) => {
    if (value === 465) {
      form.setFieldsValue({ smtpSecure: true });
    } else if (value === 587 || value === 25 || value === 2525) {
      form.setFieldsValue({ smtpSecure: false });
    }
  };

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = {
        smtpHost: values.smtpHost,
        smtpPort: values.smtpPort,
        smtpUser: values.smtpUser,
        fromName: values.fromName,
        fromEmail: values.fromEmail,
        smtpSecure: !!values.smtpSecure,
      };
      // Only send password if user typed one (don't overwrite with empty)
      if (values.smtpPassword) payload.smtpPassword = values.smtpPassword;

      const data = await settingsApi.updateEmail(payload);
      if (data.success) {
        message.success('Email settings saved');
        setHasExistingPassword(true);
        form.setFieldsValue({ smtpPassword: '' });
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) { message.warning('Enter a test email address'); return; }
    setTesting(true);
    try {
      const data = await settingsApi.testEmail(testEmail);
      if (data.success) message.success('Test email sent!');
      else message.error(data.message || 'Test email failed');
    } catch (err) {
      message.error(err.response?.data?.message || 'Test email failed');
    } finally {
      setTesting(false);
    }
  };

  const portValue = Form.useWatch('smtpPort', form);
  const tlsHelpText = portValue === 465
    ? 'Port 465 uses implicit SSL/TLS — toggle is ON automatically.'
    : portValue === 587
      ? 'Port 587 uses STARTTLS (auto-upgrades to TLS) — toggle should be OFF.'
      : portValue === 25
        ? 'Port 25 is unencrypted SMTP — not recommended for production.'
        : 'Common ports: 587 (STARTTLS, recommended), 465 (SSL/TLS), 25 (unencrypted).';

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info" showIcon icon={<MailOutlined />}
        message="SMTP Email Configuration"
        description="Configure your outbound email settings. Use your email provider's SMTP credentials (SendGrid, Gmail, Mailgun, Amazon SES, etc.)."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Row gutter={16}>
          <Col xs={24} md={16}>
            <Form.Item name="smtpHost" label="SMTP Host" rules={[{ required: true, message: 'SMTP host is required' }]}
              extra="e.g. smtp.sendgrid.net, smtp.gmail.com, smtp.mailgun.org"
            >
              <Input placeholder="smtp.sendgrid.net" size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={8}>
            <Form.Item name="smtpPort" label="Port" rules={[{ required: true, message: 'Port is required' }]}
              extra="587 (STARTTLS) or 465 (SSL)"
            >
              <InputNumber placeholder="587" size="large" min={1} max={65535}
                style={{ width: '100%' }}
                onChange={handlePortChange}
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="smtpUser" label="Username / API Key" rules={[{ required: true, message: 'Username is required' }]}
              extra="For SendGrid use 'apikey' as username"
            >
              <Input placeholder="apikey or your@email.com" size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="smtpPassword" label="Password / API Key"
              extra={hasExistingPassword ? 'Leave blank to keep existing password' : 'Enter your SMTP password or API key'}
            >
              <Input.Password placeholder={hasExistingPassword ? '••••••••  (saved — leave blank to keep)' : 'Enter password or API key'} size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Form.Item name="fromName" label="From Name" rules={[{ required: true, message: 'Sender name is required' }]}
              extra="Shown as the sender name in emails"
            >
              <Input placeholder="My Platform" size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="fromEmail" label="From Email" rules={[{ required: true, type: 'email', message: 'Valid email required' }]}
              extra="Must be verified in your email provider"
            >
              <Input placeholder="noreply@yourdomain.com" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="smtpSecure" label="Use implicit SSL/TLS" valuePropName="checked"
          extra={<Text type="secondary" style={{ fontSize: 12 }}>{tlsHelpText}</Text>}
        >
          <Switch checkedChildren="SSL/TLS (port 465)" unCheckedChildren="STARTTLS (port 587)" />
        </Form.Item>

        <Space>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
            style={{ background: BRAND, borderColor: BRAND }}>
            Save Email Settings
          </Button>
        </Space>
      </Form>

      <Card title="Send Test Email" size="small" style={{ borderRadius: 12, marginTop: 24 }}>
        <Text type="secondary" style={{ display: 'block', marginBottom: 12, fontSize: 13 }}>
          Save your settings first, then send a test email to verify everything works.
        </Text>
        <Space.Compact style={{ width: '100%' }}>
          <Input placeholder="recipient@example.com" value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)} size="large" />
          <Button type="primary" icon={<MailOutlined />} onClick={handleTestEmail}
            loading={testing} size="large">
            Send Test
          </Button>
        </Space.Compact>
      </Card>
    </div>
  );
};

/* ═══════════════════════════ Cron Jobs Tab ═══════════════════════════ */
const SCHEDULE_PRESETS = [
  { label: 'Every minute', value: '* * * * *' },
  { label: 'Every 5 minutes', value: '*/5 * * * *' },
  { label: 'Every 15 minutes', value: '*/15 * * * *' },
  { label: 'Every 30 minutes', value: '*/30 * * * *' },
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Every 12 hours', value: '0 */12 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Daily at 9 AM', value: '0 9 * * *' },
  { label: 'Weekly (Sunday midnight)', value: '0 0 * * 0' },
  { label: 'Monthly (1st at midnight)', value: '0 0 1 * *' },
];

const CronJobsTab = () => {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [triggering, setTriggering] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null); // null = create, object = edit
  const [modalSaving, setModalSaving] = useState(false);
  const [form] = Form.useForm();
  const actionType = Form.useWatch('actionType', form);

  const fetchJobs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getCronJobs();
      if (data.success) setJobs(data.jobs || []);
    } catch {
      message.error('Failed to load cron jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchJobs(); }, [fetchJobs]);

  const handleToggle = async (key) => {
    try {
      const data = await settingsApi.toggleCronJob(key);
      if (data.success) {
        message.success(data.message);
        fetchJobs();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to toggle job');
    }
  };

  const handleTrigger = async (key) => {
    setTriggering(key);
    try {
      const data = await settingsApi.triggerCronJob(key);
      if (data.success) {
        message.success('Job executed successfully');
        fetchJobs();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to trigger job');
    } finally {
      setTriggering(null);
    }
  };

  const openCreateModal = () => {
    setEditingJob(null);
    form.resetFields();
    form.setFieldsValue({ actionType: 'http', enabled: true, httpMethod: 'GET' });
    setModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingJob(record);
    form.resetFields();
    form.setFieldsValue({
      name: record.name,
      description: record.description || '',
      schedule: record.schedule,
      scheduleLabel: record.scheduleLabel || '',
      actionType: record.actionType || 'log',
      httpUrl: record.httpConfig?.url || '',
      httpMethod: record.httpConfig?.method || 'GET',
      httpBody: record.httpConfig?.body || '',
      logMessage: record.logMessage || '',
      emailTo: record.emailConfig?.to || '',
      emailSubject: record.emailConfig?.subject || '',
      emailBody: record.emailConfig?.body || '',
      cleanupTarget: record.cleanupConfig?.target || 'activityLogs',
      cleanupOlderThanDays: record.cleanupConfig?.olderThanDays ?? 30,
      notificationTitle: record.notificationConfig?.title || '',
      notificationMessage: record.notificationConfig?.message || '',
      notificationType: record.notificationConfig?.notificationType || 'system_alert',
      backupCollections: record.backupConfig?.collections || [],
      backupOutputDir: record.backupConfig?.outputDir || 'backups',
      enabled: record.enabled,
    });
    setModalOpen(true);
  };

  const handleDelete = async (key) => {
    try {
      const data = await settingsApi.deleteCronJob(key);
      if (data.success) {
        message.success('Cron job deleted');
        fetchJobs();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete');
    }
  };

  const handleModalSave = async () => {
    try {
      const values = await form.validateFields();
      setModalSaving(true);

      // Build payload
      const payload = {
        name: values.name,
        description: values.description || '',
        schedule: values.schedule,
        scheduleLabel: values.scheduleLabel || values.schedule,
        actionType: values.actionType,
        enabled: values.enabled !== false,
      };
      if (values.actionType === 'http') {
        payload.httpConfig = {
          url: values.httpUrl,
          method: values.httpMethod || 'GET',
          body: values.httpBody || '',
        };
      } else if (values.actionType === 'email') {
        payload.emailConfig = {
          to: values.emailTo,
          subject: values.emailSubject,
          body: values.emailBody || '',
        };
      } else if (values.actionType === 'cleanup') {
        payload.cleanupConfig = {
          target: values.cleanupTarget || 'activityLogs',
          olderThanDays: values.cleanupOlderThanDays ?? 30,
        };
      } else if (values.actionType === 'notification') {
        payload.notificationConfig = {
          title: values.notificationTitle,
          message: values.notificationMessage || '',
          notificationType: values.notificationType || 'system_alert',
        };
      } else if (values.actionType === 'backup') {
        payload.backupConfig = {
          collections: values.backupCollections || [],
          outputDir: values.backupOutputDir || 'backups',
        };
      } else {
        payload.logMessage = values.logMessage || '';
      }

      if (editingJob) {
        // Update
        const data = await settingsApi.updateCronJob(editingJob.key, payload);
        if (data.success) {
          message.success('Cron job updated');
          setModalOpen(false);
          fetchJobs();
        }
      } else {
        // Create
        payload.key = values.key;
        const data = await settingsApi.createCronJob(payload);
        if (data.success) {
          message.success('Cron job created');
          setModalOpen(false);
          fetchJobs();
        }
      }
    } catch (err) {
      if (err.errorFields) return; // form validation
      message.error(err.response?.data?.message || 'Failed to save cron job');
    } finally {
      setModalSaving(false);
    }
  };

  const columns = [
    {
      title: 'Job',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <div>
          <Space>
            <Text strong>{text}</Text>
            {record.system
              ? <Tag color="geekblue" style={{ fontSize: 10 }}>SYSTEM</Tag>
              : <Tag color="purple" style={{ fontSize: 10 }}>CUSTOM</Tag>}
          </Space>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.description}</Text>
          {!record.system && record.actionType && (
            <>
              <br />
              <Tag style={{ fontSize: 10, marginTop: 2 }} color={
                record.actionType === 'http' ? 'cyan' :
                record.actionType === 'email' ? 'green' :
                record.actionType === 'cleanup' ? 'red' :
                record.actionType === 'notification' ? 'purple' :
                record.actionType === 'backup' ? 'geekblue' :
                'orange'
              }>
                {record.actionType === 'http' ? `HTTP ${record.httpConfig?.method || 'GET'}` :
                 record.actionType === 'email' ? 'EMAIL' :
                 record.actionType === 'cleanup' ? `CLEANUP ${record.cleanupConfig?.target || ''}` :
                 record.actionType === 'notification' ? 'NOTIFICATION' :
                 record.actionType === 'backup' ? 'BACKUP' :
                 'LOG'}
              </Tag>
            </>
          )}
        </div>
      ),
    },
    {
      title: 'Schedule',
      dataIndex: 'scheduleLabel',
      key: 'schedule',
      render: (text, record) => (
        <Tooltip title={`Cron: ${record.schedule}`}>
          <Tag icon={<ClockCircleOutlined />} color="blue">{text || record.schedule}</Tag>
        </Tooltip>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'enabled',
      key: 'status',
      render: (enabled) =>
        enabled
          ? <Badge status="success" text={<Text style={{ color: '#52c41a' }}>Active</Text>} />
          : <Badge status="error" text={<Text type="danger">Disabled</Text>} />,
    },
    {
      title: 'Last Run',
      dataIndex: 'lastRun',
      key: 'lastRun',
      render: (val, record) => {
        if (!val) return <Text type="secondary">Never</Text>;
        return (
          <Space direction="vertical" size={0}>
            <Text style={{ fontSize: 13 }}>
              {new Date(val).toLocaleString()}
            </Text>
            <Tag
              color={record.lastStatus === 'success' ? 'green' : 'red'}
              icon={record.lastStatus === 'success' ? <CheckCircleOutlined /> : <ExclamationCircleOutlined />}
              style={{ fontSize: 11 }}
            >
              {record.lastStatus}
            </Tag>
          </Space>
        );
      },
    },
    {
      title: 'Runs',
      dataIndex: 'runCount',
      key: 'runCount',
      width: 60,
      render: (v) => <Tag>{v}</Tag>,
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 280,
      render: (_, record) => (
        <Space wrap>
          <Switch
            checked={record.enabled}
            onChange={() => handleToggle(record.key)}
            checkedChildren="ON"
            unCheckedChildren="OFF"
            size="small"
          />
          <Popconfirm
            title="Run this job now?"
            description="This will immediately execute the cron job."
            onConfirm={() => handleTrigger(record.key)}
            okText="Run"
          >
            <Button
              size="small"
              icon={<PlayCircleOutlined />}
              loading={triggering === record.key}
              type="primary"
              ghost
            >
              Run
            </Button>
          </Popconfirm>
          {!record.system && (
            <>
              <Tooltip title="Edit">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
              </Tooltip>
              <Popconfirm
                title="Delete this cron job?"
                description="This action cannot be undone."
                onConfirm={() => handleDelete(record.key)}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
        <div>
          <Title level={5} style={{ margin: 0 }}>Scheduled Jobs</Title>
          <Text type="secondary">Monitor and manage background tasks</Text>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchJobs}>Refresh</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}
            style={{ background: BRAND, borderColor: BRAND }}>
            Create Job
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={jobs}
        rowKey="key"
        loading={loading}
        pagination={false}
        style={{ borderRadius: 12, overflow: 'hidden' }}
      />

      {/* ─── Create / Edit Modal ─── */}
      <Modal
        title={editingJob ? `Edit Job: ${editingJob.name}` : 'Create Custom Cron Job'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleModalSave}
        okText={editingJob ? 'Update' : 'Create'}
        confirmLoading={modalSaving}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" requiredMark={false} style={{ marginTop: 16 }}>
          {!editingJob && (
            <Form.Item
              name="key"
              label="Job Key"
              rules={[
                { required: true, message: 'Job key is required' },
                { pattern: /^[a-z0-9_-]+$/, message: 'Only lowercase letters, numbers, hyphens, underscores' },
              ]}
              extra="Unique identifier (e.g., daily_report, cleanup_logs)"
            >
              <Input placeholder="my_custom_job" />
            </Form.Item>
          )}

          <Form.Item name="name" label="Job Name" rules={[{ required: true, message: 'Name is required' }]}>
            <Input placeholder="Daily Report Generator" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea placeholder="What does this job do?" rows={2} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={16}>
              <Form.Item
                name="schedule"
                label="Cron Schedule"
                rules={[{ required: true, message: 'Schedule is required' }]}
                extra={<Text type="secondary" style={{ fontSize: 11 }}>Format: minute hour day month weekday  (e.g., 0 9 * * * = daily at 9 AM)</Text>}
              >
                <Select
                  showSearch
                  placeholder="Select or type a cron expression"
                  options={SCHEDULE_PRESETS}
                  allowClear
                  dropdownRender={(menu) => (
                    <>
                      {menu}
                      <Divider style={{ margin: '8px 0' }} />
                      <div style={{ padding: '0 8px 8px' }}>
                        <Text type="secondary" style={{ fontSize: 11 }}>Or type a custom expression above</Text>
                      </div>
                    </>
                  )}
                  filterOption={(input, option) =>
                    option?.label?.toLowerCase().includes(input.toLowerCase()) ||
                    option?.value?.includes(input)
                  }
                  // Allow custom input
                  mode={undefined}
                  onSearch={() => {}}
                  notFoundContent={<Text type="secondary">Type a valid cron expression</Text>}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="scheduleLabel" label="Label (optional)">
                <Input placeholder="Every hour" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="actionType" label="Action Type" rules={[{ required: true }]}>
            <Select
              options={[
                { label: 'HTTP Request — call an API endpoint', value: 'http' },
                { label: 'Send Email — send email via SMTP', value: 'email' },
                { label: 'Database Cleanup — remove old records', value: 'cleanup' },
                { label: 'Notification — send in-app admin notification', value: 'notification' },
                { label: 'Database Backup — export collections to JSON', value: 'backup' },
                { label: 'Log Message — write to server log', value: 'log' },
              ]}
            />
          </Form.Item>

          {actionType === 'http' && (
            <>
              <Row gutter={16}>
                <Col span={6}>
                  <Form.Item name="httpMethod" label="Method" initialValue="GET">
                    <Select options={[
                      { label: 'GET', value: 'GET' },
                      { label: 'POST', value: 'POST' },
                      { label: 'PUT', value: 'PUT' },
                      { label: 'DELETE', value: 'DELETE' },
                    ]} />
                  </Form.Item>
                </Col>
                <Col span={18}>
                  <Form.Item name="httpUrl" label="URL" rules={[{ required: true, message: 'URL is required' }]}>
                    <Input placeholder="https://api.example.com/webhook" />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item name="httpBody" label="Request Body (JSON)" extra="Only used for POST/PUT methods">
                <Input.TextArea placeholder='{"key": "value"}' rows={3} style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </>
          )}

          {actionType === 'email' && (
            <>
              <Form.Item name="emailTo" label="Recipients" rules={[{ required: true, message: 'At least one recipient is required' }]}
                extra="Comma-separated email addresses">
                <Input placeholder="admin@example.com, team@example.com" />
              </Form.Item>
              <Form.Item name="emailSubject" label="Subject" rules={[{ required: true, message: 'Subject is required' }]}>
                <Input placeholder="Daily Report — {{date}}" />
              </Form.Item>
              <Form.Item name="emailBody" label="Email Body (HTML)">
                <Input.TextArea placeholder="<h2>Daily Report</h2><p>Everything is running smoothly.</p>" rows={4} style={{ fontFamily: 'monospace' }} />
              </Form.Item>
            </>
          )}

          {actionType === 'cleanup' && (
            <Row gutter={16}>
              <Col span={14}>
                <Form.Item name="cleanupTarget" label="What to Clean" rules={[{ required: true }]} initialValue="activityLogs">
                  <Select options={[
                    { label: 'Activity Logs', value: 'activityLogs' },
                    { label: 'Notifications', value: 'notifications' },
                    { label: 'Unverified Users', value: 'unverifiedUsers' },
                    { label: 'Expired Sessions/Tokens', value: 'expiredSessions' },
                    { label: 'Failed Job Errors', value: 'failedJobs' },
                  ]} />
                </Form.Item>
              </Col>
              <Col span={10}>
                <Form.Item name="cleanupOlderThanDays" label="Older Than (days)" initialValue={30}>
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>
          )}

          {actionType === 'notification' && (
            <>
              <Form.Item name="notificationTitle" label="Notification Title" rules={[{ required: true, message: 'Title is required' }]}>
                <Input placeholder="System Health Check" />
              </Form.Item>
              <Form.Item name="notificationMessage" label="Notification Message">
                <Input.TextArea placeholder="All systems are running normally." rows={2} />
              </Form.Item>
              <Form.Item name="notificationType" label="Notification Type" initialValue="system_alert">
                <Select options={[
                  { label: 'System Alert', value: 'system_alert' },
                  { label: 'New Feature', value: 'new_feature' },
                  { label: 'Admin Message', value: 'admin_message' },
                ]} />
              </Form.Item>
            </>
          )}

          {actionType === 'backup' && (
            <>
              <Form.Item name="backupCollections" label="Collections to Backup"
                extra="Leave empty to backup users, analyses, and activity logs by default">
                <Select mode="tags" placeholder="Type collection name and press Enter"
                  options={[
                    { label: 'users', value: 'users' },
                    { label: 'analyses', value: 'analyses' },
                    { label: 'activitylogs', value: 'activitylogs' },
                    { label: 'notifications', value: 'notifications' },
                    { label: 'cronjobs', value: 'cronjobs' },
                    { label: 'customroles', value: 'customroles' },
                    { label: 'adminsettings', value: 'adminsettings' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="backupOutputDir" label="Output Directory" initialValue="backups">
                <Input placeholder="backups" />
              </Form.Item>
            </>
          )}

          {actionType === 'log' && (
            <Form.Item name="logMessage" label="Log Message">
              <Input.TextArea placeholder="Custom cron job executed successfully" rows={2} />
            </Form.Item>
          )}

          <Form.Item name="enabled" label="Enabled" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Disabled" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

/* ═══════════════════════════ Google SSO Tab ═══════════════════════════ */
const GoogleSSOTab = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data.success) {
        const gso = data.settings?.googleSSOSettings || {};
        setEnabled(!!gso.enabled);
        form.setFieldsValue({
          enabled: !!gso.enabled,
          clientId: gso.clientId || '',
          clientSecret: '',
        });
      }
    } catch {
      message.error('Failed to load Google SSO settings');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const data = await settingsApi.updateGoogleSSO(values);
      if (data.success) {
        message.success('Google SSO settings saved');
        form.setFieldsValue({ clientSecret: '' });
        fetchSettings();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info" showIcon
        message="Google Single Sign-On"
        description="Allow users to log in with their Google account. You'll need a Google Cloud OAuth 2.0 Client ID."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Form.Item name="enabled" label="Enable Google SSO" valuePropName="checked">
          <Switch
            checkedChildren="Enabled"
            unCheckedChildren="Disabled"
            onChange={(v) => setEnabled(v)}
          />
        </Form.Item>

        {enabled && (
          <>
            <Form.Item name="clientId" label="Client ID" rules={[{ required: true, message: 'Client ID is required' }]}>
              <Input placeholder="xxxx.apps.googleusercontent.com" size="large" />
            </Form.Item>
            <Form.Item name="clientSecret" label="Client Secret" extra="Leave blank to keep existing">
              <Input.Password placeholder="••••••••" size="large" />
            </Form.Item>
          </>
        )}

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
            style={{ background: BRAND, borderColor: BRAND }}>
            Save Google SSO Settings
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

/* ═══════════════════════════ Email Templates Tab ═══════════════════════════ */

const TEMPLATE_LABELS = {
  verification: 'Email Verification',
  welcome: 'Welcome Email',
  passwordReset: 'Password Reset',
  planChange: 'Plan Change',
  trialWarning: 'Trial Expiring Soon',
  trialExpired: 'Trial Expired',
  paymentConfirmation: 'Payment Confirmation',
  paymentFailed: 'Payment Failed',
};

const EmailTemplatesTab = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [templates, setTemplates] = useState({});
  const [selectedKey, setSelectedKey] = useState('verification');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [previewHtml, setPreviewHtml] = useState('');
  const [previewVisible, setPreviewVisible] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getEmailTemplates();
      if (data.success) {
        setTemplates(data.templates);
        const t = data.templates[selectedKey];
        if (t) {
          setSubject(t.subject || '');
          setBody(t.body || '');
        }
        setDirty(false);
      }
    } catch {
      message.error('Failed to load email templates');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const handleSelectTemplate = (key) => {
    if (dirty) {
      Modal.confirm({
        title: 'Unsaved Changes',
        content: 'You have unsaved changes. Switch anyway?',
        onOk: () => switchTo(key),
      });
    } else {
      switchTo(key);
    }
  };

  const switchTo = (key) => {
    setSelectedKey(key);
    const t = templates[key];
    setSubject(t?.subject || '');
    setBody(t?.body || '');
    setDirty(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const data = await settingsApi.updateEmailTemplate(selectedKey, { subject, body });
      if (data.success) {
        message.success(data.message || 'Template saved');
        setDirty(false);
        fetchTemplates();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save template');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    setResetting(true);
    try {
      const data = await settingsApi.resetEmailTemplate(selectedKey);
      if (data.success) {
        message.success('Template reset to default');
        setDirty(false);
        fetchTemplates();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to reset template');
    } finally {
      setResetting(false);
    }
  };

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const data = await settingsApi.previewEmailTemplate(selectedKey, { subject, body });
      if (data.success) {
        setPreviewHtml(data.html || '');
        setPreviewVisible(true);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to preview');
    } finally {
      setPreviewing(false);
    }
  };

  const handleUseDefault = () => {
    const t = templates[selectedKey];
    if (t) {
      setSubject('');
      setBody('');
      setDirty(true);
    }
  };

  const handleCopyDefault = () => {
    const t = templates[selectedKey];
    if (t) {
      setSubject(t.defaultSubject || '');
      setBody(t.defaultBody || '');
      setDirty(true);
      message.info('Default template copied — you can now edit it');
    }
  };

  const current = templates[selectedKey] || {};
  const isCustomized = !!(current.subject?.trim() || current.body?.trim());
  const vars = current.variables || [];

  return (
    <div>
      <Alert
        type="info" showIcon
        icon={<FileTextOutlined />}
        message="Email Templates"
        description="Customize the content of system emails. Leave fields empty to use the built-in default template. Use {{variable}} placeholders for dynamic content."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      <Row gutter={24}>
        {/* Template selector sidebar */}
        <Col xs={24} md={7}>
          <Card size="small" title="Templates" style={{ borderRadius: 12 }}
            bodyStyle={{ padding: 0 }}>
            {Object.keys(TEMPLATE_LABELS).map((key) => {
              const t = templates[key] || {};
              const custom = !!(t.subject?.trim() || t.body?.trim());
              return (
                <div
                  key={key}
                  onClick={() => handleSelectTemplate(key)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderLeft: selectedKey === key ? `3px solid ${BRAND}` : '3px solid transparent',
                    background: selectedKey === key ? '#f0f0ff' : 'transparent',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #f0f0f0',
                    transition: 'all 0.2s',
                  }}
                >
                  <Text strong={selectedKey === key} style={{ fontSize: 13 }}>
                    {TEMPLATE_LABELS[key]}
                  </Text>
                  {custom && (
                    <Tag color="blue" style={{ fontSize: 10, margin: 0, lineHeight: '18px' }}>Custom</Tag>
                  )}
                </div>
              );
            })}
          </Card>
        </Col>

        {/* Editor area */}
        <Col xs={24} md={17}>
          <Card
            size="small"
            title={
              <Space>
                <span>{TEMPLATE_LABELS[selectedKey]}</span>
                {isCustomized ? (
                  <Tag color="blue">Customized</Tag>
                ) : (
                  <Tag color="default">Using Default</Tag>
                )}
                {dirty && <Tag color="orange">Unsaved</Tag>}
              </Space>
            }
            style={{ borderRadius: 12 }}
            extra={
              <Space>
                <Button size="small" icon={<CopyOutlined />} onClick={handleCopyDefault}>
                  Copy Default
                </Button>
                <Popconfirm
                  title="Reset this template to default?"
                  description="Custom subject and body will be cleared."
                  onConfirm={handleReset}
                >
                  <Button size="small" icon={<UndoOutlined />} loading={resetting} danger>
                    Reset
                  </Button>
                </Popconfirm>
              </Space>
            }
          >
            {/* Available variables */}
            {vars.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                  Available Variables:
                </Text>
                <Space wrap size={[4, 4]}>
                  {vars.map((v) => (
                    <Tag
                      key={v}
                      style={{ cursor: 'pointer', fontFamily: 'monospace', fontSize: 11 }}
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                        message.info(`Copied {{${v}}}`);
                      }}
                    >
                      {`{{${v}}}`}
                    </Tag>
                  ))}
                </Space>
              </div>
            )}

            <Divider style={{ margin: '12px 0' }} />

            {/* Subject field */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>Subject</Text>
              <Input
                value={subject}
                onChange={(e) => { setSubject(e.target.value); setDirty(true); }}
                placeholder={current.defaultSubject || 'Leave empty to use default'}
                size="large"
              />
              {!subject && current.defaultSubject && (
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  Default: {current.defaultSubject}
                </Text>
              )}
            </div>

            {/* Body field */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ display: 'block', marginBottom: 6 }}>
                Body (HTML)
              </Text>
              <Input.TextArea
                value={body}
                onChange={(e) => { setBody(e.target.value); setDirty(true); }}
                placeholder={current.defaultBody ? 'Leave empty to use default template...' : ''}
                rows={14}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
              {!body && (
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: 'block' }}>
                  Using built-in default template. Click "Copy Default" to start customizing.
                </Text>
              )}
            </div>

            {/* Action buttons */}
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSave}
                loading={saving}
                size="large"
                style={{ background: BRAND, borderColor: BRAND }}
              >
                Save Template
              </Button>
              <Button
                icon={<EyeOutlined />}
                onClick={handlePreview}
                loading={previewing}
                size="large"
              >
                Preview
              </Button>
              <Button
                onClick={handleUseDefault}
                size="large"
              >
                Clear (Use Default)
              </Button>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Preview modal */}
      <Modal
        title={`Preview: ${TEMPLATE_LABELS[selectedKey]}`}
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={null}
        width={700}
        styles={{ body: { padding: 0 } }}
      >
        <div
          style={{ border: '1px solid #f0f0f0', borderRadius: 8, overflow: 'auto', maxHeight: 600 }}
          dangerouslySetInnerHTML={{ __html: previewHtml }}
        />
      </Modal>
    </div>
  );
};

/* ═══════════════════════════ LemonSqueezy Tab ═══════════════════════════ */
const LemonSqueezyTab = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentSettings, setCurrentSettings] = useState(null);
  const [activeGateway, setActiveGateway] = useState('stripe');
  const [switchingGateway, setSwitchingGateway] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await settingsApi.getSettings();
      if (data.success) {
        const ls = data.settings?.lemonSqueezySettings || {};
        setCurrentSettings(ls);
        setActiveGateway(data.settings?.activePaymentGateway || 'stripe');
        form.setFieldsValue({
          apiKey: '',
          storeId: ls.storeId || '',
          webhookSecret: '',
          enabled: ls.enabled ?? false,
        });
      }
    } catch {
      message.error('Failed to load LemonSqueezy settings');
    } finally {
      setLoading(false);
    }
  }, [form]);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async (values) => {
    setSaving(true);
    try {
      const payload = { storeId: values.storeId, enabled: values.enabled };
      if (values.apiKey) payload.apiKey = values.apiKey;
      if (values.webhookSecret) payload.webhookSecret = values.webhookSecret;
      const data = await settingsApi.updateLemonSqueezy(payload);
      if (data.success) {
        message.success('LemonSqueezy settings saved successfully');
        form.setFieldsValue({ apiKey: '', webhookSecret: '' });
        fetchSettings();
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save LemonSqueezy settings');
    } finally {
      setSaving(false);
    }
  };

  const handleGatewaySwitch = async (value) => {
    setSwitchingGateway(true);
    try {
      const data = await settingsApi.updatePaymentGateway({ gateway: value });
      if (data.success) {
        setActiveGateway(value);
        message.success(`Active payment gateway set to ${value === 'lemonsqueezy' ? 'LemonSqueezy' : value === 'stripe' ? 'Stripe' : 'None'}`);
      }
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to switch payment gateway');
    } finally {
      setSwitchingGateway(false);
    }
  };

  return (
    <div style={{ maxWidth: 720 }}>
      <Alert
        type="info"
        showIcon
        icon={<ShoppingCartOutlined />}
        message="LemonSqueezy Payment Integration"
        description="Configure your LemonSqueezy API keys to enable payment processing. You can find your API key in the LemonSqueezy Dashboard under Settings → API."
        style={{ marginBottom: 24, borderRadius: 12 }}
      />

      {/* Active Gateway Selector */}
      <Card
        size="small"
        title={<Space><SwapOutlined /> Active Payment Gateway</Space>}
        style={{ marginBottom: 20, borderRadius: 12, background: '#fffbe6', border: '1px solid #ffe58f' }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Text type="secondary" style={{ fontSize: 13 }}>
            Select which payment gateway to use for customer checkout. Only one gateway can be active at a time.
          </Text>
          <Radio.Group
            value={activeGateway}
            onChange={(e) => handleGatewaySwitch(e.target.value)}
            disabled={switchingGateway}
            style={{ marginTop: 8 }}
          >
            <Space direction="vertical">
              <Radio value="stripe">
                <Space>
                  <CreditCardOutlined />
                  <Text strong>Stripe</Text>
                  {activeGateway === 'stripe' && <Tag color="green">Active</Tag>}
                </Space>
              </Radio>
              <Radio value="lemonsqueezy">
                <Space>
                  <ShoppingCartOutlined />
                  <Text strong>LemonSqueezy</Text>
                  {activeGateway === 'lemonsqueezy' && <Tag color="green">Active</Tag>}
                </Space>
              </Radio>
              <Radio value="none">
                <Space>
                  <CloseCircleOutlined />
                  <Text strong>None (Payments Disabled)</Text>
                  {activeGateway === 'none' && <Tag color="default">Active</Tag>}
                </Space>
              </Radio>
            </Space>
          </Radio.Group>
        </Space>
      </Card>

      {currentSettings?.storeId && (
        <Card size="small" style={{ marginBottom: 20, borderRadius: 12, background: '#f6ffed', border: '1px solid #b7eb8f' }}>
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <Text strong style={{ color: '#389e0d' }}>LemonSqueezy is configured</Text>
            <Text type="secondary">Store ID: {currentSettings.storeId}</Text>
            {currentSettings.enabled ? (
              <Tag color="green">Enabled</Tag>
            ) : (
              <Tag color="orange">Disabled</Tag>
            )}
          </Space>
        </Card>
      )}

      <Form form={form} layout="vertical" onFinish={handleSave} requiredMark={false}>
        <Form.Item
          name="apiKey"
          label={<Space><KeyOutlined /> API Key</Space>}
          extra="Leave blank to keep existing. Found in LemonSqueezy Dashboard → Settings → API"
        >
          <Input.Password
            placeholder={currentSettings?.storeId ? '••••••••  (leave blank to keep existing)' : 'Your LemonSqueezy API key'}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="storeId"
          label={<Space><SettingOutlined /> Store ID</Space>}
          rules={[{ required: true, message: 'Store ID is required' }]}
          extra="Found in LemonSqueezy Dashboard → Settings → Stores"
        >
          <Input placeholder="Your Store ID (e.g., 12345)" size="large" />
        </Form.Item>

        <Form.Item
          name="webhookSecret"
          label={<Space><LinkOutlined /> Webhook Signing Secret</Space>}
          extra="Leave blank to keep existing. Set when creating a webhook in LemonSqueezy Dashboard"
        >
          <Input.Password
            placeholder={currentSettings?.storeId ? '••••••••  (leave blank to keep existing)' : 'Your webhook signing secret'}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="enabled"
          label={<Space><ThunderboltOutlined /> Enable LemonSqueezy</Space>}
          valuePropName="checked"
        >
          <Switch checkedChildren="Enabled" unCheckedChildren="Disabled" />
        </Form.Item>

        <Form.Item>
          <Button type="primary" htmlType="submit" icon={<SaveOutlined />} loading={saving} size="large"
            style={{ background: BRAND, borderColor: BRAND }}>
            Save LemonSqueezy Settings
          </Button>
        </Form.Item>
      </Form>

      <Card title="Webhook Setup" size="small" style={{ borderRadius: 12, marginTop: 12 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
          Point your LemonSqueezy webhook to:
        </Paragraph>
        <Input
          readOnly
          value={`${process.env.REACT_APP_API_URL || window.location.origin}/api/v1/webhooks/lemonsqueezy`}
          style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 13 }}
          addonAfter={
            <Tooltip title="Copy">
              <Button type="text" size="small" onClick={() => {
                navigator.clipboard.writeText(`${process.env.REACT_APP_API_URL || window.location.origin}/api/v1/webhooks/lemonsqueezy`);
                message.success('Copied!');
              }}>
                Copy
              </Button>
            </Tooltip>
          }
        />
        <Paragraph type="secondary" style={{ fontSize: 12, marginTop: 8, marginBottom: 0 }}>
          Events to listen for: <code>subscription_created</code>, <code>subscription_updated</code>, <code>subscription_cancelled</code>, <code>subscription_payment_success</code>, <code>subscription_payment_failed</code>, <code>order_created</code>
        </Paragraph>
      </Card>

      <Card title="Plan Metadata" size="small" style={{ borderRadius: 12, marginTop: 12 }}>
        <Paragraph type="secondary" style={{ fontSize: 13, margin: 0 }}>
          To use LemonSqueezy, your plans must have LemonSqueezy variant IDs configured in their metadata.
          Set <code>metadata.lemonSqueezy.monthlyVariantId</code> and <code>metadata.lemonSqueezy.yearlyVariantId</code> on each plan.
        </Paragraph>
      </Card>
    </div>
  );
};

/* ═══════════════════════════ Main Page ═══════════════════════════ */
const IntegrationsPage = () => {
  const items = [
    {
      key: 'stripe',
      label: (
        <span>
          <CreditCardOutlined style={{ marginRight: 6 }} />
          Stripe Payments
        </span>
      ),
      children: <StripeTab />,
    },
    {
      key: 'lemonsqueezy',
      label: (
        <span>
          <ShoppingCartOutlined style={{ marginRight: 6 }} />
          LemonSqueezy
        </span>
      ),
      children: <LemonSqueezyTab />,
    },
    {
      key: 'email',
      label: (
        <span>
          <MailOutlined style={{ marginRight: 6 }} />
          Email / SMTP
        </span>
      ),
      children: <EmailTab />,
    },
    {
      key: 'cron',
      label: (
        <span>
          <ClockCircleOutlined style={{ marginRight: 6 }} />
          Cron Jobs
        </span>
      ),
      children: <CronJobsTab />,
    },
    {
      key: 'google-sso',
      label: (
        <span>
          <ApiOutlined style={{ marginRight: 6 }} />
          Google SSO
        </span>
      ),
      children: <GoogleSSOTab />,
    },
    {
      key: 'email-templates',
      label: (
        <span>
          <FileTextOutlined style={{ marginRight: 6 }} />
          Email Templates
        </span>
      ),
      children: <EmailTemplatesTab />,
    },
  ];

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>
          <ApiOutlined style={{ marginRight: 8, color: BRAND }} />
          Integrations
        </Title>
        <Text type="secondary">
          Manage external service connections — payment gateway, email, authentication, and scheduled tasks
        </Text>
      </div>

      <Card style={{ borderRadius: 16 }}>
        <Tabs defaultActiveKey="stripe" items={items} size="large" tabBarStyle={{ marginBottom: 24 }} />
      </Card>
    </div>
  );
};

export default IntegrationsPage;
