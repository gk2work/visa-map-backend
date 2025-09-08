const express = require('express');
const { body, param } = require('express-validator');
const authController = require('../controllers/authController');
const { authenticate, refreshToken, authRateLimit } = require('../middleware/auth');
const { handleValidationErrors } = require('../middleware/validation');

const router = express.Router();

// Validation middleware
const registerValidation = [
  body('firstName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('First name must be between 2 and 50 characters'),
  body('lastName')
    .trim()
    .isLength({ min: 2, max: 50 })
    .withMessage('Last name must be between 2 and 50 characters'),
  body('email')
    .isEmail()
    .normalizeEmail()
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
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

const loginValidation = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  body('password')
    .notEmpty()
    .withMessage('Password is required'),
];

const otpValidation = [
  body('otp')
    .matches(/^\d{6}$/)
    .withMessage('OTP must be exactly 6 digits'),
];

const passwordValidation = [
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

const changePasswordValidation = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number'),
];

// Public routes (no authentication required)

/**
 * @route   POST /api/v1/auth/register
 * @desc    Register a new user
 * @access  Public
 */
router.post('/register', 
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  registerValidation,
  handleValidationErrors,
  authController.register
);

/**
 * @route   POST /api/v1/auth/login
 * @desc    Login user
 * @access  Public
 */
router.post('/login',
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  loginValidation,
  handleValidationErrors,
  authController.login
);

/**
 * @route   POST /api/v1/auth/refresh-token
 * @desc    Refresh access token using refresh token
 * @access  Public
 */
router.post('/refresh-token',
  authRateLimit(10, 15 * 60 * 1000), // 10 attempts per 15 minutes
  refreshToken
);

/**
 * @route   GET /api/v1/auth/verify-email/:token
 * @desc    Verify email address
 * @access  Public
 */
router.get('/verify-email/:token',
  param('token')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid verification token'),
  handleValidationErrors,
  authController.verifyEmail
);

/**
 * @route   POST /api/v1/auth/forgot-password
 * @desc    Send password reset email
 * @access  Public
 */
router.post('/forgot-password',
  authRateLimit(3, 15 * 60 * 1000), // 3 attempts per 15 minutes
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),
  handleValidationErrors,
  authController.forgotPassword
);

/**
 * @route   POST /api/v1/auth/reset-password/:token
 * @desc    Reset password using reset token
 * @access  Public
 */
router.post('/reset-password/:token',
  param('token')
    .isLength({ min: 32, max: 128 })
    .withMessage('Invalid reset token'),
  passwordValidation,
  handleValidationErrors,
  authController.resetPassword
);

// Protected routes (authentication required)

/**
 * @route   POST /api/v1/auth/logout
 * @desc    Logout user
 * @access  Private
 */
router.post('/logout',
  authenticate,
  authController.logout
);

/**
 * @route   GET /api/v1/auth/profile
 * @desc    Get current user profile
 * @access  Private
 */
router.get('/profile',
  authenticate,
  authController.getProfile
);

/**
 * @route   POST /api/v1/auth/send-email-verification
 * @desc    Send email verification
 * @access  Private
 */
router.post('/send-email-verification',
  authenticate,
  authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.sendEmailVerification
);

/**
 * @route   POST /api/v1/auth/send-mobile-otp
 * @desc    Send mobile OTP
 * @access  Private
 */
router.post('/send-mobile-otp',
  authenticate,
  authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
  authController.sendMobileOTP
);

/**
 * @route   POST /api/v1/auth/verify-mobile-otp
 * @desc    Verify mobile OTP
 * @access  Private
 */
router.post('/verify-mobile-otp',
  authenticate,
  authRateLimit(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  otpValidation,
  handleValidationErrors,
  authController.verifyMobileOTP
);

/**
 * @route   POST /api/v1/auth/change-password
 * @desc    Change password for authenticated user
 * @access  Private
 */
router.post('/change-password',
  authenticate,
  authRateLimit(5, 60 * 60 * 1000), // 5 attempts per hour
  changePasswordValidation,
  handleValidationErrors,
  authController.changePassword
);

// Test route for development
if (process.env.NODE_ENV === 'development') {
  /**
   * @route   GET /api/v1/auth/test
   * @desc    Test route for development
   * @access  Public
   */
  router.get('/test', (req, res) => {
    res.json({ 
      message: 'Auth routes working',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV 
    });
  });
}

module.exports = router;