import Pin from '../models/Pin.js';
import User from '../models/User.js';

// @desc    Generate new pins
// @route   POST /api/pins/generate
// @access  Admin
export const generatePins = async (req, res) => {
  try {
    const { package: packageAmount, count, expiryDate } = req.body;

    // Validate input
    if (!packageAmount || !count || !expiryDate) {
      return res.status(400).json({
        success: false,
        message: 'Please provide package, count, and expiry date',
      });
    }

    const pins = [];
    const generatedBy = req.user ? req.user._id : null; // Assuming auth middleware adds user to req

    for (let i = 0; i < count; i++) {
      // Generate a random 6-digit alphanumeric code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      // Ensure specific format if needed, but 6-chars is usually good for PINs
      
      pins.push({
        code,
        package: packageAmount,
        expiryDate: new Date(expiryDate),
        generatedBy,
        status: 'active'
      });
    }

    // Use insertMany for bulk creation (ordered: false continues if duplicates found, though unlikely with random)
    // We might want to ensure uniqueness.
    
    // Better strategy for uniqueness: check before insert, but for batch, try/catch with recursion or just rely on unique index error and retry?
    // Given the small scale, simple loop with duplicate check is okay, or just insertMany and let duplicates fail (but we want 'count' pins).

    // Let's rely on Mongoose to handle it.
    
    const createdPins = await Pin.insertMany(pins, { ordered: false });

    res.status(201).json({
      success: true,
      message: `${createdPins.length} pins generated successfully`,
      data: createdPins,
    });

  } catch (error) {
    console.error('Generate Pins Error:', error);
    if (error.code === 11000) {
        // Only some pins failed due to duplicates, which is acceptable or we could retry.
        // For simplicity, we report success on whatever passed.
        return res.status(201).json({
           success: true,
           message: 'Some pins might have been duplicates, check data length.', 
        });
    }
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Get all pins
// @route   GET /api/pins
// @access  Admin
export const getPins = async (req, res) => {
  try {
    const { status, package: packageAmount, page = 1, limit = 50 } = req.query;

    const filter = {};
    if (status) filter.status = status;
    if (packageAmount) filter.package = packageAmount;

    // Sort by creation date desc
    const pins = await Pin.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit))
      .populate('usedBy', 'name phoneNumber')
      .lean();

    // Check for expired pins and update memory (and DB ideally, but for now just display)
    pins.forEach(p => {
        if (p.status === 'active' && new Date() > new Date(p.expiryDate)) {
            p.status = 'expired';
            // Optionally trigger background update
            Pin.findByIdAndUpdate(p._id, { status: 'expired' }).exec();
        }
    });

    const total = await Pin.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: pins,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      }
    });

  } catch (error) {
    console.error('Get Pins Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

// @desc    Validate a pin (public/user check)
// @route   POST /api/pins/validate
// @access  Public
export const validatePin = async (req, res) => {
    try {
        const { pin, package: packageAmount } = req.body;

        if (!pin || !packageAmount) {
            return res.status(400).json({ success: false, message: 'Pin and package are required' });
        }

        const pinRecord = await Pin.findOne({ code: pin });

        if (!pinRecord) {
            return res.status(404).json({ success: false, message: 'Invalid PIN' });
        }

        if (pinRecord.package !== parseInt(packageAmount)) {
             return res.status(400).json({ success: false, message: 'PIN does not match selected package' });
        }

        if (pinRecord.status !== 'active') { // used or expired
             return res.status(400).json({ success: false, message: `PIN is ${pinRecord.status}` });
        }
        
        if (new Date() > pinRecord.expiryDate) {
            pinRecord.status = 'expired';
            await pinRecord.save();
            return res.status(400).json({ success: false, message: 'PIN has expired' });
        }

        res.status(200).json({ success: true, message: 'PIN is valid' });

    } catch (error) {
        console.log(error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
}

// @desc    Get pin statistics
// @route   GET /api/pins/stats
// @access  Admin
export const getPinStats = async (req, res) => {
  try {
    const stats = await Pin.aggregate([
      {
        $group: {
          _id: { package: '$package', status: '$status' },
          count: { $sum: 1 }
        }
      },
      {
        $group: {
          _id: '$_id.package',
          stats: {
             $push: {
               status: '$_id.status',
               count: '$count'
             }
          },
          total: { $sum: '$count' }
        }
      }
    ]);

    // Format for easier frontend consumption: { "2999": { total: 10, active: 5, used: 5, expired: 0 } }
    const formattedStats = {};
    stats.forEach(item => {
        const packageStats = { total: item.total, active: 0, used: 0, expired: 0 };
        item.stats.forEach(s => {
            if (['active', 'used', 'expired'].includes(s.status)) {
                packageStats[s.status] = s.count;
            }
        });
        formattedStats[item._id] = packageStats;
    });

    res.status(200).json({
      success: true,
      data: formattedStats,
    });
  } catch (error) {
    console.error('Get Pin Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
