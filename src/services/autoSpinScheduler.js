
import cron from 'node-cron';
import Lottery from '../models/Lottery.js';
import User from '../models/User.js';
import { performSpinLogic } from './lotteryEngine.js';

const SYSTEM_ADMIN_EMAIL = 'admin@example.com'; // Fallback or use DB lookup

export const startScheduler = () => {
  // Run every 10 seconds for faster response
  cron.schedule('*/10 * * * * *', async () => {
    // console.log('Running auto-spin scheduler...'); 
    // Commented out repetitive log to reduce noise, enable if debugging
    try {
      const now = new Date();
      
      // Find eligible lotteries:
      // 1. Status is pending or active
      // 2. End date has passed
      // 3. Auto spin is enabled (default true)
      const expiredLotteries = await Lottery.find({
        status: { $in: ['pending', 'active'] },
        endDate: { $lt: now },
        isAutoSpin: true
      });

      if (expiredLotteries.length === 0) return;

      console.log(`Found ${expiredLotteries.length} expired lotteries to process.`);

      // Get an admin user ID to attribute the actions to
      const adminUser = await User.findOne({ role: 'admin' });
      const executorId = adminUser ? adminUser._id : null;

      if (!executorId) {
        console.error('No admin user found to execute auto-spins.');
        return;
      }

      for (const lottery of expiredLotteries) {
        console.log(`Processing auto-spin for lottery: ${lottery.eventName} (${lottery._id})`);
        
        let isComplete = false;
        let roundCounter = 0;
        
        // Loop until completed or safety break
        while (!isComplete && roundCounter < 10) {
          try {
            console.log(`Executing round ${lottery.currentRound + 1}...`);
            const result = await performSpinLogic(lottery._id, executorId);
            
            isComplete = result.isComplete;
            roundCounter++;
            
            // Add a small delay between rounds to ensure timestamps likely differ slightly
            await new Promise(resolve => setTimeout(resolve, 2000));
            
          } catch (err) {
            console.error(`Error in auto-spin round for lottery ${lottery._id}:`, err.message);
            // If error is "No active participants" or similar fatal, break loop
            if (err.message.includes('No active participants') || err.message.includes('Already completed')) {
                // Determine if we should mark it as failed or force complete?
                // For now, just stop trying this minute. Be careful not to loop forever.
                // If no participants, maybe we should close the lottery?
                if (err.message.includes('No active participants')) {
                    lottery.status = 'completed'; // Force complete if no one is there
                    await lottery.save();
                }
                break;
            }
            break; // Stop on error to retry next minute
          }
        }
        
        console.log(`Finished processing lottery ${lottery._id}. Status: ${isComplete ? 'Completed' : 'Partial/Error'}`);
      }

    } catch (error) {
      console.error('Scheduler error:', error);
    }
  });
};
