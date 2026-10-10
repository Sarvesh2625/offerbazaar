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

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID reference is required'],
      unique: true,
    },
    shopName: {
      type: String,
      required: [
        function () {
          return this.status !== 'pending';
        },
        'Shop name is required',
      ],
      trim: true,
      default: '',
    },
    shopDescription: {
      type: String,
      trim: true,
      default: '',
    },
    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
      },
    ],
    shopImages: [
      {
        type: String,
        trim: true,
      },
    ],
    location: {
      type: pointSchema,
      required: [
        function () {
          return this.status !== 'pending';
        },
        'Location is required',
      ],
    },
    city: {
      type: String,
      required: [
        function () {
          return this.status !== 'pending';
        },
        'City is required',
      ],
      trim: true,
      default: '',
    },
    address: {
      type: String,
      trim: true,
      default: '',
    },
    avgRating: {
      type: Number,
      default: 0,
      min: [0, 'Average rating cannot be negative'],
      max: [5, 'Average rating cannot exceed 5'],
    },
    totalRatings: {
      type: Number,
      default: 0,
      min: [0, 'Total ratings cannot be negative'],
    },
    isVerifiedShop: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: {
        values: ['pending', 'active', 'suspended'],
        message: '{VALUE} is not a valid vendor status',
      },
      default: 'pending',
      required: [true, 'Status is required'],
    },
  },
  {
    timestamps: true,
  }
);

// 2dsphere geospatial index on location
vendorSchema.index({ location: '2dsphere' });

const Vendor = mongoose.models.Vendor || mongoose.model('Vendor', vendorSchema);

export default Vendor;
