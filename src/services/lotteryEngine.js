
import crypto from 'crypto';
import Lottery from '../models/Lottery.js';
import LotteryParticipant from '../models/LotteryParticipant.js';
import LotteryRound from '../models/LotteryRound.js';

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
      
      const winnerCount = Math.min(targetWinnerCount, totalActive);
      const selectedWinners = selectRandomUsers(activeParticipants, winnerCount);
      const selectedWinnerIds = selectedWinners.map(p => p._id);
      
      await LotteryParticipant.updateMany(
        { _id: { $in: selectedWinnerIds } },
        { status: 'winner' }
      );
      
      const toEliminateInFinal = activeParticipants.filter(p => !selectedWinnerIds.includes(p._id));
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
      const eliminationCount = getEliminationCount(nextRound, totalActive);
      const toEliminate = selectRandomUsers(activeParticipants, eliminationCount);
      
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
