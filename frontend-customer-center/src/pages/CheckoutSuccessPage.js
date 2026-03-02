import React, { useEffect, useRef, useState } from 'react';
import { Result, Button, Space, Typography, Spin } from 'antd';
import { CheckCircleOutlined, DashboardOutlined, CreditCardOutlined, LoadingOutlined } from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import billingApi from '../api/billingApi';

const { Text } = Typography;
const BRAND = '#6C63FF';

const CheckoutSuccessPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { token, fetchMe, updateUser } = useAuth();
  const hasFetched = useRef(false);
  const [verifying, setVerifying] = useState(true);
  const [verifyError, setVerifyError] = useState(null);

  useEffect(() => {
    if (!token || hasFetched.current) return;
    hasFetched.current = true;

    const sessionId = searchParams.get('session_id');

    const activate = async () => {
      try {
        if (sessionId) {
          // Primary path: verify the Stripe session directly (works even without webhook)
          const result = await billingApi.verifySession(sessionId);
          if (result.success && result.user) {
            updateUser(result.user);
          }
        } else {
          // Fallback: just re-fetch the user in case webhook already ran
          await fetchMe(token);
        }
      } catch (err) {
        // Non-fatal — subscription may already be active via webhook
        // Still reload user data
        try { await fetchMe(token); } catch (_) {}
        if (err?.response?.status !== 200) {
          setVerifyError('Could not confirm subscription status. Please refresh the page in a moment.');
        }
      } finally {
        setVerifying(false);
      }
    };

    activate();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (verifying) {
    return (
      <AppLayout>
        <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
          <Spin indicator={<LoadingOutlined style={{ fontSize: 48, color: BRAND }} spin />} />
          <div style={{ marginTop: 24 }}>
            <Text type="secondary" style={{ fontSize: 16 }}>Activating your subscription…</Text>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <Result
          icon={<CheckCircleOutlined style={{ color: '#52c41a', fontSize: 72 }} />}
          title="Payment Successful!"
          subTitle={
            <>
              <Text type="secondary" style={{ fontSize: 16 }}>
                Your subscription has been activated. You now have access to all your plan features.
              </Text>
              {verifyError && (
                <div style={{ marginTop: 12 }}>
                  <Text type="warning" style={{ fontSize: 14 }}>{verifyError}</Text>
                </div>
              )}
            </>
          }
          extra={
            <Space size="middle">
              <Button
                type="primary"
                size="large"
                icon={<DashboardOutlined />}
                onClick={() => navigate('/dashboard')}
                style={{ background: BRAND, borderColor: BRAND, fontWeight: 600, height: 46, borderRadius: 10 }}
              >
                Go to Dashboard
              </Button>
              <Button
                size="large"
                icon={<CreditCardOutlined />}
                onClick={() => navigate('/subscription')}
                style={{ fontWeight: 600, height: 46, borderRadius: 10 }}
              >
                View Subscription
              </Button>
            </Space>
          }
        />
      </div>
    </AppLayout>
  );
};

export default CheckoutSuccessPage;
