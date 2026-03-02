import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Table, Button, Switch, InputNumber, Input, message, Space, Tag, Empty,
} from 'antd';
import {
  SaveOutlined, ReloadOutlined, MenuOutlined,
} from '@ant-design/icons';
import PageHeader from '../../components/common/PageHeader';
import marketingApi from '../../api/marketingApi';

const MarketingNavigationPage = () => {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pages, setPages] = useState([]);

  const fetchPages = useCallback(async () => {
    setLoading(true);
    try {
      const data = await marketingApi.getPages();
      // Only show published + draft pages (not archived)
      const filteredPages = (data.pages || [])
        .filter((p) => p.status !== 'archived')
        .sort((a, b) => (a.navigationOrder || 0) - (b.navigationOrder || 0));
      setPages(filteredPages);
    } catch {
      message.error('Failed to load pages');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const handleToggleNavigation = async (id) => {
    const page = pages.find((p) => p._id === id);
    if (!page) return;
    try {
      await marketingApi.updatePage(id, { showInNavigation: !page.showInNavigation });
      setPages(pages.map((p) => p._id === id ? { ...p, showInNavigation: !p.showInNavigation } : p));
    } catch {
      message.error('Failed to update');
    }
  };

  const handleOrderChange = (id, value) => {
    setPages(pages.map((p) => p._id === id ? { ...p, navigationOrder: value } : p));
  };

  const handleSaveOrder = async () => {
    setSaving(true);
    try {
      const orderData = pages.map((p) => ({ id: p._id, navigationOrder: p.navigationOrder || 0 }));
      await marketingApi.reorderPages(orderData);
      message.success('Navigation order saved');
    } catch {
      message.error('Failed to save order');
    } finally {
      setSaving(false);
    }
  };

  const columns = [
    {
      title: '',
      width: 40,
      render: () => <MenuOutlined style={{ color: '#999', cursor: 'grab' }} />,
    },
    {
      title: 'Page',
      dataIndex: 'title',
      key: 'title',
      render: (title, record) => (
        <Space>
          <span style={{ fontWeight: 600 }}>{title}</span>
          <Tag color={record.status === 'published' ? 'green' : 'orange'}>{record.status}</Tag>
        </Space>
      ),
    },
    {
      title: 'Show in Nav',
      dataIndex: 'showInNavigation',
      key: 'showInNavigation',
      width: 120,
      align: 'center',
      render: (show, record) => (
        <Switch checked={show} onChange={() => handleToggleNavigation(record._id)} />
      ),
    },
    {
      title: 'Order',
      dataIndex: 'navigationOrder',
      key: 'navigationOrder',
      width: 100,
      align: 'center',
      render: (order, record) => (
        <InputNumber
          size="small"
          min={0}
          value={order}
          onChange={(val) => handleOrderChange(record._id, val)}
          style={{ width: 70 }}
        />
      ),
    },
    {
      title: 'URL',
      dataIndex: 'slug',
      key: 'slug',
      render: (slug, record) => (
        <span style={{ fontFamily: 'monospace', fontSize: 13, color: '#666' }}>
          /{record.isHomePage ? '' : slug}
        </span>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title="Navigation"
        breadcrumbs={[{ label: 'Home', path: '/' }, { label: 'Marketing Site' }, { label: 'Navigation' }]}
      />

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
          <p style={{ margin: 0, color: '#666' }}>
            Configure which pages appear in the marketing site navigation and their order.
          </p>
          <Space>
            <Button icon={<ReloadOutlined />} onClick={fetchPages}>Refresh</Button>
            <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSaveOrder}>
              Save Order
            </Button>
          </Space>
        </div>

        {pages.length === 0 ? (
          <Empty description="No pages found. Create marketing pages first." />
        ) : (
          <Table
            dataSource={pages}
            columns={columns}
            rowKey="_id"
            loading={loading}
            pagination={false}
            size="middle"
          />
        )}
      </Card>
    </div>
  );
};

export default MarketingNavigationPage;
