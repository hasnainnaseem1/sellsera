import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Result } from 'antd';
import { LockOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import authApi from '../api/authApi';

const { Title, Text } = Typography;

const ResetPasswordPage = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const [stage, setStage] = useState('reset'); // 'reset' or 'success'
  const navigate = useNavigate();

  const onFinish = async (values) => {
    if (values.newPassword !== values.confirmPassword) {
      message.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(values.resetToken, values.newPassword, values.confirmPassword);
      setStage('success');
      message.success('Password reset successfully');
    } catch (error) {
      const msg = error.response?.data?.message || 'Failed to reset password';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  // Stage: Reset Password Form
  if (stage === 'reset') {
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
                Reset Password
              </Title>
              <Text type="secondary">
                Enter your reset token and new password
              </Text>
            </div>

            <Form
              form={form}
              name="reset-password"
              onFinish={onFinish}
              layout="vertical"
              size="large"
              requiredMark={false}
              style={{ textAlign: 'left' }}
            >
              <Form.Item
                name="resetToken"
                label="Reset Token"
                rules={[
                  { required: true, message: 'Please enter your reset token' },
                  { min: 10, message: 'Invalid reset token format' }
                ]}
              >
                <Input 
                  placeholder="Paste your reset token here" 
                  autoFocus
                  style={{ fontFamily: 'monospace' }}
                />
              </Form.Item>

              <Form.Item
                name="newPassword"
                label="New Password"
                rules={[
                  { required: true, message: 'Please enter your new password' },
                  { min: 8, message: 'Password must be at least 8 characters' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Create a strong password" 
                />
              </Form.Item>

              <Form.Item
                name="confirmPassword"
                label="Confirm Password"
                rules={[
                  { required: true, message: 'Please confirm your password' }
                ]}
              >
                <Input.Password 
                  prefix={<LockOutlined />} 
                  placeholder="Confirm your password" 
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
                  Reset Password
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

  // Stage: Success
  if (stage === 'success') {
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
            title="Password Reset Successful"
            subTitle="Your password has been reset successfully. You can now login with your new password."
            extra={
              <Button 
                type="primary" 
                onClick={() => navigate('/login')}
              >
                Go to Login
              </Button>
            }
          />
        </Card>
      </div>
    );
  }
};

export default ResetPasswordPage;
