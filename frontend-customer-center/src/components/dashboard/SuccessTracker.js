import React, { useState, useEffect } from 'react';
import { Card, Steps, Typography, Button, Space } from 'antd';
import {
  CheckCircleOutlined, UserOutlined, ThunderboltOutlined,
  RocketOutlined, KeyOutlined, EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext';
import { colors, radii } from '../../theme/tokens';

const { Text } = Typography;

const STORAGE_KEY = 'sellsera_success_tracker';

const STEPS = [
  { key: 'account',     label: 'Create Account',       icon: <UserOutlined />,          route: null },
  { key: 'first_audit', label: 'Run First Audit',      icon: <ThunderboltOutlined />,   route: '/audit' },
  { key: 'view_result', label: 'Review Results',       icon: <EyeOutlined />,           route: '/history' },
  { key: 'keywords',    label: 'Research Keywords',    icon: <KeyOutlined />,           route: '/keywords' },
  { key: 'optimize',    label: 'Apply & Optimize',     icon: <RocketOutlined />,        route: null },
];

/**
 * SuccessTracker — gamified onboarding progress bar.
 * Steps tracked via localStorage, no backend required.
 */
const SuccessTracker = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [completed, setCompleted] = useState({});
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      // Account creation is always done if user sees this
      saved.account = true;
      setCompleted(saved);
      setCollapsed(saved._collapsed || false);
    } catch {
      setCompleted({ account: true });
    }
  }, []);

  const markComplete = (key) => {
    const updated = { ...completed, [key]: true };
    setCompleted(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const toggleCollapse = () => {
    const updated = { ...completed, _collapsed: !collapsed };
    setCollapsed(!collapsed);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const completedCount = STEPS.filter(s => completed[s.key]).length;
  const allDone = completedCount === STEPS.length;

  // Once all 5 complete and user collapses — don't render anymore
  if (allDone && collapsed) return null;

  const currentStep = STEPS.findIndex(s => !completed[s.key]);

  return (
    <Card
      size="small"
      style={{
        borderRadius: radii.lg,
        border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
        marginBottom: 24,
        background: isDark ? colors.darkCard : colors.lightCard,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: collapsed ? 0 : 16 }}>
        <Space>
          <Text strong style={{ fontSize: 14 }}>
            {allDone ? '🎉 All set! You\'re a pro.' : `Getting Started — ${completedCount}/${STEPS.length}`}
          </Text>
        </Space>
        <Button type="text" size="small" onClick={toggleCollapse}>
          {collapsed ? 'Expand' : 'Hide'}
        </Button>
      </div>

      {!collapsed && (
        <Steps
          current={currentStep === -1 ? STEPS.length : currentStep}
          size="small"
          items={STEPS.map((step) => ({
            title: (
              <span style={{ fontSize: 12 }}>
                {step.label}
              </span>
            ),
            icon: completed[step.key]
              ? <CheckCircleOutlined style={{ color: colors.success }} />
              : step.icon,
            status: completed[step.key] ? 'finish' : undefined,
            description: !completed[step.key] && step.route ? (
              <Button
                type="link" size="small"
                style={{ fontSize: 11, padding: 0, height: 'auto' }}
                onClick={() => {
                  markComplete(step.key);
                  navigate(step.route);
                }}
              >
                Start →
              </Button>
            ) : null,
          }))}
        />
      )}
    </Card>
  );
};

// Export a helper to mark steps complete from other pages
export const markTrackerStep = (key) => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (!saved[key]) {
      saved[key] = true;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    }
  } catch { /* ignore */ }
};

export default SuccessTracker;
