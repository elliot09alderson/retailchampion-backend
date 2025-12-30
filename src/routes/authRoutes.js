import express from 'express';
import { loginUser, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Login user & get token
router.post('/login', loginUser);

// @route   GET /api/auth/me
// @desc    Get current logged in user
router.get('/me', protect, getMe);

export default router;
