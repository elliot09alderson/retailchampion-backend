import express from 'express';
import { getGalleryItems, uploadGalleryItem, deleteGalleryItem, updateGalleryItem } from '../controllers/galleryController.js';
import { protect, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

// Optional auth: attaches req.user if token present
const optionalAuth = async (req, res, next) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try { await protect(req, res, () => {}); } catch { /* ignore */ }
  }
  next();
};

const router = express.Router();

router.get('/', optionalAuth, getGalleryItems);
router.post('/', protect, isAdmin, upload.single('image'), uploadGalleryItem);
router.put('/:id', protect, isAdmin, updateGalleryItem);
router.delete('/:id', protect, isAdmin, deleteGalleryItem);

export default router;
