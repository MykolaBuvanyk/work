import express from 'express';
import Template from '../models/Template.js';
import TemplateCategory from '../models/TemplateCategory.js';
import { requireAuth, requireAdmin, optionalAuth } from '../middleware/authMiddleware.js';

const TemplateRouter = express.Router();

const mapTemplateListItem = (t) => {
  const canvas = t.canvas || {};
  const category = t.categoryId && typeof t.categoryId === 'object' ? t.categoryId : null;
  return {
    id: String(t._id),
    name: t.name,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    categoryId: category ? String(category._id) : t.categoryId ? String(t.categoryId) : null,
    categoryName: category ? category.name : null,
    width: canvas.width || null,
    height: canvas.height || null,
    preview: canvas.preview || null,
    previewSvg: canvas.previewSvg || null,
  };
};

// Public: list template categories
TemplateRouter.get('/categories', async (req, res, next) => {
  try {
    const items = await TemplateCategory.find({}, null, { sort: { name: 1 } }).lean();
    const mapped = (items || []).map((c) => ({
      id: String(c._id),
      name: c.name,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
    return res.json(mapped);
  } catch (e) {
    return next(e);
  }
});

// Admin-only: create category
TemplateRouter.post('/categories', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { name } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ status: 400, message: 'Category name is required' });
    }

    const exists = await TemplateCategory.findOne({ name: trimmed }).lean();
    if (exists) {
      return res.status(409).json({ status: 409, message: 'Category already exists' });
    }

    const created = await TemplateCategory.create({
      name: trimmed,
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

// Admin-only: rename category
TemplateRouter.patch('/categories/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name } = req.body || {};
    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ status: 400, message: 'Category name is required' });
    }

    const exists = await TemplateCategory.findOne({ name: trimmed }).lean();
    if (exists && String(exists._id) !== String(id)) {
      return res.status(409).json({ status: 409, message: 'Category already exists' });
    }

    const updated = await TemplateCategory.findByIdAndUpdate(
      id,
      { name: trimmed },
      { new: true }
    ).lean();

    if (!updated) {
      return res.status(404).json({ status: 404, message: 'Category not found' });
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

// Admin-only: delete category (templates become uncategorized)
TemplateRouter.delete('/categories/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await TemplateCategory.findByIdAndDelete(id).lean();
    if (!deleted) {
      return res.status(404).json({ status: 404, message: 'Category not found' });
    }

    try {
      await Template.updateMany({ categoryId: deleted._id }, { $set: { categoryId: null } });
    } catch {}

    return res.json({ status: 'ok', id: String(deleted._id) });
  } catch (e) {
    return next(e);
  }
});

// Public: anyone can view templates
TemplateRouter.get('/', async (req, res, next) => {
  try {
    const items = await Template.find({ isPublic: true }, null, { sort: { updatedAt: -1 } })
      .populate('categoryId', 'name')
      .lean();

    return res.json((items || []).map(mapTemplateListItem));
  } catch (e) {
    return next(e);
  }
});

// Auth: list current user's private templates (My Templates)
TemplateRouter.get('/my', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }

    const items = await Template.find(
      { isPublic: false, createdById: userId },
      null,
      { sort: { updatedAt: -1 } }
    )
      .populate('categoryId', 'name')
      .lean();

    return res.json((items || []).map(mapTemplateListItem));
  } catch (e) {
    return next(e);
  }
});

// Auth: get full private template by id
TemplateRouter.get('/my/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tpl = await Template.findById(id).lean();
    if (!tpl) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    const userId = req.user?.id ? String(req.user.id) : null;
    const isOwner = userId && tpl.createdById && String(tpl.createdById) === String(userId);
    const isAdmin = req.user?.type === 'Admin';
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ status: 403, message: 'Forbidden' });
    }

    const canvas = tpl.canvas || null;
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

// Public: get full template (canvas snapshot) by id.
// Private templates are only accessible to owner/admin (token optional).
TemplateRouter.get('/:id', optionalAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tpl = await Template.findById(id).lean();

    if (!tpl) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    if (!tpl.isPublic) {
      if (!req.user) {
        return res.status(401).json({ status: 401, message: 'Unauthorized' });
      }
      const userId = req.user?.id ? String(req.user.id) : null;
      const isOwner = userId && tpl.createdById && String(tpl.createdById) === String(userId);
      const isAdmin = req.user?.type === 'Admin';
      if (!isOwner && !isAdmin) {
        return res.status(403).json({ status: 403, message: 'Forbidden' });
      }
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

// Auth: create template
// - Admin creates public templates (optionally categorized)
// - Non-admin creates private templates (My Templates)
TemplateRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const { name, canvas, categoryId } = req.body || {};

    const trimmed = String(name || '').trim();
    if (!trimmed) {
      return res.status(400).json({ status: 400, message: 'Template name is required' });
    }
    if (!canvas || typeof canvas !== 'object') {
      return res.status(400).json({ status: 400, message: 'Canvas snapshot is required' });
    }

    const isAdmin = req.user?.type === 'Admin';
    const created = await Template.create({
      name: trimmed,
      canvas,
      categoryId: isAdmin && categoryId ? String(categoryId) : null,
      isPublic: Boolean(isAdmin),
      createdById: req.user?.id ? String(req.user.id) : null,
    });

    return res.json({
      id: String(created._id),
      name: created.name,
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      categoryId: created.categoryId ? String(created.categoryId) : null,
    });
  } catch (e) {
    return next(e);
  }
});

// Auth: update template
// - Admin can update name + category
// - Owner can update name (private templates)
TemplateRouter.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, categoryId } = req.body || {};
    const hasName = typeof name !== 'undefined';
    const hasCategory = typeof categoryId !== 'undefined';
    if (!hasName && !hasCategory) {
      return res.status(400).json({ status: 400, message: 'Nothing to update' });
    }

    const existing = await Template.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    const isAdmin = req.user?.type === 'Admin';
    const userId = req.user?.id ? String(req.user.id) : null;
    const isOwner = userId && existing.createdById && String(existing.createdById) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ status: 403, message: 'Forbidden' });
    }

    const update = {};
    if (hasName) {
      const trimmed = String(name || '').trim();
      if (!trimmed) {
        return res.status(400).json({ status: 400, message: 'Template name is required' });
      }
      update.name = trimmed;
    }
    if (hasCategory) {
      if (!isAdmin) {
        return res.status(403).json({ status: 403, message: 'Admin only: category update' });
      }
      update.categoryId = categoryId ? String(categoryId) : null;
    }

    const updated = await Template.findByIdAndUpdate(
      id,
      update,
      { new: true }
    )
      .populate('categoryId', 'name')
      .lean();

    if (!updated) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    return res.json({
      id: String(updated._id),
      name: updated.name,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      categoryId: updated.categoryId && typeof updated.categoryId === 'object' ? String(updated.categoryId._id) : updated.categoryId ? String(updated.categoryId) : null,
      categoryName: updated.categoryId && typeof updated.categoryId === 'object' ? updated.categoryId.name : null,
    });
  } catch (e) {
    return next(e);
  }
});

// Auth: delete template (admin or owner)
TemplateRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const existing = await Template.findById(id).lean();
    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Template not found' });
    }

    const isAdmin = req.user?.type === 'Admin';
    const userId = req.user?.id ? String(req.user.id) : null;
    const isOwner = userId && existing.createdById && String(existing.createdById) === String(userId);
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ status: 403, message: 'Forbidden' });
    }

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
