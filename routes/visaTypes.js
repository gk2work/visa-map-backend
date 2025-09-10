const express = require('express');
const { body, param, query } = require('express-validator');
const visaController = require('../controllers/visaController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidationErrors, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   GET /api/v1/visa-types/route/:origin/:destination
 * @desc    Get visa types for a specific route
 * @access  Public
 */
router.get('/route/:origin/:destination',
  param('origin').matches(/^[A-Z]{2}$/i).withMessage('Origin must be a 2-letter country code'),
  param('destination').matches(/^[A-Z]{2}$/i).withMessage('Destination must be a 2-letter country code'),
  query('category').optional().isIn(['student', 'visitor', 'worker', 'business', 'family', 'transit']).withMessage('Invalid category'),
  query('userType').optional().isIn(['student', 'visitor', 'worker']).withMessage('Invalid user type'),
  handleValidationErrors,
  visaController.getVisaTypesByRoute
);

/**
 * @route   GET /api/v1/visa-types/category/:category
 * @desc    Get visa types by category
 * @access  Public
 */
router.get('/category/:category',
  param('category').isIn(['student', 'visitor', 'worker', 'business', 'family', 'transit']).withMessage('Invalid category'),
  query('destination').optional().matches(/^[A-Z]{2}$/i).withMessage('Destination must be a 2-letter country code'),
  handleValidationErrors,
  visaController.getVisaTypesByCategory
);

/**
 * @route   GET /api/v1/visa-types/popular
 * @desc    Get popular visa types
 * @access  Public
 */
router.get('/popular',
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  handleValidationErrors,
  visaController.getPopularVisaTypes
);

/**
 * @route   GET /api/v1/visa-types/search
 * @desc    Search visa types
 * @access  Public
 */
router.get('/search',
  query('q').isLength({ min: 2, max: 100 }).withMessage('Search query must be between 2 and 100 characters'),
  query('origin').optional().matches(/^[A-Z]{2}$/i).withMessage('Origin must be a 2-letter country code'),
  query('destination').optional().matches(/^[A-Z]{2}$/i).withMessage('Destination must be a 2-letter country code'),
  query('category').optional().isIn(['student', 'visitor', 'worker', 'business', 'family', 'transit']).withMessage('Invalid category'),
  handleValidationErrors,
  visaController.searchVisaTypes
);

/**
 * @route   GET /api/v1/visa-types/stats
 * @desc    Get visa type statistics
 * @access  Public
 */
router.get('/stats', visaController.getVisaStats);

/**
 * @route   GET /api/v1/visa-types/:id
 * @desc    Get single visa type by ID
 * @access  Public
 */
router.get('/:id',
  validateObjectId('id'),
  query('personalization').optional().custom((value) => {
    try {
      JSON.parse(value);
      return true;
    } catch (error) {
      throw new Error('Personalization must be valid JSON');
    }
  }),
  handleValidationErrors,
  visaController.getVisaTypeById
);

/**
 * @route   POST /api/v1/visa-types/:id/requirements
 * @desc    Get personalized visa requirements
 * @access  Public
 */
router.post('/:id/requirements',
  validateObjectId('id'),
  body().optional().isObject().withMessage('Request body must be an object'),
  handleValidationErrors,
  visaController.getVisaRequirements
);

/**
 * @route   POST /api/v1/visa-types/:id/checklist
 * @desc    Get personalized visa checklist
 * @access  Public
 */
router.post('/:id/checklist',
  validateObjectId('id'),
  body().optional().isObject().withMessage('Request body must be an object'),
  handleValidationErrors,
  visaController.getVisaChecklist
);

// Protected routes (admin only)

const visaTypeValidation = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Visa name must be between 2 and 100 characters'),
  body('code')
    .matches(/^[A-Z0-9_-]+$/)
    .withMessage('Visa code can only contain uppercase letters, numbers, underscore and dash'),
  body('category')
    .isIn(['student', 'visitor', 'worker', 'business', 'family', 'transit'])
    .withMessage('Invalid visa category'),
  body('originCountry')
    .matches(/^[A-Z]{2}$/)
    .withMessage('Origin country must be a 2-letter country code'),
  body('destinationCountry')
    .matches(/^[A-Z]{2}$/)
    .withMessage('Destination country must be a 2-letter country code'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 500 })
    .withMessage('Description must be between 10 and 500 characters'),
  body('overview')
    .trim()
    .isLength({ min: 50, max: 2000 })
    .withMessage('Overview must be between 50 and 2000 characters'),
  body('eligibility')
    .isArray({ min: 1 })
    .withMessage('Eligibility must be an array with at least one item'),
  body('eligibility.*')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Each eligibility criterion must be between 5 and 200 characters'),
  body('processingTime.min')
    .isInt({ min: 1 })
    .withMessage('Minimum processing time must be at least 1'),
  body('processingTime.max')
    .isInt({ min: 1 })
    .withMessage('Maximum processing time must be at least 1'),
  body('processingTime.unit')
    .isIn(['days', 'weeks', 'months'])
    .withMessage('Processing time unit must be days, weeks, or months'),
  body('fees.visaFee.amount')
    .isNumeric({ min: 0 })
    .withMessage('Visa fee amount must be a non-negative number'),
  body('fees.visaFee.currency')
    .matches(/^[A-Z]{3}$/)
    .withMessage('Currency must be a 3-letter code'),
  body('requirements.documents')
    .isArray()
    .withMessage('Documents must be an array'),
  body('applicationProcess.steps')
    .isArray({ min: 1 })
    .withMessage('Application process must have at least one step'),
  body('applicationProcess.applicationMethod')
    .isIn(['online', 'paper', 'biometric_center', 'embassy'])
    .withMessage('Invalid application method'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'suspended', 'coming_soon'])
    .withMessage('Invalid status'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
];

