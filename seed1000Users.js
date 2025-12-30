import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import User from './src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the backend directory
dotenv.config({ path: join(__dirname, '.env') });

// Indian names for variety
const firstNames = ['Raj', 'Priya', 'Amit', 'Sneha', 'Vikram', 'Anjali', 'Rahul', 'Pooja', 'Arjun', 'Neha', 
  'Karan', 'Divya', 'Rohan', 'Kavya', 'Aditya', 'Riya', 'Sanjay', 'Meera', 'Akash', 'Simran',
  'Varun', 'Shreya', 'Naveen', 'Aditi', 'Kunal', 'Tanvi', 'Harsh', 'Ishita', 'Manish', 'Nidhi',
  'Vishal', 'Preeti', 'Gaurav', 'Sakshi', 'Deepak', 'Swati', 'Nikhil', 'Ananya', 'Sandeep', 'Pallavi',
  'Abhishek', 'Kritika', 'Suresh', 'Jyoti', 'Manoj', 'Shweta', 'Rajesh', 'Anushka', 'Vivek', 'Sonal'];

const lastNames = ['Sharma', 'Patel', 'Kumar', 'Singh', 'Gupta', 'Verma', 'Joshi', 'Reddy', 'Mehta', 'Nair',
  'Rao', 'Iyer', 'Desai', 'Shah', 'Agarwal', 'Malhotra', 'Chopra', 'Bhatia', 'Kapoor', 'Khanna',
  'Bansal', 'Jain', 'Saxena', 'Pandey', 'Mishra', 'Tiwari', 'Sinha', 'Gandhi', 'Thakur', 'Chauhan',
  'Pillai', 'Menon', 'Krishna', 'Kulkarni', 'Deshpande', 'Patil', 'Bhatt', 'Trivedi', 'Naik', 'Pawar'];

// Generate random phone number (Indian format)
function generatePhoneNumber(index) {
  const prefix = ['98', '97', '96', '95', '94', '93', '92', '91', '90', '89', '88', '87'];
  const selectedPrefix = prefix[index % prefix.length];
  const remaining = String(10000000 + index).slice(-8);
  return `${selectedPrefix}${remaining}`;
}

// Generate random Aadhaar (12 digits)
function generateAadhaar(index) {
  const base = 100000000000 + index;
  return String(base).slice(0, 12);
}

// Generate random PAN (format: ABCDE1234F)
function generatePAN(index) {
  const letters1 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const letters2 = letters1.split('');
  const part1 = letters2[index % 26] + letters2[(index + 5) % 26] + letters2[(index + 10) % 26] + 
                letters2[(index + 15) % 26] + letters2[(index + 20) % 26];
  const part2 = String(1000 + (index % 9000)).slice(0, 4);
  const part3 = letters2[(index + 3) % 26];
  return part1 + part2 + part3;
}

// Placeholder image URLs (using placeholder services)
function getPlaceholderImage(index) {
  const seed = index + 1;
  return `https://api.dicebear.com/7.x/avataaars/png?seed=${seed}`;
}

async function seedUsers() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected for seeding...');

    // Check existing users count
    const existingCount = await User.countDocuments({});
    console.log(`📊 Existing users: ${existingCount}`);

    if (existingCount >= 1000) {
      console.log('✅ Already have 1000+ users. No need to seed.');
      process.exit(0);
    }

    const users = [];
    
    // Generate users (only if needed)
    const usersToCreate = 1000 - existingCount;
    console.log(`📝 Creating ${usersToCreate} new users...`);
    
    for (let i = existingCount; i < 1000; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length];
      const name = `${firstName} ${lastName} ${i > 49 ? Math.floor(i / 50) : ''}`.trim();
      
      // Use new schema: aadhaarNumber (required) and panNumber (optional)
      const aadhaarNumber = generateAadhaar(i);
      const hasPAN = i % 3 === 0; // 1/3 have PAN
      const panNumber = hasPAN ? generatePAN(i) : null;

      // Build user object - only include panNumber if it exists
      const userObj = {
        name,
        phoneNumber: generatePhoneNumber(i),
        password: 'password123', // Will be hashed by the model
        aadhaarNumber,
        imageUrl: getPlaceholderImage(i),
        imagePublicId: `seed_user_${i}`,
      };

      // Only add panNumber if it's not null (to properly use sparse index)
      if (panNumber) {
        userObj.panNumber = panNumber;
      }

      users.push(userObj);

      // Log progress every 100 users
      if ((i + 1) % 100 === 0) {
        console.log(`Prepared ${i + 1} users...`);
      }
    }

    if (users.length > 0) {
      // Bulk insert
      console.log(`Inserting ${users.length} users into database...`);
      await User.insertMany(users);
      console.log(`✅ Successfully seeded ${users.length} users!`);

      // Display sample users
      console.log('\nSample users:');
      users.slice(0, 5).forEach((user, idx) => {
        console.log(`${idx + 1}. ${user.name} - ${user.phoneNumber} - Aadhaar: ${user.aadhaarNumber}${user.panNumber ? ` | PAN: ${user.panNumber}` : ''}`);
      });
    }

    const totalUsers = await User.countDocuments({});
    console.log(`\n📊 Total users in database: ${totalUsers}`);

    process.exit(0);
  } catch (error) {
    console.error('Seeding error:', error);
    process.exit(1);
  }
}

seedUsers();
