import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  message,
  Popconfirm,
  Tooltip,
  Modal,
  Form,
  Input,
  Switch,
  Badge,
  Statistic,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import departmentsApi from '../../api/departmentsApi';
import { PERMISSIONS } from '../../utils/permissions';
import { formatDateTime } from '../../utils/helpers';

const DepartmentsPage = () => {
  const [loading, setLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState(null);
  const [form] = Form.useForm();

  const fetchDepartments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await departmentsApi.getDepartments();
      setDepartments(data.departments || []);
    } catch (err) {
      message.error('Failed to load departments');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  const handleSeedDefaults = async () => {
    try {
      const data = await departmentsApi.seedDefaultDepartments();
      message.success(data.message || 'Default departments seeded successfully');
      fetchDepartments();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to seed default departments');
    }
  };

  const handleCreate = () => {
    setEditingDepartment(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true });
    setModalOpen(true);
  };

  const handleEdit = (department) => {
    setEditingDepartment(department);
    form.setFieldsValue({
      name: department.name,
      description: department.description,
      isActive: department.isActive,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id) => {
    try {
      await departmentsApi.deleteDepartment(id);
      message.success('Department deleted successfully');
      fetchDepartments();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete department');
    }
  };

  const handleSubmit = async (values) => {
    try {
      if (editingDepartment) {
        await departmentsApi.updateDepartment(editingDepartment.id, values);
        message.success('Department updated successfully');
      } else {
        await departmentsApi.createDepartment(values);
        message.success('Department created successfully');
      }
      setModalOpen(false);
      form.resetFields();
      fetchDepartments();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to save department');
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name, record) => (
        <Space>
          <strong>{name}</strong>
          {record.isDefault && <Tag color="blue">Default</Tag>}
        </Space>
      ),
    },
    {
      title: 'Value',
      dataIndex: 'value',
      key: 'value',
      render: (value) => <code style={{ fontSize: 12, color: '#666' }}>{value}</code>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => desc || <span style={{ color: '#999' }}>—</span>,
    },
    {
      title: 'Users',
      dataIndex: 'userCount',
      key: 'userCount',
      width: 100,
      render: (count) => (
        <Badge count={count || 0} style={{ backgroundColor: count > 0 ? '#52c41a' : '#d9d9d9' }} />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 100,
      render: (active) =>
        active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (date) => formatDateTime(date),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Tooltip title="Edit">
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={() => handleEdit(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Popconfirm
              title={
                record.isDefault
                  ? 'Cannot delete default department'
                  : 'Delete this department? Users assigned to it will need reassignment.'
              }
              onConfirm={() => handleDelete(record.id)}
              disabled={record.isDefault}
            >
              <Tooltip title={record.isDefault ? 'Cannot delete default department' : 'Delete'}>
                <Button
                  size="small"
                  icon={<DeleteOutlined />}
                  danger
                  disabled={record.isDefault}
                />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  const activeDepartments = departments.filter((d) => d.isActive).length;
  const totalUsers = departments.reduce((sum, d) => sum + (d.userCount || 0), 0);

  return (
    <div>
      <PageHeader
        title="Departments"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Settings' }, { label: 'Departments' }]}
        extra={
          <Space>
            <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
              <Button onClick={handleSeedDefaults} icon={<DatabaseOutlined />}>
                Seed Defaults
              </Button>
            </PermissionGuard>
            <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
                Create Department
              </Button>
            </PermissionGuard>
          </Space>
        }
      />

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Departments"
              value={departments.length}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Active Departments"
              value={activeDepartments}
              valueStyle={{ color: '#3f8600' }}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Total Users"
              value={totalUsers}
              prefix={<TeamOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Departments Table */}
      <Card>
        <Table
          dataSource={departments}
          columns={columns}
          rowKey={(r) => r.id || r._id}
          loading={loading}
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (total) => `Total ${total} departments` }}
          size="middle"
        />
      </Card>

      {/* Create/Edit Modal */}
      <Modal
        title={editingDepartment ? 'Edit Department' : 'Create Department'}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText={editingDepartment ? 'Update' : 'Create'}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            name="name"
            label="Department Name"
            rules={[{ required: true, message: 'Please enter department name' }]}
          >
            <Input placeholder="e.g., Engineering, Sales, Marketing" />
          </Form.Item>

          <Form.Item name="description" label="Description">
            <Input.TextArea
              rows={3}
              placeholder="Brief description of this department's responsibilities"
            />
          </Form.Item>

          <Form.Item name="isActive" label="Status" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>

          {editingDepartment && editingDepartment.isDefault && (
            <div style={{ padding: '8px 12px', background: '#e6f7ff', border: '1px solid #91d5ff', borderRadius: 4 }}>
              <small>
                <strong>Note:</strong> This is a default department. It can be edited but not deleted.
              </small>
            </div>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default DepartmentsPage;
