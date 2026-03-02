import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Result, Steps } from 'antd';
import { LockOutlined, MailOutlined, ArrowLeftOutlined, CopyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import authApi from '../api/authApi';

const { Title, Text } = Typography;

const ForgotPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [stage, setStage] = useState('request'); // 'request' or 'success'
  const [resetData, setResetData] = useState(null);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const data = await authApi.forgotPassword(values.email);
      
      setResetData(data.user);
      
      if (data.user?.role === 'super_admin' && data.resetToken) {
        // Super admin - show reset token
        setStage('super-admin-reset');
        message.success('Reset token generated. You can now reset your password.');
      } else {
        // Non-super-admin - notification sent
        setStage('request-sent');
        message.info('Password reset request has been sent to your Super Admin');
      }
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to process request';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = (token) => {
    navigator.clipboard.writeText(token);
    message.success('Reset token copied to clipboard');
  };

  // Stage: Request Email
  if (stage === 'request') {
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
                Forgot Password?
              </Title>
              <Text type="secondary">
                Enter your email address and we'll help you reset your password
              </Text>
            </div>

            <Form
              form={form}
              name="forgot-password"
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
                <Input 
                  prefix={<MailOutlined />} 
                  placeholder="Email address" 
                  autoFocus 
                />
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
                  Request Password Reset
                </Button>
              </Form.Item>
            </Form>

            <Button 
              type="link" 
              onClick={() => navigate('/login')}
              icon={<ArrowLeftOutlined />}
            >
              Back to Login
            </Button>
          </Space>
        </Card>
      </div>
    );
  }

  // Stage: Request Sent (for non-super-admin)
  if (stage === 'request-sent') {
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
            maxWidth: 500,
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          styles={{ body: { padding: '40px 32px' } }}
        >
          <Result
            status="success"
            title="Password Reset Request Sent"
            subTitle={
              <Space direction="vertical" style={{ textAlign: 'center', marginTop: 16 }}>
                <Text>
                  Your password reset request has been sent to your Super Admin.
                </Text>
                <Text type="secondary">
                  They will review your request and reset your password shortly.
                </Text>
                <Text type="secondary">
                  You will receive a notification once your password has been reset.
                </Text>
                <Text strong style={{ color: '#1890ff', marginTop: 16 }}>
                  Steps:
                </Text>
                <ol style={{ textAlign: 'left', display: 'inline-block' }}>
                  <li>Wait for Super Admin to reset your password</li>
                  <li>You'll get a notification with the new temporary password</li>
                  <li>Login with the new password</li>
                  <li>Change the password on your first login</li>
                </ol>
              </Space>
            }
            extra={
              <Button 
                type="primary" 
                onClick={() => navigate('/login')}
              >
                Back to Login
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // Stage: Super Admin Reset (show reset token)
  if (stage === 'super-admin-reset') {
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
            maxWidth: 550,
            borderRadius: 12,
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}
          styles={{ body: { padding: '40px 32px' } }}
        >
          <Space vertical size="large" style={{ width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <Title level={2} style={{ marginBottom: 4, color: '#7C3AED' }}>
                Reset Your Password
              </Title>
              <Text type="secondary">
                Super Admin can use the reset token below
              </Text>
            </div>

            <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                Reset Token (24 hour expiry):
              </Text>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={resetData?.resetToken}
                  readOnly
                  style={{ fontFamily: 'monospace', fontSize: 12 }}
                />
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyToken(resetData?.resetToken)}
                >
                  Copy
                </Button>
              </Space.Compact>
            </div>

            <Steps
              current={0}
              items={[
                {
                  title: 'Copy Token',
                  description: 'Copy the reset token above',
                },
                {
                  title: 'Go to Reset Page',
                  description: 'Navigate to password reset form',
                },
                {
                  title: 'Enter Token & New Password',
                  description: 'Paste token and set new password',
                },
                {
                  title: 'Login',
                  description: 'Login with new password',
                },
              ]}
              style={{ marginTop: 24 }}
            />

            <div style={{ background: '#e6f7ff', padding: 12, borderRadius: 6, marginTop: 16 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                <strong>Note:</strong> This token is valid for 24 hours. After that, you'll need to request a new one.
              </Text>
            </div>

            <Button 
              type="primary" 
              block
              onClick={() => navigate('/reset-password')}
              style={{ height: 40, borderRadius: 6 }}
            >
              Go to Reset Password
            </Button>

            <Button 
              type="link" 
              onClick={() => navigate('/login')}
              icon={<ArrowLeftOutlined />}
              block
            >
              Back to Login
            </Button>
          </Space>
        </Card>
      </div>
    );
  }
};

export default ForgotPasswordPage;
