/**
 * Admin Blog API Tests
 * Covers all endpoints under /api/v1/admin/blog
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdmin,
  seedModerator,
  seedAdminSettings,
  apiClient,
  expectSuccess,
  expectError,
  makeBlogPostData
} = require('../../helpers/testHelpers');

const User = require('../../../../backend/src/models/user/User');
const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const BlogPost = require('../../../../backend/src/models/admin/BlogPost');

const BASE = '/api/v1/admin/blog';

let app, api, admin, moderator;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);
  admin = await seedAdmin(User);
  moderator = await seedModerator(User);
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// LIST POSTS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/blog/posts', () => {
  it('should list blog posts', async () => {
    const res = await api.get(`${BASE}/posts`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('posts');
    expect(Array.isArray(res.body.posts)).toBe(true);
  });

  it('should support pagination', async () => {
    const res = await api.get(`${BASE}/posts?page=1&limit=5`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 401 without auth', async () => {
    const res = await api.get(`${BASE}/posts`);
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────────
// BLOG STATS
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/blog/stats', () => {
  it('should return blog stats', async () => {
    const res = await api.get(`${BASE}/stats`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CATEGORIES
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/blog/categories', () => {
  it('should list blog categories', async () => {
    const res = await api.get(`${BASE}/categories`, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// CREATE POST
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/blog/posts', () => {
  it('should create a blog post', async () => {
    const data = makeBlogPostData();
    const res = await api.post(`${BASE}/posts`, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body).toHaveProperty('post');
    expect(res.body.post.title).toBe(data.title);
  });

  it('should auto-generate a slug from title', async () => {
    const data = makeBlogPostData({ title: 'My Amazing Blog Post Title' });
    const res = await api.post(`${BASE}/posts`, data, admin.token);
    expectSuccess(res, 201);
    expect(res.body.post).toHaveProperty('slug');
    expect(res.body.post.slug).toMatch(/my-amazing-blog-post-title/i);
  });

  it('should return 500 for missing title', async () => {
    const res = await api.post(`${BASE}/posts`, { content: 'No title' }, admin.token);
    expectError(res, 500);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const data = makeBlogPostData();
    const res = await api.post(`${BASE}/posts`, data, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// GET POST BY ID
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/admin/blog/posts/:id', () => {
  let post;

  beforeAll(async () => {
    const data = makeBlogPostData();
    post = await BlogPost.create({ ...data, author: admin.user._id, slug: `test-slug-${Date.now()}` });
  });

  it('should get a post by ID', async () => {
    const res = await api.get(`${BASE}/posts/${post._id}`, admin.token);
    expectSuccess(res, 200);
    expect(res.body).toHaveProperty('post');
  });

  it('should return 404 for non-existent post', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.get(`${BASE}/posts/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// UPDATE POST
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/blog/posts/:id', () => {
  let post;

  beforeAll(async () => {
    const data = makeBlogPostData();
    post = await BlogPost.create({ ...data, author: admin.user._id, slug: `update-slug-${Date.now()}` });
  });

  it('should update a post', async () => {
    const res = await api.put(`${BASE}/posts/${post._id}`, { title: 'Updated Blog Title' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator without settings.edit', async () => {
    const res = await api.put(`${BASE}/posts/${post._id}`, { title: 'Nope' }, moderator.token);
    expectError(res, 403);
  });
});

// ─────────────────────────────────────────────────────────────
// DELETE POST
// ─────────────────────────────────────────────────────────────
describe('DELETE /api/v1/admin/blog/posts/:id', () => {
  it('should delete a post', async () => {
    const data = makeBlogPostData();
    const post = await BlogPost.create({ ...data, author: admin.user._id, slug: `del-slug-${Date.now()}` });
    const res = await api.delete(`${BASE}/posts/${post._id}`, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 404 for non-existent post', async () => {
    const fakeId = '507f1f77bcf86cd799439011';
    const res = await api.delete(`${BASE}/posts/${fakeId}`, admin.token);
    expectError(res, 404);
  });
});

// ─────────────────────────────────────────────────────────────
// TOGGLE POST STATUS
// ─────────────────────────────────────────────────────────────
describe('PUT /api/v1/admin/blog/posts/:id/status', () => {
  it('should change post status to draft', async () => {
    const data = makeBlogPostData({ status: 'published' });
    const post = await BlogPost.create({ ...data, author: admin.user._id, slug: `status-slug-${Date.now()}` });
    const res = await api.put(`${BASE}/posts/${post._id}/status`, { status: 'draft' }, admin.token);
    expectSuccess(res, 200);
  });

  it('should change post status to archived', async () => {
    const data = makeBlogPostData({ status: 'published' });
    const post = await BlogPost.create({ ...data, author: admin.user._id, slug: `archive-slug-${Date.now()}` });
    const res = await api.put(`${BASE}/posts/${post._id}/status`, { status: 'archived' }, admin.token);
    expectSuccess(res, 200);
  });
});

// ─────────────────────────────────────────────────────────────
// BULK DELETE
// ─────────────────────────────────────────────────────────────
describe('POST /api/v1/admin/blog/posts/bulk-delete', () => {
  it('should bulk delete posts', async () => {
    const p1 = await BlogPost.create({ ...makeBlogPostData(), author: admin.user._id, slug: `bulk1-${Date.now()}` });
    const p2 = await BlogPost.create({ ...makeBlogPostData(), author: admin.user._id, slug: `bulk2-${Date.now()}` });
    const res = await api.post(`${BASE}/posts/bulk-delete`, { ids: [p1._id, p2._id] }, admin.token);
    expectSuccess(res, 200);
  });

  it('should return 403 for moderator on bulk-delete', async () => {
    const res = await api.post(`${BASE}/posts/bulk-delete`, { ids: [] }, moderator.token);
    expectError(res, 403);
  });
});
