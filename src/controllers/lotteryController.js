import crypto from 'crypto';
import Lottery from '../models/Lottery.js';
import LotteryParticipant from '../models/LotteryParticipant.js';
import LotteryRound from '../models/LotteryRound.js';
import User from '../models/User.js';
import { performSpinLogic } from '../services/lotteryEngine.js';

// Secure random selection using crypto
const selectRandomUsers = (users, count) => {
  const shuffled = [...users].sort(() => {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff;
    return randomValue - 0.5;
  });
  return shuffled.slice(0, count);
};

// Get elimination count for each round - DYNAMICALLY SCALED
const getEliminationCount = (roundNumber, totalActive) => {
  // We want to reach 1 winner over 4 rounds
  // Strategy:
  // Round 1: Target ~50% of whatever we have
  // Round 2: Target ~25% of whatever we have
  // Round 3: Target ~5% (or at least 2)
  // Round 4: Target exactly 1
  
  switch (roundNumber) {
    case 1: 
      return Math.floor(totalActive * 0.5); 
    case 2: 
      // If we are at ~50% from R1, this takes it to ~25%
      return Math.floor(totalActive * 0.5); 
    case 3: 
      // We want to leave a small pool for the final spin (e.g., ~15-20 people)
      // Ensure we have enough for 5 winners + some losers
      const targetSurvivors = Math.max(10, Math.ceil(totalActive * 0.2)); 
      return Math.max(0, totalActive - targetSurvivors);
    case 4: 
      // The grand finale: eliminate everyone except 5 champions
      // If we have 5 or less, we don't eliminate anyone (all are winners)
      if (totalActive <= 5) return 0;
      return totalActive - 5;
    default: 
      return 0;
  }
};

// Create new lottery event (Admin only)
export const createLottery = async (req, res) => {
  try {
    const { eventName, package: lotteryPackage, startDate, endDate, type = 'scheduled' } = req.body;

    if (!eventName) {
       return res.status(400).json({ success: false, message: 'Event name is required' });
    }

    if (type === 'scheduled' && (!startDate || !endDate)) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required for scheduled contests',
      });
    }

    // Check if at least one package is selected.
    if (!lotteryPackage) {
      return res.status(400).json({
        success: false,
        message: 'Package selection is required',
      });
    }

    const finalPackage = Number(lotteryPackage);

    // Verify package exists in dynamic packages
    const Package = (await import('../models/Package.js')).default;
    const packageExists = await Package.findOne({ amount: finalPackage });
    
    if (!packageExists) {
      return res.status(400).json({
        success: false,
        message: 'Selected package is not valid or inactive',
      });
    }

    // Check if there's already an active lottery - REMOVED to allow multiple
    // const activeLottery = await Lottery.findOne({ status: { $in: ['pending', 'active'] } });
    // if (activeLottery) {
    //   return res.status(400).json({
    //     success: false,
    //     message: 'An active lottery already exists. Complete it first.',
    //   });
    // }

    const isManual = type === 'manual';
    
    // For manual, we can set default dates if needed, or leave them null if schema allows.
    // Schema requires dates? No, we didn't remove required: true. 
    // Wait, schema has required: true for dates. We should make them optional in schema or fake them for manual.
    // Let's assume we relax schema requirements or provide defaults.
    // For now, let's set current date for manual if not provided.
    
    const start = startDate ? new Date(startDate) : new Date();
    // For manual, end date isn't really used for auto-spin, but maybe for registration window?
    // Let's set it to far future for manual so registration stays open until manually closed? 
    // Or just require user to set a "Registration Deadline" even for manual?
    // User said "in scheduled take from and to... on manual contest only one winner".
    // It implies manual doesn't need strict dates. 
    // Let's set endDate to 1 day later by default for manual if not provided, just to satisfy DB.
    const end = endDate ? new Date(endDate) : new Date(Date.now() + 24 * 60 * 60 * 1000);

    const lottery = await Lottery.create({
      eventName,
      package: finalPackage,
      startDate: start,
      endDate: end,
      type,
      isAutoSpin: !isManual, // Manual contests don't auto-spin
      createdBy: req.user._id,
      status: 'pending', // Both start as pending
      prizes: req.body.prizes || []
    });

    // Auto-seed eligible participants
    const userQuery = { role: 'user', package: finalPackage };
    
    // If it's a scheduled contest and dates are provided, filter by registration date
    // Note: The prompt "participants according to Start From" suggests filtering users registered IN that window.
    // However, usually contests are for ALL users. But since user explicitly asked for this behavior:
    if (type === 'scheduled' && startDate && endDate) {
        userQuery.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const eligibleUsers = await User.find(userQuery).select('_id');
    
    if (eligibleUsers.length > 0) {
        const participants = eligibleUsers.map(user => ({
            lotteryId: lottery._id,
            userId: user._id,
            status: 'active'
        }));
        
        await LotteryParticipant.insertMany(participants);
        
        lottery.totalParticipants = participants.length;
        await lottery.save();
    }

    res.status(201).json({
      success: true,
      message: `Lottery created with ${eligibleUsers.length} participants`,
      data: lottery,
    });
  } catch (error) {
    console.error('Create lottery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create lottery',
      error: error.message,
    });
  }
};

