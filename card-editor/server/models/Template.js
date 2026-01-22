import mongoose from 'mongoose';

const TemplateSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    canvas: { type: mongoose.Schema.Types.Mixed, required: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'TemplateCategory', default: null },
    isPublic: { type: Boolean, default: true },
    createdById: { type: String, default: null },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

export default mongoose.models.Template || mongoose.model('Template', TemplateSchema);
