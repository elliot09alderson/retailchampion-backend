import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    selectedSize: {
      type: String,
      required: true,
    },
    selectedColor: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    productTitle: {
      type: String,
      required: true,
    },
    productPrice: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'delivered'],
      default: 'pending',
    },
    // Which admin's product was ordered (for tenant isolation)
    productAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    productAdminRole: {
      type: String,
      enum: ['admin', 'superadmin'],
    },
  },
  { timestamps: true }
);

orderSchema.index({ productAdminId: 1, createdAt: -1 });
orderSchema.index({ user: 1, createdAt: -1 });
orderSchema.index({ status: 1 });

const Order = mongoose.model('Order', orderSchema);
export default Order;
