const mongoose = require('mongoose');

/**
 * Contact Schema - Lead capture and contact form management
 */
const contactSchema = new mongoose.Schema({
  // Contact basic info
  firstName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  lastName: {
    type: String,
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 50
  },
  email: {
    type: String,
    required: true,
    lowercase: true,
    index: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  mobile: {
    type: String,
    required: true,
    validate: {
      validator: function(v) {
        return /^[0-9]{7,15}$/.test(v);
      },
      message: 'Please provide a valid mobile number'
    }
  },
  dialingCode: {
    type: String,
    required: true,
    match: [/^\+\d{1,4}$/, 'Please provide a valid dialing code']
  },

  // Contact purpose
  contactType: {
    type: String,
    enum: ['general_inquiry', 'visa_guidance', 'technical_support', 'partnership', 'feedback', 'complaint', 'other'],
    default: 'general_inquiry'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  subject: {
    type: String,
    required: true,
    trim: true,
    minlength: 5,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },

  // Visa-related context
  visaContext: {
    originCountry: {
      type: String,
      uppercase: true,
      minlength: 2,
      maxlength: 2
    },
    destinationCountry: {
      type: String,
      uppercase: true,
      minlength: 2,
      maxlength: 2
    },
    visaType: String,
    applicationStage: {
      type: String,
      enum: ['planning', 'preparing', 'applied', 'processing', 'decision', 'completed']
    },
    urgency: {
      type: String,
      enum: ['immediate', 'within_week', 'within_month', 'no_urgency']
    }
  },

  // Lead qualification
  leadData: {
    isExistingUser: {
      type: Boolean,
      default: false
    },
    hasStartedJourney: {
      type: Boolean,
      default: false
    },
    interestedInServices: [{
      type: String,
      enum: ['visa_guidance', 'document_review', 'application_assistance', 'interview_prep', 'other']
    }],
    budget: {
      type: String,
      enum: ['under_100', '100_500', '500_1000', '1000_plus', 'not_disclosed']
    },
    timeline: {
      type: String,
      enum: ['immediate', 'within_month', 'within_3months', 'more_than_3months']
    },
    leadScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 0
    },
    leadSource: {
      type: String,
      enum: ['website', 'referral', 'social_media', 'advertisement', 'search_engine', 'other'],
      default: 'website'
    }
  },

  // Contact status and management
  status: {
    type: String,
    enum: ['new', 'contacted', 'in_progress', 'resolved', 'closed', 'spam'],
    default: 'new'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  tags: [{
    type: String,
    lowercase: true,
    trim: true
  }],

  // Response tracking
  responses: [{
    respondedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    responseType: {
      type: String,
      enum: ['email', 'phone', 'sms', 'in_person', 'other'],
      default: 'email'
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    responseDate: {
      type: Date,
      default: Date.now
    },
    isInternal: {
      type: Boolean,
      default: false
    }
  }],

  // Follow-up tracking
  followUp: {
    nextFollowUpDate: Date,
    followUpCount: {
      type: Number,
      default: 0
    },
    lastContactedDate: Date,
    preferredContactMethod: {
      type: String,
      enum: ['email', 'phone', 'sms'],
      default: 'email'
    },
    bestTimeToContact: String,
    timezone: {
      type: String,
      default: 'UTC'
    }
  },

  // Communication preferences
  preferences: {
    subscribeToNewsletter: {
      type: Boolean,
      default: false
    },
    allowMarketing: {
      type: Boolean,
      default: false
    },
    preferredLanguage: {
      type: String,
      default: 'en'
    },
    communicationChannel: {
      type: String,
      enum: ['email', 'phone', 'sms', 'whatsapp'],
      default: 'email'
    }
  },

  // Metadata
  metadata: {
    userAgent: String,
    ipAddress: String,
    referrer: String,
    utmParams: {
      source: String,
      medium: String,
      campaign: String,
      term: String,
      content: String
    },
    deviceInfo: {
      isMobile: Boolean,
      browser: String,
      os: String
    },
    geolocation: {
      country: String,
      city: String,
      timezone: String
    }
  },

  // Resolution
  resolution: {
    isResolved: {
      type: Boolean,
      default: false
    },
    resolutionDate: Date,
    resolutionSummary: String,
    customerSatisfaction: {
      type: Number,
      min: 1,
      max: 5
    },
    resolutionTime: Number, // in hours
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },

  // Timestamps
  submittedAt: {
    type: Date,
    default: Date.now
  },
  lastUpdatedAt: {
    type: Date,
    default: Date.now
  },
  firstResponseAt: Date,
  lastResponseAt: Date
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
contactSchema.index({ email: 1 });
contactSchema.index({ status: 1 });
contactSchema.index({ submittedAt: -1 });
contactSchema.index({ assignedTo: 1, status: 1 });
contactSchema.index({ contactType: 1 });
contactSchema.index({ 'visaContext.originCountry': 1, 'visaContext.destinationCountry': 1 });
contactSchema.index({ 'leadData.leadScore': -1 });
contactSchema.index({ 'followUp.nextFollowUpDate': 1 });

// Virtual fields
contactSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

contactSchema.virtual('phoneNumber').get(function() {
  return `${this.dialingCode}${this.mobile}`;
});

contactSchema.virtual('responseCount').get(function() {
  return this.responses.length;
});

contactSchema.virtual('daysSinceSubmission').get(function() {
  const diffTime = Math.abs(new Date() - this.submittedAt);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

contactSchema.virtual('isOverdue').get(function() {
  if (!this.followUp.nextFollowUpDate) return false;
  return new Date() > this.followUp.nextFollowUpDate;
});

// Instance methods
contactSchema.methods.addResponse = function(respondedBy, content, responseType = 'email', isInternal = false) {
  this.responses.push({
    respondedBy,
    content,
    responseType,
    isInternal,
    responseDate: new Date()
  });
  
  this.lastResponseAt = new Date();
  this.followUp.lastContactedDate = new Date();
  this.followUp.followUpCount += 1;
  
  if (!this.firstResponseAt) {
    this.firstResponseAt = new Date();
  }
  
  this.lastUpdatedAt = new Date();
  return this.save();
};

contactSchema.methods.assignTo = function(userId) {
  this.assignedTo = userId;
  this.lastUpdatedAt = new Date();
  return this.save();
};

contactSchema.methods.updateStatus = function(newStatus) {
  this.status = newStatus;
  this.lastUpdatedAt = new Date();
  
  if (newStatus === 'resolved' || newStatus === 'closed') {
    this.resolution.isResolved = true;
    this.resolution.resolutionDate = new Date();
    
    if (this.firstResponseAt) {
      const diffTime = Math.abs(new Date() - this.submittedAt);
      this.resolution.resolutionTime = Math.round(diffTime / (1000 * 60 * 60)); // in hours
    }
  }
  
  return this.save();
};

contactSchema.methods.calculateLeadScore = function() {
  let score = 0;
  
  // Base score for complete contact info
  score += 20;
  
  // Visa context completeness
  if (this.visaContext.originCountry && this.visaContext.destinationCountry) score += 15;
  if (this.visaContext.visaType) score += 10;
  if (this.visaContext.applicationStage) score += 10;
  
  // Lead qualification
  if (this.leadData.isExistingUser) score += 15;
  if (this.leadData.hasStartedJourney) score += 20;
  if (this.leadData.interestedInServices.length > 0) score += 10;
  
  // Urgency and timeline
  if (this.visaContext.urgency === 'immediate') score += 15;
  else if (this.visaContext.urgency === 'within_week') score += 10;
  
  if (this.leadData.timeline === 'immediate') score += 10;
  else if (this.leadData.timeline === 'within_month') score += 5;
  
  // Message quality (longer messages indicate higher engagement)
  if (this.message.length > 100) score += 5;
  if (this.message.length > 300) score += 5;
  
  this.leadData.leadScore = Math.min(score, 100);
  return this.leadData.leadScore;
};

contactSchema.methods.scheduleFollowUp = function(days = 7) {
  const followUpDate = new Date();
  followUpDate.setDate(followUpDate.getDate() + days);
  this.followUp.nextFollowUpDate = followUpDate;
  this.lastUpdatedAt = new Date();
  return this.save();
};

// Static methods
contactSchema.statics.findOverdueFollowUps = function() {
  return this.find({
    'followUp.nextFollowUpDate': { $lt: new Date() },
    status: { $in: ['new', 'contacted', 'in_progress'] }
  }).sort({ 'followUp.nextFollowUpDate': 1 });
};

contactSchema.statics.findHighPriorityContacts = function() {
  return this.find({
    $or: [
      { priority: 'urgent' },
      { priority: 'high' },
      { 'leadData.leadScore': { $gte: 80 } }
    ],
    status: { $in: ['new', 'contacted', 'in_progress'] }
  }).sort({ priority: 1, 'leadData.leadScore': -1 });
};

contactSchema.statics.getContactStats = function(timeframe = '30d') {
  const now = new Date();
  let dateFilter = {};
  
  switch (timeframe) {
    case '7d':
      dateFilter = { submittedAt: { $gte: new Date(now - 7 * 24 * 60 * 60 * 1000) } };
      break;
    case '30d':
      dateFilter = { submittedAt: { $gte: new Date(now - 30 * 24 * 60 * 60 * 1000) } };
      break;
    case '90d':
      dateFilter = { submittedAt: { $gte: new Date(now - 90 * 24 * 60 * 60 * 1000) } };
      break;
  }
  
  return this.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: null,
        totalContacts: { $sum: 1 },
        newContacts: {
          $sum: { $cond: [{ $eq: ['$status', 'new'] }, 1, 0] }
        },
        resolvedContacts: {
          $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] }
        },
        averageLeadScore: { $avg: '$leadData.leadScore' },
        averageResponseTime: { $avg: '$resolution.resolutionTime' }
      }
    }
  ]);
};

// Pre-save middleware
contactSchema.pre('save', function(next) {
  this.lastUpdatedAt = new Date();
  
  // Calculate lead score if not set
  if (this.leadData.leadScore === 0) {
    this.calculateLeadScore();
  }
  
  next();
});

module.exports = mongoose.model('Contact', contactSchema);