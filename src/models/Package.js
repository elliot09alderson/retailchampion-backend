import mongoose from 'mongoose';

const packageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    description: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isVip: {
      type: Boolean,
      default: false,
    },
    whatsappGroupLink: {
      type: String,
      trim: true,
      default: '',
    },
    referralTarget: {
      type: Number,
      default: 10, // Default target for VVIP promotion
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Unique amount per admin (tenant isolation)
packageSchema.index({ amount: 1, createdByAdmin: 1 }, { unique: true });

const Package = mongoose.model('Package', packageSchema);

export default Package;
