import React, { useState } from "react";
import {
  Row, Col, Card, Form, Input, Button, Avatar, Typography, Tabs,
  Statistic, Progress, Tag, Alert, Space, Divider, theme,
} from "antd";
import {
  UserOutlined, LockOutlined, CrownOutlined, ThunderboltOutlined,
  MailOutlined, PhoneOutlined, CalendarOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined,
} from "@ant-design/icons";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import config from "../config";

const { Title, Text, Paragraph } = Typography;
const { Password } = Input;
const BRAND = "#6C63FF";

/* ───── password strength helper ───── */
const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const map = [
    { label: "Weak",    color: "#ff4d4f", pct: 25  },
    { label: "Fair",    color: "#faad14", pct: 50  },
    { label: "Good",    color: "#1677ff", pct: 75  },
    { label: "Strong",  color: "#52c41a", pct: 100 },
  ];
  return { score, ...map[score - 1] || { label: "", color: BRAND, pct: 0 } };
};

const ProfilePage = () => {
  const { user, token, updateUser } = useAuth();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();

  const [profileForm] = Form.useForm();
  const [pwdForm]     = Form.useForm();

  const [profileMsg, setProfileMsg] = useState(null);
  const [pwdMsg,     setPwdMsg]     = useState(null);
  const [saving,     setSaving]     = useState(false);
  const [changingPwd,setChangingPwd] = useState(false);
  const [newPwd,     setNewPwd]     = useState("");

  const pwdStrength = getStrength(newPwd);

  const card = {
    border: `1px solid ${isDark ? "#2e2e4a" : "#ebebf8"}`,
    borderRadius: 16,
    background: tok.colorBgContainer,
    boxShadow: isDark ? "none" : "0 2px 12px rgba(108,99,255,0.06)",
  };

  const gradBtn = {
    background: "linear-gradient(90deg,#6C63FF,#4facfe)",
    border: "none",
    fontWeight: 700,
    height: 44,
    boxShadow: "0 4px 14px rgba(108,99,255,0.35)",
  };

  /* ── save profile ── */
  const handleSaveProfile = async (values) => {
    setProfileMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/auth/customer/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name: values.name, phone: values.phone }),
      });
      const data = await res.json();
      if (data.success) {
        updateUser({ name: data.user.name, phone: data.user.phone });
        setProfileMsg({ type: "success", text: "Profile updated successfully!" });
      } else {
        setProfileMsg({ type: "error", text: data.message || "Failed to update profile." });
      }
    } catch {
      setProfileMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  /* ── change password ── */
  const handleChangePwd = async (values) => {
    setPwdMsg(null);
    setChangingPwd(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/auth/customer/me/password`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPwdMsg({ type: "success", text: "Password changed successfully!" });
        pwdForm.resetFields();
        setNewPwd("");
      } else {
        setPwdMsg({ type: "error", text: data.message || "Failed to change password." });
      }
    } catch {
      setPwdMsg({ type: "error", text: "Network error. Please try again." });
    } finally {
      setChangingPwd(false);
    }
  };

  const usagePct = user ? Math.round((user.analysisCount / (user.analysisLimit || 1)) * 100) : 0;

  /* ────────── tabs ────────── */
  const tabs = [
    {
      key: "personal",
      label: <span><EditOutlined style={{ marginRight: 6 }} />Personal Info</span>,
      children: (
        <Card style={card} styles={{ body: { padding: "28px 32px" } }}>
          {/* Avatar + name header */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28 }}>
            <Avatar size={72} style={{ background: "linear-gradient(135deg,#6C63FF,#4facfe)", fontSize: 28, fontWeight: 700 }}>
              {user?.name?.[0]?.toUpperCase() || "U"}
            </Avatar>
            <div>
              <Title level={4} style={{ margin: 0 }}>{user?.name}</Title>
              <Text type="secondary" style={{ fontSize: 13 }}>{user?.email}</Text>
              <div style={{ marginTop: 4 }}>
                <Tag color={user?.isEmailVerified ? "success" : "warning"} icon={user?.isEmailVerified ? <CheckCircleOutlined /> : <MailOutlined />}>
                  {user?.isEmailVerified ? "Verified" : "Unverified"}
                </Tag>
              </div>
            </div>
          </div>
          <Divider style={{ margin: "0 0 24px" }} />

          {profileMsg && (
            <Alert type={profileMsg.type} message={profileMsg.text} showIcon
              style={{ marginBottom: 20, borderRadius: tok.borderRadius }} closable onClose={() => setProfileMsg(null)} />
          )}

          <Form
            form={profileForm}
            layout="vertical"
            onFinish={handleSaveProfile}
            requiredMark={false}
            initialValues={{ name: user?.name, email: user?.email, phone: user?.phone || "" }}
          >
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item name="name" label={<Text strong>Full Name</Text>}
                  rules={[{ required: true, message: "Name is required" }, { min: 2, message: "Min 2 characters" }]}>
                  <Input prefix={<UserOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="Your full name" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="email" label={<Text strong>Email Address</Text>}>
                  <Input prefix={<MailOutlined style={{ color: tok.colorTextQuaternary }} />} size="large"
                    value={user?.email} disabled style={{ opacity: 0.7 }} />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item name="phone" label={<Text strong>Phone <Text type="secondary" style={{ fontWeight: 400 }}>(optional)</Text></Text>}>
                  <Input prefix={<PhoneOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="+1 555 000 0000" />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label={<Text strong>Member Since</Text>}>
                  <Input prefix={<CalendarOutlined style={{ color: tok.colorTextQuaternary }} />} size="large"
                    value={user?.createdAt ? new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "—"}
                    disabled style={{ opacity: 0.7 }} />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={saving} size="large" style={gradBtn} icon={<SaveOutlined />}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: "password",
      label: <span><LockOutlined style={{ marginRight: 6 }} />Security</span>,
      children: (
        <Card style={card} styles={{ body: { padding: "28px 32px" } }}>
          <Title level={5} style={{ margin: "0 0 6px" }}>Change Password</Title>
          <Paragraph type="secondary" style={{ margin: "0 0 24px", fontSize: 13 }}>
            Use a strong, unique password with at least 8 characters.
          </Paragraph>

          {pwdMsg && (
            <Alert type={pwdMsg.type} message={pwdMsg.text} showIcon
              style={{ marginBottom: 20, borderRadius: tok.borderRadius }} closable onClose={() => setPwdMsg(null)} />
          )}

          <Form form={pwdForm} layout="vertical" onFinish={handleChangePwd} requiredMark={false} style={{ maxWidth: 480 }}>
            <Form.Item name="currentPassword" label={<Text strong>Current Password</Text>}
              rules={[{ required: true, message: "Current password is required" }]}>
              <Password prefix={<LockOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="••••••••" />
            </Form.Item>
            <Form.Item name="newPassword" label={<Text strong>New Password</Text>}
              rules={[{ required: true, message: "New password is required" }, { min: 8, message: "Minimum 8 characters" }]}>
              <Password prefix={<LockOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="••••••••"
                onChange={(e) => setNewPwd(e.target.value)} />
            </Form.Item>
            {newPwd && (
              <div style={{ marginTop: -16, marginBottom: 16 }}>
                <Progress percent={pwdStrength.pct} showInfo={false}
                  strokeColor={pwdStrength.color} size="small" />
                <Text style={{ fontSize: 12, color: pwdStrength.color }}>{pwdStrength.label} password</Text>
              </div>
            )}
            <Form.Item name="confirmPassword" label={<Text strong>Confirm New Password</Text>}
              dependencies={["newPassword"]}
              rules={[
                { required: true, message: "Please confirm your password" },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return !value || getFieldValue("newPassword") === value
                      ? Promise.resolve()
                      : Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}>
              <Password prefix={<LockOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="••••••••" />
            </Form.Item>
            <Form.Item style={{ marginBottom: 0 }}>
              <Button type="primary" htmlType="submit" loading={changingPwd} size="large" style={gradBtn} icon={<LockOutlined />}>
                {changingPwd ? "Changing..." : "Change Password"}
              </Button>
            </Form.Item>
          </Form>
        </Card>
      ),
    },
    {
      key: "account",
      label: <span><CrownOutlined style={{ marginRight: 6 }} />Account & Plan</span>,
      children: (
        <Space direction="vertical" style={{ width: "100%" }} size={20}>
          {/* Plan badge */}
          <Card style={{ ...card, background: "linear-gradient(135deg,#6C63FF 0%,#4facfe 100%)" }}
            styles={{ body: { padding: "28px 32px" } }}>
            <Row align="middle" justify="space-between">
              <Col>
                <Text style={{ color: "rgba(255,255,255,0.75)", fontSize: 13, display: "block" }}>Current Plan</Text>
                <Title level={2} style={{ margin: "4px 0", color: "#fff" }}>
                  {user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : "Free"}
                </Title>
                <Tag color="rgba(255,255,255,0.2)" style={{ color: "#fff", border: "1px solid rgba(255,255,255,0.3)" }}>
                  {user?.subscriptionStatus || "free"}
                </Tag>
              </Col>
              <Col>
                <CrownOutlined style={{ fontSize: 64, color: "rgba(255,255,255,0.2)" }} />
              </Col>
            </Row>
          </Card>

          {/* Usage stats */}
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 13 }}>Usage This Month</Text>}
                  value={user?.analysisCount || 0}
                  suffix={<Text type="secondary">/ {user?.analysisLimit || 1}</Text>}
                  prefix={<ThunderboltOutlined style={{ color: BRAND }} />}
                  styles={{ content: { color: BRAND, fontWeight: 700 } }}
                />
                <Progress percent={usagePct} showInfo={false}
                  strokeColor={{ from: BRAND, to: "#4facfe" }} size="small" style={{ marginTop: 8 }} />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {(user?.analysisLimit || 0) - (user?.analysisCount || 0)} remaining
                </Text>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 13 }}>Account Status</Text>}
                  value={user?.status || "active"}
                  prefix={<CheckCircleOutlined style={{ color: "#52c41a" }} />}
                  styles={{ content: { color: "#52c41a", fontWeight: 700, textTransform: "capitalize" } }}
                />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 8, display: "block" }}>
                  Email {user?.isEmailVerified ? "verified ✓" : "not verified"}
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Account Details */}
          <Card style={card} styles={{ body: { padding: "24px 28px" } }}
            title={<span style={{ fontWeight: 600 }}>Account Details</span>}>
            {[
              ["Plan",           user?.plan || "free"],
              ["Subscription",   user?.subscriptionStatus || "none"],
              ["Email Verified", user?.isEmailVerified ? "Yes" : "No"],
              ["Member Since",   user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "—"],
              ["Last Login",     user?.lastLogin ? new Date(user.lastLogin).toLocaleString() : "—"],
            ].map(([label, value]) => (
              <Row key={label} style={{ padding: "12px 0", borderBottom: `1px solid ${isDark ? "#2e2e4a" : "#f0f0f0"}` }}>
                <Col span={10}>
                  <Text type="secondary" style={{ fontSize: 13 }}>{label}</Text>
                </Col>
                <Col span={14}>
                  <Text strong style={{ fontSize: 13, textTransform: "capitalize" }}>{value}</Text>
                </Col>
              </Row>
            ))}
          </Card>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 24 }}>
        <Title level={3} style={{ margin: 0 }}>My Profile</Title>
        <Text type="secondary">Manage your personal information and security settings</Text>
      </div>
      <Tabs defaultActiveKey="personal" items={tabs} size="large"
        tabBarStyle={{ marginBottom: 24 }} />
    </AppLayout>
  );
};

export default ProfilePage;
