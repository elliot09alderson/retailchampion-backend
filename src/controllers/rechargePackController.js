import RechargePack from '../models/RechargePack.js';

// @desc    Get all active recharge packs
// @route   GET /api/recharge-packs
// @access  Private (Admin/VIP)
export const getAllRechargePacks = async (req, res) => {
  try {
    const packs = await RechargePack.find({ isActive: true });
    res.json({ success: true, data: packs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// @desc    Create a new recharge pack
// @route   POST /api/recharge-packs
// @access  Private (Admin)
export const createRechargePack = async (req, res) => {
  try {
    const { name, count, price, type, referralTarget } = req.body;
    const newPack = new RechargePack({ name, count, price, type, referralTarget });
    await newPack.save();
    res.status(201).json({ success: true, data: newPack });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update a recharge pack
// @route   PUT /api/recharge-packs/:id
// @access  Private (Admin)
export const updateRechargePack = async (req, res) => {
  try {
    const { name, count, price, type, isActive } = req.body;
    const pack = await RechargePack.findById(req.params.id);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Pack not found' });
    }

    if (name) pack.name = name;
    if (count) pack.count = count;
    if (price) pack.price = price;
    if (type) pack.type = type;
    if (referralTarget) pack.referralTarget = referralTarget;
    if (isActive !== undefined) pack.isActive = isActive;

    await pack.save();
    res.json({ success: true, data: pack });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a recharge pack
// @route   DELETE /api/recharge-packs/:id
// @access  Private (Admin)
export const deleteRechargePack = async (req, res) => {
  try {
    const pack = await RechargePack.findById(req.params.id);
    if (!pack) {
      return res.status(404).json({ success: false, message: 'Pack not found' });
    }
    await pack.deleteOne();
    res.json({ success: true, message: 'Pack removed' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
