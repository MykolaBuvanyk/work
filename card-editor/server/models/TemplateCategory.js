import mongoose from 'mongoose';

const TemplateCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    createdById: { type: String, default: null },
  },
  {
    timestamps: true,
    minimize: false,
  }
);

export default (
  mongoose.models.TemplateCategory ||
  mongoose.model('TemplateCategory', TemplateCategorySchema)
);
