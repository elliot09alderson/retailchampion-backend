import express from 'express';
import {
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
} from '../controllers/vipController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/validate-referral/:code', validateReferralCode);
router.post('/register-with-referral', registerWithReferral);
router.post('/verify-coupon', verifyCoupon);
router.post('/set-password', setVIPPassword);
router.post('/login', loginVIP);

// Protected routes (VIP/VVIP users)
router.get('/profile', protect, getVIPProfile);

// Admin routes
router.get('/', protect, isAdmin, getAllVIPs);
router.get('/vvip', protect, isAdmin, getAllVVIPs);
router.post('/:id/generate-referral', protect, isAdmin, generateVIPReferralCode);
router.get('/:id/referrals', protect, isAdmin, getVIPReferrals);

export default router;

