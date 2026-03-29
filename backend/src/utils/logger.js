/**
 * Logger Utility
 * 
 * Provides timestamped, tagged console logging across the entire backend.
 * Each log line includes ISO timestamp + module tag for easy PM2/CloudWatch filtering.
 * 
 * Usage:
 *   const log = require('../utils/logger')('ModuleName');
 *   log.info('Server started on port', 3000);
 *   log.error('DB connection failed', err.message);
 *   log.warn('Rate limit approaching');
 *   log.debug('Cache hit for key', cacheKey);  // Only in development
 */

const isDev = process.env.NODE_ENV === 'development';

function createLogger(tag) {
  const prefix = () => `[${new Date().toISOString()}] [${tag}]`;

  return {
    info: (...args) => console.log(prefix(), 'INFO:', ...args),
    warn: (...args) => console.warn(prefix(), 'WARN:', ...args),
    error: (...args) => console.error(prefix(), 'ERROR:', ...args),
    debug: (...args) => {
      if (isDev) console.log(prefix(), 'DEBUG:', ...args);
    },
  };
}

module.exports = createLogger;
