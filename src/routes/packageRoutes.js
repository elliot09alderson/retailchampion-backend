import express from 'express';
import {
  getPackages,
  createPackage,
  updatePackage,
  deletePackage,
} from '../controllers/packageController.js';
import { protect, isAdmin } from '../middleware/auth.js';

// Optional auth: attaches req.user if token present, but doesn't block if not
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      await protect(req, res, () => {});
    } catch {
      // Ignore auth errors for optional routes
    }
  }
  next();
};

const router = express.Router();

// Public route (with optional auth for tenant filtering in admin panel)
router.get('/', optionalAuth, getPackages);

// Admin routes
router.post('/', protect, isAdmin, createPackage);
router.put('/:id', protect, isAdmin, updatePackage);
router.delete('/:id', protect, isAdmin, deletePackage);

export default router;
