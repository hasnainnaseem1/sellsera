import React from 'react';
import { Result, Typography, theme } from 'antd';
import { ToolOutlined } from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';

const { Text } = Typography;

const MaintenancePage = ({ message }) => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: isDark
          ? 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 100%)'
          : 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
        padding: 24,
      }}
    >
      <div
        style={{
          background: isDark ? 'rgba(26, 26, 46, 0.9)' : '#fff',
          borderRadius: 16,
          padding: '48px 40px',
          maxWidth: 520,
          width: '100%',
          textAlign: 'center',
          boxShadow: isDark
            ? '0 8px 32px rgba(0,0,0,0.4)'
            : '0 8px 32px rgba(124,58,237,0.08)',
        }}
      >
        <ToolOutlined
          style={{
            fontSize: 56,
            color: tok.colorPrimary,
            marginBottom: 24,
          }}
        />
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            color: isDark ? '#e8e8f0' : '#1a1a2e',
            marginBottom: 12,
          }}
        >
          Under Maintenance
        </h1>
        <Text
          type="secondary"
          style={{ fontSize: 16, lineHeight: 1.6, display: 'block' }}
        >
          {message || 'We are currently performing maintenance. Please check back soon.'}
        </Text>
      </div>
    </div>
  );
};

export default MaintenancePage;
