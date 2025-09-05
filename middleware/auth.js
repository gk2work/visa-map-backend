const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError, catchAsync } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Generate JWT Access Token
 */
const generateAccessToken = (userId) => {
  return jwt.sign(
    { userId, type: 'access' },
    process.env.JWT_SECRET,
    { 
      expiresIn: process.env.JWT_EXPIRE || '24h',
      issuer: 'visamap-api'
    }
  );
};

/**
 * Generate JWT Refresh Token
 */
const generateRefreshToken = (userId) => {
  return jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { 
      expiresIn: process.env.JWT_REFRESH_EXPIRE || '7d',
      issuer: 'visamap-api'
    }
  );
};

/**
 * Generate both access and refresh tokens
 */
const generateTokens = (userId) => {
  const accessToken = generateAccessToken(userId);
  const refreshToken = generateRefreshToken(userId);
  
  return {
    accessToken,
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: process.env.JWT_EXPIRE || '24h'
  };
};

/**
 * Verify JWT Token
 */
const verifyToken = (token, secret) => {
  try {
    return jwt.verify(token, secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired', 401);
    } else if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token', 401);
    } else {
      throw new AppError('Token verification failed', 401);
    }
  }
};

/**
 * Extract token from Authorization header
 */
const extractTokenFromHeader = (authorizationHeader) => {
  if (!authorizationHeader) {
    return null;
  }

  const parts = authorizationHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Main authentication middleware
 */
const authenticate = catchAsync(async (req, res, next) => {
  // 1) Get token from header
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    return next(new AppError('Access token is required', 401));
  }

  // 2) Verify token
  const decoded = verifyToken(token, process.env.JWT_SECRET);
  
  // 3) Check if token type is access
  if (decoded.type !== 'access') {
    return next(new AppError('Invalid token type', 401));
  }

  // 4) Check if user still exists
  const user = await User.findById(decoded.userId).select('+status');
  
  if (!user) {
    return next(new AppError('User no longer exists', 401));
  }

  // 5) Check if user account is active
  if (user.status !== 'active') {
    return next(new AppError('Account is not active', 403));
  }

  // 6) Check if user account is locked
  if (user.isLocked) {
    return next(new AppError('Account is temporarily locked', 423));
  }

  // 7) Grant access to protected route
  req.user = user;
  req.userId = user._id;
  
  // Log the authenticated request
  logger.logAPI('Authenticated Request', user._id, {
    method: req.method,
    path: req.originalUrl,
    ip: req.ip
  });

  next();
});

/**
 * Optional authentication middleware (doesn't throw error if no token)
 */
const authenticateOptional = catchAsync(async (req, res, next) => {
  const token = extractTokenFromHeader(req.headers.authorization);
  
  if (!token) {
    return next();
  }

  try {
    const decoded = verifyToken(token, process.env.JWT_SECRET);
    
    if (decoded.type === 'access') {
      const user = await User.findById(decoded.userId).select('+status');
      
      if (user && user.status === 'active' && !user.isLocked) {
        req.user = user;
        req.userId = user._id;
      }
    }
  } catch (error) {
    // Silently ignore token errors in optional authentication
    logger.logAPI('Optional Auth Token Error', null, { error: error.message });
  }

  next();
});

/**
 * Authorization middleware - check user roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required', 401));
    }

    if (!roles.includes(req.user.role)) {
      return next(new AppError('Access denied. Insufficient permissions', 403));
    }

    next();
  };
};

/**
 * Refresh token middleware
 */
const refreshToken = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return next(new AppError('Refresh token is required', 400));
  }

  // Verify refresh token
  const decoded = verifyToken(refreshToken, process.env.JWT_REFRESH_SECRET);
  
  if (decoded.type !== 'refresh') {
    return next(new AppError('Invalid token type', 401));
  }

  // Check if user exists
  const user = await User.findById(decoded.userId).select('+status');
  
  if (!user) {
    return next(new AppError('User no longer exists', 401));
  }

  if (user.status !== 'active') {
    return next(new AppError('Account is not active', 403));
  }

  // Generate new tokens
  const tokens = generateTokens(user._id);
  
  // Update last login
  user.lastLogin = new Date();
  user.metadata.lastLoginIP = req.ip;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({
    status: 'success',
    message: 'Tokens refreshed successfully',
    data: {
      user: user.toJSON(),
      ...tokens
    }
  });
});

/**
 * Account verification middleware
 */
const requireEmailVerification = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!req.user.isEmailVerified) {
    return next(new AppError('Email verification required', 403));
  }

  next();
};

const requireMobileVerification = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required', 401));
  }

  if (!req.user.isMobileVerified) {
    return next(new AppError('Mobile verification required', 403));
  }

  next();
};

/**
 * Rate limiting middleware for authentication endpoints
 */
const authRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();

  return (req, res, next) => {
    const key = req.ip + (req.body.email || '');
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old attempts
    for (const [attemptKey, attempt] of attempts.entries()) {
      if (attempt.timestamp < windowStart) {
        attempts.delete(attemptKey);
      }
    }

    // Check current attempts
    const currentAttempts = attempts.get(key) || { count: 0, timestamp: now };

    if (currentAttempts.count >= maxAttempts && currentAttempts.timestamp > windowStart) {
      return next(new AppError(`Too many authentication attempts. Try again in ${Math.ceil(windowMs / 60000)} minutes`, 429));
    }

    // Update attempts count
    if (currentAttempts.timestamp < windowStart) {
      attempts.set(key, { count: 1, timestamp: now });
    } else {
      attempts.set(key, { count: currentAttempts.count + 1, timestamp: currentAttempts.timestamp });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authenticateOptional,
  authorize,
  refreshToken,
  requireEmailVerification,
  requireMobileVerification,
  authRateLimit,
  generateTokens,
  generateAccessToken,
  generateRefreshToken,
  verifyToken
};