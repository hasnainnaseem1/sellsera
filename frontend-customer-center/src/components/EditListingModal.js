import React, { useState, useEffect, useRef } from 'react';
import {
  Modal, Form, Input, InputNumber, Select, Switch, Button,
  Steps, Typography, Row, Col, Divider, message, Tag, Space,
  Radio, Spin, Tooltip, Popconfirm,
} from 'antd';
import {
  EditOutlined, TagsOutlined, DollarOutlined, PictureOutlined,
  PlusOutlined, DeleteOutlined, VideoCameraOutlined, CloseCircleFilled,
  PlayCircleOutlined,
} from '@ant-design/icons';
import { useTheme } from '../context/ThemeContext';
import { colors, radii } from '../theme/tokens';
import etsyApi from '../api/etsyApi';

const { Text } = Typography;
const { TextArea } = Input;
const BRAND = '#6C63FF';

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

const MAX_IMAGES = 10;

const EditListingModal = ({ open, onClose, onSuccess, listingId }) => {
  const { isDark } = useTheme();
  const [form] = Form.useForm();
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [shippingProfiles, setShippingProfiles] = useState([]);
  const [shippingLoading, setShippingLoading] = useState(false);
  const [taxonomyProperties, setTaxonomyProperties] = useState([]);
  const [propsLoading, setPropsLoading] = useState(false);
  const [propertyValues, setPropertyValues] = useState({});
  const [listingData, setListingData] = useState(null);
  const [existingImages, setExistingImages] = useState([]);
  const [existingVideos, setExistingVideos] = useState([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [videoUploading, setVideoUploading] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState(null);
  const [deletingVideoId, setDeletingVideoId] = useState(null);
  const imageInputRef = useRef(null);
  const replaceInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const [replaceIndex, setReplaceIndex] = useState(null);
  const [mediaChanged, setMediaChanged] = useState(false);
  const [imageOrderChanged, setImageOrderChanged] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);

  // Load listing data when modal opens
  useEffect(() => {
    if (!open || !listingId) return;
    setFetching(true);
    etsyApi.getListingById(listingId)
      .then(res => {
        const d = res.data;
        setListingData(d);
        setExistingImages(d.images || []);
        setExistingVideos(d.videos || []);

        // Pre-fill form
        form.setFieldsValue({
          title: d.title || '',
          description: d.description || '',
          tags: d.tags || [],
          materials: d.materials || [],
          price: d.price,
          quantity: d.quantity || 1,
          whoMade: d.whoMade || 'i_did',
          whenMade: d.whenMade || 'made_to_order',
          isSupply: d.isSupply === true,
          shippingProfileId: d.shippingProfileId || undefined,
          personalizationIsRequired: d.personalizationIsRequired || false,
          personalizationInstructions: d.personalizationInstructions || '',
          personalizationCharCountMax: d.personalizationCharCountMax || undefined,
        });

        // Load taxonomy properties if we have a taxonomyId
        if (d.taxonomyId) {
          loadTaxonomyProperties(d.taxonomyId);
        }
      })
      .catch(err => {
        message.error(err?.response?.data?.message || 'Failed to load listing details');
        onClose();
      })
      .finally(() => setFetching(false));
  }, [open, listingId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load shipping profiles
  useEffect(() => {
    if (!open || listingData?.isDigital) return;
    setShippingLoading(true);
    etsyApi.getShippingProfiles()
      .then(res => setShippingProfiles(res.data || []))
      .catch(() => {})
      .finally(() => setShippingLoading(false));
  }, [open, listingData?.isDigital]);

  const loadTaxonomyProperties = async (taxonomyId) => {
    if (!taxonomyId) return;
    setPropsLoading(true);
    try {
      const res = await etsyApi.getTaxonomyProperties(taxonomyId);
      setTaxonomyProperties(res.data || []);
    } catch {
      setTaxonomyProperties([]);
    } finally {
      setPropsLoading(false);
    }
  };

  const handlePropertyChange = (propertyId, valueId, option) => {
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
    setListingData(null);
    setExistingImages([]);
    setExistingVideos([]);
    setTaxonomyProperties([]);
    setPropertyValues([]);
    setReplaceIndex(null);
    setMediaChanged(false);
    setImageOrderChanged(false);
    setDragIndex(null);
  };

  // --- Image handlers ---
  const handleImageUpload = async (file) => {
    if (!file || !listingId) return;
    setImageUploading(true);
    try {
      const res = await etsyApi.uploadListingImage(listingId, file);
      if (res.success) {
        message.success('Image uploaded');
        setMediaChanged(true);
        // Refresh listing to get updated images
        const refreshed = await etsyApi.getListingById(listingId);
        setExistingImages(refreshed.data?.images || []);
      } else {
        message.error(res.message || 'Upload failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to upload image');
    } finally {
      setImageUploading(false);
    }
  };

  const handleImageDelete = async (imageId) => {
    if (!imageId || !listingId) return;
    setDeletingImageId(imageId);
    try {
      const res = await etsyApi.deleteListingImage(listingId, imageId);
      if (res.success) {
        message.success('Image deleted');
        setMediaChanged(true);
        setExistingImages(prev => prev.filter(img => img.listing_image_id !== imageId));
      } else {
        message.error(res.message || 'Delete failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to delete image');
    } finally {
      setDeletingImageId(null);
    }
  };

  const handleImageReplace = async (file, imageToReplace) => {
    if (!file || !listingId || !imageToReplace) return;
    setImageUploading(true);
    try {
      // Delete old image first, then upload new one
      await etsyApi.deleteListingImage(listingId, imageToReplace.listing_image_id);
      await etsyApi.uploadListingImage(listingId, file);
      message.success('Image replaced');
      setMediaChanged(true);
      // Refresh listing to get updated images
      const refreshed = await etsyApi.getListingById(listingId);
      setExistingImages(refreshed.data?.images || []);
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to replace image');
    } finally {
      setImageUploading(false);
      setReplaceIndex(null);
    }
  };

  const onAddImageFile = (e) => {
    const file = e.target.files?.[0];
    if (file) handleImageUpload(file);
    e.target.value = '';
  };

  const onReplaceImageFile = (e) => {
    const file = e.target.files?.[0];
    if (file && replaceIndex !== null && existingImages[replaceIndex]) {
      handleImageReplace(file, existingImages[replaceIndex]);
    }
    e.target.value = '';
  };

  // --- Video handlers ---
  const handleVideoUpload = async (file) => {
    if (!file || !listingId) return;
    setVideoUploading(true);
    try {
      const res = await etsyApi.uploadListingVideo(listingId, file);
      if (res.success) {
        message.success('Video uploaded — it may take a few minutes to process on Etsy');
        setMediaChanged(true);
        if (res.data) {
          setExistingVideos(prev => [...prev, res.data]);
        }
      } else {
        message.error(res.message || 'Upload failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to upload video');
    } finally {
      setVideoUploading(false);
    }
  };

  const handleVideoDelete = async (videoId) => {
    if (!videoId || !listingId) return;
    setDeletingVideoId(videoId);
    try {
      const res = await etsyApi.deleteListingVideo(listingId, videoId);
      if (res.success) {
        message.success('Video deleted');
        setMediaChanged(true);
        setExistingVideos(prev => prev.filter(v => v.video_id !== videoId));
      } else {
        message.error(res.message || 'Delete failed');
      }
    } catch (err) {
      message.error(err?.response?.data?.message || 'Failed to delete video');
    } finally {
      setDeletingVideoId(null);
    }
  };

  const onVideoFile = (e) => {
    const file = e.target.files?.[0];
    if (file) handleVideoUpload(file);
    e.target.value = '';
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const nextStep = async () => {
    try {
      if (step === 0) {
        await form.validateFields(['title', 'description', 'tags']);
      } else if (step === 1) {
        const fieldsToValidate = ['price', 'quantity', 'whoMade', 'whenMade'];
        if (!listingData?.isDigital) fieldsToValidate.push('shippingProfileId');
        await form.validateFields(fieldsToValidate);
      }
      setStep(s => s + 1);
    } catch {
      // validation errors shown by form
    }
  };

  const prevStep = () => setStep(s => s - 1);

  const handleSubmit = async () => {
    try {
      const values = form.getFieldsValue(true);
      setLoading(true);

      // Build update payload — only include changed fields
      const payload = {};

      if (values.title !== listingData.title) payload.title = values.title;
      if (values.description !== (listingData.description || '')) payload.description = values.description;
      if (values.price !== listingData.price) payload.price = values.price;
      if (values.quantity !== (listingData.quantity || 1)) payload.quantity = values.quantity;
      if (values.whoMade !== (listingData.whoMade || 'i_did')) payload.whoMade = values.whoMade;
      if (values.whenMade !== (listingData.whenMade || 'made_to_order')) payload.whenMade = values.whenMade;
      if (values.isSupply !== (listingData.isSupply === true)) payload.isSupply = values.isSupply;

      // Tags — compare as sorted strings
      const oldTags = (listingData.tags || []).sort().join(',');
      const newTags = (values.tags || []).sort().join(',');
      if (newTags !== oldTags) payload.tags = values.tags || [];

      // Materials
      const oldMats = (listingData.materials || []).sort().join(',');
      const newMats = (values.materials || []).sort().join(',');
      if (newMats !== oldMats) payload.materials = values.materials || [];

      // Shipping profile (physical only)
      if (!listingData.isDigital && values.shippingProfileId !== listingData.shippingProfileId) {
        payload.shippingProfileId = values.shippingProfileId;
      }

      // Personalization
      const hadPersonalization = listingData.isPersonalizable === true;
      const hasPersonalization = values.personalizationIsRequired === true;
      if (hadPersonalization !== hasPersonalization) {
        payload.isPersonalizable = hasPersonalization;
        payload.personalizationIsRequired = hasPersonalization;
      }
      if (hasPersonalization) {
        if ((values.personalizationInstructions || '') !== (listingData.personalizationInstructions || '')) {
          payload.isPersonalizable = true;
          payload.personalizationIsRequired = true;
          payload.personalizationInstructions = values.personalizationInstructions || '';
        }
        if (values.personalizationCharCountMax && values.personalizationCharCountMax !== listingData.personalizationCharCountMax) {
          payload.personalizationCharCountMax = values.personalizationCharCountMax;
        }
      }

      if (Object.keys(payload).length === 0) {
        // Check if taxonomy properties changed
        const propsToSet = Object.entries(propertyValues)
          .filter(([, val]) => val.valueIds?.length > 0 || val.values?.length > 0)
          .map(([propertyId, val]) => ({
            propertyId: parseInt(propertyId, 10),
            valueIds: val.valueIds || [],
            values: val.values || [],
          }));

        if (propsToSet.length === 0 && !mediaChanged && !imageOrderChanged) {
          message.info('No changes detected');
          setLoading(false);
          return;
        }
      }

      // Include image_ids for reordering if image order changed
      if (imageOrderChanged && existingImages.length > 0) {
        payload.imageIds = existingImages.map(img => img.listing_image_id);
      }

      // Update listing fields (and/or image order)
      if (Object.keys(payload).length > 0) {
        const updateRes = await etsyApi.updateListing(listingId, payload);
        if (!updateRes.success) {
          message.error(updateRes.message || 'Failed to update listing');
          setLoading(false);
          return;
        }
      }

      // Update taxonomy properties if changed
      const propsToSet = Object.entries(propertyValues)
        .filter(([, val]) => val.valueIds?.length > 0 || val.values?.length > 0)
        .map(([propertyId, val]) => ({
          propertyId: parseInt(propertyId, 10),
          valueIds: val.valueIds || [],
          values: val.values || [],
        }));

      if (propsToSet.length > 0) {
        try {
          await etsyApi.setListingProperties(listingId, propsToSet);
        } catch {
          message.warning('Some listing attributes could not be updated');
        }
      }

      message.success('Listing updated successfully!');
      onSuccess?.();
      handleClose();
    } catch (err) {
      message.error(err?.response?.data?.message || err.message || 'Failed to update listing');
    } finally {
      setLoading(false);
    }
  };

  const cardBg = isDark ? 'rgba(108,99,255,0.04)' : 'rgba(108,99,255,0.02)';
  const borderColor = isDark ? colors.darkBorder : colors.lightBorder;

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
              placeholder="e.g. Highland Cow Embroidery Design"
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
              placeholder="Describe your product in detail..."
              rows={6}
              maxLength={10000}
              showCount
            />
          </Form.Item>

          {/* Show current category as read-only for active listings */}
          {listingData?.category && (
            <div style={{
              background: cardBg, borderRadius: radii.sm, padding: 12,
              border: `1px solid ${borderColor}`, marginBottom: 16,
            }}>
              <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Category</Text>
              <Text strong>{listingData.category}</Text>
            </div>
          )}

          <Form.Item
            name="tags" label={<span>Tags <Text type="secondary" style={{ fontSize: 12 }}>(up to 13)</Text></span>}
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
            label="Materials"
          >
            <Select
              mode="tags"
              placeholder="e.g. Cotton, Polyester, Wood"
              tokenSeparators={[',']}
              style={{ width: '100%' }}
              maxCount={13}
            />
          </Form.Item>

          {/* Image management grid - 10 slots */}
          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 16,
            border: `1px solid ${borderColor}`, marginTop: 8,
          }}>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>
              <PictureOutlined style={{ marginRight: 6, color: BRAND }} />
              Photos ({existingImages.length}/{MAX_IMAGES})
            </Text>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
              {Array.from({ length: MAX_IMAGES }).map((_, i) => {
                const img = existingImages[i];
                if (img) {
                  // Filled slot — show image with overlay actions + drag to reorder
                  return (
                    <div
                      key={img.listing_image_id || i}
                      draggable
                      onDragStart={(e) => {
                        setDragIndex(i);
                        e.dataTransfer.effectAllowed = 'move';
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        if (dragIndex === null || dragIndex === i) return;
                        const reordered = [...existingImages];
                        const [moved] = reordered.splice(dragIndex, 1);
                        reordered.splice(i, 0, moved);
                        setExistingImages(reordered);
                        setImageOrderChanged(true);
                        setDragIndex(null);
                      }}
                      onDragEnd={() => setDragIndex(null)}
                      style={{
                        position: 'relative', width: '100%', aspectRatio: '1',
                        borderRadius: 8, overflow: 'hidden',
                        border: dragIndex === i ? `2px solid ${BRAND}` : `2px solid ${borderColor}`,
                        opacity: dragIndex === i ? 0.5 : 1,
                        cursor: 'grab',
                        transition: 'border-color 0.2s, opacity 0.2s',
                      }}
                    >
                      <img
                        src={img.url_170x135 || img.url_75x75 || img.url}
                        alt={`Listing ${i + 1}`}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                      {i === 0 && (
                        <div style={{
                          position: 'absolute', top: 4, left: 4,
                          background: BRAND, color: '#fff', fontSize: 9,
                          padding: '1px 5px', borderRadius: 4, fontWeight: 600,
                        }}>Primary</div>
                      )}
                      {/* Overlay actions */}
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        display: 'flex', justifyContent: 'center', gap: 4,
                        background: 'rgba(0,0,0,0.55)', padding: '4px 0',
                      }}>
                        <Tooltip title="Replace">
                          <Button
                            type="text" size="small"
                            icon={<EditOutlined style={{ color: '#fff', fontSize: 13 }} />}
                            style={{ minWidth: 0, padding: '0 6px' }}
                            disabled={imageUploading}
                            onClick={() => {
                              setReplaceIndex(i);
                              replaceInputRef.current?.click();
                            }}
                          />
                        </Tooltip>
                        <Popconfirm
                          title="Delete this image?"
                          onConfirm={() => handleImageDelete(img.listing_image_id)}
                          okText="Delete"
                          okButtonProps={{ danger: true }}
                        >
                          <Tooltip title="Delete">
                            <Button
                              type="text" size="small"
                              icon={<DeleteOutlined style={{ color: '#ff4d4f', fontSize: 13 }} />}
                              style={{ minWidth: 0, padding: '0 6px' }}
                              loading={deletingImageId === img.listing_image_id}
                              disabled={imageUploading}
                            />
                          </Tooltip>
                        </Popconfirm>
                      </div>
                    </div>
                  );
                }
                // Empty slot — show + icon
                return (
                  <div
                    key={`empty-${i}`}
                    onClick={() => !imageUploading && existingImages.length < MAX_IMAGES && imageInputRef.current?.click()}
                    style={{
                      width: '100%', aspectRatio: '1',
                      borderRadius: 8,
                      border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      cursor: imageUploading ? 'not-allowed' : 'pointer',
                      transition: 'border-color 0.2s',
                      background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                    }}
                    onMouseEnter={e => { if (!imageUploading) e.currentTarget.style.borderColor = BRAND; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
                  >
                    {imageUploading && i === existingImages.length ? (
                      <Spin size="small" />
                    ) : (
                      <>
                        <PlusOutlined style={{ fontSize: 18, color: isDark ? '#888' : '#bbb' }} />
                        <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>Add</Text>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Hidden file inputs */}
            <input
              ref={imageInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={onAddImageFile}
            />
            <input
              ref={replaceInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              style={{ display: 'none' }}
              onChange={onReplaceImageFile}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Etsy allows up to 10 photos. Supported: JPG, PNG, GIF, WebP. Drag images to reorder.
            </Text>
          </div>

          {/* Video section */}
          <div style={{
            background: cardBg, borderRadius: radii.sm, padding: 16,
            border: `1px solid ${borderColor}`, marginTop: 12,
          }}>
            <Text strong style={{ display: 'block', marginBottom: 10 }}>
              <VideoCameraOutlined style={{ marginRight: 6, color: BRAND }} />
              Video {existingVideos.length > 0 ? `(${existingVideos.length})` : ''}
            </Text>
            {existingVideos.length > 0 ? (
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {existingVideos.map(v => (
                  <div key={v.video_id} style={{
                    position: 'relative', width: 140, height: 100,
                    borderRadius: 8, overflow: 'hidden',
                    border: `2px solid ${borderColor}`,
                    background: '#000',
                  }}>
                    {v.thumbnail_url ? (
                      <img
                        src={v.thumbnail_url}
                        alt="Video thumbnail"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.8 }}
                      />
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <VideoCameraOutlined style={{ fontSize: 28, color: '#666' }} />
                      </div>
                    )}
                    <PlayCircleOutlined style={{
                      position: 'absolute', top: '50%', left: '50%',
                      transform: 'translate(-50%, -50%)',
                      fontSize: 28, color: 'rgba(255,255,255,0.85)',
                      pointerEvents: 'none',
                    }} />
                    {v.video_state && v.video_state !== 'active' && (
                      <Tag color="orange" style={{
                        position: 'absolute', top: 4, left: 4, fontSize: 10,
                      }}>Processing</Tag>
                    )}
                    <Popconfirm
                      title="Delete this video?"
                      onConfirm={() => handleVideoDelete(v.video_id)}
                      okText="Delete"
                      okButtonProps={{ danger: true }}
                    >
                      <Button
                        type="text" size="small"
                        loading={deletingVideoId === v.video_id}
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
                ))}
                {/* Add another video slot */}
                <div
                  onClick={() => !videoUploading && videoInputRef.current?.click()}
                  style={{
                    width: 140, height: 100, borderRadius: 8,
                    border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    cursor: videoUploading ? 'not-allowed' : 'pointer',
                    background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  }}
                  onMouseEnter={e => { if (!videoUploading) e.currentTarget.style.borderColor = BRAND; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
                >
                  {videoUploading ? <Spin size="small" /> : (
                    <>
                      <PlusOutlined style={{ fontSize: 18, color: isDark ? '#888' : '#bbb' }} />
                      <Text type="secondary" style={{ fontSize: 10, marginTop: 2 }}>Update</Text>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div
                onClick={() => !videoUploading && videoInputRef.current?.click()}
                style={{
                  width: '100%', padding: '20px 0',
                  borderRadius: 8,
                  border: `2px dashed ${isDark ? '#555' : '#d9d9d9'}`,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  cursor: videoUploading ? 'not-allowed' : 'pointer',
                  background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                }}
                onMouseEnter={e => { if (!videoUploading) e.currentTarget.style.borderColor = BRAND; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? '#555' : '#d9d9d9'; }}
              >
                {videoUploading ? <Spin size="small" /> : (
                  <>
                    <VideoCameraOutlined style={{ fontSize: 24, color: isDark ? '#888' : '#bbb' }} />
                    <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>Add a video</Text>
                  </>
                )}
              </div>
            )}
            <input
              ref={videoInputRef}
              type="file"
              accept="video/mp4,video/quicktime,video/x-msvideo,video/webm"
              style={{ display: 'none' }}
              onChange={onVideoFile}
            />
            <Text type="secondary" style={{ fontSize: 11, display: 'block', marginTop: 8 }}>
              Videos may take a few minutes to process after upload. Supported: MP4, MOV, AVI, WebM.
            </Text>
          </div>
        </>
      ),
    },
    {
      title: 'Pricing & Shipping',
      content: (
        <>
          {listingData?.isDigital && (
            <div style={{
              background: cardBg, borderRadius: radii.sm, padding: 12,
              border: `1px solid ${borderColor}`, marginBottom: 16,
            }}>
              <Tag color="blue">Digital Product</Tag>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Buyers receive downloadable files
              </Text>
            </div>
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
              >
                <Select options={WHO_MADE_OPTIONS} size="large" />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12}>
              <Form.Item
                name="whenMade" label="When was it made?"
                rules={[{ required: true, message: 'Required' }]}
              >
                <Select options={WHEN_MADE_OPTIONS} size="large" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="isSupply"
            label="What is it?"
            rules={[{ required: true, message: 'Required' }]}
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

          {!listingData?.isDigital && (
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
                <>
                  <Form.Item name="personalizationInstructions" label="Personalization Instructions">
                    <TextArea placeholder="Tell buyers what info you need..." rows={2} maxLength={256} showCount />
                  </Form.Item>
                  <Form.Item name="personalizationCharCountMax" label="Max Character Count (optional)">
                    <InputNumber style={{ width: '100%' }} min={1} max={1000} placeholder="e.g. 50" />
                  </Form.Item>
                </>
              ) : null
            }
          </Form.Item>
        </>
      ),
    },
  ];

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <EditOutlined style={{ color: BRAND }} />
          <span>Edit Listing</span>
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
                {loading ? 'Updating...' : 'Update Listing'}
              </Button>
            )}
          </Space>
        </div>
      }
    >
      {fetching ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>
            <Text type="secondary">Loading listing details...</Text>
          </div>
        </div>
      ) : (
        <>
          <Steps
            current={step}
            size="small"
            style={{ marginBottom: 24 }}
            items={steps.map(s => ({ title: s.title }))}
          />

          <Form
            form={form}
            layout="vertical"
            requiredMark="optional"
          >
            {steps[step].content}
          </Form>
        </>
      )}
    </Modal>
  );
};

export default EditListingModal;
