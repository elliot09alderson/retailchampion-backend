import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from './models/User.js';

dotenv.config();

const seedSuperAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const existingSuperAdmin = await User.findOne({ role: 'superadmin' });

    if (existingSuperAdmin) {
      console.log('Super Admin already exists:');
      console.log(`  Phone: ${existingSuperAdmin.phoneNumber}`);
      console.log(`  Name: ${existingSuperAdmin.name}`);
      process.exit(0);
    }

    const superAdmin = await User.create({
      name: 'Super Admin',
      phoneNumber: '9999999999',
      password: 'SuperAdmin@123',
      role: 'superadmin',
      package: 0,
      status: 'active',
      email: 'superadmin@retailchampions.com',
    });

    console.log('Super Admin created successfully!');
    console.log('  Phone: 9999999999');
    console.log('  Password: SuperAdmin@123');
    console.log('  ID:', superAdmin._id);

    process.exit(0);
  } catch (error) {
    console.error('Error seeding Super Admin:', error);
    process.exit(1);
  }
};

seedSuperAdmin();
