import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, message, Popconfirm, Tooltip, Row, Col, Statistic, Tag, Input, Select,
  Modal, Form, InputNumber, Switch, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, StopOutlined, SearchOutlined, AppstoreOutlined,
  ExperimentOutlined, ClearOutlined, DownloadOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import featuresApi from '../../api/featuresApi';
import { PERMISSIONS } from '../../utils/permissions';

const FeaturesListPage = () => {
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [features, setFeatures] = useState([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFeature, setEditingFeature] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchFeatures = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 100, sort: 'displayOrder', order: 'asc' };
      if (search) params.search = search;
      if (typeFilter.length > 0) params.type = typeFilter.join(',');
      if (statusFilter.length > 0) params.isActive = statusFilter.join(',');
      const data = await featuresApi.getFeatures(params);
      setFeatures(data.features || []);
    } catch {
      message.error('Failed to load features');
    } finally {
      setLoading(false);
    }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => {
    fetchFeatures();
  }, [fetchFeatures]);

  // Stats
  const totalFeatures = features.length;
  const activeFeatures = features.filter((f) => f.isActive).length;
  const categories = [...new Set(features.map((f) => f.category))].length;

  const handleCreate = () => {
    setEditingFeature(null);
    form.resetFields();
    form.setFieldsValue({ type: 'boolean', category: 'General', isActive: true, displayOrder: 0 });
    setModalOpen(true);
  };

  const handleEdit = (feature) => {
    setEditingFeature(feature);
    form.setFieldsValue({
      name: feature.name,
      featureKey: feature.featureKey,
      description: feature.description,
      type: feature.type,
      defaultValue: feature.defaultValue,
      unit: feature.unit,
      category: feature.category,
      isActive: feature.isActive,
      displayOrder: feature.displayOrder,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (values) => {
    setSaving(true);
    try {
      if (editingFeature) {
        await featuresApi.updateFeature(editingFeature._id, values);
        message.success('Feature updated');
      } else {
        await featuresApi.createFeature(values);
        message.success('Feature created');
      }
      setModalOpen(false);
      form.resetFields();
      setEditingFeature(null);
      fetchFeatures();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (id) => {
    try {
      await featuresApi.toggleFeatureStatus(id);
      message.success('Status updated');
      fetchFeatures();
    } catch {
      message.error('Failed to toggle status');
    }
  };

  const handleDelete = async (id) => {
    try {
      await featuresApi.deleteFeature(id);
      message.success('Feature deleted');
      fetchFeatures();
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to delete feature');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await featuresApi.bulkDeleteFeatures(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} feature(s) deleted`);
      setSelectedRowKeys([]);
      fetchFeatures();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete features');
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      if (typeFilter.length > 0) params.type = typeFilter.join(',');
      if (statusFilter.length > 0) params.isActive = statusFilter.join(',');

      await featuresApi.exportFeatures(params);
      message.success('Features exported successfully');
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to export features');
    } finally {
      setExportLoading(false);
    }
  };

  const handleClearFilters = () => {
    setSearch('');
    setTypeFilter([]);
    setStatusFilter([]);
  };

  const hasActiveFilters = search || typeFilter.length > 0 || statusFilter.length > 0;

  const typeColor = { boolean: 'green', numeric: 'blue', text: 'orange' };

  const columns = [
    { title: 'Order', dataIndex: 'displayOrder', key: 'displayOrder', width: 70, align: 'center' },
    {
      title: 'Feature Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <div>
          <strong>{name}</strong>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{record.featureKey}</div>
        </div>
      ),
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => <Tag color={typeColor[type]}>{type}</Tag>,
    },
    { title: 'Category', dataIndex: 'category', key: 'category', width: 120 },
    {
      title: 'Unit',
      dataIndex: 'unit',
      key: 'unit',
      width: 130,
      render: (unit) => unit || '—',
    },
    {
      title: 'Plans',
      dataIndex: 'planCount',
      key: 'planCount',
      width: 80,
      align: 'center',
      render: (count) => <Tag>{count || 0}</Tag>,
    },
    {
      title: 'Status',
      key: 'isActive',
      width: 100,
      align: 'center',
      render: (_, record) =>
        record.isActive ? (
          <Tag color="green" icon={<CheckCircleOutlined />}>Active</Tag>
        ) : (
          <Tag color="default" icon={<StopOutlined />}>Inactive</Tag>
        ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.FEATURES_EDIT}>
            <Tooltip title="Edit">
              <Button type="text" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.FEATURES_EDIT}>
            <Tooltip title={record.isActive ? 'Deactivate' : 'Activate'}>
              <Popconfirm title={`${record.isActive ? 'Deactivate' : 'Activate'} this feature?`} onConfirm={() => handleToggleStatus(record._id)}>
                <Button type="text" icon={record.isActive ? <StopOutlined /> : <CheckCircleOutlined />} />
              </Popconfirm>
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.FEATURES_DELETE}>
            <Tooltip title="Delete">
              <Popconfirm title="Delete this feature?" onConfirm={() => handleDelete(record._id)} okButtonProps={{ danger: true }}>
                <Button type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </Tooltip>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  const featureType = Form.useWatch('type', form);

  return (
    <div>
      <PageHeader
        title="Features"
        subtitle="Manage feature definitions that can be attached to plans"
        extra={
          <PermissionGuard permission={PERMISSIONS.FEATURES_CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              Create Feature
            </Button>
          </PermissionGuard>
        }
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Total Features" value={totalFeatures} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Active" value={activeFeatures} valueStyle={{ color: '#52c41a' }} prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8}>
          <Card size="small">
            <Statistic title="Categories" value={categories} prefix={<AppstoreOutlined />} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="Search features..."
            allowClear
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 250 }}
            prefix={<SearchOutlined />}
          />
          <Select
            mode="multiple"
            placeholder="Type"
            allowClear
            value={typeFilter}
            onChange={(v) => setTypeFilter(v || [])}
            style={{ minWidth: 150, maxWidth: 280 }}
            options={[
              { value: 'boolean', label: 'Boolean' },
              { value: 'numeric', label: 'Numeric' },
              { value: 'text', label: 'Text' },
            ]}
            maxTagCount="responsive"
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
          <Button icon={<ReloadOutlined />} onClick={fetchFeatures}>
            Refresh
          </Button>
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.FEATURES_DELETE) && (
        <Alert
          type="info"
          showIcon
          message={`${selectedRowKeys.length} feature(s) selected`}
          action={
            <Space>
              <Popconfirm title={`Delete ${selectedRowKeys.length} feature(s)?`} description="This action cannot be undone." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
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
        <Table rowKey="_id" dataSource={features} columns={columns} loading={loading} rowSelection={hasPermission(PERMISSIONS.FEATURES_DELETE) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined} pagination={false} scroll={{ x: 900 }} />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingFeature ? 'Edit Feature' : 'Create Feature'}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); setEditingFeature(null); form.resetFields(); }}
        onOk={() => form.submit()}
        confirmLoading={saving}
        width={600}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Feature Name" rules={[{ required: true, message: 'Required' }]}>
                <Input placeholder="e.g. Keyword Search" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="featureKey"
                label="Feature Key"
                rules={[
                  { required: true, message: 'Required' },
                  { pattern: /^[a-z][a-z0-9_]*$/, message: 'Lowercase letters, numbers, underscores only' },
                ]}
                extra={editingFeature ? 'Cannot be changed after creation' : 'Machine key (e.g. keyword_search)'}
              >
                <Input placeholder="e.g. keyword_search" disabled={!!editingFeature} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="description" label="Description">
            <Input.TextArea rows={2} placeholder="What does this feature do?" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="type" label="Type" rules={[{ required: true }]}>
                <Select disabled={!!editingFeature}
                  options={[
                    { value: 'boolean', label: 'Boolean (on/off)' },
                    { value: 'numeric', label: 'Numeric (limit)' },
                    { value: 'text', label: 'Text (value)' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="category" label="Category">
                <Input placeholder="e.g. Analysis, Export, AI" />
              </Form.Item>
            </Col>
            <Col span={8}>
              {featureType === 'numeric' && (
                <Form.Item name="unit" label="Unit Label">
                  <Input placeholder="e.g. searches/month" />
                </Form.Item>
              )}
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="displayOrder" label="Display Order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch checkedChildren="Yes" unCheckedChildren="No" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>
    </div>
  );
};

export default FeaturesListPage;
