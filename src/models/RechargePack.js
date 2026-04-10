import mongoose from 'mongoose';

const rechargePackSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    count: {
      type: Number,
      required: true,
    },
    price: {
        type: Number,
        required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    type: { // 'retail' or 'vip'
        type: String,
        enum: ['retail', 'vip'],
        default: 'retail' 
    },
    referralTarget: {
        type: Number,
        default: 10,
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

const RechargePack = mongoose.model('RechargePack', rechargePackSchema);

export default RechargePack;
