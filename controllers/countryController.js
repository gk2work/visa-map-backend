const Country = require('../models/Country');
const { AppError, catchAsync } = require('../middleware/errorHandler');
const logger = require('../utils/logger');

/**
 * Get all countries with optional filtering
 */
const getAllCountries = catchAsync(async (req, res, next) => {
  const { 
    origin, 
    destination, 
    region, 
    userType, 
    status = 'active',
    sort = 'displayOrder,name' 
  } = req.query;

  // Build filter object
  const filter = { status };
  
  if (origin === 'true') filter.isOriginCountry = true;
  if (destination === 'true') filter.isDestinationCountry = true;
  if (region) filter['metadata.region'] = region;
  if (userType) filter.supportedUserTypes = { $in: [userType.toLowerCase()] };

  // Build sort object
  const sortFields = sort.split(',').reduce((acc, field) => {
    const trimmedField = field.trim();
    if (trimmedField.startsWith('-')) {
      acc[trimmedField.substring(1)] = -1;
    } else {
      acc[trimmedField] = 1;
    }
    return acc;
  }, {});

  const countries = await Country.find(filter).sort(sortFields);

  res.status(200).json({
    status: 'success',
    results: countries.length,
    data: {
      countries
    }
  });
});

/**
 * Get origin countries
 */
const getOriginCountries = catchAsync(async (req, res, next) => {
  const countries = await Country.getOriginCountries();

  res.status(200).json({
    status: 'success',
    results: countries.length,
    data: {
      countries
    }
  });
});

/**
 * Get destination countries
 */
const getDestinationCountries = catchAsync(async (req, res, next) => {
  const countries = await Country.getDestinationCountries();

  res.status(200).json({
    status: 'success',
    results: countries.length,
    data: {
      countries
    }
  });
});

/**
 * Get countries by region
 */
const getCountriesByRegion = catchAsync(async (req, res, next) => {
  const { region } = req.params;

  const validRegions = ['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East'];
  
  if (!validRegions.includes(region)) {
    return next(new AppError('Invalid region specified', 400));
  }

  const countries = await Country.getByRegion(region);

  res.status(200).json({
    status: 'success',
    results: countries.length,
    data: {
      countries,
      region
    }
  });
});

/**
 * Check if route is supported
 */
const checkRouteSupport = catchAsync(async (req, res, next) => {
  const { origin, destination } = req.params;

  const countries = await Country.getSupportedRoute(origin.toUpperCase(), destination.toUpperCase());

  if (countries.length !== 2) {
    return res.status(200).json({
      status: 'success',
      data: {
        isSupported: false,
        message: 'Route not currently supported',
        availableOrigins: await Country.getOriginCountries(),
        availableDestinations: await Country.getDestinationCountries()
      }
    });
  }

  const originCountry = countries.find(c => c.code === origin.toUpperCase() && c.isOriginCountry);
  const destinationCountry = countries.find(c => c.code === destination.toUpperCase() && c.isDestinationCountry);

  res.status(200).json({
    status: 'success',
    data: {
      isSupported: true,
      route: {
        origin: originCountry,
        destination: destinationCountry
      }
    }
  });
});

/**
 * Get single country by code
 */
const getCountryByCode = catchAsync(async (req, res, next) => {
  const { code } = req.params;

  const country = await Country.findOne({ 
    code: code.toUpperCase(),
    status: 'active'
  });

  if (!country) {
    return next(new AppError('Country not found', 404));
  }

  res.status(200).json({
    status: 'success',
    data: {
      country
    }
  });
});

/**
 * Create new country (Admin only)
 */
const createCountry = catchAsync(async (req, res, next) => {
  const countryData = { ...req.body };
  
  // Ensure country code is uppercase
  if (countryData.code) {
    countryData.code = countryData.code.toUpperCase();
  }

  const country = await Country.create(countryData);

  logger.logAPI('Country Created', req.userId, {
    countryCode: country.code,
    countryName: country.name
  });

  res.status(201).json({
    status: 'success',
    message: 'Country created successfully',
    data: {
      country
    }
  });
});

/**
 * Update country (Admin only)
 */
const updateCountry = catchAsync(async (req, res, next) => {
  const { id } = req.params;
  const updateData = { ...req.body };

  // Ensure country code is uppercase if being updated
  if (updateData.code) {
    updateData.code = updateData.code.toUpperCase();
  }

  const country = await Country.findByIdAndUpdate(
    id,
    updateData,
    {
      new: true,
      runValidators: true
    }
  );

  if (!country) {
    return next(new AppError('Country not found', 404));
  }

  logger.logAPI('Country Updated', req.userId, {
    countryId: country._id,
    countryCode: country.code,
    changes: Object.keys(updateData)
  });

  res.status(200).json({
    status: 'success',
    message: 'Country updated successfully',
    data: {
      country
    }
  });
});

/**
 * Delete country (Admin only)
 */
const deleteCountry = catchAsync(async (req, res, next) => {
  const { id } = req.params;

  const country = await Country.findById(id);

  if (!country) {
    return next(new AppError('Country not found', 404));
  }

  // Soft delete by setting status to inactive
  country.status = 'inactive';
  await country.save();

  logger.logAPI('Country Deleted', req.userId, {
    countryId: country._id,
    countryCode: country.code
  });

  res.status(200).json({
    status: 'success',
    message: 'Country deleted successfully'
  });
});

/**
 * Get country statistics
 */
const getCountryStats = catchAsync(async (req, res, next) => {
  const stats = await Country.aggregate([
    {
      $group: {
        _id: null,
        totalCountries: { $sum: 1 },
        activeCountries: {
          $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
        },
        originCountries: {
          $sum: { $cond: ['$isOriginCountry', 1, 0] }
        },
        destinationCountries: {
          $sum: { $cond: ['$isDestinationCountry', 1, 0] }
        }
      }
    }
  ]);

  const regionStats = await Country.aggregate([
    { $match: { status: 'active' } },
    {
      $group: {
        _id: '$metadata.region',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  const userTypeStats = await Country.aggregate([
    { $match: { status: 'active', isDestinationCountry: true } },
    { $unwind: '$supportedUserTypes' },
    {
      $group: {
        _id: '$supportedUserTypes',
        count: { $sum: 1 }
      }
    },
    { $sort: { count: -1 } }
  ]);

  res.status(200).json({
    status: 'success',
    data: {
      overview: stats[0] || {
        totalCountries: 0,
        activeCountries: 0,
        originCountries: 0,
        destinationCountries: 0
      },
      byRegion: regionStats,
      byUserType: userTypeStats
    }
  });
});

module.exports = {
  getAllCountries,
  getOriginCountries,
  getDestinationCountries,
  getCountriesByRegion,
  checkRouteSupport,
  getCountryByCode,
  createCountry,
  updateCountry,
  deleteCountry,
  getCountryStats
};