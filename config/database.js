const mongoose = require('mongoose');
const logger = require('../utils/logger');

// MongoDB connection options
const options = {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  maxPoolSize: 10, // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000, // Keep trying to send operations for 5 seconds
  socketTimeoutMS: 45000, // Close sockets after 45 seconds of inactivity
  family: 4 // Use IPv4, skip trying IPv6
};

// Connection state tracking
let isConnected = false;

/**
 * Connect to MongoDB database
 */
const connectDB = async () => {
  try {
    // Prevent multiple connections
    if (isConnected) {
      logger.info('📊 Already connected to MongoDB');
      return;
    }

    // Get MongoDB URI from environment variables
    const mongoURI = process.env.MONGODB_URI;
    
    if (!mongoURI) {
      throw new Error('MONGODB_URI environment variable is not defined');
    }

    logger.info('🔄 Connecting to MongoDB...');

    // Connect to MongoDB
    await mongoose.connect(mongoURI, options);
    
    isConnected = true;
    logger.info('✅ Connected to MongoDB successfully');
    
    // Log database name
    const dbName = mongoose.connection.db.databaseName;
    logger.info(`📊 Database: ${dbName}`);

  } catch (error) {
    logger.error('❌ MongoDB connection failed:');
    logger.error('Error message:', error.message);
    logger.error('Error code:', error.code);
    logger.error('Full error:', error);
    
    // Exit process with failure
    process.exit(1);
  }
};

/**
 * Disconnect from MongoDB database
 */
const disconnectDB = async () => {
  try {
    if (!isConnected) {
      return;
    }

    await mongoose.connection.close();
    isConnected = false;
    logger.info('🔌 Disconnected from MongoDB');
  } catch (error) {
    logger.error('❌ MongoDB disconnection failed:', error.message);
  }
};

/**
 * Get connection status
 */
const getConnectionStatus = () => {
  const states = {
    0: 'Disconnected',
    1: 'Connected',
    2: 'Connecting',
    3: 'Disconnecting'
  };
  
  return {
    status: states[mongoose.connection.readyState],
    isConnected: mongoose.connection.readyState === 1
  };
};

// Connection event listeners
mongoose.connection.on('connected', () => {
  isConnected = true;
  logger.info('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
  isConnected = false;
  logger.error('❌ Mongoose connection error:', err);
});

mongoose.connection.on('disconnected', () => {
  isConnected = false;
  logger.info('🔌 Mongoose disconnected from MongoDB');
});

// Handle application termination
process.on('SIGINT', async () => {
  await disconnectDB();
  logger.info('👋 MongoDB connection closed due to app termination');
  process.exit(0);
});

// Reconnection logic for production
if (process.env.NODE_ENV === 'production') {
  mongoose.connection.on('disconnected', () => {
    logger.warn('🔄 MongoDB disconnected. Attempting to reconnect...');
    setTimeout(() => {
      connectDB();
    }, 5000);
  });
}

module.exports = {
  connectDB,
  disconnectDB,
  getConnectionStatus
};