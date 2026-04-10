import Package from '../models/Package.js';
import User from '../models/User.js';
import { getTenantFilter, getAdminId } from '../middleware/auth.js';

// @desc    Get all active packages
// @route   GET /api/packages
// @access  Public
export const getPackages = async (req, res) => {
  try {
    // If authenticated admin/superadmin, apply tenant filter; otherwise show all active
    let filter = { isActive: true };
    if (req.user && (req.user.role === 'admin' || req.user.role === 'superadmin')) {
      filter = { isActive: true, ...getTenantFilter(req) };
    }

    const packages = await Package.find(filter).sort({ amount: 1 });

    // Enrich with user counts (tenant-scoped)
    const userTenantFilter = req.user ? getTenantFilter(req) : {};
    const enrichedPackages = await Promise.all(
      packages.map(async (pkg) => {
        const userCount = await User.countDocuments({ role: 'user', package: pkg.amount, ...userTenantFilter });
        return {
          ...pkg.toObject(),
          userCount,
        };
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedPackages,
    });
  } catch (error) {
    console.error('Get Packages Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch packages',
    });
  }
};

// @desc    Create a new package
// @route   POST /api/packages
// @access  Private (Admin)
export const createPackage = async (req, res) => {
  try {
    const { name, amount, description, isVip, whatsappGroupLink, referralTarget } = req.body;

    if (!name || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Name and amount are required',
      });
    }

    const adminId = getAdminId(req);
    // Check uniqueness within this admin's packages
    const existingPackage = await Package.findOne({ amount, createdByAdmin: adminId });
    if (existingPackage) {
      return res.status(400).json({
        success: false,
        message: 'A package with this amount already exists',
      });
    }

    const newPackage = await Package.create({
      name,
      amount,
      description,
      isVip: isVip || false,
      whatsappGroupLink: whatsappGroupLink || '',
      referralTarget: referralTarget || 10,
      createdByAdmin: adminId,
    });

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: newPackage,
    });
  } catch (error) {
    console.error('Create Package Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create package',
    });
  }
};

// @desc    Update a package
// @route   PUT /api/packages/:id
// @access  Private (Admin)
export const updatePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, amount, description, isActive, isVip, whatsappGroupLink, referralTarget } = req.body;

    const tenantFilter = getTenantFilter(req);
    const updatedPackage = await Package.findOneAndUpdate(
      { _id: id, ...tenantFilter },
      { name, amount, description, isActive, isVip, whatsappGroupLink, referralTarget },
      { new: true, runValidators: true }
    );

    if (!updatedPackage) {
      return res.status(404).json({
        success: false,
        message: 'Package not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package updated successfully',
      data: updatedPackage,
    });
  } catch (error) {
    console.error('Update Package Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update package',
    });
  }
};

// @desc    Delete a package
// @route   DELETE /api/packages/:id
// @access  Private (Admin)
export const deletePackage = async (req, res) => {
  try {
    const { id } = req.params;
    const tenantFilter = getTenantFilter(req);
    const deletedPackage = await Package.findOneAndDelete({ _id: id, ...tenantFilter });

    if (!deletedPackage) {
      return res.status(404).json({
        success: false,
        message: 'Package not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Package deleted successfully',
    });
  } catch (error) {
    console.error('Delete Package Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete package',
    });
  }
};
