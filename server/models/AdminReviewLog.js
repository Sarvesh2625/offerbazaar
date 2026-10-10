import mongoose from 'mongoose';

const checksPerformedSchema = new mongoose.Schema(
  {
    locationValid: {
      type: Boolean,
      default: false,
    },
    dateValid: {
      type: Boolean,
      default: false,
    },
    textValid: {
      type: Boolean,
      default: false,
    },
    imageValid: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const adminReviewLogSchema = new mongoose.Schema(
  {
    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Offer',
      required: [true, 'Offer ID reference is required'],
    },
    checkedBy: {
      type: String,
      required: [true, 'checkedBy is required'],
      trim: true,
    },
    checksPerformed: {
      type: checksPerformedSchema,
      default: () => ({}),
    },
    decision: {
      type: String,
      enum: {
        values: [
          'approved',
          'rejected',
          'flagged_for_review',
          'manual_takedown_post_approval',
        ],
        message: '{VALUE} is not a valid review decision',
      },
      required: [true, 'Decision is required'],
      trim: true,
    },
    reason: {
      type: String,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: false,
  }
);

const AdminReviewLog =
  mongoose.models.AdminReviewLog ||
  mongoose.model('AdminReviewLog', adminReviewLogSchema);

export default AdminReviewLog;
