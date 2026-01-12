import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';

dotenv.config();

const verifyAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const admin = await User.findOne({ phoneNumber: '9999999999' });
    if (!admin) {
      console.log('Admin user not found. Creating one...');
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('admin123', salt);
      
      await User.create({
        name: 'Retail Admin',
        phoneNumber: '9999999999',
        password: 'admin123', // User.js pre-save will hash this
        role: 'admin',
        package: 0
      });
      console.log('Admin user created successfully with password: admin123');
    } else {
      console.log('Admin user found.');
      const isMatch = await admin.comparePassword('admin123');
      if (isMatch) {
        console.log('Password "admin123" matches.');
      } else {
        console.log('Password does not match. Updating to "admin123"...');
        admin.password = 'admin123';
        await admin.save();
        console.log('Password updated to "admin123".');
      }
      
      if (admin.role !== 'admin') {
        console.log('User is not an admin. Updating role...');
        admin.role = 'admin';
        await admin.save();
        console.log('Role updated to admin.');
      }
    }

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
};

verifyAdmin();
