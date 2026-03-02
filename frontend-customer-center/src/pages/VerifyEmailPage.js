import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Typography, Button, Spin, Result, Alert, Input, theme } from "antd";
import { MailOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "../context/ThemeContext";
import config from "../config";

const { Text } = Typography;

const ResendForm = ({ tok }) => {
  const [email, setEmail]     = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent]       = useState(false);
  const [err, setErr]         = useState("");
  const [alreadyVerified, setAlreadyVerified] = useState(false);

  const handleResend = async () => {
    if (!email) return;
    setSending(true); setErr(""); setAlreadyVerified(false);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/resend-verification`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (data.success) {
        setSent(true);
      } else if (data.action === "login" || (data.message && data.message.toLowerCase().includes("already verified"))) {
        setAlreadyVerified(true);
      } else {
        setErr(data.message || "Could not resend. Please try again.");
      }
    } catch { setErr("Network error."); }
    finally  { setSending(false); }
  };

  if (sent) return <Text style={{ color: "#52c41a" }}> Verification email sent — check your inbox!</Text>;
  
  if (alreadyVerified) return (
    <div style={{ textAlign: "center" }}>
      <Text style={{ color: "#52c41a", fontSize: 15, display: "block", marginBottom: 12 }}>
        ✅ Good news! Your email is already verified.
      </Text>
      <Button type="primary" href="/login"
        style={{ background: "linear-gradient(90deg,#6C63FF,#4facfe)", border: "none", fontWeight: 600 }}>
        Go to Login
      </Button>
    </div>
  );

  return (
    <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
      <Input
        type="email" placeholder="Enter your email"
        value={email} onChange={e => setEmail(e.target.value)}
        prefix={<MailOutlined style={{ color: tok.colorTextTertiary }} />}
        style={{ flex: 1, minWidth: 200 }}
      />
      <Button
        type="primary" onClick={handleResend} loading={sending}
        style={{ background: "linear-gradient(90deg,#6C63FF,#4facfe)", border: "none", fontWeight: 600 }}
      >
        Resend Link
      </Button>
      {err && <Text type="danger" style={{ fontSize: 12, width: "100%" }}>{err}</Text>}
    </div>
  );
};

const VerifyEmailPage = () => {
  const { token }  = useParams();
  const navigate   = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { token: tok } = theme.useToken();

  const [status, setStatus]   = useState("verifying");
  const [message, setMessage] = useState("");
  const hasCalled = useRef(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("Invalid verification link."); return; }
    if (hasCalled.current) return;
    hasCalled.current = true;

    (async () => {
      try {
        const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/verify-email/${token}`);
        const data = await res.json();
        if (data.success) {
          setStatus("success"); setMessage(data.message || "Email verified successfully!");
          setTimeout(() => navigate("/login"), 3000);
        } else {
          setStatus("error"); setMessage(data.message || "Verification failed. The link may have expired.");
        }
      } catch { setStatus("error"); setMessage("Network error. Please try again."); }
    })();
  }, [token, navigate]);

  const pageStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: isDark
      ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
      : "linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #dbeafe 100%)",
    padding: "24px", position: "relative",
  };
  const cardStyle = {
    width: "100%", maxWidth: 480, background: tok.colorBgContainer,
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
        {status === "verifying" && (
          <>
            <Spin size="large" style={{ marginBottom: 24 }} />
            <Typography.Title level={3} style={{ marginTop: 0 }}>Verifying your email</Typography.Title>
            <Text type="secondary">Please wait a moment.</Text>
          </>
        )}
        {status === "success" && (
          <Result status="success" title="Email Verified!" subTitle={`${message} Redirecting to login in 3 seconds`}
            extra={<Button type="primary" onClick={() => navigate("/login")} style={{ background: "linear-gradient(90deg,#6C63FF,#4facfe)", border: "none" }}>Go to Login</Button>} />
        )}
        {status === "error" && (
          <>
            <Result status="error" title="Verification Failed" subTitle={message} />
            <Alert
              type="warning" showIcon
              message="Link expired or already used?"
              description={<ResendForm tok={tok} />}
              style={{ textAlign: "left", marginBottom: 16, borderRadius: tok.borderRadius }}
            />
            <Link to="/login"><Button type="default">Back to Login</Button></Link>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
