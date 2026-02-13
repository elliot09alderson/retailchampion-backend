
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs';
import path, { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import User from './src/models/User.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from the same directory as the script
dotenv.config({ path: join(__dirname, '.env') });

const CSV_FILENAME = 'users_to_import.csv'; // Updated to use the copied file
// Check in current dir AND script dir
let CSV_FILE_PATH = '';

if (fs.existsSync(join(process.cwd(), CSV_FILENAME))) {
    CSV_FILE_PATH = join(process.cwd(), CSV_FILENAME);
} else if (fs.existsSync(join(__dirname, CSV_FILENAME))) {
    CSV_FILE_PATH = join(__dirname, CSV_FILENAME);
} else {
    // If not found, try one level up from backend if running from backend
    if (fs.existsSync(join(__dirname, '..', CSV_FILENAME))) {
        CSV_FILE_PATH = join(__dirname, '..', CSV_FILENAME);
    }
}

// Simple CSV Parser handling quotes
const parseCSV = (text) => {
    const lines = text.split('\n').filter(l => l.trim());
    if (lines.length === 0) return [];

    // Parse header manually to handle quotes if present
    const headers = [];
    let currentHeader = '';
    let inQuotesHeader = false;
    for (const char of lines[0]) {
        if (char === '"') inQuotesHeader = !inQuotesHeader;
        else if (char === ',' && !inQuotesHeader) {
            headers.push(currentHeader.trim().replace(/^"|"$/g, ''));
            currentHeader = '';
        } else {
            currentHeader += char;
        }
    }
    headers.push(currentHeader.trim().replace(/^"|"$/g, ''));
    
    const result = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const row = {};
        let currentVal = '';
        let inQuotes = false;
        let colIndex = 0;

        for (let charIndex = 0; charIndex < line.length; charIndex++) {
            const char = line[charIndex];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                // End of column
                if (colIndex < headers.length) {
                    row[headers[colIndex]] = currentVal.trim().replace(/^"|"$/g, '');
                }
                currentVal = '';
                colIndex++;
            } else {
                currentVal += char;
            }
        }
        // Last column
        if (colIndex < headers.length) {
            row[headers[colIndex]] = currentVal.trim().replace(/^"|"$/g, '');
        }

        result.push(row);
    }
    return result;
};

const importUsers = async () => {
    try {
        if (!CSV_FILE_PATH) {
            console.error(`❌ File not found: ${CSV_FILENAME}`);
            console.log(`checked: ${process.cwd()} and ${__dirname}`);
            process.exit(1);
        }

        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        console.log(`📖 Reading CSV file: ${CSV_FILE_PATH}`);
        const csvContent = fs.readFileSync(CSV_FILE_PATH, 'utf-8');
        const rows = parseCSV(csvContent);
        
        console.log(`📊 Found ${rows.length} rows to process`);

        let successCount = 0;
        let failedCount = 0;
        const requestTime = new Date();

        for (const rawRow of rows) {
            // Map CSV headers to Model fields
            const row = {
                name: rawRow['Name'],
                phoneNumber: rawRow['Phone Number'],
                aadhaarNumber: rawRow['Aadhaar Number'],
                panNumber: rawRow['PAN Number'],
                couponCode: rawRow['Coupon Code'],
                createdAt: rawRow['Registered At'],
                // ALWAYS generate a new ID to ensure we append all users as new records
                // _id: undefined, 
                package: rawRow.package || 10 // Default to 10 if missing
            };

            // 1. _id - Explicitly remove to force new ID generation
            delete row._id;
            delete row.id;

            // 2. Package (Required Number)
            if (row.package) {
                const pkgNum = Number(row.package);
                if (!isNaN(pkgNum)) {
                   row.package = pkgNum;
                } else {
                   row.package = 10;
                }
            }

            // 3. Required Fields
            if (!row.name || !row.phoneNumber) {
                console.warn(`⚠️ Skipping row due to missing name or phone: ${JSON.stringify(row)}`);
                failedCount++;
                continue;
            }

            // 4. Dates
            if (row.createdAt) {
                let parsedDate = Date.parse(row.createdAt);
                if (isNaN(parsedDate)) {
                    const [datePart, timePart] = row.createdAt.split(', ');
                    if (datePart) {
                        const [day, month, year] = datePart.split('/');
                        const isoString = `${year}-${month}-${day}T${timePart || '00:00:00'}`;
                        parsedDate = Date.parse(isoString);
                    }
                }
                
                if (!isNaN(parsedDate)) {
                    row.createdAt = new Date(parsedDate);
                } else {
                     row.createdAt = requestTime;
                }
            } else {
                row.createdAt = requestTime;
            }
            row.updatedAt = requestTime;

            // 5. Clean empty fields
            if (!row.couponCode || row.couponCode === 'N/A') delete row.couponCode;
            if (!row.referralCode || row.referralCode === 'N/A') delete row.referralCode;
            if (!row.panNumber || row.panNumber === 'N/A') delete row.panNumber;
            if (!row.aadhaarNumber || row.aadhaarNumber === 'N/A') delete row.aadhaarNumber;
            
            // 6. Role protection
            if (row.role === 'admin') continue;

            try {
                // Try to insert
                await User.create(row);
                successCount++;
                if (successCount % 100 === 0) process.stdout.write('.');
            } catch (err) {
                // Handle Duplicate Key Errors
                if (err.code === 11000) {
                    const field = Object.keys(err.keyPattern)[0];
                    // If conflict is on couponCode or referralCode, remove it and retry
                    if (field === 'couponCode' || field === 'referralCode') {
                        delete row[field];
                        try {
                            await User.create(row);
                            successCount++;
                            // console.log(`   Refixed duplicate ${field} for ${row.name}`);
                        } catch (retryErr) {
                            console.error(`❌ Failed to insert (retry) ${row.name}:`, retryErr.message);
                            failedCount++;
                        }
                    } else {
                        // Conflict on something else (like unique index we didn't expect?)
                        // If it's phone number and we were wrong about uniqueness, we can't easily fix without changing data
                         console.error(`❌ Duplicate Key Error (${field}) for ${row.name}:`, err.message);
                         failedCount++;
                    }
                } else {
                    console.error(`❌ Error inserting ${row.name}:`, err.message);
                    failedCount++;
                }
            }
        }

        console.log('\n✅ Import Only Summary:');
        console.log(`   Success: ${successCount}`);
        console.log(`   Failed: ${failedCount}`);

        process.exit(0);

    } catch (error) {
        console.error('❌ Script Error:', error);
        process.exit(1);
    }
};

importUsers();
