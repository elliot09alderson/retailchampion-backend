import User from '../models/User.js';
import Package from '../models/Package.js';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { uploadToCloudinary } from '../config/cloudinary.js';

// Generate a unique referral code
const generateReferralCode = () => {
  return 'VIP' + crypto.randomBytes(4).toString('hex').toUpperCase();
};

// Check and promote VIP to VVIP if they have 10+ referrals
const checkAndPromoteToVVIP = async (userId) => {
  const user = await User.findById(userId);
  if (!user) return;
  
  const referralCount = await User.countDocuments({ referredBy: userId });
  
  // Update referral count
  user.referralCount = referralCount;
  
  // Promote to VVIP if 10+ referrals (more than 9)
  if (referralCount >= 10 && user.vipStatus === 'vip') {
    user.vipStatus = 'vvip';
  }
  
  await user.save();
  return user;
};

// @desc    Get all VIPs
// @route   GET /api/vip
// @access  Private (Admin)
export const getAllVIPs = async (req, res) => {
  try {
    const vips = await User.find({ vipStatus: 'vip' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    // Enrich with referral counts
    const enrichedVips = await Promise.all(
      vips.map(async (vip) => {
        const referralCount = await User.countDocuments({ referredBy: vip._id });
        return {
          ...vip.toObject(),
          referralCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedVips,
    });
  } catch (error) {
    console.error('Get VIPs Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch VIPs',
    });
  }
};

// @desc    Get all VVIPs
// @route   GET /api/vip/vvip
// @access  Private (Admin)
export const getAllVVIPs = async (req, res) => {
  try {
    const vvips = await User.find({ vipStatus: 'vvip' })
      .select('-password')
      .sort({ createdAt: -1 });
    
    // Enrich with referral counts and sub-VVIPs
    const enrichedVvips = await Promise.all(
      vvips.map(async (vvip) => {
        const vipReferrals = await User.countDocuments({ 
          referredBy: vvip._id, 
          vipStatus: 'vip' 
        });
        const vvipReferrals = await User.countDocuments({ 
          referredBy: vvip._id, 
          vipStatus: 'vvip' 
        });
        const totalReferrals = await User.countDocuments({ referredBy: vvip._id });
        
        return {
          ...vvip.toObject(),
          vipReferrals,
          vvipReferrals,
          totalReferrals,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedVvips,
    });
  } catch (error) {
    console.error('Get VVIPs Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch VVIPs',
    });
  }
};

// @desc    Generate referral code for a VIP
// @route   POST /api/vip/:id/generate-referral
// @access  Private (Admin)
export const generateVIPReferralCode = async (req, res) => {
  try {
    const { id } = req.params;
    
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (user.vipStatus === 'none') {
      return res.status(400).json({
        success: false,
        message: 'User is not a VIP',
      });
    }

    // Generate unique referral code
    let referralCode;
    let isUnique = false;
    while (!isUnique) {
      referralCode = generateReferralCode();
      const existing = await User.findOne({ referralCode });
      if (!existing) isUnique = true;
    }

    user.referralCode = referralCode;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Referral code generated successfully',
      data: { referralCode },
    });
  } catch (error) {
    console.error('Generate Referral Code Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate referral code',
    });
  }
};

// @desc    Get referrals under a VIP
// @route   GET /api/vip/:id/referrals
// @access  Private (Admin/VIP Owner)
export const getVIPReferrals = async (req, res) => {
  try {
    const { id } = req.params;
    
    const referrals = await User.find({ referredBy: id })
      .select('-password')
      .sort({ createdAt: -1 });

    const vipCount = referrals.filter(r => r.vipStatus === 'vip').length;
    const vvipCount = referrals.filter(r => r.vipStatus === 'vvip').length;

    res.status(200).json({
      success: true,
      data: {
        referrals,
        stats: {
          total: referrals.length,
          vipCount,
          vvipCount,
        },
      },
    });
  } catch (error) {
    console.error('Get VIP Referrals Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch referrals',
    });
  }
};

