import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const fixIndexes = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    console.log('Checking indexes for "users" collection...');
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));

    // Drop indexes that are causing issues with multiple null values
    // Mongoose will recreate them correctly (with sparse: true) on next server start
    
    if (indexes.find(i => i.name === 'panNumber_1')) {
      console.log('Dropping panNumber_1 index...');
      await collection.dropIndex('panNumber_1');
    }

    if (indexes.find(i => i.name === 'aadhaarNumber_1')) {
      console.log('Dropping aadhaarNumber_1 index...');
      await collection.dropIndex('aadhaarNumber_1');
    }

    console.log('✅ Successfully dropped non-sparse indexes.');
    console.log('Mongoose will automatically recreate them with "sparse: true" when you restart the backend server.');
    
    process.exit(0);
  } catch (err) {
    console.error('Error fixing indexes:', err);
    process.exit(1);
  }
};

fixIndexes();
