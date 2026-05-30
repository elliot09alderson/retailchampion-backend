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
      trim: true,
      validate: {
        validator: function(v) {
          if (!v || v === '') return true;
          return /^\d{12}$/.test(v);
        },
        message: 'Aadhaar number must be exactly 12 digits'
      }
    },
    panNumber: {
      type: String,
      required: false,
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
    bankName: {
      type: String,
      required: false,
      trim: true,
    },
    bankAccountNumber: {
      type: String,
      required: false,
      trim: true,
    },
    ifscCode: {
      type: String,
      required: false,
      trim: true,
      uppercase: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    imagePublicId: {
      type: String,
      required: false,
    },
    selfieUrl: {
      type: String,
      required: false,
    },
    selfiePublicId: {
      type: String,
      required: false,
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'superadmin'],
      default: 'user',
    },
    // Organization fields (for admin accounts created by superadmin)
    organizationName: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    alternateContactNumber: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    profilePictureUrl: {
      type: String,
    },
    profilePicturePublicId: {
      type: String,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
    createdBySuperAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    // Admin referral code for QR-based user onboarding
    adminReferralCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    // Tenant isolation: which admin this user belongs to
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    couponCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    registrationId: {
      type: String,
      required: false,
      trim: true,
      validate: {
        validator: function(v) {
          if (!v || v === '') return true;
          return /^\d{10}$/.test(v);
        },
        message: 'Registration ID must be exactly 10 digits'
      }
    },
    package: {
      type: Number,
      required: true,
    },
    // VIP System fields
    vipStatus: {
      type: String,
      enum: ['none', 'vip', 'vvip'],
      default: 'none',
    },
    referralCode: {
      type: String,
      unique: true,
      sparse: true, // Allow null values but unique when set
    },
    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    referralFormsLeft: {
      type: Number,
      default: 0,
    },
    vipReferralFormsLeft: {
        type: Number,
        default: 0,
    },
    retailReferralFormsLeft: {
        type: Number,
        default: 0,
    },

    referralExpiryDate: {
      type: Date,
      default: null,
    },
    retailReferralExpiryDate: {
      type: Date,
      default: null,
    },
    vipReferralExpiryDate: {
      type: Date,
      default: null,
    },
    idNumber: {
      type: String,
      required: false,
    },
    billImageUrl: {
      type: String,
      required: false,
    },
    activeRetailPackName: {
      type: String,
      default: '',
    },
    activeVipPackName: {
      type: String,
      default: '',
    },
    gallery: {
      type: [String],
      default: [],
    },
    // Secret contest override: admin can set a specific participant phone number
    // to guarantee they win the next contest. Cleared automatically after use.
    contestWinnerPhone: {
      type: String,
      default: null,
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
userSchema.index({ createdAt: -1 }); // Index for sorting by creation date
userSchema.index({ name: 1, phoneNumber: 1 }); // Compound index for combined queries
// Removed unique constraints on phoneNumber and aadhaarNumber to allow multiple registrations
userSchema.index({ phoneNumber: 1, package: 1 }); 
userSchema.index({ aadhaarNumber: 1, package: 1 }); 
userSchema.index({ panNumber: 1, package: 1 }); 
userSchema.index({ registrationId: 1, package: 1 });

const User = mongoose.model('User', userSchema);

export default User;
