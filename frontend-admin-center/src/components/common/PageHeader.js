import React from 'react';
import { Typography, Breadcrumb, Space, Flex } from 'antd';
import { Link } from 'react-router-dom';

const { Title } = Typography;

/**
 * Consistent page header with title, breadcrumb, and optional extra actions.
 *
 * Usage:
 *   <PageHeader
 *     title="Users"
 *     breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Users' }]}
 *     extra={<Button>Create User</Button>}
 *   />
 */
const PageHeader = ({ title, breadcrumbs = [], extra }) => {
  return (
    <div style={{ marginBottom: 24 }}>
      {breadcrumbs.length > 0 && (
        <Breadcrumb
          style={{ marginBottom: 8 }}
          items={breadcrumbs.map((b) => ({
            title: b.path ? <Link to={b.path}>{b.label}</Link> : b.label,
          }))}
        />
      )}
      <Flex justify="space-between" align="center">
        <Title level={4} style={{ margin: 0 }}>
          {title}
        </Title>
        {extra && <Space>{extra}</Space>}
      </Flex>
    </div>
  );
};

export default PageHeader;
