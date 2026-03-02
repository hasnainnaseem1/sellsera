import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Input, Select, Button, Space, Card, message, Popconfirm, Tooltip, Row, Col, Statistic, Tag, Modal, Form, Alert,
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, EyeOutlined, CheckCircleOutlined, SyncOutlined,
  ClearOutlined, DownloadOutlined, StopOutlined, ThunderboltOutlined, DeleteOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import PlanTag from '../../components/common/PlanTag';
import PermissionGuard from '../../components/guards/PermissionGuard';
import customersApi from '../../api/customersApi';
import plansApi from '../../api/plansApi';
import { usePermission } from '../../hooks/usePermission';
import { PERMISSIONS } from '../../utils/permissions';
import { DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';

const CustomersListPage = () => {
  const navigate = useNavigate();
  const { isSuperAdmin } = usePermission();
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', status: [], plan: [], subscriptionStatus: '' });
  
  // Selection for bulk actions
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  
  // Plan change modal
  const [planModalOpen, setPlanModalOpen] = useState(false);
  const [planLoading, setPlanLoading] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [planForm] = Form.useForm();

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await customersApi.getCustomers({
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        status: filters.status.join(','),
        plan: filters.plan.join(','),
        subscriptionStatus: filters.subscriptionStatus,
      });
      setCustomers(data.customers || []);
      setPagination((prev) => ({ ...prev, total: data.pagination?.totalItems || 0 }));
      setStats(data.stats || {});
    } catch {
      message.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    // Fetch available plans for the change plan modal
    const fetchPlans = async () => {
      try {
        const data = await plansApi.getPlans({ isActive: 'true', limit: 100 });
        setAvailablePlans(data.plans || []);
      } catch (err) {
        console.error('Failed to load plans:', err);
      }
    };
    fetchPlans();
  }, []);

  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }));
  };

  const handleSearch = (e) => {
    setFilters((prev) => ({ ...prev, search: e.target.value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      await customersApi.exportCustomers({
        search: filters.search,
        status: filters.status.join(','),
        plan: filters.plan.join(','),
        subscriptionStatus: filters.subscriptionStatus,
      });
      message.success('Customers exported successfully');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to export customers');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClearFilters = () => {
    setFilters({ search: '', status: [], plan: [], subscriptionStatus: '' });
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const hasActiveFilters = filters.search || filters.status.length > 0 || filters.plan.length > 0 || filters.subscriptionStatus;

  const handleSuspendCustomer = async (customer) => {
    const newStatus = customer.status === 'suspended' ? 'active' : 'suspended';
    try {
      await customersApi.updateStatus(customer.id || customer._id, newStatus);
      message.success(`Customer ${newStatus === 'suspended' ? 'suspended' : 'activated'} successfully`);
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update customer status');
    }
  };

  const handleChangePlanClick = (customer) => {
    setSelectedCustomer(customer);
    setPlanModalOpen(true);
  };

  const handleAssignPlan = async (values) => {
    setPlanLoading(true);
    try {
      await customersApi.assignPlan(selectedCustomer.id || selectedCustomer._id, values.planId, values.reason);
      message.success('Plan changed successfully');
      setPlanModalOpen(false);
      planForm.resetFields();
      setSelectedCustomer(null);
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to change plan');
    } finally {
      setPlanLoading(false);
    }
  };

  const handleVerifyEmail = async (id) => {
    try {
      await customersApi.verifyEmail(id);
      message.success('Email verified');
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to verify email');
    }
  };

  const handleResetUsage = async (id) => {
    try {
      await customersApi.resetUsage(id);
      message.success('Usage reset');
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to reset usage');
    }
  };

  // --- Delete (super admin only) ---
  const handleDeleteCustomer = async (id) => {
    try {
      await customersApi.deleteCustomer(id);
      message.success('Customer deleted successfully');
      setSelectedRowKeys((prev) => prev.filter((k) => k !== id));
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete customer');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const result = await customersApi.bulkDeleteCustomers(selectedRowKeys);
      message.success(result.message || `${result.deletedCount} customer(s) deleted`);
      setSelectedRowKeys([]);
      fetchCustomers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete customers');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name, record) => (
        <Button type="link" onClick={() => navigate(`/customers/${record.id || record._id}`)} style={{ padding: 0 }}>
          {name}
        </Button>
      ),
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: 'Plan',
      dataIndex: 'plan',
      key: 'plan',
      width: 100,
      render: (plan) => <PlanTag plan={plan} />,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => <StatusTag status={status} />,
    },
    {
      title: 'Usage',
      key: 'usage',
      width: 100,
      render: (_, record) => `${record.analysisCount || 0}/${record.analysisLimit || 0}`,
    },
    {
      title: 'Email Verified',
      dataIndex: 'isEmailVerified',
      key: 'isEmailVerified',
      width: 120,
      render: (v) => v ? <Tag color="green">Yes</Tag> : <Tag color="red">No</Tag>,
    },
    {
      title: 'Last Login',
      dataIndex: 'lastLogin',
      key: 'lastLogin',
      width: 160,
      render: (date) => formatDateTime(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 220,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/customers/${record.id || record._id}`)} />
          </Tooltip>
          <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
            <Tooltip title="Change Plan">
              <Button size="small" icon={<ThunderboltOutlined />} onClick={() => handleChangePlanClick(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
            <Popconfirm
              title={`${record.status === 'suspended' ? 'Activate' : 'Suspend'} this customer?`}
              onConfirm={() => handleSuspendCustomer(record)}
            >
              <Tooltip title={record.status === 'suspended' ? 'Activate' : 'Suspend'}>
                <Button
                  size="small"
                  icon={<StopOutlined />}
                  danger={record.status !== 'suspended'}
                />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.CUSTOMERS_VERIFY}>
            {!record.isEmailVerified && (
              <Popconfirm title="Manually verify this email?" onConfirm={() => handleVerifyEmail(record.id || record._id)}>
                <Tooltip title="Verify Email">
                  <Button size="small" icon={<CheckCircleOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.CUSTOMERS_EDIT}>
            <Popconfirm title="Reset monthly usage?" onConfirm={() => handleResetUsage(record.id || record._id)}>
              <Tooltip title="Reset Usage">
                <Button size="small" icon={<SyncOutlined />} />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
          {isSuperAdmin && (
            <Popconfirm title="Permanently delete this customer?" onConfirm={() => handleDeleteCustomer(record.id || record._id)} okText="Delete" okButtonProps={{ danger: true }}>
              <Tooltip title="Delete">
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Customers"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Customers' }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total" value={stats.totalCustomers || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Active" value={stats.activeCustomers || 0} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Pro Plan" value={stats.proPlan || 0} valueStyle={{ color: '#7C3AED' }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Subscriptions" value={stats.activeSubscriptions || 0} valueStyle={{ color: '#3B82F6' }} /></Card></Col>
      </Row>

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search by name or email"
            allowClear
            value={filters.search}
            onChange={handleSearch}
            style={{ width: 260 }}
            prefix={<SearchOutlined />}
          />
          <Select
            mode="multiple"
            placeholder="Plan"
            allowClear
            value={filters.plan}
            onChange={(v) => { setFilters((p) => ({ ...p, plan: v || [] })); setPagination((p) => ({ ...p, current: 1 })); }}
            options={[{ value: 'free', label: 'Free' }, { value: 'starter', label: 'Starter' }, { value: 'pro', label: 'Pro' }, { value: 'unlimited', label: 'Unlimited' }]}
            style={{ minWidth: 150, maxWidth: 280 }}
            maxTagCount="responsive"
          />
          <Select
            mode="multiple"
            placeholder="Status"
            allowClear
            value={filters.status}
            onChange={(v) => { setFilters((p) => ({ ...p, status: v || [] })); setPagination((p) => ({ ...p, current: 1 })); }}
            options={[{ value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'pending_verification', label: 'Pending' }]}
            style={{ minWidth: 150, maxWidth: 280 }}
            maxTagCount="responsive"
          />
          <Button icon={<ReloadOutlined />} onClick={fetchCustomers}>Refresh</Button>
          {hasActiveFilters && (
            <Button icon={<ClearOutlined />} onClick={handleClearFilters}>Clear Filters</Button>
          )}
          <PermissionGuard permission={PERMISSIONS.CUSTOMERS_VIEW}>
            <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exportLoading}>Export CSV</Button>
          </PermissionGuard>
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && isSuperAdmin && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message={
            <Space>
              <span>{selectedRowKeys.length} customer(s) selected</span>
              <Popconfirm title={`Permanently delete ${selectedRowKeys.length} customer(s)?`} onConfirm={handleBulkDelete} okText="Delete All" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
            </Space>
          }
        />
      )}

      <Table
        dataSource={customers}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id || r._id}
        rowSelection={isSuperAdmin ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
        pagination={{
          current: pagination.current, pageSize: pagination.pageSize, total: pagination.total,
          showSizeChanger: true, showTotal: (total) => `Total ${total} customers`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 900 }}
        size="middle"
      />

      {/* Change Plan Modal */}
      <Modal
        title="Change Subscription Plan"
        open={planModalOpen}
        onCancel={() => {
          setPlanModalOpen(false);
          planForm.resetFields();
          setSelectedCustomer(null);
        }}
        onOk={() => planForm.submit()}
        confirmLoading={planLoading}
        okText="Change Plan"
      >
        <Form form={planForm} layout="vertical" onFinish={handleAssignPlan}>
          <p style={{ marginBottom: 16, color: '#666' }}>
            Changing plan for: <strong>{selectedCustomer?.name}</strong> ({selectedCustomer?.email})
          </p>
          <Form.Item
            name="planId"
            label="Select Plan"
            rules={[{ required: true, message: 'Please select a plan' }]}
          >
            <Select
              placeholder="Choose a plan..."
              options={availablePlans.map((p) => ({
                value: p._id,
                label: `${p.name} — $${p.price?.monthly || 0}/mo (${(p.features || []).filter(f => f.enabled).length} features)`,
              }))}
            />
          </Form.Item>
          <Form.Item name="reason" label="Reason (optional)">
            <Input.TextArea rows={3} placeholder="Reason for plan change..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CustomersListPage;
