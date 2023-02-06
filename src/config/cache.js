const redis = require('redis');

const client = redis.createClient({
    url: process.env.REDIS_URL
});

client.on("error", function(err) {
    throw err;
});

module.exports = client;