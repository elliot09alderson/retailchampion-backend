import crypto from 'crypto';
import User from '../models/User.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// Generate unique admin referral code
const generateAdminReferralCode = () => {
  return 'ADM-' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// @desc    Register a new admin
// @route   POST /api/superadmin/admins
// @access  Super Admin only
export const registerAdmin = async (req, res) => {
  try {
    const {
      organizationName,
      phoneNumber,
      alternateContactNumber,
      email,
      password,
      address,
    } = req.body;

    // Validate required fields
    if (!organizationName || !phoneNumber || !email || !password || !address) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: organizationName, phoneNumber, email, password, address',
      });
    }

    // Check if phone number already exists for an admin/superadmin
    const existingAdmin = await User.findOne({
      phoneNumber,
      role: { $in: ['admin', 'superadmin'] },
    });

    if (existingAdmin) {
      return res.status(400).json({
        success: false,
        message: 'An admin with this phone number already exists',
      });
    }

    // Check if email already exists for an admin
    const existingEmail = await User.findOne({
      email,
      role: { $in: ['admin', 'superadmin'] },
    });

    if (existingEmail) {
      return res.status(400).json({
        success: false,
        message: 'An admin with this email already exists',
      });
    }

    // Handle profile picture upload
    let profilePictureUrl = null;
    let profilePicturePublicId = null;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file.buffer, 'admins');
      profilePictureUrl = uploadResult.secure_url;
      profilePicturePublicId = uploadResult.public_id;
    }

    // Generate unique admin referral code
    let adminReferralCode;
    let isUnique = false;
    while (!isUnique) {
      adminReferralCode = generateAdminReferralCode();
      const existing = await User.findOne({ adminReferralCode });
      if (!existing) isUnique = true;
    }

    // Create admin user
    const admin = await User.create({
      name: organizationName,
      organizationName,
      phoneNumber,
      alternateContactNumber: alternateContactNumber || '',
      email,
      password,
      address,
      profilePictureUrl,
      profilePicturePublicId,
      role: 'admin',
      package: 0,
      status: 'active',
      createdBySuperAdmin: req.user._id,
      adminReferralCode,
    });

    res.status(201).json({
      success: true,
      message: 'Admin registered successfully',
      data: {
        id: admin._id,
        organizationName: admin.organizationName,
        phoneNumber: admin.phoneNumber,
        email: admin.email,
        status: admin.status,
        profilePictureUrl: admin.profilePictureUrl,
        createdAt: admin.createdAt,
      },
    });
  } catch (error) {
    console.error('Register Admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register admin',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get all admins
// @route   GET /api/superadmin/admins
// @access  Super Admin only
export const getAllAdmins = async (req, res) => {
  try {
    // Exclude admins that share the super admin's phone number (legacy duplicates)
    const superAdminPhones = await User.find({ role: 'superadmin' }).distinct('phoneNumber');
    const admins = await User.find({
      role: 'admin',
      phoneNumber: { $nin: superAdminPhones },
    })
      .select('-password -__v')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: admins.length,
      data: admins,
    });
  } catch (error) {
    console.error('Get All Admins Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admins',
    });
  }
};

// @desc    Get single admin by ID
// @route   GET /api/superadmin/admins/:id
// @access  Super Admin only
export const getAdminById = async (req, res) => {
  try {
    const admin = await User.findOne({ _id: req.params.id, role: 'admin' })
      .select('-password -__v');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    res.status(200).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    console.error('Get Admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin',
    });
  }
};

// @desc    Update admin status (active/inactive)
// @route   PATCH /api/superadmin/admins/:id/status
// @access  Super Admin only
export const updateAdminStatus = async (req, res) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Status must be either "active" or "inactive"',
      });
    }

    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    admin.status = status;
    await admin.save();

    res.status(200).json({
      success: true,
      message: `Admin ${status === 'active' ? 'activated' : 'deactivated'} successfully`,
      data: {
        id: admin._id,
        organizationName: admin.organizationName,
        status: admin.status,
      },
    });
  } catch (error) {
    console.error('Update Admin Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update admin status',
    });
  }
};

// @desc    Delete an admin
// @route   DELETE /api/superadmin/admins/:id
// @access  Super Admin only
export const deleteAdmin = async (req, res) => {
  try {
    const { password } = req.body;

    // Require super admin password for deletion
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Super Admin password is required to delete an admin',
      });
    }

    // Verify super admin password
    const superAdmin = await User.findById(req.user._id);
    const isMatch = await superAdmin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Incorrect Super Admin password',
      });
    }

    const admin = await User.findOne({ _id: req.params.id, role: 'admin' });

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found',
      });
    }

    // Prevent deleting superadmin accounts
    if (admin.role === 'superadmin') {
      return res.status(403).json({
        success: false,
        message: 'Cannot delete Super Admin accounts',
      });
    }

    // Delete profile picture from Cloudinary if exists
    if (admin.profilePicturePublicId) {
      await deleteFromCloudinary(admin.profilePicturePublicId);
    }

    await User.findByIdAndDelete(req.params.id);

    res.status(200).json({
      success: true,
      message: 'Admin deleted successfully',
    });
  } catch (error) {
    console.error('Delete Admin Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete admin',
    });
  }
};

// @desc    Get super admin dashboard stats
// @route   GET /api/superadmin/stats
// @access  Super Admin only
// @desc    Resolve admin referral code (get admin ID from code)
// @route   GET /api/admin-referral/:code
// @access  Public
export const resolveAdminReferral = async (req, res) => {
  try {
    const { code } = req.params;

    const admin = await User.findOne({
      adminReferralCode: code.toUpperCase(),
      role: 'admin',
      status: { $ne: 'inactive' },
    }).select('_id organizationName name');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Invalid or expired referral code',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        adminId: admin._id,
        organizationName: admin.organizationName || admin.name,
      },
    });
  } catch (error) {
    console.error('Resolve Admin Referral Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve referral code',
    });
  }
};

export const getDashboardStats = async (req, res) => {
  try {
    const totalAdmins = await User.countDocuments({ role: 'admin' });
    const activeAdmins = await User.countDocuments({ role: 'admin', status: 'active' });
    const inactiveAdmins = await User.countDocuments({ role: 'admin', status: 'inactive' });
    const totalUsers = await User.countDocuments({ role: 'user' });

    res.status(200).json({
      success: true,
      data: {
        totalAdmins,
        activeAdmins,
        inactiveAdmins,
        totalUsers,
      },
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats',
    });
  }
};
