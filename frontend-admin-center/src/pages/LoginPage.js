import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Modal } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const { Title, Text } = Typography;

const LoginPage = () => {
  const [loading, setLoading] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [passwordForm] = Form.useForm();
  const [passwordLoading, setPasswordLoading] = useState(false);
  const { login, isAuthenticated, user, changePassword } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  useEffect(() => {
    if (isAuthenticated && !user?.passwordChangeRequired) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user?.passwordChangeRequired, navigate, from]);

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const result = await login(values.email, values.password);
      
      if (result.user?.passwordChangeRequired) {
        // Show password change modal for first login
        message.info('Please change your temporary password');
        setPasswordModalVisible(true);
      } else {
        message.success('Login successful!');
        navigate(from, { replace: true });
      }
    } catch (error) {
      const status = error.response?.status;
      const msg = error.response?.data?.message || 'Login failed. Please try again.';

      if (status === 423) {
        message.warning(msg);
      } else if (status === 403) {
        message.error(msg);
      } else {
        message.error(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const onPasswordChange = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }

    setPasswordLoading(true);
    try {
      await changePassword(values.currentPassword, values.newPassword);
      message.success('Password changed successfully!');
      setPasswordModalVisible(false);
      passwordForm.resetFields();
      navigate(from, { replace: true });
    } catch (error) {
      message.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: 24,
      }}
    >
      <Card
        style={{
          width: '100%',
          maxWidth: 420,
          borderRadius: 12,
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
        }}
        styles={{ body: { padding: '40px 32px' } }}
      >
        <Space vertical size="large" style={{ width: '100%', textAlign: 'center' }}>
          <div>
            <Title level={2} style={{ marginBottom: 4, color: '#7C3AED' }}>
              Admin Center
            </Title>
            <Text type="secondary">Sign in to manage your platform</Text>
          </div>

          <Form
            name="admin-login"
            onFinish={onFinish}
            layout="vertical"
            size="large"
            requiredMark={false}
            style={{ textAlign: 'left' }}
          >
            <Form.Item
              name="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="Email address" autoFocus />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password prefix={<LockOutlined />} placeholder="Password" />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0 }}>
              <Button
                type="primary"
                htmlType="submit"
                block
                loading={loading}
                style={{
                  height: 48,
                  borderRadius: 8,
                  fontSize: 16,
                  background: '#7C3AED',
                }}
              >
                Sign In
              </Button>
            </Form.Item>
          </Form>

          <Space direction="vertical" style={{ fontSize: 12, width: '100%', textAlign: 'center' }}>
            <Text type="secondary">
              Admin access only. Contact your administrator if you need access.
            </Text>
            <Button 
              type="link" 
              onClick={() => navigate('/forgot-password')}
              style={{ padding: 0 }}
            >
              Forgot your password?
            </Button>
          </Space>
        </Space>
      </Card>

      {/* First Login Password Change Modal */}
      <Modal
        title="Change Your Password"
        open={passwordModalVisible}
        onCancel={() => {}}
        footer={null}
        closable={false}
        maskClosable={false}
        width={420}
      >
        <p style={{ marginBottom: 24, color: '#666' }}>
          This is your first login. Please change your temporary password to a secure one.
        </p>
        <Form
          form={passwordForm}
          layout="vertical"
          onFinish={onPasswordChange}
        >
          <Form.Item
            name="currentPassword"
            label="Current Password"
            rules={[{ required: true, message: 'Please enter your current password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Your temporary password" />
          </Form.Item>

          <Form.Item
            name="newPassword"
            label="New Password"
            rules={[
              { required: true, message: 'Please enter a new password' },
              { min: 8, message: 'Password must be at least 8 characters' }
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Create a strong password" />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            label="Confirm Password"
            rules={[{ required: true, message: 'Please confirm your password' }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="Confirm your password" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0 }}>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={passwordLoading}
              style={{ height: 40, borderRadius: 6 }}
            >
              Change Password & Continue
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LoginPage;
