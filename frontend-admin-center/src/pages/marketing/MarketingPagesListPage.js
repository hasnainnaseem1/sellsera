import React, { useState, useEffect, useCallback } from 'react';
import {
  Table, Button, Space, Card, message, Popconfirm, Tag, Input, Row, Col, Statistic, Tooltip, Select, DatePicker, Alert,
} from 'antd';
import {
  PlusOutlined, ReloadOutlined, EditOutlined, DeleteOutlined,
  SearchOutlined, GlobalOutlined, EyeOutlined, EyeInvisibleOutlined,
  HomeOutlined, FileTextOutlined, CheckCircleOutlined, ClearOutlined, CopyOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import PermissionGuard from '../../components/guards/PermissionGuard';
import { usePermission } from '../../hooks/usePermission';
import marketingApi from '../../api/marketingApi';
import { PERMISSIONS } from '../../utils/permissions';

const { RangePicker } = DatePicker;

const MarketingPagesListPage = () => {
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [loading, setLoading] = useState(false);
  const [pages, setPages] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ status: [], navigation: [], dateRange: null });
  const [cloningId, setCloningId] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (search) params.search = search;
      const data = await marketingApi.getPages(params);
      setPages(data.pages || []);
    } catch {
      message.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  // Client-side filtering
  const filteredPages = pages.filter((p) => {
    // Status filter (OR)
    if (filters.status.length > 0 && !filters.status.includes(p.status)) return false;
    // Navigation filter (OR)
    if (filters.navigation.length > 0) {
      const navVal = p.showInNavigation ? 'yes' : 'no';
      if (!filters.navigation.includes(navVal)) return false;
    }
    // Date range filter
    if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
      const updated = new Date(p.updatedAt);
      const start = filters.dateRange[0].startOf('day').toDate();
      const end = filters.dateRange[1].endOf('day').toDate();
      if (updated < start || updated > end) return false;
    }
    return true;
  });

  const totalPages = pages.length;
  const publishedPages = pages.filter((p) => p.status === 'published').length;
  const draftPages = pages.filter((p) => p.status === 'draft').length;
  const navPages = pages.filter((p) => p.showInNavigation).length;

  const hasActiveFilters = search || filters.status.length > 0 || filters.navigation.length > 0 || filters.dateRange;

  const handleClearFilters = () => {
    setSearch('');
    setFilters({ status: [], navigation: [], dateRange: null });
  };

  const handleDelete = async (id) => {
    try {
      await marketingApi.deletePage(id);
      message.success('Page deleted');
      fetchPages();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete page');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await marketingApi.bulkDeletePages(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} page(s) deleted`);
      setSelectedRowKeys([]);
      fetchPages();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete pages');
    }
  };

  const handleStatusToggle = async (record) => {
    const newStatus = record.status === 'published' ? 'draft' : 'published';
    try {
      await marketingApi.updatePageStatus(record._id, newStatus);
      message.success(`Page ${newStatus}`);
      fetchPages();
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleClone = async (id) => {
    try {
      setCloningId(id);
      const data = await marketingApi.clonePage(id);
      message.success(data.message || 'Page cloned');
      fetchPages();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to clone page');
    } finally {
      setCloningId(null);
    }
  };

  const statusColorMap = {
    published: 'green',
    draft: 'orange',
    archived: 'red',
  };

  const columns = [
    {
      title: 'Page',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space>
          {record.isHomePage && <HomeOutlined style={{ color: '#7c3aed' }} />}
          <span style={{ fontWeight: 600 }}>{title}</span>
        </Space>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#666' }}>
          /{record.isHomePage ? '' : slug}
        </span>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status) => (
        <Tag color={statusColorMap[status]}>{status.charAt(0).toUpperCase() + status.slice(1)}</Tag>
      ),
    },
    {
      title: 'Navigation',
      dataIndex: 'showInNavigation',
      key: 'showInNavigation',
      width: 110,
      align: 'center',
      render: (show) => show ? <CheckCircleOutlined style={{ color: '#52c41a' }} /> : <span style={{ color: '#ccc' }}>—</span>,
    },
    {
      title: 'Order',
      dataIndex: 'navigationOrder',
      key: 'navigationOrder',
      width: 80,
      align: 'center',
    },
    {
      title: 'Last Updated',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      width: 200,
      render: (date) => date ? new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true }) : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space size="small">
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Tooltip title={record.status === 'published' ? 'Unpublish' : 'Publish'}>
              <Button
                size="small"
                type="text"
                icon={record.status === 'published' ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                onClick={() => handleStatusToggle(record)}
              />
            </Tooltip>
          </PermissionGuard>
          <Tooltip title="Edit">
            <Button
              size="small"
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/marketing/pages/${record._id}/edit`)}
            />
          </Tooltip>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            <Tooltip title="Clone">
              <Button
                size="small"
                type="text"
                icon={<CopyOutlined />}
                loading={cloningId === record._id}
                onClick={() => handleClone(record._id)}
              />
            </Tooltip>
          </PermissionGuard>
          <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
            {!record.isHomePage && (
              <Popconfirm
                title="Delete this page?"
                description="This action cannot be undone."
                onConfirm={() => handleDelete(record._id)}
                okText="Delete"
                okType="danger"
              >
                <Tooltip title="Delete">
                  <Button size="small" type="text" danger icon={<DeleteOutlined />} />
                </Tooltip>
              </Popconfirm>
            )}
          </PermissionGuard>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Marketing Pages"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Marketing Site' }, { label: 'Pages' }]}
      />

      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Total Pages" value={totalPages} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Published" value={publishedPages} prefix={<GlobalOutlined />} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="Drafts" value={draftPages} prefix={<EditOutlined />} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small"><Statistic title="In Navigation" value={navPages} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#7c3aed' }} /></Card>
        </Col>
      </Row>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input
              placeholder="Search pages..."
              prefix={<SearchOutlined />}
              allowClear
              style={{ width: 220 }}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              mode="multiple"
              placeholder="Status"
              allowClear
              value={filters.status}
              style={{ minWidth: 160 }}
              onChange={(v) => setFilters((prev) => ({ ...prev, status: v || [] }))}
              options={[
                { value: 'published', label: 'Published' },
                { value: 'draft', label: 'Draft' },
                { value: 'archived', label: 'Archived' },
              ]}
              maxTagCount="responsive"
            />
            <Select
              mode="multiple"
              placeholder="Navigation"
              allowClear
              value={filters.navigation}
              style={{ minWidth: 160 }}
              onChange={(v) => setFilters((prev) => ({ ...prev, navigation: v || [] }))}
              options={[
                { value: 'yes', label: 'In Navigation' },
                { value: 'no', label: 'Not in Navigation' },
              ]}
              maxTagCount="responsive"
            />
            <RangePicker
              showTime={{ use12Hours: true, format: 'hh:mm A' }}
              format="YYYY-MM-DD hh:mm A"
              value={filters.dateRange}
              onChange={(dates) => setFilters((prev) => ({ ...prev, dateRange: dates }))}
              placeholder={['Updated From', 'Updated To']}
            />
            {hasActiveFilters && (
              <Button icon={<ClearOutlined />} onClick={handleClearFilters}>Clear Filters</Button>
            )}
          </Space>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPages}>Refresh</Button>
            <PermissionGuard permission={PERMISSIONS.SETTINGS_EDIT}>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/marketing/pages/new')}>
                New Page
              </Button>
            </PermissionGuard>
          </Space>
        </div>

        {/* Bulk Action Bar */}
        {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.SETTINGS_EDIT) && (
          <Alert
            type="info"
            showIcon
            message={`${selectedRowKeys.length} page(s) selected`}
            action={
              <Space>
                <Popconfirm title={`Delete ${selectedRowKeys.length} page(s)?`} description="Home page cannot be deleted." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          dataSource={filteredPages}
          columns={columns}
          rowKey="_id"
          loading={loading}
          rowSelection={hasPermission(PERMISSIONS.SETTINGS_EDIT) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          pagination={false}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default MarketingPagesListPage;
