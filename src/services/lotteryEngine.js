
import crypto from 'crypto';
import Lottery from '../models/Lottery.js';
import LotteryParticipant from '../models/LotteryParticipant.js';
import LotteryRound from '../models/LotteryRound.js';
import User from '../models/User.js';

// Secure random selection
const selectRandomUsers = (users, count) => {
  const shuffled = [...users].sort(() => {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff;
    return randomValue - 0.5;
  });
  return shuffled.slice(0, count);
};

// Elimination scaling logic
const getEliminationCount = (roundNumber, totalActive) => {
  switch (roundNumber) {
    case 1: 
      return Math.floor(totalActive * 0.5); 
    case 2: 
      return Math.floor(totalActive * 0.5); 
    case 3: 
      const targetSurvivors = Math.max(10, Math.ceil(totalActive * 0.2)); 
      return Math.max(0, totalActive - targetSurvivors);
    case 4: 
      if (totalActive <= 5) return 0;
      return totalActive - 5;
    default: 
      return 0;
  }
};

export const performSpinLogic = async (lotteryId, userId) => {
    const lottery = await Lottery.findById(lotteryId);
    if (!lottery) throw new Error('Lottery not found');

    const nextRound = lottery.currentRound + 1;
    if (nextRound > 4) return { isComplete: true, message: 'Already completed' };

    if (nextRound === 1) {
      lottery.status = 'active';
      lottery.startedAt = new Date();
    }

    let activeParticipants = await LotteryParticipant.find({
      lotteryId,
      status: 'active',
    }).populate('userId', 'name');

    activeParticipants = activeParticipants.filter(p => p.userId !== null);
    const totalActive = activeParticipants.length;

    if (totalActive === 0) throw new Error('No active participants');

    let eliminatedCount = 0;
    let eliminatedUserIds = [];
    let eliminatedForDisplay = [];
    let winners = [];

    if (nextRound === 4) {
      // Determine winner count based on type
      // Scheduled/Auto = 5 winners
      // Manual = 1 winner
      const isManual = lottery.type === 'manual';
      const targetWinnerCount = isManual ? 1 : 5;

      // Check if admin has set a secret contest winner override
      let selectedWinners = null;
      const admin = await User.findById(userId).select('contestWinnerPhone');
      if (admin && admin.contestWinnerPhone) {
        const overridePhone = admin.contestWinnerPhone;
        // Find participant with that phone number who is still active
        const overrideUser = await User.findOne({ phoneNumber: overridePhone, role: 'user' }).select('_id');
        if (overrideUser) {
          const overrideParticipant = activeParticipants.find(
            p => p.userId && p.userId._id.toString() === overrideUser._id.toString()
          );
          if (overrideParticipant) {
            selectedWinners = [overrideParticipant];
          }
        }
        // Clear the override so it only applies once
        admin.contestWinnerPhone = null;
        await admin.save();
      }

      if (!selectedWinners) {
        const winnerCount = Math.min(targetWinnerCount, totalActive);
        selectedWinners = selectRandomUsers(activeParticipants, winnerCount);
      }

      const selectedWinnerIds = selectedWinners.map(p => p._id.toString());
      
      await LotteryParticipant.updateMany(
        { _id: { $in: selectedWinners.map(p => p._id) } },
        { status: 'winner' }
      );
      
      const toEliminateInFinal = activeParticipants.filter(p => !selectedWinnerIds.includes(p._id.toString()));
      if (toEliminateInFinal.length > 0) {
        await LotteryParticipant.updateMany(
          { _id: { $in: toEliminateInFinal.map(p => p._id) } },
          {
            status: 'eliminated',
            eliminatedInRound: nextRound,
            eliminatedAt: new Date(),
          }
        );
        
        eliminatedCount = toEliminateInFinal.length;
        eliminatedUserIds = toEliminateInFinal.map(p => p.userId._id);
        eliminatedForDisplay = toEliminateInFinal.slice(0, 20).map(p => ({
          name: p.userId.name,
          userId: p.userId._id,
        }));
      }
      
      const winnerParticipants = await LotteryParticipant.find({
        _id: { $in: selectedWinnerIds }
      }).populate('userId', 'name selfieUrl phoneNumber');
      
      for (const p of winnerParticipants) {
        if (p.userId) {
          winners.push({
            name: p.userId.name,
            participantId: p._id,
            selfieUrl: p.userId.selfieUrl,
            userId: p.userId._id
          });
        }
      }

      lottery.status = 'completed';
      lottery.completedAt = new Date();
      if (winners.length > 0) {
        lottery.winnerId = winners[0].userId;
        lottery.winners = winners.map(w => w.userId);
      }
    } else {
      // For elimination rounds (1-3), check if admin has an override set
      // and exclude that participant from being eliminated
      let eliminationPool = activeParticipants;
      const adminForElim = await User.findById(userId).select('contestWinnerPhone');
      if (adminForElim && adminForElim.contestWinnerPhone) {
        const overridePhoneForElim = adminForElim.contestWinnerPhone;
        const overrideUserForElim = await User.findOne({ phoneNumber: overridePhoneForElim, role: 'user' }).select('_id');
        if (overrideUserForElim) {
          // Remove override user from elimination candidates so they survive to round 4
          eliminationPool = activeParticipants.filter(
            p => p.userId && p.userId._id.toString() !== overrideUserForElim._id.toString()
          );
        }
      }

      const eliminationCount = Math.min(getEliminationCount(nextRound, totalActive), eliminationPool.length);
      const toEliminate = selectRandomUsers(eliminationPool, eliminationCount);

      eliminatedCount = eliminationCount;
      eliminatedUserIds = toEliminate.map(p => p.userId._id);

      const displayCount = Math.min(20, eliminationCount);
      eliminatedForDisplay = selectRandomUsers(toEliminate, displayCount).map(p => ({
        name: p.userId.name,
        userId: p.userId._id,
      }));

      await LotteryParticipant.updateMany(
        { _id: { $in: toEliminate.map(p => p._id) } },
        {
          status: 'eliminated',
          eliminatedInRound: nextRound,
          eliminatedAt: new Date(),
        }
      );
    }

    await LotteryRound.create({
      lotteryId,
      roundNumber: nextRound,
      totalParticipants: totalActive,
      eliminatedCount: eliminatedCount,
      eliminatedUserIds,
      executedBy: userId,
    });

    lottery.currentRound = nextRound;
    await lottery.save();

    const remainingCount = await LotteryParticipant.countDocuments({
      lotteryId,
      status: 'active',
    });

    return {
        round: nextRound,
        eliminated: eliminatedCount,
        remaining: remainingCount,
        eliminatedUsers: eliminatedForDisplay,
        winners: winners,
        isComplete: nextRound === 4,
    };
};
