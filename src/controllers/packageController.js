import Package from '../models/Package.js';
import User from '../models/User.js';

// @desc    Get all active packages
// @route   GET /api/packages
// @access  Public
export const getPackages = async (req, res) => {
  try {
    const packages = await Package.find({ isActive: true }).sort({ amount: 1 });
    
    // Enrich with user counts
    const enrichedPackages = await Promise.all(
      packages.map(async (pkg) => {
        const userCount = await User.countDocuments({ role: 'user', package: pkg.amount });
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
    const { name, amount, description, isVip, whatsappGroupLink } = req.body;

    if (!name || !amount) {
      return res.status(400).json({
        success: false,
        message: 'Name and amount are required',
      });
    }

    const existingPackage = await Package.findOne({ amount });
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
    const { name, amount, description, isActive, isVip, whatsappGroupLink } = req.body;

    const updatedPackage = await Package.findByIdAndUpdate(
      id,
      { name, amount, description, isActive, isVip, whatsappGroupLink },
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
    const deletedPackage = await Package.findByIdAndDelete(id);

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
