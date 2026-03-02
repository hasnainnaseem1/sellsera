import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Card, Button, Tag, Space, Typography, Badge, Input,
  Select, Tooltip, Modal, message, Empty, Dropdown
} from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined, ReloadOutlined,
  SearchOutlined, FilterOutlined, ExclamationCircleOutlined,
  CheckCircleOutlined, InfoCircleOutlined, WarningOutlined,
  EyeOutlined
} from '@ant-design/icons';
import notificationsApi from '../../api/notificationsApi';

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

const typeColors = {
  welcome: 'green',
  email_verification: 'blue',
  password_reset: 'orange',
  subscription_activated: 'green',
  subscription_expired: 'red',
  subscription_cancelled: 'volcano',
  plan_upgraded: 'purple',
  plan_downgraded: 'orange',
  analysis_limit_reached: 'red',
  account_suspended: 'red',
  account_activated: 'green',
  new_feature: 'blue',
  system_alert: 'orange',
  admin_message: 'purple',
  security_alert: 'red',
};

const priorityIcons = {
  low: <InfoCircleOutlined style={{ color: '#1890ff' }} />,
  medium: <InfoCircleOutlined style={{ color: '#faad14' }} />,
  high: <WarningOutlined style={{ color: '#ff7a45' }} />,
  urgent: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
};

