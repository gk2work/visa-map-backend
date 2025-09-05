const mongoose = require('mongoose');

const countrySchema = new mongoose.Schema({
  code: {
    type: String,
    required: [true, 'Country code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    match: [/^[A-Z]{2}$/, 'Country code must be exactly 2 uppercase letters (e.g., IN, GB, US)']
  },
  name: {
    type: String,
    required: [true, 'Country name is required'],
    trim: true,
    maxLength: [100, 'Country name cannot exceed 100 characters']
  },
  flag: {
    type: String,
    required: [true, 'Flag emoji is required'],
    trim: true
  },
  isOriginCountry: {
    type: Boolean,
    default: false,
    index: true
  },
  isDestinationCountry: {
    type: Boolean,
    default: false,
    index: true
  },
  supportedUserTypes: [{
    type: String,
    enum: ['student', 'visitor', 'worker'],
    lowercase: true
  }],
  dialingCode: {
    type: String,
    required: [true, 'Dialing code is required'],
    match: [/^\+\d{1,4}$/, 'Dialing code must be in format +XX or +XXX']
  },
  currency: {
    code: {
      type: String,
      required: true,
      uppercase: true,
      match: [/^[A-Z]{3}$/, 'Currency code must be 3 uppercase letters']
    },
    symbol: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  timezone: {
    type: String,
    default: 'UTC'
  },
  language: {
    primary: {
      type: String,
      required: true,
      default: 'en'
    },
    supported: [{
      type: String,
      default: ['en']
    }]
  },
  visaRequirements: {
    generalInfo: {
      type: String,
      default: ''
    },
    processingTimeRange: {
      min: {
        type: Number,
        default: 1
      },
      max: {
        type: Number,
        default: 30
      },
      unit: {
        type: String,
        enum: ['days', 'weeks', 'months'],
        default: 'days'
      }
    }
  },
  metadata: {
    region: {
      type: String,
      enum: ['Asia', 'Europe', 'North America', 'South America', 'Africa', 'Oceania', 'Middle East'],
      required: true
    },
    subRegion: {
      type: String
    },
    capital: {
      type: String
    },
    population: {
      type: Number
    },
    gdpPerCapita: {
      type: Number
    }
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'active',
    index: true
  },
  displayOrder: {
    type: Number,
    default: 0,
    index: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
countrySchema.index({ code: 1 });
countrySchema.index({ isOriginCountry: 1, status: 1 });
countrySchema.index({ isDestinationCountry: 1, status: 1 });
countrySchema.index({ displayOrder: 1, name: 1 });
countrySchema.index({ 'metadata.region': 1 });

// Virtual for full display name with flag
countrySchema.virtual('displayName').get(function() {
  return `${this.flag} ${this.name}`;
});

// Virtual for checking if country supports visa applications
countrySchema.virtual('supportsVisaApplications').get(function() {
  return this.isDestinationCountry && this.status === 'active';
});

// Static method to get origin countries
countrySchema.statics.getOriginCountries = function() {
  return this.find({
    isOriginCountry: true,
    status: 'active'
  }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get destination countries
countrySchema.statics.getDestinationCountries = function() {
  return this.find({
    isDestinationCountry: true,
    status: 'active'
  }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get countries by region
countrySchema.statics.getByRegion = function(region) {
  return this.find({
    'metadata.region': region,
    status: 'active'
  }).sort({ displayOrder: 1, name: 1 });
};

// Static method to get supported route
countrySchema.statics.getSupportedRoute = function(originCode, destinationCode) {
  return this.find({
    $or: [
      { code: originCode, isOriginCountry: true },
      { code: destinationCode, isDestinationCountry: true }
    ],
    status: 'active'
  });
};

// Instance method to check if country supports user type
countrySchema.methods.supportsUserType = function(userType) {
  return this.supportedUserTypes.includes(userType.toLowerCase());
};

// Instance method to get visa processing time display
countrySchema.methods.getProcessingTimeDisplay = function() {
  const { min, max, unit } = this.visaRequirements.processingTimeRange;
  
  if (min === max) {
    return `${min} ${unit}`;
  }
  
  return `${min}-${max} ${unit}`;
};

// Pre-save middleware to ensure at least one country type is set
countrySchema.pre('save', function(next) {
  if (!this.isOriginCountry && !this.isDestinationCountry) {
    return next(new Error('Country must be either an origin country, destination country, or both'));
  }
  next();
});

// Pre-save middleware to validate supported user types
countrySchema.pre('save', function(next) {
  if (this.isDestinationCountry && this.supportedUserTypes.length === 0) {
    return next(new Error('Destination countries must support at least one user type'));
  }
  next();
});

module.exports = mongoose.model('Country', countrySchema);