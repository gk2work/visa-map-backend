const mongoose = require('mongoose');

/**
 * Journey Schema - Tracks user progress through visa application process
 * Integrates with frontend ProgressData interface
 */
const journeySchema = new mongoose.Schema({
  // User identification
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  email: {
    type: String,
    required: true,
    index: true
  },

  // Journey basic info
  originCountry: {
    type: String,
    required: true,
    uppercase: true,
    minlength: 2,
    maxlength: 2
  },
  destinationCountry: {
    type: String,
    required: true,
    uppercase: true,
    minlength: 2,
    maxlength: 2
  },
  userType: {
    type: String,
    enum: ['student', 'visitor', 'worker', 'family', 'business', 'other'],
    default: 'student'
  },
  visaType: {
    type: String,
    required: true
  },

  // Journey status
  status: {
    type: String,
    enum: ['started', 'in_progress', 'under_review', 'completed', 'abandoned', 'cancelled'],
    default: 'started'
  },
  phase: {
    type: String,
    enum: ['selection', 'personalization', 'preparation', 'application', 'processing', 'decision'],
    default: 'selection'
  },

  // Personalization data (matches frontend interface)
  personalizationData: {
    hasCAS: {
      type: Boolean,
      default: false
    },
    casDate: {
      type: String, // DD/MM/YYYY format to match frontend
      validate: {
        validator: function(v) {
          if (!v) return true;
          return /^\d{2}\/\d{2}\/\d{4}$/.test(v);
        },
        message: 'CAS date must be in DD/MM/YYYY format'
      }
    },
    hasATAS: {
      type: Boolean,
      default: false
    },
    requiresTBTest: {
      type: Boolean,
      default: false
    },
    studyLocation: {
      type: String,
      enum: ['london', 'outside_london', ''],
      default: ''
    },
    courseLevel: {
      type: String,
      enum: ['undergraduate', 'postgraduate', 'phd', 'other', ''],
      default: ''
    },
    hasDependent: {
      type: Boolean,
      default: false
    },
    financialSituation: {
      type: String,
      enum: ['fully_funded', 'partial_funding', 'self_funded', ''],
      default: ''
    },
    previousVisaRefusal: {
      type: Boolean,
      default: false
    },
    specialCircumstances: [{
      type: String,
      enum: ['medical_condition', 'criminal_record', 'immigration_history', 'name_change', 'other']
    }]
  },

  // Step completion tracking (matches frontend stepCompletion)
  stepCompletion: {
    type: Map,
    of: Boolean,
    default: new Map()
  },

  // Checklist state (matches frontend checklist)
  checklist: {
    type: Map,
    of: Boolean,
    default: new Map()
  },

  // Progress tracking
  progressMetrics: {
    totalSteps: {
      type: Number,
      default: 0
    },
    completedSteps: {
      type: Number,
      default: 0
    },
    completionPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100
    },
    checklistItems: {
      type: Number,
      default: 0
    },
    completedChecklistItems: {
      type: Number,
      default: 0
    }
  },

  // Timeline and due dates
  timeline: {
    estimatedCompletionDate: Date,
    casReceived: Date,
    applicationSubmitted: Date,
    biometricsScheduled: Date,
    biometricsCompleted: Date,
    decisionReceived: Date,
    visaIssued: Date
  },

  // Timestamps (matches frontend timestamps)
  timestamps: {
    journeyStarted: {
      type: Date,
      default: Date.now
    },
    lastActivity: {
      type: Date,
      default: Date.now
    },
    stepCompleted: Date,
    casAutoCompleted: Date,
    checklistUpdated: Date,
    personalizationUpdated: Date,
    applicationSubmitted: Date,
    processingSent: Date
  },

  // Metadata
  metadata: {
    deviceInfo: {
      userAgent: String,
      platform: String,
      isMobile: Boolean
    },
    sessionData: {
      totalSessions: {
        type: Number,
        default: 1
      },
      totalTimeSpent: {
        type: Number, // in minutes
        default: 0
      },
      averageSessionTime: {
        type: Number, // in minutes
        default: 0
      }
    },
    sourceInfo: {
      referralSource: {
        type: String,
        default: 'direct'
      },
      utmSource: String,
      utmMedium: String,
      utmCampaign: String
    }
  },

  // Shared data for collaboration
  isShared: {
    type: Boolean,
    default: false
  },
  sharedWith: [{
    email: String,
    permissions: {
      type: String,
      enum: ['view', 'comment', 'edit'],
      default: 'view'
    },
    sharedAt: {
      type: Date,
      default: Date.now
    }
  }],

  // Notifications and reminders
  notifications: {
    emailReminders: {
      type: Boolean,
      default: true
    },
    smsReminders: {
      type: Boolean,
      default: false
    },
    lastReminderSent: Date,
    nextReminderDue: Date,
    reminderFrequency: {
      type: String,
      enum: ['daily', 'weekly', 'biweekly'],
      default: 'weekly'
    }
  },

  // Document uploads and attachments
  documents: [{
    name: String,
    type: String,
    url: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    size: Number, // in bytes
    checksum: String
  }],

  // Notes and comments
  notes: [{
    content: String,
    createdAt: {
      type: Date,
      default: Date.now
    },
    author: {
      type: String,
      default: 'user'
    }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for performance
journeySchema.index({ userId: 1, status: 1 });
journeySchema.index({ email: 1 });
journeySchema.index({ originCountry: 1, destinationCountry: 1 });
journeySchema.index({ 'timestamps.lastActivity': -1 });
journeySchema.index({ status: 1, phase: 1 });
journeySchema.index({ createdAt: -1 });

// Virtual fields
journeySchema.virtual('isActive').get(function() {
  return ['started', 'in_progress', 'under_review'].includes(this.status);
});

journeySchema.virtual('routeKey').get(function() {
  return `${this.originCountry}-${this.destinationCountry}`;
});

journeySchema.virtual('daysSinceStart').get(function() {
  const diffTime = Math.abs(new Date() - this.timestamps.journeyStarted);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

journeySchema.virtual('daysSinceLastActivity').get(function() {
  const diffTime = Math.abs(new Date() - this.timestamps.lastActivity);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
});

// Instance methods
journeySchema.methods.updateProgress = function() {
  const stepEntries = Array.from(this.stepCompletion.entries());
  const checklistEntries = Array.from(this.checklist.entries());
  
  this.progressMetrics.completedSteps = stepEntries.filter(([, completed]) => completed).length;
  this.progressMetrics.totalSteps = stepEntries.length;
  this.progressMetrics.completedChecklistItems = checklistEntries.filter(([, completed]) => completed).length;
  this.progressMetrics.checklistItems = checklistEntries.length;
  
  const totalItems = this.progressMetrics.totalSteps + this.progressMetrics.checklistItems;
  const completedItems = this.progressMetrics.completedSteps + this.progressMetrics.completedChecklistItems;
  this.progressMetrics.completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  
  this.timestamps.lastActivity = new Date();
  return this.save();
};

journeySchema.methods.markStepCompleted = function(stepId) {
  this.stepCompletion.set(stepId, true);
  this.timestamps.stepCompleted = new Date();
  return this.updateProgress();
};

journeySchema.methods.updateChecklist = function(checklistUpdates) {
  Object.entries(checklistUpdates).forEach(([key, value]) => {
    this.checklist.set(key, value);
  });
  this.timestamps.checklistUpdated = new Date();
  return this.updateProgress();
};

journeySchema.methods.updatePersonalization = function(personalizationData) {
  this.personalizationData = { ...this.personalizationData, ...personalizationData };
  this.timestamps.personalizationUpdated = new Date();
  
  // Auto-complete steps based on CAS status (matches frontend logic)
  if (personalizationData.hasCAS) {
    this.stepCompletion.set('unconditional-offer', true);
    this.stepCompletion.set('cas', true);
    this.timestamps.casAutoCompleted = new Date();
  }
  
  return this.updateProgress();
};

journeySchema.methods.generateShareableLink = function() {
  const shareId = require('crypto').randomUUID();
  this.isShared = true;
  this.metadata.shareId = shareId;
  return shareId;
};

journeySchema.methods.addNote = function(content, author = 'user') {
  this.notes.push({ content, author });
  this.timestamps.lastActivity = new Date();
  return this.save();
};

// Static methods
journeySchema.statics.findActiveJourneys = function(userId) {
  return this.find({ 
    userId, 
    status: { $in: ['started', 'in_progress', 'under_review'] } 
  }).sort({ 'timestamps.lastActivity': -1 });
};

journeySchema.statics.findByRoute = function(originCountry, destinationCountry) {
  return this.find({ 
    originCountry: originCountry.toUpperCase(), 
    destinationCountry: destinationCountry.toUpperCase() 
  });
};

journeySchema.statics.getJourneyStats = function() {
  return this.aggregate([
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
        averageCompletion: { $avg: '$progressMetrics.completionPercentage' }
      }
    }
  ]);
};

// Pre-save middleware
journeySchema.pre('save', function(next) {
  // Update last activity timestamp
  this.timestamps.lastActivity = new Date();
  
  // Auto-calculate progress if not already done
  if (this.isModified('stepCompletion') || this.isModified('checklist')) {
    const stepEntries = Array.from(this.stepCompletion.entries());
    const checklistEntries = Array.from(this.checklist.entries());
    
    this.progressMetrics.completedSteps = stepEntries.filter(([, completed]) => completed).length;
    this.progressMetrics.totalSteps = stepEntries.length;
    this.progressMetrics.completedChecklistItems = checklistEntries.filter(([, completed]) => completed).length;
    this.progressMetrics.checklistItems = checklistEntries.length;
    
    const totalItems = this.progressMetrics.totalSteps + this.progressMetrics.checklistItems;
    const completedItems = this.progressMetrics.completedSteps + this.progressMetrics.completedChecklistItems;
    this.progressMetrics.completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
  }
  
  next();
});

module.exports = mongoose.model('Journey', journeySchema);