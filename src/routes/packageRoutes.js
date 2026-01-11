import express from 'express';
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
} from '../controllers/packageController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public route
router.get('/', getPackages);

// Admin routes
router.post('/', protect, isAdmin, createPackage);
router.put('/:id', protect, isAdmin, updatePackage);
router.delete('/:id', protect, isAdmin, deletePackage);

export default router;
