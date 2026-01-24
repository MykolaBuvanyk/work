import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';

const CartRouter = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Auth: add current project to cart
CartRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }

    const body = req.body || {};
    const project = body.project;
    const projectNameRaw = body.projectName ?? project?.name;
    const projectName = String(projectNameRaw || '').trim();

    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    if (!projectName) {
      return res.status(400).json({ status: 400, message: 'Project name is required' });
    }

    const created = await CartProject.create({
      userId,
      projectId: body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null,
      projectName,
      price: toNumber(body.price, 0),
      discountPercent: toNumber(body.discountPercent, 0),
      discountAmount: toNumber(body.discountAmount, 0),
      totalPrice: toNumber(body.totalPrice, 0),
      project,
      accessories: Array.isArray(body.accessories) ? body.accessories : body.accessories || [],
      status: 'pending',
    });

    return res.json({
      id: String(created._id),
      status: created.status,
      createdAt: created.createdAt,
    });
  } catch (e) {
    return next(e);
  }
});

// Admin: list cart entries
CartRouter.get('/admin', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const items = await CartProject.find({}, null, { sort: { createdAt: -1 } }).lean();
    const mapped = (items || []).map((it) => ({
      id: String(it._id),
      userId: it.userId,
      projectId: it.projectId,
      projectName: it.projectName,
      totalPrice: it.totalPrice,
      status: it.status,
      createdAt: it.createdAt,
      updatedAt: it.updatedAt,
    }));

    return res.json(mapped);
  } catch (e) {
    return next(e);
  }
});

// Admin: get full cart entry (for opening in admin later)
CartRouter.get('/admin/:id', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const item = await CartProject.findById(id).lean();
    if (!item) {
      return res.status(404).json({ status: 404, message: 'Cart entry not found' });
    }

    return res.json({
      id: String(item._id),
      userId: item.userId,
      projectId: item.projectId,
      projectName: item.projectName,
      price: item.price,
      discountPercent: item.discountPercent,
      discountAmount: item.discountAmount,
      totalPrice: item.totalPrice,
      project: item.project,
      accessories: item.accessories,
      status: item.status,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (e) {
    return next(e);
  }
});

export default CartRouter;
