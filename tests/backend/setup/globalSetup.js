/**
 * Global Setup — starts MongoDB Memory Server before any tests run.
 * Stores the URI in an env variable so test files can use it.
 */
const path = require('path');
const { MongoMemoryServer } = require(path.resolve(__dirname, '../../../backend/node_modules/mongodb-memory-server'));
const fs = require('fs');

module.exports = async function globalSetup() {
  console.log('\n🔧 Starting MongoDB Memory Server...');
  
  const mongod = await MongoMemoryServer.create({
    instance: {
      dbName: 'shopwise-test'
    }
  });
  
  const uri = mongod.getUri();
  
  // Store for globalTeardown
  global.__MONGOD__ = mongod;
  
  // Write URI to a temp file so test workers can read it
  const tmpFile = path.join(__dirname, '__mongo_uri.tmp');
  fs.writeFileSync(tmpFile, uri);
  
  // Also set in process env
  process.env.MONGODB_URI = uri;
  
  console.log(`✅ MongoDB Memory Server started at: ${uri}\n`);
};
