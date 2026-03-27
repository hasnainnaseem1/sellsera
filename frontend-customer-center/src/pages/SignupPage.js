import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Form, Input, Button, Divider, Alert, Typography, Progress, theme
} from "antd";
import {
  UserOutlined, MailOutlined, LockOutlined, EyeInvisibleOutlined, EyeTwoTone,
  GoogleOutlined, MoonOutlined, SunOutlined, SafetyCertificateOutlined
} from "@ant-design/icons";
import { useGoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSite } from "../context/SiteContext";
import config from "../config";

const { Title, Text } = Typography;

// Must be rendered INSIDE <GoogleOAuthProvider> — never call useGoogleLogin at the top level
const GoogleSignUpButton = ({ onSuccess, onError }) => {
  const [loading, setLoading] = useState(false);
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      setLoading(true);
      try {
        const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/google`, {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ access_token: tokenResponse.access_token }),
        });
        const data = await res.json();
        if (data.success) {
          onSuccess(data.token, data.user);
        } else {
          onError(data.message || "Google sign-in failed. Please try again.");
        }
      } catch {
        onError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
      }
    },
    onError: () => onError("Google sign-up was cancelled or failed. Please try again."),
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
      Sign up with Google
    </Button>
  );
};

const getStrength = (pw) => {
  let s = 0;
  if (pw.length >= 8)  s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw))   s++;
  if (/[^a-zA-Z\d]/.test(pw)) s++;
  const labels = ["", "Weak", "Fair", "Good", "Strong", "Very Strong"];
  const colors  = ["", "#ff4d4f","#fa8c16","#fadb14","#52c41a","#389e0d"];
  return { score: s, label: labels[s] || "", color: colors[s] || "#ddd", pct: (s / 5) * 100 };
};

const SignupPage = () => {
  const navigate    = useNavigate();
  const { login }   = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { siteConfig, loaded: siteLoaded } = useSite();
  const googleEnabled = !!(siteConfig?.googleSSO?.enabled && siteConfig?.googleSSO?.clientId);
  const signupDisabled = siteLoaded && siteConfig?.enableCustomerSignup === false;
  const { token: tok } = theme.useToken();

  const [form]      = Form.useForm();
  const [loading, setLoading]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [strength, setStrength] = useState({ score: 0, label: "", color: "#ddd", pct: 0 });
  const [branding, setBranding] = useState({ siteName: "AppCenter", tagline: "Start for free  No credit card required" });

  useEffect(() => {
    fetch(`${config.apiUrl}/api/v1/public/site`)
      .then(r => r.json())
      .then(data => {
        if (data.success && data.site) {
          setBranding({
            siteName: data.site.companyName || data.site.siteName || "AppCenter",
            tagline:  data.site.appTagline  || "Start for free  No credit card required",
          });
        }
      }).catch(() => {});
  }, []);

  const handleSubmit = async (values) => {
    setErrorMsg(""); setLoading(true);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/signup`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: values.name, email: values.email, password: values.password }),
      });
      const data = await res.json();
      if (data.success) {
        if (data.token) {
          login(data.token, data.user);
          navigate("/dashboard");
        } else {
          navigate("/verify-email-sent", { state: { email: values.email } });
        }
      } else {
        setErrorMsg(data.message || "Signup failed. Please try again.");
      }
    } catch {
      setErrorMsg("Network error. Please check your connection.");
    } finally { setLoading(false); }
  };

  const pageStyle = {
    minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
    background: isDark
      ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
      : "linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #EDE9FE 100%)",
    padding: "32px 24px 0", position: "relative",
  };
  const cardStyle = {
    width: "100%", maxWidth: 480, background: tok.colorBgContainer,
    borderRadius: tok.borderRadiusLG * 1.5,
    boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 24px 64px rgba(108,99,255,0.15)",
    padding: "40px 40px 32px",
    border: `1px solid ${isDark ? "#2e2e4a" : "rgba(108,99,255,0.12)"}`,
  };

  return (
    <div style={pageStyle}>
      <button onClick={toggleTheme} style={{
        position: "absolute", top: 20, right: 20,
        background: isDark ? "#2e2e4a" : "rgba(108,99,255,0.1)",
        border: "none", borderRadius: 8, padding: "8px 12px",
        cursor: "pointer", color: isDark ? "#e8e8f0" : "#6C63FF", fontSize: 18,
      }} title="Toggle theme">
        {isDark ? <SunOutlined /> : <MoonOutlined />}
      </button>

      <div style={cardStyle}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <a href={config.marketingUrl} style={{ textDecoration: "none" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", justifyContent: "center",
              width: 56, height: 56, borderRadius: 16, marginBottom: 12,
              background: "linear-gradient(135deg, #6C63FF, #A78BFA)",
              boxShadow: "0 8px 24px rgba(108,99,255,0.4)",
            }}>
              <span style={{ color: "#fff", fontWeight: 900, fontSize: 22 }}>
                {branding.siteName.charAt(0).toUpperCase()}
              </span>
            </div>
          </a>
          <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Create your account</Title>
          <Text type="secondary">{branding.tagline}</Text>
        </div>

        {/* Signup disabled message */}
        {signupDisabled && (
          <Alert
            type="warning"
            message="Signup Disabled"
            description="Customer signup is currently disabled by the administrator. Please contact support for assistance."
            showIcon
            style={{ marginBottom: 20, borderRadius: tok.borderRadius }}
          />
        )}

        {errorMsg && <Alert type="error" message={errorMsg} showIcon style={{ marginBottom: 20, borderRadius: tok.borderRadius }} />}

        <Form form={form} layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
          <Form.Item name="name" label={<Text strong>Full Name</Text>}
            rules={[{ required: true, message: "Name is required" }, { min: 2, message: "At least 2 characters" }]}>
            <Input prefix={<UserOutlined style={{ color: tok.colorTextTertiary }} />} placeholder="John Doe" />
          </Form.Item>

          <Form.Item name="email" label={<Text strong>Email Address</Text>}
            rules={[{ required: true, message: "Email is required" }, { type: "email", message: "Enter a valid email" }]}>
            <Input prefix={<MailOutlined style={{ color: tok.colorTextTertiary }} />} placeholder="you@example.com" />
          </Form.Item>

          <Form.Item name="password" label={<Text strong>Password</Text>}
            rules={[{ required: true, message: "Password is required" }, { min: 8, message: "At least 8 characters" }]}
            style={{ marginBottom: 6 }}>
            <Input.Password
              prefix={<LockOutlined style={{ color: tok.colorTextTertiary }} />}
              placeholder="Create a strong password"
              iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
              onChange={e => setStrength(getStrength(e.target.value))}
            />
          </Form.Item>

          {strength.score > 0 && (
            <div style={{ marginBottom: 16 }}>
              <Progress percent={strength.pct} showInfo={false} strokeColor={strength.color} size="small" />
              <Text style={{ fontSize: 12, color: strength.color }}>{strength.label} password</Text>
            </div>
          )}

          <Form.Item name="confirmPassword" label={<Text strong>Confirm Password</Text>}
            dependencies={["password"]}
            rules={[
              { required: true, message: "Please confirm your password" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) return Promise.resolve();
                  return Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}>
            <Input.Password
              prefix={<SafetyCertificateOutlined style={{ color: tok.colorTextTertiary }} />}
              placeholder="Repeat your password"
              iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
            />
          </Form.Item>

          <Form.Item name="terms" valuePropName="checked"
            rules={[{ validator: (_, value) => value ? Promise.resolve() : Promise.reject(new Error("Please accept terms")) }]}>
            <div style={{ fontSize: 13 }}>
              <input type="checkbox" id="terms" onChange={e => form.setFieldValue("terms", e.target.checked)} style={{ marginRight: 8 }} />
              <label htmlFor="terms" style={{ color: tok.colorText }}>
                I agree to the{" "}
                <a href={`${config.marketingUrl}/terms`} target="_blank" rel="noreferrer" style={{ color: tok.colorPrimary }}>Terms</a>
                {" "}and{" "}
                <a href={`${config.marketingUrl}/privacy`} target="_blank" rel="noreferrer" style={{ color: tok.colorPrimary }}>Privacy Policy</a>
              </label>
            </div>
          </Form.Item>

          <Form.Item style={{ marginBottom: 12 }}>
            <Button type="primary" htmlType="submit" loading={loading} disabled={signupDisabled} block style={{
              height: 48, fontWeight: 700, fontSize: 16,
              background: signupDisabled ? undefined : "linear-gradient(90deg, #6C63FF, #A78BFA)",
              border: "none", boxShadow: signupDisabled ? undefined : "0 4px 16px rgba(108,99,255,0.4)",
            }}>
              Create Account
            </Button>
          </Form.Item>
        </Form>

        {googleEnabled && !signupDisabled && (
          <>
            <Divider plain><Text type="secondary" style={{ fontSize: 12 }}>Or continue with</Text></Divider>
            <GoogleSignUpButton
              onSuccess={(token, user) => { login(token, user); navigate("/dashboard"); }}
              onError={(msg) => setErrorMsg(msg)}
            />
          </>
        )}

        <div style={{ textAlign: "center" }}>
          <Text type="secondary">Already have an account?{" "}</Text>
          <Link to="/login" style={{ color: tok.colorPrimary, fontWeight: 600 }}>Sign in</Link>
        </div>
      </div>

      {/* Legal footer — Etsy API TOS §2 compliance */}
      <div style={{
        width: '100%', maxWidth: 540,
        textAlign: 'center', padding: '20px 24px',
        marginTop: 24,
      }}>
        <div style={{ marginBottom: 8 }}>
          <a href={`${config.marketingUrl}/privacy`} target="_blank" rel="noreferrer"
            style={{ color: isDark ? '#9999b8' : '#777', fontSize: 13, marginRight: 20, textDecoration: 'none' }}>Privacy Policy</a>
          <a href={`${config.marketingUrl}/terms`} target="_blank" rel="noreferrer"
            style={{ color: isDark ? '#9999b8' : '#777', fontSize: 13, marginRight: 20, textDecoration: 'none' }}>Terms of Service</a>
          {siteConfig?.contactEmail && (
            <a href={`mailto:${siteConfig.contactEmail}`}
              style={{ color: isDark ? '#9999b8' : '#777', fontSize: 13, textDecoration: 'none' }}>{siteConfig.contactEmail}</a>
          )}
        </div>
        <Text style={{ fontSize: 12, color: isDark ? '#8888a8' : '#888' }}>
          The term &ldquo;Etsy&rdquo; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
        </Text>
      </div>
    </div>
  );
};

export default SignupPage;
