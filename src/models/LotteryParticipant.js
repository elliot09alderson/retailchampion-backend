import mongoose from 'mongoose';

const lotteryParticipantSchema = new mongoose.Schema(
  {
    lotteryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lottery',
      required: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'eliminated', 'winner'],
      default: 'active',
    },
    eliminatedInRound: {
      type: Number,
      min: 1,
      max: 4,
    },
    eliminatedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index to prevent duplicate registrations
lotteryParticipantSchema.index({ lotteryId: 1, userId: 1 }, { unique: true });

// Indexes for efficient querying
lotteryParticipantSchema.index({ lotteryId: 1, status: 1 });
lotteryParticipantSchema.index({ userId: 1 });

const LotteryParticipant = mongoose.model('LotteryParticipant', lotteryParticipantSchema);

export default LotteryParticipant;
