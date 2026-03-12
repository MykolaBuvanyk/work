import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';
import { Order, User } from '../models/models.js';
import { col, fn, Op, where } from 'sequelize';
import puppeteer from 'puppeteer';
import SendEmailForStatus from '../Controller/SendEmailForStatus.js';



function formatDate(dateStr) {
  const d = new Date(dateStr);

  const pad = n => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function formatDatePlusMonth(dateStr) {
  const d = new Date(dateStr);

  // додаємо +1 місяць
  d.setMonth(d.getMonth() + 1);

  const pad = n => String(n).padStart(2, '0');

  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());

  return `${day}-${month}-${year} ${hours}:${minutes}`;
}

function formatInvoiceDate(dateStr) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '';

  const pad = n => String(n).padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = String(d.getFullYear()).slice(2);

  return `${day}.${month}.${year}`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[char] || char));
}

function hasContent(value) {
  return String(value ?? '').trim().length > 0;
}

function hasAddressContent(address) {
  if (!address || typeof address !== 'object') return false;

  return [
    address.fullName,
    address.companyName,
    address.address1,
    address.address2,
    address.address3,
    address.town,
    address.postalCode,
    address.country,
    address.email,
    address.mobile,
  ].some(hasContent);
}

function formatMoney(value) {
  return toNumber(value, 0).toFixed(2);
}




const CartRouter = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const round2 = (value) => Math.round((toNumber(value, 0) + Number.EPSILON) * 100) / 100;

const isMongoObjectId = (value) => /^[a-f\d]{24}$/i.test(String(value || '').trim());

const findCartProjectForOrder = async (order) => {
  const key = String(order?.idMongo || '').trim();
  if (!key) return null;

  // New format: idMongo stores CartProject _id for a strict 1:1 mapping.
  if (isMongoObjectId(key)) {
    const byId = await CartProject.findById(key).lean();
    if (byId) return byId;
  }
  
  // Legacy fallback: old orders stored projectId in idMongo.
  return CartProject.findOne({ projectId: key }, null, { sort: { createdAt: -1 } }).lean();
};

const findCartProjectForId = async (idMongo) => {
  return CartProject.findOne({ projectId: String(idMongo) }, null, { sort: { createdAt: -1 } }).lean();
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

const formatDisplayNumber = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded)
    ? String(rounded)
    : String(rounded).replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '');
};

const formatCanvasSizeMm = (canvasSnap = {}) => {
  const mmWidth = Number(canvasSnap?.toolbarState?.sizeValues?.width);
  const mmHeight = Number(canvasSnap?.toolbarState?.sizeValues?.height);

  if (Number.isFinite(mmWidth) && Number.isFinite(mmHeight)) {
    return `${formatDisplayNumber(mmWidth)} x ${formatDisplayNumber(mmHeight)} mm`;
  }

  const width = Number(canvasSnap?.width);
  const height = Number(canvasSnap?.height);
  if (Number.isFinite(width) && Number.isFinite(height)) {
    const fallbackWidthMm = (width * 25.4) / 72;
    const fallbackHeightMm = (height * 25.4) / 72;
    return `${formatDisplayNumber(fallbackWidthMm)} x ${formatDisplayNumber(fallbackHeightMm)} mm`;
  }

  return 'Unknown size';
};

const resolveTapeLabel = (canvasSnap = {}) => {
  if (typeof canvasSnap?.Tape === 'string' && canvasSnap.Tape.trim()) {
    return canvasSnap.Tape.trim().toUpperCase();
  }
  return canvasSnap?.toolbarState?.isAdhesiveTape ? 'TAPE' : 'NO TAPE';
};

const resolveCanvasObjects = (canvasSnap = {}) => {
  if (Array.isArray(canvasSnap?.json?.objects)) return canvasSnap.json.objects;
  if (Array.isArray(canvasSnap?.jsonTemplate?.objects)) return canvasSnap.jsonTemplate.objects;
  if (Array.isArray(canvasSnap?.objects)) return canvasSnap.objects;
  return [];
};

const hasObjectFlag = (obj, key) => obj?.[key] === true || obj?.data?.[key] === true;

const isQrObject = (obj) => hasObjectFlag(obj, 'isQRCode');

const isBarcodeObject = (obj) => hasObjectFlag(obj, 'isBarCode');

const isHoleObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (obj.isCutElement === true && String(obj.cutType || '').toLowerCase() === 'hole') return true;
  if (typeof obj.id === 'string' && obj.id.startsWith('hole-')) return true;
  if (typeof obj.id === 'string' && obj.id.startsWith('holes-')) return true;
  if (typeof obj.name === 'string' && obj.name.toLowerCase().includes('hole')) return true;
  if (obj.isHole === true) return true;
  return false;
};

const isCutFigureObject = (obj) => {
  if (!obj || typeof obj !== 'object') return false;
  if (isHoleObject(obj)) return false;
  if (obj.isCutElement === true) {
    const cutType = String(obj.cutType || '').toLowerCase();
    return cutType === 'shape' || cutType === 'manual';
  }
  return false;
};

const isTextObject = (obj) => {
  const type = String(obj?.type || '').toLowerCase();
  return ['text', 'textbox', 'i-text'].includes(type) || (typeof obj?.text === 'string' && obj.text.trim());
};

const isImageObject = (obj) => String(obj?.type || '').toLowerCase() === 'image';

const isHelperObject = (obj) => {
  if (!obj || typeof obj !== 'object') return true;
  return Boolean(
    obj.isBorderShape ||
      obj.cardBorderMode ||
      obj.excludeFromExport ||
      obj.excludeFromSummary ||
      obj.isSafeZone ||
      obj.isBleedZone ||
      obj.isGuide ||
      obj.isGrid ||
      obj.isFrameHole ||
      obj.isHole
  );
};

const isShapeObject = (obj) => {
  const type = String(obj?.type || '').toLowerCase();
  return ['path', 'rect', 'circle', 'ellipse', 'triangle', 'polygon', 'polyline', 'line'].includes(type);
};

const analyzeCanvasContent = (canvasSnap = {}) => {
  const summary = {
    texts: [],
    shapes: 0,
    cutFigures: 0,
    holes: 0,
    qrCodes: 0,
    barcodes: 0,
    images: 0,
  };

  const walk = (obj) => {
    if (!obj || isHelperObject(obj)) return;

    if (isQrObject(obj)) {
      summary.qrCodes += 1;
      return;
    }

    if (isHoleObject(obj)) {
      summary.holes += 1;
      return;
    }

    if (isCutFigureObject(obj)) {
      summary.cutFigures += 1;
      return;
    }

    if (isBarcodeObject(obj)) {
      summary.barcodes += 1;
      return;
    }

    if (isTextObject(obj)) {
      const text = String(obj?.text || '').trim();
      if (text) summary.texts.push(text);
      return;
    }

    if (isImageObject(obj)) {
      summary.images += 1;
      return;
    }

    if (Array.isArray(obj?.objects) && obj.objects.length > 0) {
      obj.objects.forEach(walk);
      return;
    }

    if (isShapeObject(obj)) {
      summary.shapes += 1;
    }
  };

  resolveCanvasObjects(canvasSnap).forEach(walk);
  return summary;
};

const resolveCopiesCount = (canvasSnap = {}) => {
  const raw = canvasSnap?.copiesCount ?? canvasSnap?.toolbarState?.copiesCount ?? 1;
  const count = Math.floor(Number(raw));
  return Number.isFinite(count) && count > 0 ? count : 1;
};

