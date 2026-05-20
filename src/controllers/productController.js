import Product from '../models/Product.js';
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js';
import { getTenantFilter } from '../middleware/auth.js';

// Admin/SuperAdmin: create a product
export const createProduct = async (req, res) => {
  try {
    const { title, description, sizes, colors, price } = req.body;

    if (!title || !description || !price) {
      return res.status(400).json({ success: false, message: 'Title, description, and price are required' });
    }

    let imageUrl = '';
    let imagePublicId = '';

    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, 'products');
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    const sizesArray = typeof sizes === 'string' ? JSON.parse(sizes) : sizes || [];
    const colorsArray = typeof colors === 'string' ? JSON.parse(colors) : colors || [];

    const product = await Product.create({
      title,
      description,
      imageUrl,
      imagePublicId,
      sizes: sizesArray,
      colors: colorsArray,
      price: Number(price),
      createdByAdmin: req.user.role === 'admin' ? req.user._id : null,
      createdByRole: req.user.role,
    });

    res.status(201).json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: list products
// - SuperAdmin sees all products
// - Admin sees their own products + all superadmin products
export const getAdminProducts = async (req, res) => {
  try {
    let filter = {};
    if (req.user.role === 'admin') {
      filter = {
        $or: [
          { createdByAdmin: req.user._id },
          { createdByRole: 'superadmin' },
        ],
      };
    }
    const products = await Product.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: update a product
export const updateProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    // Admin can only update their own products
    if (req.user.role === 'admin' && String(product.createdByAdmin) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this product' });
    }

    const { title, description, sizes, colors, price, isActive } = req.body;

    if (title) product.title = title;
    if (description) product.description = description;
    if (price !== undefined) product.price = Number(price);
    if (isActive !== undefined) product.isActive = isActive === 'true' || isActive === true;
    if (sizes) product.sizes = typeof sizes === 'string' ? JSON.parse(sizes) : sizes;
    if (colors) product.colors = typeof colors === 'string' ? JSON.parse(colors) : colors;

    if (req.file) {
      if (product.imagePublicId) {
        await deleteFromCloudinary(product.imagePublicId).catch(() => {});
      }
      const result = await uploadToCloudinary(req.file.buffer, 'products');
      product.imageUrl = result.secure_url;
      product.imagePublicId = result.public_id;
    }

    await product.save();
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Admin/SuperAdmin: delete a product
export const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ success: false, message: 'Product not found' });

    if (req.user.role === 'admin' && String(product.createdByAdmin) !== String(req.user._id)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this product' });
    }

    if (product.imagePublicId) {
      await deleteFromCloudinary(product.imagePublicId).catch(() => {});
    }

    await product.deleteOne();
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// VIP/VVIP: get active products scoped to the VIP's admin + all superadmin products
export const getVIPProducts = async (req, res) => {
  try {
    // Superadmin products are visible to all VIPs
    const superAdminProducts = await Product.find({ isActive: true, createdByRole: 'superadmin' })
      .sort({ createdAt: -1 })
      .lean();

    // Admin products are only visible to VIPs belonging to that specific admin
    const vipAdminId = req.user.createdByAdmin;
    let adminProducts = [];
    if (vipAdminId) {
      adminProducts = await Product.find({
        isActive: true,
        createdByRole: 'admin',
        createdByAdmin: vipAdminId,
      })
        .sort({ createdAt: -1 })
        .lean();
    }

    res.json({
      success: true,
      data: {
        superAdminProducts,
        adminProducts,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// VIP/VVIP: get single product by ID (respects admin isolation)
export const getProductById = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product || !product.isActive) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    // Superadmin products are accessible to all VIPs
    if (product.createdByRole === 'superadmin') {
      return res.json({ success: true, data: product });
    }

    // Admin products: VIP must belong to the same admin
    const vipAdminId = req.user.createdByAdmin;
    if (!vipAdminId || String(product.createdByAdmin) !== String(vipAdminId)) {
      return res.status(403).json({ success: false, message: 'Product not available' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
