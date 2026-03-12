import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  Row, Col, Card, Form, Input, Button, Avatar, Typography, Segmented,
  Statistic, Progress, Tag, Alert, Space, Divider, theme, Table, Empty,
  Tooltip, message, Modal, Descriptions, List, Badge, Switch, Spin,
} from "antd";
import {
  UserOutlined, LockOutlined, CrownOutlined, ThunderboltOutlined,
  MailOutlined, PhoneOutlined, CalendarOutlined, CheckCircleOutlined,
  EditOutlined, SaveOutlined, RocketOutlined, CreditCardOutlined,
  ArrowRightOutlined, ClockCircleOutlined, ExclamationCircleOutlined,
  SyncOutlined, StopOutlined, PlayCircleOutlined, DollarOutlined,
  WalletOutlined, CloseCircleOutlined, FileTextOutlined, DownloadOutlined,
  ExportOutlined, SettingOutlined,
} from "@ant-design/icons";
import AppLayout from "../components/AppLayout";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useSite } from "../context/SiteContext";
import { useSearchParams } from "react-router-dom";
import config from "../config";
import billingApi from "../api/billingApi";
import plansApi from "../api/plansApi";

const { Title, Text, Paragraph } = Typography;
const { Password } = Input;
const BRAND = "#6C63FF";

/* ───── helpers ───── */
const getStrength = (pwd) => {
  if (!pwd) return { score: 0, label: "", color: "", pct: 0 };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  const map = [
    { label: "Weak", color: "#ff4d4f", pct: 25 },
    { label: "Fair", color: "#faad14", pct: 50 },
    { label: "Good", color: "#1677ff", pct: 75 },
    { label: "Strong", color: "#52c41a", pct: 100 },
  ];
  return { score, ...(map[score - 1] || { label: "", color: BRAND, pct: 0 }) };
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "N/A";

const statusColors = { active: "green", trial: "blue", expired: "red", cancelled: "orange", past_due: "volcano", inactive: "default", none: "default" };
const statusIcons = { active: <CheckCircleOutlined />, trial: <ClockCircleOutlined />, expired: <ExclamationCircleOutlined />, cancelled: <ExclamationCircleOutlined />, past_due: <ExclamationCircleOutlined /> };
const paymentStatusConfig = {
  succeeded: { color: "green", icon: <CheckCircleOutlined />, label: "Paid" },
  pending: { color: "blue", icon: <ClockCircleOutlined />, label: "Pending" },
  failed: { color: "red", icon: <CloseCircleOutlined />, label: "Failed" },
  refunded: { color: "orange", icon: <DollarOutlined />, label: "Refunded" },
  cancelled: { color: "default", icon: <CloseCircleOutlined />, label: "Cancelled" },
};

const AccountSettingsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get("tab") || "profile";
  const [activeTab, setActiveTab] = useState(initialTab);
  const { user, token, updateUser, fetchMe } = useAuth();
  const { isDark } = useTheme();
  const { siteConfig } = useSite();
  const { token: tok } = theme.useToken();
  const subscriptionsEnabled = siteConfig?.enableSubscriptions !== false;

  const handleTabChange = (val) => {
    setActiveTab(val);
    setSearchParams({ tab: val }, { replace: true });
  };

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

  const tabOptions = [
    { label: "Profile", value: "profile", icon: <UserOutlined /> },
    { label: "Security", value: "security", icon: <LockOutlined /> },
    ...(subscriptionsEnabled
      ? [
          { label: "Subscription", value: "subscription", icon: <RocketOutlined /> },
          { label: "Plans", value: "plans", icon: <CrownOutlined /> },
          { label: "Billing", value: "billing", icon: <WalletOutlined /> },
        ]
      : []),
  ];

  return (
    <AppLayout>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        {/* Page header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
            <SettingOutlined style={{ fontSize: 22, color: BRAND }} />
            <Title level={3} style={{ margin: 0 }}>Account Settings</Title>
          </div>
          <Text type="secondary">Manage your profile, security, subscription, and billing</Text>
        </div>

        {/* Tab Navigation */}
        <Segmented
          value={activeTab}
          onChange={handleTabChange}
          options={tabOptions}
          block
          size="large"
          style={{
            marginBottom: 28,
            background: isDark ? "#1a1a2e" : "#f0f0f5",
            borderRadius: 14,
            padding: 4,
          }}
        />

        {/* Tab Content */}
        {activeTab === "profile" && <ProfileTab card={card} gradBtn={gradBtn} tok={tok} isDark={isDark} user={user} token={token} updateUser={updateUser} />}
        {activeTab === "security" && <SecurityTab card={card} gradBtn={gradBtn} tok={tok} isDark={isDark} token={token} />}
        {activeTab === "subscription" && <SubscriptionTab card={card} tok={tok} isDark={isDark} user={user} token={token} fetchMe={fetchMe} onChangeTab={handleTabChange} />}
        {activeTab === "plans" && <PlansTab card={card} tok={tok} isDark={isDark} token={token} />}
        {activeTab === "billing" && <BillingTab card={card} tok={tok} isDark={isDark} user={user} />}
      </div>
    </AppLayout>
  );
};

