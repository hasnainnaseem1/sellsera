/**
 * Health Check API Tests
 * Covers: GET /api/health, GET /
 */
const { connectDB, clearDB } = require('../setup/testSetup');
const { apiClient } = require('../helpers/testHelpers');

let app, api;

beforeAll(async () => {
  app = await connectDB();
  api = apiClient(app);
});

afterAll(async () => {
  await clearDB();
});

describe('Health Check Endpoints', () => {
  describe('GET /api/health', () => {
    it('should return 200 with success status', async () => {
      const res = await api.get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('message');
    });
  });

  describe('GET /', () => {
    it('should return 200 with app info in development', async () => {
      const res = await api.get('/');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('404 Handler', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await api.get('/api/v1/nonexistent-route');
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('not found');
    });

    it('should return 404 for random paths', async () => {
      const res = await api.get('/random/path/that/does/not/exist');
      expect(res.status).toBe(404);
    });
  });
});
