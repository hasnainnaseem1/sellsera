import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, Form, Input, Button, Switch, Select, InputNumber, Tabs, message,
  Space, Collapse, Row, Col, Tooltip, Popconfirm, Empty, Tag, Divider,
} from 'antd';
import {
  SaveOutlined, ArrowLeftOutlined, PlusOutlined, DeleteOutlined,
  ArrowUpOutlined, ArrowDownOutlined, EyeOutlined, EyeInvisibleOutlined,
  CopyOutlined, QuestionCircleOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import PageHeader from '../../components/common/PageHeader';
import marketingApi from '../../api/marketingApi';
import SeoScoreAnalyzer from '../../components/seo/SeoScoreAnalyzer';

const { TextArea } = Input;

const BLOCK_TYPES = [
  { value: 'hero', label: 'Hero Banner', description: 'Large hero section with title, subtitle, CTA button' },
  { value: 'features', label: 'Features Grid', description: 'Grid of feature cards with icons' },
  { value: 'pricing', label: 'Pricing Table', description: 'Pricing cards with features lists' },
  { value: 'cta', label: 'Call to Action', description: 'CTA section with button' },
  { value: 'faq', label: 'FAQ Section', description: 'Frequently asked questions' },
  { value: 'text', label: 'Text / Content', description: 'Free-form text content section' },
  { value: 'contact', label: 'Contact Form', description: 'Contact section with form fields' },
  { value: 'stats', label: 'Statistics', description: 'Number statistics row' },
  { value: 'testimonials', label: 'Testimonials', description: 'Customer testimonials / quotes' },
  { value: 'custom', label: 'Custom HTML', description: 'Raw HTML content block' },
];

const blockTypeColors = {
  hero: 'purple', features: 'blue', pricing: 'green', cta: 'orange',
  faq: 'cyan', text: 'default', contact: 'magenta', stats: 'gold',
  testimonials: 'geekblue', custom: 'red',
};

const MarketingPageFormPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [blocks, setBlocks] = useState([]);

  const fetchPage = useCallback(async () => {
    if (!isEdit) return;
    setLoading(true);
    try {
      const data = await marketingApi.getPage(id);
      const page = data.page;
      form.setFieldsValue({
        title: page.title,
        slug: page.slug,
        description: page.description,
        metaTitle: page.metaTitle,
        metaDescription: page.metaDescription,
        metaKeywords: page.metaKeywords,
        ogImage: page.ogImage || '',
        canonicalUrl: page.canonicalUrl || '',
        noIndex: page.noIndex || false,
        status: page.status,
        isHomePage: page.isHomePage,
        showInNavigation: page.showInNavigation,
        navigationOrder: page.navigationOrder,
        navigationLabel: page.navigationLabel,
        customCSS: page.customCSS,
      });
      setBlocks(page.blocks || []);
    } catch {
      message.error('Failed to load page');
      navigate('/marketing/pages');
    } finally {
      setLoading(false);
    }
  }, [id, isEdit, form, navigate]);

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const payload = {
        ...values,
        blocks: blocks.map((b, i) => ({ ...b, order: i })),
      };

      if (isEdit) {
        await marketingApi.updatePage(id, payload);
        message.success('Page updated successfully');
      } else {
        await marketingApi.createPage(payload);
        message.success('Page created successfully');
        navigate('/marketing/pages');
      }
    } catch (err) {
      if (err.errorFields) return;
      message.error(err.response?.data?.message || 'Failed to save page');
    } finally {
      setSaving(false);
    }
  };

  // Block management
  const addBlock = (type) => {
    const newBlock = {
      _id: `new_${Date.now()}`,
      type,
      title: '',
      subtitle: '',
      content: '',
      buttonText: '',
      buttonLink: '',
      secondaryButtonText: '',
      secondaryButtonLink: '',
      backgroundImage: '',
      backgroundColor: '',
      textColor: '',
      items: [],
      order: blocks.length,
      visible: true,
      settings: {},
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  const moveBlock = (index, direction) => {
    const newBlocks = [...blocks];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newBlocks.length) return;
    [newBlocks[index], newBlocks[targetIndex]] = [newBlocks[targetIndex], newBlocks[index]];
    setBlocks(newBlocks);
  };

  const updateBlock = (index, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[index] = { ...newBlocks[index], [field]: value };
    setBlocks(newBlocks);
  };

  const duplicateBlock = (index) => {
    const block = { ...blocks[index], _id: `new_${Date.now()}` };
    const newBlocks = [...blocks];
    newBlocks.splice(index + 1, 0, block);
    setBlocks(newBlocks);
  };

  // Item management within a block
  const addItem = (blockIndex) => {
    const newBlocks = [...blocks];
    const items = [...(newBlocks[blockIndex].items || [])];
    items.push({ title: '', description: '', icon: '', image: '', link: '', price: '', features: [], highlighted: false });
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], items };
    setBlocks(newBlocks);
  };

  const removeItem = (blockIndex, itemIndex) => {
    const newBlocks = [...blocks];
    const items = [...newBlocks[blockIndex].items];
    items.splice(itemIndex, 1);
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], items };
    setBlocks(newBlocks);
  };

  const updateItem = (blockIndex, itemIndex, field, value) => {
    const newBlocks = [...blocks];
    const items = [...newBlocks[blockIndex].items];
    items[itemIndex] = { ...items[itemIndex], [field]: value };
    newBlocks[blockIndex] = { ...newBlocks[blockIndex], items };
    setBlocks(newBlocks);
  };

  // Render item fields based on block type
  const renderItemFields = (block, blockIndex) => {
    const items = block.items || [];
    const itemLabel = {
      features: 'Feature',
      pricing: 'Plan',
      faq: 'Question',
      stats: 'Stat',
      testimonials: 'Testimonial',
    }[block.type] || 'Item';

    return (
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>{itemLabel}s ({items.length})</strong>
          <Button size="small" icon={<PlusOutlined />} onClick={() => addItem(blockIndex)}>
            Add {itemLabel}
          </Button>
        </div>
        {items.length === 0 && <Empty description={`No ${itemLabel.toLowerCase()}s added`} image={Empty.PRESENTED_IMAGE_SIMPLE} />}
        {items.map((item, idx) => (
          <Card
            key={idx}
            size="small"
            style={{ marginBottom: 8, background: '#fafafa' }}
            title={`${itemLabel} ${idx + 1}`}
            extra={
              <Popconfirm title="Remove?" onConfirm={() => removeItem(blockIndex, idx)}>
                <Button size="small" type="text" danger icon={<DeleteOutlined />} />
              </Popconfirm>
            }
          >
            <Row gutter={[12, 8]}>
              <Col span={12}>
                <label>Title</label>
                <Input size="small" value={item.title} onChange={(e) => updateItem(blockIndex, idx, 'title', e.target.value)} />
              </Col>
              <Col span={12}>
                <label>Icon / Emoji</label>
                <Input size="small" value={item.icon} onChange={(e) => updateItem(blockIndex, idx, 'icon', e.target.value)} placeholder="e.g. 🚀 or icon-name" />
              </Col>
              <Col span={24}>
                <label>Description</label>
                <TextArea size="small" rows={2} value={item.description} onChange={(e) => updateItem(blockIndex, idx, 'description', e.target.value)} />
              </Col>
              {(block.type === 'pricing') && (
                <>
                  <Col span={8}>
                    <label>Price</label>
                    <Input size="small" value={item.price} onChange={(e) => updateItem(blockIndex, idx, 'price', e.target.value)} placeholder="$19/mo" />
                  </Col>
                  <Col span={8}>
                    <label>Link</label>
                    <Input size="small" value={item.link} onChange={(e) => updateItem(blockIndex, idx, 'link', e.target.value)} />
                  </Col>
                  <Col span={8}>
                    <label style={{ display: 'block' }}>Highlighted</label>
                    <Switch size="small" checked={item.highlighted} onChange={(v) => updateItem(blockIndex, idx, 'highlighted', v)} />
                  </Col>
                  <Col span={24}>
                    <label>Features (one per line)</label>
                    <TextArea
                      size="small"
                      rows={3}
                      value={(item.features || []).join('\n')}
                      onChange={(e) => updateItem(blockIndex, idx, 'features', e.target.value.split('\n'))}
                      placeholder="Feature 1&#10;Feature 2&#10;Feature 3"
                    />
                  </Col>
                </>
              )}
              {(block.type === 'features' || block.type === 'testimonials') && (
                <Col span={24}>
                  <label>Image URL</label>
                  <Input size="small" value={item.image} onChange={(e) => updateItem(blockIndex, idx, 'image', e.target.value)} />
                </Col>
              )}
              {block.type === 'stats' && (
                <Col span={12}>
                  <label>Link</label>
                  <Input size="small" value={item.link} onChange={(e) => updateItem(blockIndex, idx, 'link', e.target.value)} />
                </Col>
              )}
            </Row>
          </Card>
        ))}
      </div>
    );
  };

  // Render block editor
  const renderBlockEditor = (block, index) => {
    const hasItems = ['features', 'pricing', 'faq', 'stats', 'testimonials'].includes(block.type);

    return (
      <div>
        <Row gutter={[16, 12]}>
          <Col span={12}>
            <label>Title</label>
            <Input value={block.title} onChange={(e) => updateBlock(index, 'title', e.target.value)} placeholder="Section title" />
          </Col>
          <Col span={12}>
            <label>Subtitle</label>
            <Input value={block.subtitle} onChange={(e) => updateBlock(index, 'subtitle', e.target.value)} placeholder="Section subtitle" />
          </Col>
          {block.type !== 'pricing' && block.type !== 'stats' && (
            <Col span={24}>
              <label>Content {block.type === 'custom' ? '(HTML)' : ''}</label>
              <TextArea
                rows={block.type === 'custom' ? 8 : 3}
                value={block.content}
                onChange={(e) => updateBlock(index, 'content', e.target.value)}
                placeholder={block.type === 'custom' ? '<div>Your HTML here</div>' : 'Section content...'}
              />
            </Col>
          )}
          {(block.type === 'hero' || block.type === 'cta') && (
            <>
              <Col span={6}>
                <label>Button Text</label>
                <Input value={block.buttonText} onChange={(e) => updateBlock(index, 'buttonText', e.target.value)} />
              </Col>
              <Col span={6}>
                <label>Button Link</label>
                <Input value={block.buttonLink} onChange={(e) => updateBlock(index, 'buttonLink', e.target.value)} />
              </Col>
              <Col span={6}>
                <label>2nd Button Text</label>
                <Input value={block.secondaryButtonText} onChange={(e) => updateBlock(index, 'secondaryButtonText', e.target.value)} />
              </Col>
              <Col span={6}>
                <label>2nd Button Link</label>
                <Input value={block.secondaryButtonLink} onChange={(e) => updateBlock(index, 'secondaryButtonLink', e.target.value)} />
              </Col>
            </>
          )}
          <Col span={8}>
            <label>Background Color</label>
            <Input
              value={block.backgroundColor}
              onChange={(e) => updateBlock(index, 'backgroundColor', e.target.value)}
              placeholder="#ffffff"
              addonAfter={block.backgroundColor ? <div style={{ width: 16, height: 16, background: block.backgroundColor, borderRadius: 2 }} /> : null}
            />
          </Col>
          <Col span={8}>
            <label>Text Color</label>
            <Input
              value={block.textColor}
              onChange={(e) => updateBlock(index, 'textColor', e.target.value)}
              placeholder="#000000"
            />
          </Col>
          <Col span={8}>
            <label>Background Image URL</label>
            <Input value={block.backgroundImage} onChange={(e) => updateBlock(index, 'backgroundImage', e.target.value)} />
          </Col>
        </Row>

        {hasItems && (
          <>
            <Divider style={{ margin: '16px 0 12px' }} />
            {renderItemFields(block, index)}
          </>
        )}
      </div>
    );
  };

  // Build collapsible items for Collapse
  const collapseItems = blocks.map((block, index) => ({
    key: String(index),
    label: (
      <Space>
        <Tag color={blockTypeColors[block.type]}>{block.type.toUpperCase()}</Tag>
        <span>{block.title || `Untitled ${block.type} block`}</span>
        {!block.visible && <Tag color="default">Hidden</Tag>}
      </Space>
    ),
    extra: (
      <Space size="small" onClick={(e) => e.stopPropagation()}>
        <Tooltip title="Move Up">
          <Button size="small" type="text" icon={<ArrowUpOutlined />} disabled={index === 0} onClick={() => moveBlock(index, -1)} />
        </Tooltip>
        <Tooltip title="Move Down">
          <Button size="small" type="text" icon={<ArrowDownOutlined />} disabled={index === blocks.length - 1} onClick={() => moveBlock(index, 1)} />
        </Tooltip>
        <Tooltip title={block.visible ? 'Hide' : 'Show'}>
          <Button
            size="small"
            type="text"
            icon={block.visible ? <EyeOutlined /> : <EyeInvisibleOutlined />}
            onClick={() => updateBlock(index, 'visible', !block.visible)}
          />
        </Tooltip>
        <Tooltip title="Duplicate">
          <Button size="small" type="text" icon={<CopyOutlined />} onClick={() => duplicateBlock(index)} />
        </Tooltip>
        <Popconfirm title="Remove this block?" onConfirm={() => removeBlock(index)}>
          <Button size="small" type="text" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Space>
    ),
    children: renderBlockEditor(block, index),
  }));

  const tabItems = [
    {
      key: 'content',
      label: 'Content Blocks',
      children: (
        <div>
          {blocks.length === 0 && (
            <Empty description="No content blocks yet. Add blocks to build your page." style={{ padding: 40 }} />
          )}
          {blocks.length > 0 && (
            <Collapse items={collapseItems} />
          )}
          <Divider />
          <div>
            <strong style={{ marginBottom: 8, display: 'block' }}>Add Content Block:</strong>
            <Space wrap>
              {BLOCK_TYPES.map((bt) => (
                <Tooltip key={bt.value} title={bt.description}>
                  <Button icon={<PlusOutlined />} onClick={() => addBlock(bt.value)}>
                    {bt.label}
                  </Button>
                </Tooltip>
              ))}
            </Space>
          </div>
        </div>
      ),
    },
    {
      key: 'seo',
      label: 'SEO',
      children: (
        <Row gutter={[24, 16]}>
          <Col xs={24} lg={14}>
            <Form.Item name="metaTitle" label="Meta Title">
              <Input placeholder="Page title for search engines" />
            </Form.Item>
            <Form.Item name="metaDescription" label="Meta Description">
              <TextArea rows={3} placeholder="Page description for search engines" maxLength={160} showCount />
            </Form.Item>
            <Form.Item name="metaKeywords" label="Meta Keywords">
              <Input placeholder="keyword1, keyword2, keyword3" />
            </Form.Item>
            <Form.Item name="ogImage" label="OG Image URL" help="Custom image for social sharing (1200x630 recommended)">
              <Input placeholder="https://example.com/og-image.jpg" />
            </Form.Item>
            <Form.Item name="canonicalUrl" label="Canonical URL" help="Set only if this content exists at another URL">
              <Input placeholder="https://example.com/original-page" />
            </Form.Item>
            <Form.Item name="noIndex" label="No Index" valuePropName="checked" help="Prevent search engines from indexing this page">
              <Switch />
            </Form.Item>
          </Col>
          <Col xs={24} lg={10}>
            <Form.Item noStyle shouldUpdate>
              {({ getFieldValue }) => (
                <SeoScoreAnalyzer
                  title={getFieldValue('metaTitle') || getFieldValue('title') || ''}
                  description={getFieldValue('metaDescription') || getFieldValue('description') || ''}
                  slug={getFieldValue('slug') || ''}
                  content={blocks.map(b => `${b.title || ''} ${b.subtitle || ''} ${b.content || ''}`).join(' ')}
                  keywords={getFieldValue('metaKeywords') || ''}
                  ogImage={getFieldValue('ogImage') || ''}
                  canonicalUrl={getFieldValue('canonicalUrl') || ''}
                />
              )}
            </Form.Item>
          </Col>
        </Row>
      ),
    },
    {
      key: 'advanced',
      label: 'Advanced',
      children: (
        <div>
          <Form.Item name="customCSS" label="Custom CSS">
            <TextArea rows={8} placeholder=".my-class { color: red; }" style={{ fontFamily: 'monospace' }} />
          </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <div>
      <PageHeader
        title={isEdit ? 'Edit Page' : 'New Page'}
        breadcrumbs={[
          { label: 'Home', path: '/' },
          { label: 'Marketing Site' },
          { label: 'Pages', path: '/marketing/pages' },
          { label: isEdit ? 'Edit' : 'New' },
        ]}
      />

      <Form form={form} layout="vertical" initialValues={{ status: 'draft', showInNavigation: true, navigationOrder: 0 }}>
        <Row gutter={[16, 16]}>
          {/* Main content area */}
          <Col xs={24} lg={18}>
            <Card loading={loading}>
              <Row gutter={[16, 0]}>
                <Col span={12}>
                  <Form.Item name="title" label="Page Title" rules={[{ required: true, message: 'Title is required' }]}>
                    <Input placeholder="Landing Page" />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="slug"
                    label={<Space>Slug <Tooltip title="URL path for this page. Auto-generated from title if empty."><QuestionCircleOutlined /></Tooltip></Space>}
                    rules={[{ required: true, message: 'Slug is required' }]}
                  >
                    <Input addonBefore="/" placeholder="landing-page" />
                  </Form.Item>
                </Col>
                <Col span={24}>
                  <Form.Item name="description" label="Description">
                    <TextArea rows={2} placeholder="Brief description of this page" />
                  </Form.Item>
                </Col>
              </Row>
            </Card>

            <Card style={{ marginTop: 16 }} loading={loading}>
              <Tabs items={tabItems} />
            </Card>
          </Col>

          {/* Sidebar settings */}
          <Col xs={24} lg={6}>
            <Card title="Page Settings" loading={loading}>
              <Form.Item name="status" label="Status">
                <Select
                  options={[
                    { value: 'draft', label: 'Draft' },
                    { value: 'published', label: 'Published' },
                    { value: 'archived', label: 'Archived' },
                  ]}
                />
              </Form.Item>
              <Form.Item name="isHomePage" label="Set as Homepage" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Divider />
              <Form.Item name="showInNavigation" label="Show in Navigation" valuePropName="checked">
                <Switch />
              </Form.Item>
              <Form.Item name="navigationLabel" label="Nav Label">
                <Input placeholder="Falls back to title" />
              </Form.Item>
              <Form.Item name="navigationOrder" label="Nav Order">
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </Card>

            <Card style={{ marginTop: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={handleSave} block>
                  {isEdit ? 'Update Page' : 'Create Page'}
                </Button>
                <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/marketing/pages')} block>
                  Back to Pages
                </Button>
              </Space>
            </Card>
          </Col>
        </Row>
      </Form>
    </div>
  );
};

export default MarketingPageFormPage;