// Register user for lottery
export const registerParticipant = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    // Find lottery
    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'Lottery not found',
      });
    }

    // Check if lottery is still accepting registrations
    if (lottery.status !== 'pending' && lottery.status !== 'active') {
       return res.status(400).json({
         success: false,
         message: 'Lottery registration is closed',
       });
    }
    
    const now = new Date();
    if (now < new Date(lottery.startDate)) {
        return res.status(400).json({
            success: false,
            message: 'Registration has not started yet',
        });
    }
    
    if (now > new Date(lottery.endDate)) {
        return res.status(400).json({
            success: false,
            message: 'Registration period has ended',
        });
    }

    // Check if user already registered
    const existingParticipant = await LotteryParticipant.findOne({
      lotteryId,
      userId: req.user._id,
    });

    if (existingParticipant) {
      return res.status(400).json({
        success: false,
        message: 'You are already registered for this lottery',
      });
    }

    // Register participant
    const participant = await LotteryParticipant.create({
      lotteryId,
      userId: req.user._id,
    });

    // Update lottery participant count
    const participantCount = await LotteryParticipant.countDocuments({ lotteryId });
    lottery.totalParticipants = participantCount;
    await lottery.save();

    res.status(201).json({
      success: true,
      message: 'Registered successfully',
      data: participant,
    });
  } catch (error) {
    console.error('Register participant error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register for lottery',
      error: error.message,
    });
  }
};

// Get all participants
export const getParticipants = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const participants = await LotteryParticipant.find({ lotteryId })
      .populate('userId', 'name phoneNumber selfieUrl imageUrl')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: participants.length,
      data: participants,
    });
  } catch (error) {
    console.error('Get participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch participants',
      error: error.message,
    });
  }
};



// ... (existing imports)

// Execute spin (Admin only)
export const executeSpin = async (req, res) => {
  try {
    const { lotteryId } = req.params;
    
    // Call the shared logic
    const result = await performSpinLogic(lotteryId, req.user._id);

    res.status(200).json({
      success: true,
      message: `Round ${result.round} completed`,
      data: result,
    });
  } catch (error) {
    console.error('Execute spin error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to execute spin',
    });
  }
};

// Get lottery status (for polling)
export const getLotteryStatus = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'Lottery not found',
      });
    }

    // Get latest round data
    let latestRound = null;
    let eliminatedUsers = [];
    
    if (lottery.currentRound > 0) {
      const round = await LotteryRound.findOne({
        lotteryId,
        roundNumber: lottery.currentRound,
      }).populate('eliminatedUserIds', 'name');

      if (round) {
        // Filter out any null users (in case they were deleted after the round)
        const validEliminated = (round.eliminatedUserIds || []).filter(u => u !== null);
        
        // Get 10-20 random eliminated users for display
        const displayCount = Math.min(20, validEliminated.length);
        const randomEliminated = selectRandomUsers(
          validEliminated.map(u => ({ name: u.name, _id: u._id })),
          displayCount
        );
        eliminatedUsers = randomEliminated;

        latestRound = {
          roundNumber: round.roundNumber,
          totalParticipants: round.totalParticipants,
          eliminatedCount: round.eliminatedCount,
          winnerId: round.winnerId,
        };
      }
    }

    // Get remaining participants count
    const remainingCount = await LotteryParticipant.countDocuments({
      lotteryId,
      status: 'active',
    });

    // Check current user's status (if authenticated)
    let userStatus = null;
    if (req.user) {
      const participant = await LotteryParticipant.findOne({
        lotteryId,
        userId: req.user._id,
      });

      if (participant) {
        userStatus = {
          status: participant.status,
          eliminatedInRound: participant.eliminatedInRound,
        };
      }
    }

    res.status(200).json({
      success: true,
      data: {
        status: lottery.status,
        currentRound: lottery.currentRound,
        totalParticipants: lottery.totalParticipants,
        remainingCount,
        latestRound,
        eliminatedUsers,
        userStatus,
      },
    });
  } catch (error) {
    console.error('Get lottery status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lottery status',
      error: error.message,
    });
  }
};

// Get active lottery
export const getActiveLottery = async (req, res) => {
  try {
    const lottery = await Lottery.findOne({
      status: { $in: ['pending', 'active'] },
    }).sort({ createdAt: -1 });

    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'No active lottery found',
      });
    }

    res.status(200).json({
      success: true,
      data: lottery,
    });
  } catch (error) {
    console.error('Get active lottery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch active lottery',
      error: error.message,
    });
  }
};

