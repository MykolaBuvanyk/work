import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';
import { Order, User } from '../models/models.js';
import ErrorApi from '../error/ErrorApi.js';
import { col, fn, Op } from 'sequelize';
import mongoose from 'mongoose';

const CartRouter = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const COLOR_THEME_BY_INDEX_CAPS = {
  0: 'WHITE / BLACK',
  1: 'WHITE / BLUE',
  2: 'WHITE / RED',
  3: 'BLACK / WHITE',
  4: 'BLUE / WHITE',
  5: 'RED / WHITE',
  6: 'GREEN / WHITE',
  7: 'YELLOW / BLACK',
  8: 'GRAY / WHITE',
  9: 'ORANGE / WHITE',
  10: 'BROWN / WHITE',
  11: 'SILVER / BLACK',
  12: '“WOOD” / BLACK',
  13: 'CARBON / WHITE',
};

const normalizeThickness = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 100) / 100;
};

const resolveColorThemeCaps = (toolbarState = {}, canvasSnap = {}) => {
  const idx = Number(toolbarState?.selectedColorIndex);
  if (Number.isFinite(idx) && COLOR_THEME_BY_INDEX_CAPS[idx]) {
    return COLOR_THEME_BY_INDEX_CAPS[idx];
  }

  const bg =
    toolbarState?.globalColors?.backgroundColor ??
    toolbarState?.backgroundColor ??
    canvasSnap?.backgroundColor;
  const bgType =
    toolbarState?.globalColors?.backgroundType ??
    toolbarState?.backgroundType ??
    canvasSnap?.backgroundType;

  if (typeof bg === 'string' && String(bgType).toLowerCase() === 'texture') {
    const lower = bg.toLowerCase();
    if (lower.includes('wood')) return COLOR_THEME_BY_INDEX_CAPS[12];
    if (lower.includes('carbon')) return COLOR_THEME_BY_INDEX_CAPS[13];
  }

  const existing = typeof canvasSnap?.ColorTheme === 'string' ? canvasSnap.ColorTheme.trim() : '';
  return existing ? existing.toUpperCase() : 'UNKNOWN';
};

const normalizeTapeLabel = (value) => (value === true ? 'TAPE' : 'NO TAPE');

const normalizeProjectForCart = (project) => {
  if (!project || typeof project !== 'object') return project;

  const canvases = Array.isArray(project.canvases) ? project.canvases : [];
  const mappedCanvases = canvases.map((c) => {
    const canvas = c && typeof c === 'object' ? c : {};
    const toolbarState = canvas.toolbarState && typeof canvas.toolbarState === 'object' ? canvas.toolbarState : {};

    const Thickness = normalizeThickness(canvas.Thickness ?? toolbarState.thickness ?? canvas.thickness);
    const ColorTheme = resolveColorThemeCaps(toolbarState, canvas);
    const Tape =
      typeof canvas.Tape === 'string'
        ? canvas.Tape.trim().toUpperCase() === 'TAPE'
          ? 'TAPE'
          : 'NO TAPE'
        : normalizeTapeLabel(toolbarState.isAdhesiveTape === true);

    return {
      ...canvas,
      Thickness,
      ColorTheme,
      Tape,
    };
  });

  return {
    ...project,
    canvases: mappedCanvases,
  };
};

const normalizeAccessories = (input) => {
  if (!Array.isArray(input)) return [];

  return input
    .filter((x) => x && typeof x === 'object')
    // If checked is explicitly provided, only keep checked=true.
    // If not provided (older clients), assume already filtered.
    .filter((x) => (x.checked === undefined ? true : x.checked === true))
    .map((x) => {
      const qty = Math.floor(toNumber(x.qty, 0));
      return {
        id: x.id,
        name: x.name,
        qty,
        price: x.price,
        desc: x.desc,
      };
    })
    .filter((x) => x.qty > 0 && (x.id != null || x.name != null));
};

// Auth: add current project to cart
CartRouter.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = req.user?.id ? String(req.user.id) : null;
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }

    const body = req.body || {};
    const project = normalizeProjectForCart(body.project);
    const projectNameRaw = body.projectName ?? project?.name;
    const projectName = String(projectNameRaw || '').trim();

    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    if (!projectName) {
      return res.status(400).json({ status: 400, message: 'Project name is required' });
    }

    const normalizedAccessories = normalizeAccessories(body.accessories);

    const created = await CartProject.create({
      userId,
      projectId: body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null,
      projectName,
      price: toNumber(body.price, 0),
      discountPercent: toNumber(body.discountPercent, 0),
      discountAmount: toNumber(body.discountAmount, 0),
      totalPrice: toNumber(body.totalPrice, 0),
      project,
      accessories: normalizedAccessories,
      status: 'pending',
    });

    const order=await Order.create({
      sum:Math.round(body.price * 100) / 100,
      signs:body.project.canvases.length,
      userId,
      country:body.lang,
      status:'Waiting',
      orderName:body.projectName,
      orderType:'',
      accessories:JSON.stringify(normalizedAccessories),
      idMongo:body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null
    })

    return res.json({
      id: String(created._id),
      status: created.status,
      order,
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


CartRouter.get('/filter', requireAuth, requireAdmin, async (req, res, next) => {
  try {
    let { page = 1, limit = 20, search, status, start, finish, lang } = req.query;

    page = parseInt(page);
    limit = parseInt(limit);
    const offset = limit * (page - 1);

    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [ 
        { orderName: { [Op.like]: `%${search}%` } },
        { orderType: { [Op.like]: `%${search}%` } },
        { id: { [Op.like]: `%${search}%` } },
        { deliveryType: { [Op.like]: `%${search}%` } },
        { sum: { [Op.like]: `%${search}%` } }
      ]
    }


    if (start || finish) {
      where.createdAt = {};
      if (start) where.createdAt[Op.gte] = new Date(start);
      if (finish) where.createdAt[Op.lte] = new Date(finish);
    }

    if (lang) {
      where.country = lang;
    }

    const orders = await Order.findAndCountAll({
      offset,
      limit,
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User }],
    });

    const totalSumData = await Order.findOne({
      attributes: [[fn('SUM', col('sum')), 'totalSum']],
      where,
    });

    const totalSum = totalSumData.get('totalSum') || 0;

    return res.json({ 
      orders: orders.rows,
      page,
      totalSum,
      count: orders.count
    });
  } catch (err) {
    return res.status(400).json(err);
  }
});

CartRouter.get('/get/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findOne({
      where: { id: Number(id) },
      include: [
        { 
          model: User,
          include:[
            {
              model: Order
            }
          ]
        }
      ]
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const orderMongo = await CartProject
      .findOne({ projectId: order.idMongo })
      .lean();
  

    return res.json({
      order: {
        ...order.toJSON(),
        orderMongo,
      },
    });
  } catch (err) {
    console.error('GET ORDER ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});

CartRouter.post('/setStatus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { orderId, newStatus } = req.body;

    const [updatedCount] = await Order.update(
      { status: newStatus },
      { where: { id: Number(orderId) } }
    );

    if (updatedCount === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    return res.json({
      success: true,
      orderId,
      status: newStatus,
    });
  } catch (err) {
    console.error('SET STATUS ERROR:', err);
    return res.status(500).json({ message: err.message });
  }
});



export default CartRouter;
