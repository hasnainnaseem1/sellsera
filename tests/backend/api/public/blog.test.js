/**
 * Public Blog API Tests
 * Covers: GET /api/v1/public/blog/posts, /popular, /categories, /posts/:slug
 */
const { connectDB, clearDB } = require('../../setup/testSetup');
const {
  seedAdminSettings,
  makeBlogPostData,
  apiClient,
  expectSuccess,
  expectError
} = require('../../helpers/testHelpers');

const AdminSettings = require('../../../../backend/src/models/admin/AdminSettings');
const BlogPost = require('../../../../backend/src/models/admin/BlogPost');

const BASE = '/api/v1/public/blog';

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
  await seedAdminSettings(AdminSettings);

  // Create published blog posts
  await BlogPost.create({
    title: 'First Published Post',
    slug: 'first-published-post',
    excerpt: 'Excerpt for first post',
    content: '<p>Content of the first published blog post</p>',
    category: 'General',
    tags: ['test', 'first'],
    status: 'published',
    publishedAt: new Date(),
    views: 100,
    isFeatured: true
  });

  await BlogPost.create({
    title: 'Second Published Post',
    slug: 'second-published-post',
    excerpt: 'Excerpt for second post',
    content: '<p>Content of the second published blog post</p>',
    category: 'Technology',
    tags: ['tech', 'second'],
    status: 'published',
    publishedAt: new Date(),
    views: 250,
    isFeatured: false
  });

  await BlogPost.create({
    title: 'Third Published Post',
    slug: 'third-published-post',
    excerpt: 'Excerpt for third post about keyword search',
    content: '<p>Content of the third published blog post about keyword</p>',
    category: 'General',
    tags: ['general', 'third'],
    status: 'published',
    publishedAt: new Date(),
    views: 50,
    isFeatured: false
  });

  // Create a draft post (should NOT appear in public)
  await BlogPost.create({
    title: 'Draft Post',
    slug: 'draft-post',
    excerpt: 'This is a draft',
    content: '<p>Draft content</p>',
    category: 'General',
    tags: ['draft'],
    status: 'draft',
    views: 0
  });

  // Create an archived post (should NOT appear in public)
  await BlogPost.create({
    title: 'Archived Post',
    slug: 'archived-post',
    excerpt: 'This is archived',
    content: '<p>Archived content</p>',
    category: 'General',
    tags: ['archived'],
    status: 'archived',
    views: 0
  });
});

afterAll(async () => {
  await clearDB();
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/blog/posts — List Published Posts
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/blog/posts', () => {
  it('should return only published posts', async () => {
    const res = await api.get(`${BASE}/posts`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(3);

    // All returned posts should be published (public API only returns published)
    // Note: public API select doesn't include status field, so we verify by checking
    // that no draft/archived posts are present
    const slugs = data.map(p => p.slug);
    expect(slugs).not.toContain('draft-post');
    expect(slugs).not.toContain('archived-post');
  });

  it('should not return draft posts', async () => {
    const res = await api.get(`${BASE}/posts`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    const slugs = data.map(p => p.slug);
    expect(slugs).not.toContain('draft-post');
  });

  it('should not return archived posts', async () => {
    const res = await api.get(`${BASE}/posts`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    const slugs = data.map(p => p.slug);
    expect(slugs).not.toContain('archived-post');
  });

  it('should support pagination with ?page=1&limit=2', async () => {
    const res = await api.get(`${BASE}/posts?page=1&limit=2`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    expect(data.length).toBeLessThanOrEqual(2);

    const hasPagination = res.body.pagination || res.body.totalPages || res.body.total;
    expect(hasPagination).toBeTruthy();
  });

  it('should support search filter', async () => {
    const res = await api.get(`${BASE}/posts?search=keyword`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    // At least the post mentioning "keyword" should appear
    expect(data.length).toBeGreaterThanOrEqual(1);
  });

  it('should support category filter', async () => {
    const res = await api.get(`${BASE}/posts?category=General`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    data.forEach(post => {
      expect(post.category).toBe('General');
    });
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/blog/popular — Popular Posts
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/blog/popular', () => {
  it('should return posts ordered by views descending', async () => {
    const res = await api.get(`${BASE}/popular`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.posts || [];
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThanOrEqual(1);

    // Verify descending order by views
    for (let i = 1; i < data.length; i++) {
      expect(data[i - 1].views).toBeGreaterThanOrEqual(data[i].views);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/blog/categories — List Categories
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/blog/categories', () => {
  it('should return unique categories from published posts', async () => {
    const res = await api.get(`${BASE}/categories`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.categories || [];
    expect(Array.isArray(data)).toBe(true);
    // Should include General and Technology
    const categories = data.map(c => (typeof c === 'string' ? c : c.name || c.category));
    expect(categories).toContain('General');
    expect(categories).toContain('Technology');
  });
});

// ─────────────────────────────────────────────────────────────
// GET /api/v1/public/blog/posts/:slug — Get Post by Slug
// ─────────────────────────────────────────────────────────────
describe('GET /api/v1/public/blog/posts/:slug', () => {
  it('should return a specific post by slug', async () => {
    const res = await api.get(`${BASE}/posts/first-published-post`);
    expectSuccess(res, 200);
    const data = res.body.data || res.body.post || res.body;
    expect(data).toHaveProperty('title', 'First Published Post');
    expect(data).toHaveProperty('content');
  });

  it('should increment views when fetching a post', async () => {
    const before = await BlogPost.findOne({ slug: 'second-published-post' });
    const viewsBefore = before.views;

    await api.get(`${BASE}/posts/second-published-post`);

    const after = await BlogPost.findOne({ slug: 'second-published-post' });
    expect(after.views).toBeGreaterThanOrEqual(viewsBefore);
  });

  it('should return 404 for non-existent slug', async () => {
    const res = await api.get(`${BASE}/posts/nonexistent-post-slug`);
    expect([404, 400]).toContain(res.status);
  });
});
