// backend/src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

// Create Redis client
let redisClient;
try {
  // Use Redis if available
  redisClient = redis.createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  });
  
  redisClient.on('error', (err) => {
    console.error('Redis error:', err);
  });
} catch (error) {
  console.warn('Redis not available, using memory store:', error.message);
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, 
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many requests. Please try again later.'
  },
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rate-limit:api:'
  }) : undefined
});

const verificationLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, 
  max: 20, 
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 429,
    error: 'Too many verification attempts. Please try again later.'
  },
  store: redisClient ? new RedisStore({
    client: redisClient,
    prefix: 'rate-limit:verify:'
  }) : undefined
});

module.exports = { apiLimiter, verificationLimiter };