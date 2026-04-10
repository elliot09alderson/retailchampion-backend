import jwt from 'jsonwebtoken';
import User from '../models/User.js';

// Generate JWT Token
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '30d',
  });
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const loginUser = async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    // Validate input
    if (!phoneNumber || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide phone number and password',
      });
    }

    // Try admin/superadmin accounts first (faster, fewer records)
    const adminUsers = await User.find({ phoneNumber, role: { $in: ['superadmin', 'admin'] } });

    let user = null;
    for (const candidate of adminUsers) {
      const isMatch = await candidate.comparePassword(password);
      if (isMatch) {
        user = candidate;
        break;
      }
    }

    // If no admin match, try regular user (limit to 5 most recent to avoid timeout)
    if (!user) {
      const regularUsers = await User.find({ phoneNumber, role: 'user' })
        .sort({ createdAt: -1 })
        .limit(5);

      for (const candidate of regularUsers) {
        const isMatch = await candidate.comparePassword(password);
        if (isMatch) {
          user = candidate;
          break;
        }
      }
    }

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    // Check if admin account is active
    if (user.role === 'admin' && user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the Super Admin.',
      });
    }

    // Generate token
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        documentType: user.documentType,
        imageUrl: user.imageUrl,
        role: user.role,
        organizationName: user.organizationName,
        profilePictureUrl: user.profilePictureUrl,
        adminReferralCode: user.adminReferralCode,
      },
      token,
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-password -imagePublicId -__v');

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get Me Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
