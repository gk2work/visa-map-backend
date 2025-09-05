const User = require('../models/User');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const { generateTokens } = require('../middleware/auth');
const emailService = require('../services/emailService');
const smsService = require('../services/smsService');
const logger = require('../utils/logger');
const crypto = require('crypto');

/**
 * Register a new user
 */
const register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, mobile, dialingCode, password } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({
    $or: [
      { email: email.toLowerCase() },
      { mobile: mobile, dialingCode: dialingCode }
    ]
  });

  if (existingUser) {
    if (existingUser.email === email.toLowerCase()) {
      return next(new AppError('Email already registered', 400));
    }
    if (existingUser.mobile === mobile && existingUser.dialingCode === dialingCode) {
      return next(new AppError('Mobile number already registered', 400));
    }
  }

  // Create new user
  const user = await User.create({
    firstName,
    lastName,
    email: email.toLowerCase(),
    mobile,
    dialingCode,
    password,
    metadata: {
      registrationIP: req.ip,
      userAgent: req.get('User-Agent'),
      referralSource: req.headers.referer || 'direct'
    }
  });

  // Generate email verification token
  const emailToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    await emailService.sendEmailVerification(user.email, user.firstName, emailToken);
    logger.logAPI('Email Verification Sent', user._id, { email: user.email });
  } catch (error) {
    logger.logError(error, req, 'Email Verification Failed');
    // Don't fail registration if email fails
  }

  // Generate tokens
  const tokens = generateTokens(user._id);

  logger.logAPI('User Registered', user._id, {
    email: user.email,
    mobile: `${user.dialingCode}${user.mobile}`
  });

  res.status(201).json({
    status: 'success',
    message: 'Registration successful. Please verify your email.',
    data: {
      user: user.toJSON(),
      ...tokens
    }
  });
});

/**
 * Login user
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password exist
  if (!email || !password) {
    return next(new AppError('Please provide email and password', 400));
  }

  // Check for user and include password
  const user = await User.findForAuthentication(email);

  // Check if user exists and password is correct
  if (!user || !(await user.comparePassword(password))) {
    // Increment login attempts if user exists
    if (user) {
      await user.incLoginAttempts();
      logger.logAPI('Failed Login Attempt', user._id, {
        email: email,
        ip: req.ip,
        attempts: user.loginAttempts + 1
      });
    }
    return next(new AppError('Incorrect email or password', 401));
  }

  // Check if account is locked
  if (user.isLocked) {
    return next(new AppError('Account temporarily locked due to too many failed login attempts', 423));
  }

  // Reset login attempts on successful login
  if (user.loginAttempts && user.loginAttempts > 0) {
    await user.resetLoginAttempts();
  }

  // Update last login
  user.lastLogin = new Date();
  user.metadata.lastLoginIP = req.ip;
  user.metadata.userAgent = req.get('User-Agent');
  await user.save({ validateBeforeSave: false });

  // Generate tokens
  const tokens = generateTokens(user._id);

  logger.logAPI('User Login', user._id, {
    email: user.email,
    ip: req.ip
  });

  res.status(200).json({
    status: 'success',
    message: 'Login successful',
    data: {
      user: user.toJSON(),
      ...tokens
    }
  });
});

/**
 * Logout user
 */
const logout = catchAsync(async (req, res, next) => {
  // In a stateless JWT setup, logout is handled on the client side
  // But we can log the action for security purposes
  logger.logAPI('User Logout', req.userId, {
    ip: req.ip
  });

  res.status(200).json({
    status: 'success',
    message: 'Logout successful'
  });
});

/**
 * Send email verification
 */
const sendEmailVerification = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.userId);

  if (user.isEmailVerified) {
    return next(new AppError('Email is already verified', 400));
  }

  // Generate new verification token
  const emailToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  // Send verification email
  try {
    await emailService.sendEmailVerification(user.email, user.firstName, emailToken);
    
    logger.logAPI('Email Verification Resent', user._id, { email: user.email });

    res.status(200).json({
      status: 'success',
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.logError(error, req, 'Email Service Failed');
    return next(new AppError('Failed to send verification email. Please try again later.', 500));
  }
});

/**
 * Verify email
 */
const verifyEmail = catchAsync(async (req, res, next) => {
  const { token } = req.params;

  const user = await User.findByEmailVerificationToken(token);

  if (!user) {
    return next(new AppError('Invalid or expired verification token', 400));
  }

  // Mark email as verified
  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  logger.logAPI('Email Verified', user._id, { email: user.email });

  res.status(200).json({
    status: 'success',
    message: 'Email verified successfully',
    data: {
      user: user.toJSON()
    }
  });
});

