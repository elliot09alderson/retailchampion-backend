import crypto from 'crypto';
import Lottery from '../models/Lottery.js';
import LotteryParticipant from '../models/LotteryParticipant.js';
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

// Seed participants from existing users (Admin only)
export const seedParticipantsFromUsers = async (req, res) => {
  try {
    const { lotteryId, count } = req.body;
    
    let lottery;
    
    if (lotteryId) {
      lottery = await Lottery.findById(lotteryId);
    }
    
    if (!lottery) {
      lottery = await Lottery.findOne({ status: { $in: ['pending', 'active'] } });
    }
    
    if (!lottery) {
      return res.status(404).json({
        success: false,
        message: 'No active contest found. Please create a contest first.',
      });
    }

    console.log('📋 Using contest:', lottery.eventName, 'Package:', lottery.package);

    // Get all users (excluding admins) matching the lottery's package
    let users = await User.find({ 
      role: 'user',
      package: lottery.package 
    }).select('_id name');
    
    if (users.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No users found in database',
      });
    }

    // If a specific count is requested, pick random users
    if (count && !isNaN(count)) {
      const requestedCount = parseInt(count);
      // Shuffle and slice users
      users = selectRandomUsers(users, Math.min(requestedCount, users.length));
    }

    console.log(`👥 Using ${users.length} users for this contest`);

    // Check existing participants
    const existingParticipants = await LotteryParticipant.find({ 
      lotteryId: lottery._id 
    }).select('userId');
    
    const existingUserIds = new Set(existingParticipants.map(p => p.userId.toString()));
    
    console.log(`📊 Existing participants: ${existingUserIds.size}`);

    // Register new participants
    const newParticipants = [];
    let created = 0;
    let skipped = 0;

    for (const user of users) {
      if (!existingUserIds.has(user._id.toString())) {
        newParticipants.push({
          lotteryId: lottery._id,
          userId: user._id,
          status: 'active',
        });
        created++;
      } else {
        skipped++;
      }
    }

    // Bulk insert new participants
    if (newParticipants.length > 0) {
      await LotteryParticipant.insertMany(newParticipants);
      console.log(`✅ Registered ${created} new participants`);
    }

    // Update lottery participant count
    const totalParticipants = await LotteryParticipant.countDocuments({ 
      lotteryId: lottery._id 
    });
    
    lottery.totalParticipants = totalParticipants;
    await lottery.save();

    res.status(200).json({
      success: true,
      message: 'Participants seeded successfully',
      data: {
        lotteryId: lottery._id,
        lotteryName: lottery.eventName,
        totalUsers: users.length,
        newParticipants: created,
        alreadyRegistered: skipped,
        totalParticipants,
        activeParticipants: await LotteryParticipant.countDocuments({ 
          lotteryId: lottery._id,
          status: 'active'
        }),
      },
    });
  } catch (error) {
    console.error('Seed participants error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to seed participants',
      error: error.message,
    });
  }
};

// Get seeding status
export const getSeedStatus = async (req, res) => {
  try {
    const lottery = await Lottery.findOne({ status: { $in: ['pending', 'active'] } });
    
    if (!lottery) {
      return res.status(200).json({
        success: true,
        data: {
          hasLottery: false,
          message: 'No active lottery found. Use seed endpoint to create one.',
        },
      });
    }

    const totalUsers = await User.countDocuments({ role: 'user' });
    const totalParticipants = await LotteryParticipant.countDocuments({ 
      lotteryId: lottery._id 
    });
    const activeParticipants = await LotteryParticipant.countDocuments({ 
      lotteryId: lottery._id,
      status: 'active'
    });

    res.status(200).json({
      success: true,
      data: {
        hasLottery: true,
        lottery: {
          id: lottery._id,
          name: lottery.eventName,
          status: lottery.status,
          currentRound: lottery.currentRound,
        },
        totalUsers,
        totalParticipants,
        activeParticipants,
        unregisteredUsers: totalUsers - totalParticipants,
        canSpin: activeParticipants > 0,
      },
    });
  } catch (error) {
    console.error('Get seed status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get seed status',
      error: error.message,
    });
  }
};
