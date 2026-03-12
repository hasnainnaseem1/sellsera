import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Typography, Tag, Space, Button, Empty, theme, message,
  Row, Col, Statistic, Tooltip
} from 'antd';
import {
  CreditCardOutlined, DollarOutlined, DownloadOutlined,
  CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import AppLayout from '../components/AppLayout';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import billingApi from '../api/billingApi';

const { Title, Text } = Typography;
const BRAND = '#6C63FF';

const statusConfig = {
  succeeded: { color: 'green', icon: <CheckCircleOutlined />, label: 'Paid' },
  pending: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Pending' },
  failed: { color: 'red', icon: <CloseCircleOutlined />, label: 'Failed' },
  refunded: { color: 'orange', icon: <DollarOutlined />, label: 'Refunded' },
  cancelled: { color: 'default', icon: <CloseCircleOutlined />, label: 'Cancelled' },
};

const BillingPage = () => {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const card = {
    border: `1px solid ${isDark ? '#2e2e4a' : '#ebebf8'}`,
    borderRadius: 16,
    background: tok.colorBgContainer,
    boxShadow: isDark ? 'none' : '0 2px 12px rgba(108,99,255,0.06)',
  };

  const loadPayments = useCallback(async (page = 1, limit = 10) => {
    try {
      setLoading(true);
      const data = await billingApi.getPayments({ page, limit });
      setPayments(data.payments || []);
      setPagination({
        current: data.pagination?.page || page,
        pageSize: limit,
        total: data.pagination?.total || 0,
      });
    } catch {
      message.error('Failed to load payment history');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  // Manage Billing is handled in-app — no external portal redirect needed

  const columns = [
    {
      title: 'Date',
      dataIndex: 'paidAt',
      key: 'paidAt',
      width: 140,
      render: (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-',
      sorter: (a, b) => new Date(a.paidAt) - new Date(b.paidAt),
    },
    {
      title: 'Plan',
      dataIndex: 'planName',
      key: 'planName',
      render: (name) => <Text strong>{name || '-'}</Text>,
    },
    {
      title: 'Amount',
      dataIndex: 'amount',
      key: 'amount',
      width: 120,
      render: (amt, rec) => (
        <Text strong style={{ color: '#52c41a', fontSize: 15 }}>
          ${(amt || 0).toFixed(2)} {rec.currency?.toUpperCase()}
        </Text>
      ),
    },
    {
      title: 'Cycle',
      dataIndex: 'billingCycle',
      key: 'billingCycle',
      width: 100,
      render: (c) => <Tag>{c || '-'}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (s) => {
        const cfg = statusConfig[s] || statusConfig.pending;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, rec) => (
        <Space>
          {rec.receiptUrl && (
            <Tooltip title="View Receipt">
              <Button
                type="text" size="small"
                icon={<FileTextOutlined />}
                href={rec.receiptUrl}
                target="_blank"
              />
            </Tooltip>
          )}
          {rec.invoiceUrl && (
            <Tooltip title="View Invoice">
              <Button
                type="text" size="small"
                icon={<DownloadOutlined />}
                href={rec.invoiceUrl}
                target="_blank"
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <AppLayout>
      <div style={{ maxWidth: 960, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
              <CreditCardOutlined style={{ color: BRAND }} /> Billing History
            </Title>
            <Text type="secondary">View your payment history and invoices</Text>
          </div>
        </div>

        {/* Stats */}
        <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
          <Col xs={24} sm={8}>
            <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Total Paid (this page)</Text>}
                value={totalPaid.toFixed(2)}
                prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                styles={{ content: { color: '#52c41a', fontWeight: 700 } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Total Invoices</Text>}
                value={pagination.total}
                prefix={<FileTextOutlined style={{ color: BRAND }} />}
                styles={{ content: { color: BRAND, fontWeight: 700 } }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card style={card} styles={{ body: { padding: '20px 24px' } }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>Current Plan</Text>}
                value={user?.planSnapshot?.planName || user?.plan || 'Free'}
                prefix={<CreditCardOutlined style={{ color: '#faad14' }} />}
                styles={{ content: { fontWeight: 700, color: '#faad14', fontSize: 18 } }}
              />
            </Card>
          </Col>
        </Row>

        {/* Table */}
        <Card style={card} styles={{ body: { padding: 0 } }}>
          <Table
            columns={columns}
            dataSource={payments}
            rowKey="_id"
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showTotal: (total) => `Total ${total} payments`,
              onChange: (page, pageSize) => loadPayments(page, pageSize),
            }}
            locale={{
              emptyText: (
                <Empty
                  description="No payments yet"
                  image={<CreditCardOutlined style={{ fontSize: 48, color: isDark ? '#3a3a5c' : '#d4c8ff' }} />}
                />
              ),
            }}
            style={{ borderRadius: 16, overflow: 'hidden' }}
          />
        </Card>
      </div>
    </AppLayout>
  );
};

export default BillingPage;
