import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, Upload, Button,
  Cascader, Steps, Typography, Row, Col, Divider, message, Alert, Tag, Space,
  theme,
} from 'antd';
import {
  PlusOutlined, UploadOutlined, FileOutlined, PictureOutlined,
  TagsOutlined, DollarOutlined, InboxOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;
const BRAND = '#6C63FF';

const WHO_MADE_OPTIONS = [
  { value: 'i_did', label: 'I did' },
  { value: 'someone_else', label: 'A member of my shop' },
  { value: 'collective', label: 'Another company or person' },
];

const WHEN_MADE_OPTIONS = [
  { value: 'made_to_order', label: 'Made to order' },
  { value: '2020_2025', label: '2020 – 2025' },
  { value: '2010_2019', label: '2010 – 2019' },
  { value: '2004_2009', label: '2004 – 2009' },
  { value: 'before_2004', label: 'Before 2004' },
  { value: '2000_2003', label: '2000 – 2003' },
  { value: '1990s', label: '1990s' },
  { value: '1980s', label: '1980s' },
  { value: '1970s', label: '1970s' },
  { value: '1960s', label: '1960s' },
  { value: '1950s', label: '1950s' },
  { value: '1940s', label: '1940s' },
  { value: '1930s', label: '1930s' },
  { value: '1920s', label: '1920s' },
  { value: '1910s', label: '1910s' },
  { value: '1900s', label: '1900s' },
];

const CreateListingModal = ({ open, onClose, onSuccess }) => {
  const { isDark } = useTheme();
  const { token: tok } = theme.useToken();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isDigital, setIsDigital] = useState(false);
  const [imageFiles, setImageFiles] = useState([]);
  const [digitalFiles, setDigitalFiles] = useState([]);
  const [createdListingId, setCreatedListingId] = useState(null);
  const [uploadProgress, setUploadProgress] = useState('');

  // Load categories on mount
  useEffect(() => {
    if (!open) return;
    setCategoriesLoading(true);
    etsyApi.getCategories()
      .then(res => setCategories(res.data || []))
      .catch(() => message.error('Failed to load categories'))
      .finally(() => setCategoriesLoading(false));
  }, [open]);

  // Load shipping profiles for physical products
  useEffect(() => {
    if (!open || isDigital) return;
    setShippingLoading(true);
    etsyApi.getShippingProfiles()
      .then(res => setShippingProfiles(res.data || []))
      .catch(() => {})
      .finally(() => setShippingLoading(false));
  }, [open, isDigital]);

  const handleDigitalChange = (checked) => {
    setIsDigital(checked);
    form.setFieldValue('isDigital', checked);
    if (checked) {
      form.setFieldValue('shippingProfileId', undefined);
    }
  };

  const resetForm = () => {
    form.resetFields();
    setStep(0);
    setIsDigital(false);
    setImageFiles([]);
    setDigitalFiles([]);
    setCreatedListingId(null);
    setUploadProgress('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Step 1 → Step 2 validation
  const nextStep = async () => {
    try {
      if (step === 0) {
        await form.validateFields(['title', 'description', 'category', 'tags']);
      } else if (step === 1) {
        const fieldsToValidate = ['price', 'quantity', 'whoMade', 'whenMade'];
        if (!isDigital) fieldsToValidate.push('shippingProfileId');
        await form.validateFields(fieldsToValidate);
      }
      setStep(s => s + 1);
    } catch {
      // validation error shown by form
    }
  };

  const prevStep = () => setStep(s => s - 1);

  // Submit → create listing, then upload files
  const handleSubmit = async () => {
    try {
      // Get all field values including unmounted steps
      const values = form.getFieldsValue(true);
      setLoading(true);

      // Get taxonomy ID from last selected category value
      const categoryArr = values.category || [];
      const taxonomyId = categoryArr[categoryArr.length - 1];

      if (!taxonomyId) {
        message.error('Please select a category');
        setLoading(false);
        return;
      }

      // Create the listing first
      setUploadProgress('Creating listing on Etsy...');
      const createRes = await etsyApi.createListing({
        title: values.title,
        description: values.description,
        price: values.price,
        quantity: values.quantity,
        taxonomyId,
        whoMade: values.whoMade,
        whenMade: values.whenMade,
        isDigital,
        shippingProfileId: isDigital ? undefined : values.shippingProfileId,
        tags: values.tags || [],
        materials: values.materials || [],
        personalizationIsRequired: values.personalizationIsRequired || false,
        personalizationInstructions: values.personalizationInstructions || '',
      });

      if (!createRes.success) {
        message.error(createRes.message || 'Failed to create listing');
        setLoading(false);
        return;
      }

      const listingId = createRes.data.listingId;
      setCreatedListingId(listingId);

      // Upload images sequentially
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          setUploadProgress(`Uploading image ${i + 1}/${imageFiles.length}...`);
          try {
            await etsyApi.uploadListingImage(listingId, imageFiles[i].originFileObj || imageFiles[i]);
          } catch (err) {
            message.warning(`Image ${i + 1} failed to upload: ${err.message}`);
          }
        }
      }

      // Upload digital files
      if (isDigital && digitalFiles.length > 0) {
        for (let i = 0; i < digitalFiles.length; i++) {
          setUploadProgress(`Uploading file ${i + 1}/${digitalFiles.length}...`);
          try {
            await etsyApi.uploadListingFile(listingId, digitalFiles[i].originFileObj || digitalFiles[i]);
          } catch (err) {
            message.warning(`File ${i + 1} failed to upload: ${err.message}`);
          }
        }
      }

      setUploadProgress('');
      message.success('Listing created successfully on Etsy!');
      onSuccess?.(createRes.data);
      handleClose();
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Failed to create listing');
    } finally {
      setLoading(false);
      setUploadProgress('');
    }
  };

  const cardBg = isDark ? 'rgba(108,99,255,0.04)' : 'rgba(108,99,255,0.02)';
  const borderColor = isDark ? colors.darkBorder : colors.lightBorder;

  // Step content
  const steps = [
    {
      title: 'Details',
      content: (
        <>
          <Form.Item
            name="title" label="Listing Title"
            rules={[
              { required: true, message: 'Title is required' },
              { min: 10, message: 'Title must be at least 10 characters' },
              { max: 140, message: 'Title cannot exceed 140 characters' },
            ]}
          >
            <Input
              placeholder="e.g. Highland Cow Embroidery Design - Baby Cow Pair, Machine File"
              maxLength={140}
              showCount
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="description" label="Description"
            rules={[
              { required: true, message: 'Description is required' },
              { min: 20, message: 'Description must be at least 20 characters' },
            ]}
          >
            <TextArea
              placeholder="Describe your product in detail — materials, sizes, what's included..."
              rows={6}
              maxLength={10000}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="category" label="Category"
            rules={[{ required: true, message: 'Please select a category' }]}
          >
            <Cascader
              options={categories}
              placeholder="Select category"
              size="large"
              showSearch={{
                filter: (input, path) =>
                  path.some(opt => (opt.label || '').toLowerCase().includes(input.toLowerCase())),
              }}
              changeOnSelect
              loading={categoriesLoading}
            />
          </Form.Item>

          <Form.Item
            name="tags" label={<span>Tags <Text type="secondary" style={{ fontSize: 12 }}>(up to 13 — comma separated)</Text></span>}
            rules={[{ required: true, message: 'Add at least one tag' }]}
          >
            <Select
              mode="tags"
              placeholder="Type a tag and press Enter"
              maxTagCount={13}
              tokenSeparators={[',']}
              style={{ width: '100%' }}
              maxCount={13}
              suffixIcon={<TagsOutlined />}
            />
          </Form.Item>

          <Form.Item
            name="materials"
            label={<span>Materials <Text type="secondary" style={{ fontSize: 12 }}>(optional)</Text></span>}
          >
            <Select
              mode="tags"
              placeholder="e.g. Cotton, Polyester, Wood"
              tokenSeparators={[',']}
              style={{ width: '100%' }}
              maxCount={13}
            />
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Pricing & Shipping',
      content: (
        <>
          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 16,
            border: `1px solid ${borderColor}`, marginBottom: 20,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
              <Text strong>Digital Product</Text>
              <Switch
                checked={isDigital}
                onChange={handleDigitalChange}
                checkedChildren="Yes"
                unCheckedChildren="No"
              />
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isDigital
                ? 'Buyers will receive a downloadable file — no shipping required'
                : 'Physical product — requires a shipping profile'}
            </Text>
          </div>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="price" label="Price ($)"
                rules={[
                  { required: true, message: 'Price is required' },
                  { type: 'number', min: 0.20, message: 'Minimum price is $0.20' },
                ]}
              >
                <InputNumber
                  prefix={<DollarOutlined />}
                  style={{ width: '100%' }}
                  size="large"
                  min={0.20} step={0.01}
                  precision={2}
                  placeholder="5.00"
                />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="quantity" label="Quantity"
                rules={[{ required: true, message: 'Quantity is required' }]}
                initialValue={1}
              >
                <InputNumber style={{ width: '100%' }} size="large" min={1} max={999} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col xs={24} sm={12}>
              <Form.Item
                name="whoMade" label="Who made it?"
                rules={[{ required: true, message: 'Required' }]}
                initialValue="i_did"
              >
                <Select options={WHO_MADE_OPTIONS} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="whenMade" label="When was it made?"
                rules={[{ required: true, message: 'Required' }]}
                initialValue="made_to_order"
              >
                <Select options={WHEN_MADE_OPTIONS} size="large" />
              </Form.Item>
            </Col>
          </Row>

          {!isDigital && (
            <Form.Item
              name="shippingProfileId" label="Shipping Profile"
              rules={[{ required: true, message: 'Physical products need a shipping profile' }]}
            >
              <Select
                placeholder="Select a shipping profile"
                size="large"
                loading={shippingLoading}
                notFoundContent={
                  shippingLoading ? 'Loading...' :
                    <div style={{ padding: 12, textAlign: 'center' }}>
                      <Text type="secondary">No shipping profiles found.</Text><br />
                      <a href="https://www.etsy.com/your/shops/me/tools/shipping-profiles" target="_blank" rel="noopener noreferrer">
                        Create one on Etsy →
                      </a>
                    </div>
                }
              >
                {shippingProfiles.map(p => (
                  <Select.Option key={p.shippingProfileId} value={p.shippingProfileId}>
                    {p.title} {p.originCountryIso && <Tag style={{ marginLeft: 8 }}>{p.originCountryIso}</Tag>}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
          )}

          <Divider style={{ margin: '16px 0' }} />

          <Form.Item name="personalizationIsRequired" valuePropName="checked" style={{ marginBottom: 4 }}>
            <Switch checkedChildren="Personalization Required" unCheckedChildren="No Personalization" />
          </Form.Item>
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.personalizationIsRequired !== cur.personalizationIsRequired}>
            {({ getFieldValue }) =>
              getFieldValue('personalizationIsRequired') ? (
                <Form.Item name="personalizationInstructions" label="Personalization Instructions">
                  <TextArea placeholder="Tell buyers what info you need..." rows={2} maxLength={256} showCount />
                </Form.Item>
              ) : null
            }
          </Form.Item>
        </>
      ),
    },
    {
      title: 'Photos & Files',
      content: (
        <>
          <div style={{ marginBottom: 24 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>
              <PictureOutlined style={{ marginRight: 6, color: BRAND }} />
              Listing Photos <Text type="secondary" style={{ fontSize: 12 }}>(up to 10 images)</Text>
            </Text>
            <Dragger
              multiple
              maxCount={10}
              accept="image/*"
              fileList={imageFiles}
              onChange={({ fileList }) => setImageFiles(fileList.slice(0, 10))}
              beforeUpload={() => false}
              listType="picture"
            >
              <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: BRAND }} /></p>
              <p className="ant-upload-text">Click or drag images here</p>
              <p className="ant-upload-hint">JPG, PNG, or GIF — first image is the thumbnail</p>
            </Dragger>
          </div>

          {isDigital && (
            <div>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <FileOutlined style={{ marginRight: 6, color: BRAND }} />
                Digital Files <Text type="secondary" style={{ fontSize: 12 }}>(buyers download these after purchase)</Text>
              </Text>
              <Dragger
                multiple
                maxCount={5}
                fileList={digitalFiles}
                onChange={({ fileList }) => setDigitalFiles(fileList.slice(0, 5))}
                beforeUpload={() => false}
                listType="text"
              >
                <p className="ant-upload-drag-icon"><InboxOutlined style={{ color: BRAND }} /></p>
                <p className="ant-upload-text">Click or drag your digital files here</p>
                <p className="ant-upload-hint">ZIP, PDF, PES, DST, SVG, PNG, etc. — max 20MB per file</p>
              </Dragger>
            </div>
          )}
        </>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlusOutlined style={{ color: BRAND }} />
          <span>Create New Listing</span>
        </div>
      }
      open={open}
      onCancel={handleClose}
      width={720}
      destroyOnClose
      footer={
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <div>
            {step > 0 && (
              <Button onClick={prevStep} disabled={loading}>
                Back
              </Button>
            )}
          </div>
          <Space>
            <Button onClick={handleClose} disabled={loading}>Cancel</Button>
            {step < steps.length - 1 ? (
              <Button type="primary" onClick={nextStep} style={{ background: BRAND, borderColor: BRAND }}>
                Next
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleSubmit}
                loading={loading}
                style={{ background: BRAND, borderColor: BRAND }}
              >
                {loading ? (uploadProgress || 'Creating...') : 'Create Listing'}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      <Steps
        current={step}
        size="small"
        style={{ marginBottom: 24 }}
        items={steps.map(s => ({ title: s.title }))}
      />

      {uploadProgress && (
        <Alert
          type="info"
          message={uploadProgress}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Form
        form={form}
        layout="vertical"
        requiredMark="optional"
        initialValues={{
          quantity: 1,
          whoMade: 'i_did',
          whenMade: 'made_to_order',
          isDigital: false,
        }}
      >
        <Form.Item name="isDigital" hidden><Input /></Form.Item>
        {steps[step].content}
      </Form>
    </Modal>
  );
};

export default CreateListingModal;
