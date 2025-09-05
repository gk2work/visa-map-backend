const logger = require('../utils/logger');

// Initialize Twilio client if credentials are provided
let twilioClient = null;

if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    logger.info('Twilio SMS service initialized');
  } catch (error) {
    logger.error('Twilio initialization failed:', error.message);
  }
}

/**
 * Send OTP via SMS
 */
const sendOTP = async (phoneNumber, otp) => {
  try {
    const message = `Your VisaMap verification code is: ${otp}. This code will expire in 10 minutes. Do not share this code with anyone.`;

    // If Twilio is configured and SMS service is enabled
    if (twilioClient && process.env.SMS_SERVICE_ENABLED === 'true') {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info(`SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } else {
      // Development mode - just log the OTP
      logger.info(`SMS Development Mode - OTP for ${phoneNumber}: ${otp}`);
      logger.info(`SMS Message: ${message}`);
      
      // In development, consider the SMS as "sent"
      return {
        sid: 'dev_' + Date.now(),
        status: 'development_mode',
        to: phoneNumber
      };
    }
    
  } catch (error) {
    logger.error('SMS send failed:', error);
    throw error;
  }
};

/**
 * Send custom SMS message
 */
const sendMessage = async (phoneNumber, message) => {
  try {
    if (twilioClient && process.env.SMS_SERVICE_ENABLED === 'true') {
      const result = await twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info(`SMS sent to ${phoneNumber}, SID: ${result.sid}`);
      return result;
    } else {
      // Development mode
      logger.info(`SMS Development Mode - Message to ${phoneNumber}: ${message}`);
      
      return {
        sid: 'dev_' + Date.now(),
        status: 'development_mode',
        to: phoneNumber
      };
    }
    
  } catch (error) {
    logger.error('SMS send failed:', error);
    throw error;
  }
};

/**
 * Check if SMS service is available
 */
const isAvailable = () => {
  return !!(twilioClient && process.env.SMS_SERVICE_ENABLED === 'true');
};

module.exports = {
  sendOTP,
  sendMessage,
  isAvailable
};