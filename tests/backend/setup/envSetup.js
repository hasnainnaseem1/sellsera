/**
 * Set up environment variables for testing BEFORE anything else loads.
 * This runs before each test file via Jest setupFiles.
 */
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.PORT = '0'; // Use random available port
process.env.ALLOWED_ORIGINS = 'http://localhost:3000,http://localhost:3002,http://localhost:3003';
process.env.CUSTOMER_FRONTEND_URL = 'http://localhost:3002';
process.env.SUPPORT_EMAIL = 'test@example.com';
process.env.BACKEND_URL = 'http://localhost:3001';
// MONGODB_URI is set dynamically in globalSetup