const buildDeliveryNoteSummary = (order, orderMongo) => {
  const storedSummary = orderMongo?.checkout?.orderTestSummary;

  if (storedSummary && typeof storedSummary === 'object') {
    return {
      projectTitle: String(storedSummary?.projectTitle || order?.orderName || orderMongo?.projectName || ''),
      totalSigns: Math.max(0, Math.floor(toNumber(storedSummary?.totalSigns, toNumber(order?.signs, 0)))),
      accessories: normalizeAccessories(storedSummary?.accessories),
      signs: Array.isArray(storedSummary?.signs)
        ? storedSummary.signs.map((sign, index) => ({
            id: String(sign?.id || index),
            title: String(sign?.title || `Sign ${index + 1}`),
            metaLine: String(sign?.metaLine || ''),
            textLine: String(sign?.textLine || '—'),
            counts: {
              shapes: Math.max(0, Math.floor(toNumber(sign?.counts?.shapes, 0))),
              cutFigures: Math.max(0, Math.floor(toNumber(sign?.counts?.cutFigures, 0))),
              holes: Math.max(0, Math.floor(toNumber(sign?.counts?.holes, 0))),
              qrCodes: Math.max(0, Math.floor(toNumber(sign?.counts?.qrCodes, 0))),
              barcodes: Math.max(0, Math.floor(toNumber(sign?.counts?.barcodes, 0))),
              images: Math.max(0, Math.floor(toNumber(sign?.counts?.images, 0))),
            },
            copiesCount: Math.max(1, Math.floor(toNumber(sign?.copiesCount, 1))),
          }))
        : [],
    };
  }

  const projectSnapshot = normalizeProjectForCart(orderMongo?.project || {});
  const canvases = Array.isArray(projectSnapshot?.canvases) ? projectSnapshot.canvases : [];
  const signs = canvases.map((canvasSnap, index) => {
    const content = analyzeCanvasContent(canvasSnap);
    const thickness = formatDisplayNumber(canvasSnap?.Thickness ?? canvasSnap?.toolbarState?.thickness);
    const metaParts = [
      formatCanvasSizeMm(canvasSnap),
      resolveColorThemeCaps(canvasSnap?.toolbarState, canvasSnap),
      thickness ? `${thickness}` : null,
      resolveTapeLabel(canvasSnap),
    ].filter(Boolean);

    return {
      id: String(canvasSnap?.id || index),
      title: `Sign ${index + 1}`,
      metaLine: metaParts.join(', '),
      textLine: content.texts.length > 0 ? content.texts.join(', ') : '—',
      counts: {
        shapes: content.shapes,
        cutFigures: content.cutFigures,
        holes: content.holes,
        qrCodes: content.qrCodes,
        barcodes: content.barcodes,
        images: content.images,
      },
      copiesCount: resolveCopiesCount(canvasSnap),
    };
  });

  return {
    projectTitle: String(order?.orderName || orderMongo?.projectName || ''),
    totalSigns: signs.reduce((sum, sign) => sum + sign.copiesCount, 0) || Math.max(0, Math.floor(toNumber(order?.signs, 0))),
    accessories: normalizeAccessories(orderMongo?.accessories),
    signs,
  };
};

const countProjectSigns = (project) => {
  const canvases = Array.isArray(project?.canvases) ? project.canvases : [];
  return canvases.reduce((sum, canvas) => {
    const rawCopies =
      canvas?.copiesCount ??
      canvas?.toolbarState?.copiesCount ??
      1;
    const copies = Math.max(1, Math.floor(toNumber(rawCopies, 1)));
    return sum + copies;
  }, 0);
};

