const mongoose = require('mongoose');
const logger = require('../utils/logger');

let connection = null;

const connect = async (uri) => {
  if (connection) {
    return connection;
  }

  try {
    mongoose.set('strictQuery', true);
    
    connection = await mongoose.connect(uri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    logger.info('MongoDB connected successfully');

    mongoose.connection.on('error', (err) => {
      logger.error('MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected');
      connection = null;
    });

    return connection;
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw error;
  }
};

const disconnect = async () => {
  if (connection) {
    await mongoose.disconnect();
    connection = null;
    logger.info('MongoDB disconnected');
  }
};

const getConnection = () => {
  if (!connection) {
    throw new Error('MongoDB not connected. Call connect() first.');
  }
  return connection;
};

module.exports = {
  connect,
  disconnect,
  getConnection,
  mongoose
};