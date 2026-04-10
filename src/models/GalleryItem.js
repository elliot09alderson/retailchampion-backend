import mongoose from 'mongoose';

const galleryItemSchema = new mongoose.Schema(
  {
    imageUrl: {
      type: String,
      required: true,
    },
    publicId: {
      type: String, // For Cloudinary
    },
    heading: {
      type: String,
      trim: true,
    },
    subheading: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    createdByAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const GalleryItem = mongoose.model('GalleryItem', galleryItemSchema);

export default GalleryItem;
