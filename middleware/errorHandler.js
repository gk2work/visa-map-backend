const logger = require('../utils/logger');

/**
 * Custom error class for application-specific errors
 */
class AppError extends Error {
  constructor(message, statusCode, isOperational = true, validationErrors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.validationErrors = validationErrors;

    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Handle MongoDB CastError (Invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handle MongoDB Duplicate Key Error
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists. Please use a different value.`;
  return new AppError(message, 400);
};

/**
 * Handle MongoDB Validation Error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT Invalid Token Error
 */
const handleJWTError = () => {
  return new AppError('Invalid token. Please log in again.', 401);
};

/**
 * Handle JWT Expired Token Error
 */
const handleJWTExpiredError = () => {
  return new AppError('Your token has expired. Please log in again.', 401);
};

/**
 * Handle Joi Validation Error
 */
const handleJoiValidationError = (err) => {
  const errors = err.details.map(detail => detail.message);
  const message = `Validation error: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle Multer File Upload Error
 */
const handleMulterError = (err) => {
  let message = 'File upload error';
  
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      message = 'File too large. Maximum size allowed is ' + 
        Math.round(err.limit / 1024 / 1024) + 'MB';
      break;
    case 'LIMIT_FILE_COUNT':
      message = `Too many files. Maximum ${err.limit} files allowed`;
      break;
    case 'LIMIT_UNEXPECTED_FILE':
      message = `Unexpected field: ${err.field}`;
      break;
    default:
      message = err.message || 'File upload failed';
  }
  
  return new AppError(message, 400);
};

/**
 * Send error response in development mode
 */
const sendErrorDev = (err, req, res) => {
  // Log the full error in development
  logger.logError(err, req, 'Development Error');

  // Build response object
  const response = {
    status: err.status,
    error: err,
    message: err.message,
    stack: err.stack,
    timestamp: new Date().toISOString(),
    path: req.originalUrl,
    method: req.method
  };

  // Include validation errors if present
  if (err.validationErrors) {
    response.validationErrors = err.validationErrors;
  }

  // API Error
  if (req.originalUrl.startsWith('/api')) {
    return res.status(err.statusCode).json(response);
  }

  // Rendered website error (if you have views)
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    title: 'Something went wrong!',
    message: err.message
  });
};

/**
 * Send error response in production mode
 */
const sendErrorProd = (err, req, res) => {
  // API Error
  if (req.originalUrl.startsWith('/api')) {
    // Operational, trusted error: send message to client
    if (err.isOperational) {
      const response = {
        status: err.status,
        message: err.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl
      };

      // Include validation errors for operational errors
      if (err.validationErrors) {
        response.validationErrors = err.validationErrors;
      }

      return res.status(err.statusCode).json(response);
    }

    // Programming or other unknown error: don't leak error details
    logger.logError(err, req, 'Production Error - Unknown');
    
    return res.status(500).json({
      status: 'error',
      message: 'Something went wrong!',
      timestamp: new Date().toISOString(),
      path: req.originalUrl
    });
  }

  // Rendered website error (if you have views)
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      title: 'Something went wrong!',
      message: err.message
    });
  }

  // Programming or other unknown error: don't leak error details
  console.error('ERROR 💥', err);
  return res.status(err.statusCode).json({
    title: 'Something went wrong!',
    message: 'Please try again later.'
  });
};

/**
 * Global error handling middleware
 */
module.exports = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  if (process.env.NODE_ENV === 'development') {
    sendErrorDev(err, req, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.isJoi) error = handleJoiValidationError(error);
    if (error.name === 'MulterError') error = handleMulterError(error);

    sendErrorProd(error, req, res);
  }
};

/**
 * Async error wrapper to catch async errors
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

/**
 * Handle 404 errors for undefined routes
 */
const handleNotFound = (req, res, next) => {
  const err = new AppError(`Can't find ${req.originalUrl} on this server!`, 404);
  next(err);
};

module.exports.AppError = AppError;
module.exports.catchAsync = catchAsync;
module.exports.handleNotFound = handleNotFound;