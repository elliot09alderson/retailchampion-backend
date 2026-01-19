import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function dropOldUniqueIndexes() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const db = mongoose.connection.db;
    const collection = db.collection('users');

    // Get all indexes
    const indexes = await collection.indexes();
    console.log('\n📋 Current indexes:');
    indexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    // Indexes to drop (old unique indexes that prevent multi-package registration)
    const indexesToDrop = ['aadhaarNumber_1', 'panNumber_1', 'registrationId_1'];
    
    for (const indexName of indexesToDrop) {
      const indexExists = indexes.find(idx => idx.name === indexName);
      if (indexExists) {
        console.log(`\n🗑️  Dropping ${indexName} index...`);
        await collection.dropIndex(indexName);
        console.log(`✅ Successfully dropped ${indexName} index`);
      } else {
        console.log(`\n⚠️  ${indexName} index not found (already dropped or never existed)`);
      }
    }

    // List indexes after
    const updatedIndexes = await collection.indexes();
    console.log('\n📋 Updated indexes:');
    updatedIndexes.forEach(idx => {
      console.log(`  - ${idx.name}:`, JSON.stringify(idx.key));
    });

    await mongoose.disconnect();
    console.log('\n✅ Done!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

dropOldUniqueIndexes();
