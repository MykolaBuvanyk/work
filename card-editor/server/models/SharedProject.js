import mongoose from 'mongoose';

const SharedProjectSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    accessType: {
      type: String,
      enum: ['anyone_with_link'],
      default: 'anyone_with_link',
    },
    createdById: { type: String, default: null },

    sourceProjectId: { type: String, default: null },
    projectName: { type: String, required: true },

    project: { type: mongoose.Schema.Types.Mixed, required: true },
    accessories: { type: mongoose.Schema.Types.Mixed, default: [] },
    checkout: { type: mongoose.Schema.Types.Mixed, default: null },

    viewsCount: { type: Number, default: 0 },
    copiesCount: { type: Number, default: 0 },
    lastOpenedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

export default mongoose.models.SharedProject || mongoose.model('SharedProject', SharedProjectSchema);
