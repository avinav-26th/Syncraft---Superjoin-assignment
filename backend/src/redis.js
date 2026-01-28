// backend/src/redis.js
const { Redis } = require('@upstash/redis');
require('dotenv').config();

// Initialize the client using the variables from .env
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// Test the connection immediately
redis.get('test_connection').then(() => {
    console.log('✅ Connected to Upstash Redis (HTTP)');
}).catch((err) => {
    console.error('❌ Redis Connection Failed:', err);
});

module.exports = redis;