const Contact = require('../models/Contact');
const User = require('../models/User');
const AppError = require('../middleware/errorHandler').AppError;
const logger = require('../utils/logger');
const emailService = require('../services/emailService');

/**
 * Contact Controller - Handles contact form submissions and lead management
 */

/**
 * Submit contact form
 * POST /api/v1/contact
 */
const submitContactForm = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      mobile,
      dialingCode,
      contactType,
      priority,
      subject,
      message,
      visaContext,
      leadData,
      preferences
    } = req.body;

    // Extract metadata from request
    const metadata = {
      userAgent: req.get('User-Agent'),
      ipAddress: req.ip || req.connection.remoteAddress,
      referrer: req.get('Referer'),
      utmParams: {
        source: req.query.utm_source,
        medium: req.query.utm_medium,
        campaign: req.query.utm_campaign,
        term: req.query.utm_term,
        content: req.query.utm_content
      },
      deviceInfo: {
        isMobile: /mobile/i.test(req.get('User-Agent')),
        browser: req.get('User-Agent')?.match(/(firefox|msie|chrome|safari|opera)/i)?.[0],
        os: req.get('sec-ch-ua-platform')?.replace(/"/g, '')
      }
    };

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser && leadData) {
      leadData.isExistingUser = true;
    }

    // Create contact
    const contact = new Contact({
      firstName,
      lastName,
      email,
      mobile,
      dialingCode,
      contactType: contactType || 'general_inquiry',
      priority: priority || 'medium',
      subject,
      message,
      visaContext: visaContext || {},
      leadData: {
        isExistingUser: existingUser ? true : false,
        leadSource: 'website',
        ...leadData
      },
      preferences: preferences || {},
      metadata,
      submittedAt: new Date()
    });

    // Calculate lead score
    contact.calculateLeadScore();

    // Auto-assign high priority contacts
    if (contact.priority === 'urgent' || contact.leadData.leadScore >= 80) {
      const availableAgent = await User.findOne({ 
        role: 'admin',
        status: 'active' 
      }).sort({ createdAt: 1 });
      
      if (availableAgent) {
        contact.assignedTo = availableAgent._id;
      }
    }

    // Schedule initial follow-up
    contact.scheduleFollowUp(1); // Follow up in 1 day

    await contact.save();

    // Send confirmation email to user
    try {
      await emailService.sendContactConfirmation(contact);
    } catch (emailError) {
      logger.error('Failed to send contact confirmation email:', emailError);
      // Don't fail the request if email fails
    }

    // Send notification to admin for high priority contacts
    if (contact.priority === 'urgent' || contact.leadData.leadScore >= 80) {
      try {
        await emailService.sendAdminNotification(contact);
      } catch (emailError) {
        logger.error('Failed to send admin notification:', emailError);
      }
    }

    logger.info('Contact form submitted successfully', {
      contactId: contact._id,
      email: contact.email,
      contactType: contact.contactType,
      leadScore: contact.leadData.leadScore
    });

    res.status(201).json({
      status: 'success',
      message: 'Thank you for contacting us. We will get back to you soon!',
      data: {
        contact: {
          id: contact._id,
          submittedAt: contact.submittedAt,
          leadScore: contact.leadData.leadScore,
          followUpDate: contact.followUp.nextFollowUpDate
        }
      }
    });

  } catch (error) {
    logger.error('Error submitting contact form:', error);
    next(new AppError('Failed to submit contact form', 500));
  }
};

/**
 * Get all contacts (Admin only)
 * GET /api/v1/contact
 */
