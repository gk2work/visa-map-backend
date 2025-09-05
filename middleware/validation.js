const { body, param, query, validationResult } = require('express-validator');
const { AppError } = require('./errorHandler');

/**
 * Handle validation errors from express-validator
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map(error => ({
      field: error.path || error.param,
      message: error.msg,
      value: error.value
    }));

    return next(new AppError('Validation failed', 400, true, errorMessages));
  }
  
  next();
};

/**
 * Middleware to validate request and handle errors
 */
const validateRequest = (validations) => {
  return async (req, res, next) => {
    // Run all validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    handleValidationErrors(req, res, next);
  };
};

/**
 * Sanitize request body by removing undefined and null values
 */
const sanitizeBody = (req, res, next) => {
  if (req.body && typeof req.body === 'object') {
    Object.keys(req.body).forEach(key => {
      if (req.body[key] === undefined || req.body[key] === null) {
        delete req.body[key];
      }
      
      // Trim strings
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
        
        // Remove empty strings
        if (req.body[key] === '') {
          delete req.body[key];
        }
      }
    });
  }
  
  next();
};

/**
 * Validate ObjectId format
 */
const validateObjectId = (paramName = 'id') => {
  return (req, res, next) => {
    const id = req.params[paramName];
    const objectIdRegex = /^[0-9a-fA-F]{24}$/;
    
    if (!objectIdRegex.test(id)) {
      return next(new AppError(`Invalid ${paramName} format`, 400));
    }
    
    next();
  };
};

/**
 * Validate pagination parameters
 */
const validatePagination = (req, res, next) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const maxLimit = 100;
  
  if (page < 1) {
    return next(new AppError('Page must be greater than 0', 400));
  }
  
  if (limit < 1) {
    return next(new AppError('Limit must be greater than 0', 400));
  }
  
  if (limit > maxLimit) {
    return next(new AppError(`Limit cannot exceed ${maxLimit}`, 400));
  }
  
  req.pagination = {
    page,
    limit,
    skip: (page - 1) * limit
  };
  
  next();
};

/**
 * Validate sort parameters
 */
const validateSort = (allowedFields = []) => {
  return (req, res, next) => {
    const { sort } = req.query;
    
    if (!sort) {
      req.sort = { createdAt: -1 }; // Default sort
      return next();
    }
    
    const sortObj = {};
    const sortFields = sort.split(',');
    
    for (const field of sortFields) {
      let sortField = field.trim();
      let sortOrder = 1;
      
      if (sortField.startsWith('-')) {
        sortOrder = -1;
        sortField = sortField.substring(1);
      }
      
      if (allowedFields.length > 0 && !allowedFields.includes(sortField)) {
        return next(new AppError(`Sort field '${sortField}' is not allowed`, 400));
      }
      
      sortObj[sortField] = sortOrder;
    }
    
    req.sort = sortObj;
    next();
  };
};

/**
 * Validate search parameters
 */
const validateSearch = (req, res, next) => {
  const { search } = req.query;
  
  if (search) {
    if (typeof search !== 'string') {
      return next(new AppError('Search query must be a string', 400));
    }
    
    if (search.length < 2) {
      return next(new AppError('Search query must be at least 2 characters', 400));
    }
    
    if (search.length > 100) {
      return next(new AppError('Search query cannot exceed 100 characters', 400));
    }
    
    req.search = search.trim();
  }
  
  next();
};

/**
 * Validate file upload
 */
const validateFileUpload = (options = {}) => {
  const {
    allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'],
    maxSize = 10 * 1024 * 1024, // 10MB
    required = false
  } = options;
  
  return (req, res, next) => {
    const file = req.file;
    
    if (!file) {
      if (required) {
        return next(new AppError('File is required', 400));
      }
      return next();
    }
    
    // Check file type
    if (!allowedTypes.includes(file.mimetype)) {
      return next(new AppError(`File type ${file.mimetype} is not allowed`, 400));
    }
    
    // Check file size
    if (file.size > maxSize) {
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      return next(new AppError(`File size cannot exceed ${maxSizeMB}MB`, 400));
    }
    
    next();
  };
};

/**
 * Validate query filters
 */
