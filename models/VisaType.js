const mongoose = require('mongoose');

const visaTypeSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Visa type name is required'],
    trim: true,
    maxLength: [100, 'Visa name cannot exceed 100 characters']
  },
  code: {
    type: String,
    required: [true, 'Visa type code is required'],
    uppercase: true,
    trim: true,
    match: [/^[A-Z0-9_-]+$/, 'Visa code can only contain uppercase letters, numbers, underscore and dash']
  },
  category: {
    type: String,
    required: [true, 'Visa category is required'],
    enum: ['student', 'visitor', 'worker', 'business', 'family', 'transit'],
    lowercase: true
  },
  originCountry: {
    type: String,
    required: [true, 'Origin country code is required'],
    uppercase: true,
    match: [/^[A-Z]{2}$/, 'Origin country must be a 2-letter country code'],
    ref: 'Country'
  },
  destinationCountry: {
    type: String,
    required: [true, 'Destination country code is required'],
    uppercase: true,
    match: [/^[A-Z]{2}$/, 'Destination country must be a 2-letter country code'],
    ref: 'Country'
  },
  description: {
    type: String,
    required: [true, 'Visa description is required'],
    maxLength: [500, 'Description cannot exceed 500 characters']
  },
  overview: {
    type: String,
    required: [true, 'Visa overview is required'],
    maxLength: [2000, 'Overview cannot exceed 2000 characters']
  },
  eligibility: [{
    type: String,
    required: true,
    maxLength: [200, 'Eligibility criterion cannot exceed 200 characters']
  }],
  processingTime: {
    min: {
      type: Number,
      required: true,
      min: [1, 'Minimum processing time must be at least 1']
    },
    max: {
      type: Number,
      required: true,
      min: [1, 'Maximum processing time must be at least 1']
    },
    unit: {
      type: String,
      enum: ['days', 'weeks', 'months'],
      required: true,
      default: 'days'
    },
    note: {
      type: String,
      maxLength: [200, 'Processing time note cannot exceed 200 characters']
    }
  },
  fees: {
    visaFee: {
      amount: {
        type: Number,
        required: true,
        min: [0, 'Visa fee cannot be negative']
      },
      currency: {
        type: String,
        required: true,
        uppercase: true,
        match: [/^[A-Z]{3}$/, 'Currency must be 3-letter code']
      }
    },
    additionalFees: [{
      name: {
        type: String,
        required: true
      },
      amount: {
        type: Number,
        required: true,
        min: [0, 'Additional fee cannot be negative']
      },
      currency: {
        type: String,
        required: true,
        uppercase: true,
        match: [/^[A-Z]{3}$/, 'Currency must be 3-letter code']
      },
      description: String,
      isOptional: {
        type: Boolean,
        default: false
      }
    }],
    totalEstimate: {
      amount: Number,
      currency: String,
      note: String
    }
  },
  requirements: {
    documents: [{
      name: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      isRequired: {
        type: Boolean,
        default: true
      },
      category: {
        type: String,
        enum: ['identity', 'financial', 'academic', 'medical', 'professional', 'personal', 'legal'],
        required: true
      },
      validityPeriod: String,
      format: String,
      conditionalLogic: {
        showIf: {
          field: String,
          value: mongoose.Schema.Types.Mixed
        }
      }
    }],
    financialEvidence: {
      maintenanceFunds: {
        london: {
          amount: Number,
          currency: String,
          period: String // "per month", "per year"
        },
        outsideLondon: {
          amount: Number,
          currency: String,
          period: String
        }
      },
      tuitionShortfall: {
        description: String,
        requirement: String
      },
      acceptedFormats: [String]
    }
  },
  applicationProcess: {
    steps: [{
      stepNumber: {
        type: Number,
        required: true
      },
      title: {
        type: String,
        required: true
      },
      description: {
        type: String,
        required: true
      },
      action: {
        type: String,
        required: true
      },
      evidence: String,
      estimatedTime: String,
      isConditional: {
        type: Boolean,
        default: false
      },
      conditionalLogic: {
        showIf: {
          field: String,
          value: mongoose.Schema.Types.Mixed
        }
      }
    }],
    applicationMethod: {
      type: String,
      enum: ['online', 'paper', 'biometric_center', 'embassy'],
      required: true
    },
    interviewRequired: {
      type: Boolean,
      default: false
    }
  },
  officialLinks: [{
    title: {
      type: String,
      required: true
    },
    url: {
      type: String,
      required: true,
      match: [/^https?:\/\/.+/, 'URL must be valid']
    },
    description: String,
    category: {
      type: String,
      enum: ['application', 'guidelines', 'forms', 'fees', 'tracking', 'support'],
      required: true
    }
  }],
  commonMistakes: [{
    type: String,
    maxLength: [300, 'Common mistake cannot exceed 300 characters']
  }],
  specialScenarios: [{
    title: {
      type: String,
      required: true
    },
    description: {
      type: String,
      required: true
    },
    additionalDocuments: [String],
    additionalSteps: [String],
    impact: {
      type: String,
      enum: ['processing_time', 'additional_fee', 'additional_documents', 'interview_required'],
      required: true
    }
  }],
  personalization: {
    casRequired: {
      type: Boolean,
      default: false
    },
    atasRequired: {
      type: Boolean,
      default: false
    },
    tbTestRequired: {
      type: Boolean,
      default: false
    },
    customQuestions: [{
      id: String,
      question: String,
      type: {
        type: String,
        enum: ['boolean', 'date', 'select', 'text'],
        required: true
      },
      options: [String], // for select type
      impact: String
    }]
  },
  metadata: {
    popularity: {
      type: Number,
      default: 0,
      min: 0
    },
    successRate: {
      type: Number,
      min: 0,
      max: 100
    },
    averageProcessingDays: Number,
    lastUpdated: {
      type: Date,
      default: Date.now
    },
    source: {
      type: String,
      default: 'official_government'
    },
    tags: [String]
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended', 'coming_soon'],
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

// Compound indexes for performance
visaTypeSchema.index({ originCountry: 1, destinationCountry: 1, category: 1 });
visaTypeSchema.index({ destinationCountry: 1, status: 1, displayOrder: 1 });
visaTypeSchema.index({ category: 1, status: 1 });
visaTypeSchema.index({ code: 1, originCountry: 1, destinationCountry: 1 }, { unique: true });

// Virtual for route identifier
visaTypeSchema.virtual('routeId').get(function() {
  return `${this.originCountry}-${this.destinationCountry}`;
});

// Virtual for formatted processing time
visaTypeSchema.virtual('processingTimeDisplay').get(function() {
  const { min, max, unit } = this.processingTime;
  if (min === max) {
    return `${min} ${unit}`;
  }
  return `${min}-${max} ${unit}`;
});

// Virtual for total fee estimate
visaTypeSchema.virtual('totalFeeEstimate').get(function() {
  let total = this.fees.visaFee.amount;
  
  this.fees.additionalFees.forEach(fee => {
    if (!fee.isOptional) {
      // Convert to base currency if needed (simplified)
      total += fee.amount;
    }
  });
  
  return {
    amount: total,
    currency: this.fees.visaFee.currency
  };
});

// Static method to find visa types by route
visaTypeSchema.statics.findByRoute = function(originCountry, destinationCountry, category = null) {
  const query = {
    originCountry: originCountry.toUpperCase(),
    destinationCountry: destinationCountry.toUpperCase(),
    status: 'active'
  };
  
  if (category) {
    query.category = category.toLowerCase();
  }
  
  return this.find(query).sort({ displayOrder: 1, name: 1 });
};

// Static method to find popular visa types
visaTypeSchema.statics.findPopular = function(limit = 10) {
  return this.find({ status: 'active' })
    .sort({ 'metadata.popularity': -1, name: 1 })
    .limit(limit);
};

// Static method to find by category
visaTypeSchema.statics.findByCategory = function(category) {
  return this.find({ 
    category: category.toLowerCase(),
    status: 'active'
  }).sort({ 'metadata.popularity': -1, name: 1 });
};

// Instance method to check if visa requires CAS
visaTypeSchema.methods.requiresCAS = function() {
  return this.personalization.casRequired || this.category === 'student';
};

// Instance method to get required documents by category
visaTypeSchema.methods.getDocumentsByCategory = function(category) {
  return this.requirements.documents.filter(doc => 
    doc.category === category && doc.isRequired
  );
};

// Instance method to get conditional documents
visaTypeSchema.methods.getConditionalDocuments = function(userResponses = {}) {
  return this.requirements.documents.filter(doc => {
    if (!doc.conditionalLogic || !doc.conditionalLogic.showIf) {
      return true; // Show if no conditions
    }
    
    const { field, value } = doc.conditionalLogic.showIf;
    return userResponses[field] === value;
  });
};

// Instance method to get personalized steps
visaTypeSchema.methods.getPersonalizedSteps = function(userResponses = {}) {
  return this.applicationProcess.steps.filter(step => {
    if (!step.isConditional || !step.conditionalLogic) {
      return true; // Show if not conditional
    }
    
    const { field, value } = step.conditionalLogic.showIf;
    return userResponses[field] === value;
  }).sort((a, b) => a.stepNumber - b.stepNumber);
};

// Pre-save middleware to validate processing time
visaTypeSchema.pre('save', function(next) {
  if (this.processingTime.min > this.processingTime.max) {
    return next(new Error('Minimum processing time cannot be greater than maximum'));
  }
  next();
});

// Pre-save middleware to update metadata
visaTypeSchema.pre('save', function(next) {
  if (this.isModified() && !this.isNew) {
    this.metadata.lastUpdated = new Date();
  }
  next();
});

module.exports = mongoose.model('VisaType', visaTypeSchema);