import Order from '../models/Order.js';
import Product from '../models/Product.js';

// VIP/VVIP: place an order
export const createOrder = async (req, res) => {
  try {
    const { productId, selectedSize, selectedColor, quantity } = req.body;

    if (!productId || !selectedSize || !selectedColor || !quantity) {
      return res.status(400).json({ success: false, message: 'All fields are required' });
    }

    const product = await Product.findById(productId);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Enforce admin isolation: VIP can only order from their admin's products or superadmin products
    if (product.createdByRole === 'admin') {
      const vipAdminId = req.user.createdByAdmin;
      if (!vipAdminId || String(product.createdByAdmin) !== String(vipAdminId)) {
        return res.status(403).json({ success: false, message: 'Product not available' });
      }
    }

    const order = await Order.create({
      product: productId,
      user: req.user._id,
      customerName: req.user.name,
      customerPhone: req.user.phoneNumber,
      selectedSize,
      selectedColor,
      quantity: Number(quantity),
      productTitle: product.title,
      productPrice: product.price,
      productAdminId: product.createdByAdmin,
      productAdminRole: product.createdByRole,
    });

    res.status(201).json({ success: true, data: order, message: 'Order placed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: get all orders for their products
export const getOrders = async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === 'admin') {
      filter.productAdminId = req.user._id;
    }
    // superadmin sees all orders

    const orders = await Order.find(filter)
      .populate('product', 'title imageUrl price')
      .populate('user', 'name phoneNumber vipStatus')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: orders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: delete an order
export const deleteOrder = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Admin can only delete orders for their own products
    if (req.user.role === 'admin' && String(order.productAdminId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    await order.deleteOne();
    res.json({ success: true, message: 'Order deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: toggle order status (pending <-> delivered)
export const updateOrderStatus = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Admin can only update orders for their products
    if (req.user.role === 'admin' && String(order.productAdminId) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const { status } = req.body;
    if (!['pending', 'delivered'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status' });
    }

    order.status = status;
    await order.save();

    res.json({ success: true, data: order, message: `Order marked as ${status}` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
