import mongoose from 'mongoose';

const CartProjectSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true },

    // Source project identifiers from client (IndexedDB project)
    projectId: { type: String, default: null },
    projectName: { type: String, required: true },

    // Price breakdown for the whole project
    price: { type: Number, default: 0 },
    discountPercent: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    totalPrice: { type: Number, default: 0 },

    // Same structure as client-side project storage
    project: { type: mongoose.Schema.Types.Mixed, required: true },

    // Accessories snapshot from UI
    accessories: { type: mongoose.Schema.Types.Mixed, default: [] },

    status: {
      type: String,
      enum: ['pending', 'submitted', 'paid', 'cancelled'],
      default: 'pending',
    },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

export default mongoose.models.CartProject || mongoose.model('CartProject', CartProjectSchema);
