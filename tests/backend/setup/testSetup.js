/**
 * Test Setup — connects to MongoDB Memory Server and provides app instance.
 * Import this in each test file's beforeAll/afterAll.
 */
const path = require('path');
const backendPath = path.resolve(__dirname, '../../../backend');
const mongoose = require(path.join(backendPath, 'node_modules/mongoose'));
const fs = require('fs');

let app;

/**
 * Connect to the in-memory MongoDB and get Express app
 */
async function connectDB() {
  // Read URI from temp file written by globalSetup
  const tmpFile = path.join(__dirname, '__mongo_uri.tmp');
  const uri = fs.readFileSync(tmpFile, 'utf-8').trim();
  process.env.MONGODB_URI = uri;
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
  }
  
  // Import app AFTER DB connection & env setup
  if (!app) {
    app = require(path.join(backendPath, 'src/app'));
  }
  
  return app;
}

/**
 * Clear all collections between test suites
 */
async function clearDB() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

/**
 * Disconnect from DB
 */
async function disconnectDB() {
  await mongoose.connection.close();
}

module.exports = { connectDB, clearDB, disconnectDB };
