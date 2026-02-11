import mongoose from 'mongoose';

const rechargeHistorySchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  type: {
    type: String,
    enum: ['retail', 'vip'],
    required: true,
  },
  packName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  referralForms: {
    type: Number,
    required: true,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('RechargeHistory', rechargeHistorySchema);
