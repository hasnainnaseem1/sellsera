import React, { useState, useEffect } from 'react';
import { Tabs, Card, Form, Input, Button, Switch, message, InputNumber, Select, ColorPicker, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import PageHeader from '../components/common/PageHeader';
import PermissionGuard from '../components/guards/PermissionGuard';
import TempEmailBlockingSettings from '../components/settings/TempEmailBlockingSettings';
import { usePermission } from '../hooks/usePermission';
import settingsApi from '../api/settingsApi';
import { PERMISSIONS } from '../utils/permissions';

const SettingsPage = () => {
  const { hasPermission, isSuperAdmin } = usePermission();
  const [loading, setLoading] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [customerForm] = Form.useForm();
  const [securityForm] = Form.useForm();
  const [notificationForm] = Form.useForm();
  const [maintenanceForm] = Form.useForm();
  const [featuresForm] = Form.useForm();

  const canUpdate = hasPermission(PERMISSIONS.SETTINGS_EDIT);

  // Map section keys to the correct API method
  const sectionApiMap = {
    customer: settingsApi.updateCustomer,
    security: settingsApi.updateSecurity,
    notifications: settingsApi.updateNotification,
    maintenance: settingsApi.updateMaintenance,
    features: settingsApi.updateFeatures,
  };

  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true);
      try {
        const data = await settingsApi.getSettings();
        const s = data.settings || {};
        setSettings(s);

        // Customer: nested under customerSettings
        const cs = s.customerSettings || {};
        customerForm.setFieldsValue({
          defaultPlan: cs.defaultPlan,
          requireEmailVerification: cs.requireEmailVerification,
          allowTemporaryEmails: cs.allowTemporaryEmails,
          autoApproveNewcustomers: cs.autoApproveNewcustomers,
          freeTrialDays: cs.freeTrialDays,
        });

        // Security: nested under securitySettings
        const sec = s.securitySettings || {};
        securityForm.setFieldsValue({
          ...sec,
          // Convert ms → minutes for display
          lockoutDuration: sec.lockoutDuration ? Math.round(sec.lockoutDuration / 60000) : 120,
          sessionTimeout: sec.sessionTimeout ? Math.round(sec.sessionTimeout / 60000) : 10080,
        });

        // Notifications: nested under notificationSettings
        const ns = s.notificationSettings || {};
        notificationForm.setFieldsValue({
          enableEmailNotifications: ns.enableEmailNotifications,
          enablePushNotifications: ns.enablePushNotifications,
          notifyAdminOnNewcustomer: ns.notifyAdminOnNewcustomer,
          notifyAdminOnSubscription: ns.notifyAdminOnSubscription,
        });

        // Maintenance: nested under maintenanceMode
        const mm = s.maintenanceMode || {};
        maintenanceForm.setFieldsValue({
          enabled: mm.enabled,
          message: mm.message,
          allowAdminAccess: mm.allowAdminAccess,
        });

        // Features: nested under features
        featuresForm.setFieldsValue(s.features || {});
      } catch {
        message.error('Failed to load settings');
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, [customerForm, securityForm, notificationForm, maintenanceForm, featuresForm]);

  const handleSave = async (section, form) => {
    try {
      let values = await form.validateFields();
      // Convert minutes → ms for security settings before saving
      if (section === 'security') {
        values = {
          ...values,
          lockoutDuration: values.lockoutDuration ? values.lockoutDuration * 60000 : undefined,
          sessionTimeout: values.sessionTimeout ? values.sessionTimeout * 60000 : undefined,
        };
      }
      setSaveLoading(true);
      const apiMethod = sectionApiMap[section];
      if (!apiMethod) throw new Error(`Unknown section: ${section}`);
      await apiMethod(values);
      message.success('Settings saved successfully');
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Save failed');
    } finally {
      setSaveLoading(false);
    }
  };

  const tabItems = [
    {
      key: 'customer',
      label: 'Customer',
      children: (
        <Form form={customerForm} layout="vertical" disabled={!canUpdate}>
          <Form.Item name="defaultPlan" label="Default Plan" rules={[{ required: true }]}>
            <Select options={[{ value: 'free', label: 'Free' }, { value: 'starter', label: 'Starter' }, { value: 'pro', label: 'Pro' }, { value: 'unlimited', label: 'Unlimited' }]} />
          </Form.Item>
          <Form.Item name="requireEmailVerification" label="Require Email Verification" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="allowTemporaryEmails" label="Allow Temporary Emails" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="autoApproveNewcustomers" label="Auto-Approve New Customers" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="freeTrialDays" label="Free Trial Days">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={() => handleSave('customer', customerForm)}>
              Save Customer Settings
            </Button>
          </PermissionGuard>
        </Form>
      ),
    },
    {
      key: 'email-blocking',
      label: 'Email Blocking',
      children: <TempEmailBlockingSettings canUpdate={canUpdate} />
    },
    {
      key: 'security',
      label: 'Security',
      children: (
        <Form form={securityForm} layout="vertical" disabled={!canUpdate}>
          <Form.Item name="maxLoginAttempts" label="Max Login Attempts" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} max={100} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="lockoutDuration" label="Lockout Duration (minutes)" rules={[{ required: true, type: 'number', min: 1 }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="sessionTimeout" label="Session Timeout (minutes)">
            <InputNumber min={5} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="passwordMinLength" label="Min Password Length" rules={[{ required: true, type: 'number', min: 6 }]}>
            <InputNumber min={6} max={128} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requireStrongPassword" label="Require Strong Password" valuePropName="checked">
            <Switch />
          </Form.Item>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={() => handleSave('security', securityForm)}>
              Save Security Settings
            </Button>
          </PermissionGuard>
        </Form>
      ),
    },
    {
      key: 'notifications',
      label: 'Notifications',
      children: (
        <Form form={notificationForm} layout="vertical" disabled={!canUpdate}>
          <Form.Item name="enableEmailNotifications" label="Email Notifications" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enablePushNotifications" label="Push Notifications" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notifyAdminOnNewcustomer" label="Notify on New Customer" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="notifyAdminOnSubscription" label="Notify on Subscription Change" valuePropName="checked">
            <Switch />
          </Form.Item>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={() => handleSave('notifications', notificationForm)}>
              Save Notification Settings
            </Button>
          </PermissionGuard>
        </Form>
      ),
    },
    {
      key: 'features',
      label: 'Features',
      children: (
        <Form form={featuresForm} layout="vertical" disabled={!canUpdate}>
          <Form.Item name="enableCustomerSignup" label="Enable Customer Signup" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableLogin" label="Enable Login Button (Marketing Site)" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableAnalysis" label="Enable Analysis" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableSubscriptions" label="Enable Subscriptions" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableCustomRoles" label="Enable Custom Roles" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="enableActivityLogs" label="Enable Activity Logs" valuePropName="checked">
            <Switch />
          </Form.Item>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={() => handleSave('features', featuresForm)}>
              Save Feature Settings
            </Button>
          </PermissionGuard>
        </Form>
      ),
    },
  ];

  if (isSuperAdmin) {
    tabItems.splice(4, 0, {
      key: 'maintenance',
      label: 'Maintenance',
      children: (
        <Form form={maintenanceForm} layout="vertical" disabled={!canUpdate}>
          <Form.Item name="enabled" label="Maintenance Mode" valuePropName="checked">
            <Switch />
          </Form.Item>
          <Form.Item name="message" label="Maintenance Message">
            <Input.TextArea rows={3} />
          </Form.Item>
          <Form.Item name="allowAdminAccess" label="Allow Admin Access During Maintenance" valuePropName="checked">
            <Switch />
          </Form.Item>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<SaveOutlined />} loading={saveLoading} onClick={() => handleSave('maintenance', maintenanceForm)}>
              Save Maintenance Settings
            </Button>
          </PermissionGuard>
        </Form>
      ),
    });
  }

  return (
    <div>
      <PageHeader
        title="Settings"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Settings' }]}
      />
      <Card loading={loading}>
        <Tabs items={tabItems} />
      </Card>
    </div>
  );
};

export default SettingsPage;
