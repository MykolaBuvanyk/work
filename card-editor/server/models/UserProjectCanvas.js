import mongoose from 'mongoose';

const UserProjectCanvasSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    userProjectId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    canvasId: { type: String, default: null },
    order: { type: Number, required: true },
    canvas: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

UserProjectCanvasSchema.index({ userProjectId: 1, order: 1 }, { unique: true });
UserProjectCanvasSchema.index({ userProjectId: 1, canvasId: 1 });
UserProjectCanvasSchema.index({ userId: 1, userProjectId: 1, order: 1 });

export default mongoose.models.UserProjectCanvas ||
  mongoose.model('UserProjectCanvas', UserProjectCanvasSchema);
