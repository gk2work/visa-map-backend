const Journey = require('../models/Journey');
const User = require('../models/User');
const Country = require('../models/Country');
const VisaType = require('../models/VisaType');
const AppError = require('../middleware/errorHandler').AppError;
const logger = require('../utils/logger');

/**
 * Journey Controller - Handles user journey tracking and progress management
 * Integrates with frontend ProgressData interface
 */

/**
 * Create a new journey or update existing one
 * POST /api/v1/journeys
 */
const createOrUpdateJourney = async (req, res, next) => {
  try {
    const {
      email,
      originCountry,
      destinationCountry,
      userType,
      visaType,
      personalizationData,
      checklist,
      stepCompletion,
      timestamps
    } = req.body;

    // Validate required fields
    if (!email || !originCountry || !destinationCountry) {
      return next(new AppError('Email, origin country, and destination country are required', 400));
    }

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    // Validate countries exist
    const [origin, destination] = await Promise.all([
      Country.findOne({ code: originCountry.toUpperCase() }),
      Country.findOne({ code: destinationCountry.toUpperCase() })
    ]);

    if (!origin || !destination) {
      return next(new AppError('Invalid country codes provided', 400));
    }

    // Check if journey already exists
    let journey = await Journey.findOne({
      userId: user._id,
      originCountry: originCountry.toUpperCase(),
      destinationCountry: destinationCountry.toUpperCase(),
      status: { $in: ['started', 'in_progress', 'under_review'] }
    });

    if (journey) {
      // Update existing journey
      if (personalizationData) {
        journey.updatePersonalization(personalizationData);
      }
      
      if (checklist) {
        journey.updateChecklist(checklist);
      }
      
      if (stepCompletion) {
        Object.entries(stepCompletion).forEach(([stepId, completed]) => {
          if (completed) {
            journey.markStepCompleted(stepId);
          }
        });
      }

      if (timestamps) {
        journey.timestamps = { ...journey.timestamps, ...timestamps };
      }

      journey.userType = userType || journey.userType;
      journey.visaType = visaType || journey.visaType;
      
      await journey.save();
      
      logger.info(`Journey updated for user ${email}`, {
        journeyId: journey._id,
        progress: journey.progressMetrics.completionPercentage
      });
    } else {
      // Create new journey
      journey = new Journey({
        userId: user._id,
        email,
        originCountry: originCountry.toUpperCase(),
        destinationCountry: destinationCountry.toUpperCase(),
        userType: userType || 'student',
        visaType: visaType || 'student',
        personalizationData: personalizationData || {},
        stepCompletion: new Map(Object.entries(stepCompletion || {})),
        checklist: new Map(Object.entries(checklist || {})),
        timestamps: {
          journeyStarted: new Date(),
          lastActivity: new Date(),
          ...timestamps
        },
        metadata: {
          deviceInfo: {
            userAgent: req.get('User-Agent'),
            platform: req.get('sec-ch-ua-platform'),
            isMobile: /mobile/i.test(req.get('User-Agent'))
          },
          sessionData: {
            totalSessions: 1,
            totalTimeSpent: 0,
            averageSessionTime: 0
          },
          sourceInfo: {
            referralSource: req.query.ref || 'direct',
            utmSource: req.query.utm_source,
            utmMedium: req.query.utm_medium,
            utmCampaign: req.query.utm_campaign
          }
        }
      });

      await journey.save();
      
      logger.info(`New journey created for user ${email}`, {
        journeyId: journey._id,
        route: `${originCountry} → ${destinationCountry}`
      });
    }

    res.status(journey.isNew ? 201 : 200).json({
      status: 'success',
      message: journey.isNew ? 'Journey created successfully' : 'Journey updated successfully',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in createOrUpdateJourney:', error);
    next(new AppError('Failed to create or update journey', 500));
  }
};

/**
 * Get user's active journeys
 * GET /api/v1/journeys
 */
const getUserJourneys = async (req, res, next) => {
  try {
    const { status, limit = 10, offset = 0 } = req.query;
    
    let query = { userId: req.user._id };
    
    if (status) {
      query.status = status;
    } else {
      // Default to active journeys
      query.status = { $in: ['started', 'in_progress', 'under_review'] };
    }

    const journeys = await Journey.find(query)
      .sort({ 'timestamps.lastActivity': -1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .populate('userId', 'firstName lastName email');

    const total = await Journey.countDocuments(query);

    res.status(200).json({
      status: 'success',
      data: {
        journeys,
        pagination: {
          total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: (parseInt(offset) + parseInt(limit)) < total
        }
      }
    });

  } catch (error) {
    logger.error('Error in getUserJourneys:', error);
    next(new AppError('Failed to retrieve journeys', 500));
  }
};

/**
 * Get journey by ID
 * GET /api/v1/journeys/:id
 */
const getJourneyById = async (req, res, next) => {
  try {
    const journey = await Journey.findById(req.params.id)
      .populate('userId', 'firstName lastName email');

    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    // Check if user owns this journey or has shared access
    if (journey.userId._id.toString() !== req.user._id.toString()) {
      const hasSharedAccess = journey.sharedWith.some(
        share => share.email === req.user.email
      );
      
      if (!hasSharedAccess) {
        return next(new AppError('Access denied to this journey', 403));
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in getJourneyById:', error);
    next(new AppError('Failed to retrieve journey', 500));
  }
};

/**
 * Load journey progress by email (for frontend integration)
 * GET /api/v1/journeys/progress/:email
 */
const getJourneyProgress = async (req, res, next) => {
  try {
    const { email } = req.params;
    const { originCountry, destinationCountry } = req.query;

    let query = { email };
    
    if (originCountry && destinationCountry) {
      query.originCountry = originCountry.toUpperCase();
      query.destinationCountry = destinationCountry.toUpperCase();
    }

    // Get the most recent active journey
    const journey = await Journey.findOne({
      ...query,
      status: { $in: ['started', 'in_progress', 'under_review'] }
    }).sort({ 'timestamps.lastActivity': -1 });

    if (!journey) {
      return res.status(200).json({
        status: 'success',
        data: {
          progress: null
        }
      });
    }

    // Format response to match frontend ProgressData interface
    const progressData = {
      email: journey.email,
      originCountry: journey.originCountry,
      destinationCountry: journey.destinationCountry,
      userType: journey.userType,
      visaType: journey.visaType,
      personalizationData: journey.personalizationData,
      checklist: Object.fromEntries(journey.checklist),
      stepCompletion: Object.fromEntries(journey.stepCompletion),
      timestamps: journey.timestamps
    };

    res.status(200).json({
      status: 'success',
      data: {
        progress: progressData,
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in getJourneyProgress:', error);
    next(new AppError('Failed to load journey progress', 500));
  }
};

/**
 * Update journey step completion
 * PATCH /api/v1/journeys/:id/steps/:stepId
 */
const updateStepCompletion = async (req, res, next) => {
  try {
    const { id, stepId } = req.params;
    const { completed } = req.body;

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    if (completed) {
      await journey.markStepCompleted(stepId);
    } else {
      journey.stepCompletion.set(stepId, false);
      await journey.updateProgress();
    }

    res.status(200).json({
      status: 'success',
      message: `Step ${stepId} ${completed ? 'completed' : 'marked incomplete'}`,
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in updateStepCompletion:', error);
    next(new AppError('Failed to update step completion', 500));
  }
};

/**
 * Update journey checklist
 * PATCH /api/v1/journeys/:id/checklist
 */
const updateJourneyChecklist = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { checklist } = req.body;

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    await journey.updateChecklist(checklist);

    res.status(200).json({
      status: 'success',
      message: 'Checklist updated successfully',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in updateJourneyChecklist:', error);
    next(new AppError('Failed to update checklist', 500));
  }
};

/**
 * Update journey personalization
 * PATCH /api/v1/journeys/:id/personalization
 */
const updateJourneyPersonalization = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { personalizationData } = req.body;

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    await journey.updatePersonalization(personalizationData);

    res.status(200).json({
      status: 'success',
      message: 'Personalization updated successfully',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in updateJourneyPersonalization:', error);
    next(new AppError('Failed to update personalization', 500));
  }
};

/**
 * Share journey with others
 * POST /api/v1/journeys/:id/share
 */
const shareJourney = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { email, permissions = 'view' } = req.body;

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    // Check if already shared with this email
    const existingShare = journey.sharedWith.find(share => share.email === email);
    
    if (existingShare) {
      existingShare.permissions = permissions;
    } else {
      journey.sharedWith.push({
        email,
        permissions,
        sharedAt: new Date()
      });
    }

    journey.isShared = true;
    await journey.save();

    res.status(200).json({
      status: 'success',
      message: 'Journey shared successfully',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in shareJourney:', error);
    next(new AppError('Failed to share journey', 500));
  }
};

/**
 * Add note to journey
 * POST /api/v1/journeys/:id/notes
 */
const addJourneyNote = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content } = req.body;

    if (!content) {
      return next(new AppError('Note content is required', 400));
    }

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    await journey.addNote(content, req.user.email);

    res.status(201).json({
      status: 'success',
      message: 'Note added successfully',
      data: {
        journey: journey.toObject()
      }
    });

  } catch (error) {
    logger.error('Error in addJourneyNote:', error);
    next(new AppError('Failed to add note', 500));
  }
};

/**
 * Get journey statistics
 * GET /api/v1/journeys/stats
 */
const getJourneyStats = async (req, res, next) => {
  try {
    const { userId, timeframe = '30d' } = req.query;
    
    let dateFilter = {};
    const now = new Date();
    
    switch (timeframe) {
      case '7d':
        dateFilter = { createdAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
        break;
      case '30d':
        dateFilter = { createdAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
        break;
      case '90d':
        dateFilter = { createdAt: { $gte: new Date(now - 90 * 24 * 60 * 60 * 1000) } };
        break;
    }

    let matchQuery = dateFilter;
    if (userId) {
      matchQuery.userId = mongoose.Types.ObjectId(userId);
    }

    const stats = await Journey.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: null,
          totalJourneys: { $sum: 1 },
          activeJourneys: {
            $sum: {
              $cond: [{ $in: ['$status', ['started', 'in_progress', 'under_review']] }, 1, 0]
            }
          },
          completedJourneys: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          averageCompletion: { $avg: '$progressMetrics.completionPercentage' },
          popularRoutes: { $push: { origin: '$originCountry', destination: '$destinationCountry' } }
        }
      }
    ]);

    // Get route popularity
    const routeStats = await Journey.aggregate([
      { $match: matchQuery },
      {
        $group: {
          _id: { origin: '$originCountry', destination: '$destinationCountry' },
          count: { $sum: 1 },
          avgCompletion: { $avg: '$progressMetrics.completionPercentage' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        overview: stats[0] || {
          totalJourneys: 0,
          activeJourneys: 0,
          completedJourneys: 0,
          averageCompletion: 0
        },
        popularRoutes: routeStats
      }
    });

  } catch (error) {
    logger.error('Error in getJourneyStats:', error);
    next(new AppError('Failed to retrieve journey statistics', 500));
  }
};

/**
 * Delete journey
 * DELETE /api/v1/journeys/:id
 */
const deleteJourney = async (req, res, next) => {
  try {
    const { id } = req.params;

    const journey = await Journey.findById(id);
    
    if (!journey) {
      return next(new AppError('Journey not found', 404));
    }

    if (journey.userId.toString() !== req.user._id.toString()) {
      return next(new AppError('Access denied to this journey', 403));
    }

    await Journey.findByIdAndDelete(id);

    res.status(200).json({
      status: 'success',
      message: 'Journey deleted successfully'
    });

  } catch (error) {
    logger.error('Error in deleteJourney:', error);
    next(new AppError('Failed to delete journey', 500));
  }
};

module.exports = {
  createOrUpdateJourney,
  getUserJourneys,
  getJourneyById,
  getJourneyProgress,
  updateStepCompletion,
  updateJourneyChecklist,
  updateJourneyPersonalization,
  shareJourney,
  addJourneyNote,
  getJourneyStats,
  deleteJourney
};