const getAllContacts = async (req, res, next) => {
  try {
    const {
      status,
      contactType,
      priority,
      assignedTo,
      leadScore,
      page = 1,
      limit = 20,
      sortBy = 'submittedAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter query
    let filterQuery = {};
    
    if (status) filterQuery.status = status;
    if (contactType) filterQuery.contactType = contactType;
    if (priority) filterQuery.priority = priority;
    if (assignedTo) filterQuery.assignedTo = assignedTo;
    if (leadScore) {
      filterQuery['leadData.leadScore'] = { $gte: parseInt(leadScore) };
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortOptions = {};
    sortOptions[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get contacts with pagination
    const contacts = await Contact.find(filterQuery)
      .populate('assignedTo', 'firstName lastName email')
      .sort(sortOptions)
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Contact.countDocuments(filterQuery);

    res.status(200).json({
      status: 'success',
      data: {
        contacts,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(total / parseInt(limit)),
          totalContacts: total,
          hasNext: skip + contacts.length < total,
          hasPrev: parseInt(page) > 1
        }
      }
    });

  } catch (error) {
    logger.error('Error retrieving contacts:', error);
    next(new AppError('Failed to retrieve contacts', 500));
  }
};

/**
 * Get contact by ID
 * GET /api/v1/contact/:id
 */
const getContactById = async (req, res, next) => {
  try {
    const contact = await Contact.findById(req.params.id)
      .populate('assignedTo', 'firstName lastName email')
      .populate('responses.respondedBy', 'firstName lastName email')
      .populate('resolution.resolvedBy', 'firstName lastName email');

    if (!contact) {
      return next(new AppError('Contact not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        contact
      }
    });

  } catch (error) {
    logger.error('Error retrieving contact:', error);
    next(new AppError('Failed to retrieve contact', 500));
  }
};

/**
 * Update contact
 * PATCH /api/v1/contact/:id
 */
const updateContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return next(new AppError('Contact not found', 404));
    }

    // Update allowed fields
    const allowedUpdates = ['status', 'priority', 'assignedTo', 'tags', 'resolution'];
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        contact[field] = updates[field];
      }
    });

    await contact.save();

    logger.info('Contact updated', {
      contactId: contact._id,
      updatedBy: req.user.email,
      updates: Object.keys(updates)
    });

    res.status(200).json({
      status: 'success',
      message: 'Contact updated successfully',
      data: {
        contact
      }
    });

  } catch (error) {
    logger.error('Error updating contact:', error);
    next(new AppError('Failed to update contact', 500));
  }
};

/**
 * Assign contact to user
 * PATCH /api/v1/contact/:id/assign
 */
const assignContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return next(new AppError('Contact not found', 404));
    }

    if (assignedTo) {
      const user = await User.findById(assignedTo);
      if (!user) {
        return next(new AppError('User not found', 404));
      }
    }

    await contact.assignTo(assignedTo);

    logger.info('Contact assigned', {
      contactId: contact._id,
      assignedTo,
      assignedBy: req.user.email
    });

    res.status(200).json({
      status: 'success',
      message: 'Contact assigned successfully',
      data: {
        contact
      }
    });

  } catch (error) {
    logger.error('Error assigning contact:', error);
    next(new AppError('Failed to assign contact', 500));
  }
};

/**
 * Add response to contact
 * POST /api/v1/contact/:id/response
 */
const addContactResponse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { content, responseType = 'email', isInternal = false } = req.body;

    const contact = await Contact.findById(id);
    if (!contact) {
      return next(new AppError('Contact not found', 404));
    }

    await contact.addResponse(req.user._id, content, responseType, isInternal);

    // Update status if this is the first response
    if (contact.status === 'new') {
      await contact.updateStatus('contacted');
    }

    // Send email response if not internal
    if (!isInternal && responseType === 'email') {
      try {
        await emailService.sendContactResponse(contact, content);
      } catch (emailError) {
        logger.error('Failed to send email response:', emailError);
      }
    }

    logger.info('Response added to contact', {
      contactId: contact._id,
      respondedBy: req.user.email,
      responseType,
      isInternal
    });

    res.status(201).json({
      status: 'success',
      message: 'Response added successfully',
      data: {
        contact
      }
    });

  } catch (error) {
    logger.error('Error adding contact response:', error);
    next(new AppError('Failed to add response', 500));
  }
};

/**
 * Get contact statistics
 * GET /api/v1/contact/stats
 */
