import React, { useState, useEffect, useMemo } from 'react';
import { Modal, Form, Input, Checkbox, Row, Col, message, Button, Typography, Badge } from 'antd';
import {
  UserOutlined, TeamOutlined, AppstoreOutlined, ExperimentOutlined,
  CreditCardOutlined, SafetyOutlined, LineChartOutlined, FileTextOutlined,
  SettingOutlined, BellOutlined, CloudServerOutlined, CheckOutlined, CloseOutlined,
} from '@ant-design/icons';
import rolesApi from '../../api/rolesApi';
import { PERMISSION_GROUPS, getPermissionLabel } from '../../utils/permissions';

const { Text } = Typography;

const GROUP_META = {
  'User Management': { icon: <UserOutlined />, color: '#6C63FF' },
  'Customer Management': { icon: <TeamOutlined />, color: '#4facfe' },
  'Plan Management': { icon: <CreditCardOutlined />, color: '#00b96b' },
  'Feature Management': { icon: <ExperimentOutlined />, color: '#faad14' },
  'Subscription Management': { icon: <AppstoreOutlined />, color: '#eb2f96' },
  'Role Management': { icon: <SafetyOutlined />, color: '#722ed1' },
  Analytics: { icon: <LineChartOutlined />, color: '#13c2c2' },
  'Activity Logs': { icon: <FileTextOutlined />, color: '#fa8c16' },
  Settings: { icon: <SettingOutlined />, color: '#8c8c8c' },
  Notifications: { icon: <BellOutlined />, color: '#f5222d' },
  System: { icon: <CloudServerOutlined />, color: '#2f54eb' },
};

const RoleFormModal = ({ open, onClose, editingRole, availablePermissions }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const isEditing = !!editingRole;

  useEffect(() => {
    if (open) {
      if (editingRole) {
        form.setFieldsValue({
          name: editingRole.name,
          description: editingRole.description,
          permissions: editingRole.permissions || [],
        });
      } else {
        form.resetFields();
      }
    }
  }, [open, editingRole, form]);

  const handleSubmit = async (values) => {
    setLoading(true);
    try {
      if (isEditing) {
        await rolesApi.updateRole(editingRole.id || editingRole._id, values);
        message.success('Role updated');
      } else {
        await rolesApi.createRole(values);
        message.success('Role created');
      }
      onClose(true);
    } catch (err) {
      message.error(err.response?.data?.message || 'Operation failed');
    } finally {
      setLoading(false);
    }
  };

  // Group check/uncheck all
  const handleGroupCheckAll = (groupPerms, checked) => {
    const current = form.getFieldValue('permissions') || [];
    if (checked) {
      const merged = [...new Set([...current, ...groupPerms])];
      form.setFieldsValue({ permissions: merged });
    } else {
      form.setFieldsValue({ permissions: current.filter((p) => !groupPerms.includes(p)) });
    }
  };

  // Track how many are selected per group
  const PermissionGroupCard = ({ groupName, groupPerms }) => {
    const meta = GROUP_META[groupName] || { icon: <AppstoreOutlined />, color: '#6C63FF' };
    const currentPerms = Form.useWatch('permissions', form) || [];
    const selectedCount = useMemo(
      () => groupPerms.filter((p) => currentPerms.includes(p)).length,
      [groupPerms, currentPerms]
    );
    const allSelected = selectedCount === groupPerms.length;
    const noneSelected = selectedCount === 0;

    return (
      <div
        style={{
          border: `1px solid ${noneSelected ? '#f0f0f0' : meta.color + '40'}`,
          borderRadius: 10,
          padding: '14px 16px',
          background: noneSelected ? '#fafafa' : meta.color + '06',
          transition: 'all 0.2s ease',
          height: '100%',
        }}
      >
        {/* Group Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 28, height: 28, borderRadius: 8,
              background: meta.color + '15', color: meta.color, fontSize: 14,
            }}>
              {meta.icon}
            </span>
            <Text strong style={{ fontSize: 13 }}>{groupName}</Text>
            <Badge
              count={`${selectedCount}/${groupPerms.length}`}
              style={{
                backgroundColor: allSelected ? '#52c41a' : noneSelected ? '#d9d9d9' : meta.color,
                fontSize: 11,
              }}
            />
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button
              type={allSelected ? 'primary' : 'default'}
              size="small"
              icon={<CheckOutlined />}
              onClick={() => handleGroupCheckAll(groupPerms, true)}
              style={{
                fontSize: 11, height: 24, padding: '0 8px', borderRadius: 6,
                ...(allSelected ? { background: meta.color, borderColor: meta.color } : {}),
              }}
            >
              All
            </Button>
            <Button
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleGroupCheckAll(groupPerms, false)}
              disabled={noneSelected}
              style={{ fontSize: 11, height: 24, padding: '0 8px', borderRadius: 6 }}
            >
              Clear
            </Button>
          </div>
        </div>

        {/* Checkboxes */}
        <Row gutter={[4, 6]}>
          {groupPerms.map((perm) => (
            <Col xs={12} key={perm}>
              <Checkbox value={perm} style={{ fontSize: 13 }}>{getPermissionLabel(perm)}</Checkbox>
            </Col>
          ))}
        </Row>
      </div>
    );
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'linear-gradient(135deg, #6C63FF 0%, #4facfe 100%)',
            color: '#fff', fontSize: 16,
          }}>
            <SafetyOutlined />
          </span>
          <span>{isEditing ? 'Edit Role' : 'Create Custom Role'}</span>
        </div>
      }
      open={open}
      onCancel={() => onClose(false)}
      onOk={() => form.submit()}
      confirmLoading={loading}
      width={780}
      destroyOnClose
      styles={{ body: { maxHeight: '70vh', overflowY: 'auto', paddingRight: 8 } }}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit} style={{ marginTop: 8 }}>
        <Row gutter={16}>
          <Col xs={24} sm={14}>
            <Form.Item
              name="name"
              label="Role Name"
              rules={[{ required: true, message: 'Role name is required' }]}
            >
              <Input placeholder="e.g. support_agent" disabled={isEditing} size="large" />
            </Form.Item>
          </Col>
          <Col xs={24} sm={10}>
            <Form.Item name="description" label="Description">
              <Input placeholder="Brief description" size="large" />
            </Form.Item>
          </Col>
        </Row>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0 16px',
          padding: '10px 14px', borderRadius: 8,
          background: 'linear-gradient(135deg, #6C63FF08 0%, #4facfe08 100%)',
          border: '1px solid #6C63FF20',
        }}>
          <SafetyOutlined style={{ color: '#6C63FF', fontSize: 16 }} />
          <Text strong style={{ fontSize: 14 }}>Permissions</Text>
          <Text type="secondary" style={{ fontSize: 12, marginLeft: 'auto' }}>
            Select the permissions this role should have
          </Text>
        </div>

        <Form.Item
          name="permissions"
          rules={[{ required: true, message: 'Select at least one permission' }]}
          style={{ marginBottom: 0 }}
        >
          <Checkbox.Group style={{ width: '100%' }}>
            <Row gutter={[12, 12]}>
              {Object.entries(PERMISSION_GROUPS).map(([groupName, groupPerms]) => (
                <Col xs={24} sm={12} key={groupName}>
                  <PermissionGroupCard groupName={groupName} groupPerms={groupPerms} />
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>
      </Form>
    </Modal>
  );
};

export default RoleFormModal;