const validateFilters = (allowedFilters = []) => {
  return (req, res, next) => {
    const filters = {};
    
    for (const [key, value] of Object.entries(req.query)) {
      // Skip pagination, sort, and search parameters
      if (['page', 'limit', 'sort', 'search'].includes(key)) {
        continue;
      }
      
      if (allowedFilters.length > 0 && !allowedFilters.includes(key)) {
        return next(new AppError(`Filter '${key}' is not allowed`, 400));
      }
      
      filters[key] = value;
    }
    
    req.filters = filters;
    next();
  };
};

// User validation schemas
const userValidation = {
  register: [
    body('firstName')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('mobile')
      .matches(/^[0-9]{7,15}$/)
      .withMessage('Please provide a valid mobile number (7-15 digits)'),
    body('dialingCode')
      .matches(/^\+\d{1,4}$/)
      .withMessage('Please provide a valid dialing code (e.g., +91)'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],
  
  updateProfile: [
    body('firstName')
      .optional()
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .optional()
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('mobile')
      .optional()
      .matches(/^[0-9]{7,15}$/)
      .withMessage('Please provide a valid mobile number (7-15 digits)')
  ]
};

// Authentication validation schemas
const authValidation = {
  login: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('password')
      .isLength({ min: 1 })
      .withMessage('Password is required')
  ],
  
  forgotPassword: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email')
  ],
  
  resetPassword: [
    body('token')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],
  
  changePassword: [
    body('currentPassword')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Current password is required'),
    body('newPassword')
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
  ],
  
  verifyEmail: [
    body('token')
      .isString()
      .isLength({ min: 1 })
      .withMessage('Verification token is required')
  ],
  
  verifyMobile: [
    body('otp')
      .isString()
      .isLength({ min: 4, max: 8 })
      .withMessage('OTP must be between 4 and 8 characters')
  ]
};

// Journey validation schemas
const journeyValidation = {
  createOrUpdate: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('originCountry')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Origin country must be a 2-letter country code'),
    body('destinationCountry')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Destination country must be a 2-letter country code'),
    body('userType')
      .optional()
      .isIn(['student', 'visitor', 'worker', 'family', 'business', 'other'])
      .withMessage('Invalid user type'),
    body('visaType')
      .optional()
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Visa type must be between 1 and 100 characters'),
    body('personalizationData.hasCAS')
      .optional()
      .isBoolean()
      .withMessage('hasCAS must be a boolean'),
    body('personalizationData.casDate')
      .optional()
      .matches(/^\d{2}\/\d{2}\/\d{4}$/)
      .withMessage('CAS date must be in DD/MM/YYYY format'),
    body('personalizationData.hasATAS')
      .optional()
      .isBoolean()
      .withMessage('hasATAS must be a boolean'),
    body('personalizationData.studyLocation')
      .optional()
      .isIn(['london', 'outside_london', ''])
      .withMessage('Study location must be london, outside_london, or empty')
  ],
  
  updateStep: [
    param('stepId')
      .isString()
      .isLength({ min: 1, max: 100 })
      .withMessage('Step ID is required'),
    body('completed')
      .isBoolean()
      .withMessage('Completed status must be a boolean')
  ],
  
  updateChecklist: [
    body('checklist')
      .isObject()
      .withMessage('Checklist must be an object')
  ],
  
  updatePersonalization: [
    body('personalizationData')
      .isObject()
      .withMessage('Personalization data must be an object'),
    body('personalizationData.hasCAS')
      .optional()
      .isBoolean()
      .withMessage('hasCAS must be a boolean'),
    body('personalizationData.casDate')
      .optional()
      .matches(/^\d{2}\/\d{2}\/\d{4}$/)
      .withMessage('CAS date must be in DD/MM/YYYY format')
  ],
  
  shareJourney: [
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('permissions')
      .optional()
      .isIn(['view', 'comment', 'edit'])
      .withMessage('Permissions must be view, comment, or edit')
  ],
  
  addNote: [
    body('content')
      .isString()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Note content must be between 1 and 1000 characters')
  ]
};

