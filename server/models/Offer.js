import mongoose from 'mongoose';

const pointSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: {
        values: ['Point'],
        message: '{VALUE} is not a valid GeoJSON type',
      },
      default: 'Point',
      required: [true, 'Location type is required'],
    },
    coordinates: {
      type: [Number],
      required: [true, 'Location coordinates are required'],
      validate: {
        validator: function (coords) {
          if (!Array.isArray(coords) || coords.length !== 2) {
            return false;
          }
          const [lng, lat] = coords;
          if (
            typeof lng !== 'number' ||
            typeof lat !== 'number' ||
            Number.isNaN(lng) ||
            Number.isNaN(lat)
          ) {
            return false;
          }
          return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
        },
        message:
          'Location coordinates must be [longitude, latitude] where -180 <= lng <= 180 and -90 <= lat <= 90',
      },
    },
  },
  { _id: false }
);

const offerSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Vendor',
      required: [true, 'Vendor ID reference is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    discountText: {
      type: String,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category reference is required'],
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    validFrom: {
      type: Date,
      required: [true, 'Valid from date is required'],
    },
    validTill: {
      type: Date,
      required: [true, 'Valid till date is required'],
      validate: {
        validator: function (value) {
          if (!this.validFrom || !value) return true;
          return value >= this.validFrom;
        },
        message: 'Valid till date must be on or after valid from date',
      },
    },
    status: {
      type: String,
      enum: {
        values: [
          'pending_review',
          'approved',
          'rejected',
          'flagged_for_review',
        ],
        message: '{VALUE} is not a valid offer status',
      },
      default: 'pending_review',
      required: [true, 'Status is required'],
    },
    rejectionReason: [
      {
        type: String,
        trim: true,
      },
    ],
    location: {
      type: pointSchema,
      required: [true, 'Location is required'],
    },
  },
  {
    timestamps: true,
  }
);

// 1. 2dsphere geospatial index on Offer.location
offerSchema.index({ location: '2dsphere' });

// 2. Compound index on Offer.category + Offer.status (customer discovery feed index)
offerSchema.index({ category: 1, status: 1 });

// 3. Text index on Offer.title + Offer.description for free-text search
offerSchema.index({ title: 'text', description: 'text' });

const Offer = mongoose.models.Offer || mongoose.model('Offer', offerSchema);

export default Offer;
