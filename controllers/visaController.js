const VisaType = require('../models/VisaType');
const Country = require('../models/Country');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get visa types by route
 */
const getVisaTypesByRoute = catchAsync(async (req, res, next) => {
  const { origin, destination } = req.params;
  const { category, userType } = req.query;

  // Validate that the route is supported
  const countries = await Country.getSupportedRoute(origin.toUpperCase(), destination.toUpperCase());
  
  if (countries.length !== 2) {
    return next(new AppError('Route not supported', 400));
  }

  // Build query
  const query = {
    originCountry: origin.toUpperCase(),
    destinationCountry: destination.toUpperCase(),
    status: 'active'
  };

  if (category) {
    query.category = category.toLowerCase();
  }

  if (userType) {
    query.category = userType.toLowerCase(); // userType maps to category
  }

  const visaTypes = await VisaType.find(query)
    .sort({ displayOrder: 1, 'metadata.popularity': -1, name: 1 });

  res.status(200).json({
    status: 'success',
    results: visaTypes.length,
    data: {
      route: {
        origin: origin.toUpperCase(),
        destination: destination.toUpperCase()
      },
      visaTypes
    }
  });
});

/**
 * Get single visa type by ID
 */
const getVisaTypeById = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const { personalization } = req.query;

  const visaType = await VisaType.findById(id);

  if (!visaType) {
    return next(new AppError('Visa type not found', 404));
  }

  if (visaType.status !== 'active') {
    return next(new AppError('Visa type is not available', 400));
  }

  // If personalization data provided, get conditional content
  let personalizedContent = {};
  
  if (personalization) {
    try {
      const userResponses = JSON.parse(personalization);
      
      personalizedContent = {
        documents: visaType.getConditionalDocuments(userResponses),
        steps: visaType.getPersonalizedSteps(userResponses)
      };
    } catch (error) {
      logger.logError(error, req, 'Personalization parsing failed');
    }
  }

  res.status(200).json({
    status: 'success',
    data: {
      visaType,
      personalized: personalizedContent
    }
  });
});

/**
 * Get visa types by category
 */
const getVisaTypesByCategory = catchAsync(async (req, res, next) => {
  const { category } = req.params;
  const { destination } = req.query;

  const query = { 
    category: category.toLowerCase(),
    status: 'active'
  };

  if (destination) {
    query.destinationCountry = destination.toUpperCase();
  }

  const visaTypes = await VisaType.find(query)
    .sort({ 'metadata.popularity': -1, name: 1 });

  res.status(200).json({
    status: 'success',
    results: visaTypes.length,
    data: {
      category,
      visaTypes
    }
  });
});

/**
 * Get popular visa types
 */
const getPopularVisaTypes = catchAsync(async (req, res, next) => {
  const { limit = 10 } = req.query;

  const visaTypes = await VisaType.findPopular(parseInt(limit));

  res.status(200).json({
    status: 'success',
    results: visaTypes.length,
    data: {
      visaTypes
    }
  });
});

/**
 * Search visa types
 */
const searchVisaTypes = catchAsync(async (req, res, next) => {
  const { q, origin, destination, category } = req.query;

  if (!q || q.length < 2) {
    return next(new AppError('Search query must be at least 2 characters', 400));
  }

  const query = {
    status: 'active',
    $or: [
      { name: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { 'metadata.tags': { $in: [new RegExp(q, 'i')] } }
    ]
  };

  if (origin) query.originCountry = origin.toUpperCase();
  if (destination) query.destinationCountry = destination.toUpperCase();
  if (category) query.category = category.toLowerCase();

  const visaTypes = await VisaType.find(query)
    .sort({ 'metadata.popularity': -1, name: 1 })
    .limit(20);

  res.status(200).json({
    status: 'success',
    results: visaTypes.length,
    data: {
      searchQuery: q,
      visaTypes
    }
  });
});

/**
 * Get visa requirements with personalization
 */
const getVisaRequirements = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userResponses = req.body || {};

  const visaType = await VisaType.findById(id);

  if (!visaType) {
    return next(new AppError('Visa type not found', 404));
  }

  // Get personalized content
  const personalizedDocuments = visaType.getConditionalDocuments(userResponses);
  const personalizedSteps = visaType.getPersonalizedSteps(userResponses);

  // Group documents by category
  const documentsByCategory = personalizedDocuments.reduce((acc, doc) => {
    if (!acc[doc.category]) {
      acc[doc.category] = [];
    }
    acc[doc.category].push(doc);
    return acc;
  }, {});

  res.status(200).json({
    status: 'success',
    data: {
      visaType: {
        id: visaType._id,
        name: visaType.name,
        code: visaType.code,
        category: visaType.category
      },
      requirements: {
        documents: personalizedDocuments,
        documentsByCategory,
        financialEvidence: visaType.requirements.financialEvidence
      },
      process: {
        steps: personalizedSteps,
        applicationMethod: visaType.applicationProcess.applicationMethod,
        interviewRequired: visaType.applicationProcess.interviewRequired
      },
      personalization: userResponses
    }
  });
});