/**
 * Send mobile OTP
 */
const sendMobileOTP = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.userId);

  if (user.isMobileVerified) {
    return next(new AppError('Mobile number is already verified', 400));
  }

  // Generate OTP
  const otp = user.generateMobileOTP();
  await user.save({ validateBeforeSave: false });

  // Send OTP via SMS
  try {
    await smsService.sendOTP(`${user.dialingCode}${user.mobile}`, otp);
    
    logger.logAPI('Mobile OTP Sent', user._id, { 
      mobile: `${user.dialingCode}${user.mobile}` 
    });

    res.status(200).json({
      status: 'success',
      message: 'OTP sent to your mobile number successfully'
    });
  } catch (error) {
    user.mobileVerificationOTP = undefined;
    user.mobileVerificationExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.logError(error, req, 'SMS Service Failed');
    return next(new AppError('Failed to send OTP. Please try again later.', 500));
  }
});

/**
 * Verify mobile OTP
 */
const verifyMobileOTP = catchAsync(async (req, res, next) => {
  const { otp } = req.body;
  const user = await User.findById(req.userId);

  const userWithOTP = await User.findByMobileOTP(otp, user.mobile, user.dialingCode);

  if (!userWithOTP || userWithOTP._id.toString() !== user._id.toString()) {
    return next(new AppError('Invalid or expired OTP', 400));
  }

  // Mark mobile as verified
  user.isMobileVerified = true;
  user.mobileVerificationOTP = undefined;
  user.mobileVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  logger.logAPI('Mobile Verified', user._id, { 
    mobile: `${user.dialingCode}${user.mobile}` 
  });

  res.status(200).json({
    status: 'success',
    message: 'Mobile number verified successfully',
    data: {
      user: user.toJSON()
    }
  });
});

/**
 * Forgot password
 */
const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;

  const user = await User.findOne({ 
    email: email.toLowerCase(),
    status: 'active'
  });

  if (!user) {
    // Don't reveal if email exists for security
    return res.status(200).json({
      status: 'success',
      message: 'If the email exists, a password reset link has been sent'
    });
  }

  // Generate reset token
  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // Send password reset email
  try {
    await emailService.sendPasswordReset(user.email, user.firstName, resetToken);
    
    logger.logAPI('Password Reset Requested', user._id, { email: user.email });

    res.status(200).json({
      status: 'success',
      message: 'Password reset link sent to your email'
    });
  } catch (error) {
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save({ validateBeforeSave: false });

    logger.logError(error, req, 'Password Reset Email Failed');
    return next(new AppError('Failed to send reset email. Please try again later.', 500));
  }
});

/**
 * Reset password
 */
const resetPassword = catchAsync(async (req, res, next) => {
  const { token } = req.params;
  const { password } = req.body;

  const user = await User.findByPasswordResetToken(token);

  if (!user) {
    return next(new AppError('Invalid or expired reset token', 400));
  }

  // Update password
  user.password = password;
  user.resetPasswordToken = undefined;
  user.resetPasswordExpires = undefined;
  
  // Reset login attempts
  user.loginAttempts = undefined;
  user.lockUntil = undefined;
  
  await user.save();

  // Generate new tokens
  const tokens = generateTokens(user._id);

  logger.logAPI('Password Reset Completed', user._id);

  res.status(200).json({
    status: 'success',
    message: 'Password reset successful',
    data: {
      user: user.toJSON(),
      ...tokens
    }
  });
});

/**
 * Change password (for authenticated users)
 */
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  // Get user with password
  const user = await User.findById(req.userId).select('+password');

  // Check current password
  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect', 400));
  }

  // Update password
  user.password = newPassword;
  await user.save();

  logger.logAPI('Password Changed', user._id);

  res.status(200).json({
    status: 'success',
    message: 'Password changed successfully'
  });
});

/**
 * Get current user profile
 */
const getProfile = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.userId);

  res.status(200).json({
    status: 'success',
    data: {
      user: user.toJSON()
    }
  });
});

module.exports = {
  register,
  login,
  logout,
  sendEmailVerification,
  verifyEmail,
  sendMobileOTP,
  verifyMobileOTP,
  forgotPassword,
  resetPassword,
  changePassword,
  getProfile
};