// @desc    Get VIP/VVIP profile stats for logged-in user
// @route   GET /api/vip/profile
// @access  Private
export const getVIPProfile = async (req, res) => {
  try {
    const userId = req.user._id;
    
    const user = await User.findById(userId)
      .select('-password')
      .populate('referredBy', 'name phoneNumber');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Get referral stats
    const referrals = await User.find({ referredBy: userId }).select('-password');
    const vipCount = referrals.filter(r => r.vipStatus === 'vip').length;
    const vvipCount = referrals.filter(r => r.vipStatus === 'vvip').length;

    res.status(200).json({
      success: true,
      data: {
        user: user.toObject(),
        referralStats: {
          total: referrals.length,
          vipCount,
          vvipCount,
        },
        referrals,
      },
    });
  } catch (error) {
    console.error('Get VIP Profile Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
    });
  }
};

// @desc    Delete gallery item (admin)
// @route   DELETE /api/vip/gallery/:userId
// @access  Private (Admin)
export const deleteGalleryItem = async (req, res) => {
    try {
        const { userId } = req.params;
        const { imageUrl } = req.body;
        
        const user = await User.findById(userId);
        if (!user) {
             return res.status(404).json({ success: false, message: 'User not found' });
        }
        
        user.gallery = user.gallery.filter(url => url !== imageUrl);
        await user.save();
        
        res.status(200).json({ success: true, message: 'Image removed from gallery', gallery: user.gallery });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete image' });
    }
};

// @desc    Upload item to gallery (admin)
// @route   POST /api/vip/gallery/:userId
// @access  Private (Admin)
export const uploadGalleryItem = async (req, res) => {
    try {
        const { userId } = req.params;
        
        if (!req.file) {
             return res.status(400).json({ success: false, message: 'No image uploaded' });
        }
        
        const user = await User.findById(userId);
        if(!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        // Upload to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, 'retailchampions/gallery');
        
        user.gallery.push(result.secure_url);
        await user.save();
        
        res.status(200).json({ success: true, message: 'Image uploaded', gallery: user.gallery, url: result.secure_url });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Upload failed' });
    }
};

// @desc    Validate referral code and get referrer info
// @route   GET /api/vip/validate-referral/:code
// @access  Public
export const validateReferralCode = async (req, res) => {
  try {
    const { code } = req.params;
    
    const referrer = await User.findOne({ referralCode: code })
      .select('name vipStatus');

    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code',
      });
    }

    res.status(200).json({
      success: true,
      data: {
        referrerName: referrer.name,
        referrerStatus: referrer.vipStatus,
      },
    });
  } catch (error) {
    console.error('Validate Referral Code Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to validate referral code',
    });
  }
};

// @desc    Register with referral code (update existing user registration)
// @route   POST /api/vip/register-with-referral
// @access  Public
export const registerWithReferral = async (req, res) => {
  try {
    const { referralCode, userId } = req.body;
    
    if (!referralCode || !userId) {
      return res.status(400).json({
        success: false,
        message: 'Referral code and user ID are required',
      });
    }

    // Find the referrer
    const referrer = await User.findOne({ referralCode });
    if (!referrer) {
      return res.status(404).json({
        success: false,
        message: 'Invalid referral code',
      });
    }

    // Find the user being registered
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    // Check if user is registering for VIP package
    const pkg = await Package.findOne({ amount: user.package });
    if (!pkg || !pkg.isVip) {
      return res.status(400).json({
        success: false,
        message: 'Referral codes can only be used with VIP packages',
      });
    }

    // Link user to referrer
    user.referredBy = referrer._id;
    user.vipStatus = 'vip';
    await user.save();

    // Check if referrer should be promoted to VVIP
    await checkAndPromoteToVVIP(referrer._id);

    res.status(200).json({
      success: true,
      message: 'Successfully registered with referral',
      data: { referrerName: referrer.name },
    });
  } catch (error) {
    console.error('Register with Referral Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to register with referral',
    });
  }
};