/**
 * Get visa checklist
 */
const getVisaChecklist = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const userResponses = req.body || {};

  const visaType = await VisaType.findById(id);

  if (!visaType) {
    return next(new AppError('Visa type not found', 404));
  }

  const documents = visaType.getConditionalDocuments(userResponses);
  const steps = visaType.getPersonalizedSteps(userResponses);

  // Create checklist items
  const checklist = [
    ...documents.filter(doc => doc.isRequired).map(doc => ({
      type: 'document',
      id: doc._id,
      title: doc.name,
      description: doc.description,
      category: doc.category,
      completed: false
    })),
    ...steps.map(step => ({
      type: 'step',
      id: step._id,
      title: step.title,
      description: step.action,
      stepNumber: step.stepNumber,
      completed: false
    }))
  ];

  res.status(200).json({
    status: 'success',
    data: {
      visaType: {
        id: visaType._id,
        name: visaType.name,
        code: visaType.code
      },
      checklist,
      totalItems: checklist.length,
      estimatedTime: visaType.processingTimeDisplay
    }
  });
});

/**
 * Create visa type (Admin only)
 */
const createVisaType = catchAsync(async (req, res, next) => {
  const visaTypeData = { ...req.body };
  
  // Validate that origin and destination countries exist
  const originCountry = await Country.findOne({ 
    code: visaTypeData.originCountry,
    isOriginCountry: true,
    status: 'active'
  });
  
  const destinationCountry = await Country.findOne({ 
    code: visaTypeData.destinationCountry,
    isDestinationCountry: true,
    status: 'active'
  });

  if (!originCountry) {
    return next(new AppError('Invalid or unsupported origin country', 400));
  }

  if (!destinationCountry) {
    return next(new AppError('Invalid or unsupported destination country', 400));
  }

  const visaType = await VisaType.create(visaTypeData);

  logger.logAPI('Visa Type Created', req.userId, {
    visaTypeId: visaType._id,
    name: visaType.name,
    route: `${visaType.originCountry}-${visaType.destinationCountry}`
  });

  res.status(201).json({
    status: 'success',
    message: 'Visa type created successfully',
    data: {
      visaType
    }
  });
});

/**
 * Update visa type (Admin only)
 */
const updateVisaType = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  const visaType = await VisaType.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!visaType) {
    return next(new AppError('Visa type not found', 404));
  }

  logger.logAPI('Visa Type Updated', req.userId, {
    visaTypeId: visaType._id,
    changes: Object.keys(updateData)
  });

  res.status(200).json({
    status: 'success',
    message: 'Visa type updated successfully',
    data: {
      visaType
    }
  });
});

/**
 * Delete visa type (Admin only)
 */
const deleteVisaType = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const visaType = await VisaType.findById(id);

  if (!visaType) {
    return next(new AppError('Visa type not found', 404));
  }

  // Soft delete
  visaType.status = 'inactive';
  await visaType.save();

  logger.logAPI('Visa Type Deleted', req.userId, {
    visaTypeId: visaType._id,
    name: visaType.name
  });

  res.status(200).json({
    status: 'success',
    message: 'Visa type deleted successfully'
  });
});

/**
 * Get visa statistics
 */
const getVisaStats = catchAsync(async (req, res, next) => {
  const stats = await VisaType.aggregate([
    {
      $group: {
        _id: null,
        totalVisaTypes: { $sum: 1 },
        activeVisaTypes: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        averageProcessingTime: {
          $avg: '$processingTime.min'
        }
      }
    }
  ]);

  const categoryStats = await VisaType.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$category',
        count: { $sum: 1 },
        avgPopularity: { $avg: '$metadata.popularity' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const routeStats = await VisaType.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: {
          origin: '$originCountry',
          destination: '$destinationCountry'
        },
        count: { $sum: 1 },
        categories: { $addToSet: '$category' }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: stats[0] || {
        totalVisaTypes: 0,
        activeVisaTypes: 0,
        averageProcessingTime: 0
      },
      byCategory: categoryStats,
      byRoute: routeStats
    }
  });
});

module.exports = {
  getVisaTypesByRoute,
  getVisaTypeById,
  getVisaTypesByCategory,
  getPopularVisaTypes,
  searchVisaTypes,
  getVisaRequirements,
  getVisaChecklist,
  createVisaType,
  updateVisaType,
  deleteVisaType,
  getVisaStats
};