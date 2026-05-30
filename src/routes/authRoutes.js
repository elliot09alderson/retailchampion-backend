import express from 'express';
import { loginUser, getMe, updateProfile, getContestWinner, setContestWinner } from '../controllers/authController.js';
import { protect, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

// @route   POST /api/auth/login
// @desc    Login user & get token
router.post('/login', loginUser);

// @route   GET /api/auth/me
// @desc    Get current logged in user
router.get('/me', protect, getMe);

// @route   PUT /api/auth/profile
// @desc    Update admin profile (organization name, picture)
router.put('/profile', protect, isAdmin, upload.single('profilePicture'), updateProfile);

// @route   GET /api/auth/contest-winner
// @desc    Get secret contest winner phone override
router.get('/contest-winner', protect, isAdmin, getContestWinner);

// @route   PUT /api/auth/contest-winner
// @desc    Set or clear secret contest winner phone override
router.put('/contest-winner', protect, isAdmin, setContestWinner);

export default router;