/**
 * @route   POST /api/v1/visa-types
 * @desc    Create new visa type
 * @access  Private/Admin
 */
router.post('/',
  authenticate,
  authorize('admin'),
  visaTypeValidation,
  handleValidationErrors,
  visaController.createVisaType
);

/**
 * @route   PUT /api/v1/visa-types/:id
 * @desc    Update visa type
 * @access  Private/Admin
 */
router.put('/:id',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  // Make all fields optional for updates
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Visa name must be between 2 and 100 characters'),
  body('code').optional().matches(/^[A-Z0-9_-]+$/).withMessage('Visa code can only contain uppercase letters, numbers, underscore and dash'),
  body('category').optional().isIn(['student', 'visitor', 'worker', 'business', 'family', 'transit']).withMessage('Invalid visa category'),
  body('originCountry').optional().matches(/^[A-Z]{2}$/).withMessage('Origin country must be a 2-letter country code'),
  body('destinationCountry').optional().matches(/^[A-Z]{2}$/).withMessage('Destination country must be a 2-letter country code'),
  body('description').optional().trim().isLength({ min: 10, max: 500 }).withMessage('Description must be between 10 and 500 characters'),
  body('overview').optional().trim().isLength({ min: 50, max: 2000 }).withMessage('Overview must be between 50 and 2000 characters'),
  body('processingTime.min').optional().isInt({ min: 1 }).withMessage('Minimum processing time must be at least 1'),
  body('processingTime.max').optional().isInt({ min: 1 }).withMessage('Maximum processing time must be at least 1'),
  body('processingTime.unit').optional().isIn(['days', 'weeks', 'months']).withMessage('Processing time unit must be days, weeks, or months'),
  body('fees.visaFee.amount').optional().isNumeric({ min: 0 }).withMessage('Visa fee amount must be a non-negative number'),
  body('fees.visaFee.currency').optional().matches(/^[A-Z]{3}$/).withMessage('Currency must be a 3-letter code'),
  body('applicationProcess.applicationMethod').optional().isIn(['online', 'paper', 'biometric_center', 'embassy']).withMessage('Invalid application method'),
  body('status').optional().isIn(['active', 'inactive', 'suspended', 'coming_soon']).withMessage('Invalid status'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
  handleValidationErrors,
  visaController.updateVisaType
);

/**
 * @route   DELETE /api/v1/visa-types/:id
 * @desc    Delete visa type (soft delete)
 * @access  Private/Admin
 */
router.delete('/:id',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  visaController.deleteVisaType
);

// Development test routes
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/v1/visa-types/test
   * @desc    Test route for development
   * @access  Public
   */
  router.get('/test', (req, res) => {
    res.json({ 
      message: 'Visa type routes working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    });
  });
}

module.exports = router;