const getContactStats = async (req, res, next) => {
  try {
    const { timeframe = '30d' } = req.query;

    // Get basic stats
    const basicStats = await Contact.getContactStats(timeframe);

    // Get status distribution
    const statusStats = await Contact.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get contact type distribution
    const typeStats = await Contact.aggregate([
      {
        $group: {
          _id: '$contactType',
          count: { $sum: 1 }
        }
      }
    ]);

    // Get top routes
    const routeStats = await Contact.aggregate([
      {
        $match: {
          'visaContext.originCountry': { $exists: true },
          'visaContext.destinationCountry': { $exists: true }
        }
      },
      {
        $group: {
          _id: {
            origin: '$visaContext.originCountry',
            destination: '$visaContext.destinationCountry'
          },
          count: { $sum: 1 },
          avgLeadScore: { $avg: '$leadData.leadScore' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get overdue follow-ups
    const overdueFollowUps = await Contact.findOverdueFollowUps();

    // Get high priority contacts
    const highPriorityContacts = await Contact.findHighPriorityContacts();

    res.status(200).json({
      status: 'success',
      data: {
        overview: basicStats[0] || {
          totalContacts: 0,
          newContacts: 0,
          resolvedContacts: 0,
          averageLeadScore: 0,
          averageResponseTime: 0
        },
        statusDistribution: statusStats,
        typeDistribution: typeStats,
        topRoutes: routeStats,
        overdueFollowUps: overdueFollowUps.length,
        highPriorityContacts: highPriorityContacts.length
      }
    });

  } catch (error) {
    logger.error('Error getting contact stats:', error);
    next(new AppError('Failed to retrieve contact statistics', 500));
  }
};

/**
 * Get overdue follow-ups
 * GET /api/v1/contact/overdue
 */
const getOverdueFollowUps = async (req, res, next) => {
  try {
    const overdueContacts = await Contact.findOverdueFollowUps()
      .populate('assignedTo', 'firstName lastName email')
      .limit(50);

    res.status(200).json({
      status: 'success',
      data: {
        overdueContacts,
        count: overdueContacts.length
      }
    });

  } catch (error) {
    logger.error('Error getting overdue follow-ups:', error);
    next(new AppError('Failed to retrieve overdue follow-ups', 500));
  }
};

/**
 * Get high priority contacts
 * GET /api/v1/contact/high-priority
 */
const getHighPriorityContacts = async (req, res, next) => {
  try {
    const highPriorityContacts = await Contact.findHighPriorityContacts()
      .populate('assignedTo', 'firstName lastName email')
      .limit(50);

    res.status(200).json({
      status: 'success',
      data: {
        highPriorityContacts,
        count: highPriorityContacts.length
      }
    });

  } catch (error) {
    logger.error('Error getting high priority contacts:', error);
    next(new AppError('Failed to retrieve high priority contacts', 500));
  }
};

/**
 * Bulk update contacts
 * PATCH /api/v1/contact/bulk
 */
const bulkUpdateContacts = async (req, res, next) => {
  try {
    const { contactIds, updates } = req.body;

    if (!contactIds || !Array.isArray(contactIds) || contactIds.length === 0) {
      return next(new AppError('Contact IDs are required', 400));
    }

    const result = await Contact.updateMany(
      { _id: { $in: contactIds } },
      { 
        ...updates,
        lastUpdatedAt: new Date()
      }
    );

    logger.info('Bulk contact update', {
      updatedCount: result.modifiedCount,
      updatedBy: req.user.email,
      updates
    });

    res.status(200).json({
      status: 'success',
      message: `${result.modifiedCount} contacts updated successfully`,
      data: {
        modifiedCount: result.modifiedCount
      }
    });

  } catch (error) {
    logger.error('Error in bulk update:', error);
    next(new AppError('Failed to update contacts', 500));
  }
};

module.exports = {
  submitContactForm,
  getAllContacts,
  getContactById,
  updateContact,
  assignContact,
  addContactResponse,
  getContactStats,
  getOverdueFollowUps,
  getHighPriorityContacts,
  bulkUpdateContacts
};