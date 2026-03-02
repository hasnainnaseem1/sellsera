import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Space, Tag, message, Popconfirm, Tooltip, Row, Col, Descriptions, Badge, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SafetyOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import RoleFormModal from './RoleFormModal';
import rolesApi from '../../api/rolesApi';
import { PERMISSIONS } from '../../utils/permissions';
import { formatDateTime } from '../../utils/helpers';

const ROLE_DESCRIPTIONS = {
  super_admin: 'Full system access — all permissions',
  admin: 'All except role management',
  moderator: 'User & customer management, view analytics',
  viewer: 'Read-only access to users, customers, and analytics',
};

const ROLE_COLORS = {
  super_admin: 'red',
  admin: 'volcano',
  moderator: 'blue',
  viewer: 'green',
};

const RolesListPage = () => {
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [builtInRoles, setBuiltInRoles] = useState([]);
  const [customRoles, setCustomRoles] = useState([]);
  const [availablePermissions, setAvailablePermissions] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rolesApi.getRoles();
      setBuiltInRoles(data.builtInRoles || []);
      setCustomRoles(data.customRoles || []);
      setAvailablePermissions(data.availablePermissions || []);
    } catch {
      message.error('Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  const handleDelete = async (id) => {
    try {
      await rolesApi.deleteRole(id);
      message.success('Role deleted');
      fetchRoles();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete role');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await rolesApi.bulkDeleteRoles(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} role(s) deleted`);
      setSelectedRowKeys([]);
      fetchRoles();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete roles');
    }
  };

  const handleModalClose = (refreshNeeded) => {
    setModalOpen(false);
    setEditingRole(null);
    if (refreshNeeded) fetchRoles();
  };

  const customColumns = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (name) => <strong>{name}</strong>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'Permissions',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 120,
      render: (perms) => <Badge count={perms?.length || 0} style={{ backgroundColor: '#7C3AED' }} />,
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      width: 80,
      render: (active) => active ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>,
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
          <PermissionGuard permission={PERMISSIONS.ROLES_EDIT}>
            <Tooltip title="Edit">
              <Button size="small" icon={<EditOutlined />} onClick={() => { setEditingRole(record); setModalOpen(true); }} />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.ROLES_DELETE}>
            <Popconfirm title="Delete this role? Users assigned to it will lose access." onConfirm={() => handleDelete(record.id || record._id)}>
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
        title="Roles & Permissions"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Roles & Permissions' }]}
        extra={
          <PermissionGuard permission={PERMISSIONS.ROLES_CREATE}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingRole(null); setModalOpen(true); }}>
              Create Role
            </Button>
          </PermissionGuard>
        }
      />

      {/* Built-in Roles */}
      <Card title="Built-in Roles" style={{ marginBottom: 16 }} loading={loading}>
        <Row gutter={[16, 16]}>
          {builtInRoles.map((role) => (
            <Col xs={24} sm={12} lg={6} key={role.name}>
              <Card
                size="small"
                hoverable
                styles={{ body: { textAlign: 'center', padding: '20px 16px' } }}
              >
                <SafetyOutlined style={{ fontSize: 28, color: ROLE_COLORS[role.name] || '#8c8c8c', marginBottom: 8 }} />
                <div style={{ fontWeight: 600, fontSize: 16, marginBottom: 4 }}>
                  <Tag color={ROLE_COLORS[role.name]}>{role.name.replace('_', ' ').toUpperCase()}</Tag>
                </div>
                <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                  {ROLE_DESCRIPTIONS[role.name] || role.description}
                </div>
                <div style={{ marginTop: 8 }}>
                  <Badge
                    count={role.permissions?.includes('*') ? 'ALL' : role.permissions?.length || 0}
                    style={{ backgroundColor: ROLE_COLORS[role.name] ? undefined : '#7C3AED' }}
                  />
                  <span style={{ fontSize: 12, color: '#8c8c8c', marginLeft: 4 }}>permissions</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      {/* Custom Roles */}
      <Card title="Custom Roles" loading={loading}>
        {/* Bulk Action Bar */}
        {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.ROLES_DELETE) && (
          <Alert
            type="info"
            showIcon
            message={`${selectedRowKeys.length} role(s) selected`}
            action={
              <Space>
                <Popconfirm title={`Delete ${selectedRowKeys.length} role(s)?`} description="Users assigned to these roles will lose access." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}
        <Table
          dataSource={customRoles}
          columns={customColumns}
          rowKey={(r) => r.id || r._id}
          rowSelection={hasPermission(PERMISSIONS.ROLES_DELETE) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          pagination={false}
          size="middle"
          locale={{ emptyText: 'No custom roles created yet' }}
        />
      </Card>

      {/* Create/Edit Modal */}
      <RoleFormModal
        open={modalOpen}
        onClose={handleModalClose}
        editingRole={editingRole}
        availablePermissions={availablePermissions}
      />
    </div>
  );
};

export default RolesListPage;
