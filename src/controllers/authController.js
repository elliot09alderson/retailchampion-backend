import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

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

// @desc    Get contest winner phone number (secret override)
// @route   GET /api/auth/contest-winner
// @access  Private (Admin)
export const getContestWinner = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('contestWinnerPhone');
    res.status(200).json({
      success: true,
      data: { contestWinnerPhone: user.contestWinnerPhone || null },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Set or clear contest winner phone number (secret override)
// @route   PUT /api/auth/contest-winner
// @access  Private (Admin)
export const setContestWinner = async (req, res) => {
  try {
    const { contestWinnerPhone } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.contestWinnerPhone = contestWinnerPhone ? String(contestWinnerPhone).trim() : null;
    await user.save();

    res.status(200).json({
      success: true,
      message: contestWinnerPhone ? 'Contest override set' : 'Contest override cleared',
      data: { contestWinnerPhone: user.contestWinnerPhone },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// @desc    Update admin profile (organization name, profile picture)
// @route   PUT /api/auth/profile
// @access  Private (Admin)
export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const { organizationName } = req.body;

    if (organizationName) {
      user.organizationName = organizationName;
      user.name = organizationName;
    }

    // Handle profile picture upload
    if (req.file) {
      // Delete old picture from Cloudinary if it exists
      if (user.profilePicturePublicId) {
        await deleteFromCloudinary(user.profilePicturePublicId);
      }
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'admins');
      user.profilePictureUrl = uploadResult.secure_url;
      user.profilePicturePublicId = uploadResult.public_id;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user._id,
        organizationName: user.organizationName,
        profilePictureUrl: user.profilePictureUrl,
        name: user.name,
      },
    });
  } catch (error) {
    console.error('Update Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
