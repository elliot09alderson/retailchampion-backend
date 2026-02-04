import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '../../.env') });

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Import Package model
    const Package = (await import('../models/Package.js')).default;
    
    // Check if VIP package already exists
    const existingVip = await Package.findOne({ amount: 50, isVip: true });
    
    if (existingVip) {
      console.log('VIP Package already exists:', existingVip);
    } else {
      // Create VIP package
      const vipPackage = await Package.create({
        name: 'VIP PACKAGE',
        amount: 50,
        description: 'Exclusive VIP membership with referral rewards & priority access',
        isVip: true,
        isActive: true,
      });
      
      console.log('VIP Package created successfully:');
      console.log(vipPackage);
    }
    
    mongoose.disconnect();
    console.log('Done!');
  })
  .catch(err => {
    console.error('MongoDB connection failed:', err);
    process.exit(1);
  });
