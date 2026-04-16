import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, Button,
  Cascader, Steps, Typography, Row, Col, Divider, message, Alert, Tag, Space,
  theme, Radio, Tooltip, Popconfirm,
} from 'antd';
import {
  PlusOutlined, FileOutlined, PictureOutlined,
  TagsOutlined, DollarOutlined, DeleteOutlined,
  VideoCameraOutlined, CloseCircleFilled,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Text } = Typography;
const { TextArea } = Input;
const BRAND = '#6C63FF';
const MAX_IMAGES = 10;

const WHO_MADE_OPTIONS = [
  { value: 'i_did', label: 'I did' },
  { value: 'someone_else', label: 'A member of my shop' },
  { value: 'collective', label: 'Another company or person' },
];

const WHEN_MADE_OPTIONS = [
  { value: 'made_to_order', label: 'Made to order' },
  { value: '2020_2026', label: '2020 – 2026' },
  { value: '2010_2019', label: '2010 – 2019' },
  { value: '2007_2009', label: '2007 – 2009' },
  { value: 'before_2007', label: 'Before 2007' },
  { value: '2000_2006', label: '2000 – 2006' },
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
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [isDigital, setIsDigital] = useState(false);
  const [imageFiles, setImageFiles] = useState([]); // Array of File objects
  const [digitalFiles, setDigitalFiles] = useState([]);
  const [videoFile, setVideoFile] = useState(null); // Single video File
  const [uploadProgress, setUploadProgress] = useState('');
  const [taxonomyProperties, setTaxonomyProperties] = useState([]);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propertyValues, setPropertyValues] = useState({});
  const [dragIndex, setDragIndex] = useState(null);

  const imageInputRef = useRef(null);
  const videoInputRef = useRef(null);

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

  // Fetch taxonomy properties when category changes
  const handleCategoryChange = useCallback(async (value) => {
    if (!value || value.length === 0) {
      setTaxonomyProperties([]);
      setPropertyValues({});
      return;
    }
    const taxonomyId = value[value.length - 1];
    setPropsLoading(true);
    try {
      const res = await etsyApi.getTaxonomyProperties(taxonomyId);
      setTaxonomyProperties(res.data || []);
      setPropertyValues({}); // reset selections
    } catch {
      setTaxonomyProperties([]);
    } finally {
      setPropsLoading(false);
    }
  }, []);

  const handlePropertyChange = (propertyId, valueId, option) => {
    // Store both the numeric ID and string name — Etsy API requires both
    const valueName = option?.children || '';
    setPropertyValues(prev => ({
      ...prev,
      [propertyId]: {
        valueIds: valueId ? [valueId] : [],
        values: valueName ? [valueName] : [],
      },
    }));
  };

  const resetForm = () => {
    form.resetFields();
    setStep(0);
    setIsDigital(false);
    setImageFiles([]);
    setDigitalFiles([]);
    setVideoFile(null);
    setUploadProgress('');
    setTaxonomyProperties([]);
    setPropertyValues({});
    setDragIndex(null);
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
        isSupply: values.isSupply === true,
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

      // Upload images sequentially
      let imagesUploaded = 0;
      if (imageFiles.length > 0) {
        for (let i = 0; i < imageFiles.length; i++) {
          setUploadProgress(`Uploading image ${i + 1}/${imageFiles.length}...`);
          try {
            await etsyApi.uploadListingImage(listingId, imageFiles[i]);
            imagesUploaded++;
          } catch (err) {
            message.warning(`Image ${i + 1} failed to upload: ${err.message}`);
          }
        }
      }

      // Upload video
      if (videoFile) {
        setUploadProgress('Uploading video...');
        try {
          await etsyApi.uploadListingVideo(listingId, videoFile);
        } catch (err) {
          message.warning(`Video failed to upload: ${err.message}`);
        }
      }

      // Upload digital files
      let digitalFilesUploaded = 0;
      if (isDigital && digitalFiles.length > 0) {
        for (let i = 0; i < digitalFiles.length; i++) {
          setUploadProgress(`Uploading file ${i + 1}/${digitalFiles.length}...`);
          try {
            await etsyApi.uploadListingFile(listingId, digitalFiles[i].originFileObj || digitalFiles[i]);
            digitalFilesUploaded++;
          } catch (err) {
            message.warning(`File ${i + 1} failed to upload: ${err.message}`);
          }
        }
      }

      // Set taxonomy properties (craft type, occasion, etc.)
      const propsToSet = Object.entries(propertyValues)
        .filter(([, val]) => val.valueIds?.length > 0 || val.values?.length > 0)
        .map(([propertyId, val]) => ({
          propertyId: parseInt(propertyId, 10),
          valueIds: val.valueIds || [],
          values: val.values || [],
        }));

      if (propsToSet.length > 0) {
        setUploadProgress('Setting listing attributes...');
        try {
          await etsyApi.setListingProperties(listingId, propsToSet);
        } catch (err) {
          message.warning('Some listing attributes could not be set');
        }
      }

      // Auto-publish if all required assets uploaded successfully
      const canPublish = imagesUploaded > 0 && (!isDigital || digitalFilesUploaded > 0);
      if (canPublish) {
        setUploadProgress('Publishing listing...');
        try {
          await etsyApi.publishListing(listingId);
          message.success('Listing created and published on Etsy!');
        } catch {
          message.success('Listing created as draft. You can publish it from the listings page.');
        }
      } else {
        message.success('Listing created as draft on Etsy!');
      }

      setUploadProgress('');
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
              onChange={handleCategoryChange}
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

          {/* Dynamic taxonomy properties: Craft type, Occasion, Celebration, etc. */}
          {taxonomyProperties.length > 0 && (
            <div style={{
              background: cardBg, borderRadius: radii.sm, padding: 16,
              border: `1px solid ${borderColor}`, marginBottom: 16,
            }}>
              <Text strong style={{ display: 'block', marginBottom: 12 }}>
                Category Attributes
              </Text>
              <Row gutter={16}>
                {taxonomyProperties.map(prop => (
                  <Col xs={24} sm={12} key={prop.propertyId}>
                    <Form.Item
                      label={prop.displayName || prop.name}
                      required={prop.isRequired}
                      style={{ marginBottom: 12 }}
                    >
                      <Select
                        placeholder={`Select ${prop.displayName || prop.name}`}
                        allowClear
                        showSearch
                        loading={propsLoading}
                        value={propertyValues[prop.propertyId]?.valueIds?.[0] || undefined}
                        onChange={(val, option) => handlePropertyChange(prop.propertyId, val, option)}
                        filterOption={(input, option) =>
                          (option?.children || '').toLowerCase().includes(input.toLowerCase())
                        }
                      >
                        {prop.possibleValues.map(v => (
                          <Select.Option key={v.valueId} value={v.valueId}>
                            {v.name}
                          </Select.Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                ))}
              </Row>
            </div>
          )}
          {propsLoading && (
            <Text type="secondary" style={{ fontSize: 12 }}>Loading category attributes...</Text>
          )}

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

          {isDigital && (
            <Form.Item
              name="contentSource"
              label="How is this digital content created?"
              initialValue="created_by_me"
              style={{ marginBottom: 16 }}
            >
              <Radio.Group>
                <Space direction="vertical">
                  <Radio value="created_by_me">
                    <div>
                      <Text strong>Created by me</Text><br />
                      <Text type="secondary" style={{ fontSize: 12 }}>It's designed and created entirely by me.</Text>
                    </div>
                  </Radio>
                  <Radio value="with_ai_generator">
                    <div>
                      <Text strong>With an AI generator</Text><br />
                      <Text type="secondary" style={{ fontSize: 12 }}>It's created with help from an AI generator.</Text>
                    </div>
                  </Radio>
                </Space>
              </Radio.Group>
            </Form.Item>
          )}

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

          <Form.Item
            name="isSupply"
            label="What is it?"
            rules={[{ required: true, message: 'Required' }]}
            initialValue={false}
          >
            <Radio.Group>
              <Space direction="vertical">
                <Radio value={false}>
                  <div>
                    <Text strong>A finished product</Text><br />
                    <Text type="secondary" style={{ fontSize: 12 }}>Ready to use or display</Text>
                  </div>
                </Radio>
                <Radio value={true}>
                  <div>
                    <Text strong>A supply or tool to make things</Text><br />
                    <Text type="secondary" style={{ fontSize: 12 }}>Used to create other products</Text>
                  </div>
                </Radio>
              </Space>
            </Radio.Group>
          </Form.Item>

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

          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 12,
            border: `1px solid ${borderColor}`, marginTop: 12,
          }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              <strong>Production partners:</strong> If someone else helps make your products, you can add them on{' '}
              <a href="https://www.etsy.com/your/shops/me/production-partners" target="_blank" rel="noopener noreferrer">
                Etsy → Production Partners
              </a>
            </Text>
          </div>
        </>
      ),
    },
    {
      title: 'Photos & Files',
      content: (
        <>
          {/* Image grid — same layout as EditListingModal */}
          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 16,
            border: `1px solid ${borderColor}`,
          }}>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>
              <PictureOutlined style={{ marginRight: 6, color: BRAND }} />
              Photos ({imageFiles.length}/{MAX_IMAGES})
            </Text>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8,
            }}>
              {Array.from({ length: MAX_IMAGES }).map((_, i) => {
                if (i < imageFiles.length) {
                  const file = imageFiles[i];
                  const url = URL.createObjectURL(file);
                  return (
                    <div
                      key={`img-${i}`}
                      draggable
                      onDragStart={e => { setDragIndex(i); e.dataTransfer.effectAllowed = 'move'; }}
                      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
                      onDrop={e => {
                        e.preventDefault();
                        if (dragIndex === null || dragIndex === i) return;
                        const reordered = [...imageFiles];
                        const [moved] = reordered.splice(dragIndex, 1);
                        reordered.splice(i, 0, moved);
                        setImageFiles(reordered);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{
                        position: 'relative', width: '100%', aspectRatio: '1',
                        borderRadius: 8, overflow: 'hidden',
                        border: dragIndex === i ? `2px solid ${BRAND}` : `2px solid ${isDark ? '#444' : '#e8e8e8'}`,
                        cursor: 'grab',
                        opacity: dragIndex === i ? 0.5 : 1,
                        transition: 'opacity 0.2s, border-color 0.2s',
                      }}
                    >
                      <img
                        src={url}
                        alt={`Upload ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onLoad={() => URL.revokeObjectURL(url)}
                      />
                      {i === 0 && (
                        <div style={{
                          position: 'absolute', top: 4, left: 4,
                          background: BRAND, color: '#fff', fontSize: 9,
                          padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                        }}>Primary</div>
                      )}
                      {/* Delete overlay */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center', gap: 4,
                        background: 'rgba(0,0,0,0.55)', padding: '4px 0',
                      }}>
                        <Tooltip title="Remove">
                          <Button
                            type="text" size="small"
                            icon={<DeleteOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />}
                            style={{ minWidth: 0, padding: '0 6px' }}
                            onClick={() => setImageFiles(prev => prev.filter((_, idx) => idx !== i))}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  );
                }
                // Empty slot
                return (
                  <div
                    key={`empty-${i}`}
                    onClick={() => imageFiles.length < MAX_IMAGES && imageInputRef.current?.click()}
                    style={{
                      width: '100%', aspectRatio: '1', borderRadius: 8,
                      border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', transition: 'border-color 0.2s',
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
                  >
                    <PlusOutlined style={{ fontSize: 18, color: isDark ? '#888' : '#bbb' }} />
                    <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>Add</Text>
                  </div>
                );
              })}
            </div>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              multiple
              style={{ display: 'none' }}
              onChange={e => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                setImageFiles(prev => [...prev, ...files].slice(0, MAX_IMAGES));
                e.target.value = '';
              }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Etsy allows up to 10 photos. Supported: JPG, PNG, GIF, WebP. Drag images to reorder.
            </Text>
          </div>

          {/* Video section — reuse EditListingModal pattern */}
          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 16,
            border: `1px solid ${borderColor}`, marginTop: 12,
          }}>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>
              <VideoCameraOutlined style={{ marginRight: 6, color: BRAND }} />
              Video {videoFile ? '(1)' : ''}
            </Text>
            {videoFile ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <div style={{
                  position: 'relative', width: 140, height: 100, borderRadius: 8,
                  overflow: 'hidden', border: `2px solid ${borderColor}`, background: '#000',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <VideoCameraOutlined style={{ fontSize: 28, color: '#666' }} />
                  <Text style={{ position: 'absolute', bottom: 4, left: 0, right: 0, textAlign: 'center', color: '#ccc', fontSize: 10 }}>
                    {videoFile.name}
                  </Text>
                  <Popconfirm
                    title="Remove this video?"
                    onConfirm={() => setVideoFile(null)}
                    okText="Remove"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text" size="small"
                      icon={<CloseCircleFilled style={{ color: '#ff4d4f', fontSize: 16 }} />}
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        minWidth: 0, padding: 0, width: 22, height: 22,
                        background: '#fff', borderRadius: '50%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    />
                  </Popconfirm>
                </div>
              </div>
            ) : (
              <div
                onClick={() => videoInputRef.current?.click()}
                style={{
                  width: '100%', padding: '20px 0', borderRadius: 8,
                  border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
              >
                <VideoCameraOutlined style={{ fontSize: 24, color: isDark ? '#888' : '#bbb' }} />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>Add a video</Text>
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file) setVideoFile(file);
                e.target.value = '';
              }}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Videos may take a few minutes to process after upload. Supported: MP4, MOV, AVI, WebM.
            </Text>
          </div>

          {isDigital && (
            <div style={{ marginTop: 12 }}>
              <Text strong style={{ display: 'block', marginBottom: 8 }}>
                <FileOutlined style={{ marginRight: 6, color: BRAND }} />
                Digital Files <Text type="secondary" style={{ fontSize: 12 }}>(buyers download these after purchase)</Text>
              </Text>
              <div
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.multiple = true;
                  input.onchange = (ev) => {
                    const files = Array.from(ev.target.files || []);
                    setDigitalFiles(prev => [...prev, ...files.map(f => ({ originFileObj: f, name: f.name, uid: `${Date.now()}-${f.name}` }))].slice(0, 5));
                  };
                  input.click();
                }}
                style={{
                  width: '100%', padding: '20px 0', borderRadius: 8,
                  border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = BRAND; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
              >
                <FileOutlined style={{ fontSize: 24, color: isDark ? '#888' : '#bbb' }} />
                <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>Click to add digital files</Text>
                <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>ZIP, PDF, PES, DST, SVG, PNG, etc. — max 20MB per file</Text>
              </div>
              {digitalFiles.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  {digitalFiles.map((f, idx) => (
                    <div key={f.uid || idx} style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '4px 8px', marginBottom: 4,
                      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
                      borderRadius: 6,
                    }}>
                      <Text style={{ fontSize: 12 }}><FileOutlined style={{ marginRight: 4 }} />{f.name || f.originFileObj?.name}</Text>
                      <Button
                        type="text" size="small"
                        icon={<DeleteOutlined style={{ color: '#ff4d4f', fontSize: 12 }} />}
                        onClick={() => setDigitalFiles(prev => prev.filter((_, i) => i !== idx))}
                        style={{ minWidth: 0, padding: '0 4px' }}
                      />
                    </div>
                  ))}
                </div>
              )}
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
