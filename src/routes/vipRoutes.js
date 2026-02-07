import express from 'express';
import {
  deleteGalleryItem,
  getAllVIPs,
  getAllVVIPs,
  generateVIPReferralCode,
  getVIPReferrals,
  getVIPProfile,
  validateReferralCode,
  registerWithReferral,
  verifyCoupon,
  setVIPPassword,
  loginVIP,
  uploadGalleryItem,
  deleteVIP,
  deleteAllVIPs,
} from '../controllers/vipController.js';
import { protect, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { submitAttendance, getAttendance } from '../controllers/vipAttendanceController.js';

const router = express.Router();

// Public routes
router.post('/attendance', upload.single('photo'), submitAttendance);
router.get('/validate-referral/:code', validateReferralCode);
router.post('/register-with-referral', registerWithReferral);
router.post('/verify-coupon', verifyCoupon);
router.post('/set-password', setVIPPassword);
router.post('/login', loginVIP);

// Protected routes (VIP/VVIP users)
router.get('/profile', protect, getVIPProfile);

// Admin routes
router.get('/', protect, isAdmin, getAllVIPs);
router.get('/attendance', protect, isAdmin, getAttendance);
router.get('/vvip', protect, isAdmin, getAllVVIPs);
router.post('/:id/generate-referral', protect, isAdmin, generateVIPReferralCode);
router.get('/:id/referrals', protect, isAdmin, getVIPReferrals);
router.post('/gallery/:userId', protect, isAdmin, upload.single('image'), uploadGalleryItem);
router.delete('/gallery/:userId', protect, isAdmin, deleteGalleryItem);
router.delete('/delete-all', protect, isAdmin, deleteAllVIPs);
router.delete('/:id', protect, isAdmin, deleteVIP);

export default router;

