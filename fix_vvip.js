
import mongoose from 'mongoose';
import User from './src/models/User.js';
import RechargePack from './src/models/RechargePack.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/retailchampions", { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
    try {
        console.log("Connected to DB");
        
        // 1. Update go-16 Recharge Pack Target to 2 (assuming this is the intent)
        const packName = "go-16";
        const rPack = await RechargePack.findOne({ name: packName });
        if (rPack) {
            console.log(`Found Pack '${packName}' with target: ${rPack.referralTarget}`);
            if (rPack.referralTarget !== 2) {
                console.log("Updating target to 2...");
                rPack.referralTarget = 2;
                await rPack.save();
                console.log("Pack updated.");
            }
        } else {
            console.log(`Pack '${packName}' not found.`);
        }

        // 2. Trigger Promotion Check for Test User
        const user = await User.findOne({ couponCode: "VIP332395" });
        if (user) {
             console.log(`Checking user ${user.name} (${user.vipStatus})...`);
             // We need to import the check function or replicate logic
             // Replicating logic for script:
             
             let target = 10;
             if (rPack && rPack.referralTarget) target = rPack.referralTarget;
             
             const referralCount = await User.countDocuments({ referredBy: user._id });
             console.log(`Referrals: ${referralCount}, Target: ${target}`);
             
             if (referralCount >= target && user.vipStatus === 'vip') {
                 console.log("Promoting to VVIP...");
                 user.vipStatus = 'vvip';
                 await user.save();
                 console.log("User promoted.");
             } else {
                 console.log("Promotion not needed or conditions not met.");
             }
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
});
