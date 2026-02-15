import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const debugAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const phoneNumber = '1122334455';
    const password = 'onlyadmeeen@1';

    const users = await User.find({ phoneNumber });
    console.log(`Found ${users.length} user(s) with phone ${phoneNumber}`);

    for (const user of users) {
      console.log('------------------------------------------------');
      console.log(`ID: ${user._id}`);
      console.log(`Role: ${user.role}`);
      console.log(`Package: ${user.package}`);
      console.log(`Password Hash: ${user.password}`);
      
      const isMatch = await bcrypt.compare(password, user.password);
      console.log(`Password Match ('${password}'): ${isMatch ? '✅ YES' : '❌ NO'}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
};

debugAdmin();
