import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Input, Space, Tag, message,
  Select, Tooltip, Typography, Popconfirm, Image, Row, Col, Statistic, DatePicker, Alert,
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined,
  EyeOutlined, StarFilled, ClearOutlined, ReloadOutlined,
  FileTextOutlined, CheckCircleOutlined, ClockCircleOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import blogApi from '../../api/blogApi';
import PageHeader from '../../components/common/PageHeader';
import { usePermission } from '../../hooks/usePermission';
import { PERMISSIONS } from '../../utils/permissions';

const { RangePicker } = DatePicker;

const BlogPostsListPage = () => {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState({});
  const [pagination, setPagination] = useState({ current: 1, pageSize: 20, total: 0 });
  const [sorter, setSorter] = useState({});
  const [filters, setFilters] = useState({
    search: '',
    status: [],
    category: [],
    dateRange: null,
  });
  const navigate = useNavigate();
  const { hasPermission } = usePermission();
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);

  const fetchPosts = useCallback(async (page = 1, pageSize = pagination.pageSize) => {
    setLoading(true);
    try {
      const params = { page, limit: pageSize };
      if (filters.search) params.search = filters.search;
      if (filters.status.length) params.status = filters.status.join(',');
      if (filters.category.length) params.category = filters.category.join(',');
      if (filters.dateRange && filters.dateRange[0]) {
        params.dateFrom = filters.dateRange[0].toISOString();
        params.dateTo = filters.dateRange[1].toISOString();
      }
      if (sorter.field) {
        params.sortField = sorter.field;
        params.sortOrder = sorter.order;
      }

      const res = await blogApi.getPosts(params);
      if (res.success) {
        setPosts(res.posts);
        setPagination(prev => ({
          ...prev,
          current: res.pagination.page,
          total: res.pagination.total,
          pageSize,
        }));
      }
    } catch {
      message.error('Failed to fetch blog posts');
    } finally {
      setLoading(false);
    }
  }, [filters, sorter, pagination.pageSize]);

  const fetchMeta = async () => {
    try {
      const [catRes, statsRes] = await Promise.all([
        blogApi.getCategories(),
        blogApi.getStats(),
      ]);
      if (catRes.success) setCategories(catRes.categories);
      if (statsRes.success) setStats(statsRes.stats);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  useEffect(() => {
    fetchMeta();
  }, []);

  const handleDelete = async (id) => {
    try {
      await blogApi.deletePost(id);
      message.success('Post deleted');
      fetchPosts(pagination.current);
      fetchMeta();
    } catch {
      message.error('Failed to delete post');
    }
  };

  const handleBulkDelete = async () => {
    try {
      const res = await blogApi.bulkDeletePosts(selectedRowKeys);
      message.success(res.message || `${res.deletedCount} post(s) deleted`);
      setSelectedRowKeys([]);
      fetchPosts(1);
      fetchMeta();
    } catch (err) {
      message.error(err.response?.data?.message || 'Failed to delete posts');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await blogApi.updatePostStatus(id, status);
      message.success(`Post ${status}`);
      fetchPosts(pagination.current);
      fetchMeta();
    } catch {
      message.error('Failed to update status');
    }
  };

  const handleTableChange = (pag, _filters, sort) => {
    if (sort.field) {
      setSorter({ field: sort.field, order: sort.order });
    } else {
      setSorter({});
    }
    fetchPosts(pag.current, pag.pageSize);
  };

  const handleSearch = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const hasActiveFilters = filters.search || filters.status.length || filters.category.length || filters.dateRange;

  const handleClearFilters = () => {
    setFilters({ search: '', status: [], category: [], dateRange: null });
    setSorter({});
    setPagination(prev => ({ ...prev, current: 1 }));
  };

  const statusColors = {
    published: 'green',
    draft: 'orange',
    archived: 'red',
  };

  const columns = [
    {
      title: 'Image',
      dataIndex: 'featuredImage',
      key: 'featuredImage',
      width: 80,
      render: (img) => img ? (
        <Image src={img} width={60} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} preview={false} />
      ) : (
        <div style={{ width: 60, height: 40, background: '#f0f0f0', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc', fontSize: 12 }}>
          No img
        </div>
      ),
    },
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <Space>
          {record.isFeatured && <StarFilled style={{ color: '#faad14' }} />}
          <span style={{ fontWeight: 500 }}>{text}</span>
        </Space>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
      render: (text) => <code style={{ fontSize: 12 }}>/blog/{text}</code>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      render: (cat) => <Tag>{cat}</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status) => <Tag color={statusColors[status]}>{status?.toUpperCase()}</Tag>,
    },
    {
      title: 'Views',
      dataIndex: 'views',
      key: 'views',
      sorter: true,
      render: (v) => (
        <Space>
          <EyeOutlined />
          {v || 0}
        </Space>
      ),
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      render: (d) => d ? new Date(d).toLocaleString() : '—',
    },
    {
      title: 'Published',
      dataIndex: 'publishedAt',
      key: 'publishedAt',
      sorter: true,
      render: (d) => d ? new Date(d).toLocaleString() : '—',
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 200,
      render: (_, record) => (
        <Space>
          {hasPermission(PERMISSIONS.SETTINGS_EDIT) && (
            <>
              <Tooltip title="Edit">
                <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/blog/posts/${record._id}/edit`)} />
              </Tooltip>
              {record.status === 'draft' && (
                <Tooltip title="Publish">
                  <Button type="link" style={{ color: '#52c41a' }} onClick={() => handleStatusChange(record._id, 'published')}>
                    Publish
                  </Button>
                </Tooltip>
              )}
              {record.status === 'published' && (
                <Tooltip title="Unpublish">
                  <Button type="link" style={{ color: '#faad14' }} onClick={() => handleStatusChange(record._id, 'draft')}>
                    Draft
                  </Button>
                </Tooltip>
              )}
              <Popconfirm title="Delete this post?" onConfirm={() => handleDelete(record._id)}>
                <Button type="link" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            </>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Blog Posts"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Blog' }, { label: 'Posts' }]}
        extra={
          hasPermission(PERMISSIONS.SETTINGS_EDIT) && (
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/blog/posts/new')}>
              New Post
            </Button>
          )
        }
      />

      {/* Stats Row */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Posts" value={stats.total || 0} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Published" value={stats.published || 0} prefix={<CheckCircleOutlined />} valueStyle={{ color: '#52c41a' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Drafts" value={stats.draft || 0} prefix={<ClockCircleOutlined />} valueStyle={{ color: '#faad14' }} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="Total Views" value={stats.totalViews || 0} prefix={<EyeOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
      </Row>

      <Card>
        {/* Filter Bar */}
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8} md={6}>
            <Input
              placeholder="Search posts..."
              prefix={<SearchOutlined />}
              value={filters.search}
              onChange={(e) => handleSearch('search', e.target.value)}
              onPressEnter={() => fetchPosts(1)}
              allowClear
            />
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              mode="multiple"
              placeholder="Status"
              value={filters.status}
              onChange={(v) => handleSearch('status', v)}
              allowClear
              style={{ width: '100%' }}
              maxTagCount="responsive"
            >
              <Select.Option value="published">Published</Select.Option>
              <Select.Option value="draft">Draft</Select.Option>
              <Select.Option value="archived">Archived</Select.Option>
            </Select>
          </Col>
          <Col xs={12} sm={6} md={4}>
            <Select
              mode="multiple"
              placeholder="Category"
              value={filters.category}
              onChange={(v) => handleSearch('category', v)}
              allowClear
              style={{ width: '100%' }}
              maxTagCount="responsive"
            >
              {categories.map(c => (
                <Select.Option key={c} value={c}>{c}</Select.Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={10} md={7}>
            <RangePicker
              showTime={{ format: 'hh:mm A', use12Hours: true }}
              format="YYYY-MM-DD hh:mm A"
              value={filters.dateRange}
              onChange={(dates) => handleSearch('dateRange', dates)}
              style={{ width: '100%' }}
              placeholder={['From Date/Time', 'To Date/Time']}
            />
          </Col>
          <Col xs={24} sm={4} md={3}>
            <Space>
              {hasActiveFilters && (
                <Tooltip title="Clear Filters">
                  <Button icon={<ClearOutlined />} onClick={handleClearFilters} />
                </Tooltip>
              )}
              <Tooltip title="Refresh">
                <Button icon={<ReloadOutlined />} onClick={() => { fetchPosts(1); fetchMeta(); }} />
              </Tooltip>
            </Space>
          </Col>
        </Row>

        {/* Bulk Action Bar */}
        {selectedRowKeys.length > 0 && hasPermission(PERMISSIONS.SETTINGS_EDIT) && (
          <Alert
            type="info"
            showIcon
            message={`${selectedRowKeys.length} post(s) selected`}
            action={
              <Space>
                <Popconfirm title={`Delete ${selectedRowKeys.length} post(s)?`} description="This action cannot be undone." onConfirm={handleBulkDelete} okText="Delete" okButtonProps={{ danger: true }}>
                  <Button size="small" danger icon={<DeleteOutlined />}>Delete Selected</Button>
                </Popconfirm>
                <Button size="small" onClick={() => setSelectedRowKeys([])}>Clear Selection</Button>
              </Space>
            }
            style={{ marginBottom: 16 }}
          />
        )}

        <Table
          dataSource={posts}
          columns={columns}
          rowKey="_id"
          loading={loading}
          rowSelection={hasPermission(PERMISSIONS.SETTINGS_EDIT) ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          pagination={{
            current: pagination.current,
            pageSize: pagination.pageSize,
            total: pagination.total,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} of ${total} posts`,
            onChange: (page, pageSize) => fetchPosts(page, pageSize),
          }}
        />
      </Card>
    </div>
  );
};

export default BlogPostsListPage;
