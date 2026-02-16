
import mongoose from 'mongoose';
import User from './src/models/User.js';
import Package from './src/models/Package.js';
import RechargePack from './src/models/RechargePack.js';
import RechargeHistory from './src/models/RechargeHistory.js';
import dotenv from 'dotenv';
dotenv.config();

mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/retailchampions", { useNewUrlParser: true, useUnifiedTopology: true })
.then(async () => {
    try {
        console.log("Connected to DB:", mongoose.connection.name);
        // Find specific user from screenshot
        const user = await User.findOne({ couponCode: "VIP332395" });
        if (!user) {
             console.log("User VIP332395 not found. Searching by partial name 'test-user'...");
             // Fallback search
             const users = await User.find({ name: "test-user" });
             console.log("Found users by name 'test-user':", users.map(u => ({ name: u.name, phone: u.phoneNumber, coupon: u.couponCode })));
        } else {
             console.log("Found User:", user.name);
             console.log("Phone:", user.phoneNumber);
             console.log("Current Status:", user.vipStatus);
             console.log("Package:", user.package);
             console.log("Active Pack:", user.activeVipPackName);

             // Check Subscription Package Target
            let subPkg = null;
            let subTarget = null;
            if (user.package) {
                subPkg = await Package.findOne({ amount: user.package });
                if (subPkg && subPkg.referralTarget) {
                    subTarget = subPkg.referralTarget;
                }
                console.log("Subscription Package:", subPkg ? subPkg.name : "Not found", "Target:", subTarget);
            }

            // Check Active Recharge Pack Target
            let rPack = null;
            let packTarget = null;
            if (user.activeVipPackName) {
                rPack = await RechargePack.findOne({ name: user.activeVipPackName });    
                if (rPack && rPack.referralTarget) {
                    packTarget = rPack.referralTarget;
                }
                console.log("Active Recharge Pack:", rPack ? rPack.name : "Not found", "Target:", packTarget);
            }

             let target = 10;
            if (packTarget !== null && subTarget !== null) {
                target = Math.min(packTarget, subTarget);
            } else if (packTarget !== null) {
                target = packTarget;
            } else if (subTarget !== null) {
                target = subTarget;
            }
             console.log("Effective Target:", target);
             
             const referralCount = await User.countDocuments({ referredBy: user._id });
             console.log("Referral Count:", referralCount);
        }

    } catch (e) {
        console.error(e);
    } finally {
        mongoose.disconnect();
    }
});
