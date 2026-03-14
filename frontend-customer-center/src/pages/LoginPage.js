import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Form, Input, Button, Checkbox, Divider, Alert, Typography, theme
} from 'antd';
import {
  MailOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone,
  GoogleOutlined, MoonOutlined, SunOutlined
} from '@ant-design/icons';
import { useGoogleLogin } from '@react-oauth/google';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSite } from '../context/SiteContext';
import config from '../config';

const { Title, Text } = Typography;

// Must be rendered INSIDE <GoogleOAuthProvider> — never call useGoogleLogin at the top level
const GoogleSignInButton = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/google`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (data.success) {
          onSuccess(data.token, data.user);
        } else {
          onError(data.message || 'Google sign-in failed. Please try again.');
        }
      } catch {
        onError('Network error. Please check your connection.');
      } finally {
        setLoading(false);
      }
    },
    onError: () => onError('Google sign-in was cancelled or failed. Please try again.'),
  });
  return (
    <Button
      icon={<GoogleOutlined />}
      block
      size="large"
      loading={loading}
      onClick={() => googleLogin()}
      style={{ height: 46, fontWeight: 600, marginBottom: 24 }}
    >
      Sign in with Google
    </Button>
  );
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { siteConfig, loaded: siteLoaded } = useSite();
  const googleEnabled = !!(siteConfig?.googleSSO?.enabled && siteConfig?.googleSSO?.clientId);
  const loginDisabled = siteLoaded && siteConfig?.enableLogin === false;
  const { token: tok } = theme.useToken();

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [actionData, setActionData] = useState(null);
  const [branding, setBranding] = useState({ siteName: 'AppCenter', tagline: 'Sign in to your account' });

  useEffect(() => {
    fetch(`${config.apiUrl}/api/v1/public/site`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.site) {
          setBranding({
            siteName: data.site.companyName || data.site.siteName || 'AppCenter',
            tagline:  data.site.appTagline  || 'Sign in to your account',
          });
        }
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (values) => {
    setErrorMsg('');
    setActionData(null);
    setLoading(true);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/login`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: values.email, password: values.password }),
      });
      const data = await res.json();

      if (data.success) {
        login(data.token, data.user);
        navigate('/dashboard');
      } else if (data.emailVerificationRequired) {
        setActionData({ action: 'verify_email', email: values.email });
        setErrorMsg(data.message || 'Please verify your email first.');
      } else if (data.action === 'signup') {
        setActionData({ action: 'signup' });
        setErrorMsg(data.message || 'No account found. Please sign up.');
      } else {
        setErrorMsg(data.message || 'Login failed. Please try again.');
      }
    } catch {
      setErrorMsg('Network error. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const pageStyle = {
    minHeight:   '100vh',
    display:     'flex',
    alignItems:  'center',
    justifyContent: 'center',
    background:  isDark
      ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)'
      : 'linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #EDE9FE 100%)',
    padding:     '24px',
    position:    'relative',
  };

  const cardStyle = {
    width:            '100%',
    maxWidth:         440,
    background:       tok.colorBgContainer,
    borderRadius:     tok.borderRadiusLG * 1.5,
    boxShadow:        isDark
      ? '0 24px 64px rgba(0,0,0,0.6)'
      : '0 24px 64px rgba(108,99,255,0.15)',
    padding:          '40px 40px 32px',
    border:           `1px solid ${isDark ? '#2e2e4a' : 'rgba(108,99,255,0.12)'}`,
  };

  return (
    <div style={pageStyle}>
      {/* Theme toggle */}
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute', top: 20, right: 20,
          background: isDark ? '#2e2e4a' : 'rgba(108,99,255,0.1)',
          border: 'none', borderRadius: 8, padding: '8px 12px',
          cursor: 'pointer', color: isDark ? '#e8e8f0' : '#6C63FF',
          fontSize: 18,
        }}
        title="Toggle theme"
      >
        {isDark ? <SunOutlined /> : <MoonOutlined />}
      </button>

      <div style={cardStyle}>
        {/* Login disabled message */}
        {loginDisabled && (
          <Alert
            type="warning"
            message="Login Disabled"
            description="Customer login is currently disabled by the administrator. Please contact support for assistance."
            showIcon
            style={{ marginBottom: 24, borderRadius: tok.borderRadius }}
          />
        )}

        {/* Logo + heading */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <a href={config.marketingUrl} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 56, height: 56, borderRadius: 16, marginBottom: 12,
              background: 'linear-gradient(135deg, #6C63FF, #A78BFA)',
              boxShadow: '0 8px 24px rgba(108,99,255,0.4)',
            }}>
              <span style={{ color: '#fff', fontWeight: 900, fontSize: 22 }}>
                {branding.siteName.charAt(0).toUpperCase()}
              </span>
            </div>
          </a>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Welcome back</Title>
          <Text type="secondary">{branding.tagline}</Text>
        </div>

        {/* Error banner */}
        {errorMsg && (
          <Alert
            type="error"
            message={errorMsg}
            showIcon
            style={{ marginBottom: 20, borderRadius: tok.borderRadius }}
            action={
              actionData?.action === 'verify_email' ? (
                <Button size="small" type="link" onClick={() =>
                  navigate('/verify-email-sent', { state: { email: actionData.email } })
                }>
                  Resend link
                </Button>
              ) : actionData?.action === 'signup' ? (
                <Button size="small" type="link" onClick={() => navigate('/signup')}>
                  Sign up
                </Button>
              ) : null
            }
          />
        )}

        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
          <Form.Item
            name="email"
            label={<Text strong>Email Address</Text>}
            rules={[
              { required: true, message: 'Email is required' },
              { type: 'email',  message: 'Enter a valid email' },
            ]}
          >
            <Input prefix={<MailOutlined style={{ color: tok.colorTextTertiary }} />} placeholder="you@example.com" />
          </Form.Item>

          <Form.Item
            name="password"
            label={<Text strong>Password</Text>}
            rules={[{ required: true, message: 'Password is required' }]}
            style={{ marginBottom: 8 }}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: tok.colorTextTertiary }} />}
              placeholder="Enter your password"
              iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
            <Form.Item name="rememberMe" valuePropName="checked" noStyle>
              <Checkbox>Remember me</Checkbox>
            </Form.Item>
            <Link to="/forgot-password" style={{ color: tok.colorPrimary, fontWeight: 500 }}>
              Forgot password?
            </Link>
          </div>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              disabled={loginDisabled}
              block
              style={{
                height: 48, fontWeight: 700, fontSize: 16,
                background: loginDisabled ? undefined : 'linear-gradient(90deg, #6C63FF, #A78BFA)',
                border: 'none',
                boxShadow: loginDisabled ? undefined : '0 4px 16px rgba(108,99,255,0.4)',
              }}
            >
              Sign In
            </Button>
          </Form.Item>
        </Form>

        {googleEnabled && !loginDisabled && (
          <>
            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>Or continue with</Text></Divider>
            <GoogleSignInButton
              onSuccess={(token, user) => { login(token, user); navigate('/dashboard'); }}
              onError={(msg) => setErrorMsg(msg)}
            />
          </>
        )}

        <div style={{ textAlign: 'center' }}>
          <Text type="secondary">Don't have an account?{' '}</Text>
          {siteConfig?.enableCustomerSignup !== false ? (
            <Link to="/signup" style={{ color: tok.colorPrimary, fontWeight: 600 }}>
              Sign up for free
            </Link>
          ) : (
            <Text type="secondary">Signup is currently disabled</Text>
          )}
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
