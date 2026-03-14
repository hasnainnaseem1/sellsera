import React, { useState } from 'react';
import { Alert, Button } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../context/PermissionsContext';

/**
 * QuotaBanner — persistent warning when a feature is above 80% usage.
 *
 * Props:
 *   featureKey  — the plan feature key
 *   featureName — display name
 */
const QuotaBanner = ({ featureKey, featureName }) => {
  const [dismissed, setDismissed] = useState(false);
  const { getFeatureAccess, plan } = usePermissions();
  const navigate = useNavigate();
  const access = getFeatureAccess(featureKey);

  if (dismissed) return null;
  if (!access.enabled || access.unlimited || !access.limit) return null;

  const pct = Math.round((access.used / access.limit) * 100);
  if (pct < 80) return null;

  const isExhausted = access.remaining <= 0;

  return (
    <Alert
      type={isExhausted ? 'error' : 'warning'}
      showIcon
      icon={<ThunderboltOutlined />}
      closable
      onClose={() => setDismissed(true)}
      message={
        isExhausted
          ? `${featureName || featureKey} limit reached`
          : `${featureName || featureKey} quota almost full`
      }
      description={
        isExhausted
          ? `You've used all ${access.limit} ${featureName || featureKey} this month. Resets on your next billing cycle.`
          : `You've used ${access.used} of ${access.limit} ${featureName || featureKey} this month (${pct}%).`
      }
      action={
        <Button
          size="small"
          type="primary"
          onClick={() => navigate('/settings?tab=plans')}
        >
          Upgrade
        </Button>
      }
      style={{ marginBottom: 16, borderRadius: 12 }}
    />
  );
};

export default QuotaBanner;
