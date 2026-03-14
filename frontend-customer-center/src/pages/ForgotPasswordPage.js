import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Form, Input, Button, Alert, Typography, Result, theme } from "antd";
import { MailOutlined, ArrowLeftOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "../context/ThemeContext";
import config from "../config";

const { Title, Text } = Typography;

const ForgotPasswordPage = () => {
  const { isDark, toggleTheme } = useTheme();
  const { token: tok } = theme.useToken();
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [branding, setBranding] = useState({ siteName: "AppCenter" });

  useEffect(() => {
    fetch(`${config.apiUrl}/api/v1/public/site`).then(r => r.json()).then(data => {
      if (data.success && data.site) setBranding({ siteName: data.site.companyName || data.site.siteName || "AppCenter" });
    }).catch(() => {});
  }, []);

  const handleSubmit = async (values) => {
    setErrorMsg(""); setLoading(true);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/forgot-password`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: values.email }),
      });
      const data = await res.json();
      if (data.success) { setSent(true); }
      else { setErrorMsg(data.message || "Something went wrong."); }
    } catch { setErrorMsg("Network error. Please try again."); }
    finally  { setLoading(false); }
  };

  const pageStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: isDark
      ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
      : "linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #EDE9FE 100%)",
    padding: "24px", position: "relative",
  };
  const cardStyle = {
    width: "100%", maxWidth: 440, background: tok.colorBgContainer,
    borderRadius: tok.borderRadiusLG * 1.5,
    boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 24px 64px rgba(108,99,255,0.15)",
    padding: "40px", border: `1px solid ${isDark ? "#2e2e4a" : "rgba(108,99,255,0.12)"}`,
  };

  return (
    <div style={pageStyle}>
      <button onClick={toggleTheme} style={{
        position: "absolute", top: 20, right: 20, background: isDark ? "#2e2e4a" : "rgba(108,99,255,0.1)",
        border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer",
        color: isDark ? "#e8e8f0" : "#6C63FF", fontSize: 18,
      }}>{isDark ? <SunOutlined /> : <MoonOutlined />}</button>

      <div style={cardStyle}>
        {sent ? (
          <Result
            status="success"
            title="Check your inbox!"
            subTitle="If an account with that email exists, we have sent a password reset link. Check your spam folder too."
            extra={<Link to="/login"><Button type="primary" style={{ background: "linear-gradient(90deg,#6C63FF,#A78BFA)", border: "none" }}>Back to Login</Button></Link>}
          />
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                width: 56, height: 56, borderRadius: 16, marginBottom: 12,
                background: "linear-gradient(135deg, #6C63FF, #A78BFA)", boxShadow: "0 8px 24px rgba(108,99,255,0.4)",
              }}>
                <span style={{ color: "#fff", fontWeight: 900, fontSize: 22 }}>{branding.siteName.charAt(0).toUpperCase()}</span>
              </div>
              <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Forgot password?</Title>
              <Text type="secondary">Enter your email and we will send you a reset link</Text>
            </div>

            {errorMsg && <Alert type="error" message={errorMsg} showIcon style={{ marginBottom: 20, borderRadius: tok.borderRadius }} />}

            <Form layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
              <Form.Item name="email" label={<Text strong>Email Address</Text>}
                rules={[{ required: true, message: "Email is required" }, { type: "email", message: "Enter a valid email" }]}>
                <Input prefix={<MailOutlined style={{ color: tok.colorTextTertiary }} />} placeholder="you@example.com" />
              </Form.Item>
              <Form.Item style={{ marginBottom: 16 }}>
                <Button type="primary" htmlType="submit" loading={loading} block style={{
                  height: 48, fontWeight: 700, fontSize: 16,
                  background: "linear-gradient(90deg, #6C63FF, #A78BFA)", border: "none",
                  boxShadow: "0 4px 16px rgba(108,99,255,0.4)",
                }}>Send Reset Link</Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: "center" }}>
              <Link to="/login" style={{ color: tok.colorPrimary, fontWeight: 500 }}>
                <ArrowLeftOutlined style={{ marginRight: 6 }} />Back to Login
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
