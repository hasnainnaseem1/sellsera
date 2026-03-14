import React from 'react';
import { Button, Typography, Tag } from 'antd';
import { LockOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../context/PermissionsContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, radii } from '../../theme/tokens';

const { Text, Title } = Typography;

/**
 * FeatureGate — wraps children with access-state rendering.
 *
 * Props:
 *   featureKey  — the plan feature key (e.g. 'listing_audit')
 *   children    — the unlocked content
 *   fallback    — optional custom locked/limit content
 */
const FeatureGate = ({ featureKey, children, fallback }) => {
  const { getFeatureAccess, plan } = usePermissions();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const access = getFeatureAccess(featureKey);

  if (access.state === 'unlocked') return <>{children}</>;

  if (fallback) return <>{fallback}</>;

  const isLimitReached = access.state === 'limit_reached';

  return (
    <div style={{ position: 'relative', minHeight: 300 }}>
      {/* Blurred preview of children */}
      <div style={{
        filter: 'blur(6px)',
        opacity: 0.4,
        pointerEvents: 'none',
        userSelect: 'none',
      }}>
        {children}
      </div>

      {/* Overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isDark ? 'rgba(15,15,26,0.75)' : 'rgba(255,255,255,0.8)',
        backdropFilter: 'blur(4px)',
        borderRadius: radii.lg,
        zIndex: 10,
      }}>
        <div style={{
          textAlign: 'center',
          padding: '40px 32px',
          maxWidth: 420,
          background: isDark ? colors.darkCard : colors.lightCard,
          borderRadius: radii.lg,
          border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
          boxShadow: '0 8px 32px rgba(108,99,255,0.15)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: isLimitReached
              ? `linear-gradient(135deg, ${colors.warning}, #F97316)`
              : `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 20px',
            boxShadow: `0 8px 24px ${isLimitReached ? 'rgba(245,158,11,0.3)' : 'rgba(108,99,255,0.35)'}`,
          }}>
            {isLimitReached
              ? <ThunderboltOutlined style={{ color: '#fff', fontSize: 28 }} />
              : <LockOutlined style={{ color: '#fff', fontSize: 28 }} />
            }
          </div>

          <Title level={4} style={{ margin: '0 0 8px' }}>
            {isLimitReached ? 'Usage Limit Reached' : 'Feature Locked'}
          </Title>

          <Text type="secondary" style={{ display: 'block', marginBottom: 20, fontSize: 14, lineHeight: 1.6 }}>
            {isLimitReached
              ? `You've used all ${access.limit} allowed this month. Your quota resets on your next billing cycle.`
              : `This feature is not available on your current ${plan.name} plan.`
            }
          </Text>

          <Tag color={colors.brand} style={{ marginBottom: 16, fontSize: 12, padding: '2px 12px' }}>
            Current Plan: {plan.name}
          </Tag>

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            <Button
              type="primary"
              size="large"
              onClick={() => navigate('/settings?tab=plans')}
              style={{
                background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                border: 'none', borderRadius: radii.sm, fontWeight: 600,
                boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
              }}
            >
              {isLimitReached ? 'Upgrade for More' : 'Upgrade Plan'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureGate;
