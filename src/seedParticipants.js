import mongoose from 'mongoose';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const generateRandomPhone = (index) => {
  return `90000${String(index).padStart(5, '0')}`;
};

const generateRandomName = () => {
  const firstNames = ['Raj', 'Priya', 'Amit', 'Neha', 'Vikram', 'Anjali', 'Rahul', 'Pooja', 'Arjun', 'Divya', 
                     'Karan', 'Sneha', 'Rohan', 'Kavita', 'Sanjay', 'Megha', 'Aditya', 'Ritu', 'Vishal', 'Shreya'];
  const lastNames = ['Sharma', 'Kumar', 'Singh', 'Patel', 'Verma', 'Gupta', 'Reddy', 'Joshi', 'Nair', 'Rao',
                    'Desai', 'Mehta', 'Kulkarni', 'Jain', 'Shah', 'Agarwal', 'Pandey', 'Mishra', 'Das', 'Kapoor'];
  
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${firstName} ${lastName}`;
};

const seedLotteryParticipants = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Import models
    const User = (await import('./models/User.js')).default;
    const Lottery = (await import('./models/Lottery.js')).default;
    const LotteryParticipant = (await import('./models/LotteryParticipant.js')).default;

    // Find active lottery
    const activeLottery = await Lottery.findOne({ status: { $in: ['pending', 'active'] } });
    
    if (!activeLottery) {
      console.log('❌ No active lottery found!');
      console.log('Please create a lottery first through the admin panel.');
      process.exit(1);
    }

    console.log(`📋 Found lottery: ${activeLottery.eventName}`);
    console.log(`🆔 Lottery ID: ${activeLottery._id}\n`);

    // Check existing participants
    const existingCount = await LotteryParticipant.countDocuments({ lotteryId: activeLottery._id });
    console.log(`📊 Existing participants: ${existingCount}\n`);

    console.log('🔨 Creating 1000 test users and registering them...\n');

    let created = 0;
    let skipped = 0;

    for (let i = 1; i <= 1000; i++) {
      const phoneNumber = generateRandomPhone(i);
      
      // Check if user exists
      let user = await User.findOne({ phoneNumber });
      
      if (!user) {
        // Create new user
        user = await User.create({
          name: generateRandomName(),
          phoneNumber,
          password: 'test123',
          aadhaarNumber: `90000${String(i).padStart(7, '0')}`,
          imageUrl: 'https://via.placeholder.com/150',
          imagePublicId: `test-user-${i}`,
          selfieUrl: 'https://via.placeholder.com/150',
          selfiePublicId: `test-selfie-${i}`,
        });
      }

      // Check if already registered for this lottery
      const alreadyRegistered = await LotteryParticipant.findOne({
        lotteryId: activeLottery._id,
        userId: user._id,
      });

      if (!alreadyRegistered) {
        // Register for lottery
        await LotteryParticipant.create({
          lotteryId: activeLottery._id,
          userId: user._id,
        });
        created++;
      } else {
        skipped++;
      }

      // Progress indicator
      if (i % 100 === 0) {
        console.log(`Progress: ${i}/1000 users processed...`);
      }
    }

    // Update lottery participant count
    const totalParticipants = await LotteryParticipant.countDocuments({ lotteryId: activeLottery._id });
    await Lottery.findByIdAndUpdate(activeLottery._id, { totalParticipants });

    console.log('\n✅ Seeding complete!');
    console.log('=====================================');
    console.log(`📊 New participants created: ${created}`);
    console.log(`⏭️  Already registered: ${skipped}`);
    console.log(`🎯 Total participants: ${totalParticipants}`);
    console.log('=====================================');
    console.log('\nYou can now execute spins in the admin panel!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding participants:', error);
    process.exit(1);
  }
};

seedLotteryParticipants();
