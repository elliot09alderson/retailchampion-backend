import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Admin user details
const ADMIN_USER = {
  name: 'Admin User',
  phoneNumber: '9999999999',
  password: 'admin123',
  role: 'admin',
  documentType: 'pan',
  documentNumber: 'ADMIN12345',
  imageUrl: 'https://via.placeholder.com/150',
  imagePublicId: 'admin-placeholder',
};

const createAdminUser = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Import User model
    const User = (await import('./models/User.js')).default;

    // Check if admin already exists
    const existingAdmin = await User.findOne({ phoneNumber: ADMIN_USER.phoneNumber });
    
    if (existingAdmin) {
      console.log('⚠️  Admin user already exists!');
      console.log('Phone:', ADMIN_USER.phoneNumber);
      console.log('Password:', ADMIN_USER.password);
      process.exit(0);
    }

    // Create admin user
    const admin = await User.create(ADMIN_USER);
    
    console.log('🎉 Admin user created successfully!');
    console.log('=====================================');
    console.log('📱 Phone Number:', ADMIN_USER.phoneNumber);
    console.log('🔑 Password:', ADMIN_USER.password);
    console.log('=====================================');
    console.log('Use these credentials to login at:');
    console.log('http://localhost:5173/admin/login');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
    process.exit(1);
  }
};

createAdminUser();
