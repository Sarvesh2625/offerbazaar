import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor ID is required'],
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Customer ID is required'],
    },
    stars: {
      type: Number,
      required: [true, 'Stars rating is required'],
      min: [1, 'Stars must be at least 1'],
      max: [5, 'Stars cannot exceed 5'],
      validate: {
        validator: Number.isInteger,
        message: 'Stars must be an integer between 1 and 5',
      },
    },
    comment: {
      type: String,
      trim: true,
      maxlength: [300, 'Comment cannot exceed 300 characters'],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

// Compound unique index on (vendorId, customerId)
// Ensures a customer can only have one rating per vendor
ratingSchema.index({ vendorId: 1, customerId: 1 }, { unique: true });

const Rating = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);

export default Rating;
