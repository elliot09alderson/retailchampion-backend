import express from 'express';
import { protect, isAdmin } from '../middleware/auth.js';
import { createOrder, getOrders, updateOrderStatus } from '../controllers/orderController.js';

const router = express.Router();

// VIP/VVIP: place an order
router.post('/', protect, createOrder);

// Admin/SuperAdmin: view and manage orders
router.get('/', protect, isAdmin, getOrders);
router.patch('/:id/status', protect, isAdmin, updateOrderStatus);

export default router;
