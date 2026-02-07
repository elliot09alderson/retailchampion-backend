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
  deleteAllLotteries,
  getSelectableLotteries,
  getPublicWinners
} from '../controllers/lotteryController.js';
import {
  seedParticipantsFromUsers,
  getSeedStatus,
} from '../controllers/seedController.js';
import { protect, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes
router.get('/public/winners', protect, getPublicWinners);
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
router.delete('/history/all', protect, isAdmin, deleteAllLotteries);

// Seed routes (Admin only)
router.post('/seed/participants', protect, isAdmin, seedParticipantsFromUsers);
router.get('/history', protect, isAdmin, getLotteryHistory);
router.get('/selectable', protect, isAdmin, getSelectableLotteries);
router.get('/seed/status', protect, isAdmin, getSeedStatus);

export default router;
