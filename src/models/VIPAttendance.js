import mongoose from 'mongoose';

const vipAttendanceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      trim: true,
    },
    meetingCode: {
      type: String,
      required: true,
      trim: true,
    },
    leaderCode: {
      type: String,
      trim: true,
    },
    photo: {
      type: String,
      required: true,
    },
    photoPublicId: {
      type: String,
      required: false,
    },
    attendedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Basic indexing for faster lookups
vipAttendanceSchema.index({ phoneNumber: 1 });
vipAttendanceSchema.index({ meetingCode: 1 });
vipAttendanceSchema.index({ attendedAt: -1 });

const VIPAttendance = mongoose.model('VIPAttendance', vipAttendanceSchema);

export default VIPAttendance;
