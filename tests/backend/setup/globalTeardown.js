/**
 * Global Teardown — stops MongoDB Memory Server after all tests complete.
 */
const path = require('path');
const fs = require('fs');

module.exports = async function globalTeardown() {
  console.log('\n🧹 Stopping MongoDB Memory Server...');
  
  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
  
  // Clean up temp file
  const tmpFile = path.join(__dirname, '__mongo_uri.tmp');
  if (fs.existsSync(tmpFile)) {
    fs.unlinkSync(tmpFile);
  }
  
  console.log('✅ MongoDB Memory Server stopped.\n');
};
