import React from 'react';
import { Result, Button, Space, Typography } from 'antd';
import { CloseCircleOutlined, ArrowLeftOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';

const { Text } = Typography;
const BRAND = '#6C63FF';

const CheckoutCancelPage = () => {
  const navigate = useNavigate();

  return (
    <AppLayout>
      <div style={{ maxWidth: 600, margin: '60px auto', textAlign: 'center' }}>
        <Result
          icon={<CloseCircleOutlined style={{ color: '#faad14', fontSize: 72 }} />}
          title="Checkout Cancelled"
          subTitle={
            <Text type="secondary" style={{ fontSize: 16 }}>
              Your payment was not completed. No charges have been made.
              You can try again anytime.
            </Text>
          }
          extra={
            <Space size="middle">
              <Button
                type="primary"
                size="large"
                icon={<CrownOutlined />}
                onClick={() => navigate('/plans')}
                style={{ background: BRAND, borderColor: BRAND, fontWeight: 600, height: 46, borderRadius: 10 }}
              >
                Back to Plans
              </Button>
              <Button
                size="large"
                icon={<ArrowLeftOutlined />}
                onClick={() => navigate('/dashboard')}
                style={{ fontWeight: 600, height: 46, borderRadius: 10 }}
              >
                Go to Dashboard
              </Button>
            </Space>
          }
        />
      </div>
    </AppLayout>
  );
};

export default CheckoutCancelPage;
