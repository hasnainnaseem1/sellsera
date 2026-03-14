import React from 'react';
import { Modal, Button, Typography, Tag, List, Space } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, CrownOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../context/PermissionsContext';
import { useTheme } from '../../context/ThemeContext';
import { colors, radii } from '../../theme/tokens';

const { Title, Text } = Typography;

/**
 * UpgradeModal — triggered when user clicks a locked feature.
 *
 * Props:
 *   open          — boolean
 *   onClose       — close handler
 *   featureKey    — which feature triggered this
 *   featureName   — display name of the feature
 */
const UpgradeModal = ({ open, onClose, featureKey, featureName }) => {
  const navigate = useNavigate();
  const { plan } = usePermissions();
  const { isDark } = useTheme();

  const benefits = [
    { label: 'Listing Audits', free: '1/month', pro: 'Unlimited' },
    { label: 'Keyword Research', free: '5/month', pro: '50/month' },
    { label: 'Competitor Tracking', free: false, pro: true },
    { label: 'CSV Export', free: false, pro: true },
    { label: 'Priority Support', free: false, pro: true },
  ];

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      width={480}
      styles={{
        content: {
          borderRadius: radii.lg,
          background: isDark ? colors.darkCard : colors.lightCard,
          padding: 0,
          overflow: 'hidden',
        },
      }}
    >
      {/* Header gradient */}
      <div style={{
        background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
        padding: '32px 32px 24px',
        textAlign: 'center',
      }}>
        <CrownOutlined style={{ fontSize: 40, color: '#fff', marginBottom: 12 }} />
        <Title level={3} style={{ color: '#fff', margin: 0 }}>
          Unlock {featureName || 'Premium Features'}
        </Title>
        <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 14 }}>
          Upgrade your plan to access this feature
        </Text>
      </div>

      <div style={{ padding: '24px 32px 32px' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, justifyContent: 'center' }}>
          <Tag style={{ fontSize: 12, padding: '2px 10px' }}>Current: {plan.name}</Tag>
        </div>

        <List
          size="small"
          dataSource={benefits}
          renderItem={item => (
            <List.Item style={{ padding: '8px 0', border: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                <Text style={{ fontSize: 13 }}>{item.label}</Text>
                <Space size={16}>
                  <span style={{ fontSize: 12, color: colors.muted, minWidth: 70, textAlign: 'center' }}>
                    {item.free === false
                      ? <CloseCircleOutlined style={{ color: colors.danger }} />
                      : item.free
                    }
                  </span>
                  <span style={{ fontSize: 12, color: colors.success, fontWeight: 600, minWidth: 70, textAlign: 'center' }}>
                    {item.pro === true
                      ? <CheckCircleOutlined style={{ color: colors.success }} />
                      : item.pro
                    }
                  </span>
                </Space>
              </div>
            </List.Item>
          )}
        />

        <Button
          type="primary"
          block
          size="large"
          onClick={() => { onClose(); navigate('/settings?tab=plans'); }}
          style={{
            marginTop: 20,
            background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
            border: 'none', borderRadius: radii.sm,
            fontWeight: 600, height: 48,
            boxShadow: '0 4px 14px rgba(108,99,255,0.4)',
          }}
        >
          See All Plans
        </Button>
      </div>
    </Modal>
  );
};

export default UpgradeModal;
