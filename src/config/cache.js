const redis = require('redis');

const PORT = process.env.PORT || 6379;

const client = redis.createClient(PORT);

module.exports = client;