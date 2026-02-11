
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const checkAndFixIndexes = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        const db = mongoose.connection.db;
        const collection = db.collection('users');

        const indexes = await collection.indexes();
        console.log('Full Index Details:', JSON.stringify(indexes, null, 2));

        // Fix 1: Ensure referralCode is sparse
        const referralIndex = indexes.find(i => i.name === 'referralCode_1');
        if (referralIndex) {
            console.log('Checking referralCode_1 index...');
            if (referralIndex.unique && !referralIndex.sparse) {
                console.log('referralCode_1 is UNIQUE but NOT SPARSE! This causes issues with null values.');
                console.log('Dropping referralCode_1 index to allow recreation with correct options...');
                await collection.dropIndex('referralCode_1');
                console.log('referralCode_1 dropped.');
            } else {
                console.log('referralCode_1 looks fine (Sparse: ' + !!referralIndex.sparse + ')');
            }
        }

        // Fix 2: Ensure couponCode is sparse (optional but good practice as schema defines it)
        const couponIndex = indexes.find(i => i.name === 'couponCode_1');
        if (couponIndex) {
             console.log('Checking couponCode_1 index...');
             if(couponIndex.unique && !couponIndex.sparse) {
                 console.log('couponCode_1 is UNIQUE but NOT SPARSE. Dropping...');
                 await collection.dropIndex('couponCode_1');
                 console.log('couponCode_1 dropped.');
             }
        }

        // Fix 3: Drop any residual phoneNumber unique index if found (covered by previous script, but good to double check)
        const phoneIndex = indexes.find(i => i.key.phoneNumber && Object.keys(i.key).length === 1 && i.unique);
        if(phoneIndex) {
            console.log(`Dropping unique phone index: ${phoneIndex.name}`);
            await collection.dropIndex(phoneIndex.name);
        }

        console.log('Index checks complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkAndFixIndexes();
