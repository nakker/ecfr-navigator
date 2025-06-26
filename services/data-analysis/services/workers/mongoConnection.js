const mongoose = require('mongoose');

async function connectToMongoDB(mongoUri, workerName = 'worker') {
  try {
    // Set mongoose options for better connection handling
    mongoose.set('strictQuery', true);
    
    // Connect with proper options
    await mongoose.connect(mongoUri, {
      maxPoolSize: 5, // Smaller pool for workers
      serverSelectionTimeoutMS: 30000, // 30 seconds timeout
      socketTimeoutMS: 45000, // 45 seconds socket timeout
      bufferCommands: false, // Disable buffering to fail fast
      autoIndex: false, // Don't build indexes in workers
      heartbeatFrequencyMS: 10000, // Check connection every 10 seconds
    });

    console.log(`MongoDB connected successfully for ${workerName}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error(`MongoDB connection error in ${workerName}:`, err);
    });

    mongoose.connection.on('disconnected', () => {
      console.warn(`MongoDB disconnected in ${workerName}`);
    });

    mongoose.connection.on('reconnected', () => {
      console.log(`MongoDB reconnected in ${workerName}`);
    });

    return mongoose.connection;
  } catch (error) {
    console.error(`Failed to connect to MongoDB in ${workerName}:`, error);
    throw error;
  }
}

module.exports = { connectToMongoDB };