import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';

dotenv.config();

const createAdmin = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Remove any existing admin to be sure
    await User.deleteMany({ role: 'admin' });
    console.log('Removed existing admins');

    const adminData = {
      name: 'Retail Admin',
      phoneNumber: '9999999999',
      password: 'admin123',
      aadhaarNumber: '000000000000',
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/v1312461204/sample.jpg',
      imagePublicId: 'sample',
      role: 'admin'
    };

    const admin = await User.create(adminData);
    console.log('✅ Admin user created successfully:');
    console.log('Name:', admin.name);
    console.log('Phone:', admin.phoneNumber);
    console.log('Password: Admin@password123');
    
    process.exit(0);
  } catch (err) {
    console.error('Error creating admin:', err);
    process.exit(1);
  }
};

createAdmin();
