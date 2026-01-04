import express from 'express';
import {
  createLottery,
  registerParticipant,
  getParticipants,
  executeSpin,
  getLotteryStatus,
  getActiveLottery,
  getWinner,
  getRoundDetails,
  getLotteryHistory,
  deleteLottery,
} from '../controllers/lotteryController.js';
import {
  seedParticipantsFromUsers,
  getSeedStatus,
} from '../controllers/seedController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/active', getActiveLottery);
router.get('/:lotteryId/status', getLotteryStatus);
router.get('/:lotteryId/winner', getWinner);
router.get('/:lotteryId/round/:roundNumber', getRoundDetails);

// Protected routes (authenticated users)
router.post('/:lotteryId/register', protect, registerParticipant);

// Admin routes
router.post('/create', protect, isAdmin, createLottery);
router.get('/:lotteryId/participants', protect, isAdmin, getParticipants);
router.post('/:lotteryId/spin', protect, isAdmin, executeSpin);
router.delete('/:lotteryId', protect, isAdmin, deleteLottery);

// Seed routes (Admin only)
router.post('/seed/participants', protect, isAdmin, seedParticipantsFromUsers);
router.get('/history', protect, isAdmin, getLotteryHistory);
router.get('/seed/status', protect, isAdmin, getSeedStatus);

export default router;
