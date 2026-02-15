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
      unique: true,
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
  },
  {
    timestamps: true,
  }
);

const Package = mongoose.model('Package', packageSchema);

export default Package;
