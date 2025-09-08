const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// Import utilities
const logger = require('./utils/logger');
const { connectDB } = require('./config/database');

// Import middleware
const errorHandler = require('./middleware/errorHandler');

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const countryRoutes = require('./routes/countries');
const visaRoutes = require('./routes/visaTypes');
const journeyRoutes = require('./routes/journeys');
const contactRoutes = require('./routes/contact');
const adminRoutes = require('./routes/admin');

// Initialize Express app
const app = express();

// Trust proxy for rate limiting behind reverse proxy
app.set('trust proxy', 1);

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = process.env.CORS_ORIGIN 
      ? process.env.CORS_ORIGIN.split(',') 
      : ['http://localhost:5173', 'http://localhost:3000'];
    
    // Allow requests with no origin (mobile apps, postman, etc.)
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Apply rate limiting to API routes only
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ 
  limit: process.env.MAX_FILE_SIZE || '10mb',
  verify: (req, res, buf) => {
    try {
      JSON.parse(buf);
    } catch (e) {
      res.status(400).json({ error: 'Invalid JSON' });
      throw new Error('Invalid JSON');
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true, 
  limit: process.env.MAX_FILE_SIZE || '10mb' 
}));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { 
    stream: { 
      write: (message) => logger.info(message.trim()) 
    } 
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'VisaMap Backend is running',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    version: require('./package.json').version
  });
});

// API Routes
const apiVersion = process.env.API_VERSION || 'v1';
const apiBasePath = process.env.API_BASE_URL || '/api';

app.use(`${apiBasePath}/${apiVersion}/auth`, authRoutes);
app.use(`${apiBasePath}/${apiVersion}/users`, userRoutes);
app.use(`${apiBasePath}/${apiVersion}/countries`, countryRoutes);
app.use(`${apiBasePath}/${apiVersion}/visa-types`, visaRoutes);
app.use(`${apiBasePath}/${apiVersion}/journeys`, journeyRoutes);
app.use(`${apiBasePath}/${apiVersion}/contact`, contactRoutes);
app.use(`${apiBasePath}/${apiVersion}/admin`, adminRoutes);

// API Documentation (only in development)
if (process.env.ENABLE_API_DOCS === 'true' && process.env.NODE_ENV !== 'production') {
  const swaggerUi = require('swagger-ui-express');
  const swaggerSpec = require('./docs/swagger');
  
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'VisaMap API Documentation'
  }));
  
  logger.info('📚 API Documentation available at /api-docs');
}

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to VisaMap Backend API',
    version: require('./package.json').version,
    documentation: process.env.ENABLE_API_DOCS === 'true' ? '/api-docs' : 'Not available in production',
    health: '/health'
  });
});

// 404 handler for undefined routes
app.all('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `Cannot ${req.method} ${req.originalUrl}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler);

// Graceful shutdown handling
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Process terminated');
    mongoose.connection.close();
    process.exit(0);
  });
});

// Unhandled promise rejection handling
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
  server.close(() => {
    process.exit(1);
  });
});

// Uncaught exception handling
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start server function
const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    
    // Start server
    const PORT = process.env.PORT || 5002;
    const server = app.listen(PORT, () => {
      logger.info(`🚀 VisaMap Backend Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📊 Health check: http://localhost:${PORT}/health`);
      
      if (process.env.ENABLE_API_DOCS === 'true') {
        logger.info(`📚 API Docs: http://localhost:${PORT}/api-docs`);
      }
    });

    // Export server for graceful shutdown
    global.server = server;
    
    return server;
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
if (require.main === module) {
  startServer();
}

module.exports = app;