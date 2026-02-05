import User from '../models/User.js';
import Pin from '../models/Pin.js';
import Package from '../models/Package.js';
import cloudinary, { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import {
  validateUserRegistration,
  validateGetUsersQuery,
} from '../validators/userValidator.js';
import { processVIPRegistration } from './vipController.js';

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

    const { name, phoneNumber, password, aadhaarNumber, panNumber, registrationId, package: userPackage, pin, referralCode, isVipRegistration } = validation.data;

    // Check if this is a VIP package
    const pkg = await Package.findOne({ amount: userPackage });
    const isVipPackage = pkg && pkg.isVip;
    
    let pinRecord = null;
    
    // Validate PIN
    if (!pin) {
      return res.status(400).json({ success: false, message: 'PIN is required' });
    }
    
    pinRecord = await Pin.findOne({ code: pin });
    if (!pinRecord) {
      return res.status(400).json({ success: false, message: 'Invalid PIN' });
    }

    if (pinRecord.package !== userPackage) {
      return res.status(400).json({ success: false, message: 'PIN is not valid for the selected package' });
    }

    if (pinRecord.status !== 'active') {
        return res.status(400).json({ success: false, message: `PIN is ${pinRecord.status}` });
    }

    if (new Date() > pinRecord.expiryDate) {
        pinRecord.status = 'expired';
        await pinRecord.save();
        return res.status(400).json({ success: false, message: 'PIN has expired' });
    }

    // Check if at least one file was uploaded (either image or selfie)
    const files = req.files || {};
    const imageFile = files['image'] ? files['image'][0] : null;
    const selfieFile = files['selfie'] ? files['selfie'][0] : null;

    if (!selfieFile) {
      return res.status(400).json({
        success: false,
        message: 'Selfie is required',
      });
    }

    // Check if user already exists with same phone number AND same package
    // Allow same phone number for different packages
    const existingUserWithSamePackage = await User.findOne({
      phoneNumber,
      package: userPackage
    });

    if (existingUserWithSamePackage) {
      return res.status(409).json({
        success: false,
        message: 'You are already registered for this package',
      });
    }

    // Check for duplicate aadhaar, PAN or registrationId for the SAME package
    // Allow same credentials for different packages
    if (aadhaarNumber) {
      const existingAadhaar = await User.findOne({ aadhaarNumber, package: userPackage });
      if (existingAadhaar) {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this package with this Aadhaar number',
        });
      }
    }

    if (panNumber) {
      const existingPan = await User.findOne({ panNumber: panNumber.toUpperCase(), package: userPackage });
      if (existingPan) {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this package with this PAN number',
        });
      }
    }

    if (registrationId) {
      const existingRegId = await User.findOne({ registrationId, package: userPackage });
      if (existingRegId) {
        return res.status(409).json({
          success: false,
          message: 'You are already registered for this package with this Registration ID',
        });
      }
    }

    // Upload files to Cloudinary
    let uploadResult = null;
    if (imageFile) {
      uploadResult = await uploadToCloudinary(imageFile.buffer, 'retailchampions/users');
    }

    let selfieUploadResult = null;
    if (selfieFile) {
      selfieUploadResult = await uploadToCloudinary(selfieFile.buffer, 'retailchampions/selfies');
    }

    // Generate unique coupon code
    const generateCouponCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let code = 'RC-';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return code;
    };

    let couponCode = generateCouponCode();
    let isUnique = false;
    let attempts = 0;

    while (!isUnique && attempts < 5) {
      const existingCode = await User.findOne({ couponCode });
      if (!existingCode) {
        isUnique = true;
      } else {
        couponCode = generateCouponCode();
        attempts++;
      }
    }

    // Build user object dynamically to avoid setting null on unique sparse fields
    const userData = {
      name,
      phoneNumber,
      password: password || 'Retail@123',
      couponCode,
      package: userPackage,
    };

    if (uploadResult) {
      userData.imageUrl = uploadResult.secure_url;
      userData.imagePublicId = uploadResult.public_id;
    }

    if (selfieUploadResult) {
      userData.selfieUrl = selfieUploadResult.secure_url;
      userData.selfiePublicId = selfieUploadResult.public_id;
    }

    if (aadhaarNumber) {
      userData.aadhaarNumber = aadhaarNumber;
    }
    if (panNumber) {
      userData.panNumber = panNumber.toUpperCase();
    }
    if (registrationId) {
      userData.registrationId = registrationId;
    }

    // Create user
    const user = await User.create(userData);

    // Mark PIN as used
    if (pinRecord) {
      pinRecord.status = 'used';
      pinRecord.isUsed = true;
      pinRecord.usedBy = user._id;
      await pinRecord.save();
    }

    // Process VIP registration if applicable
    await processVIPRegistration(user._id, userPackage, referralCode);

    // Fetch updated user with VIP status
    const updatedUser = await User.findById(user._id).select('-password');

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        id: updatedUser._id,
        name: updatedUser.name,
        phoneNumber: updatedUser.phoneNumber,
        aadhaarNumber: updatedUser.aadhaarNumber,
        panNumber: updatedUser.panNumber,
        imageUrl: updatedUser.imageUrl,
        selfieUrl: updatedUser.selfieUrl,
        couponCode: updatedUser.couponCode,
        registrationId: updatedUser.registrationId,
        package: updatedUser.package,
        vipStatus: updatedUser.vipStatus,
        referralCode: updatedUser.referralCode,
        createdAt: updatedUser.createdAt,
      },

    });
  } catch (error) {
    console.error('Register User Error:', error);

    // Handle MongoDB duplicate key error (11000)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const message = `A user with this ${field} already exists.`;
      return res.status(409).json({
        success: false,
        message,
        error: error.message
      });
    }

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
        { registrationId: { $regex: search, $options: 'i' } },
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

    // Delete images from Cloudinary
    if (user.imagePublicId) {
      await deleteFromCloudinary(user.imagePublicId);
    }
    if (user.selfiePublicId) {
      await deleteFromCloudinary(user.selfiePublicId);
    }

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
// @desc    Delete all users
// @route   DELETE /api/users
// @access  Private (requires auth header)
export const deleteAllUsers = async (req, res) => {
  try {
    // Get all public IDs for Cloudinary deletion
    const users = await User.find({ role: 'user' }).select('imagePublicId selfiePublicId').lean();
    const publicIds = users.reduce((acc, u) => {
      if (u.imagePublicId) acc.push(u.imagePublicId);
      if (u.selfiePublicId) acc.push(u.selfiePublicId);
      return acc;
    }, []);

    // Delete images in batches of 100 (Cloudinary limit per call)
    if (publicIds.length > 0) {
      for (let i = 0; i < publicIds.length; i += 100) {
        const batch = publicIds.slice(i, i + 100);
        await cloudinary.api.delete_resources(batch);
      }
    }

    // Delete all users from database
    await User.deleteMany({ role: 'user' });

    res.status(200).json({
      success: true,
      message: 'All users deleted successfully',
    });
  } catch (error) {
    console.error('Delete All Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
// @desc    Get user count with filters
// @route   GET /api/users/count
// @access  Private
export const getUserCount = async (req, res) => {
  try {
    const { package: pkg, startDate, endDate } = req.query;
    
    const query = { role: 'user' };

    if (pkg) {
      query.package = Number(pkg);
    }
    
    if (startDate && endDate) {
        query.createdAt = {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
        };
    }

    const count = await User.countDocuments(query);

    res.status(200).json({
      success: true,
      count,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user count',
      error: error.message,
    });
  }
};
