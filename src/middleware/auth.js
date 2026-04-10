import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
  let token;

  // Check for token in Authorization header (Bearer token)
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, no token provided',
    });
  }

  try {
    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Get user from token (exclude password)
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authorized, user not found',
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized, token invalid',
    });
  }
};

// Admin authorization middleware
export const isAdmin = async (req, res, next) => {
  if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
    // Check if admin account is active (superadmins are always active)
    if (req.user.role === 'admin' && req.user.status === 'inactive') {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact the Super Admin.',
      });
    }
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Admin access required',
    });
  }
};

// Super Admin authorization middleware
export const isSuperAdmin = async (req, res, next) => {
  if (req.user && req.user.role === 'superadmin') {
    next();
  } else {
    return res.status(403).json({
      success: false,
      message: 'Super Admin access required',
    });
  }
};

// Tenant isolation helper: returns a filter object for queries
// SuperAdmin sees all data, Admin sees only their own data
export const getTenantFilter = (req) => {
  if (req.user.role === 'superadmin') {
    return {}; // No filter - sees everything
  }
  return { createdByAdmin: req.user._id };
};

// Get the admin ID for setting on new records
export const getAdminId = (req) => {
  if (req.user.role === 'superadmin') {
    return null; // SuperAdmin-created data is global (or can be assigned later)
  }
  return req.user._id;
};
