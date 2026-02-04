import express from 'express';
import { generatePins, getPins, validatePin, getPinStats } from '../controllers/pinController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route to validate pin
router.post('/validate', validatePin);

// Admin routes
router.post('/generate', protect, isAdmin, generatePins);
router.get('/stats', protect, isAdmin, getPinStats);
router.get('/', protect, isAdmin, getPins);

export default router;
