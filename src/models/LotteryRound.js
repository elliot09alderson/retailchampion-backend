import mongoose from 'mongoose';

const lotteryRoundSchema = new mongoose.Schema(
  {
    lotteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lottery',
      required: true,
    },
    roundNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 4,
    },
    totalParticipants: {
      type: Number,
      required: true,
    },
    eliminatedCount: {
      type: Number,
      required: true,
    },
    eliminatedUserIds: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    executedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    executedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
lotteryRoundSchema.index({ lotteryId: 1, roundNumber: 1 }, { unique: true });
lotteryRoundSchema.index({ executedAt: -1 });

const LotteryRound = mongoose.model('LotteryRound', lotteryRoundSchema);

export default LotteryRound;
