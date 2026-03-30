import mongoose from 'mongoose';

const UserProjectSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    clientProjectId: { type: String, default: null },
    name: { type: String, required: true },
    normalizedName: { type: String, default: '' },

    // Full project snapshot from the editor (canvases, metadata, etc.)
    project: { type: mongoose.Schema.Types.Mixed, required: true },

    accessories: { type: mongoose.Schema.Types.Mixed, default: [] },
    lastOrderedAt: { type: Number, default: null },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

UserProjectSchema.index(
  { userId: 1, clientProjectId: 1 },
  { unique: true, partialFilterExpression: { clientProjectId: { $type: 'string' } } }
);
UserProjectSchema.index({ userId: 1, normalizedName: 1 });

export default mongoose.models.UserProject || mongoose.model('UserProject', UserProjectSchema);