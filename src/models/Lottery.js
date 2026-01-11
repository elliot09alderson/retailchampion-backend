import mongoose from 'mongoose';

const lotterySchema = new mongoose.Schema(
  {
    eventName: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['pending', 'active', 'completed'],
      default: 'pending',
    },
    currentRound: {
      type: Number,
      default: 0,
      min: 0,
      max: 4,
    },
    totalParticipants: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    winnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    package: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for efficient querying
lotterySchema.index({ status: 1 });
lotterySchema.index({ createdAt: -1 });

const Lottery = mongoose.model('Lottery', lotterySchema);

export default Lottery;
