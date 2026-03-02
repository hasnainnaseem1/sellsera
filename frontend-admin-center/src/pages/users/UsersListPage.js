import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Input, Select, Button, Space, Modal, Form, message, Popconfirm, Tooltip, Card, Row, Col, Statistic, Avatar, Alert,
} from 'antd';
import {
  PlusOutlined, SearchOutlined, ReloadOutlined, StopOutlined, CheckCircleOutlined, DeleteOutlined, EyeOutlined, ClearOutlined, DownloadOutlined, EditOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import StatusTag from '../../components/common/StatusTag';
import RoleTag from '../../components/common/RoleTag';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import usersApi from '../../api/usersApi';
import departmentsApi from '../../api/departmentsApi';
import rolesApi from '../../api/rolesApi';
import { PERMISSIONS } from '../../utils/permissions';
import { ROLES, STATUS, DEFAULT_PAGE_SIZE } from '../../utils/constants';
import { formatDateTime } from '../../utils/helpers';

const UsersListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({ current: 1, pageSize: DEFAULT_PAGE_SIZE, total: 0 });
  const [stats, setStats] = useState({});
  const [filters, setFilters] = useState({ search: '', role: [], status: [] });
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();
  const [exportLoading, setExportLoading] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();
  const [customRoles, setCustomRoles] = useState([]);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: pagination.current,
        limit: pagination.pageSize,
        search: filters.search,
        accountType: 'admin', // Only show admin-type users in admin-center
      };
      if (filters.role.length > 0) params.role = filters.role.join(',');
      if (filters.status.length > 0) params.status = filters.status.join(',');
      
      const data = await usersApi.getUsers(params);
      setUsers(data.users || []);
      setPagination((prev) => ({ ...prev, total: data.pagination?.totalItems || 0 }));
      setStats(data.stats || {});
    } catch {
      message.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, [pagination.current, pagination.pageSize, filters]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch departments for filter dropdown
  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const data = await departmentsApi.getActiveDepartments();
        setDepartments(data.departments || []);
      } catch (err) {
        console.error('Failed to load departments:', err);
      }
    };
    loadDepartments();
  }, []);

  // Fetch custom roles for role dropdown
  useEffect(() => {
    const loadCustomRoles = async () => {
      try {
        const data = await rolesApi.getRoles();
        setCustomRoles(data.customRoles || []);
      } catch (err) {
        console.error('Failed to load custom roles:', err);
      }
    };
    loadCustomRoles();
  }, []);

  const handleTableChange = (pag) => {
    setPagination((prev) => ({ ...prev, current: pag.current, pageSize: pag.pageSize }));
  };

  // Build role options including built-in and custom roles
  const getRoleOptions = () => {
    const builtInRoles = [
      { value: 'admin', label: 'Admin' },
      { value: 'moderator', label: 'Moderator' },
      { value: 'viewer', label: 'Viewer' },
    ];
    
    const customRoleOptions = customRoles.map(role => ({
      value: role._id || role.id,
      label: role.name,
    }));
    
    return [...builtInRoles, ...customRoleOptions];
  };

  const handleSearch = (e) => {
    const value = e.target.value;
    setFilters((prev) => ({ ...prev, search: value }));
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const handleClearFilters = () => {
    setFilters({ search: '', role: [], status: [] });
    setPagination((prev) => ({ ...prev, current: 1 }));
  };

  const hasActiveFilters = filters.search || filters.role.length > 0 || filters.status.length > 0;

  const handleSuspend = async (id) => {
    try {
      await usersApi.suspendUser(id);
      message.success('User suspended');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to suspend user');
    }
  };

  const handleActivate = async (id) => {
    try {
      await usersApi.activateUser(id);
      message.success('User activated');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to activate user');
    }
  };

  const handleDelete = async (id) => {
    try {
      await usersApi.deleteUser(id);
      message.success('User deleted');
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete user');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await usersApi.bulkDeleteUsers(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} user(s) deleted`);
      setSelectedRowKeys([]);
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete users');
    }
  };

  const handleEditOpen = (user) => {
    setEditingUser(user);
    let roleValue = user.role;
    
    // If user has a custom role, use the custom role ID
    if (user.role === 'custom' && user.customRole) {
      roleValue = user.customRole._id || user.customRole.id || user.customRole;
    }
    
    editForm.setFieldsValue({
      name: user.name,
      role: roleValue,
      department: user.department,
      status: user.status,
    });
    setEditModalOpen(true);
  };

  const handleEditSubmit = async (values) => {
    setEditLoading(true);
    try {
      // Check if selected role is a custom role ID or built-in role
      const builtInRoles = ['admin', 'moderator', 'viewer', 'super_admin', 'custom'];
      const isCustomRole = !builtInRoles.includes(values.role);
      
      const userData = { ...values };
      if (isCustomRole) {
        // If it's a custom role ID, set role to 'custom' and include customRoleId
        userData.customRoleId = values.role;
        userData.role = 'custom';
      }
      
      await usersApi.updateUser(editingUser.id || editingUser._id, userData);
      message.success('User updated successfully');
      setEditModalOpen(false);
      editForm.resetFields();
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to update user');
    } finally {
      setEditLoading(false);
    }
  };

  const handleCreate = async (values) => {
    setCreateLoading(true);
    try {
      // Check if selected role is a custom role ID or built-in role
      const builtInRoles = ['admin', 'moderator', 'viewer', 'super_admin', 'custom'];
      const isCustomRole = !builtInRoles.includes(values.role);
      
      const userData = { ...values };
      if (isCustomRole) {
        // If it's a custom role ID, set role to 'custom' and include customRoleId
        userData.customRoleId = values.role;
        userData.role = 'custom';
      }
      
      await usersApi.createUser(userData);
      message.success('Admin user created successfully');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchUsers();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to create user');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    try {
      const params = {
        search: filters.search,
        accountType: 'admin', // Only export admin-type users
      };
      if (filters.role.length > 0) params.role = filters.role.join(',');
      if (filters.status.length > 0) params.status = filters.status.join(',');
      
      await usersApi.exportUsers(params);
      message.success('Users exported successfully');
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to export users');
    } finally {
      setExportLoading(false);
    }
  };

  const columns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
      render: (name, record) => {
        const getInitials = (name) => {
          return name
            .split(' ')
            .map((n) => n[0])
            .join('')
            .toUpperCase()
            .slice(0, 2);
        };
        
        return (
          <Space>
            <Avatar 
              size={32} 
              src={record.avatar}
              style={{ backgroundColor: '#1890ff', fontSize: 14 }}
            >
              {!record.avatar && getInitials(name)}
            </Avatar>
            <Button 
              type="link" 
              onClick={() => navigate(`/users/${record.id || record._id}`)} 
              style={{ padding: 0 }}
            >
              {name}
            </Button>
          </Space>
        );
      },
    },
    { title: 'Email', dataIndex: 'email', key: 'email', ellipsis: true },
    {
      title: 'Role',
      dataIndex: 'role',
      key: 'role',
      width: 130,
      render: (role) => <RoleTag role={role} />,
    },
    {
      title: 'Type',
      dataIndex: 'accountType',
      key: 'accountType',
      width: 100,
      render: (t) => t === 'admin' ? 'Admin' : 'Customer',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status) => <StatusTag status={status} />,
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
      width: 200,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="View">
            <Button size="small" icon={<EyeOutlined />} onClick={() => navigate(`/users/${record.id || record._id}`)} />
          </Tooltip>
          <PermissionGuard permission={PERMISSIONS.USERS_EDIT}>
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => handleEditOpen(record)} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.USERS_SUSPEND}>
            {record.status === 'active' && (
              <Popconfirm title="Suspend this user?" onConfirm={() => handleSuspend(record.id || record._id)}>
                <Tooltip title="Suspend">
                  <Button size="small" icon={<StopOutlined />} danger />
                </Tooltip>
              </Popconfirm>
            )}
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.USERS_ACTIVATE}>
            {record.status === 'suspended' && (
              <Popconfirm title="Activate this user?" onConfirm={() => handleActivate(record.id || record._id)}>
                <Tooltip title="Activate">
                  <Button size="small" icon={<CheckCircleOutlined />} style={{ color: '#52c41a' }} />
                </Tooltip>
              </Popconfirm>
            )}
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.USERS_DELETE}>
            <Popconfirm title="Delete this user? This cannot be undone." onConfirm={() => handleDelete(record.id || record._id)}>
              <Tooltip title="Delete">
                <Button size="small" icon={<DeleteOutlined />} danger />
              </Tooltip>
            </Popconfirm>
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Users"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Users' }]}
        extra={
          <PermissionGuard permission={PERMISSIONS.USERS_CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateModalOpen(true)}>
              Create Admin
            </Button>
          </PermissionGuard>
        }
      />

      {/* Quick Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Total Users" value={stats.totalUsers || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Admins" value={stats.totalAdmins || 0} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Active" value={stats.activeUsers || 0} styles={{ value: { color: '#52c41a' } }} /></Card></Col>
        <Col xs={12} sm={6}><Card size="small"><Statistic title="Suspended" value={stats.suspendedUsers || 0} styles={{ value: { color: '#faad14' } }} /></Card></Col>
      </Row>

      {/* Filters */}
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
            placeholder="Role"
            allowClear
            value={filters.role}
            style={{ minWidth: 160, maxWidth: 280 }}
            onChange={(v) => { setFilters((p) => ({ ...p, role: v || [] })); setPagination((p) => ({ ...p, current: 1 })); }}
            options={[
              { value: 'super_admin', label: 'Super Admin' },
              { value: 'admin', label: 'Admin' },
              { value: 'moderator', label: 'Moderator' },
              { value: 'viewer', label: 'Viewer' },
              { value: 'custom', label: 'Custom' },
            ]}
            maxTagCount="responsive"
          />
          <Select
            mode="multiple"
            placeholder="Status"
            allowClear
            value={filters.status}
            style={{ minWidth: 160, maxWidth: 280 }}
            onChange={(v) => { setFilters((p) => ({ ...p, status: v || [] })); setPagination((p) => ({ ...p, current: 1 })); }}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'banned', label: 'Banned' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'pending_verification', label: 'Pending' },
            ]}
            maxTagCount="responsive"
          />
          {hasActiveFilters && (
            <Button icon={<ClearOutlined />} onClick={handleClearFilters}>Clear Filters</Button>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport} loading={exportLoading}>
            Export CSV
          </Button>
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>Refresh</Button>
        </Space>
      </Card>

      {/* Bulk Action Bar */}
      {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.USERS_DELETE) && (
        <Alert
          type="info"
          showIcon
          message={`${selectedRowKeys.length} user(s) selected`}
          action={
            <Space>
              <Popconfirm title={`Delete ${selectedRowKeys.length} user(s)?`} description="This action cannot be undone." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
                <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
              </Popconfirm>
              <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Table */}
      <Table
        dataSource={users}
        columns={columns}
        loading={loading}
        rowKey={(r) => r.id || r._id}
        rowSelection={hasPermission(PERMISSIONS.USERS_DELETE) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
        pagination={{
          current: pagination.current,
          pageSize: pagination.pageSize,
          total: pagination.total,
          showSizeChanger: true,
          showTotal: (total) => `Total ${total} users`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 900 }}
        size="middle"
      />

      {/* Create Admin Modal */}
      <Modal
        title="Create Admin User"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createLoading}
      >
        <Form form={createForm} layout="vertical" onFinish={handleCreate}>
          <Form.Item name="name" label="Full Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="admin@example.com" />
          </Form.Item>
          <Form.Item name="password" label="Password" rules={[{ required: true, min: 8, message: 'Min 8 characters' }]}>
            <Input.Password placeholder="Minimum 8 characters" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select placeholder="Select role" options={getRoleOptions()} />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Select 
              placeholder="Select department" 
              allowClear
              showSearch
              options={departments} 
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        title="Edit User"
        open={editModalOpen}
        onCancel={() => {
          setEditModalOpen(false);
          editForm.resetFields();
        }}
        onOk={() => editForm.submit()}
        confirmLoading={editLoading}
      >
        <Form form={editForm} layout="vertical" onFinish={handleEditSubmit}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter name' }]}>
            <Input placeholder="John Doe" />
          </Form.Item>
          <Form.Item name="role" label="Role" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select placeholder="Select role" options={getRoleOptions()} />
          </Form.Item>
          <Form.Item name="department" label="Department">
            <Select 
              placeholder="Select department" 
              allowClear
              showSearch
              options={departments} 
            />
          </Form.Item>
          <Form.Item name="status" label="Status">
            <Select placeholder="Select status" options={[
              { value: 'active', label: 'Active' },
              { value: 'suspended', label: 'Suspended' },
              { value: 'inactive', label: 'Inactive' },
            ]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default UsersListPage;
