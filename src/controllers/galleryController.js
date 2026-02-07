import GalleryItem from '../models/GalleryItem.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';

// @desc    Get all gallery items
// @route   GET /api/gallery
// @access  Public
export const getGalleryItems = async (req, res) => {
  try {
    const items = await GalleryItem.find().sort({ createdAt: -1 });
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
    const { description } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image uploaded' });
    }

    const result = await uploadToCloudinary(req.file.buffer, 'retailchampions/winners');

    const item = await GalleryItem.create({
      imageUrl: result.secure_url,
      publicId: result.public_id,
      description
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
    const item = await GalleryItem.findById(req.params.id);
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