// @desc    Update VIP profile (KYC)
// @route   PUT /api/vip/profile
// @access  Private
export const updateVIPProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const { name, phoneNumber, aadhaarNumber, panNumber, bankName, bankAccountNumber, ifscCode } = req.body;
        
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        
        // Update fields if provided
        if (name) user.name = name;
        if (phoneNumber) user.phoneNumber = phoneNumber;
        
        // KYC Fields - Allow explict empty string to clear? Or just if provided?
        // User asked to "add and edit". 
        if (aadhaarNumber !== undefined) user.aadhaarNumber = aadhaarNumber;
        if (panNumber !== undefined) user.panNumber = panNumber;
        if (bankName !== undefined) user.bankName = bankName;
        if (bankAccountNumber !== undefined) user.bankAccountNumber = bankAccountNumber;
        if (ifscCode !== undefined) user.ifscCode = ifscCode;
        
        await user.save();
        
        res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully', 
            data: user 
        });
    } catch (error) {
        console.error('Update Profile Error:', error);
        res.status(500).json({ success: false, message: 'Failed to update profile. ' + error.message });
    }
};

// Helper function to be used by user registration
export const processVIPRegistration = async (userId, packageAmount, referralCode = null) => {
  try {
    const user = await User.findById(userId);
    if (!user) return;

    // Check if package is VIP
    const pkg = await Package.findOne({ amount: packageAmount });
    if (!pkg || !pkg.isVip) return;

    // Mark user as VIP
    user.vipStatus = 'vip';

    // If referral code provided, link to referrer
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        user.referredBy = referrer._id;
        await user.save();
        
        // Check if referrer should be promoted
        await checkAndPromoteToVVIP(referrer._id);
        return;
      }
    }

    // If no referral code provided, default to admin
    if (!referralCode) {
      const admin = await User.findOne({ role: 'admin' });
      if (admin) {
        user.referredBy = admin._id;
      }
    }

    // Generate referral code for the new VIP if not already present
    if (!user.referralCode) {
      let newReferralCode;
      let isUnique = false;
      while (!isUnique) {
        newReferralCode = generateReferralCode();
        const existing = await User.findOne({ referralCode: newReferralCode });
        if (!existing) isUnique = true;
      }
      user.referralCode = newReferralCode;
    }

    await user.save();
  } catch (error) {
    console.error('Process VIP Registration Error:', error);
  }
};

// @desc    Verify VIP coupon code
// @route   POST /api/vip/verify-coupon
// @access  Public
export const verifyCoupon = async (req, res) => {
  try {
    const { couponCode } = req.body;

    if (!couponCode) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code is required',
      });
    }

    const user = await User.findOne({ 
      couponCode: couponCode.toUpperCase(),
      vipStatus: { $in: ['vip', 'vvip'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code or not a VIP member',
      });
    }

    // Check if password is still default
    const needsPassword = await user.comparePassword('Retail@123');

    res.status(200).json({
      success: true,
      userId: user._id,
      needsPassword,
      message: needsPassword ? 'Please set your password' : 'Enter your password',
    });
  } catch (error) {
    console.error('Verify Coupon Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify coupon',
    });
  }
};

// @desc    Set VIP password
// @route   POST /api/vip/set-password
// @access  Public (with userId)
export const setVIPPassword = async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({
        success: false,
        message: 'User ID and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters',
      });
    }

    const user = await User.findById(userId);
    if (!user || !['vip', 'vvip'].includes(user.vipStatus)) {
      return res.status(404).json({
        success: false,
        message: 'VIP user not found',
      });
    }

    user.password = password;
    await user.save();

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role, vipStatus: user.vipStatus },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Password set successfully',
      token,
      user: {
        _id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        couponCode: user.couponCode,
        vipStatus: user.vipStatus,
      },
    });
  } catch (error) {
    console.error('Set VIP Password Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set password',
    });
  }
};

