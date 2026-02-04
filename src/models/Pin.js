import mongoose from 'mongoose';

const pinSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    package: {
      type: Number,
      required: true,
    },
    expiryDate: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'used', 'expired'],
      default: 'active',
    },
    isUsed: {
      type: Boolean,
      default: false,
    },
    usedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User', // Admin who generated it
      default: null, // Optional if we don't track who generated it
    }
  },
  {
    timestamps: true,
  }
);

// Index to easily find active pins
pinSchema.index({ code: 1, status: 1 });

const Pin = mongoose.model('Pin', pinSchema);

export default Pin;
