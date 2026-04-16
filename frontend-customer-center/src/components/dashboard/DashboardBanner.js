import React, { useState, useEffect, useRef } from 'react';
import { Typography, Button } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { radii } from '../../theme/tokens';

const { Title, Text } = Typography;
const STORAGE_KEY = 'sellsera_banner_dismissed';
const BRAND = '#6C63FF';

const DashboardBanner = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const bannerRef = useRef(null);

  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === '1'; } catch { return false; }
  });
  const [hiding, setHiding] = useState(false);
  const [height, setHeight] = useState('auto');

  // Capture natural height on mount for the collapse animation
  useEffect(() => {
    if (!dismissed && bannerRef.current) {
      setHeight(bannerRef.current.scrollHeight + 'px');
    }
  }, [dismissed]);

  const handleDismiss = () => {
    if (bannerRef.current) {
      setHeight(bannerRef.current.scrollHeight + 'px');
      // Force reflow so the browser registers the explicit height before we collapse
      // eslint-disable-next-line no-unused-expressions
      bannerRef.current.offsetHeight;
    }
    setHiding(true);
    try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* ignore */ }

    // After the CSS transition ends, fully remove
    setTimeout(() => setDismissed(true), 320);
  };

  if (dismissed) return null;

  const firstName = user?.name?.split(' ')[0] || 'there';

  return (
    <div
      ref={bannerRef}
      style={{
        height: hiding ? '0px' : height,
        opacity: hiding ? 0 : 1,
        overflow: 'hidden',
        transition: 'height 0.3s ease, opacity 0.25s ease, margin 0.3s ease',
        marginBottom: hiding ? 0 : 24,
      }}
    >
      <div style={{
        position: 'relative',
        borderRadius: radii.lg,
        padding: '24px 48px 24px 28px',
        background: isDark
          ? `linear-gradient(135deg, ${BRAND} 0%, #A78BFA 100%)`
          : `linear-gradient(135deg, #EDE9FE 0%, #DDD6FE 50%, #C4B5FD 100%)`,
        border: isDark ? 'none' : '1px solid #DDD6FE',
        boxShadow: isDark ? 'none' : '0 2px 12px rgba(108,99,255,0.08)',
      }}>
        <Button
          type="text"
          size="small"
          icon={<CloseOutlined />}
          onClick={handleDismiss}
          aria-label="Dismiss banner"
          style={{
            position: 'absolute', top: 12, right: 12,
            color: isDark ? 'rgba(255,255,255,0.65)' : 'rgba(108,99,255,0.5)',
            borderRadius: '50%',
            width: 28, height: 28, minWidth: 28,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => e.currentTarget.style.color = isDark ? '#fff' : BRAND}
          onMouseLeave={e => e.currentTarget.style.color = isDark ? 'rgba(255,255,255,0.65)' : 'rgba(108,99,255,0.5)'}
        />
        <Title level={3} style={{
          color: isDark ? '#fff' : '#4C1D95',
          margin: 0, fontWeight: 700,
        }}>
          Welcome back, {firstName}!
        </Title>
        <Text style={{
          color: isDark ? 'rgba(255,255,255,0.8)' : '#6D28D9',
          fontSize: 14, marginTop: 4, display: 'block',
        }}>
          Here's an overview of your Etsy shop and tools.
        </Text>
      </div>
    </div>
  );
};

export default DashboardBanner;