// Get winner
export const getWinner = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const winner = await LotteryParticipant.findOne({
      lotteryId,
      status: 'winner',
    }).populate('userId', 'name phoneNumber selfieUrl imageUrl');

    if (!winner) {
      return res.status(404).json({
        success: false,
        message: 'Winner not yet determined',
      });
    }

    res.status(200).json({
      success: true,
      data: winner,
    });
  } catch (error) {
    console.error('Get winner error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch winner',
      error: error.message,
    });
  }
};

// Get round details
export const getRoundDetails = async (req, res) => {
  try {
    const { lotteryId, roundNumber } = req.params;

    const round = await LotteryRound.findOne({
      lotteryId,
      roundNumber: parseInt(roundNumber),
    }).populate('eliminatedUserIds', 'name phoneNumber');

    if (!round) {
      return res.status(404).json({
        success: false,
        message: 'Round not found',
      });
    }

    res.status(200).json({
      success: true,
      data: round,
    });
  } catch (error) {
    console.error('Get round details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch round details',
      error: error.message,
    });
  }
};

// Get lottery history (completed lotteries)
export const getLotteryHistory = async (req, res) => {
  try {
    // LAZY PROCESSING: Check for expired scheduled lotteries and process them immediately
    const now = new Date();
    const expiredLotteries = await Lottery.find({
      status: { $in: ['pending', 'active'] },
      endDate: { $lt: now },
      isAutoSpin: true
    });

    if (expiredLotteries.length > 0) {
      console.log(`[LazyProcess] Found ${expiredLotteries.length} expired lotteries. Processing now...`);
      const executorId = req.user ? req.user._id : null; 

      for (const lottery of expiredLotteries) {
        try {
          let isComplete = false;
          let roundCounter = 0;
          // Process all rounds until completion
          while (!isComplete && roundCounter < 10) {
             const result = await performSpinLogic(lottery._id, executorId);
             isComplete = result.isComplete;
             roundCounter++;
          }
          console.log(`[LazyProcess] Lottery ${lottery.eventName} processed. Completed: ${isComplete}`);
        } catch (err) {
          console.error(`[LazyProcess] Failed to process lottery ${lottery._id}:`, err.message);
          // If no participants errors, force complete to show in history
          if (err.message.includes('No active participants')) {
              lottery.status = 'completed';
              lottery.completedAt = new Date();
              await lottery.save();
          }
        }
      }
    }

    const lotteries = await Lottery.find({ status: 'completed' })
      .populate('winnerId', 'name phoneNumber selfieUrl')
      .populate('winners', 'name phoneNumber selfieUrl')
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      count: lotteries.length,
      data: lotteries,
    });
  } catch (error) {
    console.error('Get lottery history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lottery history',
      error: error.message,
    });
  }
};

// Get public winner history
export const getPublicWinners = async (req, res) => {
  try {
    const lotteries = await Lottery.find({ status: 'completed' })
      .select('eventName winners prizes completedAt')
      .populate('winners', 'name selfieUrl phoneNumber')
      .sort({ completedAt: -1 });

    res.status(200).json({
      success: true,
      data: lotteries,
    });
  } catch (error) {
    console.error('Get public winners error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch winners',
    });
  }
};

// Delete lottery record (Admin only)
export const deleteLottery = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'Lottery record not found',
      });
    }

    // Delete associated rounds and participants
    await Promise.all([
      LotteryRound.deleteMany({ lotteryId }),
      LotteryParticipant.deleteMany({ lotteryId }),
      Lottery.findByIdAndDelete(lotteryId)
    ]);

    res.status(200).json({
      success: true,
      message: 'Lottery record and associated data deleted successfully',
    });
  } catch (error) {
    console.error('Delete lottery error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lottery record',
      error: error.message,
    });
  }
};

// Delete all completed lottery records (Admin only)
export const deleteAllLotteries = async (req, res) => {
  try {
    // Get all completed lotteries
    const completedLotteries = await Lottery.find({ status: 'completed' });
    
    if (completedLotteries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No completed lottery records found',
      });
    }

    const lotteryIds = completedLotteries.map(l => l._id);

    // Delete all associated rounds and participants for completed lotteries
    await Promise.all([
      LotteryRound.deleteMany({ lotteryId: { $in: lotteryIds } }),
      LotteryParticipant.deleteMany({ lotteryId: { $in: lotteryIds } }),
      Lottery.deleteMany({ status: 'completed' })
    ]);

    res.status(200).json({
      success: true,
      message: `Successfully deleted ${completedLotteries.length} lottery records and all associated data`,
      deletedCount: completedLotteries.length,
    });
  } catch (error) {
    console.error('Delete all lotteries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete lottery records',
      error: error.message,
    });
  }
};

// Get all active or pending lotteries (for dropdown selection)
export const getSelectableLotteries = async (req, res) => {
  try {
    const lotteries = await Lottery.find({
      status: { $in: ['pending', 'active'] }
    })
    .select('eventName type status startDate endDate package')
    .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: lotteries,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch lotteries',
    });
  }
};
