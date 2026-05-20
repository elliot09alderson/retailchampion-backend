import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    imageUrl: {
      type: String,
      required: false,
    },
    imagePublicId: {
      type: String,
      required: false,
    },
    sizes: {
      type: [String],
      default: [],
    },
    colors: {
      type: [String],
      default: [],
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'superadmin'],
      required: true,
    },
  },
  { timestamps: true }
);

productSchema.index({ createdByRole: 1, createdAt: -1 });
productSchema.index({ createdByAdmin: 1 });

const Product = mongoose.model('Product', productSchema);
export default Product;
