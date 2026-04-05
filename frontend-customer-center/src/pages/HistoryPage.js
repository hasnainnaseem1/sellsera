import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Tag, Button, Space, Typography, message,
  Popconfirm, Input, Empty, theme,
} from 'antd';
import {
  EyeOutlined, DeleteOutlined, SearchOutlined,
  HistoryOutlined, PlusOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import AppLayout from '../components/AppLayout';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import analysisApi from '../api/analysisApi';

const { Title, Text } = Typography;

const scoreColor = (score) => {
  if (score >= 80) return 'green';
  if (score >= 60) return 'gold';
  return 'red';
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [pagination, setPagination] = useState({ current: 1, pageSize: 10, total: 0 });

  const card = {
    borderRadius: radii.lg,
    border: `1px solid ${isDark ? colors.darkBorder : colors.lightBorder}`,
    background: tok.colorBgContainer,
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await analysisApi.getHistory({
        page: pagination.current,
        limit: pagination.pageSize,
      });
      setData(res.analyses || []);
      setPagination(prev => ({ ...prev, total: res.pagination?.totalItems || 0 }));
    } catch {
      message.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.current, pagination.pageSize]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleDelete = async (id) => {
    try {
      await analysisApi.deleteAnalysis(id);
      message.success('Analysis deleted');
      fetchData();
    } catch {
      message.error('Failed to delete');
    }
  };

  const filtered = search
    ? data.filter(d => d.title?.toLowerCase().includes(search.toLowerCase()) || d.category?.toLowerCase().includes(search.toLowerCase()))
    : data;

  const columns = [
    {
      title: 'Listing',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (text) => <Text strong style={{ fontSize: 13 }}>{text}</Text>,
    },
    {
      title: 'Category',
      dataIndex: 'category',
      key: 'category',
      width: 200,
      ellipsis: true,
      render: (text) => (
        <Tag style={{ maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {text}
        </Tag>
      ),
    },
    {
      title: 'Score',
      dataIndex: 'score',
      key: 'score',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.score - b.score,
      render: (score) => (
        <Tag color={scoreColor(score)} style={{ fontWeight: 700, fontSize: 14, padding: '2px 12px' }}>
          {score}
        </Tag>
      ),
    },
    {
      title: 'Date',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (date) => (
        <Text type="secondary" style={{ fontSize: 13 }}>
          {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </Text>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <Space>
          <Button
            type="text" size="small"
            icon={<EyeOutlined style={{ color: colors.brand }} />}
            onClick={() => navigate(`/history/${record.id}`)}
          />
          <Popconfirm
            title="Delete this analysis?"
            onConfirm={() => handleDelete(record.id)}
            okText="Delete"
            cancelText="Cancel"
          >
            <Button type="text" size="small" icon={<DeleteOutlined style={{ color: colors.danger }} />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <AppLayout>
      <div style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>
            <HistoryOutlined style={{ color: colors.brand, marginRight: 8 }} />
            Analysis History
          </Title>
          <Text type="secondary">View and manage your past listing audits</Text>
        </div>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={() => navigate('/audit')}
          style={{
            background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
            border: 'none', borderRadius: radii.sm, fontWeight: 600,
          }}
        >
          New Audit
        </Button>
      </div>

      <Card style={card}>
        <div style={{ marginBottom: 16 }}>
          <Input
            placeholder="Search by title or category..."
            prefix={<SearchOutlined />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
            style={{ maxWidth: 320 }}
          />
        </div>

        <Table
          columns={columns}
          dataSource={filtered}
          rowKey="id"
          loading={loading}
          scroll={{ x: 800 }}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showTotal: (total) => `${total} analyses`,
          }}
          onChange={(pag) => setPagination(prev => ({ ...prev, current: pag.current, pageSize: pag.pageSize }))}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <Space direction="vertical" size={8}>
                    <Text type="secondary">No analyses yet</Text>
                    <Button
                      type="primary"
                      icon={<ThunderboltOutlined />}
                      onClick={() => navigate('/audit')}
                      style={{
                        background: `linear-gradient(135deg, ${colors.brand}, ${colors.brandLight})`,
                        border: 'none',
                      }}
                    >
                      Run Your First Audit
                    </Button>
                  </Space>
                }
              />
            ),
          }}
        />
      </Card>
    </AppLayout>
  );
};

export default HistoryPage;
