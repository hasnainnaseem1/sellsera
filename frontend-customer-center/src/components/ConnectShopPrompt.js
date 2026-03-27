import React, { useState } from 'react';
import { Typography, Button, Steps, theme } from 'antd';
import {
  ShopOutlined, LinkOutlined, CheckCircleOutlined,
  SafetyCertificateOutlined, RocketOutlined,
} from '@ant-design/icons';
import { colors, radii } from '../theme/tokens';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

/**
 * ConnectShopPrompt — shown on the Dashboard when user.etsyConnected is falsy.
 * Provides a sleek "Connect Your Etsy Shop" OAuth flow that feels premium,
 * not like a tutorial checklist.
 */
const ConnectShopPrompt = ({ onConnect }) => {
  const { token: tok } = theme.useToken();
  const [hovering, setHovering] = useState(false);

  const benefits = [
    { icon: <ShopOutlined />,            text: 'Auto-import all your listings' },
    { icon: <RocketOutlined />,          text: 'Get instant SEO scores and recommendations' },
    { icon: <SafetyCertificateOutlined />, text: 'Secure OAuth — we never see your password' },
  ];

  return (
    <div style={{
      maxWidth: 640,
      margin: '60px auto',
      textAlign: 'center',
    }}>
      {/* Animated Shop Icon */}
      <div style={{
        width: 96, height: 96, borderRadius: 28,
        background: `linear-gradient(135deg, ${BRAND}, #A78BFA)`,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 36px rgba(108,99,255,0.35)',
        marginBottom: 28,
        transition: 'transform 0.3s',
        transform: hovering ? 'scale(1.06)' : 'scale(1)',
      }}>
        <ShopOutlined style={{ fontSize: 44, color: '#fff' }} />
      </div>

      <Title level={2} style={{ marginBottom: 8 }}>
        Connect Your Etsy Shop
      </Title>
      <Text type="secondary" style={{ fontSize: 16, display: 'block', marginBottom: 36, lineHeight: 1.6 }}>
        Link your shop in seconds and we'll start pulling in your listings,
        stats, and keywords automatically.
      </Text>

      {/* Benefits row */}
      <div style={{
        display: 'flex', gap: 16, justifyContent: 'center',
        flexWrap: 'wrap', marginBottom: 40,
      }}>
        {benefits.map((b, i) => (
          <div key={i} style={{
            background: tok.colorBgContainer,
            border: `1px solid ${tok.colorBorderSecondary}`,
            borderRadius: radii.lg,
            padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 10,
            fontSize: 14,
            boxShadow: '0 2px 8px rgba(108,99,255,0.06)',
          }}>
            <span style={{ color: BRAND, fontSize: 18 }}>{b.icon}</span>
            <Text>{b.text}</Text>
          </div>
        ))}
      </div>

      {/* CTA Button */}
      <Button
        type="primary" size="large"
        icon={<LinkOutlined />}
        onMouseEnter={() => setHovering(true)}
        onMouseLeave={() => setHovering(false)}
        onClick={onConnect}
        style={{
          height: 52, paddingInline: 40, fontSize: 16, fontWeight: 600,
          borderRadius: radii.lg,
          background: `linear-gradient(135deg, ${BRAND}, #A78BFA)`,
          border: 'none',
          boxShadow: '0 6px 24px rgba(108,99,255,0.4)',
        }}
      >
        Connect with Etsy
      </Button>

      <div style={{ marginTop: 14 }}>
        <Text type="secondary" style={{ fontSize: 12 }}>
          <SafetyCertificateOutlined style={{ marginRight: 4 }} />
          Read-only access · You can disconnect any time
        </Text>
      </div>

      {/* Etsy API TOS §2 — required trademark disclaimer */}
      <div style={{ marginTop: 24 }}>
        <Text style={{ fontSize: 12, color: colors.muted, lineHeight: 1.5 }}>
          The term &ldquo;Etsy&rdquo; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
        </Text>
      </div>

      {/* How it works — micro-steps */}
      <div style={{
        marginTop: 48, textAlign: 'left',
        background: tok.colorBgContainer,
        borderRadius: radii.lg,
        border: `1px solid ${tok.colorBorderSecondary}`,
        padding: '28px 32px',
      }}>
        <Text strong style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, color: colors.muted }}>
          How it works
        </Text>
        <Steps
          direction="vertical"
          size="small"
          current={-1}
          style={{ marginTop: 16 }}
          items={[
            { title: 'Authorize on Etsy', description: 'Click the button above — Etsy will ask you to approve read-only access.', icon: <LinkOutlined style={{ color: BRAND }} /> },
            { title: 'We sync your data', description: 'Listings, tags, and shop stats are imported in the background (≈ 30 seconds).', icon: <ShopOutlined style={{ color: colors.warning }} /> },
            { title: 'Start optimizing', description: 'Your Dashboard lights up with insights, scores, and recommendations.', icon: <CheckCircleOutlined style={{ color: colors.success }} /> },
          ]}
        />
      </div>
    </div>
  );
};

export default ConnectShopPrompt;