// @desc    Login VIP user
// @route   POST /api/vip/login
// @access  Public
export const loginVIP = async (req, res) => {
  try {
    const { couponCode, password } = req.body;

    if (!couponCode || !password) {
      return res.status(400).json({
        success: false,
        message: 'Coupon code and password are required',
      });
    }

    const user = await User.findOne({ 
      couponCode: couponCode.toUpperCase(),
      vipStatus: { $in: ['vip', 'vvip'] }
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Invalid coupon code or not a VIP member',
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid password',
      });
    }

    // Generate token
    const token = jwt.sign(
      { id: user._id, role: user.role, vipStatus: user.vipStatus },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        _id: user._id,
        name: user.name,
        phoneNumber: user.phoneNumber,
        couponCode: user.couponCode,
        vipStatus: user.vipStatus,
        referralCode: user.referralCode,
        package: user.package,
      },
    });
  } catch (error) {
    console.error('VIP Login Error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

// @desc    Delete single VIP by ID
// @route   DELETE /api/vip/:id
// @access  Private (Admin)
export const deleteVIP = async (req, res) => {
    try {
        const vip = await User.findById(req.params.id);
        if (!vip) {
            return res.status(404).json({ success: false, message: 'VIP not found' });
        }
        
        if(vip.role === 'admin') {
             return res.status(400).json({ success: false, message: 'Cannot delete admin user via this route' });
        }

        await User.findByIdAndDelete(req.params.id);
        res.status(200).json({ success: true, message: 'VIP user deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete VIP' });
    }
};

// @desc    Delete all VIPs and VVIPs
// @route   DELETE /api/vip/delete-all
// @access  Private (Admin)
export const deleteAllVIPs = async (req, res) => {
    try {
        await User.deleteMany({ vipStatus: { $in: ['vip', 'vvip'] } });
        res.status(200).json({ success: true, message: 'All VIPs and VVIPs deleted successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete all VIPs' });
    }
};

// @desc    Recharge VIP account with referral forms
// @route   POST /api/vip/recharge
// @access  Private (Admin)
export const rechargeVIP = async (req, res) => {
  try {
    const { couponCode, referralForms, expiryDate, type } = req.body; // type: 'vip' or 'retail'

    const user = await User.findOne({ couponCode });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (type === 'vip') {
        user.vipReferralFormsLeft = (user.vipReferralFormsLeft || 0) + parseInt(referralForms);
    } else {
        // Default to retail if type is not specified or retail
        user.retailReferralFormsLeft = (user.retailReferralFormsLeft || 0) + parseInt(referralForms);
    }
    
    // Maintain backward compatibility for now if needed, or just rely on these new fields.
    // Let's also update the total valid forms for simple display if needed, but UI should split.
    user.referralFormsLeft = (user.vipReferralFormsLeft || 0) + (user.retailReferralFormsLeft || 0);

    if (expiryDate) {
      user.referralExpiryDate = new Date(expiryDate);
    }
    
    await user.save();

    res.status(200).json({
      success: true,
      message: `${type === 'vip' ? 'VIP' : 'Retail'} referral forms recharged successfully`,
      data: {
        vipReferralFormsLeft: user.vipReferralFormsLeft,
        retailReferralFormsLeft: user.retailReferralFormsLeft,
        referralExpiryDate: user.referralExpiryDate
      }
    });
  } catch (error) {
    console.error('Recharge Error:', error);
    res.status(500).json({ success: false, message: 'Recharge failed' });
  }
};

// @desc    Register a new user via VIP referral
// @route   POST /api/vip/register-referral
// @access  Private (VIP)
export const registerReferredUser = async (req, res) => {
    try {
        const { name, formType } = req.body;
        const phoneNumber = req.body.phoneNumber ? req.body.phoneNumber.trim() : '';
        // Parse packageAmount as it comes as string in FormData
        const parsedPackageAmount = req.body.packageAmount ? parseInt(req.body.packageAmount) : null;
        
        const referrerId = req.user._id;

        const referrer = await User.findById(referrerId);
        if(!referrer) return res.status(404).json({ success: false, message: 'Referrer not found' });

        if (referrer.referralExpiryDate && new Date() > new Date(referrer.referralExpiryDate)) {
             return res.status(400).json({ success: false, message: 'Referral capability expired.' });
        }

        // Check availability
        if (formType === 'vip') {
            if ((referrer.vipReferralFormsLeft || 0) <= 0) {
                return res.status(400).json({ success: false, message: 'No VIP referral forms left. Please recharge.' });
            }
        } else {
            // retail
             if ((referrer.retailReferralFormsLeft || 0) <= 0) {
                return res.status(400).json({ success: false, message: 'No Retail referral forms left. Please recharge.' });
            }
        }
        
        // Handle Image Upload
        let selfieUrl = '';
        if (req.file) {
            try {
                // Determine folder based on formType or user role
                const folder = formType === 'vip' ? 'vip-profiles' : 'user-profiles';
                const uploadResult = await uploadToCloudinary(req.file.buffer, folder);
                selfieUrl = uploadResult.secure_url;
            } catch (uploadError) {
                console.error('Image upload failed:', uploadError);
            }
        }



        // Generate Login Code (Coupon Code) if needed for VIP login
        let couponCode;
        let isUniqueCoupon = false;
        while (!isUniqueCoupon) {
            couponCode = 'VIP' + Math.floor(100000 + Math.random() * 900000); // Simple 6 digit
            const existing = await User.findOne({ couponCode });
            if (!existing) isUniqueCoupon = true;
        }

        // Generate Referral Code if VIP
        let referralCode; // undefined by default
        if(formType === 'vip') {
            let isUniqueRef = false;
            while (!isUniqueRef) {
                // Simple referral code generation
                referralCode = 'REF' + Math.floor(10000 + Math.random() * 90000); 
                // Or use existing helper if exported? Assuming locally defined here for simplicity or import
                // Using simplified logic here as helper might not be exported
                const existing = await User.findOne({ referralCode });
                if (!existing) isUniqueRef = true;
            }
        }

        // Create user
        const newUser = new User({
            name,
            phoneNumber,
            package: parsedPackageAmount || (formType === 'vip' ? 5000 : 100),
            vipStatus: formType === 'vip' ? 'vip' : 'none',
            referredBy: referrerId,
            password: 'Retail@123', // Default password
            couponCode: couponCode,
            referralCode: referralCode,
            selfieUrl: selfieUrl,
            role: 'user'
        });

        // Generate Registration ID (Retail Champion)
        const registrationId = Math.floor(1000000000 + Math.random() * 9000000000).toString();
        newUser.registrationId = registrationId;

        await newUser.save();

        // Decrement forms count on referrer
        if (formType === 'vip') {
             referrer.vipReferralFormsLeft = (referrer.vipReferralFormsLeft || 0) - 1;
        } else {
             referrer.retailReferralFormsLeft = (referrer.retailReferralFormsLeft || 0) - 1;
        }
        
        // Update aggregated total
        referrer.referralFormsLeft = (referrer.vipReferralFormsLeft || 0) + (referrer.retailReferralFormsLeft || 0);
        
        // Update referral counts
        const referralCount = await User.countDocuments({ referredBy: referrerId });
        referrer.referralCount = referralCount;
        
        await referrer.save();

        // Check for VVIP promotion
        // checkAndPromoteToVVIP is defined in this file.
        // Assuming it's available in scope
        try {
            await checkAndPromoteToVVIP(referrerId);
        } catch (e) {
            console.error("VVIP Promotion Error", e);
        }
        
        res.status(200).json({ 
            success: true, 
            message: 'User registered successfully',
            data: {
                user: newUser,
                formsLeft: referrer.referralFormsLeft,
                couponCode: newUser.couponCode,
                referralCode: newUser.referralCode
            }
        });

    } catch (error) {
        console.error('Referral Registration Error:', error);
        if (error.code === 11000) {
             return res.status(400).json({
                 success: false,
                 message: `Registration failed: Duplicate key error. ${error.message}`
             });
        }
        res.status(500).json({ success: false, message: 'Registration failed: ' + error.message });
    }
};