/* ═══════════════════════════════════════ PROFILE TAB ═══════════════════════════════════════ */
const ProfileTab = ({ card, gradBtn, tok, isDark, user, token, updateUser }) => {
  const [profileForm] = Form.useForm();
  const [profileMsg, setProfileMsg] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSaveProfile = async (values) => {
    setProfileMsg(null);
    setSaving(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/auth/customer/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
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

  return (
    <Card style={card} styles={{ body: { padding: "32px 36px" } }}>
      {/* Avatar header */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
        <Avatar size={72} style={{ background: "linear-gradient(135deg,#6C63FF,#4facfe)", fontSize: 28, fontWeight: 700, flexShrink: 0 }}>
          {user?.name?.[0]?.toUpperCase() || "U"}
        </Avatar>
        <div>
          <Title level={4} style={{ margin: 0 }}>{user?.name}</Title>
          <Text type="secondary" style={{ fontSize: 13 }}>{user?.email}</Text>
          <div style={{ marginTop: 6 }}>
            <Tag color={user?.isEmailVerified ? "success" : "warning"} icon={user?.isEmailVerified ? <CheckCircleOutlined /> : <MailOutlined />}>
              {user?.isEmailVerified ? "Verified" : "Unverified"}
            </Tag>
            <Tag color="blue">{user?.plan ? user.plan.charAt(0).toUpperCase() + user.plan.slice(1) : "Free"} Plan</Tag>
          </div>
        </div>
      </div>
      <Divider style={{ margin: "0 0 28px" }} />

      {profileMsg && (
        <Alert type={profileMsg.type} message={profileMsg.text} showIcon
          style={{ marginBottom: 20, borderRadius: tok.borderRadius }} closable onClose={() => setProfileMsg(null)} />
      )}

      <Form form={profileForm} layout="vertical" onFinish={handleSaveProfile} requiredMark={false}
        initialValues={{ name: user?.name, email: user?.email, phone: user?.phone || "" }}>
        <Row gutter={20}>
          <Col xs={24} md={12}>
            <Form.Item name="name" label={<Text strong>Full Name</Text>}
              rules={[{ required: true, message: "Name is required" }, { min: 2, message: "Min 2 characters" }]}>
              <Input prefix={<UserOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" placeholder="Your full name" />
            </Form.Item>
          </Col>
          <Col xs={24} md={12}>
            <Form.Item name="email" label={<Text strong>Email Address</Text>}>
              <Input prefix={<MailOutlined style={{ color: tok.colorTextQuaternary }} />} size="large" disabled style={{ opacity: 0.6 }} />
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
                disabled style={{ opacity: 0.6 }} />
            </Form.Item>
          </Col>
        </Row>
        <Button type="primary" htmlType="submit" loading={saving} size="large" style={gradBtn} icon={<SaveOutlined />}>
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </Form>
    </Card>
  );
};

/* ═══════════════════════════════════════ SECURITY TAB ═══════════════════════════════════════ */
const SecurityTab = ({ card, gradBtn, tok, isDark, token }) => {
  const [pwdForm] = Form.useForm();
  const [pwdMsg, setPwdMsg] = useState(null);
  const [changingPwd, setChangingPwd] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const pwdStrength = getStrength(newPwd);

  const handleChangePwd = async (values) => {
    setPwdMsg(null);
    setChangingPwd(true);
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/auth/customer/me/password`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword: values.currentPassword, newPassword: values.newPassword }),
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

  return (
    <Card style={card} styles={{ body: { padding: "32px 36px" } }}>
      <Title level={5} style={{ margin: "0 0 6px" }}>Change Password</Title>
      <Paragraph type="secondary" style={{ margin: "0 0 28px", fontSize: 13 }}>
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
            <Progress percent={pwdStrength.pct} showInfo={false} strokeColor={pwdStrength.color} size="small" />
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
        <Button type="primary" htmlType="submit" loading={changingPwd} size="large" style={gradBtn} icon={<LockOutlined />}>
          {changingPwd ? "Changing…" : "Change Password"}
        </Button>
      </Form>
    </Card>
  );
};

/* ═══════════════════════════════════════ SUBSCRIPTION TAB ═══════════════════════════════════════ */
const SubscriptionTab = ({ card, tok, isDark, user, token, fetchMe, onChangeTab }) => {
  const [portalLoading, setPortalLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [resumeLoading, setResumeLoading] = useState(false);
  const hasFetched = useRef(false);

  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchMe(token);
    }
  }, [token, fetchMe]);

  const usagePct = user ? Math.round((user.analysisCount / (user.analysisLimit || 1)) * 100) : 0;
  const subStatus = user?.subscriptionStatus || "none";
  const planName = user?.planSnapshot?.planName || user?.plan || "Free";
  const billingCycle = user?.billingCycle || "none";
  const trialEndsAt = user?.trialEndsAt ? new Date(user.trialEndsAt) : null;
  const daysLeft = trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / 86400000)) : null;
  const renewsAt = user?.subscriptionExpiresAt;
  const startedAt = user?.subscriptionStartDate;
  const isActive = subStatus === "active";
  const isTrial = subStatus === "trial";
  const isCancelled = subStatus === "cancelled";
  const isPastDue = subStatus === "past_due";
  const isExpired = subStatus === "expired";
  const hasSubscription = isActive || isTrial || isCancelled || isPastDue;

  const handleManageBilling = async () => {
    setPortalLoading(true);
    try {
      const data = await billingApi.createPortal();
      if (data.inApp) {
        // LemonSqueezy: navigate to in-app billing tab
        onChangeTab("billing");
      } else if (data.success && data.url) {
        window.location.href = data.url;
      } else {
        message.error(data.message || "Could not open billing portal");
      }
    } catch (err) {
      message.error(err.response?.data?.message || "Could not open billing portal.");
    } finally {
      setPortalLoading(false);
    }
  };

  const handleCancel = () => {
    Modal.confirm({
      title: "Cancel Subscription",
      icon: <ExclamationCircleOutlined />,
      content: (
        <div>
          <p>Are you sure you want to cancel your <strong>{planName}</strong> subscription?</p>
          <p style={{ color: "#8c8c8c", fontSize: 13 }}>
            Your subscription will remain active until the end of your current billing period
            {renewsAt && <> (<strong>{formatDate(renewsAt)}</strong>)</>}. You can resume anytime before it expires.
          </p>
        </div>
      ),
      okText: "Yes, Cancel",
      okButtonProps: { danger: true },
      cancelText: "Keep Subscription",
      onOk: async () => {
        setCancelLoading(true);
        try {
          const data = await billingApi.cancelSubscription({ immediate: false });
          message.success(data.message || "Subscription will be cancelled at period end.");
          if (token) await fetchMe(token);
        } catch (err) {
          message.error(err.response?.data?.message || "Failed to cancel subscription");
        } finally {
          setCancelLoading(false);
        }
      },
    });
  };

  const handleResume = async () => {
    setResumeLoading(true);
    try {
      const data = await billingApi.resumeSubscription();
      message.success(data.message || "Subscription resumed successfully!");
      if (token) await fetchMe(token);
    } catch (err) {
      message.error(err.response?.data?.message || "Failed to resume subscription");
    } finally {
      setResumeLoading(false);
    }
  };

  return (
    <div>
      {/* Alerts */}
      {isTrial && daysLeft !== null && daysLeft <= 3 && (
        <Alert type="warning" showIcon icon={<ClockCircleOutlined />} style={{ marginBottom: 20, borderRadius: 12 }}
          message={`Trial expires in ${daysLeft} day${daysLeft !== 1 ? "s" : ""}`}
          description="Upgrade now to keep using all features without interruption."
          action={<Button type="primary" size="small" onClick={() => onChangeTab("plans")}>Upgrade Now</Button>} />
      )}
      {isExpired && (
        <Alert type="error" showIcon style={{ marginBottom: 20, borderRadius: 12 }}
          message="Your subscription has expired"
          description="Upgrade to a paid plan to continue using the platform."
          action={<Button type="primary" danger size="small" onClick={() => onChangeTab("plans")}>Choose a Plan</Button>} />
      )}
      {isCancelled && (
        <Alert type="warning" showIcon icon={<ExclamationCircleOutlined />} style={{ marginBottom: 20, borderRadius: 12 }}
          message="Your subscription is set to cancel"
          description={renewsAt ? `Your access will end on ${formatDate(renewsAt)}. Resume to keep your plan.` : "Your access will end at the end of the billing period."}
          action={<Button type="primary" size="small" onClick={handleResume} loading={resumeLoading}>Resume Subscription</Button>} />
      )}
      {isPastDue && (
        <Alert type="error" showIcon style={{ marginBottom: 20, borderRadius: 12 }}
          message="Payment past due" description="Please update your payment method to avoid service interruption."
          action={<Button type="primary" danger size="small" onClick={handleManageBilling} loading={portalLoading}>Update Payment</Button>} />
      )}

      {/* Plan Card */}
      <Card style={{ ...card, background: `linear-gradient(135deg, ${BRAND} 0%, #4facfe 100%)`, marginBottom: 24 }}
        styles={{ body: { padding: 28 } }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} md={14}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
              <RocketOutlined style={{ fontSize: 28, color: "#fff" }} />
              <div>
                <Title level={3} style={{ color: "#fff", margin: 0 }}>{planName} Plan</Title>
                <Space size={4} style={{ marginTop: 4 }}>
                  <Tag color={statusColors[subStatus]} icon={statusIcons[subStatus]}>{subStatus.replace("_", " ").toUpperCase()}</Tag>
                  {billingCycle !== "none" && hasSubscription && (
                    <Tag color="rgba(255,255,255,0.25)" style={{ color: "#fff", border: "none" }}>
                      <CalendarOutlined /> {billingCycle === "yearly" ? "Yearly" : "Monthly"}
                    </Tag>
                  )}
                </Space>
              </div>
            </div>
            {isTrial && daysLeft !== null && (
              <Text style={{ color: "rgba(255,255,255,0.85)" }}><CalendarOutlined /> Trial ends in <strong>{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong></Text>
            )}
            {isActive && renewsAt && (
              <Text style={{ color: "rgba(255,255,255,0.85)" }}><SyncOutlined /> Renews on <strong>{formatDate(renewsAt)}</strong></Text>
            )}
            {isCancelled && renewsAt && (
              <Text style={{ color: "rgba(255,255,255,0.85)" }}><CalendarOutlined /> Access ends <strong>{formatDate(renewsAt)}</strong></Text>
            )}
          </Col>
          <Col xs={24} md={10} style={{ textAlign: "right" }}>
            <Space wrap>
              <Button type="default" icon={<ArrowRightOutlined />} onClick={() => onChangeTab("plans")} style={{ fontWeight: 600 }}>
                {isActive ? "Change Plan" : "Upgrade"}
              </Button>
              {hasSubscription && (
                <Button icon={<CreditCardOutlined />} onClick={handleManageBilling} loading={portalLoading} style={{ fontWeight: 600 }}>Manage Billing</Button>
              )}
              {isCancelled && (
                <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleResume} loading={resumeLoading}
                  style={{ fontWeight: 600, background: "#52c41a", borderColor: "#52c41a" }}>Resume</Button>
              )}
              {(isActive || isTrial) && (
                <Button danger icon={<StopOutlined />} onClick={handleCancel} loading={cancelLoading} style={{ fontWeight: 600 }}>Cancel</Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Details */}
      {hasSubscription && (
        <Card style={{ ...card, marginBottom: 24 }} styles={{ body: { padding: "20px 28px" } }}>
          <Title level={5} style={{ marginBottom: 16 }}><DollarOutlined style={{ color: BRAND, marginRight: 8 }} />Subscription Details</Title>
          <Descriptions column={{ xs: 1, sm: 2, md: 3 }} size="small">
            <Descriptions.Item label="Plan">{planName}</Descriptions.Item>
            <Descriptions.Item label="Status"><Tag color={statusColors[subStatus]} icon={statusIcons[subStatus]}>{subStatus.replace("_", " ").toUpperCase()}</Tag></Descriptions.Item>
            <Descriptions.Item label="Billing Cycle">{billingCycle === "yearly" ? "Yearly" : billingCycle === "monthly" ? "Monthly" : "—"}</Descriptions.Item>
            <Descriptions.Item label="Started">{formatDate(startedAt)}</Descriptions.Item>
            <Descriptions.Item label={isCancelled ? "Ends On" : "Renews On"}>{formatDate(renewsAt)}</Descriptions.Item>
            {isTrial && <Descriptions.Item label="Trial Ends">{formatDate(user?.trialEndsAt)}</Descriptions.Item>}
          </Descriptions>
        </Card>
      )}

      {/* Usage */}
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card style={card} styles={{ body: { padding: "24px 28px" } }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>Usage This Month</Text>}
              value={user?.analysisCount || 0} suffix={<Text type="secondary">/ {user?.analysisLimit || 0}</Text>}
              prefix={<ThunderboltOutlined style={{ color: BRAND }} />} styles={{ content: { color: BRAND, fontWeight: 700 } }} />
            <Progress percent={Math.min(usagePct, 100)} showInfo={false}
              strokeColor={usagePct >= 90 ? "#ff4d4f" : { from: BRAND, to: "#4facfe" }} size="small" style={{ marginTop: 10 }} />
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card style={card} styles={{ body: { padding: "24px 28px" } }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>Next Reset</Text>}
              value={user?.monthlyResetDate ? formatDate(user.monthlyResetDate) : "N/A"}
              prefix={<SyncOutlined style={{ color: "#52c41a" }} />} styles={{ content: { fontWeight: 700, fontSize: 18 } }} />
            <Text type="secondary" style={{ fontSize: 12, marginTop: 6, display: "block" }}>Usage counter resets on this date</Text>
          </Card>
        </Col>
      </Row>

      {/* Features */}
      {user?.planSnapshot?.features?.length > 0 && (
        <Card style={card} styles={{ body: { padding: "24px 28px" } }}
          title={<span><CheckCircleOutlined style={{ color: BRAND, marginRight: 8 }} />Plan Features</span>}>
          <Row gutter={[16, 12]}>
            {user.planSnapshot.features.map((f, i) => (
              <Col xs={24} sm={12} key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px",
                  background: isDark ? "#0f0f1a" : "#f7f7ff", borderRadius: 8 }}>
                  <CheckCircleOutlined style={{ color: f.enabled ? "#52c41a" : "#d9d9d9" }} />
                  <Text style={{ flex: 1 }}>{f.featureName || f.featureKey}</Text>
                  {f.limit !== null && f.limit !== undefined && (
                    <Tag color="blue">{f.limit === -1 ? "Unlimited" : f.limit}</Tag>
                  )}
                </div>
              </Col>
            ))}
          </Row>
        </Card>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════ PLANS TAB ═══════════════════════════════════════ */
const PlansTab = ({ card, tok, isDark, token }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState("monthly");
  const [checkoutLoading, setCheckoutLoading] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const data = token ? await plansApi.getPlans() : await plansApi.getPublicPlans();
        setPlans(data.plans || []);
      } catch {
        message.error("Failed to load plans");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const handleSelect = async (plan) => {
    if (plan.isCurrent) return;
    if (plan.price?.monthly === 0 && plan.price?.yearly === 0) {
      message.info("You are already on the free plan or it requires no payment.");
      return;
    }
    try {
      setCheckoutLoading(plan._id);
      const data = await billingApi.createCheckout({ planId: plan._id, billingCycle });
      if (data.success && data.url) window.location.href = data.url;
      else message.error(data.message || "Failed to start checkout");
    } catch (err) {
      message.error(err.response?.data?.message || "Checkout error");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const getPrice = (plan) => (billingCycle === "yearly" ? plan.price?.yearly : plan.price?.monthly) || 0;

  if (loading) {
    return <div style={{ textAlign: "center", padding: "60px 0" }}><Spin size="large" /></div>;
  }

  return (
    <div>
      {/* Billing toggle */}
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <Space>
          <Text strong style={{ color: billingCycle === "monthly" ? BRAND : undefined }}>Monthly</Text>
          <Switch checked={billingCycle === "yearly"} onChange={(c) => setBillingCycle(c ? "yearly" : "monthly")} />
          <Text strong style={{ color: billingCycle === "yearly" ? BRAND : undefined }}>Yearly</Text>
          {billingCycle === "yearly" && <Tag color="green">Save with annual billing</Tag>}
        </Space>
      </div>

      <Row gutter={[20, 20]} justify="center">
        {plans.map((plan) => {
          const price = getPrice(plan);
          const isCurrent = plan.isCurrent;
          const isFree = price === 0;
          const isPopular = plan.isPopular || plan.name.toLowerCase() === "pro";

          return (
            <Col xs={24} sm={12} lg={6} key={plan._id}>
              <Badge.Ribbon text="Popular" color={BRAND} style={{ display: isPopular ? "block" : "none" }}>
                <Card hoverable={!isCurrent}
                  style={{
                    ...card,
                    ...(isCurrent ? { borderColor: BRAND, borderWidth: 2 } : {}),
                    ...(isPopular ? { background: `linear-gradient(135deg, ${BRAND} 0%, #4facfe 100%)` } : {}),
                    height: "100%",
                  }}
                  styles={{ body: { padding: "28px 24px", display: "flex", flexDirection: "column", height: "100%" } }}>
                  <div style={{ marginBottom: 16 }}>
                    <Title level={4} style={{ margin: 0, color: isPopular ? "#fff" : undefined }}>{plan.name}</Title>
                    {plan.description && (
                      <Text style={{ fontSize: 13, color: isPopular ? "rgba(255,255,255,0.8)" : undefined }}
                        type={!isPopular ? "secondary" : undefined}>{plan.description}</Text>
                    )}
                  </div>
                  <div style={{ marginBottom: 20 }}>
                    <span style={{ fontSize: 42, fontWeight: 900, color: isPopular ? "#fff" : tok.colorText, lineHeight: 1 }}>${price}</span>
                    {!isFree && (
                      <Text style={{ fontSize: 16, color: isPopular ? "rgba(255,255,255,0.7)" : undefined }}
                        type={!isPopular ? "secondary" : undefined}>/{billingCycle === "yearly" ? "year" : "mo"}</Text>
                    )}
                  </div>
                  {plan.trialDays > 0 && !isCurrent && (
                    <Tag color="blue" style={{ marginBottom: 12, alignSelf: "flex-start" }}>{plan.trialDays}-day free trial</Tag>
                  )}
                  <div style={{ flex: 1, marginBottom: 20 }}>
                    <List size="small" dataSource={plan.features || []}
                      renderItem={(f) => (
                        <List.Item style={{ padding: "6px 0", border: "none", color: isPopular ? "#fff" : undefined }}>
                          {f.enabled
                            ? <CheckCircleOutlined style={{ color: isPopular ? "#ffd666" : "#52c41a", marginRight: 8 }} />
                            : <CloseCircleOutlined style={{ color: isPopular ? "rgba(255,255,255,0.35)" : "#d9d9d9", marginRight: 8 }} />}
                          <Text style={{
                            color: isPopular ? (f.enabled ? "#fff" : "rgba(255,255,255,0.4)") : (f.enabled ? undefined : tok.colorTextDisabled),
                            fontSize: 13,
                          }}>
                            {f.featureName}
                            {f.limit != null && f.enabled && (
                              <Text style={{ fontSize: 11, color: isPopular ? "rgba(255,255,255,0.7)" : undefined }}
                                type={!isPopular ? "secondary" : undefined}> ({f.limit === -1 ? "Unlimited" : f.limit})</Text>
                            )}
                          </Text>
                        </List.Item>
                      )} />
                  </div>
                  <Button type={isCurrent ? "default" : "primary"} block size="large" disabled={isCurrent}
                    loading={checkoutLoading === plan._id} onClick={() => handleSelect(plan)}
                    icon={isCurrent ? <CheckCircleOutlined /> : <ArrowRightOutlined />}
                    style={{
                      fontWeight: 700, height: 46, borderRadius: 10,
                      ...(isPopular && !isCurrent ? { background: "#fff", color: BRAND, border: "none" } : {}),
                      ...(isCurrent ? { borderColor: BRAND, color: BRAND } : {}),
                    }}>
                    {isCurrent ? "Current Plan" : isFree ? "Get Started" : "Select Plan"}
                  </Button>
                </Card>
              </Badge.Ribbon>
            </Col>
          );
        })}
      </Row>
    </div>
  );
};

/* ═══════════════════════════════════════ BILLING TAB ═══════════════════════════════════════ */
const BillingTab = ({ card, tok, isDark, user }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const loadPayments = useCallback(async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const data = await billingApi.getPayments({ page, limit });
      setPayments(data.payments || []);
      setPagination({ current: data.pagination?.page || page, pageSize: limit, total: data.pagination?.total || 0 });
    } catch {
      message.error("Failed to load payment history");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPayments(); }, [loadPayments]);

  // Billing tab: no "Manage Billing" button needed — user is already here

  const columns = [
    {
      title: "Date", dataIndex: "paidAt", key: "paidAt", width: 140,
      render: (d) => d ? formatDate(d) : "-",
      sorter: (a, b) => new Date(a.paidAt) - new Date(b.paidAt),
    },
    {
      title: "Plan", dataIndex: "planName", key: "planName",
      render: (name) => <Text strong>{name || "-"}</Text>,
    },
    {
      title: "Amount", dataIndex: "amount", key: "amount", width: 120,
      render: (amt, rec) => (
        <Text strong style={{ color: "#52c41a", fontSize: 15 }}>
          ${(amt || 0).toFixed(2)} {rec.currency?.toUpperCase()}
        </Text>
      ),
    },
    {
      title: "Cycle", dataIndex: "billingCycle", key: "billingCycle", width: 100,
      render: (c) => <Tag>{c || "-"}</Tag>,
    },
    {
      title: "Status", dataIndex: "status", key: "status", width: 110,
      render: (s) => {
        const cfg = paymentStatusConfig[s] || paymentStatusConfig.pending;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: "Actions", key: "actions", width: 120,
      render: (_, rec) => (
        <Space>
          <Tooltip title="Download Invoice">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined />}
              onClick={() => {
                const token = localStorage.getItem('token');
                const url = `${config.apiUrl}/api/v1/customer/billing/invoice/${rec._id}`;
                fetch(url, { headers: { Authorization: `Bearer ${token}` } })
                  .then(r => {
                    if (!r.ok) throw new Error('Failed');
                    return r.blob();
                  })
                  .then(blob => {
                    const a = document.createElement('a');
                    a.href = URL.createObjectURL(blob);
                    a.download = `invoice-${rec._id}.pdf`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  })
                  .catch(() => message.error('Failed to download invoice'));
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  const totalPaid = payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <div>
      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>Total Paid</Text>}
              value={totalPaid.toFixed(2)} prefix={<DollarOutlined style={{ color: "#52c41a" }} />}
              styles={{ content: { color: "#52c41a", fontWeight: 700 } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>Total Invoices</Text>}
              value={pagination.total} prefix={<FileTextOutlined style={{ color: BRAND }} />}
              styles={{ content: { color: BRAND, fontWeight: 700 } }} />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card style={card} styles={{ body: { padding: "20px 24px" } }}>
            <Statistic title={<Text type="secondary" style={{ fontSize: 13 }}>Current Plan</Text>}
              value={user?.planSnapshot?.planName || user?.plan || "Free"}
              prefix={<CreditCardOutlined style={{ color: "#faad14" }} />}
              styles={{ content: { fontWeight: 700, color: "#faad14", fontSize: 18 } }} />
          </Card>
        </Col>
      </Row>

      <Card style={card} styles={{ body: { padding: 0 } }}>
        <Table columns={columns} dataSource={payments} rowKey="_id" loading={loading}
          pagination={{
            ...pagination, showSizeChanger: true,
            showTotal: (total) => `Total ${total} payments`,
            onChange: (page, pageSize) => loadPayments(page, pageSize),
          }}
          locale={{
            emptyText: <Empty description="No payments yet"
              image={<CreditCardOutlined style={{ fontSize: 48, color: isDark ? "#3a3a5c" : "#d4c8ff" }} />} />,
          }}
          style={{ borderRadius: 16, overflow: "hidden" }} />
      </Card>
    </div>
  );
};

export default AccountSettingsPage;
