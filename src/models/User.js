import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phoneNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    password: {
      type: String,
      required: false,
      default: 'Retail@123', // Default password if not provided
    },
    aadhaarNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true,
      trim: true,
      validate: {
        validator: function(v) {
          return /^\d{12}$/.test(v);
        },
        message: 'Aadhaar number must be exactly 12 digits'
      }
    },
    panNumber: {
      type: String,
      required: false,
      unique: true,
      sparse: true, // Allows multiple null values
      trim: true,
      uppercase: true,
      validate: {
        validator: function(v) {
          // If empty, it's valid (since it's optional)
          if (!v || v === '') return true;
          return /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(v);
        },
        message: 'PAN number must be in format: ABCDE1234F'
      }
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imagePublicId: {
      type: String,
      required: true,
    },
    role: {
      type: String,
      enum: ['user', 'admin'],
      default: 'user',
    },
  },
  {
    timestamps: true,
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Create indexes for efficient querying with 5000+ users
userSchema.index({ name: 'text' }); // Text index for search
userSchema.index({ phoneNumber: 1 }); // Index for phone number queries
userSchema.index({ aadhaarNumber: 1 }); // Index for Aadhaar number queries
userSchema.index({ panNumber: 1 }); // Index for PAN number queries
userSchema.index({ createdAt: -1 }); // Index for sorting by creation date
userSchema.index({ name: 1, phoneNumber: 1 }); // Compound index for combined queries

const User = mongoose.model('User', userSchema);

export default User;