const countTotalSignsFromProject = (project) => countProjectSigns(project);

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
    const netAfterDiscount = toNumber(body.netAfterDiscount, toNumber(body.price, 0));
    const totalPriceInclVat = toNumber(body.totalPrice, 0);
    const checkoutSnapshot = body?.checkout && typeof body.checkout === 'object' ? body.checkout : null;
    const checkoutDeliveryLabel = String(body?.checkout?.deliveryLabel || body?.deliveryType || '').trim();
    const checkoutCountryRegion = String(body?.checkout?.deliveryAddress?.region || '').trim().toUpperCase();
    const checkoutCountryName = String(body?.checkout?.deliveryAddress?.country || '').trim();

    const created = await CartProject.create({
      userId,
      projectId: body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null,
      projectName,
      price: netAfterDiscount,
      discountPercent: toNumber(body.discountPercent, 0),
      discountAmount: toNumber(body.discountAmount, 0),
      totalPrice: totalPriceInclVat,
      project,
      accessories: normalizedAccessories,
      checkout: checkoutSnapshot,
      status: 'pending',
    });


    const orderSigns = countProjectSigns(project);

  
    const user=await User.findOne({where:{id:req.user.id}});
    const fallbackCountry = String(user?.country || '').trim() || 'NO';
    const order=await Order.create({
      sum: user.type == 'Admin' ? 0 : totalPriceInclVat,
      netAfterDiscount: user.type ==' Admin'? 0 : netAfterDiscount,
      signs: orderSigns > 0 ? orderSigns : 1,
      userId,
      country:checkoutCountryRegion || checkoutCountryName || fallbackCountry,
      status:'Received',
      orderName:body.projectName,
      orderType:'',
      deliveryType: checkoutDeliveryLabel,
      accessories:JSON.stringify(normalizedAccessories),
      idMongo: String(created._id),
      isPaid:user.type == 'Admin' ?null:false
    })

    const userOrders=await Order.findOne({where:{userId:req.user.id,status:'Deleted'}});
    if(userOrders){
      order.status='Deleted';
      await order.save();
    }
    const orderWithUser=await Order.findOne({
      where:{id:order.id},
      include:[
        {
          model:User
        }
      ]
    })
    
    SendEmailForStatus.CreateOrder(orderWithUser);

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
    let { page = 1, limit = 20, search, status, start, finish, lang, userId, isPaid } = req.query;
    page = parseInt(page);
    limit = parseInt(limit);
    const offset = limit * (page - 1);

    const where = {};
    const userWhere={};

    if (status) {
      where.status = status;
    }

    if (search) {
      where[Op.or] = [ 
        { userId: { [Op.like]: `%${parseInt(search)}%` } },
        //{ orderName: { [Op.like]: `%${search}%` } },
        //{ orderType: { [Op.like]: `%${search}%` } },
        { id:parseInt(search) },
        //{ deliveryType: { [Op.like]: `%${search}%` } },
        //{ country: { [Op.like]: `%${search}%` } },
        //{ sum: { [Op.like]: `%${search}%` } },
        //{ userId: { [Op.like]: `%${parseInt(search)}%` } }
      ]
    }


    if (start || finish) {
      where.createdAt = {};
      if (start) where.createdAt[Op.gte] = new Date(start);
      if (finish) where.createdAt[Op.lte] = new Date(finish);
    }
    

    if (isPaid !== undefined) {
      if(isPaid=='admin'){
        userWhere.type='Admin';
      }else{
        where.isPaid = isPaid === 'true';
      }
    }

    if (lang) {
      where.country = lang;
    }

    if (userId !== undefined && userId !== null && String(userId).trim() !== '') {
      const normalizedUserId = Number(userId);
      if (!Number.isFinite(normalizedUserId)) {
        return res.status(400).json({ message: 'Invalid userId filter' });
      }
      where.userId = normalizedUserId;
    }

    let orders = await Order.findAndCountAll({
      offset,
      limit,
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User,where:userWhere }],
    });
    let ordersForSum = await Order.findAll({
      where,
      order: [['createdAt', 'DESC']],
      attributes:['sum']
    });

    let totalSum=0;
    ordersForSum.forEach(x=>totalSum+=x.sum);

    const mappedOrders = await Promise.all(
      (orders.rows || []).map(async (order) => {
        const orderMongo = await findCartProjectForOrder(order);
        const totalPrice = Number(orderMongo?.totalPrice);
        const computedSigns = countTotalSignsFromProject(orderMongo?.project);
        return {
          ...(typeof order?.toJSON === 'function' ? order.toJSON() : order),
          orderMongo,
          signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
          totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
        };
      })
    );

    const baseOrders = orders.rows;

    const resolveOrderSigns = (order) => {
      const canvases = order?.orderMongo?.project?.canvases;
      if (Array.isArray(canvases) && canvases.length > 0) {
        return canvases.reduce((sum, canvas) => {
          const raw = canvas?.copiesCount ?? canvas?.toolbarState?.copiesCount ?? 1;
          const copies = Math.max(1, Math.floor(Number(raw) || 1));
          return sum + copies;
        }, 0);
      }

      const legacy = Number(order?.signs);
      return Number.isFinite(legacy) ? legacy : 0;
    };
    
    const enrichedOrders= await Promise.all(
      baseOrders.map(async (order) => {
        try {
          if (!order) {
            return res.status(404).json({ message: 'Order not found' });
          }
          
          const orderMongo = await findCartProjectForOrder(order);
          const computedSigns = countTotalSignsFromProject(orderMongo?.project);

          const signs=computedSigns > 0 ? computedSigns : Number(order?.signs || 0);
          
          const fullOrder = orderMongo;
          const totalPrice = Number(orderMongo?.totalPrice);
          return {
            ...order.toJSON(),
            orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
            signs: resolveOrderSigns({
              ...order.toJSON(),
              orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            }),
          };
        } catch {
          return {
            ...order.toJSON(),
            totalPrice: Number.isFinite(Number(order?.totalPrice)) ? Number(order.totalPrice) : null,
            signs: resolveOrderSigns(order),
          };
        }
      })
    );
    
    const total = enrichedOrders.reduce((acc, order) => {
        const value = Number(order?.totalPrice);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);

    const sum=total.toFixed(2)
    
    
    return res.json({
      orders: enrichedOrders,
      page,
      totalSum,
      count: orders.count
    });
  } catch (err) {
    console.error(4234,err)
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

    const orderMongo = await findCartProjectForOrder(order);
    const computedSigns = countTotalSignsFromProject(orderMongo?.project);
  

    return res.json({
      order: {
        ...order.toJSON(),
        orderMongo,
        signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
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

    let updatedCount;

    if(newStatus=='Deleted'){
      [updatedCount] = await Order.update(
        { status: newStatus },
        { where: { userId: req.user.id } }
      );
    }else {
      [updatedCount] = await Order.update(
        { status: newStatus },
        { where: { id: Number(orderId) } }
      );
    }

    const orderWithUser=await Order.findOne({
      where:{id:Number(orderId)},
      include:[
        {
          model:User
        }
      ]
    });
    if(newStatus=='Printed'){
      SendEmailForStatus.StatusPrinted(orderWithUser);
    }
    if(newStatus=='Shipped'){
      SendEmailForStatus.StatusShipped(orderWithUser);
      SendEmailForStatus.StatusShipped2(orderWithUser);
    }
    if(newStatus=='Delivered'){
      setTimeout(() => {
        SendEmailForStatus.StatusDelivered(orderWithUser);
      }, 48 * 60 * 60 * 1000);
    }
    
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

CartRouter.get('/getPdfs/:idOrder', requireAuth, requireAdmin, async (req, res, next) => {
    let browser;
    try {
        const { idOrder } = req.params;

        // 1. Отримання даних з SQL (враховуємо твій регістр)
        const order = await Order.findOne({
            where: { id: Number(idOrder) },
            include: [{ 
                model: User, 
                include: [{ model: Order }] 
            }]
        });

        if (!order) return res.status(404).json({ message: 'Order not found' });

        // 2. Отримання даних з MongoDB (проект лежить тут)
        const orderMongo = await findCartProjectForOrder(order);

        // --- ЛОГІКА ТРАНСФОРМАЦІЇ ДАНИХ (ПЕРЕНЕСЕНО З ФРОНТЕНДУ) ---

        // Функція перетворення канвасу в дизайн
        const mapCartCanvasToDesign = (canvas) => {
            if (!canvas) return null;
            return {
                ...canvas,
                // додаємо базові поля, якщо вони потрібні для ключа матеріалу
                color: canvas.color || 'unknown',
                thickness: canvas.thickness || '1.6',
                tape: canvas.tape || 'no-tape',
                copies: canvas.copies || 1
            };
        };

        // Функція нормалізації (розгортання дизайнів)
        const normalizeDesigns = (designs) => {
            if (!Array.isArray(designs)) return [];
            return designs.flatMap(design => {
                // якщо логіка нормалізації передбачає якісь зміни, додай тут
                return design;
            });
        };

        // Функція генерації ключа матеріалу
        const getMaterialKey = (item) => {
            const color = String(item?.color || 'unknown').trim().toLowerCase();
            const thickness = String(item?.thickness || '1.6').trim();
            const tape = String(item?.tape || 'no-tape').trim().toLowerCase();
            return `${color}::${thickness}::${tape}`;
        };

        // 3. Побудова materialGroups (ідентично до твого useMemo)
        const canvases = orderMongo?.project?.canvases || [];
        const designs = canvases.map(mapCartCanvasToDesign).filter(Boolean);
        const normalizedItems = normalizeDesigns(designs);

        const groups = new Map();
        normalizedItems.forEach((item) => {
            const key = getMaterialKey(item);
            const existing = groups.get(key);
            const countToAdd = Math.max(1, Number(item?.copies) || 1);
            if (!existing) {
                const [colorPart, thicknessPart, tapePart] = String(key).split('::');
                groups.set(key, {
                    key,
                    color: colorPart || 'unknown',
                    thickness: thicknessPart || 'unknown',
                    tape: tapePart || 'unknown-tape',
                    count: countToAdd,
                });
            } else {
                existing.count += countToAdd;
            }
        });

        // Сортування (як у тебе в коді)
        const materialGroups = Array.from(groups.values()).sort((a, b) => {
            if (b.count !== a.count) return b.count - a.count;
            return a.key.localeCompare(b.key);
        });

        // --- ГЕНЕРАЦІЯ PDF ---

        browser = await puppeteer.launch({
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
        });
        const page = await browser.newPage();

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; margin: 0; padding: 20px 40px; color: #000; line-height: 1.4; font-size: 13px; }
        .page { width: 100%; position: relative; }
        .header { text-align: center; margin-bottom: 30px; }
        .header h1 { font-size: 24px; margin: 0; letter-spacing: 2px; }
        .order-meta { margin-bottom: 40px; }
        .address-container { display: flex; justify-content: space-between; margin-top: 50px; margin-bottom: 60px; }
        .items-list { margin-top: 40px; }
        .item-row { display: flex; align-items: center; margin-bottom: 8px; }
        .checkbox { width: 35px; height: 22px; border: 1px solid #777; margin-right: 30px; }
        .label-box { 
            width: 22px; height: 22px; display: flex; align-items: center; justify-content: center;
            border: 1px solid #ccc; margin-right: 25px; font-weight: bold; font-size: 12px;
        }
        .item-text { text-decoration: underline; font-size: 13px; }
        .qty { margin-right: 15px; font-weight: bold; }

        /* Кольори */
        .white-black { background: white; color: black; border: 1px solid #000; }
        .silver-black { background: #c0c0c0; color: black; }
        .blue-white { background: #0000ff; color: white; border: none; }
        .red-white { background: #ff0000; color: white; border: none; }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <h1>CSA</h1>
            <p>Germany</p>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div class="order-meta">
                <div style="text-decoration: underline;">${new Date().toLocaleDateString('uk-UA')}</div>
                <div>Customer No: ${order.userId}</div>
                <div>Order No: ${order.id}</div>
                <div>Count orders: ${order.user?.orders?.length || 0}</div>
            </div>
            <div style="font-size: 20px; font-weight: bold; margin-top: 40px;">
                ${order.orderName || ''}
            </div>
        </div>

        <div class="address-container">
            <div>
                <strong>${order.user?.company || ''}</strong><br>
                ${order.user?.firstName} ${order.user?.surname}<br>
                ${order.user?.address} ${order.user?.house || ''}<br>
                ${order.user?.postcode} ${order.user?.city || ''}<br>
                ${order.user?.country || ''}
            </div>
            <div style="font-size: 11px;">
                ${order.user?.company2 || ''}<br>
                ${order.user?.firstName} ${order.user?.surname}<br>
                Phone: ${order.user?.phone}<br>
                ${order.user?.email}
            </div>
        </div>

        <div class="items-list">
            ${materialGroups.map(group => {
                const colorLabel = String(group.color).toUpperCase();
                const thicknessNum = Number(group.thickness);
                const thicknessLabel = Math.abs(thicknessNum - 1.6) > 0.01 ? ` ${thicknessNum}` : '';
                const tapeLabel = group.tape === 'tape' ? '' : ' NO TAPE';
                const fileLabel = `${order.userId} ${colorLabel}${thicknessLabel}${tapeLabel}.pdf (${group.count} signs)`;
                
                const colorClass = group.color.replace(/ \/ |\/| /g, '-');

                return `
                <div class="item-row">
                    <div class="checkbox"></div>
                    <div class="label-box ${colorClass}">A</div>
                    <div class="item-text">${fileLabel}</div>
                </div>`;
            }).join('')}

            <div style="margin-top: 30px;">
                ${(orderMongo?.accessories || []).map(x => `
                  <div class="item-row">
                    <div class="checkbox"></div>
                    <div style="font-size: 14px;">
                      <span class="qty">${x.qty} </span> 
                      <span style="text-decoration: underline;">${x.name}</span>
                    </div>
                  </div>`).join('')}
            </div>
        </div>

        <div style="margin-top: 50px;">
            <div class="item-row">
                <div class="checkbox"></div>
                <div>Delivery: ${order.user?.address || ''}</div>
            </div>
            <div style="margin-left: 65px; font-weight: bold;">Order Sum: ${order.sum}</div>
        </div>
    </div>
</body>
</html>`;

        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({ 
            format: 'A4', 
            printBackground: true,
            margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
        });

        res.writeHead(200, {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
            'Content-Length': pdfBuffer.length
        });

        return res.end(pdfBuffer, 'binary');

    } catch (err) {
        console.error('error get pdfs', err);
        return res.status(500).send('Error');
    } finally {
        if (browser) await browser.close();
    }
});


CartRouter.get('/getPdfs2/:idOrder', requireAuth, requireAdmin, async (req, res, next) => {
  let browser; // Оголошуємо зовні, щоб закрити у блоці finally
  try {
    const { idOrder } = req.params;
    
    // Твоя логіка пошуку даних
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{ model: User, include: [{model:Order}] }]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderMongo = await findCartProjectForOrder(order);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();
    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object' ? orderMongo.checkout : {};
    const deliveryAddress = hasAddressContent(checkout?.deliveryAddress) ? checkout.deliveryAddress : null;
    const summary = buildDeliveryNoteSummary(order, orderMongo);
    const orderDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const customerNumber = escapeHtml(order.userId);
    const orderNumber = escapeHtml(order.id);
    const orderName = escapeHtml(summary.projectTitle || order.orderName || orderMongo?.projectName || 'Untitled');
    const invoiceNumber = escapeHtml(order.id);
    const totalSigns = escapeHtml(summary.totalSigns || order.signs || 0);
    const accessoriesSummary = summary.accessories.length
      ? summary.accessories.map((item) => `${escapeHtml(item.qty)} ${escapeHtml(item.name)}`).join('; ')
      : 'No accessories selected';
    const shippingCompany = deliveryAddress?.companyName || '';
    const shippingName = deliveryAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(hasContent).join(' ');
    const shippingAddressLine1 = [deliveryAddress?.address1, deliveryAddress?.address2, deliveryAddress?.address3]
      .filter(hasContent)
      .join(', ');
    const shippingAddressLine2 = [deliveryAddress?.postalCode, deliveryAddress?.town].filter(hasContent).join(' ');
    const shippingCountry = deliveryAddress?.country || order.country || order.user?.country || '';
    const shippingPhone = deliveryAddress?.mobile || order.user?.phone || '';
    const shippingAddressHtml = [
      shippingCompany,
      shippingName,
      shippingAddressLine1,
      shippingAddressLine2,
      shippingCountry,
      shippingPhone ? `Phone: ${shippingPhone}` : '',
    ]
      .filter(hasContent)
      .map(escapeHtml)
      .join('<br>');
    const signBlocksHtml = summary.signs.length > 0
      ? summary.signs
        .map((sign, index) => {
        const counts = sign?.counts || {};
        const countsSummary = [
          toNumber(counts.images, 0) > 0 ? `${Math.floor(toNumber(counts.images, 0))} Images` : null,
          toNumber(counts.shapes, 0) > 0 ? `${Math.floor(toNumber(counts.shapes, 0))} Shapes` : null,
          toNumber(counts.cutFigures, 0) > 0 ? `${Math.floor(toNumber(counts.cutFigures, 0))} Cut Figures` : null,
          toNumber(counts.holes, 0) > 0 ? `${Math.floor(toNumber(counts.holes, 0))} Holes` : null,
          toNumber(counts.qrCodes, 0) > 0 ? `${Math.floor(toNumber(counts.qrCodes, 0))} QR` : null,
          toNumber(counts.barcodes, 0) > 0 ? `${Math.floor(toNumber(counts.barcodes, 0))} Bar Codes` : null,
        ].filter(Boolean);
        const copiesCount = Math.max(1, Math.floor(toNumber(sign?.copiesCount, 1)));
        const signTitle = `${String(sign?.title || `Sign ${index + 1}`)}${copiesCount > 1 ? ` (${copiesCount} pcs)` : ''}`;
        const signMetaLine = [String(sign?.metaLine || '').trim(), ...countsSummary].filter(hasContent).join(', ');

        return `
    <div class="item-block">
      <div class="col-left">${escapeHtml(signTitle)}:</div>
      <div class="col-right">
        ${escapeHtml(signMetaLine || 'No sign details available')}<br>
        <span class="item-details">Text: ${escapeHtml(sign?.textLine || '—')}</span>
      </div>
    </div>`;
        })
        .join('')
      : `
    <div class="item-block">
      <div class="col-left">Signs:</div>
      <div class="col-right">No sign details available for this order.</div>
    </div>`;

    const htmlContent = `
  <!DOCTYPE html>
  <html lang="uk">
  <head>
    <meta charset="UTF-8">
    <title>Delivery Note - SignXpert</title>
    <style>
      @page {
        size: A4;
        margin: 0;
      }
      body {
        margin: 0;
        padding: 0;
        font-family: 'Inter', Arial, sans-serif;
        font-size: 13px;
        color: #000;
        background-color: #f0f0f0;
      }
      .sheet {
        width: 210mm;
        min-height: 297mm;
        padding: 15mm 20mm;
        margin: 0 auto;
        background: white;
        box-sizing: border-box;
        position: relative;
      }
      .header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 40px;
      }
      .logo-section {
        display: flex;
        align-items: flex-start;
      }
      .logo-wrap svg {
        width: 279px;
        height: 71px;
        display: block;
      }
      .header-contacts {
        margin-left: 20px;
        font-size: 12px;
        line-height: 1.3;
        color: #000;
        padding-top: 2px;
      }
      .header-contacts a {
        color: #000;
        text-decoration: none;
      }
      .delivery-title {
        font-size: 30px;
        font-weight: 700;
        text-decoration: underline;
        margin-top: -5px;
      }
      .info-grid {
        display: flex;
        justify-content: space-between;
        gap: 24px;
        margin-bottom: 25px;
      }
      .order-meta table {
        border-collapse: collapse;
      }
      .order-meta td {
        padding: 2px 0;
        font-weight: 400;
        vertical-align: top;
      }
      .label {
        width: 130px;
      }
      .value {
        padding-left: 10px;
      }
      .shipping-address {
        width: 45%;
        line-height: 1.4;
        font-weight: 400;
        word-break: break-word;
      }
      .count-section {
        margin: 20px 0;
        font-size: 16px;
        font-weight: 400;
      }
      .item-block {
        display: flex;
        width: 100%;
        border: 1px solid #999;
        margin-bottom: 5px;
        break-inside: avoid;
      }
      .col-left {
        width: 25%;
        padding: 8px 10px;
        border-right: 1px solid #999;
        background-color: #fff;
        box-sizing: border-box;
      }
      .col-right {
        width: 75%;
        padding: 8px 10px;
        background-color: #fff;
        box-sizing: border-box;
      }
      .item-details {
        display: block;
        margin-top: 4px;
      }
      .footer-note {
        margin-top: 28px;
        text-align: center;
        font-size: 11px;
        line-height: 1.6;
      }
      .page-counter {
        margin-top: 16px;
        text-align: right;
        font-size: 12px;
      }
    </style>
  </head>
  <body>
  <div class="sheet">
    <div class="header">
      <div class="logo-section">
        <div class="logo-wrap">
          <svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M118.876 48.2327H2.61572V49.0689H118.876V48.2327Z" fill="#006CA4"/>
          <path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
          <path d="M18.4361 30.9402C18.4361 30.1671 18.1983 29.5044 17.7227 28.9522C17.2472 28.4 16.296 28.0055 14.8693 27.7531L11.4611 27.1062C8.7028 26.6013 6.62615 25.7651 5.23115 24.5975C3.83615 23.43 3.13865 21.7102 3.13865 19.4382C3.13865 17.75 3.56667 16.33 4.42269 15.1782C5.27871 14.0264 6.48348 13.1429 8.03701 12.5591C9.59053 11.9595 11.3977 11.6755 13.4585 11.6755C15.7095 11.6755 17.5642 11.9911 19.0068 12.6222C20.4493 13.2533 21.5431 14.1053 22.3199 15.2098C23.0808 16.3142 23.5564 17.5606 23.7625 18.9964L18.2459 19.6906C17.9288 18.4915 17.4216 17.5922 16.7399 17.04C16.0424 16.472 14.9327 16.188 13.3792 16.188C11.7306 16.188 10.5575 16.472 9.86002 17.0242C9.16252 17.5764 8.81377 18.2864 8.81377 19.1542C8.81377 20.022 9.08326 20.6846 9.60638 21.1422C10.1454 21.5998 11.0648 21.9626 12.4122 22.2309L15.979 22.9251C18.8641 23.4773 20.9566 24.3609 22.2723 25.5758C23.5881 26.7906 24.238 28.5104 24.238 30.7351C24.238 33.1649 23.3503 35.1371 21.5907 36.6044C19.8152 38.0875 17.1996 38.8291 13.7438 38.8291C10.4307 38.8291 7.81507 38.1349 5.89695 36.7306C3.97882 35.3264 2.90087 33.1806 2.66309 30.2618H4.56536H8.3382C8.56013 31.666 9.11496 32.6915 10.0344 33.3384C10.938 33.9853 12.2696 34.3166 14.0133 34.3166C15.6778 34.3166 16.8509 34.0011 17.5167 33.37C18.1032 32.7073 18.4361 31.9184 18.4361 30.9402Z" fill="#262626"/>
          <path d="M35.0652 12.3225H40.772V38.1507H35.0652V12.3225Z" fill="#262626"/>
          <path d="M51.7734 25.3075C51.7734 22.5622 52.249 20.164 53.216 18.1286C54.1671 16.0933 55.578 14.4998 57.4168 13.3795C59.2557 12.2435 61.4909 11.6755 64.1065 11.6755C67.1818 11.6755 69.6072 12.3855 71.3668 13.8213C73.1423 15.2571 74.252 17.2135 74.7117 19.6906L69.0366 20.306C68.7195 19.1069 68.1964 18.1602 67.4672 17.4818C66.738 16.8033 65.5966 16.472 64.0589 16.472C62.5371 16.472 61.3007 16.8506 60.3654 17.5922C59.4301 18.3338 58.7484 19.3593 58.3363 20.6689C57.9083 21.9784 57.7022 23.4773 57.7022 25.1971C57.7022 28.0213 58.257 30.1829 59.3667 31.7133C60.4763 33.228 62.2518 33.9853 64.6772 33.9853C66.6904 33.9853 68.3866 33.5593 69.7658 32.7231V28.4946H64.7089V23.9664H75.108V35.2475C73.7288 36.3993 72.0961 37.2829 70.2096 37.8824C68.3232 38.482 66.4051 38.7818 64.4711 38.7818C60.4288 38.7818 57.3059 37.5984 55.1024 35.2633C52.8831 32.9124 51.7734 29.5991 51.7734 25.3075Z" fill="#262626"/>
          <path d="M86.6011 12.3225H91.7214L102.548 29.2836V12.3225H107.922V38.1507H102.881L91.975 21.2212V38.1507H86.6011V12.3225Z" fill="#262626"/>
          <path d="M165.751 12.3225H175.088C177.577 12.3225 179.575 12.6696 181.049 13.3481C182.523 14.0423 183.585 15.0047 184.251 16.2354C184.901 17.4818 185.234 18.9492 185.234 20.6374C185.234 22.373 184.901 23.8876 184.235 25.1814C183.569 26.4752 182.491 27.4692 181.017 28.1792C179.543 28.8892 177.577 29.2521 175.136 29.2521H171.284V38.1507H165.767V12.3225H165.751ZM179.876 20.7163C179.876 19.391 179.543 18.4127 178.861 17.7974C178.18 17.1821 176.927 16.8823 175.088 16.8823H171.268V24.6923H175.12C176.991 24.6923 178.243 24.3452 178.893 23.6667C179.559 22.9725 179.876 21.9943 179.876 20.7163Z" fill="#262626"/>
          <path d="M195.442 12.3225H213.435V16.9138H201.086V22.657H212.721V27.2483H201.086V33.5436H214.164L213.577 38.135H195.442V12.3225Z" fill="#262626"/>
          <path d="M224.817 12.3225H234.598C237.039 12.3225 239.005 12.6538 240.463 13.3323C241.921 14.0107 242.984 14.9416 243.649 16.1407C244.299 17.3398 244.632 18.6967 244.632 20.2114C244.632 21.8523 244.299 23.2723 243.618 24.4714C242.936 25.6705 241.89 26.6487 240.495 27.3587L245.916 38.135H239.924L235.374 28.5894C235.184 28.5894 234.994 28.5894 234.788 28.6052C234.598 28.621 234.408 28.621 234.201 28.621H230.27V38.135H224.817V12.3225ZM239.1 20.385C239.1 19.1858 238.751 18.2707 238.054 17.6554C237.356 17.0401 236.072 16.7403 234.233 16.7403H230.27V24.2663H234.455C236.246 24.2663 237.467 23.935 238.133 23.2723C238.783 22.5938 239.1 21.6472 239.1 20.385Z" fill="#262626"/>
          <path d="M262.038 17.2767H254.112V12.3225H275.734V17.2767H267.776V38.1507H262.038V17.2767Z" fill="#262626"/>
          <path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
          <path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
          <path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
          </svg>
        </div>
        <div class="header-contacts">
          <a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          info@<a href="https://sign-xpert.com" target="_blank" rel="noopener noreferrer">sign-xpert.com</a><br>
          +49 157 766 25 125
        </div>
      </div>
      <div class="delivery-title">Delivery Note</div>
    </div>

    <div class="info-grid">
      <div class="order-meta">
        <table>
          <tr><td class="label">Order Date:</td><td class="value">${orderDate}</td></tr>
          <tr><td class="label">Customer No:</td><td class="value">${customerNumber}</td></tr>
          <tr><td class="label">Order No:</td><td class="value">${orderNumber}</td></tr>
          <tr><td class="label">Order name:</td><td class="value">${orderName}</td></tr>
          <tr><td class="label">Invoice No:</td><td class="value">${invoiceNumber}</td></tr>
        </table>
      </div>
      <div class="shipping-address">
        ${shippingAddressHtml || escapeHtml([order.user?.firstName, order.user?.surname].filter(hasContent).join(' ') || order.orderName || 'No delivery address')}
      </div>
    </div>

    <div class="count-section">
      Count Sings: &nbsp;&nbsp; ${totalSigns}
    </div>

    <div class="item-block">
      <div class="col-left">Accessories: ${escapeHtml(summary.accessories.length)} Types:</div>
      <div class="col-right">${accessoriesSummary}</div>
    </div>

    ${signBlocksHtml}

    <div class="footer-note">
      Please check the delivery upon receipt.<br>
      If any items are missing, damaged, or incorrect, please notify us by email at the address stated above.<br><br>
      <span style="font-weight: 700;">Thank you for choosing SignXpert!</span>
    </div>

    <div class="page-counter">Page 1 of 1</div>
  </div>
  </body>
  </html>`;

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' }
    });
    res.removeHeader('Content-Type');

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer, 'binary'); // Використовуємо .end з вказанням бінарного формату

  } catch (err) {
    console.error('error get pdfs', err);
    res.status(500).send('Error generating PDF');
  } finally {
    if (browser) await browser.close(); // Обов'язково закриваємо процес
  }
});


CartRouter.get('/getPdfs3/:idOrder', requireAuth, requireAdmin, async (req, res, next) => {
  let browser; // Оголошуємо зовні, щоб закрити у блоці finally
  try {
    const { idOrder } = req.params;
    
    // Твоя логіка пошуку даних
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{ model: User, include: [{model:Order}] }]
    });

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderMongo = await findCartProjectForOrder(order);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();

    const checkout = orderMongo?.checkout && typeof orderMongo.checkout === 'object'
      ? orderMongo.checkout
      : {};
    const deliveryAddress = checkout?.deliveryAddress && typeof checkout.deliveryAddress === 'object'
      ? checkout.deliveryAddress
      : {};
    const invoiceAddress = checkout?.invoiceAddress && typeof checkout.invoiceAddress === 'object'
      ? checkout.invoiceAddress
      : null;
    const customerAddress = hasAddressContent(invoiceAddress) ? invoiceAddress : deliveryAddress;

    const customerCompany = escapeHtml(
      customerAddress?.companyName || order.user?.company || 'Water Design Solution GmbH'
    );
    const customerName = escapeHtml(
      customerAddress?.fullName || [order.user?.firstName, order.user?.surname].filter(Boolean).join(' ')
    );
    const addressLine1 = escapeHtml(
      [customerAddress?.address1, customerAddress?.address2, customerAddress?.address3]
      .filter(hasContent)
      .join(', ')
    );
    const addressLine2 = escapeHtml(
      [customerAddress?.postalCode, customerAddress?.town].filter(hasContent).join(' ')
    );
    const countryLine = escapeHtml(customerAddress?.country || order.country || '');
    const phoneLine = escapeHtml(customerAddress?.mobile || order.user?.phone || '');
    const vatNumber = escapeHtml(checkout?.vatNumber || order.user?.vatNumber || '');

    const invoiceNumber = escapeHtml(order.id);
    const customerNumber = escapeHtml(order.userId);
    const invoiceDate = escapeHtml(formatInvoiceDate(order.createdAt));
    const invoiceDueDate = escapeHtml(formatInvoiceDate(new Date(new Date(order.createdAt).setMonth(new Date(order.createdAt).getMonth() + 1))));
    const projectName = escapeHtml(order.orderName || orderMongo?.projectName || 'Water Sings 23');
    const signsCount = escapeHtml(order.signs || 0);
    const deliveryLabel = escapeHtml(order?.deliveryType || checkout?.deliveryLabel || '');

    const netAmount = Number.isFinite(Number(order?.netAfterDiscount))
      ? Number(order.netAfterDiscount)
      : Number.isFinite(Number(orderMongo?.price))
        ? Number(orderMongo.price)
        : 0;
    const discountAmount = toNumber(orderMongo?.discountAmount, 0);
    const discountPercent = toNumber(orderMongo?.discountPercent, 0);
    const subtotal = round2(netAmount + discountAmount);
    const shippingCost = Number.isFinite(Number(checkout?.deliveryPrice))
      ? Number(checkout.deliveryPrice)
      : 0;
    const vatPercent = toNumber(checkout?.vatPercent, 0);
    const totalAmount = Number.isFinite(Number(order?.sum))
      ? Number(order.sum)
      : Number.isFinite(Number(orderMongo?.totalPrice))
        ? Number(orderMongo.totalPrice)
        : round2(netAmount + shippingCost);
    const vatAmount = Number.isFinite(Number(checkout?.vatAmount))
      ? Number(checkout.vatAmount)
      : Math.max(0, round2(totalAmount - netAmount - shippingCost));

    const taxNoteMarkup = vatPercent > 0
      ? ''
      : `
      <div class="tax-note">
        No VAT is charged according to § 19 UStG.
      </div>`;

    const vatIdMarkup = vatNumber ? `<br>VAT ID: ${vatNumber}` : '';

    const htmlContent=`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - SignXpert</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700;800&display=swap" rel="stylesheet">
    <style>
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
      }

        body {
        font-family: 'Inter', sans-serif;
            margin: 0;
        padding: 0;
        background-color: #f5f5f5;
            color: #000;
        font-size: 10.5pt;
            line-height: 1.2;
        }

      .page {
        width: 210mm;
        height: 297mm;
        padding: 15mm 20mm 15mm 20mm;
        margin: 10mm auto;
        background: white;
        box-shadow: 0 0 10px rgba(0,0,0,0.1);
        position: relative;
        display: flex;
        flex-direction: column;
      }

      @media print {
        body { background: none; }
        .page { margin: 0; box-shadow: none; }
        }

      .nowrap { white-space: nowrap; }

        .header {
            display: flex;
            justify-content: space-between;
        align-items: center;
        margin-bottom: 40px;
        }

      .logo {
        font-weight: 800;
        font-size: 22pt;
        letter-spacing: 0.5px;
        }
      .logo span { color: #0056b3; }
      .logo-sub {
        font-size: 7.5pt;
            display: block;
        margin-top: -4px;
      }
      .logo-sub span {
        background: #1a4a8d;
        color: white;
        padding: 0 4px;
        border-radius: 1px;
        }

        .invoice-title {
        font-size: 26pt;
        font-weight: 700;
            text-decoration: underline;
        text-underline-offset: 6px;
        }

      .info-section {
            display: flex;
        margin-bottom: 35px;
        }

      .address-block { width: 52%; line-height: 1.3; }

      .details-block {
        width: 48%;
        padding-left: 35px;
        }

      .details-table {
            border-collapse: collapse;
        }
      .details-table td {
        padding: 1px 0;
        vertical-align: top;
        font-weight: 400;
        }
      .details-table td:first-child { width: 140px; }
      .details-table tr:first-child td { font-weight: 700; }

      .items-table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 30px;
        }

      .items-table th,
      .items-table td {
        border: 0.5pt solid #000;
        padding: 4px 8px;
            text-align: left;
        }
      .items-table th { font-weight: 400; }
      .col-order { width: 12%; }
      .col-desc { width: 68%; }
      .col-total { width: 20%; }
      .items-table th.col-order { white-space: nowrap; }

      .calc-section {
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        margin-bottom: 25px;
        }

      .calc-table {
        width: 38%;
            border-collapse: collapse;
        }
      .calc-table td { padding: 2px 0; }
      .calc-table td:last-child { text-align: right; }
      .money-cell {
        white-space: nowrap;
        text-align: right;
      }
      .total-row {
        border-top: 1px solid #000;
        font-weight: 700;
        }

      .tax-note {
        font-size: 8.5pt;
        margin-top: 16px;
        text-align: left;
        width: 38%;
        align-self: flex-end;
        line-height: 1.1;
        }

      .payment-info { margin-top: 25px; }
      .payment-info h3 {
        font-size: 10.5pt;
        text-decoration: underline;
        margin-bottom: 5px;
        font-weight: 700;
        }
      .payment-grid { display: grid; grid-template-columns: 140px auto; gap: 1px; }

      .online-payment-note {
        margin-top: 15px;
        font-size: 11px;
        line-height: 1.25;
        }

      .svg-logo {
        display: inline-block;
        width: 78mm;
        max-width: 95mm;
        height: auto;
        }
      .svg-logo svg { width: 100%; height: auto; display:block; }

      .header .logo, .header .logo-sub { display: none; }
      .company-name { font-weight: 400; }
      .online-payment-note .first-line { white-space: nowrap; }
      .footer-col-right div { margin-bottom: 2px; }
      .footer-col-left div { margin-bottom: 4px; }

      .page-num {
        width: 100%;
        text-align: right;
        font-size: 8pt;
        margin-top: 4px;
        }
      .footer-wrapper {
        margin-top: auto;
        margin-bottom: 6mm;
        }
    </style>
</head>
<body>

  <div class="page">
    <div class="header">
      <div>
        <div class="svg-logo">
          <svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path d="M118.876 48.2324H2.61572V49.0686H118.876V48.2324Z" fill="#006CA4"/>
  <path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
  <path d="M18.4361 30.9404C18.4361 30.1673 18.1983 29.5047 17.7227 28.9524C17.2472 28.4002 16.296 28.0058 14.8693 27.7533L11.4611 27.1064C8.7028 26.6016 6.62615 25.7653 5.23115 24.5978C3.83615 23.4302 3.13865 21.7104 3.13865 19.4384C3.13865 17.7502 3.56667 16.3302 4.42269 15.1784C5.27871 14.0267 6.48348 13.1431 8.03701 12.5593C9.59053 11.9598 11.3977 11.6758 13.4585 11.6758C15.7095 11.6758 17.5642 11.9913 19.0068 12.6224C20.4493 13.2536 21.5431 14.1056 22.3199 15.21C23.0808 16.3144 23.5564 17.5609 23.7625 18.9967L18.2459 19.6909C17.9288 18.4918 17.4216 17.5924 16.7399 17.0402C16.0424 16.4722 14.9327 16.1882 13.3792 16.1882C11.7306 16.1882 10.5575 16.4722 9.86002 17.0244C9.16252 17.5767 8.81377 18.2867 8.81377 19.1544C8.81377 20.0222 9.08326 20.6849 9.60638 21.1424C10.1454 21.6 11.0648 21.9629 12.4122 22.2311L15.979 22.9253C18.8641 23.4776 20.9566 24.3611 22.2723 25.576C23.5881 26.7909 24.238 28.5107 24.238 30.7353C24.238 33.1651 23.3503 35.1373 21.5907 36.6047C19.8152 38.0878 17.1996 38.8293 13.7438 38.8293C10.4307 38.8293 7.81507 38.1351 5.89695 36.7309C3.97882 35.3267 2.90087 33.1809 2.66309 30.262H4.56536H8.3382C8.56013 31.6662 9.11496 32.6918 10.0344 33.3387C10.938 33.9856 12.2696 34.3169 14.0133 34.3169C15.6778 34.3169 16.8509 34.0013 17.5167 33.3702C18.1032 32.7076 18.4361 31.9187 18.4361 30.9404Z" fill="#262626"/>
  <path d="M35.0649 12.3228H40.7718V38.151H35.0649V12.3228Z" fill="#262626"/>
  <path d="M51.7734 25.3078C51.7734 22.5624 52.249 20.1642 53.216 18.1289C54.1671 16.0936 55.578 14.5 57.4168 13.3798C59.2557 12.2438 61.4909 11.6758 64.1065 11.6758C67.1818 11.6758 69.6072 12.3858 71.3668 13.8216C73.1423 15.2573 74.252 17.2138 74.7117 19.6909L69.0366 20.3062C68.7195 19.1071 68.1964 18.1604 67.4672 17.482C66.738 16.8036 65.5966 16.4722 64.0589 16.4722C62.5371 16.4722 61.3007 16.8509 60.3654 17.5924C59.4301 18.334 58.7484 19.3596 58.3363 20.6691C57.9083 21.9787 57.7022 23.4776 57.7022 25.1973C57.7022 28.0216 58.257 30.1831 59.3667 31.7136C60.4763 33.2282 62.2518 33.9856 64.6772 33.9856C66.6904 33.9856 68.3866 33.5596 69.7658 32.7233V28.4949H64.7089V23.9667H75.108V35.2478C73.7288 36.3996 72.0961 37.2831 70.2096 37.8827C68.3232 38.4822 66.4051 38.782 64.4711 38.782C60.4288 38.782 57.3059 37.5987 55.1024 35.2636C52.8831 32.9127 51.7734 29.5993 51.7734 25.3078Z" fill="#262626"/>
  <path d="M86.6011 12.3228H91.7214L102.548 29.2839V12.3228H107.922V38.151H102.881L91.975 21.2214V38.151H86.6011V12.3228Z" fill="#262626"/>
  <path d="M165.751 12.3228H175.088C177.577 12.3228 179.575 12.6699 181.049 13.3483C182.523 14.0425 183.585 15.005 184.251 16.2356C184.901 17.4821 185.234 18.9494 185.234 20.6376C185.234 22.3732 184.901 23.8879 184.235 25.1816C183.569 26.4754 182.491 27.4694 181.017 28.1794C179.543 28.8894 177.577 29.2523 175.136 29.2523H171.284V38.151H165.767V12.3228H165.751ZM179.876 20.7165C179.876 19.3912 179.543 18.413 178.861 17.7976C178.18 17.1823 176.927 16.8825 175.088 16.8825H171.268V24.6925H175.12C176.991 24.6925 178.243 24.3454 178.893 23.667C179.559 22.9728 179.876 21.9945 179.876 20.7165Z" fill="#262626"/>
  <path d="M195.442 12.3228H213.435V16.9141H201.086V22.6572H212.721V27.2485H201.086V33.5439H214.164L213.577 38.1352H195.442V12.3228Z" fill="#262626"/>
  <path d="M224.817 12.3228H234.598C237.039 12.3228 239.005 12.6541 240.463 13.3325C241.921 14.011 242.984 14.9419 243.649 16.141C244.299 17.3401 244.632 18.697 244.632 20.2116C244.632 21.8525 244.299 23.2725 243.618 24.4716C242.936 25.6708 241.89 26.649 240.495 27.359L245.916 38.1352H239.924L235.374 28.5896C235.184 28.5896 234.994 28.5896 234.788 28.6054C234.598 28.6212 234.408 28.6212 234.201 28.6212H230.27V38.1352H224.817V12.3228ZM239.1 20.3852C239.1 19.1861 238.751 18.271 238.054 17.6556C237.356 17.0403 236.072 16.7405 234.233 16.7405H230.27V24.2665H234.455C236.246 24.2665 237.467 23.9352 238.133 23.2725C238.783 22.5941 239.1 21.6474 239.1 20.3852Z" fill="#262626"/>
  <path d="M262.038 17.277H254.112V12.3228H275.734V17.277H267.776V38.151H262.038V17.277Z" fill="#262626"/>
  <path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
  <path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
  <path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
          </svg>
        </div>
        <div class="logo">SIGN<span>X</span>PERT</div>
        <div class="logo-sub">Smart <span>Sign & Label</span> Solution</div>
        </div>
        <div class="invoice-title">INVOICE</div>
    </div>

    <div class="info-section">
      <div class="address-block">
        <span class="company-name">${customerCompany}</span><br>
        ${customerName ? `${customerName}<br>` : ''}
        ${addressLine1 ? `${addressLine1}<br>` : ''}
        ${addressLine2 ? `${addressLine2}<br>` : ''}
        ${countryLine ? `${countryLine}<br>` : ''}
        ${phoneLine ? `Phone: ${phoneLine}` : ''}
        ${vatIdMarkup}
        </div>
      <div class="details-block">
        <table class="details-table">
          <tr><td><strong>Invoice No:</strong></td><td><strong>${invoiceNumber}</strong></td></tr>
          <tr><td>Customer No:</td><td>${customerNumber}</td></tr>
          <tr><td>Date:</td><td>${invoiceDate}</td></tr>
          <tr><td>Invoice due date:</td><td>${invoiceDueDate}</td></tr>
                <tr><td>Payment Terms:</td><td>30 days net</td></tr>
          <tr><td>Reference:</td><td>Order No: ${invoiceNumber}</td></tr>
            </table>
        </div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
          <th class="col-order nowrap">Order No</th>
          <th class="col-desc">Description</th>
          <th class="col-total">Net total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
          <td>${invoiceNumber}</td>
          <td>Count Signs:${signsCount} (${projectName})</td>
          <td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td>
            </tr>
        </tbody>
    </table>

    <div class="calc-section">
      <table class="calc-table">
        <tr><td>Subtotal</td><td class="money-cell">€&nbsp;${formatMoney(subtotal)}</td></tr>
        <tr><td>Discount (${discountPercent.toFixed(0)} %)</td><td class="money-cell">€&nbsp;${formatMoney(discountAmount)}</td></tr>
        <tr><td>Shipping & Packaging cost${deliveryLabel ? ` (${deliveryLabel})` : ''}</td><td class="money-cell">€&nbsp;${formatMoney(shippingCost)}</td></tr>
            <tr class="total-row">
          <td style="padding-top: 12px; padding-bottom: 6px;"><u>Total amount</u></td>
          <td class="money-cell" style="padding-top: 12px; padding-bottom: 6px;">€&nbsp;${formatMoney(totalAmount)}</td>
            </tr>
        </table>
      ${taxNoteMarkup}
    </div>

    <div class="payment-info">
      <h3><u>Payment information:</u></h3>
      <div class="payment-grid">
        <div>Amount due:</div><div class="money-cell">€&nbsp;${formatMoney(totalAmount)}</div>
        <div>Account holder:</div><div>SignXpert (Kostyantyn Utvenko)</div>
        <div>IBAN:</div><div>DE25 0101 0101 0101 0101 01</div>
        <div>BIC / SWIFT:</div><div>COBADEFFXXX</div>
        <div>Payment reference:</div><div>Order No: ${invoiceNumber}</div>
      </div>
    </div>

    <div class="online-payment-note">
      <span class="first-line">If you would like to pay by card or use any of the other online payment methods available, please visit: <span class="nowrap">sign-xpert.com</span></span><br>
      Log in to your account and go to: <span class="nowrap">My Account → My Orders</span><br>
      Select the relevant invoice and click “Pay” to complete your payment securely.
    </div>

    <div class="footer-wrapper">
      <div class="footer-thanks" style="text-align:center;margin-bottom:10px;font-weight:700;"><strong>Thank you for choosing SignXpert!</strong></div>
      <div class="footer-box" style="border:0.5pt solid #000;padding:6px 10px;display:flex;justify-content:space-between;font-size:8pt;line-height:1.05;">
        <div class="footer-col-left">
          <div><strong>SignXpert</strong></div>
          <div>Owner: Kostyantyn Utvenko</div>
          <div>Address: Baumwiesen 2, Haigerloch 72401, Germany</div>
          <div>IBAN: DE25 0101 0101 0101 0101 01</div>
          <div>BIC / SWIFT: COBADEFFXXX</div>
          <div>VAT: No VAT number – Kleinunternehmer §19 UStG, EU VAT on request.</div>
        </div>
        <div class="footer-col-right" style="text-align:right;display:flex;flex-direction:column;justify-content:flex-end;">
          <div>sign-xpert.com</div>
          <div>info@sign-xpert.com</div>
          <div>+49 157 766 25 125</div>
        </div>
        </div>
    </div>

    <div class="page-num">Page 1 of 1</div>
  </div>

</body>
</html>`

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({ 
      format: 'A4', 
      printBackground: true,
      margin: { top: '20px', right: '20px', bottom: '20px', left: '20px' }
    });
    res.removeHeader('Content-Type');

    res.writeHead(200, {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="order-${idOrder}.pdf"`,
      'Content-Length': pdfBuffer.length
    });

    return res.end(pdfBuffer, 'binary'); // Використовуємо .end з вказанням бінарного формату

  } catch (err) {
    console.error('error get pdfs', err);
    res.status(500).send('Error generating PDF');
  } finally {
    if (browser) await browser.close(); // Обов'язково закриваємо процес
  }
});

CartRouter.get('/getMyOrders', requireAuth, async (req,res, next)=>{
  try{
    const userId=req.user.id;

    const orders = await Order.findAll({
      where: { userId: Number(userId) },
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

    // IMPORTANT: Order is a Sequelize model instance. Adding a dynamic field (orders[i].orderMongo)
    // will NOT be serialized by res.json(). Convert to plain objects explicitly.
    const mapped = await Promise.all(
      (orders || []).map(async (order) => {
        const orderMongo = await findCartProjectForOrder(order);
        const computedSigns = countTotalSignsFromProject(orderMongo?.project);

        return {
          ...(typeof order?.toJSON === 'function' ? order.toJSON() : order),
          orderMongo,
          signs: computedSigns > 0 ? computedSigns : Number(order?.signs || 0),
        };
      })
    );

    return res.json({
      orders: mapped,
    });
  }catch(err){
    console.error('GET MY ORDERS ERROR:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
})

CartRouter.post('/setPay',requireAuth, requireAdmin, async(req,res,next)=>{
  try{
    const {orderId}=req.body;
    const order=await Order.findOne({where:{id:Number(orderId)}});
    order.isPaid=!order.isPaid;
    await order.save();
    return res.json({message:'is pay updated'});
  }catch(err){
    console.error('ERROR GET PAY:', err);
    return res.status(500).json({ message: 'Failed to load orders' });
  }
})


export default CartRouter;
