const User = require('../models/User');
const Journey = require('../models/Journey');
const Contact = require('../models/Contact');
const Country = require('../models/Country');
const VisaType = require('../models/VisaType');
const AppError = require('../middleware/errorHandler').AppError;
const logger = require('../utils/logger');
const pdfService = require('../services/pdfService');
const emailService = require('../services/emailService');

/**
 * Admin Controller - Dashboard APIs and management functions
 */

/**
 * Get dashboard overview
 * GET /api/v1/admin/dashboard
 */
const getDashboardOverview = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;
    
    // Calculate date range
    const now = new Date();
    let startDate;
    switch (timeframe) {
      case '7d':
        startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now - 90 * 24 * 60 * 60 * 1000);
        break;
      case '1y':
        startDate = new Date(now - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    // Get user statistics
    const [totalUsers, newUsers, activeUsers, verifiedUsers] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: startDate } }),
      User.countDocuments({ 
        'timestamps.lastActivity': { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
        status: 'active'
      }),
      User.countDocuments({ isEmailVerified: true })
    ]);

    // Get journey statistics
    const [totalJourneys, activeJourneys, completedJourneys, averageCompletion] = await Promise.all([
      Journey.countDocuments(),
      Journey.countDocuments({ status: { $in: ['started', 'in_progress', 'under_review'] } }),
      Journey.countDocuments({ status: 'completed' }),
      Journey.aggregate([
        { $group: { _id: null, avgCompletion: { $avg: '$progressMetrics.completionPercentage' } } }
      ]).then(result => result[0]?.avgCompletion || 0)
    ]);

    // Get contact statistics
    const [totalContacts, newContacts, resolvedContacts, highPriorityContacts] = await Promise.all([
      Contact.countDocuments(),
      Contact.countDocuments({ submittedAt: { $gte: startDate } }),
      Contact.countDocuments({ status: 'resolved' }),
      Contact.countDocuments({ 
        priority: { $in: ['high', 'urgent'] },
        status: { $in: ['new', 'contacted', 'in_progress'] }
      })
    ]);

    // Get popular routes
    const popularRoutes = await Journey.aggregate([
      {
        $group: {
          _id: { origin: '$originCountry', destination: '$destinationCountry' },
          count: { $sum: 1 },
          averageCompletion: { $avg: '$progressMetrics.completionPercentage' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get growth trends
    const userGrowth = await User.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    const journeyGrowth = await Journey.aggregate([
      {
        $match: { createdAt: { $gte: startDate } }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            day: { $dayOfMonth: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: {
          users: {
            total: totalUsers,
            new: newUsers,
            active: activeUsers,
            verified: verifiedUsers,
            verificationRate: totalUsers > 0 ? Math.round((verifiedUsers / totalUsers) * 100) : 0
          },
          journeys: {
            total: totalJourneys,
            active: activeJourneys,
            completed: completedJourneys,
            averageCompletion: Math.round(averageCompletion),
            completionRate: totalJourneys > 0 ? Math.round((completedJourneys / totalJourneys) * 100) : 0
          },
          contacts: {
            total: totalContacts,
            new: newContacts,
            resolved: resolvedContacts,
            highPriority: highPriorityContacts,
            resolutionRate: totalContacts > 0 ? Math.round((resolvedContacts / totalContacts) * 100) : 0
          }
        },
        popularRoutes,
        growth: {
          users: userGrowth,
          journeys: journeyGrowth
        },
        timeframe,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Error getting dashboard overview:', error);
    next(new AppError('Failed to retrieve dashboard data', 500));
  }
};

/**
 * Get user analytics
 * GET /api/v1/admin/analytics/users
 */
const getUserAnalytics = async (req, res, next) => {
  try {
    const { timeframe = '30d', groupBy = 'day' } = req.query;

    // User registration trends
    const registrationTrends = await User.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            ...(groupBy === 'day' && { day: { $dayOfMonth: '$createdAt' } })
          },
          registrations: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // User demographics
    const demographics = await User.aggregate([
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]);

    // Email verification rates
    const verificationStats = await User.aggregate([
      {
        $group: {
          _id: null,
          totalUsers: { $sum: 1 },
          emailVerified: { $sum: { $cond: ['$isEmailVerified', 1, 0] } },
          mobileVerified: { $sum: { $cond: ['$isMobileVerified', 1, 0] } }
        }
      }
    ]);

    // User activity patterns
    const activityPatterns = await User.aggregate([
      {
        $match: { 'timestamps.lastActivity': { $exists: true } }
      },
      {
        $group: {
          _id: {
            hour: { $hour: '$timestamps.lastActivity' }
          },
          activeUsers: { $sum: 1 }
        }
      },
      { $sort: { '_id.hour': 1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        registrationTrends,
        demographics,
        verificationStats: verificationStats[0] || { totalUsers: 0, emailVerified: 0, mobileVerified: 0 },
        activityPatterns
      }
    });

  } catch (error) {
    logger.error('Error getting user analytics:', error);
    next(new AppError('Failed to retrieve user analytics', 500));
  }
};

/**
 * Get journey analytics
 * GET /api/v1/admin/analytics/journeys
 */
const getJourneyAnalytics = async (req, res, next) => {
  try {
    // Journey completion rates by route
    const completionByRoute = await Journey.aggregate([
      {
        $group: {
          _id: { origin: '$originCountry', destination: '$destinationCountry' },
          totalJourneys: { $sum: 1 },
          completedJourneys: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          averageCompletion: { $avg: '$progressMetrics.completionPercentage' },
          averageDuration: { $avg: '$daysSinceStart' }
        }
      },
      {
        $addFields: {
          completionRate: {
            $multiply: [{ $divide: ['$completedJourneys', '$totalJourneys'] }, 100]
          }
        }
      },
      { $sort: { totalJourneys: -1 } }
    ]);

    // Journey status distribution
    const statusDistribution = await Journey.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Average completion time by visa type
    const completionTimeByType = await Journey.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$visaType',
          averageDays: { $avg: '$daysSinceStart' },
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Journey abandonment analysis
    const abandonmentAnalysis = await Journey.aggregate([
      {
        $match: { 
          status: 'abandoned',
          'progressMetrics.completionPercentage': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            completionRange: {
              $switch: {
                branches: [
                  { case: { $lt: ['$progressMetrics.completionPercentage', 25] }, then: '0-25%' },
                  { case: { $lt: ['$progressMetrics.completionPercentage', 50] }, then: '25-50%' },
                  { case: { $lt: ['$progressMetrics.completionPercentage', 75] }, then: '50-75%' },
                  { case: { $lt: ['$progressMetrics.completionPercentage', 100] }, then: '75-100%' }
                ],
                default: '100%'
              }
            }
          },
          count: { $sum: 1 },
          averageCompletion: { $avg: '$progressMetrics.completionPercentage' }
        }
      }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        completionByRoute,
        statusDistribution,
        completionTimeByType,
        abandonmentAnalysis
      }
    });

  } catch (error) {
    logger.error('Error getting journey analytics:', error);
    next(new AppError('Failed to retrieve journey analytics', 500));
  }
};

/**
 * Get contact analytics
 * GET /api/v1/admin/analytics/contacts
 */
const getContactAnalytics = async (req, res, next) => {
  try {
    // Contact volume trends
    const volumeTrends = await Contact.aggregate([
      {
        $group: {
          _id: {
            year: { $year: '$submittedAt' },
            month: { $month: '$submittedAt' },
            day: { $dayOfMonth: '$submittedAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    // Response time analysis
    const responseTimeAnalysis = await Contact.aggregate([
      {
        $match: { 
          firstResponseAt: { $exists: true },
          submittedAt: { $exists: true }
        }
      },
      {
        $addFields: {
          responseTimeHours: {
            $divide: [
              { $subtract: ['$firstResponseAt', '$submittedAt'] },
              1000 * 60 * 60 // Convert to hours
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          averageResponseTime: { $avg: '$responseTimeHours' },
          medianResponseTime: { $median: '$responseTimeHours' },
          fastestResponse: { $min: '$responseTimeHours' },
          slowestResponse: { $max: '$responseTimeHours' }
        }
      }
    ]);

    // Lead quality analysis
    const leadQualityAnalysis = await Contact.aggregate([
      {
        $group: {
          _id: {
            scoreRange: {
              $switch: {
                branches: [
                  { case: { $lt: ['$leadData.leadScore', 25] }, then: 'Low (0-25)' },
                  { case: { $lt: ['$leadData.leadScore', 50] }, then: 'Medium (25-50)' },
                  { case: { $lt: ['$leadData.leadScore', 75] }, then: 'Good (50-75)' },
                  { case: { $lte: ['$leadData.leadScore', 100] }, then: 'High (75-100)' }
                ],
                default: 'Unknown'
              }
            }
          },
          count: { $sum: 1 },
          averageScore: { $avg: '$leadData.leadScore' }
        }
      }
    ]);

    // Contact type distribution
    const typeDistribution = await Contact.aggregate([
      {
        $group: {
          _id: '$contactType',
          count: { $sum: 1 },
          averageLeadScore: { $avg: '$leadData.leadScore' },
          resolutionRate: {
            $avg: {
              $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        volumeTrends,
        responseTime: responseTimeAnalysis[0] || {
          averageResponseTime: 0,
          medianResponseTime: 0,
          fastestResponse: 0,
          slowestResponse: 0
        },
        leadQuality: leadQualityAnalysis,
        typeDistribution
      }
    });

  } catch (error) {
    logger.error('Error getting contact analytics:', error);
    next(new AppError('Failed to retrieve contact analytics', 500));
  }
};

/**
 * Generate and download analytics report
 * POST /api/v1/admin/reports/generate
 */
const generateAnalyticsReport = async (req, res, next) => {
  try {
    const { reportType, timeframe = '30d', format = 'pdf' } = req.body;

    let reportData;
    switch (reportType) {
      case 'users':
        reportData = await getUserAnalyticsData(timeframe);
        break;
      case 'journeys':
        reportData = await getJourneyAnalyticsData(timeframe);
        break;
      case 'contacts':
        reportData = await getContactAnalyticsData(timeframe);
        break;
      case 'overview':
        reportData = await getOverviewData(timeframe);
        break;
      default:
        return next(new AppError('Invalid report type', 400));
    }

    if (format === 'pdf') {
      const pdf = await pdfService.generateAnalyticsReport(reportData, {
        reportType,
        timeframe,
        generatedBy: req.user.fullName,
        generatedAt: new Date()
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${pdf.filename}"`);
      res.send(pdf.buffer);
    } else {
      res.status(200).json({
        status: 'success',
        data: reportData
      });
    }

    logger.info('Analytics report generated', {
      reportType,
      format,
      generatedBy: req.user.email
    });

  } catch (error) {
    logger.error('Error generating analytics report:', error);
    next(new AppError('Failed to generate analytics report', 500));
  }
};

/**
 * Send newsletter to users
 * POST /api/v1/admin/communications/newsletter
 */
const sendNewsletter = async (req, res, next) => {
  try {
    const { subject, content, targetAudience = 'all', testMode = false } = req.body;

    let userQuery = { status: 'active', 'preferences.notifications.email': true };
    
    // Filter by audience
    switch (targetAudience) {
      case 'verified':
        userQuery.isEmailVerified = true;
        break;
      case 'active_journeys':
        const usersWithActiveJourneys = await Journey.distinct('userId', {
          status: { $in: ['started', 'in_progress', 'under_review'] }
        });
        userQuery._id = { $in: usersWithActiveJourneys };
        break;
      case 'completed_journeys':
        const usersWithCompletedJourneys = await Journey.distinct('userId', {
          status: 'completed'
        });
        userQuery._id = { $in: usersWithCompletedJourneys };
        break;
    }

    const recipients = await User.find(userQuery).select('firstName email');

    if (testMode) {
      // Send only to admin for testing
      const testRecipients = [{ firstName: req.user.firstName, email: req.user.email }];
      const result = await emailService.sendNewsletter(testRecipients, { subject, content });
      
      return res.status(200).json({
        status: 'success',
        message: 'Test newsletter sent successfully',
        data: {
          testMode: true,
          recipients: 1,
          result
        }
      });
    }

    const result = await emailService.sendNewsletter(recipients, { subject, content });

    logger.info('Newsletter sent', {
      recipients: recipients.length,
      subject,
      sentBy: req.user.email,
      targetAudience
    });

    res.status(200).json({
      status: 'success',
      message: 'Newsletter sent successfully',
      data: {
        totalRecipients: recipients.length,
        successful: result.successful,
        failed: result.failed
      }
    });

  } catch (error) {
    logger.error('Error sending newsletter:', error);
    next(new AppError('Failed to send newsletter', 500));
  }
};

/**
 * Get system health and performance metrics
 * GET /api/v1/admin/system/health
 */
const getSystemHealth = async (req, res, next) => {
  try {
    const systemStats = {
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
        environment: process.env.NODE_ENV
      },
      database: {
        status: 'connected', // We'll check this
        collections: {
          users: await User.countDocuments(),
          journeys: await Journey.countDocuments(),
          contacts: await Contact.countDocuments(),
          countries: await Country.countDocuments(),
          visaTypes: await VisaType.countDocuments()
        }
      },
      services: {
        email: await emailService.testConfiguration(),
        pdf: { status: 'available' } // Basic check
      }
    };

    res.status(200).json({
      status: 'success',
      data: systemStats
    });

  } catch (error) {
    logger.error('Error getting system health:', error);
    next(new AppError('Failed to retrieve system health', 500));
  }
};

// Helper functions for report generation
async function getUserAnalyticsData(timeframe) {
  // Implementation for user analytics data
  return {
    totalUsers: await User.countDocuments(),
    activeUsers: await User.countDocuments({ status: 'active' }),
    // Add more user analytics data
  };
}

async function getJourneyAnalyticsData(timeframe) {
  // Implementation for journey analytics data
  return {
    totalJourneys: await Journey.countDocuments(),
    activeJourneys: await Journey.countDocuments({ status: { $in: ['started', 'in_progress'] } }),
    // Add more journey analytics data
  };
}

async function getContactAnalyticsData(timeframe) {
  // Implementation for contact analytics data
  return {
    totalContacts: await Contact.countDocuments(),
    resolvedContacts: await Contact.countDocuments({ status: 'resolved' }),
    // Add more contact analytics data
  };
}

async function getOverviewData(timeframe) {
  // Implementation for overview data
  return {
    users: await getUserAnalyticsData(timeframe),
    journeys: await getJourneyAnalyticsData(timeframe),
    contacts: await getContactAnalyticsData(timeframe)
  };
}

module.exports = {
  getDashboardOverview,
  getUserAnalytics,
  getJourneyAnalytics,
  getContactAnalytics,
  generateAnalyticsReport,
  sendNewsletter,
  getSystemHealth
};