// Contact validation schemas
const contactValidation = {
  submitForm: [
    body('firstName')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('First name must be between 2 and 50 characters'),
    body('lastName')
      .isString()
      .isLength({ min: 2, max: 50 })
      .withMessage('Last name must be between 2 and 50 characters'),
    body('email')
      .isEmail()
      .withMessage('Please provide a valid email'),
    body('mobile')
      .matches(/^[0-9]{7,15}$/)
      .withMessage('Please provide a valid mobile number (7-15 digits)'),
    body('dialingCode')
      .matches(/^\+\d{1,4}$/)
      .withMessage('Please provide a valid dialing code (e.g., +91)'),
    body('contactType')
      .optional()
      .isIn(['general_inquiry', 'visa_guidance', 'technical_support', 'partnership', 'feedback', 'complaint', 'other'])
      .withMessage('Invalid contact type'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority level'),
    body('subject')
      .isString()
      .isLength({ min: 5, max: 200 })
      .withMessage('Subject must be between 5 and 200 characters'),
    body('message')
      .isString()
      .isLength({ min: 10, max: 2000 })
      .withMessage('Message must be between 10 and 2000 characters'),
    body('visaContext.originCountry')
      .optional()
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Origin country must be a 2-letter country code'),
    body('visaContext.destinationCountry')
      .optional()
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Destination country must be a 2-letter country code')
  ],
  
  updateContact: [
    body('status')
      .optional()
      .isIn(['new', 'contacted', 'in_progress', 'resolved', 'closed', 'spam'])
      .withMessage('Invalid status'),
    body('priority')
      .optional()
      .isIn(['low', 'medium', 'high', 'urgent'])
      .withMessage('Invalid priority level'),
    body('assignedTo')
      .optional()
      .isMongoId()
      .withMessage('Invalid user ID')
  ],
  
  assignContact: [
    body('assignedTo')
      .isMongoId()
      .withMessage('Please provide a valid user ID')
  ],
  
  addResponse: [
    body('content')
      .isString()
      .isLength({ min: 1, max: 2000 })
      .withMessage('Response content must be between 1 and 2000 characters'),
    body('responseType')
      .optional()
      .isIn(['email', 'phone', 'sms', 'in_person', 'other'])
      .withMessage('Invalid response type'),
    body('isInternal')
      .optional()
      .isBoolean()
      .withMessage('isInternal must be a boolean')
  ],
  
  bulkUpdate: [
    body('contactIds')
      .isArray({ min: 1 })
      .withMessage('Contact IDs array is required'),
    body('contactIds.*')
      .isMongoId()
      .withMessage('Invalid contact ID'),
    body('updates')
      .isObject()
      .withMessage('Updates object is required')
  ]
};

// Country validation schemas
const countryValidation = {
  create: [
    body('code')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Country code must be a 2-letter code'),
    body('name')
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Country name must be between 2 and 100 characters'),
    body('flag')
      .isString()
      .isLength({ min: 1, max: 10 })
      .withMessage('Flag emoji is required'),
    body('dialingCode')
      .matches(/^\+\d{1,4}$/)
      .withMessage('Please provide a valid dialing code')
  ],
  
  update: [
    body('name')
      .optional()
      .isString()
      .isLength({ min: 2, max: 100 })
      .withMessage('Country name must be between 2 and 100 characters'),
    body('flag')
      .optional()
      .isString()
      .isLength({ min: 1, max: 10 })
      .withMessage('Flag emoji is required'),
    body('dialingCode')
      .optional()
      .matches(/^\+\d{1,4}$/)
      .withMessage('Please provide a valid dialing code')
  ]
};

// Visa type validation schemas
const visaValidation = {
  create: [
    body('title')
      .isString()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('originCountry')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Origin country must be a 2-letter country code'),
    body('destinationCountry')
      .isLength({ min: 2, max: 2 })
      .isAlpha()
      .withMessage('Destination country must be a 2-letter country code'),
    body('category')
      .isIn(['student', 'visitor', 'worker', 'family', 'business'])
      .withMessage('Invalid visa category'),
    body('fees.base')
      .isNumeric()
      .withMessage('Base fee must be a number')
  ],
  
  update: [
    body('title')
      .optional()
      .isString()
      .isLength({ min: 5, max: 200 })
      .withMessage('Title must be between 5 and 200 characters'),
    body('category')
      .optional()
      .isIn(['student', 'visitor', 'worker', 'family', 'business'])
      .withMessage('Invalid visa category'),
    body('fees.base')
      .optional()
      .isNumeric()
      .withMessage('Base fee must be a number')
  ]
};

module.exports = {
  handleValidationErrors,
  validateRequest,
  sanitizeBody,
  validateObjectId,
  validatePagination,
  validateSort,
  validateSearch,
  validateFileUpload,
  validateFilters,
  userValidation,
  authValidation,
  journeyValidation,
  contactValidation,
  countryValidation,
  visaValidation
};