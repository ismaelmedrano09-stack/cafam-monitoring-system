const mysql = require('mysql2/promise');
const env = require('./env');

const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  connectionLimit: 10,
  namedPlaceholders: true,
  dateStrings: false
});

const transientDbErrors = new Set([
  'ECONNRESET',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'ECONNREFUSED',
  'PROTOCOL_CONNECTION_LOST'
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientDbError(error) {
  return transientDbErrors.has(error?.code) || /timeout|temporar|socket|network|dns/i.test(error?.message || '');
}

function withRetry(methodName) {
  const original = pool[methodName].bind(pool);
  return async (...args) => {
    const delays = [250, 750, 1500];
    let lastError;

    for (let attempt = 0; attempt <= delays.length; attempt += 1) {
      try {
        return await original(...args);
      } catch (error) {
        lastError = error;
        if (!isTransientDbError(error) || attempt === delays.length) break;
        console.warn(`[db] ${methodName} falló por red (${error.code || error.message}). Reintento ${attempt + 1}/${delays.length}.`);
        await wait(delays[attempt]);
      }
    }

    throw lastError;
  };
}

pool.query = withRetry('query');
pool.execute = withRetry('execute');

module.exports = pool;
