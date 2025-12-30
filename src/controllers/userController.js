import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import {
  validateUserRegistration,
  validateGetUsersQuery,
} from '../validators/userValidator.js';

// @desc    Register a new user
// @route   POST /api/users/register
// @access  Public
export const registerUser = async (req, res) => {
  try {
    // Validate request body
    const validation = validateUserRegistration(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validation.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { name, phoneNumber, password, aadhaarNumber, panNumber } = validation.data;

    // Check if image was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'User image is required',
      });
    }

    // Check if user already exists with same phone number, aadhaar or PAN
    const orQuery = [{ phoneNumber }];
    if (aadhaarNumber) orQuery.push({ aadhaarNumber });
    if (panNumber) orQuery.push({ panNumber: panNumber.toUpperCase() });

    const existingUser = await User.findOne({
      $or: orQuery,
    });

    if (existingUser) {
      let message = 'User already exists';
      if (existingUser.phoneNumber === phoneNumber) {
        message = 'User with this phone number already exists';
      } else if (aadhaarNumber && existingUser.aadhaarNumber === aadhaarNumber) {
        message = 'User with this Aadhaar number already exists';
      } else if (panNumber && existingUser.panNumber === panNumber.toUpperCase()) {
        message = 'User with this PAN number already exists';
      }
      
      return res.status(409).json({
        success: false,
        message,
      });
    }

    // Upload image to Cloudinary
    const uploadResult = await uploadToCloudinary(req.file.buffer, 'retailchampions/users');

    // Create user
    const user = await User.create({
      name,
      phoneNumber,
      password: password || 'Retail@123', // Use default if not provided
      aadhaarNumber: aadhaarNumber || null,
      panNumber: panNumber ? panNumber.toUpperCase() : null,
      imageUrl: uploadResult.secure_url,
      imagePublicId: uploadResult.public_id,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        aadhaarNumber: user.aadhaarNumber,
        panNumber: user.panNumber,
        imageUrl: user.imageUrl,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Register User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get all users with search, filter, and pagination
// @route   GET /api/users
// @access  Public
export const getUsers = async (req, res) => {
  try {
    // Validate query parameters
    const validation = validateGetUsersQuery(req.query);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: 'Invalid query parameters',
        errors: validation.error.errors.map((err) => ({
          field: err.path.join('.'),
          message: err.message,
        })),
      });
    }

    const { page, limit, search, sortBy, sortOrder } = validation.data;

    // Build query filter
    const filter = {};

    // Text search on name, phone, aadhaar, and PAN
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phoneNumber: { $regex: search, $options: 'i' } },
        { aadhaarNumber: { $regex: search, $options: 'i' } },
        { panNumber: { $regex: search, $options: 'i' } },
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'asc' ? 1 : -1;

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute queries in parallel for better performance
    const [users, totalCount] = await Promise.all([
      User.find(filter)
        .select('-password -imagePublicId -__v')
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .lean(),
      User.countDocuments(filter),
    ]);

    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    res.status(200).json({
      success: true,
      data: users,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
      },
    });
  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get user by ID
// @route   GET /api/users/:id
// @access  Public
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password -imagePublicId -__v').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('Get User By ID Error:', error);

    // Handle invalid ObjectId
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Delete user by ID
// @route   DELETE /api/users/:id
// @access  Public
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Delete image from Cloudinary
    await deleteFromCloudinary(user.imagePublicId);

    // Delete user from database
    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('Delete User Error:', error);

    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
