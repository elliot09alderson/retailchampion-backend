import express from 'express';
import { getGalleryItems, uploadGalleryItem, deleteGalleryItem, updateGalleryItem } from '../controllers/galleryController.js';
import { protect, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';

const router = express.Router();

router.get('/', getGalleryItems);
router.post('/', protect, isAdmin, upload.single('image'), uploadGalleryItem);
router.put('/:id', protect, isAdmin, updateGalleryItem);
router.delete('/:id', protect, isAdmin, deleteGalleryItem);

export default router;
