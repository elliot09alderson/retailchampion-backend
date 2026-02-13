
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../src/models/User.js';
import Package from '../src/models/Package.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from the backend root directory
dotenv.config({ path: path.join(__dirname, '../../backend/.env') });
// Fallback if running from a different context or if .env is in backend root
if (!process.env.MONGODB_URI) {
    dotenv.config({ path: path.join(__dirname, '../.env') });
}

const run = async () => {
  try {
    if (!process.env.MONGODB_URI) {
        throw new Error('MONGODB_URI is not defined in .env');
    }

    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // 1. Ensure STAR RETAILER Package exists
    const targetPackageAmount = 1000;
    const targetPackageName = "STAR RETAILER";
    
    let pkg = await Package.findOne({ amount: targetPackageAmount });
    if (!pkg) {
        console.log(`📦 Creating package: ${targetPackageName} (₹${targetPackageAmount})...`);
        pkg = await Package.create({
            name: targetPackageName,
            amount: targetPackageAmount,
            description: 'Star Retailer Package',
            isActive: true
        });
        console.log('✅ Package created.');
    } else {
        console.log(`📦 Found existing package: ${pkg.name} (₹${pkg.amount})`);
        if (pkg.name !== targetPackageName) {
            console.log(`   Updating name to ${targetPackageName}...`);
            pkg.name = targetPackageName;
            await pkg.save();
        }
    }

    // 2. Find eligible users
    // Criteria: Registered before Feb 6, 2026
    const limit = 1900;
    const cutoffDate = new Date('2026-02-06T00:00:00.000Z');
    
    console.log(`🔍 Finding up to ${limit} users registered before ${cutoffDate.toDateString()}...`);

    const query = {
        role: 'user',
        createdAt: { $lt: cutoffDate },
        // Optional: Exclude if already on this package? 
        // User said "register... for the package", implying we should ensure they are on it.
        // We will include everyone matching date criteria and just update them.
        // But to be efficient, maybe only update those who differ?
        // process.stdout will show what happen.
    };

    const usersToUpdate = await User.find(query)
        .sort({ createdAt: 1 }) // Oldest first
        .limit(limit)
        .select('_id name phoneNumber package createdAt');
    
    console.log(`📊 Found ${usersToUpdate.length} matching users.`);

    if (usersToUpdate.length === 0) {
        console.log('⚠️ No users found matching the criteria.');
        process.exit(0);
    }

    // 3. Update users
    const userIds = usersToUpdate.map(u => u._id);
    
    console.log(`🔄 Updating ${userIds.length} users to package ₹${targetPackageAmount}...`);

    const result = await User.updateMany(
        { _id: { $in: userIds } },
        { 
            $set: { 
                package: targetPackageAmount,
            } 
        }
    );
    
    console.log(`✅ Update Complete!`);
    console.log(`   Matched Count: ${result.matchedCount}`);
    console.log(`   Modified Count: ${result.modifiedCount}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.disconnect();
    console.log('👋 Disconnected');
    process.exit(0);
  }
};

run();
