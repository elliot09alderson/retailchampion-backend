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
    }
  },
  {
    timestamps: true,
  }
);

const RechargePack = mongoose.model('RechargePack', rechargePackSchema);

export default RechargePack;
