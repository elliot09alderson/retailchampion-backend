
import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config();

// If DOTENV not working, try to default or warn
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/retailchampions";

async function listCoupons() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB under ' + MONGODB_URI);

    const users = await User.find({}).sort({ createdAt: -1 }).limit(10);
    
    console.log('\n--- HOST RECENT USERS ---');
    if (users.length === 0) {
      console.log('No users found.');
    } else {
      users.forEach(u => {
        console.log(`Name: ${u.name} | Phone: ${u.phoneNumber} | Coupon: ${u.couponCode} | VIP: ${u.vipStatus}`);
      });
    }
    console.log('-------------------------\n');

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await mongoose.disconnect();
  }
}

listCoupons();
