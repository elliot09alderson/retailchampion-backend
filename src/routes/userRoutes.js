import express from 'express';
import upload from '../middleware/upload.js';
import { protect } from '../middleware/auth.js';
import {
  registerUser,
  getUsers,
  getUserById,
  deleteUser,
} from '../controllers/userController.js';

const router = express.Router();

// @route   POST /api/users/register
// @desc    Register a new user with image upload
// @access  Public
router.post('/register', upload.single('image'), registerUser);

// @route   GET /api/users
// @desc    Get all users with search, filter, and pagination
// @access  Private (requires auth header)
router.get('/', protect, getUsers);

// @route   GET /api/users/:id
// @desc    Get user by ID
// @access  Private (requires auth header)
router.get('/:id', protect, getUserById);

// @route   DELETE /api/users/:id
// @desc    Delete user by ID
// @access  Private (requires auth header)
router.delete('/:id', protect, deleteUser);

export default router;
