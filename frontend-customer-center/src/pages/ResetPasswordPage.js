import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Form, Input, Button, Alert, Typography, Result, Progress, theme } from "antd";
import { LockOutlined, EyeInvisibleOutlined, EyeTwoTone, SafetyCertificateOutlined, MoonOutlined, SunOutlined } from "@ant-design/icons";
import { useTheme } from "../context/ThemeContext";
import config from "../config";

const { Title, Text } = Typography;

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

const ResetPasswordPage = () => {
  const { token: urlToken } = useParams();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const { token: tok } = theme.useToken();

  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [expired, setExpired]   = useState(false);
  const [strength, setStrength] = useState({ score: 0, label: "", color: "#ddd", pct: 0 });

  const handleSubmit = async (values) => {
    setErrorMsg(""); setLoading(true);
    try {
      const res  = await fetch(`${config.apiUrl}/api/v1/auth/customer/reset-password/${urlToken}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: values.password }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccess(true);
        setTimeout(() => navigate("/login"), 3000);
      } else if (res.status === 400) {
        setExpired(true);
        setErrorMsg(data.message || "Reset link has expired. Please request a new one.");
      } else {
        setErrorMsg(data.message || "Failed to reset password.");
      }
    } catch { setErrorMsg("Network error. Please try again."); }
    finally  { setLoading(false); }
  };

  const pageStyle = {
    minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
    background: isDark
      ? "linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)"
      : "linear-gradient(135deg, #f0f0ff 0%, #e8e4ff 50%, #dbeafe 100%)",
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
        {success ? (
          <Result status="success" title="Password reset!" subTitle="You will be redirected to login in 3 seconds"
            extra={<Link to="/login"><Button type="primary" style={{ background: "linear-gradient(90deg,#6C63FF,#4facfe)", border: "none" }}>Go to Login</Button></Link>} />
        ) : (
          <>
            <div style={{ textAlign: "center", marginBottom: 28 }}>
              <Title level={2} style={{ margin: 0, fontWeight: 700 }}>Set new password</Title>
              <Text type="secondary">Choose a strong password for your account</Text>
            </div>

            {errorMsg && (
              <Alert type="error" message={errorMsg} showIcon style={{ marginBottom: 20, borderRadius: tok.borderRadius }}
                action={expired ? <Link to="/forgot-password"><Button size="small" type="link">Request new link</Button></Link> : null} />
            )}

            <Form layout="vertical" onFinish={handleSubmit} size="large" requiredMark={false}>
              <Form.Item name="password" label={<Text strong>New Password</Text>}
                rules={[{ required: true, message: "Password is required" }, { min: 8, message: "At least 8 characters" }]}
                style={{ marginBottom: 6 }}>
                <Input.Password
                  prefix={<LockOutlined style={{ color: tok.colorTextTertiary }} />}
                  placeholder="New strong password"
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

              <Form.Item name="confirmPassword" label={<Text strong>Confirm New Password</Text>}
                dependencies={["password"]}
                rules={[
                  { required: true, message: "Please confirm" },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) return Promise.resolve();
                      return Promise.reject(new Error("Passwords do not match"));
                    },
                  }),
                ]}>
                <Input.Password
                  prefix={<SafetyCertificateOutlined style={{ color: tok.colorTextTertiary }} />}
                  placeholder="Repeat new password"
                  iconRender={v => (v ? <EyeTwoTone /> : <EyeInvisibleOutlined />)}
                />
              </Form.Item>

              <Form.Item style={{ marginBottom: 16 }}>
                <Button type="primary" htmlType="submit" loading={loading} block style={{
                  height: 48, fontWeight: 700, fontSize: 16,
                  background: "linear-gradient(90deg, #6C63FF, #4facfe)", border: "none",
                  boxShadow: "0 4px 16px rgba(108,99,255,0.4)",
                }}>Reset Password</Button>
              </Form.Item>
            </Form>

            <div style={{ textAlign: 'center', marginTop: 8 }}>
              <Link to="/login" style={{ color: tok.colorPrimary, fontSize: 13 }}>← Back to Login</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResetPasswordPage;
