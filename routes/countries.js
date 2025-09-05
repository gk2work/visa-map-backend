module.exports = require('express').Router();
const express = require('express');
const { body, param, query } = require('express-validator');
const countryController = require('../controllers/countryController');
const { authenticate, authorize } = require('../middleware/auth');
const { handleValidationErrors, validateObjectId } = require('../middleware/validation');

const router = express.Router();

// Public routes (no authentication required)

/**
 * @route   GET /api/v1/countries
 * @desc    Get all countries with optional filtering
 * @access  Public
 * @query   origin, destination, region, userType, status, sort
 */
router.get('/',
  query('origin').optional().isBoolean().withMessage('Origin must be true or false'),
  query('destination').optional().isBoolean().withMessage('Destination must be true or false'),
  query('region').optional().isIn(['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East']).withMessage('Invalid region'),
  query('userType').optional().isIn(['student', 'visitor', 'worker']).withMessage('Invalid user type'),
  query('status').optional().isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status'),
  handleValidationErrors,
  countryController.getAllCountries
);

/**
 * @route   GET /api/v1/countries/origins
 * @desc    Get all origin countries
 * @access  Public
 */
router.get('/origins', countryController.getOriginCountries);

/**
 * @route   GET /api/v1/countries/destinations
 * @desc    Get all destination countries
 * @access  Public
 */
router.get('/destinations', countryController.getDestinationCountries);

/**
 * @route   GET /api/v1/countries/regions/:region
 * @desc    Get countries by region
 * @access  Public
 */
router.get('/regions/:region',
  param('region').isIn(['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East']).withMessage('Invalid region'),
  handleValidationErrors,
  countryController.getCountriesByRegion
);

/**
 * @route   GET /api/v1/countries/route/:origin/:destination
 * @desc    Check if a route is supported
 * @access  Public
 */
router.get('/route/:origin/:destination',
  param('origin').matches(/^[A-Z]{2}$/i).withMessage('Origin must be a 2-letter country code'),
  param('destination').matches(/^[A-Z]{2}$/i).withMessage('Destination must be a 2-letter country code'),
  handleValidationErrors,
  countryController.checkRouteSupport
);

/**
 * @route   GET /api/v1/countries/stats
 * @desc    Get country statistics
 * @access  Public
 */
router.get('/stats', countryController.getCountryStats);

/**
 * @route   GET /api/v1/countries/:code
 * @desc    Get single country by code
 * @access  Public
 */
router.get('/:code',
  param('code').matches(/^[A-Z]{2}$/i).withMessage('Country code must be exactly 2 letters'),
  handleValidationErrors,
  countryController.getCountryByCode
);

// Protected routes (admin only)

const countryValidation = [
  body('code')
    .matches(/^[A-Z]{2}$/i)
    .withMessage('Country code must be exactly 2 letters'),
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Country name must be between 2 and 100 characters'),
  body('flag')
    .notEmpty()
    .withMessage('Flag emoji is required'),
  body('isOriginCountry')
    .optional()
    .isBoolean()
    .withMessage('isOriginCountry must be a boolean'),
  body('isDestinationCountry')
    .optional()
    .isBoolean()
    .withMessage('isDestinationCountry must be a boolean'),
  body('supportedUserTypes')
    .optional()
    .isArray()
    .withMessage('supportedUserTypes must be an array'),
  body('supportedUserTypes.*')
    .optional()
    .isIn(['student', 'visitor', 'worker'])
    .withMessage('Invalid user type'),
  body('dialingCode')
    .matches(/^\+\d{1,4}$/)
    .withMessage('Dialing code must be in format +XX or +XXX'),
  body('currency.code')
    .matches(/^[A-Z]{3}$/)
    .withMessage('Currency code must be 3 uppercase letters'),
  body('currency.symbol')
    .notEmpty()
    .withMessage('Currency symbol is required'),
  body('currency.name')
    .notEmpty()
    .withMessage('Currency name is required'),
  body('metadata.region')
    .isIn(['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East'])
    .withMessage('Invalid region'),
  body('status')
    .optional()
    .isIn(['active', 'inactive', 'maintenance'])
    .withMessage('Invalid status'),
  body('displayOrder')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Display order must be a non-negative integer')
];

/**
 * @route   POST /api/v1/countries
 * @desc    Create new country
 * @access  Private/Admin
 */
router.post('/',
  authenticate,
  authorize('admin'),
  countryValidation,
  handleValidationErrors,
  countryController.createCountry
);

/**
 * @route   PUT /api/v1/countries/:id
 * @desc    Update country
 * @access  Private/Admin
 */
router.put('/:id',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  // Make all fields optional for updates
  body('code').optional().matches(/^[A-Z]{2}$/i).withMessage('Country code must be exactly 2 letters'),
  body('name').optional().trim().isLength({ min: 2, max: 100 }).withMessage('Country name must be between 2 and 100 characters'),
  body('flag').optional().notEmpty().withMessage('Flag emoji cannot be empty'),
  body('isOriginCountry').optional().isBoolean().withMessage('isOriginCountry must be a boolean'),
  body('isDestinationCountry').optional().isBoolean().withMessage('isDestinationCountry must be a boolean'),
  body('supportedUserTypes').optional().isArray().withMessage('supportedUserTypes must be an array'),
  body('supportedUserTypes.*').optional().isIn(['student', 'visitor', 'worker']).withMessage('Invalid user type'),
  body('dialingCode').optional().matches(/^\+\d{1,4}$/).withMessage('Dialing code must be in format +XX or +XXX'),
  body('currency.code').optional().matches(/^[A-Z]{3}$/).withMessage('Currency code must be 3 uppercase letters'),
  body('currency.symbol').optional().notEmpty().withMessage('Currency symbol cannot be empty'),
  body('currency.name').optional().notEmpty().withMessage('Currency name cannot be empty'),
  body('metadata.region').optional().isIn(['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East']).withMessage('Invalid region'),
  body('status').optional().isIn(['active', 'inactive', 'maintenance']).withMessage('Invalid status'),
  body('displayOrder').optional().isInt({ min: 0 }).withMessage('Display order must be a non-negative integer'),
  handleValidationErrors,
  countryController.updateCountry
);

/**
 * @route   DELETE /api/v1/countries/:id
 * @desc    Delete country (soft delete)
 * @access  Private/Admin
 */
router.delete('/:id',
  authenticate,
  authorize('admin'),
  validateObjectId('id'),
  countryController.deleteCountry
);

// Development test routes
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/v1/countries/test
   * @desc    Test route for development
   * @access  Public
   */
  router.get('/test', (req, res) => {
    res.json({ 
      message: 'Country routes working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    });
  });
}

module.exports = router;