const priorityColors = {
  low: 'blue',
  medium: 'gold',
  high: 'orange',
  urgent: 'red',
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20 });
  const [searchText, setSearchText] = useState('');
  const [filterUnread, setFilterUnread] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [viewModal, setViewModal] = useState(null);

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const data = await notificationsApi.getNotifications({
        limit: pagination.pageSize,
        skip: (pagination.current - 1) * pagination.pageSize,
        unreadOnly: filterUnread,
      });
      setNotifications(data.notifications || []);
      setTotal(data.total || 0);
      setUnreadCount(data.unreadCount || 0);
    } catch {
      message.error('Failed to load notifications');
    } finally {
      setLoading(false);
    }
  }, [pagination, filterUnread]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const handleMarkAsRead = async (id) => {
    try {
      await notificationsApi.markAsRead(id);
      message.success('Marked as read');
      fetchNotifications();
    } catch {
      message.error('Failed to mark as read');
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationsApi.markAllAsRead();
      message.success('All notifications marked as read');
      fetchNotifications();
    } catch {
      message.error('Failed to mark all as read');
    }
  };

  const handleDelete = (id) => {
    confirm({
      title: 'Delete this notification?',
      icon: <ExclamationCircleOutlined />,
      content: 'This action cannot be undone.',
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await notificationsApi.deleteNotification(id);
          message.success('Notification deleted');
          fetchNotifications();
        } catch {
          message.error('Failed to delete notification');
        }
      },
    });
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) return;
    confirm({
      title: `Delete ${selectedRowKeys.length} notification(s)?`,
      icon: <ExclamationCircleOutlined />,
      okText: 'Delete',
      okType: 'danger',
      onOk: async () => {
        try {
          await Promise.all(selectedRowKeys.map((id) => notificationsApi.deleteNotification(id)));
          message.success(`Deleted ${selectedRowKeys.length} notification(s)`);
          setSelectedRowKeys([]);
          fetchNotifications();
        } catch {
          message.error('Failed to delete some notifications');
        }
      },
    });
  };

  const filteredNotifications = searchText
    ? notifications.filter(
        (n) =>
          n.title?.toLowerCase().includes(searchText.toLowerCase()) ||
          n.message?.toLowerCase().includes(searchText.toLowerCase())
      )
    : notifications;

  const columns = [
    {
      title: '',
      dataIndex: 'isRead',
      key: 'isRead',
      width: 40,
      render: (isRead) =>
        !isRead ? (
          <Badge status="processing" />
        ) : (
          <Badge status="default" />
        ),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
      width: 90,
      render: (p) => (
        <Tag color={priorityColors[p]} icon={priorityIcons[p]}>
          {(p || 'medium').toUpperCase()}
        </Tag>
      ),
      filters: [
        { text: 'Urgent', value: 'urgent' },
        { text: 'High', value: 'high' },
        { text: 'Medium', value: 'medium' },
        { text: 'Low', value: 'low' },
      ],
      onFilter: (value, record) => record.priority === value,
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 160,
      render: (type) => (
        <Tag color={typeColors[type] || 'default'}>
          {(type || '').replace(/_/g, ' ').toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title, record) => (
        <Text
          strong={!record.isRead}
          style={{ cursor: 'pointer' }}
          onClick={() => setViewModal(record)}
        >
          {title}
        </Text>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (d) =>
        d
          ? new Date(d).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '-',
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      defaultSortOrder: 'descend',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space>
          <Tooltip title="View">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setViewModal(record)}
            />
          </Tooltip>
          {!record.isRead && (
            <Tooltip title="Mark as read">
              <Button
                type="text"
                size="small"
                icon={<CheckOutlined style={{ color: '#52c41a' }} />}
                onClick={() => handleMarkAsRead(record._id)}
              />
            </Tooltip>
          )}
          <Tooltip title="Delete">
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              onClick={() => handleDelete(record._id)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <BellOutlined style={{ marginRight: 8 }} /> Notifications
          </Title>
          <Text type="secondary">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'} — {total} total
          </Text>
        </div>
        <Space>
          <Button
            icon={<CheckOutlined />}
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0}
          >
            Mark All Read
          </Button>
          {selectedRowKeys.length > 0 && (
            <Button danger icon={<DeleteOutlined />} onClick={handleBulkDelete}>
              Delete ({selectedRowKeys.length})
            </Button>
          )}
          <Button icon={<ReloadOutlined />} onClick={fetchNotifications}>
            Refresh
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card bodyStyle={{ padding: '12px 16px' }} style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search notifications..."
            prefix={<SearchOutlined />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button
            icon={<FilterOutlined />}
            type={filterUnread ? 'primary' : 'default'}
            onClick={() => {
              setFilterUnread(!filterUnread);
              setPagination({ ...pagination, current: 1 });
            }}
          >
            {filterUnread ? 'Showing Unread Only' : 'Show Unread Only'}
          </Button>
        </Space>
      </Card>

      {/* Table */}
      <Card bodyStyle={{ padding: 0 }}>
        <Table
          columns={columns}
          dataSource={filteredNotifications}
          rowKey="_id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
          }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `Total ${t} notifications`,
            onChange: (page, pageSize) =>
              setPagination({ current: page, pageSize }),
          }}
          locale={{
            emptyText: (
              <Empty
                description="No notifications"
                image={
                  <BellOutlined
                    style={{ fontSize: 48, color: '#d4c8ff' }}
                  />
                }
              />
            ),
          }}
        />
      </Card>

      {/* View Modal */}
      <Modal
        title={
          <Space>
            {priorityIcons[viewModal?.priority]}
            <span>{viewModal?.title}</span>
          </Space>
        }
        open={!!viewModal}
        onCancel={() => {
          if (viewModal && !viewModal.isRead) {
            handleMarkAsRead(viewModal._id);
          }
          setViewModal(null);
        }}
        footer={[
          <Button key="close" onClick={() => setViewModal(null)}>
            Close
          </Button>,
          viewModal?.action?.url && (
            <Button
              key="action"
              type="primary"
              href={viewModal.action.url}
              target="_blank"
            >
              {viewModal.action.label || 'View'}
            </Button>
          ),
        ]}
      >
        {viewModal && (
          <div>
            <Space style={{ marginBottom: 16 }}>
              <Tag color={typeColors[viewModal.type] || 'default'}>
                {(viewModal.type || '').replace(/_/g, ' ').toUpperCase()}
              </Tag>
              <Tag color={priorityColors[viewModal.priority]}>
                {(viewModal.priority || 'medium').toUpperCase()}
              </Tag>
              <Text type="secondary">
                {new Date(viewModal.createdAt).toLocaleString()}
              </Text>
            </Space>
            <Paragraph>{viewModal.message}</Paragraph>
            {viewModal.senderName && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                From: {viewModal.senderName}
              </Text>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default NotificationsPage;
