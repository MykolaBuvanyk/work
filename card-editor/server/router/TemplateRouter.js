import express from 'express';
import Template from '../models/Template.js';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';

const TemplateRouter = express.Router();

// Public: anyone can view templates
TemplateRouter.get('/', async (req, res, next) => {
  try {
    const items = await Template.find({}, null, { sort: { updatedAt: -1 } }).lean();

    const mapped = (items || []).map((t) => {
      const canvas = t.canvas || {};
      return {
        id: String(t._id),
        name: t.name,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        width: canvas.width || null,
        height: canvas.height || null,
        preview: canvas.preview || null,
        previewSvg: canvas.previewSvg || null,
      };
    });

    return res.json(mapped);
  } catch (e) {
    return next(e);
  }
});

// Public: get full template (canvas snapshot) by id
TemplateRouter.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tpl = await Template.findById(id).lean();

    if (!tpl) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    const canvas = tpl.canvas || null;

    // Avoid sending heavy previews if not needed by the client
    const normalizedCanvas =
      canvas && typeof canvas === 'object'
        ? {
            ...canvas,
            preview: undefined,
            previewSvg: undefined,
          }
        : canvas;

    return res.json({
      id: String(tpl._id),
      name: tpl.name,
      createdAt: tpl.createdAt,
      updatedAt: tpl.updatedAt,
      canvas: normalizedCanvas,
    });
  } catch (e) {
    return next(e);
  }
});

// Admin-only: create template
TemplateRouter.post('/', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name, canvas } = req.body || {};

    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ status: 400, message: 'Template name is required' });
    }
    if (!canvas || typeof canvas !== 'object') {
      return res.status(400).json({ status: 400, message: 'Canvas snapshot is required' });
    }

    const created = await Template.create({
      name: trimmed,
      canvas,
      createdById: req.user?.id ? String(req.user.id) : null,
    });

    return res.json({
      id: String(created._id),
      name: created.name,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
    });
  } catch (e) {
    return next(e);
  }
});

// Admin-only: rename/update template (minimal edit)
TemplateRouter.patch('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};

    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ status: 400, message: 'Template name is required' });
    }

    const updated = await Template.findByIdAndUpdate(
      id,
      { name: trimmed },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    return res.json({
      id: String(updated._id),
      name: updated.name,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    });
  } catch (e) {
    return next(e);
  }
});

// Admin-only: delete template
TemplateRouter.delete('/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await Template.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }
    return res.json({ status: 'ok', id: String(deleted._id) });
  } catch (e) {
    return next(e);
  }
});

export default TemplateRouter;
