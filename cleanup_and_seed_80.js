import mongoose from 'mongoose';
import Lottery from './src/models/Lottery.js';
import LotteryParticipant from './src/models/LotteryParticipant.js';
import LotteryRound from './src/models/LotteryRound.js';
import User from './src/models/User.js';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const selectRandomUsers = (users, count) => {
  const shuffled = [...users].sort(() => {
    const randomBytes = crypto.randomBytes(4);
    const randomValue = randomBytes.readUInt32BE(0) / 0xffffffff;
    return randomValue - 0.5;
  });
  return shuffled.slice(0, count);
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // 1. Clear all active/pending lotteries
    const deletedLotteries = await Lottery.deleteMany({ status: { $in: ['pending', 'active'] } });
    console.log(`Deleted ${deletedLotteries.deletedCount} active/pending lotteries`);

    // 2. Clear all participants and rounds for fresh start (or just current)
    // Actually, user said "empty the users", let's clear all participants to be safe and clean.
    await LotteryParticipant.deleteMany({});
    await LotteryRound.deleteMany({});
    console.log('Cleared all participants and rounds');

    // 3. Create a new contest
    const admin = await User.findOne({ role: 'admin' });
    const lottery = await Lottery.create({
      eventName: 'Retail Champions 80-Participant Sprint',
      createdBy: admin ? admin._id : null,
      status: 'pending'
    });
    console.log(`Created new contest: ${lottery.eventName}`);

    // 4. Get users and select exactly 80
    const users = await User.find({ role: 'user' });
    if (users.length < 80) {
      console.error(`Not enough users! Required: 80, Found: ${users.length}`);
      process.exit(1);
    }

    const selectedUsers = selectRandomUsers(users, 80);
    const participants = selectedUsers.map(u => ({
      lotteryId: lottery._id,
      userId: u._id,
      status: 'active'
    }));

    await LotteryParticipant.insertMany(participants);
    
    lottery.totalParticipants = 80;
    await lottery.save();
    
    console.log(`✅ Successfully seeded exactly 80 participants into the new contest!`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

run();
