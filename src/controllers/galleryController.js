import GalleryItem from '../models/GalleryItem.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { getTenantFilter, getAdminId } from '../middleware/auth.js';

// @desc    Get all gallery items
// @route   GET /api/gallery
// @access  Public
export const getGalleryItems = async (req, res) => {
  try {
    let filter = {};
    if (req.user) {
      if (req.user.role === 'admin') {
        filter = { createdByAdmin: req.user._id };
      } else if (req.user.role === 'user' && req.user.createdByAdmin) {
        filter = { createdByAdmin: req.user.createdByAdmin };
      }
      // superadmin sees all
    } else if (req.query.adminId) {
      filter = { createdByAdmin: req.query.adminId };
    }
    const items = await GalleryItem.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch gallery' });
  }
};

// @desc    Upload item
// @route   POST /api/gallery
// @access  Private (Admin)
export const uploadGalleryItem = async (req, res) => {
  try {
    const { description, heading, subheading } = req.body;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'retailchampions/winners');

    const item = await GalleryItem.create({
      imageUrl: result.secure_url,
      publicId: result.public_id,
      heading,
      subheading,
      description,
      createdByAdmin: getAdminId(req),
    });

    res.status(201).json({ success: true, data: item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Failed to upload item' });
  }
};

// @desc    Delete item
// @route   DELETE /api/gallery/:id
// @access  Private (Admin)
export const deleteGalleryItem = async (req, res) => {
  try {
    const tenantFilter = getTenantFilter(req);
    const item = await GalleryItem.findOne({ _id: req.params.id, ...tenantFilter });
    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    if (item.publicId) {
      await deleteFromCloudinary(item.publicId);
    }

    await item.deleteOne();
    res.status(200).json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// @desc    Update item
// @route   PUT /api/gallery/:id
// @access  Private (Admin)
export const updateGalleryItem = async (req, res) => {
  try {
    const { description, heading, subheading } = req.body;
    const tenantFilter = getTenantFilter(req);
    const item = await GalleryItem.findOne({ _id: req.params.id, ...tenantFilter });

    if (!item) {
      return res.status(404).json({ success: false, message: 'Item not found' });
    }

    item.heading = heading;
    item.subheading = subheading;
    item.description = description;
    await item.save();

    res.status(200).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update item' });
  }
};
