import express from 'express';
import { protect, isAdmin } from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import {
  createProduct,
  getAdminProducts,
  updateProduct,
  deleteProduct,
  getVIPProducts,
  getProductById,
} from '../controllers/productController.js';

const router = express.Router();

// VIP/VVIP routes (protected by JWT - vip login token)
router.get('/vip', protect, getVIPProducts);
router.get('/vip/:id', protect, getProductById);

// Admin/SuperAdmin routes
router.post('/', protect, isAdmin, upload.single('image'), createProduct);
router.get('/', protect, isAdmin, getAdminProducts);
router.put('/:id', protect, isAdmin, upload.single('image'), updateProduct);
router.delete('/:id', protect, isAdmin, deleteProduct);

export default router;
