module.exports = require('express').Router();
const express = require('express');
const router = express.Router();
const {
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
} = require('../controllers/journeyController');
const { protect, authorize } = require('../middleware/auth');
const { validateRequest, journeyValidation } = require('../middleware/validation');

/**
 * Journey Routes
 * All routes require authentication
 */

// Progress tracking route (public - matches frontend loadProgress function)
router.get('/progress/:email', getJourneyProgress);

// Journey statistics (admin only)
router.get('/stats', protect, authorize('admin'), getJourneyStats);

// Main journey routes (protected)
router.use(protect);

// Create or update journey (matches frontend saveProgress function)
router.post('/', 
  validateRequest(journeyValidation.createOrUpdate), 
  createOrUpdateJourney
);

// Get user's journeys
router.get('/', getUserJourneys);

// Journey-specific routes
router.route('/:id')
  .get(getJourneyById)
  .delete(deleteJourney);

// Update specific journey aspects
router.patch('/:id/steps/:stepId', 
  validateRequest(journeyValidation.updateStep), 
  updateStepCompletion
);

router.patch('/:id/checklist', 
  validateRequest(journeyValidation.updateChecklist), 
  updateJourneyChecklist
);

router.patch('/:id/personalization', 
  validateRequest(journeyValidation.updatePersonalization), 
  updateJourneyPersonalization
);

// Journey sharing
router.post('/:id/share', 
  validateRequest(journeyValidation.shareJourney), 
  shareJourney
);

// Journey notes
router.post('/:id/notes', 
  validateRequest(journeyValidation.addNote), 
  addJourneyNote
);

module.exports = router;