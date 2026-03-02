import React, { useState, useEffect } from 'react';
import { Layout, Button, Dropdown, Avatar, Space, Typography, theme, message, Modal } from 'antd';
import {
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  LogoutOutlined,
  KeyOutlined,
  GlobalOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import authApi from '../../api/authApi';
import NotificationsDropdown from '../common/NotificationsDropdown';
import { getInitials } from '../../utils/helpers';
import { formatStatus } from '../../utils/helpers';
import ChangePasswordModal from '../common/ChangePasswordModal';
import TimezoneModal from '../common/TimezoneModal';

const { Header } = Layout;
const { Text } = Typography;

const AppHeader = ({ collapsed, setCollapsed }) => {
  const { user, logout, updateUserData } = useAuth();
  const navigate = useNavigate();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [timezoneModalOpen, setTimezoneModalOpen] = useState(false);
  const [requestResetLoading, setRequestResetLoading] = useState(false);
  const {
    token: { colorBgContainer },
  } = theme.useToken();

  // Sync user timezone to localStorage on user change
  useEffect(() => {
    if (user?.timezone) {
      localStorage.setItem('userTimezone', user.timezone);
    }
  }, [user?.timezone]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleRequestPasswordReset = async () => {
    Modal.confirm({
      title: 'Request Password Reset',
      content: 'Send a password reset request to your Super Admin? You will be notified when your password is reset.',
      okText: 'Yes, Request Reset',
      cancelText: 'Cancel',
      onOk: async () => {
        setRequestResetLoading(true);
        try {
          const data = await authApi.requestPasswordReset();
          message.success(data.message || 'Password reset request sent successfully');
        } catch (error) {
          message.error(error.response?.data?.message || 'Failed to send reset request');
        } finally {
          setRequestResetLoading(false);
        }
      }
    });
  };

  const dropdownItems = {
    items: [
      {
        key: 'info',
        label: (
          <div style={{ padding: '4px 0' }}>
            <div style={{ fontWeight: 600 }}>{user?.name}</div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {user?.email}
            </Text>
            <br />
            <Text type="secondary" style={{ fontSize: 12 }}>
              Role: {formatStatus(user?.role)}
            </Text>
          </div>
        ),
        disabled: true,
      },
      { type: 'divider' },
      ...(user?.role === 'super_admin' 
        ? [{
            key: 'change-password',
            icon: <KeyOutlined />,
            label: 'Change Password',
            onClick: () => setPasswordModalOpen(true),
          }]
        : [{
            key: 'request-password-reset',
            icon: <KeyOutlined />,
            label: 'Request Password Reset',
            onClick: handleRequestPasswordReset,
          }]
      ),
      {
        key: 'timezone',
        icon: <GlobalOutlined />,
        label: 'Timezone Settings',
        onClick: () => setTimezoneModalOpen(true),
      },
      { type: 'divider' },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
        onClick: handleLogout,
      },
    ],
  };

  return (
    <Header
      style={{
        padding: '0 24px',
        background: colorBgContainer,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <Button
        type="text"
        icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        onClick={() => setCollapsed(!collapsed)}
        style={{ fontSize: 16, width: 48, height: 48 }}
      />

      <Space size="middle">
        <NotificationsDropdown />
        <Dropdown menu={dropdownItems} trigger={['click']} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar
              style={{ backgroundColor: '#7C3AED' }}
              icon={<UserOutlined />}
            >
              {user?.name ? getInitials(user.name) : null}
            </Avatar>
            <span style={{ fontWeight: 500 }}>{user?.name}</span>
          </Space>
        </Dropdown>
      </Space>

      <ChangePasswordModal 
        open={passwordModalOpen} 
        onClose={() => setPasswordModalOpen(false)} 
      />
      
      <TimezoneModal
        open={timezoneModalOpen}
        onClose={() => setTimezoneModalOpen(false)}
        currentTimezone={user?.timezone || 'UTC'}
        onTimezoneChange={(tz) => {
          if (updateUserData) {
            updateUserData({ timezone: tz });
          }
        }}
      />
    </Header>
  );
};

export default AppHeader;
