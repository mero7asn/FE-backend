const mongoose = require('mongoose');

// Store connection in global to reuse across serverless invocations
const getCache = () => {
  if (!global.mongoose) {
    global.mongoose = { conn: null, promise: null };
  }
  return global.mongoose;
};

const connectDB = async () => {
  const cache = getCache();
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    throw new Error('MONGODB_URI environment variable is not configured');
  }
  
  if (cache.conn) {
    return cache.conn;
  }
  
  if (!cache.promise) {
    cache.promise = mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    }).then(conn => {
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return conn;
    });
  }
  
  try {
    cache.conn = await cache.promise;
  } catch (e) {
    cache.promise = null;
    throw e;
  }
  return cache.conn;
};

module.exports = connectDB;