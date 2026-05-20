import express from 'express';
import { protect, isSuperAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import {
  registerAdmin,
  getAllAdmins,
  getAdminById,
  updateAdminStatus,
  deleteAdmin,
  getDashboardStats,
  resetAdminPassword,
} from '../controllers/superAdminController.js';

const router = express.Router();

// All routes require superadmin authentication
router.use(protect, isSuperAdmin);

// Dashboard stats
router.get('/stats', getDashboardStats);

// Admin CRUD
router.post('/admins', upload.single('profilePicture'), registerAdmin);
router.get('/admins', getAllAdmins);
router.get('/admins/:id', getAdminById);
router.patch('/admins/:id/status', updateAdminStatus);
router.patch('/admins/:id/password', resetAdminPassword);
router.delete('/admins/:id', deleteAdmin);

export default router;
