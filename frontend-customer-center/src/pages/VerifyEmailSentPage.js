import React, { useState } from "react";
import { useLocation, Link } from "react-router-dom";
import { Typography, Button, Alert, theme } from "antd";
import { MailOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "../context/ThemeContext";
import config from "../config";

const { Title, Text } = Typography;

const VerifyEmailSentPage = () => {
  const location  = useLocation();
  const email     = location.state?.email || "";
  const { isDark, toggleTheme } = useTheme();
  const { token: tok } = theme.useToken();

  const [resending, setResending]     = useState(false);
  const [resendStatus, setResendStatus] = useState(null);

  const handleResend = async () => {
    if (!email) return;
    setResending(true); setResendStatus(null);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/resend-verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setResendStatus(data.success ? "success" : "error");
    } catch { setResendStatus("error"); }
    finally  { setResending(false); }
  };

  const pageStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: isDark
      ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
      : "linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #EDE9FE 100%)",
    padding: "24px", position: "relative",
  };
  const cardStyle = {
    width: "100%", maxWidth: 460, background: tok.colorBgContainer,
    borderRadius: tok.borderRadiusLG * 1.5,
    boxShadow: isDark ? "0 24px 64px rgba(0,0,0,0.6)" : "0 24px 64px rgba(108,99,255,0.15)",
    padding: "48px 40px", border: `1px solid ${isDark ? "#2e2e4a" : "rgba(108,99,255,0.12)"}`,
    textAlign: "center",
  };

  return (
    <div style={pageStyle}>
      <button onClick={toggleTheme} style={{
        position: "absolute", top: 20, right: 20, background: isDark ? "#2e2e4a" : "rgba(108,99,255,0.1)",
        border: "none", borderRadius: 8, padding: "8px 12px", cursor: "pointer",
        color: isDark ? "#e8e8f0" : "#6C63FF", fontSize: 18,
      }}>{isDark ? <SunOutlined /> : <MoonOutlined />}</button>

      <div style={cardStyle}>
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          width: 72, height: 72, borderRadius: "50%", marginBottom: 20,
          background: "linear-gradient(135deg, #6C63FF, #A78BFA)", boxShadow: "0 8px 24px rgba(108,99,255,0.4)",
        }}>
          <MailOutlined style={{ color: "#fff", fontSize: 30 }} />
        </div>

        <Title level={2} style={{ marginTop: 0, marginBottom: 8 }}>Check your inbox</Title>
        <Text type="secondary" style={{ display: "block", marginBottom: 8 }}>
          We sent a verification link to:
        </Text>
        {email ? (
          <Text strong style={{ color: tok.colorPrimary, fontSize: 16, display: "block", marginBottom: 20, wordBreak: "break-all" }}>
            {email}
          </Text>
        ) : (
          <Alert
            type="warning" showIcon
            message="No email address found"
            description="Please go back and sign up first, or use the login page to resend verification."
            style={{ marginBottom: 20, borderRadius: tok.borderRadius, textAlign: 'left' }}
          />
        )}
        <Text type="secondary" style={{ display: "block", marginBottom: 28, fontSize: 13 }}>
          Click the link in the email to activate your account. If you don't see it, check your spam folder.
        </Text>

        {resendStatus === "success" && <Alert type="success" message="Verification email resent!" showIcon style={{ marginBottom: 16, borderRadius: tok.borderRadius }} />}
        {resendStatus === "error"   && <Alert type="error"   message="Failed to resend. Please try again." showIcon style={{ marginBottom: 16, borderRadius: tok.borderRadius }} />}

        <Button
          type="primary" onClick={handleResend} loading={resending} disabled={!email || resendStatus === "success"} block
          style={{ height: 46, fontWeight: 600, background: "linear-gradient(90deg,#6C63FF,#A78BFA)", border: "none", marginBottom: 16 }}
        >
          Resend verification email
        </Button>

        <Link to="/login" style={{ color: tok.colorPrimary, fontSize: 13 }}> Back to login</Link>
      </div>
    </div>
  );
};

export default VerifyEmailSentPage;
