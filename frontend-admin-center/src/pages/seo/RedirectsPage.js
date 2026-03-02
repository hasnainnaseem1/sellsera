import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select, Switch, Space, Tag,
  message, Popconfirm, Typography, Tooltip, Row, Col, Badge, Statistic,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SwapRightOutlined,
  SearchOutlined, ReloadOutlined, LinkOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import seoApi from '../../api/seoApi';
import { PERMISSIONS } from '../../utils/permissions';

const { Text, Paragraph } = Typography;
const { Option } = Select;

const statusCodeColors = {
  301: 'blue',
  302: 'orange',
  307: 'purple',
  308: 'cyan',
};

const RedirectsPage = () => {
  const { hasPermission } = usePermission();
  const [redirects, setRedirects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  const canUpdate = hasPermission(PERMISSIONS.SETTINGS_EDIT);

  const fetchRedirects = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: pagination.pageSize,
      };
      if (search) params.search = search;
      if (statusFilter !== 'all') params.status = statusFilter;

      const data = await seoApi.getRedirects(params);
      if (data.success) {
        setRedirects(data.redirects);
        setPagination(prev => ({
          ...prev,
          current: data.pagination?.page || page,
          total: data.pagination?.total || 0,
        }));
      }
    } catch (err) {
      message.error('Failed to load redirects');
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, pagination.pageSize]);

  useEffect(() => {
    fetchRedirects();
  }, [fetchRedirects]);

  const handleSearch = (value) => {
    setSearch(value);
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const handleTableChange = (paginationConfig) => {
    fetchRedirects(paginationConfig.current);
  };

  const openCreateModal = () => {
    setEditingRedirect(null);
    form.resetFields();
    form.setFieldsValue({ statusCode: 301, isActive: true });
    setModalOpen(true);
  };

  const openEditModal = (record) => {
    setEditingRedirect(record);
    form.setFieldsValue({
      fromPath: record.fromPath,
      toPath: record.toPath,
      statusCode: record.statusCode,
      isActive: record.isActive,
      note: record.note,
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      if (editingRedirect) {
        await seoApi.updateRedirect(editingRedirect._id, values);
        message.success('Redirect updated');
      } else {
        await seoApi.createRedirect(values);
        message.success('Redirect created');
      }

      setModalOpen(false);
      fetchRedirects(pagination.current);
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save redirect');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await seoApi.deleteRedirect(id);
      message.success('Redirect deleted');
      fetchRedirects(pagination.current);
    } catch (err) {
      message.error('Failed to delete redirect');
    }
  };

  const handleToggle = async (record) => {
    try {
      await seoApi.toggleRedirect(record._id);
      message.success(`Redirect ${record.isActive ? 'disabled' : 'enabled'}`);
      fetchRedirects(pagination.current);
    } catch (err) {
      message.error('Failed to toggle redirect');
    }
  };

  const columns = [
    {
      title: 'From',
      dataIndex: 'fromPath',
      key: 'fromPath',
      render: (val) => (
        <Text code style={{ fontSize: 13 }}>{val}</Text>
      ),
    },
    {
      title: '',
      key: 'arrow',
      width: 40,
      render: () => <SwapRightOutlined style={{ color: '#999' }} />,
    },
    {
      title: 'To',
      dataIndex: 'toPath',
      key: 'toPath',
      render: (val) => (
        <Text code style={{ fontSize: 13 }}>{val}</Text>
      ),
    },
    {
      title: 'Status Code',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 110,
      render: (code) => (
        <Tag color={statusCodeColors[code] || 'default'}>{code}</Tag>
      ),
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (val, record) => (
        <Switch
          size="small"
          checked={val}
          onChange={() => handleToggle(record)}
          disabled={!canUpdate}
        />
      ),
    },
    {
      title: 'Hits',
      dataIndex: 'hitCount',
      key: 'hitCount',
      width: 70,
      render: (val) => <Badge count={val || 0} showZero overflowCount={99999} style={{ backgroundColor: '#52c41a' }} />,
    },
    {
      title: 'Last Hit',
      dataIndex: 'lastHitAt',
      key: 'lastHitAt',
      width: 140,
      render: (val) =>
        val ? new Date(val).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—',
    },
    {
      title: 'Note',
      dataIndex: 'note',
      key: 'note',
      ellipsis: true,
      width: 150,
      render: (val) => val || '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 100,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Tooltip title="Edit">
              <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEditModal(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Popconfirm title="Delete this redirect?" onConfirm={() => handleDelete(record._id)}>
              <Tooltip title="Delete">
                <Button type="text" size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  // Summary stats
  const totalRedirects = redirects.length;
  const activeRedirects = redirects.filter(r => r.isActive).length;
  const totalHits = redirects.reduce((sum, r) => sum + (r.hitCount || 0), 0);

  return (
    <div>
      <PageHeader
        title="URL Redirects"
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Marketing Site' },
          { label: 'Redirects' },
        ]}
        extra={
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>
              Add Redirect
            </Button>
          </PermissionGuard>
        }
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Total Redirects" value={pagination.total} prefix={<LinkOutlined />} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Active" value={activeRedirects} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={8}>
          <Card size="small">
            <Statistic title="Total Hits" value={totalHits} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card size="small" style={{ marginBottom: 16 }}>
        <Row gutter={16} align="middle">
          <Col flex="auto">
            <Input.Search
              placeholder="Search by path..."
              allowClear
              onSearch={handleSearch}
              style={{ maxWidth: 400 }}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col>
            <Select value={statusFilter} onChange={setStatusFilter} style={{ width: 130 }}>
              <Option value="all">All Status</Option>
              <Option value="active">Active</Option>
              <Option value="inactive">Inactive</Option>
            </Select>
          </Col>
          <Col>
            <Tooltip title="Refresh">
              <Button icon={<ReloadOutlined />} onClick={() => fetchRedirects(pagination.current)} />
            </Tooltip>
          </Col>
        </Row>
      </Card>

      {/* Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={redirects}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: false,
            showTotal: (total) => `${total} redirects`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 900 }}
          size="middle"
        />
      </Card>

      {/* Create / Edit Modal */}
      <Modal
        title={editingRedirect ? 'Edit Redirect' : 'New Redirect'}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSave}
        confirmLoading={saving}
        okText={editingRedirect ? 'Update' : 'Create'}
        width={540}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item
            name="fromPath"
            label="From Path"
            rules={[{ required: true, message: 'From path is required' }]}
            help="The old URL path to redirect from (e.g., /old-page)"
          >
            <Input placeholder="/old-page" addonBefore="/" />
          </Form.Item>

          <Form.Item
            name="toPath"
            label="To Path"
            rules={[{ required: true, message: 'To path is required' }]}
            help="The new URL path to redirect to (e.g., /new-page)"
          >
            <Input placeholder="/new-page" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="statusCode"
                label="Status Code"
                rules={[{ required: true }]}
              >
                <Select>
                  <Option value={301}>301 — Permanent</Option>
                  <Option value={302}>302 — Temporary</Option>
                  <Option value={307}>307 — Temp (Strict)</Option>
                  <Option value={308}>308 — Perm (Strict)</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="isActive" label="Active" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="note" label="Note (optional)">
            <Input placeholder="Reason for redirect..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default RedirectsPage;
