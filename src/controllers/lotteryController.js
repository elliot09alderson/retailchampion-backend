import crypto from 'crypto';
import Lottery from '../models/Lottery.js';
import LotteryParticipant from '../models/LotteryParticipant.js';
import LotteryRound from '../models/LotteryRound.js';
import User from '../models/User.js';

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
      // We want to leave a small pool for the final spin (e.g., 5% or at least 2 people)
      const targetSurvivors = Math.max(2, Math.ceil(totalActive * 0.2)); // Leave 20% of remaining for suspense
      return totalActive - targetSurvivors;
    case 4: 
      // The grand finale: eliminate everyone except one champion
      return totalActive - 1;
    default: 
      return 0;
  }
};

// Create new lottery event (Admin only)
export const createLottery = async (req, res) => {
  try {
    const { eventName } = req.body;

    if (!eventName) {
      return res.status(400).json({
        success: false,
        message: 'Event name is required',
      });
    }

    // Check if there's already an active lottery
    const activeLottery = await Lottery.findOne({ status: { $in: ['pending', 'active'] } });
    if (activeLottery) {
      return res.status(400).json({
        success: false,
        message: 'An active lottery already exists. Complete it first.',
      });
    }

    const lottery = await Lottery.create({
      eventName,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'Lottery created successfully',
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
    if (lottery.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Lottery registration is closed',
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

// Execute spin (Admin only)
export const executeSpin = async (req, res) => {
  try {
    const { lotteryId } = req.params;

    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'Lottery not found',
      });
    }

    // Determine next round
    const nextRound = lottery.currentRound + 1;
    if (nextRound > 4) {
      return res.status(400).json({
        success: false,
        message: 'Lottery already completed',
      });
    }

    // Start lottery if first round
    if (nextRound === 1) {
      lottery.status = 'active';
      lottery.startedAt = new Date();
    }

    // Get active participants
    let activeParticipants = await LotteryParticipant.find({
      lotteryId,
      status: 'active',
    }).populate('userId', 'name');

    // Filter out participants whose user record was deleted
    activeParticipants = activeParticipants.filter(p => p.userId !== null);

    const totalActive = activeParticipants.length;

    if (totalActive === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active participants',
      });
    }

    // Calculate elimination count
    const eliminationCount = getEliminationCount(nextRound, totalActive);

    // Select users to eliminate (secure random)
    const toEliminate = selectRandomUsers(activeParticipants, eliminationCount);
    const eliminatedUserIds = toEliminate.map(p => p.userId._id);
    
    // Get 10-20 random names for display
    const displayCount = Math.min(20, eliminationCount);
    const eliminatedForDisplay = selectRandomUsers(toEliminate, displayCount).map(p => ({
      name: p.userId.name,
      userId: p.userId._id,
    }));

    // Update participants status
    await LotteryParticipant.updateMany(
      { _id: { $in: toEliminate.map(p => p._id) } },
      {
        status: 'eliminated',
        eliminatedInRound: nextRound,
        eliminatedAt: new Date(),
      }
    );

    // Check if there's a winner (Round 4)
    let winnerId = null;
    let winnerData = null;
    if (nextRound === 4) {
      const winner = await LotteryParticipant.findOne({
        lotteryId,
        status: 'active',
      }).populate('userId', 'name');
      
      if (winner && winner.userId) {
        winnerId = winner.userId._id;
        winner.status = 'winner';
        await winner.save();
        winnerData = {
          name: winner.userId.name,
          participantId: winner._id,
          selfieUrl: winner.userId.selfieUrl,
        };
      }

      lottery.status = 'completed';
      lottery.completedAt = new Date();
      lottery.winnerId = winnerId;
    }

    // Create round record
    const round = await LotteryRound.create({
      lotteryId,
      roundNumber: nextRound,
      totalParticipants: totalActive,
      eliminatedCount: eliminationCount,
      eliminatedUserIds,
      winnerId,
      executedBy: req.user._id,
    });

    // Update lottery current round
    lottery.currentRound = nextRound;
    await lottery.save();

    // Get remaining count
    const remainingCount = await LotteryParticipant.countDocuments({
      lotteryId,
      status: 'active',
    });

    res.status(200).json({
      success: true,
      message: `Round ${nextRound} completed`,
      data: {
        round: nextRound,
        eliminated: eliminationCount,
        remaining: remainingCount,
        eliminatedUsers: eliminatedForDisplay,
        winnerId,
        winner: winnerData,
        isComplete: nextRound === 4,
      },
    });
  } catch (error) {
    console.error('Execute spin error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute spin',
      error: error.message,
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
    const lotteries = await Lottery.find({ status: 'completed' })
      .populate('winnerId', 'name phoneNumber selfieUrl')
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
