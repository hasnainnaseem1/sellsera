import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, message, Popconfirm, Tooltip, Row, Col, Statistic, Tag, Input, Modal, Select, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, StopOutlined, StarOutlined, StarFilled,
  SearchOutlined, TeamOutlined, DollarOutlined, AppstoreOutlined,
  ClearOutlined, DownloadOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import plansApi from '../../api/plansApi';
import { PERMISSIONS } from '../../utils/permissions';

const PlansListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  // For delete with reassignment
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletingPlan, setDeletingPlan] = useState(null);
  const [reassignPlanId, setReassignPlanId] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100, sort: 'displayOrder', order: 'asc' };
      if (search) params.search = search;
      if (statusFilter.length > 0) params.isActive = statusFilter.join(',');
      const data = await plansApi.getPlans(params);
      setPlans(data.plans || []);
    } catch {
      message.error('Failed to load plans');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Stats
  const totalPlans = plans.length;
  const activePlans = plans.filter((p) => p.isActive).length;
  const totalCustomers = plans.reduce((sum, p) => sum + (p.customerCount || 0), 0);
  const defaultPlan = plans.find((p) => p.isDefault);

  const handleToggleStatus = async (id) => {
    try {
      await plansApi.togglePlanStatus(id);
      message.success('Plan status updated');
      fetchPlans();
    } catch {
      message.error('Failed to update plan status');
    }
  };

  const handleSetDefault = async (id) => {
    try {
      await plansApi.setDefaultPlan(id);
      message.success('Default plan updated');
      fetchPlans();
    } catch {
      message.error('Failed to set default plan');
    }
  };

  const handleDeleteClick = (plan) => {
    if (plan.customerCount > 0) {
      setDeletingPlan(plan);
      setReassignPlanId(null);
      setDeleteModalOpen(true);
    } else {
      // No customers — delete directly
      handleDeletePlan(plan._id, null);
    }
  };

  const handleDeletePlan = async (planId, reassignTo) => {
    setDeleteLoading(true);
    try {
      await plansApi.deletePlan(planId, reassignTo);
      message.success('Plan deleted successfully');
      setDeleteModalOpen(false);
      setDeletingPlan(null);
      fetchPlans();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Failed to delete plan';
      message.error(msg);
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await plansApi.bulkDeletePlans(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} plan(s) deleted`);
      setSelectedRowKeys([]);
      fetchPlans();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete plans');
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (statusFilter.length > 0) params.isActive = statusFilter.join(',');

      await plansApi.exportPlans(params);
      message.success('Plans exported successfully');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to export plans');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setStatusFilter([]);
  };

  const hasActiveFilters = search || statusFilter.length > 0;

  const columns = [
    {
      title: 'Order',
      dataIndex: 'displayOrder',
      key: 'displayOrder',
      width: 70,
      align: 'center',
    },
    {
      title: 'Plan Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <strong>{name}</strong>
          {record.isDefault && <Tag color="gold" icon={<StarFilled />}>Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Price (Monthly)',
      key: 'priceMonthly',
      render: (_, record) => (
        <span style={{ fontWeight: 600 }}>
          {record.price?.monthly === 0 ? (
            <Tag color="green">Free</Tag>
          ) : (
            `$${record.price?.monthly || 0}/mo`
          )}
        </span>
      ),
    },
    {
      title: 'Price (Yearly)',
      key: 'priceYearly',
      render: (_, record) => (
        <span>
          {record.price?.yearly === 0 ? '—' : `$${record.price?.yearly || 0}/yr`}
        </span>
      ),
    },
    {
      title: 'Features',
      key: 'features',
      render: (_, record) => {
        const enabled = (record.features || []).filter((f) => f.enabled).length;
        const total = (record.features || []).length;
        return <Tag color="blue">{enabled}/{total} enabled</Tag>;
      },
    },
    {
      title: 'Customers',
      dataIndex: 'customerCount',
      key: 'customerCount',
      align: 'center',
      render: (count) => <Tag icon={<TeamOutlined />}>{count || 0}</Tag>,
    },
    {
      title: 'Status',
      key: 'isActive',
      align: 'center',
      render: (_, record) =>
        record.isActive ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />}>Inactive</Tag>
        ),
    },
    {
      title: 'Trial',
      dataIndex: 'trialDays',
      key: 'trialDays',
      align: 'center',
      render: (days) => (days > 0 ? `${days} days` : '—'),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.PLANS_EDIT}>
            <Tooltip title="Edit">
              <Button
                type="text"
                icon={<EditOutlined />}
                onClick={() => navigate(`/plans/${record._id}/edit`)}
              />
            </Tooltip>
          </PermissionGuard>

          <PermissionGuard permission={PERMISSIONS.PLANS_EDIT}>
            <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
              <Popconfirm
                title={`${record.isActive ? 'Deactivate' : 'Activate'} this plan?`}
                onConfirm={() => handleToggleStatus(record._id)}
              >
                <Button
                  type="text"
                  icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />}
                />
              </Popconfirm>
            </Tooltip>
          </PermissionGuard>

          {!record.isDefault && (
            <PermissionGuard permission={PERMISSIONS.PLANS_EDIT}>
              <Tooltip title="Set as Default">
                <Popconfirm
                  title="Set this plan as the default for new signups?"
                  onConfirm={() => handleSetDefault(record._id)}
                >
                  <Button type="text" icon={<StarOutlined />} />
                </Popconfirm>
              </Tooltip>
            </PermissionGuard>
          )}

          <PermissionGuard permission={PERMISSIONS.PLANS_DELETE}>
            <Tooltip title="Delete">
              <Popconfirm
                title="Delete this plan?"
                description={record.customerCount > 0 ? 'This plan has customers that must be reassigned.' : undefined}
                onConfirm={() => handleDeleteClick(record)}
                okText="Delete"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Subscription Plans"
        subtitle="Manage pricing plans and feature allocations"
        extra={
          <PermissionGuard permission={PERMISSIONS.PLANS_CREATE}>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/plans/new')}
            >
              Create Plan
            </Button>
          </PermissionGuard>
        }
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Plans" value={totalPlans} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Active Plans" value={activePlans} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Customers" value={totalCustomers} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Default Plan" value={defaultPlan?.name || '—'} prefix={<StarFilled />} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search plans..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
          />
          <Select
            mode="multiple"
            placeholder="Status"
            allowClear
            value={statusFilter}
            onChange={(v) => setStatusFilter(v || [])}
            style={{ minWidth: 150, maxWidth: 280 }}
            options={[
              { value: 'true', label: 'Active' },
              { value: 'false', label: 'Inactive' },
            ]}
            maxTagCount="responsive"
          />
          {hasActiveFilters && (
            <Button icon={<ClearOutlined />} onClick={handleClearFilters}>
              Clear Filters
            </Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exportLoading}>
            Export CSV
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchPlans}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.PLANS_DELETE) && (
        <Alert
          type="info"
          showIcon
          message={`${selectedRowKeys.length} plan(s) selected`}
          action={
            <Space>
              <Popconfirm title={`Delete ${selectedRowKeys.length} plan(s)?`} description="Plans with active customers cannot be deleted." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Table */}
      <Card>
        <Table
          rowKey="_id"
          dataSource={plans}
          columns={columns}
          loading={loading}
          rowSelection={hasPermission(PERMISSIONS.PLANS_DELETE) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          pagination={false}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* Reassignment Modal */}
      <Modal
        title="Reassign Customers Before Deleting"
        open={deleteModalOpen}
        onCancel={() => { setDeleteModalOpen(false); setDeletingPlan(null); }}
        onOk={() => handleDeletePlan(deletingPlan?._id, reassignPlanId)}
        okText="Reassign & Delete"
        okButtonProps={{ danger: true, disabled: !reassignPlanId, loading: deleteLoading }}
        confirmLoading={deleteLoading}
      >
        <p>
          The plan <strong>{deletingPlan?.name}</strong> has{' '}
          <strong>{deletingPlan?.customerCount}</strong> customer(s). 
          Select a plan to move them to before deleting:
        </p>
        <Select
          placeholder="Select target plan"
          style={{ width: '100%' }}
          value={reassignPlanId}
          onChange={(v) => setReassignPlanId(v)}
          options={plans
            .filter((p) => p._id !== deletingPlan?._id && p.isActive)
            .map((p) => ({ value: p._id, label: `${p.name} ($${p.price?.monthly}/mo)` }))}
        />
      </Modal>
    </div>
  );
};

export default PlansListPage;
