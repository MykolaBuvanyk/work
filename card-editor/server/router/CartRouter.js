import express from 'express';
import { requireAuth, requireAdmin } from '../middleware/authMiddleware.js';
import CartProject from '../models/CartProject.js';
import { Order, User } from '../models/models.js';
import { col, fn, Op } from 'sequelize';
import puppeteer from 'puppeteer';



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




const CartRouter = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

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
      status: 'pending',
    });


    const orderSigns = countProjectSigns(project);

  
    const user=await User.findOne({where:{id:req.user.id}});
    const fallbackCountry = String(user?.country || '').trim() || 'NO';
    const order=await Order.create({
      sum: Math.round(netAfterDiscount * 100) / 100,
      signs: orderSigns > 0 ? orderSigns : 1,
      userId,
      country:checkoutCountryRegion || checkoutCountryName || fallbackCountry,
      status:'Received',
      orderName:body.projectName,
      orderType:'',
      accessories:JSON.stringify(normalizedAccessories),
      idMongo: String(created._id)
    })

    const userOrders=await Order.findOne({where:{userId:req.user.id,status:'Deleted'}});
    if(userOrders){
      order.status='Deleted';
      await order.save();
    }
    

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

    let orders = await Order.findAndCountAll({
      offset,
      limit,
      where,
      order: [['createdAt', 'DESC']],
      include: [{ model: User }],
    });

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


    const baseOrders = Array.isArray(orders) ? orders : [];

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
  
          const fullOrder = details?.data?.order;
          const totalPrice = Number(fullOrder?.orderMongo?.totalPrice);

          return {
            ...order,
            orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            totalPrice: Number.isFinite(totalPrice) ? totalPrice : null,
            signs: resolveOrderSigns({
              ...order,
              orderMongo: fullOrder?.orderMongo || order?.orderMongo || null,
            }),
          };
        } catch {
          return {
            ...order,
            totalPrice: Number.isFinite(Number(order?.totalPrice)) ? Number(order.totalPrice) : null,
            signs: resolveOrderSigns(order),
          };
        }
      })
    );
    
    const total = order.reduce((acc, order) => {
        const value = Number(order?.totalPrice);
        return Number.isFinite(value) ? acc + value : acc;
      }, 0);

    const sum=total.toFixed(2)
    

    return res.json({ 
      orders: enrichedOrders,
      page,
      totalSum:sum,
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

    console.log(635545,order.user.phone)

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderMongo = await findCartProjectForOrder(order);

    console.log(4324);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();

    
    const htmlContent=`
    <!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #262626;
            font-size: 14px;
        }
        /* Шапка: Логотип та Інфо */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 50px;
        }
        .header-left svg {
            width: 250px; /* Регулюй під свій розмір */
            height: auto;
        }
        .header-center {
            font-size: 12px;
            line-height: 1.4;
            margin-left: 20px;
        }
        .header-right {
            text-align: right;
        }
        .delivery-note-title {
            font-size: 32px;
            font-weight: bold;
            text-decoration: underline;
            margin: 0;
        }

        /* Основна інформація */
        .main-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        .order-details table {
            border-collapse: collapse;
        }
        .order-details td {
            padding: 3px 10px 3px 0;
            vertical-align: top;
        }
        .order-details .label {
            font-weight: normal;
            width: 120px;
        }
        .order-details .value {
            font-weight: bold;
        }

        .customer-address {
            text-align: left;
            line-height: 1.5;
        }

        /* Таблиця з товарами */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
        }
        .items-table th, .items-table td {
            border: 1px solid #000;
            padding: 10px;
            text-align: left;
        }
        .items-table th {
            background-color: #f9f9f9;
        }
        .sign-row {
            height: 40px;
        }
        .label-cell {
            width: 150px;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="header">
            <div class="header-left">
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
                <path d="M7.70416 65.2568C7.08592 65.2568 6.54695 65.1463 6.08723 64.9412C5.62752 64.7361 5.26291 64.4521 4.99342 64.0892C4.72394 63.7263 4.58127 63.3003 4.54956 62.8112H5.43729C5.46899 63.1741 5.59581 63.4739 5.80189 63.7263C6.00797 63.9788 6.27746 64.1523 6.61036 64.2943C6.94325 64.4205 7.30786 64.4837 7.70416 64.4837C8.16388 64.4837 8.56019 64.4048 8.90894 64.2628C9.25769 64.105 9.52717 63.8999 9.73325 63.6317C9.93933 63.3634 10.0344 63.0479 10.0344 62.685C10.0344 62.3852 9.95519 62.1328 9.79666 61.9277C9.63814 61.7225 9.41621 61.549 9.13087 61.407C8.84553 61.265 8.51263 61.1388 8.13217 61.0283L7.05422 60.7128C6.34087 60.4761 5.77019 60.1921 5.37388 59.7977C4.97757 59.4032 4.78734 58.9457 4.78734 58.3777C4.78734 57.8885 4.91416 57.4468 5.18365 57.0839C5.45314 56.7052 5.80189 56.4212 6.26161 56.2003C6.72132 55.9952 7.22859 55.8848 7.78342 55.8848C8.35411 55.8848 8.86138 55.9952 9.30524 56.2003C9.74911 56.4054 10.0979 56.7052 10.3515 57.0681C10.6051 57.431 10.7478 57.8412 10.7637 58.3145H9.92348C9.87593 57.8097 9.65399 57.4152 9.25769 57.1154C8.86138 56.8157 8.36996 56.6737 7.76757 56.6737C7.35541 56.6737 6.97496 56.7525 6.65791 56.8945C6.34087 57.0365 6.08723 57.2417 5.91286 57.4941C5.73848 57.7465 5.64337 58.0305 5.64337 58.3619C5.64337 58.6774 5.73848 58.9299 5.91286 59.1508C6.08723 59.3717 6.32502 59.5294 6.5945 59.6714C6.87984 59.7661 7.14933 59.8765 7.45053 59.9554L8.40166 60.2237C8.70286 60.3025 8.9882 60.413 9.28939 60.5392C9.59058 60.6654 9.84422 60.8232 10.0979 61.0125C10.3356 61.2019 10.5259 61.4385 10.6844 61.7068C10.8271 61.975 10.9063 62.3063 10.9063 62.6692C10.9063 63.1583 10.7795 63.6001 10.5259 63.9788C10.2564 64.389 9.89178 64.6888 9.41621 64.9097C8.94064 65.1463 8.36996 65.2568 7.70416 65.2568Z" fill="#262626"/>
                <path d="M16.9619 65.099V58.283H17.7704V59.845H17.6753C17.7704 59.4663 17.9131 59.1507 18.135 58.8983C18.3411 58.6459 18.5947 58.4723 18.8642 58.3461C19.1495 58.2198 19.4349 58.1567 19.7202 58.1567C20.2275 58.1567 20.6396 58.3145 20.9567 58.6143C21.2896 58.9299 21.4957 59.3401 21.5749 59.8607H21.4481C21.5274 59.5136 21.67 59.1981 21.892 58.9456C22.0981 58.6932 22.3675 58.4881 22.6687 58.3619C22.9699 58.2199 23.3028 58.1567 23.6674 58.1567C24.0796 58.1567 24.4442 58.2514 24.7612 58.425C25.0783 58.5985 25.3319 58.8667 25.5221 59.2138C25.7124 59.561 25.8075 59.987 25.8075 60.5076V65.099H24.9832V60.5234C24.9832 59.9712 24.8405 59.5767 24.5393 59.3085C24.2381 59.0561 23.8894 58.9141 23.4613 58.9141C23.1284 58.9141 22.8431 58.9772 22.5895 59.1192C22.3358 59.2612 22.1456 59.4505 22.0029 59.703C21.8603 59.9554 21.7969 60.2552 21.7969 60.5865V65.0832H20.9725V60.4445C20.9725 59.9712 20.8299 59.5925 20.5604 59.3243C20.2909 59.0561 19.9263 58.9141 19.4983 58.9141C19.1971 58.9141 18.9117 58.993 18.6581 59.135C18.4045 59.277 18.1984 59.4821 18.0399 59.7503C17.8813 60.0185 17.8021 60.3341 17.8021 60.7127V65.099H16.9619Z" fill="#262626"/>
                <path d="M33.9397 65.2568C33.5276 65.2568 33.1471 65.1779 32.7984 65.0202C32.4496 64.8624 32.1801 64.6257 31.9899 64.3102C31.7838 63.9946 31.6887 63.6317 31.6887 63.1899C31.6887 62.8586 31.7521 62.5746 31.8789 62.3379C32.0058 62.1013 32.1801 61.9119 32.4179 61.7699C32.6557 61.6279 32.941 61.5017 33.2581 61.4228C33.5751 61.3439 33.9397 61.2651 34.3202 61.2177C34.7007 61.1704 35.0177 61.1231 35.2872 61.0915C35.5567 61.0599 35.7628 60.9968 35.8896 60.9179C36.0322 60.8391 36.0957 60.7128 36.0957 60.5393V60.3815C36.0957 60.0817 36.0322 59.8135 35.9054 59.5926C35.7786 59.3717 35.6042 59.1982 35.3664 59.0877C35.1287 58.9773 34.8433 58.9142 34.4946 58.9142C34.1775 58.9142 33.8922 58.9615 33.6385 59.0562C33.4008 59.1508 33.1947 59.2928 33.0362 59.4506C32.8776 59.6084 32.7508 59.7819 32.6716 59.9713L31.8789 59.7031C32.0375 59.3402 32.2436 59.0404 32.513 58.8195C32.7825 58.5986 33.0996 58.4251 33.4325 58.3304C33.7812 58.2199 34.13 58.1726 34.4787 58.1726C34.7482 58.1726 35.0336 58.2042 35.3189 58.2831C35.6042 58.3462 35.8737 58.4724 36.1115 58.6459C36.3493 58.8195 36.5554 59.0404 36.7139 59.3402C36.8724 59.6399 36.9358 60.0028 36.9358 60.4604V65.0991H36.1274V64.0262H36.0639C35.9688 64.2313 35.8262 64.4364 35.6359 64.6257C35.4457 64.8151 35.2079 64.9728 34.9226 65.0833C34.6372 65.1937 34.3043 65.2568 33.9397 65.2568ZM34.0507 64.5153C34.4629 64.5153 34.8275 64.4206 35.1287 64.2471C35.4299 64.0577 35.6676 63.8211 35.842 63.5055C36.0164 63.1899 36.0957 62.8586 36.0957 62.4799V61.5017C36.0322 61.5648 35.9371 61.6122 35.7945 61.6595C35.6518 61.7068 35.4933 61.7384 35.3189 61.7699C35.1445 61.8015 34.9543 61.8331 34.7799 61.8488C34.6055 61.8804 34.447 61.8962 34.3043 61.9119C33.9239 61.9593 33.591 62.0224 33.3215 62.1328C33.052 62.2275 32.8459 62.3695 32.7033 62.5431C32.5606 62.7166 32.4972 62.9375 32.4972 63.2057C32.4972 63.4739 32.5606 63.7106 32.7033 63.8999C32.8459 64.0893 33.0203 64.2313 33.2581 64.3417C33.4959 64.4522 33.7654 64.5153 34.0507 64.5153Z" fill="#262626"/>
                <path d="M43.2449 65.0991V58.2831H44.0533V59.3403H44.1167C44.2594 58.9931 44.4972 58.7091 44.8301 58.504C45.163 58.2989 45.5435 58.1885 45.9873 58.1885C46.0507 58.1885 46.13 58.1885 46.2092 58.1885C46.2885 58.1885 46.3519 58.1885 46.4153 58.2043V59.0405C46.3836 59.0405 46.3202 59.0247 46.2251 59.0089C46.13 58.9931 46.0349 58.9931 45.9239 58.9931C45.5752 58.9931 45.2581 59.072 44.9728 59.214C44.6874 59.356 44.4813 59.5611 44.3228 59.8294C44.1643 60.0818 44.085 60.3816 44.085 60.7287V65.0991H43.2449Z" fill="#262626"/>
                <path d="M54.2939 58.2831V59.0089H51.0283V58.2831H54.2939ZM52.0429 56.658H52.883V63.4897C52.883 63.8211 52.9623 64.0735 53.105 64.2313C53.2635 64.3891 53.4854 64.4522 53.8025 64.4206C53.8659 64.4206 53.9293 64.4206 54.0085 64.4048C54.0878 64.3891 54.1671 64.3733 54.2463 64.3575L54.4207 65.0675C54.3256 65.0991 54.2305 65.1148 54.1195 65.1306C54.0085 65.1464 53.8976 65.1622 53.7866 65.1622C53.2318 65.1937 52.8038 65.0675 52.5026 64.7677C52.2014 64.468 52.0429 64.0577 52.0429 63.5371V56.658Z" fill="#262626"/>
                <path d="M70.606 65.2569C69.9878 65.2569 69.4488 65.1464 68.9891 64.9413C68.5294 64.7362 68.1648 64.4522 67.8953 64.0893C67.6258 63.7264 67.4831 63.3004 67.4514 62.8113H68.3391C68.3709 63.1742 68.4977 63.474 68.7037 63.7264C68.9098 63.9789 69.1793 64.1524 69.5122 64.2944C69.8451 64.4206 70.2097 64.4837 70.606 64.4837C71.0657 64.4837 71.462 64.4049 71.8108 64.2629C72.1595 64.1051 72.429 63.9 72.6351 63.6317C72.8412 63.3635 72.9363 63.048 72.9363 62.6851C72.9363 62.3853 72.857 62.1329 72.6985 61.9277C72.54 61.7226 72.3181 61.5491 72.0327 61.4071C71.7474 61.2651 71.4145 61.1389 71.034 61.0284L69.9561 60.7129C69.2269 60.5077 68.672 60.208 68.2757 59.8293C67.8794 59.4506 67.6892 58.9615 67.6892 58.3935C67.6892 57.9044 67.816 57.4626 68.0855 57.0997C68.355 56.7211 68.7037 56.4371 69.1635 56.2162C69.6232 56.0111 70.1305 55.9006 70.6853 55.9006C71.256 55.9006 71.7632 56.0111 72.2071 56.2162C72.651 56.4213 72.9997 56.7211 73.2533 57.084C73.507 57.4469 73.6497 57.8571 73.6655 58.3304H72.8095C72.7619 57.8255 72.54 57.4311 72.1437 57.1313C71.7474 56.8315 71.256 56.6895 70.6536 56.6895C70.2414 56.6895 69.861 56.7684 69.5439 56.9104C69.2269 57.0524 68.9732 57.2575 68.7989 57.51C68.6245 57.7624 68.5294 58.0464 68.5294 58.3777C68.5294 58.6933 68.6245 58.9457 68.7989 59.1666C68.9732 59.3875 69.211 59.5453 69.4805 59.6873C69.7659 59.8293 70.0353 59.9397 70.3365 60.0186L71.2877 60.2869C71.5889 60.3657 71.8742 60.4762 72.1754 60.6024C72.4766 60.7286 72.7302 60.8864 72.9839 61.0757C73.2216 61.2651 73.4119 61.5017 73.5704 61.77C73.7131 62.0382 73.7923 62.3695 73.7923 62.7324C73.7923 63.2215 73.6655 63.6633 73.4119 64.042C73.1582 64.4364 72.7936 64.7362 72.3181 64.9571C71.8266 65.1464 71.256 65.2569 70.606 65.2569Z" fill="white"/>
                <path d="M80.2601 57.0208C80.1016 57.0208 79.9589 56.9577 79.8321 56.8473C79.7053 56.7368 79.6577 56.5948 79.6577 56.437C79.6577 56.2793 79.7211 56.1373 79.8321 56.0268C79.9589 55.9164 80.1016 55.8533 80.2601 55.8533C80.4345 55.8533 80.5771 55.9164 80.6881 56.0268C80.7991 56.1373 80.8625 56.2793 80.8625 56.437C80.8625 56.5948 80.7991 56.7368 80.6881 56.8473C80.5771 56.9577 80.4345 57.0208 80.2601 57.0208ZM79.8479 65.099V58.283H80.6881V65.099H79.8479Z" fill="white"/>
                <path d="M89.613 67.7971C89.1533 67.7971 88.7411 67.734 88.3765 67.6236C88.0278 67.4974 87.7266 67.3396 87.4888 67.1345C87.251 66.9294 87.0608 66.6927 86.9181 66.4245L87.5998 66.0143C87.6949 66.1878 87.8375 66.3614 87.9961 66.5191C88.1546 66.6769 88.3765 66.8189 88.6302 66.9136C88.8997 67.024 89.2167 67.0714 89.5972 67.0714C90.1995 67.0714 90.691 66.9294 91.0556 66.6296C91.4202 66.3298 91.6104 65.8723 91.6104 65.2411V63.7107H91.5311C91.436 63.9158 91.3092 64.1367 91.1348 64.3418C90.9605 64.5469 90.7385 64.7205 90.4532 64.8467C90.1678 64.9729 89.8349 65.036 89.4228 65.036C88.8838 65.036 88.3924 64.9098 87.9644 64.6416C87.5364 64.3734 87.2035 63.9947 86.9657 63.4898C86.7279 62.9849 86.6011 62.3854 86.6011 61.6911C86.6011 60.9969 86.712 60.3816 86.9498 59.8609C87.1876 59.3403 87.5205 58.93 87.9485 58.6303C88.3765 58.3305 88.8679 58.1885 89.4228 58.1885C89.8349 58.1885 90.1837 58.2674 90.469 58.4094C90.7544 58.5514 90.9763 58.7407 91.1348 58.9616C91.2933 59.1825 91.436 59.3876 91.5311 59.5927H91.6104V58.2831H92.4189V65.2727C92.4189 65.8565 92.292 66.3298 92.0543 66.7085C91.8165 67.0871 91.4677 67.3554 91.0397 67.5447C90.6593 67.7025 90.1678 67.7971 89.613 67.7971ZM89.5654 64.2787C90.0093 64.2787 90.3739 64.1683 90.691 63.9631C90.9922 63.758 91.2299 63.4583 91.4043 63.0638C91.5628 62.6694 91.6421 62.196 91.6421 61.6596C91.6421 61.1389 91.5628 60.6656 91.4043 60.2554C91.2458 59.8451 91.008 59.5296 90.7068 59.2929C90.4056 59.0563 90.0252 58.9458 89.5813 58.9458C89.1374 58.9458 88.757 59.072 88.4399 59.3087C88.1229 59.5454 87.901 59.8767 87.7266 60.2869C87.5681 60.6971 87.4888 61.1547 87.4888 61.6596C87.4888 62.1803 87.5681 62.6378 87.7266 63.0323C87.8851 63.4267 88.1229 63.7423 88.4399 63.9474C88.7411 64.1683 89.1216 64.2787 89.5654 64.2787Z" fill="white"/>
                <path d="M99.6156 60.8548V65.1148H98.7754V58.2988H99.5839V59.8923H99.457C99.6473 59.2928 99.9326 58.8668 100.345 58.5985C100.741 58.3303 101.201 58.2041 101.724 58.2041C102.184 58.2041 102.596 58.2988 102.945 58.4881C103.293 58.6774 103.563 58.9614 103.769 59.3401C103.959 59.7188 104.07 60.1605 104.07 60.7128V65.1305H103.246V60.7443C103.246 60.1921 103.087 59.7503 102.77 59.419C102.453 59.0877 102.041 58.9299 101.502 58.9299C101.137 58.9299 100.82 59.0088 100.535 59.1665C100.25 59.3243 100.028 59.5452 99.8533 59.8292C99.6948 60.1132 99.6156 60.4603 99.6156 60.8548Z" fill="white"/>
                <path d="M120.572 65.2253C120.018 65.2253 119.526 65.1149 119.098 64.894C118.67 64.6731 118.353 64.3733 118.115 64.0104C117.878 63.6475 117.767 63.2215 117.767 62.764C117.767 62.4011 117.83 62.0855 117.973 61.8173C118.115 61.5491 118.321 61.2809 118.591 61.0284C118.86 60.776 119.177 60.5235 119.558 60.2395L120.905 59.2455C121.08 59.1193 121.238 58.9773 121.381 58.8511C121.524 58.7249 121.65 58.5513 121.73 58.3777C121.825 58.2042 121.856 58.0149 121.856 57.794C121.856 57.4469 121.746 57.1629 121.524 56.9577C121.302 56.7526 121 56.6264 120.636 56.6264C120.382 56.6264 120.144 56.6737 119.954 56.7842C119.748 56.8946 119.59 57.0366 119.479 57.226C119.368 57.4153 119.304 57.6362 119.304 57.8886C119.304 58.1095 119.352 58.3304 119.447 58.5355C119.542 58.7406 119.685 58.9457 119.875 59.1824C120.065 59.4191 120.271 59.6715 120.509 59.9713L124.678 65.0991H123.679L120.033 60.6655C119.716 60.2869 119.447 59.9555 119.209 59.6557C118.971 59.3717 118.781 59.0877 118.654 58.8037C118.528 58.5197 118.464 58.22 118.464 57.9044C118.464 57.51 118.559 57.1629 118.734 56.8631C118.908 56.5633 119.162 56.3266 119.494 56.1531C119.812 55.9795 120.192 55.9006 120.604 55.9006C121.032 55.9006 121.397 55.9795 121.698 56.1531C122.015 56.3266 122.253 56.5475 122.427 56.8315C122.602 57.1155 122.681 57.4469 122.681 57.794C122.681 58.0622 122.633 58.3146 122.538 58.5355C122.443 58.7564 122.3 58.9931 122.11 59.1982C121.92 59.4033 121.698 59.6084 121.444 59.7977L119.78 61.0284C119.352 61.344 119.051 61.6437 118.876 61.912C118.702 62.1802 118.607 62.4642 118.607 62.764C118.607 63.0953 118.686 63.3793 118.845 63.6317C119.003 63.8842 119.241 64.0893 119.526 64.2313C119.812 64.3733 120.144 64.4522 120.509 64.4522C120.905 64.4522 121.27 64.3733 121.619 64.2313C121.967 64.0893 122.269 63.8684 122.538 63.5844C122.808 63.3004 123.014 62.9691 123.172 62.5904C123.331 62.196 123.426 61.77 123.458 61.2966L124.266 61.3124C124.25 61.8015 124.187 62.2117 124.06 62.5431C123.949 62.8902 123.806 63.1742 123.648 63.3951C123.489 63.616 123.347 63.8053 123.236 63.9473L123.061 64.1682C122.792 64.4837 122.427 64.7362 121.983 64.9255C121.539 65.1306 121.08 65.2253 120.572 65.2253Z" fill="white"/>
                <path d="M138.089 65.099V56.011H138.961V64.3259H143.304V65.099H138.089Z" fill="white"/>
                <path d="M151.041 65.2568C150.628 65.2568 150.248 65.1779 149.899 65.0202C149.55 64.8624 149.281 64.6257 149.091 64.3102C148.885 63.9946 148.79 63.6317 148.79 63.1899C148.79 62.8586 148.853 62.5746 148.98 62.3379C149.107 62.1013 149.281 61.9119 149.519 61.7699C149.757 61.6279 150.042 61.5017 150.359 61.4228C150.676 61.3439 151.041 61.2651 151.421 61.2177C151.801 61.1704 152.119 61.1231 152.388 61.0915C152.658 61.0599 152.864 60.9968 152.99 60.9179C153.133 60.8391 153.196 60.7128 153.196 60.5393V60.3815C153.196 60.0817 153.133 59.8135 153.006 59.5926C152.879 59.3717 152.705 59.1982 152.467 59.0877C152.229 58.9773 151.944 58.9142 151.595 58.9142C151.278 58.9142 150.993 58.9615 150.739 59.0562C150.502 59.1508 150.296 59.2928 150.137 59.4506C149.978 59.6084 149.852 59.7819 149.772 59.9713L148.98 59.7031C149.138 59.3402 149.344 59.0404 149.614 58.8195C149.883 58.5986 150.2 58.4251 150.533 58.3304C150.882 58.2199 151.231 58.1726 151.58 58.1726C151.849 58.1726 152.134 58.2042 152.42 58.2831C152.705 58.3462 152.975 58.4724 153.212 58.6459C153.45 58.8195 153.656 59.0404 153.815 59.3402C153.973 59.6399 154.037 60.0028 154.037 60.4604V65.0991H153.228V64.0262H153.165C153.07 64.2313 152.927 64.4364 152.737 64.6257C152.547 64.8151 152.309 64.9728 152.023 65.0833C151.738 65.1937 151.421 65.2568 151.041 65.2568ZM151.167 64.5153C151.58 64.5153 151.944 64.4206 152.245 64.2471C152.547 64.0577 152.784 63.8211 152.959 63.5055C153.133 63.1899 153.212 62.8586 153.212 62.4799V61.5017C153.149 61.5648 153.054 61.6122 152.911 61.6595C152.768 61.7068 152.61 61.7384 152.436 61.7699C152.261 61.8015 152.071 61.8331 151.897 61.8488C151.722 61.8804 151.564 61.8962 151.421 61.9119C151.041 61.9593 150.708 62.0224 150.438 62.1328C150.169 62.2275 149.963 62.3695 149.82 62.5431C149.677 62.7166 149.614 62.9375 149.614 63.2057C149.614 63.4739 149.677 63.7106 149.82 63.8999C149.963 64.0893 150.137 64.2313 150.375 64.3417C150.613 64.4522 150.866 64.5153 151.167 64.5153Z" fill="white"/>
                <path d="M163.358 65.241C162.945 65.241 162.613 65.1621 162.327 65.0201C162.042 64.8781 161.82 64.6888 161.646 64.4679C161.471 64.247 161.344 64.0261 161.249 63.821H161.154V65.099H160.346V56.011H161.186V59.5925H161.249C161.344 59.3874 161.471 59.1665 161.646 58.9614C161.82 58.7563 162.042 58.567 162.311 58.4092C162.581 58.2672 162.93 58.1883 163.358 58.1883C163.912 58.1883 164.404 58.3303 164.832 58.6301C165.26 58.9299 165.577 59.3401 165.815 59.8608C166.053 60.3814 166.163 61.0125 166.163 61.7068C166.163 62.4168 166.053 63.0321 165.815 63.5685C165.577 64.105 165.26 64.5152 164.832 64.815C164.404 65.1148 163.928 65.241 163.358 65.241ZM163.247 64.4994C163.691 64.4994 164.071 64.3732 164.388 64.1208C164.705 63.8683 164.927 63.537 165.101 63.111C165.26 62.685 165.339 62.2117 165.339 61.691C165.339 61.1703 165.26 60.697 165.101 60.2868C164.943 59.8765 164.705 59.5452 164.388 59.2928C164.071 59.0403 163.691 58.9299 163.247 58.9299C162.803 58.9299 162.422 59.0561 162.121 59.277C161.82 59.5137 161.582 59.845 161.424 60.2552C161.265 60.6654 161.186 61.1545 161.186 61.691C161.186 62.2274 161.265 62.7165 161.424 63.1425C161.582 63.5685 161.82 63.8999 162.137 64.1365C162.438 64.3732 162.819 64.4994 163.247 64.4994Z" fill="white"/>
                <path d="M174.914 65.2411C174.28 65.2411 173.725 65.0991 173.249 64.7993C172.774 64.4995 172.425 64.0893 172.171 63.5528C171.918 63.0164 171.791 62.4168 171.791 61.7226C171.791 61.0284 171.918 60.4288 172.171 59.8924C172.425 59.3559 172.774 58.9457 173.234 58.6302C173.693 58.3304 174.216 58.1726 174.803 58.1726C175.183 58.1726 175.548 58.2357 175.881 58.3777C176.23 58.5197 176.547 58.7248 176.816 58.9931C177.102 59.2771 177.308 59.6242 177.466 60.0502C177.625 60.4762 177.704 60.9811 177.704 61.5648V61.9277H172.33V61.2177H177.26L176.88 61.4859C176.88 60.9968 176.8 60.5551 176.626 60.1764C176.452 59.7819 176.214 59.4822 175.913 59.2613C175.596 59.0404 175.231 58.9299 174.787 58.9299C174.359 58.9299 173.979 59.0404 173.646 59.2771C173.313 59.5137 173.075 59.7977 172.885 60.1764C172.695 60.5551 172.615 60.9653 172.615 61.4071V61.8331C172.615 62.3695 172.71 62.8271 172.901 63.2373C173.091 63.6317 173.36 63.9473 173.693 64.1682C174.026 64.3891 174.438 64.4995 174.914 64.4995C175.231 64.4995 175.516 64.4522 175.754 64.3417C175.992 64.2471 176.198 64.1051 176.372 63.9315C176.547 63.7579 176.658 63.5844 176.737 63.3793L177.53 63.6317C177.419 63.9157 177.26 64.1839 177.022 64.4206C176.784 64.6731 176.499 64.8624 176.135 65.0044C175.786 65.1779 175.374 65.2411 174.914 65.2411Z" fill="white"/>
                <path d="M184.473 56.011V65.099H183.633V56.011H184.473Z" fill="white"/>
                <path d="M201.435 65.2569C200.816 65.2569 200.277 65.1464 199.802 64.9413C199.326 64.7362 198.978 64.4522 198.708 64.0893C198.439 63.7264 198.296 63.3004 198.264 62.8113H199.152C199.184 63.1742 199.31 63.474 199.516 63.7264C199.723 63.9789 199.992 64.1524 200.325 64.2944C200.658 64.4206 201.022 64.4837 201.419 64.4837C201.878 64.4837 202.275 64.4049 202.624 64.2629C202.972 64.1051 203.242 63.9 203.448 63.6317C203.654 63.3635 203.749 63.048 203.749 62.6851C203.749 62.3853 203.67 62.1329 203.511 61.9277C203.353 61.7226 203.131 61.5491 202.845 61.4071C202.56 61.2651 202.227 61.1389 201.847 61.0284L200.769 60.7129C200.04 60.5077 199.485 60.208 199.088 59.8293C198.692 59.4506 198.502 58.9615 198.502 58.3935C198.502 57.9044 198.629 57.4626 198.898 57.0997C199.168 56.7211 199.516 56.4371 199.976 56.2162C200.436 55.9953 200.943 55.9006 201.498 55.9006C202.069 55.9006 202.576 56.0111 203.02 56.2162C203.464 56.4213 203.812 56.7211 204.066 57.084C204.32 57.4469 204.462 57.8571 204.478 58.3304H203.622C203.575 57.8255 203.353 57.4311 202.956 57.1313C202.56 56.8315 202.069 56.6895 201.466 56.6895C201.054 56.6895 200.674 56.7684 200.357 56.9104C200.04 57.0524 199.786 57.2575 199.612 57.51C199.437 57.7624 199.342 58.0464 199.342 58.3777C199.342 58.6933 199.421 58.9457 199.612 59.1666C199.786 59.3717 200.024 59.5453 200.293 59.6873C200.563 59.8293 200.848 59.9397 201.149 60.0186L202.1 60.2869C202.402 60.3657 202.687 60.4762 202.988 60.6024C203.289 60.7286 203.543 60.8864 203.797 61.0757C204.034 61.2651 204.24 61.5017 204.383 61.77C204.526 62.0382 204.605 62.3695 204.605 62.7324C204.605 63.2215 204.478 63.6633 204.225 64.042C203.971 64.4364 203.606 64.7362 203.131 64.9571C202.671 65.1464 202.1 65.2569 201.435 65.2569Z" fill="#262626"/>
                <path d="M213.356 65.2411C212.753 65.2411 212.23 65.0991 211.786 64.7994C211.342 64.4996 210.978 64.0894 210.724 63.5529C210.471 63.0165 210.344 62.4169 210.344 61.7227C210.344 61.0285 210.471 60.4131 210.724 59.8767C210.978 59.3403 211.342 58.93 211.786 58.6303C212.23 58.3305 212.769 58.1885 213.356 58.1885C213.942 58.1885 214.465 58.3305 214.925 58.6303C215.385 58.93 215.734 59.3403 216.003 59.8767C216.272 60.4131 216.383 61.0285 216.383 61.7227C216.383 62.4169 216.257 63.0165 216.003 63.5529C215.749 64.0894 215.385 64.4996 214.941 64.7994C214.481 65.0991 213.958 65.2411 213.356 65.2411ZM213.356 64.4996C213.831 64.4996 214.228 64.3734 214.545 64.1209C214.877 63.8685 215.115 63.5371 215.29 63.1111C215.464 62.6851 215.543 62.2276 215.543 61.7227C215.543 61.2178 215.464 60.7445 215.29 60.3343C215.115 59.9083 214.862 59.5769 214.545 59.3245C214.212 59.072 213.815 58.9458 213.356 58.9458C212.896 58.9458 212.5 59.072 212.167 59.3245C211.834 59.5769 211.596 59.924 211.422 60.3343C211.247 60.7603 211.168 61.2178 211.168 61.7227C211.168 62.2276 211.247 62.6851 211.422 63.1111C211.596 63.5371 211.834 63.8685 212.167 64.1209C212.484 64.3734 212.88 64.4996 213.356 64.4996Z" fill="#262626"/>
                <path d="M223.184 56.011V65.099H222.344V56.011H223.184Z" fill="#262626"/>
                <path d="M231.839 65.1936C231.38 65.1936 230.967 65.099 230.619 64.9096C230.27 64.7203 229.985 64.4363 229.794 64.0576C229.588 63.679 229.493 63.2372 229.493 62.7007V58.283H230.333V62.6376C230.333 63.1899 230.492 63.6316 230.809 63.963C231.126 64.2943 231.538 64.4521 232.077 64.4521C232.442 64.4521 232.759 64.3732 233.044 64.2312C233.329 64.0892 233.551 63.8525 233.726 63.5685C233.9 63.2845 233.979 62.9374 233.979 62.5587V58.2987H234.82V65.1147H234.011V63.5212H234.138C233.948 64.1207 233.646 64.5625 233.25 64.815C232.854 65.0674 232.347 65.1936 231.839 65.1936Z" fill="#262626"/>
                <path d="M243.428 58.2831V59.0089H240.162V58.2831H243.428ZM241.177 56.658H242.017V63.4897C242.017 63.8211 242.096 64.0735 242.239 64.2313C242.381 64.3891 242.619 64.4522 242.936 64.4206C243 64.4206 243.063 64.4206 243.142 64.4048C243.222 64.3891 243.301 64.3733 243.38 64.3575L243.554 65.0675C243.459 65.0991 243.364 65.1148 243.253 65.1306C243.142 65.1464 243.031 65.1622 242.92 65.1622C242.381 65.1937 241.938 65.0675 241.636 64.7677C241.319 64.468 241.177 64.0577 241.177 63.5371V56.658Z" fill="#262626"/>
                <path d="M249.499 57.0208C249.34 57.0208 249.198 56.9577 249.071 56.8473C248.944 56.7368 248.896 56.5948 248.896 56.437C248.896 56.2793 248.96 56.1373 249.071 56.0268C249.198 55.9164 249.34 55.8533 249.499 55.8533C249.673 55.8533 249.816 55.9164 249.927 56.0268C250.038 56.1373 250.101 56.2793 250.101 56.437C250.101 56.5948 250.038 56.7368 249.927 56.8473C249.8 56.9577 249.657 57.0208 249.499 57.0208ZM249.071 65.099V58.283H249.911V65.099H249.071Z" fill="#262626"/>
                <path d="M258.899 65.2411C258.297 65.2411 257.774 65.0991 257.33 64.7994C256.886 64.4996 256.521 64.0894 256.268 63.5529C256.014 63.0165 255.887 62.4169 255.887 61.7227C255.887 61.0285 256.014 60.4131 256.268 59.8767C256.521 59.3403 256.886 58.93 257.33 58.6303C257.774 58.3305 258.313 58.1885 258.899 58.1885C259.486 58.1885 260.009 58.3305 260.469 58.6303C260.928 58.93 261.277 59.3403 261.531 59.8767C261.784 60.4131 261.911 61.0285 261.911 61.7227C261.911 62.4169 261.784 63.0165 261.531 63.5529C261.277 64.0894 260.912 64.4996 260.469 64.7994C260.009 65.0991 259.486 65.2411 258.899 65.2411ZM258.899 64.4996C259.375 64.4996 259.771 64.3734 260.088 64.1209C260.421 63.8685 260.659 63.5371 260.833 63.1111C261.007 62.6851 261.087 62.2276 261.087 61.7227C261.087 61.2178 261.007 60.7445 260.833 60.3343C260.659 59.924 260.405 59.5769 260.088 59.3245C259.755 59.072 259.359 58.9458 258.899 58.9458C258.439 58.9458 258.043 59.072 257.71 59.3245C257.377 59.5769 257.14 59.924 256.965 60.3343C256.791 60.7603 256.712 61.2178 256.712 61.7227C256.712 62.2276 256.791 62.6851 256.965 63.1111C257.14 63.5371 257.377 63.8685 257.71 64.1209C258.027 64.3734 258.424 64.4996 258.899 64.4996Z" fill="#262626"/>
                <path d="M268.712 60.8548V65.1148H267.872V58.2988H268.68V59.8923H268.553C268.743 59.2928 269.029 58.8668 269.441 58.5985C269.837 58.3303 270.297 58.2041 270.82 58.2041C271.28 58.2041 271.692 58.2988 272.041 58.4881C272.389 58.6774 272.659 58.9614 272.865 59.3401C273.055 59.7188 273.166 60.1605 273.166 60.7128V65.1305H272.342V60.7443C272.342 60.1921 272.183 59.7503 271.866 59.419C271.549 59.0877 271.137 58.9299 270.598 58.9299C270.234 58.9299 269.917 59.0088 269.631 59.1665C269.346 59.3243 269.124 59.5452 268.95 59.8292C268.791 60.1132 268.712 60.4603 268.712 60.8548Z" fill="#262626"/>
                </svg> 
            </div>
            <div class="header-center">
                sign-xpert.com<br>
                info@sign-xpert.com<br>
                +49 157 766 25 125
            </div>
            <div class="header-right">
                <h1 class="delivery-note-title">Delivery Note</h1>
            </div>
        </div>

        <div class="main-info">
            <div class="order-details">
                <table>
                    <tr><td class="label">Order Date:</td><td class="value">${new Date().toLocaleDateString()}</td></tr>
                    <tr><td class="label">Customer No:</td><td class="value">${order.userId}</td></tr>
                    <tr><td class="label">Order No:</td><td class="value">${order.id}</td></tr>
                    <tr><td class="label">Order name:</td><td class="value">Water Signs ${order.signs}</td></tr>
                    <tr><td class="label">Invoice No:</td><td class="value">${order.id}</td></tr>
                </table>
                <p style="margin-top: 20px;"><strong>Count Sings: ${order.signs}</strong></p>
            </div>
            <div class="customer-address">
                <strong>${order.orderName}</strong><br>
                ${order.user.firstName} ${order.user.surname}<br>
                ${order.user.address} ${order.user.house||''}<br>
                ${order.user.city} ${order.user.postcode}<br>
                ${order.user.country}<br>
                Phone: ${order.user.phone}
            </div>
        </div>

        <table class="items-table">
            <tr>
                <td class="label-cell">Accessories: ${orderMongo?.accessories?.length || 0} Types:</td>
                <td style="display: flex; flex-direction: row; gap: 5px; flex-wrap: wrap;">
                  ${orderMongo?.accessories 
                  ? orderMongo?.accessories.map(x => `<div>${x.qty} ${x.name};</div>`).join('') 
                  : ''}
                </td>
            </tr>
            ${''/*orderMongo.items.map((item, index) => `
                <tr class="sign-row">
                    <td class="label-cell">Sign ${index + 1}:</td>
                    <td>50 x 30 mm, White / Black No Tape, 2 Images, 1 Shape, 1 QR<br>
                        <small>Text: ${item.text || 'Be careful'}</small>
                    </td>
                </tr>
            `).join('')*/}
        </table>
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


CartRouter.get('/getPdfs3/:idOrder', requireAuth, requireAdmin, async (req, res, next) => {
  let browser; // Оголошуємо зовні, щоб закрити у блоці finally
  try {
    const { idOrder } = req.params;
    
    // Твоя логіка пошуку даних
    const order = await Order.findOne({
      where: { id: Number(idOrder) },
      include: [{ model: User, include: [{model:Order}] }]
    });

    console.log(635545,order.user.phone)

    if (!order) return res.status(404).json({ message: 'Order not found' });

    const orderMongo = await findCartProjectForOrder(order);

    console.log(4324);

    // Запускаємо Puppeteer
    browser = await puppeteer.launch({ 
      headless: "new",
      args: ['--no-sandbox', '--disable-setuid-sandbox'] // Важливо для Linux/VPS
    });
    const page = await browser.newPage();

    
    const htmlContent=`
<!DOCTYPE html>
<html lang="uk">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Invoice - SignXpert</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 40px;
            color: #000;
            line-height: 1.2;
            font-size: 14px;
        }
        .container {
            max-width: 800px;
            margin: auto;
        }
        /* Header Section */
        .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 50px;
        }
        .logo-area {
            font-size: 24px;
            font-weight: bold;
        }
        .logo-blue { color: #005696; }
        .logo-subtext {
            display: block;
            font-size: 10px;
            letter-spacing: 1px;
            margin-top: -5px;
        }
        .invoice-title {
            font-size: 32px;
            font-weight: bold;
            text-decoration: underline;
            text-underline-offset: 8px;
        }

        /* Customer and Details */
        .details-grid {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
        }
        .customer-info p, .invoice-info p {
            margin: 2px 0;
        }
        .invoice-info table {
            border-collapse: collapse;
        }
        .invoice-info td {
            padding-right: 20px;
            font-weight: bold;
        }
        .invoice-info td:last-child {
            font-weight: normal;
        }

        /* Main Table */
        .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 60px;
        }
        .items-table th {
            text-align: left;
            border: 1px solid #333;
            padding: 5px 10px;
            font-weight: normal;
        }
        .items-table td {
            border: 1px solid #333;
            padding: 8px 10px;
        }

        /* Totals */
        .totals-section {
            float: right;
            width: 300px;
            margin-bottom: 40px;
        }
        .totals-section table {
            width: 100%;
            border-collapse: collapse;
        }
        .totals-section td {
            padding: 3px 0;
        }
        .totals-section td:last-child {
            text-align: right;
        }
        .total-row {
            border-top: 1px solid #000;
            font-weight: bold;
        }

        /* Payment Info */
        .payment-info {
            clear: both;
            margin-bottom: 100px;
        }
        .payment-info h4 {
            text-decoration: underline;
            margin-bottom: 10px;
        }
        .payment-info table td {
            padding: 2px 0;
        }
        .payment-info td:first-child {
            width: 150px;
        }

        /* Footer */
        .footer-box {
            border: 1px solid #000;
            padding: 15px;
            font-size: 11px;
            display: flex;
            justify-content: space-between;
        }
        .footer-box p { margin: 2px 0; }
        .footer-right { text-align: right; }
        .thanks {
            text-align: center;
            margin-bottom: 15px;
            font-weight: normal;
        }
    </style>
</head>
<body>

<div class="container">
    <div class="header">
        <div class="logo-area">
            <svg width="279" height="71" viewBox="0 0 279 71" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M118.876 48.2327H2.61572V49.0689H118.876V48.2327Z" fill="#006CA4"/>
            <path d="M146.84 2.22474H275.735V1.4043H147.078L146.84 2.22474Z" fill="#006CA4"/>
            <path d="M18.4361 30.9402C18.4361 30.1671 18.1983 29.5044 17.7227 28.9522C17.2472 28.4 16.296 28.0055 14.8693 27.7531L11.4611 27.1062C8.7028 26.6013 6.62615 25.7651 5.23115 24.5975C3.83615 23.43 3.13865 21.7102 3.13865 19.4382C3.13865 17.75 3.56667 16.33 4.42269 15.1782C5.27871 14.0264 6.48348 13.1429 8.03701 12.5591C9.59053 11.9595 11.3977 11.6755 13.4585 11.6755C15.7095 11.6755 17.5642 11.9911 19.0068 12.6222C20.4493 13.2533 21.5431 14.1053 22.3199 15.2098C23.0808 16.3142 23.5564 17.5606 23.7625 18.9964L18.2459 19.6906C17.9288 18.4915 17.4216 17.5922 16.7399 17.04C16.0424 16.472 14.9327 16.188 13.3792 16.188C11.7306 16.188 10.5575 16.472 9.86002 17.0242C9.16252 17.5764 8.81377 18.2864 8.81377 19.1542C8.81377 20.022 9.08326 20.6846 9.60638 21.1422C10.1454 21.5998 11.0648 21.9626 12.4122 22.2309L15.979 22.9251C18.8641 23.4773 20.9566 24.3609 22.2723 25.5758C23.5881 26.7906 24.238 28.5104 24.238 30.7351C24.238 33.1649 23.3503 35.1371 21.5907 36.6044C19.8152 38.0875 17.1996 38.8291 13.7438 38.8291C10.4307 38.8291 7.81507 38.1349 5.89695 36.7306C3.97882 35.3264 2.90087 33.1806 2.66309 30.2618H4.56536H8.3382C8.56013 31.666 9.11496 32.6915 10.0344 33.3384C10.938 33.9853 12.2696 34.3166 14.0133 34.3166C15.6778 34.3166 16.8509 34.0011 17.5167 33.37C18.1032 32.7073 18.4361 31.9184 18.4361 30.9402Z" fill="#262626"/>
            <path d="M35.0649 12.3225H40.7718V38.1507H35.0649V12.3225Z" fill="#262626"/>
            <path d="M51.7734 25.3075C51.7734 22.5622 52.249 20.164 53.216 18.1286C54.1671 16.0933 55.578 14.4998 57.4168 13.3795C59.2557 12.2435 61.4909 11.6755 64.1065 11.6755C67.1818 11.6755 69.6072 12.3855 71.3668 13.8213C73.1423 15.2571 74.252 17.2135 74.7117 19.6906L69.0366 20.306C68.7195 19.1069 68.1964 18.1602 67.4672 17.4818C66.738 16.8033 65.5966 16.472 64.0589 16.472C62.5371 16.472 61.3007 16.8506 60.3654 17.5922C59.4301 18.3338 58.7484 19.3593 58.3363 20.6689C57.9083 21.9784 57.7022 23.4773 57.7022 25.1971C57.7022 28.0213 58.257 30.1829 59.3667 31.7133C60.4763 33.228 62.2518 33.9853 64.6772 33.9853C66.6904 33.9853 68.3866 33.5593 69.7658 32.7231V28.4946H64.7089V23.9664H75.108V35.2475C73.7288 36.3993 72.0961 37.2829 70.2096 37.8824C68.3232 38.482 66.4051 38.7818 64.4711 38.7818C60.4288 38.7818 57.3059 37.5984 55.1024 35.2633C52.8831 32.9124 51.7734 29.5991 51.7734 25.3075Z" fill="#262626"/>
            <path d="M86.6011 12.3225H91.7214L102.548 29.2836V12.3225H107.922V38.1507H102.881L91.975 21.2212V38.1507H86.6011V12.3225Z" fill="#262626"/>
            <path d="M165.751 12.3225H175.088C177.577 12.3225 179.575 12.6696 181.049 13.3481C182.523 14.0423 183.585 15.0047 184.251 16.2354C184.901 17.4818 185.234 18.9492 185.234 20.6374C185.234 22.373 184.901 23.8876 184.235 25.1814C183.569 26.4752 182.491 27.4692 181.017 28.1792C179.543 28.8892 177.577 29.2521 175.136 29.2521H171.284V38.1507H165.767V12.3225H165.751ZM179.876 20.7163C179.876 19.391 179.543 18.4127 178.861 17.7974C178.18 17.1821 176.927 16.8823 175.088 16.8823H171.268V24.6923H175.12C176.991 24.6923 178.243 24.3452 178.893 23.6667C179.559 22.9725 179.876 21.9943 179.876 20.7163Z" fill="#262626"/>
            <path d="M195.442 12.3225H213.435V16.9138H201.086V22.657H212.721V27.2483H201.086V33.5436H214.164L213.577 38.135H195.442V12.3225Z" fill="#262626"/>
            <path d="M224.817 12.3225H234.598C237.039 12.3225 239.005 12.6538 240.463 13.3323C241.921 14.0107 242.984 14.9416 243.649 16.1407C244.299 17.3398 244.632 18.6967 244.632 20.2114C244.632 21.8523 244.299 23.2723 243.618 24.4714C242.936 25.6705 241.89 26.6487 240.495 27.3587L245.916 38.135H239.924L235.374 28.5894C235.184 28.5894 234.994 28.5894 234.788 28.6052C234.598 28.621 234.408 28.621 234.201 28.621H230.27V38.135H224.817V12.3225ZM239.1 20.385C239.1 19.1858 238.751 18.2707 238.054 17.6554C237.356 17.0401 236.072 16.7403 234.233 16.7403H230.27V24.2663H234.455C236.246 24.2663 237.467 23.935 238.133 23.2723C238.783 22.5938 239.1 21.6472 239.1 20.385Z" fill="#262626"/>
            <path d="M262.038 17.2767H254.112V12.3225H275.734V17.2767H267.776V38.1507H262.038V17.2767Z" fill="#262626"/>
            <path d="M140.515 24.4714L135.727 31.4136L123.553 49.069H113.978L130.94 24.4714L122.903 12.8116L119.748 8.23607H129.323L132.478 12.8116L135.727 17.5292L140.515 24.4714ZM137.392 33.8119L140.863 38.8607H150.438L142.179 26.8696L137.392 33.8119ZM156.415 1.4043H146.84L137.376 15.131L142.163 22.0732L156.415 1.4043Z" fill="#006CA4"/>
            <path d="M37.9028 8.17296L34.1617 1.4043L30.5474 5.68008L37.9028 8.17296Z" fill="#006CA4"/>
            <path d="M186.708 69.4222H66.9282C62.3628 69.4222 58.6533 65.7302 58.6533 61.1862C58.6533 56.6422 62.3628 52.9502 66.9282 52.9502H186.708C191.273 52.9502 194.983 56.6422 194.983 61.1862C194.983 65.7302 191.273 69.4222 186.708 69.4222Z" fill="#006CA4"/>
            <path d="M7.70441 65.2568C7.08617 65.2568 6.54719 65.1463 6.08748 64.9412C5.62776 64.7361 5.26316 64.4521 4.99367 64.0892C4.72418 63.7263 4.58151 63.3003 4.5498 62.8112H5.43753C5.46924 63.1741 5.59606 63.4739 5.80213 63.7263C6.00821 63.9788 6.2777 64.1523 6.6106 64.2943C6.9435 64.4205 7.3081 64.4837 7.70441 64.4837C8.16412 64.4837 8.56043 64.4048 8.90918 64.2628C9.25793 64.105 9.52742 63.8999 9.7335 63.6317C9.93958 63.3634 10.0347 63.0479 10.0347 62.685C10.0347 62.3852 9.95543 62.1328 9.79691 61.9277C9.63838 61.7225 9.41645 61.549 9.13111 61.407C8.84577 61.265 8.51287 61.1388 8.13242 61.0283L7.05446 60.7128C6.34111 60.4761 5.77043 60.1921 5.37412 59.7977C4.97782 59.4032 4.78759 58.9457 4.78759 58.3777C4.78759 57.8885 4.91441 57.4468 5.1839 57.0839C5.45338 56.7052 5.80213 56.4212 6.26185 56.2003C6.72157 55.9952 7.22884 55.8848 7.78367 55.8848C8.35435 55.8848 8.86162 55.9952 9.30549 56.2003C9.74935 56.4054 10.0981 56.7052 10.3517 57.0681C10.6054 57.431 10.748 57.8412 10.7639 58.3145H9.92373C9.87617 57.8097 9.65424 57.4152 9.25793 57.1154C8.86162 56.8157 8.3702 56.6737 7.76782 56.6737C7.35566 56.6737 6.9752 56.7525 6.65816 56.8945C6.34111 57.0365 6.08748 57.2417 5.9131 57.4941C5.73873 57.7465 5.64361 58.0305 5.64361 58.3619C5.64361 58.6774 5.73873 58.9299 5.9131 59.1508C6.08748 59.3717 6.32526 59.5294 6.59475 59.6714C6.88009 59.7661 7.14958 59.8765 7.45077 59.9554L8.40191 60.2237C8.7031 60.3025 8.98844 60.413 9.28963 60.5392C9.59083 60.6654 9.84446 60.8232 10.0981 61.0125C10.3359 61.2019 10.5261 61.4385 10.6846 61.7068C10.8273 61.975 10.9066 62.3063 10.9066 62.6692C10.9066 63.1583 10.7797 63.6001 10.5261 63.9788C10.2566 64.389 9.89202 64.6888 9.41645 64.9097C8.94088 65.1463 8.3702 65.2568 7.70441 65.2568Z" fill="#262626"/>
            <path d="M16.9619 65.099V58.283H17.7704V59.845H17.6753C17.7704 59.4663 17.9131 59.1507 18.135 58.8983C18.3411 58.6459 18.5947 58.4723 18.8642 58.3461C19.1495 58.2198 19.4349 58.1567 19.7202 58.1567C20.2275 58.1567 20.6396 58.3145 20.9567 58.6143C21.2896 58.9299 21.4957 59.3401 21.5749 59.8607H21.4481C21.5274 59.5136 21.67 59.1981 21.892 58.9456C22.0981 58.6932 22.3675 58.4881 22.6687 58.3619C22.9699 58.2199 23.3028 58.1567 23.6674 58.1567C24.0796 58.1567 24.4442 58.2514 24.7612 58.425C25.0783 58.5985 25.3319 58.8667 25.5221 59.2138C25.7124 59.561 25.8075 59.987 25.8075 60.5076V65.099H24.9832V60.5234C24.9832 59.9712 24.8405 59.5767 24.5393 59.3085C24.2381 59.0561 23.8894 58.9141 23.4613 58.9141C23.1284 58.9141 22.8431 58.9772 22.5895 59.1192C22.3358 59.2612 22.1456 59.4505 22.0029 59.703C21.8603 59.9554 21.7969 60.2552 21.7969 60.5865V65.0832H20.9725V60.4445C20.9725 59.9712 20.8299 59.5925 20.5604 59.3243C20.2909 59.0561 19.9263 58.9141 19.4983 58.9141C19.1971 58.9141 18.9117 58.993 18.6581 59.135C18.4045 59.277 18.1984 59.4821 18.0399 59.7503C17.8813 60.0185 17.8021 60.3341 17.8021 60.7127V65.099H16.9619Z" fill="#262626"/>
            <path d="M33.94 65.2568C33.5278 65.2568 33.1474 65.1779 32.7986 65.0202C32.4499 64.8624 32.1804 64.6257 31.9902 64.3102C31.7841 63.9946 31.689 63.6317 31.689 63.1899C31.689 62.8586 31.7524 62.5746 31.8792 62.3379C32.006 62.1013 32.1804 61.9119 32.4182 61.7699C32.656 61.6279 32.9413 61.5017 33.2583 61.4228C33.5754 61.3439 33.94 61.2651 34.3204 61.2177C34.7009 61.1704 35.0179 61.1231 35.2874 61.0915C35.5569 61.0599 35.763 60.9968 35.8898 60.9179C36.0325 60.8391 36.0959 60.7128 36.0959 60.5393V60.3815C36.0959 60.0817 36.0325 59.8135 35.9057 59.5926C35.7789 59.3717 35.6045 59.1982 35.3667 59.0877C35.1289 58.9773 34.8436 58.9142 34.4948 58.9142C34.1778 58.9142 33.8924 58.9615 33.6388 59.0562C33.401 59.1508 33.1949 59.2928 33.0364 59.4506C32.8779 59.6084 32.7511 59.7819 32.6718 59.9713L31.8792 59.7031C32.0377 59.3402 32.2438 59.0404 32.5133 58.8195C32.7828 58.5986 33.0998 58.4251 33.4327 58.3304C33.7815 58.2199 34.1302 58.1726 34.479 58.1726C34.7485 58.1726 35.0338 58.2042 35.3191 58.2831C35.6045 58.3462 35.874 58.4724 36.1118 58.6459C36.3495 58.8195 36.5556 59.0404 36.7141 59.3402C36.8727 59.6399 36.9361 60.0028 36.9361 60.4604V65.0991H36.1276V64.0262H36.0642C35.9691 64.2313 35.8264 64.4364 35.6362 64.6257C35.446 64.8151 35.2082 64.9728 34.9228 65.0833C34.6375 65.1937 34.3046 65.2568 33.94 65.2568ZM34.051 64.5153C34.4631 64.5153 34.8277 64.4206 35.1289 64.2471C35.4301 64.0577 35.6679 63.8211 35.8423 63.5055C36.0166 63.1899 36.0959 62.8586 36.0959 62.4799V61.5017C36.0325 61.5648 35.9374 61.6122 35.7947 61.6595C35.652 61.7068 35.4935 61.7384 35.3191 61.7699C35.1448 61.8015 34.9545 61.8331 34.7802 61.8488C34.6058 61.8804 34.4473 61.8962 34.3046 61.9119C33.9241 61.9593 33.5912 62.0224 33.3218 62.1328C33.0523 62.2275 32.8462 62.3695 32.7035 62.5431C32.5608 62.7166 32.4974 62.9375 32.4974 63.2057C32.4974 63.4739 32.5608 63.7106 32.7035 63.8999C32.8462 64.0893 33.0206 64.2313 33.2583 64.3417C33.4961 64.4522 33.7656 64.5153 34.051 64.5153Z" fill="#262626"/>
            <path d="M43.2451 65.0991V58.2831H44.0536V59.3403H44.117C44.2597 58.9931 44.4974 58.7091 44.8303 58.504C45.1632 58.2989 45.5437 58.1885 45.9876 58.1885C46.051 58.1885 46.1302 58.1885 46.2095 58.1885C46.2888 58.1885 46.3522 58.1885 46.4156 58.2043V59.0405C46.3839 59.0405 46.3205 59.0247 46.2253 59.0089C46.1302 58.9931 46.0351 58.9931 45.9241 58.9931C45.5754 58.9931 45.2584 59.072 44.973 59.214C44.6877 59.356 44.4816 59.5611 44.3231 59.8294C44.1645 60.0818 44.0853 60.3816 44.0853 60.7287V65.0991H43.2451Z" fill="#262626"/>
            <path d="M54.2944 58.2831V59.0089H51.0288V58.2831H54.2944ZM52.0434 56.658H52.8835V63.4897C52.8835 63.8211 52.9628 64.0735 53.1055 64.2313C53.264 64.3891 53.4859 64.4522 53.803 64.4206C53.8664 64.4206 53.9298 64.4206 54.009 64.4048C54.0883 64.3891 54.1676 64.3733 54.2468 64.3575L54.4212 65.0675C54.3261 65.0991 54.231 65.1148 54.12 65.1306C54.009 65.1464 53.8981 65.1622 53.7871 65.1622C53.2323 65.1937 52.8043 65.0675 52.5031 64.7677C52.2019 64.468 52.0434 64.0577 52.0434 63.5371V56.658Z" fill="#262626"/>
            <path d="M70.6063 65.2569C69.988 65.2569 69.449 65.1464 68.9893 64.9413C68.5296 64.7362 68.165 64.4522 67.8955 64.0893C67.626 63.7264 67.4834 63.3004 67.4517 62.8113H68.3394C68.3711 63.1742 68.4979 63.474 68.704 63.7264C68.9101 63.9789 69.1796 64.1524 69.5125 64.2944C69.8454 64.4206 70.21 64.4837 70.6063 64.4837C71.066 64.4837 71.4623 64.4049 71.811 64.2629C72.1598 64.1051 72.4293 63.9 72.6354 63.6317C72.8414 63.3635 72.9365 63.048 72.9365 62.6851C72.9365 62.3853 72.8573 62.1329 72.6988 61.9277C72.5402 61.7226 72.3183 61.5491 72.033 61.4071C71.7476 61.2651 71.4147 61.1389 71.0343 61.0284L69.9563 60.7129C69.2271 60.5077 68.6723 60.208 68.276 59.8293C67.8797 59.4506 67.6894 58.9615 67.6894 58.3935C67.6894 57.9044 67.8163 57.4626 68.0858 57.0997C68.3552 56.7211 68.704 56.4371 69.1637 56.2162C69.6234 56.0111 70.1307 55.9006 70.6855 55.9006C71.2562 55.9006 71.7635 56.0111 72.2073 56.2162C72.6512 56.4213 73 56.7211 73.2536 57.084C73.5072 57.4469 73.6499 57.8571 73.6658 58.3304H72.8097C72.7622 57.8255 72.5402 57.4311 72.1439 57.1313C71.7476 56.8315 71.2562 56.6895 70.6538 56.6895C70.2417 56.6895 69.8612 56.7684 69.5442 56.9104C69.2271 57.0524 68.9735 57.2575 68.7991 57.51C68.6247 57.7624 68.5296 58.0464 68.5296 58.3777C68.5296 58.6933 68.6247 58.9457 68.7991 59.1666C68.9735 59.3875 69.2113 59.5453 69.4808 59.6873C69.7661 59.8293 70.0356 59.9397 70.3368 60.0186L71.2879 60.2869C71.5891 60.3657 71.8744 60.4762 72.1756 60.6024C72.4768 60.7286 72.7305 60.8864 72.9841 61.0757C73.2219 61.2651 73.4121 61.5017 73.5706 61.77C73.7133 62.0382 73.7926 62.3695 73.7926 62.7324C73.7926 63.2215 73.6658 63.6633 73.4121 64.042C73.1585 64.4364 72.7939 64.7362 72.3183 64.9571C71.8269 65.1464 71.2562 65.2569 70.6063 65.2569Z" fill="white"/>
            <path d="M80.2601 57.0208C80.1016 57.0208 79.9589 56.9577 79.8321 56.8473C79.7053 56.7368 79.6577 56.5948 79.6577 56.437C79.6577 56.2793 79.7211 56.1373 79.8321 56.0268C79.9589 55.9164 80.1016 55.8533 80.2601 55.8533C80.4345 55.8533 80.5771 55.9164 80.6881 56.0268C80.7991 56.1373 80.8625 56.2793 80.8625 56.437C80.8625 56.5948 80.7991 56.7368 80.6881 56.8473C80.5771 56.9577 80.4345 57.0208 80.2601 57.0208ZM79.8479 65.099V58.283H80.6881V65.099H79.8479Z" fill="white"/>
            <path d="M89.613 67.7971C89.1533 67.7971 88.7411 67.734 88.3765 67.6236C88.0278 67.4974 87.7266 67.3396 87.4888 67.1345C87.251 66.9294 87.0608 66.6927 86.9181 66.4245L87.5998 66.0143C87.6949 66.1878 87.8375 66.3614 87.9961 66.5191C88.1546 66.6769 88.3765 66.8189 88.6302 66.9136C88.8997 67.024 89.2167 67.0714 89.5972 67.0714C90.1995 67.0714 90.691 66.9294 91.0556 66.6296C91.4202 66.3298 91.6104 65.8723 91.6104 65.2411V63.7107H91.5311C91.436 63.9158 91.3092 64.1367 91.1348 64.3418C90.9605 64.5469 90.7385 64.7205 90.4532 64.8467C90.1678 64.9729 89.8349 65.036 89.4228 65.036C88.8838 65.036 88.3924 64.9098 87.9644 64.6416C87.5364 64.3734 87.2035 63.9947 86.9657 63.4898C86.7279 62.9849 86.6011 62.3854 86.6011 61.6911C86.6011 60.9969 86.712 60.3816 86.9498 59.8609C87.1876 59.3403 87.5205 58.93 87.9485 58.6303C88.3765 58.3305 88.8679 58.1885 89.4228 58.1885C89.8349 58.1885 90.1837 58.2674 90.469 58.4094C90.7544 58.5514 90.9763 58.7407 91.1348 58.9616C91.2933 59.1825 91.436 59.3876 91.5311 59.5927H91.6104V58.2831H92.4189V65.2727C92.4189 65.8565 92.292 66.3298 92.0543 66.7085C91.8165 67.0871 91.4677 67.3554 91.0397 67.5447C90.6593 67.7025 90.1678 67.7971 89.613 67.7971ZM89.5654 64.2787C90.0093 64.2787 90.3739 64.1683 90.691 63.9631C90.9922 63.758 91.2299 63.4583 91.4043 63.0638C91.5628 62.6694 91.6421 62.196 91.6421 61.6596C91.6421 61.1389 91.5628 60.6656 91.4043 60.2554C91.2458 59.8451 91.008 59.5296 90.7068 59.2929C90.4056 59.0563 90.0252 58.9458 89.5813 58.9458C89.1374 58.9458 88.757 59.072 88.4399 59.3087C88.1229 59.5454 87.901 59.8767 87.7266 60.2869C87.5681 60.6971 87.4888 61.1547 87.4888 61.6596C87.4888 62.1803 87.5681 62.6378 87.7266 63.0323C87.8851 63.4267 88.1229 63.7423 88.4399 63.9474C88.7411 64.1683 89.1216 64.2787 89.5654 64.2787Z" fill="white"/>
            <path d="M99.616 60.8548V65.1148H98.7759V58.2988H99.5843V59.8923H99.4575C99.6478 59.2928 99.9331 58.8668 100.345 58.5985C100.742 58.3303 101.201 58.2041 101.724 58.2041C102.184 58.2041 102.596 58.2988 102.945 58.4881C103.294 58.6774 103.563 58.9614 103.769 59.3401C103.96 59.7188 104.071 60.1605 104.071 60.7128V65.1305H103.246V60.7443C103.246 60.1921 103.088 59.7503 102.771 59.419C102.454 59.0877 102.041 58.9299 101.502 58.9299C101.138 58.9299 100.821 59.0088 100.535 59.1665C100.25 59.3243 100.028 59.5452 99.8538 59.8292C99.6953 60.1132 99.616 60.4603 99.616 60.8548Z" fill="white"/>
            <path d="M120.572 65.2253C120.018 65.2253 119.526 65.1149 119.098 64.894C118.67 64.6731 118.353 64.3733 118.115 64.0104C117.878 63.6475 117.767 63.2215 117.767 62.764C117.767 62.4011 117.83 62.0855 117.973 61.8173C118.115 61.5491 118.321 61.2809 118.591 61.0284C118.86 60.776 119.177 60.5235 119.558 60.2395L120.905 59.2455C121.08 59.1193 121.238 58.9773 121.381 58.8511C121.524 58.7249 121.65 58.5513 121.73 58.3777C121.825 58.2042 121.856 58.0149 121.856 57.794C121.856 57.4469 121.746 57.1629 121.524 56.9577C121.302 56.7526 121 56.6264 120.636 56.6264C120.382 56.6264 120.144 56.6737 119.954 56.7842C119.748 56.8946 119.59 57.0366 119.479 57.226C119.368 57.4153 119.304 57.6362 119.304 57.8886C119.304 58.1095 119.352 58.3304 119.447 58.5355C119.542 58.7406 119.685 58.9457 119.875 59.1824C120.065 59.4191 120.271 59.6715 120.509 59.9713L124.678 65.0991H123.679L120.033 60.6655C119.716 60.2869 119.447 59.9555 119.209 59.6557C118.971 59.3717 118.781 59.0877 118.654 58.8037C118.528 58.5197 118.464 58.22 118.464 57.9044C118.464 57.51 118.559 57.1629 118.734 56.8631C118.908 56.5633 119.162 56.3266 119.494 56.1531C119.812 55.9795 120.192 55.9006 120.604 55.9006C121.032 55.9006 121.397 55.9795 121.698 56.1531C122.015 56.3266 122.253 56.5475 122.427 56.8315C122.602 57.1155 122.681 57.4469 122.681 57.794C122.681 58.0622 122.633 58.3146 122.538 58.5355C122.443 58.7564 122.3 58.9931 122.11 59.1982C121.92 59.4033 121.698 59.6084 121.444 59.7977L119.78 61.0284C119.352 61.344 119.051 61.6437 118.876 61.912C118.702 62.1802 118.607 62.4642 118.607 62.764C118.607 63.0953 118.686 63.3793 118.845 63.6317C119.003 63.8842 119.241 64.0893 119.526 64.2313C119.812 64.3733 120.144 64.4522 120.509 64.4522C120.905 64.4522 121.27 64.3733 121.619 64.2313C121.967 64.0893 122.269 63.8684 122.538 63.5844C122.808 63.3004 123.014 62.9691 123.172 62.5904C123.331 62.196 123.426 61.77 123.458 61.2966L124.266 61.3124C124.25 61.8015 124.187 62.2117 124.06 62.5431C123.949 62.8902 123.806 63.1742 123.648 63.3951C123.489 63.616 123.347 63.8053 123.236 63.9473L123.061 64.1682C122.792 64.4837 122.427 64.7362 121.983 64.9255C121.539 65.1306 121.08 65.2253 120.572 65.2253Z" fill="white"/>
            <path d="M138.089 65.099V56.011H138.961V64.3259H143.305V65.099H138.089Z" fill="white"/>
            <path d="M151.041 65.2568C150.628 65.2568 150.248 65.1779 149.899 65.0202C149.55 64.8624 149.281 64.6257 149.091 64.3102C148.885 63.9946 148.79 63.6317 148.79 63.1899C148.79 62.8586 148.853 62.5746 148.98 62.3379C149.107 62.1013 149.281 61.9119 149.519 61.7699C149.757 61.6279 150.042 61.5017 150.359 61.4228C150.676 61.3439 151.041 61.2651 151.421 61.2177C151.801 61.1704 152.119 61.1231 152.388 61.0915C152.658 61.0599 152.864 60.9968 152.99 60.9179C153.133 60.8391 153.196 60.7128 153.196 60.5393V60.3815C153.196 60.0817 153.133 59.8135 153.006 59.5926C152.879 59.3717 152.705 59.1982 152.467 59.0877C152.229 58.9773 151.944 58.9142 151.595 58.9142C151.278 58.9142 150.993 58.9615 150.739 59.0562C150.502 59.1508 150.296 59.2928 150.137 59.4506C149.978 59.6084 149.852 59.7819 149.772 59.9713L148.98 59.7031C149.138 59.3402 149.344 59.0404 149.614 58.8195C149.883 58.5986 150.2 58.4251 150.533 58.3304C150.882 58.2199 151.231 58.1726 151.58 58.1726C151.849 58.1726 152.134 58.2042 152.42 58.2831C152.705 58.3462 152.975 58.4724 153.212 58.6459C153.45 58.8195 153.656 59.0404 153.815 59.3402C153.973 59.6399 154.037 60.0028 154.037 60.4604V65.0991H153.228V64.0262H153.165C153.07 64.2313 152.927 64.4364 152.737 64.6257C152.547 64.8151 152.309 64.9728 152.023 65.0833C151.738 65.1937 151.421 65.2568 151.041 65.2568ZM151.167 64.5153C151.58 64.5153 151.944 64.4206 152.245 64.2471C152.547 64.0577 152.784 63.8211 152.959 63.5055C153.133 63.1899 153.212 62.8586 153.212 62.4799V61.5017C153.149 61.5648 153.054 61.6122 152.911 61.6595C152.768 61.7068 152.61 61.7384 152.436 61.7699C152.261 61.8015 152.071 61.8331 151.897 61.8488C151.722 61.8804 151.564 61.8962 151.421 61.9119C151.041 61.9593 150.708 62.0224 150.438 62.1328C150.169 62.2275 149.963 62.3695 149.82 62.5431C149.677 62.7166 149.614 62.9375 149.614 63.2057C149.614 63.4739 149.677 63.7106 149.82 63.8999C149.963 64.0893 150.137 64.2313 150.375 64.3417C150.613 64.4522 150.866 64.5153 151.167 64.5153Z" fill="white"/>
            <path d="M163.358 65.241C162.945 65.241 162.613 65.1621 162.327 65.0201C162.042 64.8781 161.82 64.6888 161.646 64.4679C161.471 64.247 161.344 64.0261 161.249 63.821H161.154V65.099H160.346V56.011H161.186V59.5925H161.249C161.344 59.3874 161.471 59.1665 161.646 58.9614C161.82 58.7563 162.042 58.567 162.311 58.4092C162.581 58.2672 162.93 58.1883 163.358 58.1883C163.912 58.1883 164.404 58.3303 164.832 58.6301C165.26 58.9299 165.577 59.3401 165.815 59.8608C166.053 60.3814 166.163 61.0125 166.163 61.7068C166.163 62.4168 166.053 63.0321 165.815 63.5685C165.577 64.105 165.26 64.5152 164.832 64.815C164.404 65.1148 163.928 65.241 163.358 65.241ZM163.247 64.4994C163.691 64.4994 164.071 64.3732 164.388 64.1208C164.705 63.8683 164.927 63.537 165.101 63.111C165.26 62.685 165.339 62.2117 165.339 61.691C165.339 61.1703 165.26 60.697 165.101 60.2868C164.943 59.8765 164.705 59.5452 164.388 59.2928C164.071 59.0403 163.691 58.9299 163.247 58.9299C162.803 58.9299 162.422 59.0561 162.121 59.277C161.82 59.5137 161.582 59.845 161.424 60.2552C161.265 60.6654 161.186 61.1545 161.186 61.691C161.186 62.2274 161.265 62.7165 161.424 63.1425C161.582 63.5685 161.82 63.8999 162.137 64.1365C162.438 64.3732 162.819 64.4994 163.247 64.4994Z" fill="white"/>
            <path d="M174.914 65.2411C174.28 65.2411 173.725 65.0991 173.25 64.7993C172.774 64.4995 172.426 64.0893 172.172 63.5528C171.918 63.0164 171.792 62.4168 171.792 61.7226C171.792 61.0284 171.918 60.4288 172.172 59.8924C172.426 59.3559 172.774 58.9457 173.234 58.6302C173.694 58.3304 174.217 58.1726 174.803 58.1726C175.184 58.1726 175.548 58.2357 175.881 58.3777C176.23 58.5197 176.547 58.7248 176.817 58.9931C177.102 59.2771 177.308 59.6242 177.467 60.0502C177.625 60.4762 177.704 60.9811 177.704 61.5648V61.9277H172.33V61.2177H177.261L176.88 61.4859C176.88 60.9968 176.801 60.5551 176.626 60.1764C176.452 59.7819 176.214 59.4822 175.913 59.2613C175.596 59.0404 175.231 58.9299 174.788 58.9299C174.36 58.9299 173.979 59.0404 173.646 59.2771C173.313 59.5137 173.076 59.7977 172.885 60.1764C172.695 60.5551 172.616 60.9653 172.616 61.4071V61.8331C172.616 62.3695 172.711 62.8271 172.901 63.2373C173.091 63.6317 173.361 63.9473 173.694 64.1682C174.027 64.3891 174.439 64.4995 174.914 64.4995C175.231 64.4995 175.517 64.4522 175.755 64.3417C175.992 64.2471 176.198 64.1051 176.373 63.9315C176.547 63.7579 176.658 63.5844 176.737 63.3793L177.53 63.6317C177.419 63.9157 177.261 64.1839 177.023 64.4206C176.785 64.6731 176.5 64.8624 176.135 65.0044C175.786 65.1779 175.374 65.2411 174.914 65.2411Z" fill="white"/>
            <path d="M184.473 56.011V65.099H183.633V56.011H184.473Z" fill="white"/>
            <path d="M201.435 65.2569C200.817 65.2569 200.278 65.1464 199.802 64.9413C199.327 64.7362 198.978 64.4522 198.709 64.0893C198.439 63.7264 198.296 63.3004 198.265 62.8113H199.152C199.184 63.1742 199.311 63.474 199.517 63.7264C199.723 63.9789 199.993 64.1524 200.325 64.2944C200.658 64.4206 201.023 64.4837 201.419 64.4837C201.879 64.4837 202.275 64.4049 202.624 64.2629C202.973 64.1051 203.242 63.9 203.448 63.6317C203.654 63.3635 203.75 63.048 203.75 62.6851C203.75 62.3853 203.67 62.1329 203.512 61.9277C203.353 61.7226 203.131 61.5491 202.846 61.4071C202.561 61.2651 202.228 61.1389 201.847 61.0284L200.769 60.7129C200.04 60.5077 199.485 60.208 199.089 59.8293C198.693 59.4506 198.502 58.9615 198.502 58.3935C198.502 57.9044 198.629 57.4626 198.899 57.0997C199.168 56.7211 199.517 56.4371 199.977 56.2162C200.436 55.9953 200.944 55.9006 201.499 55.9006C202.069 55.9006 202.576 56.0111 203.02 56.2162C203.464 56.4213 203.813 56.7211 204.067 57.084C204.32 57.4469 204.463 57.8571 204.479 58.3304H203.623C203.575 57.8255 203.353 57.4311 202.957 57.1313C202.561 56.8315 202.069 56.6895 201.467 56.6895C201.055 56.6895 200.674 56.7684 200.357 56.9104C200.04 57.0524 199.786 57.2575 199.612 57.51C199.438 57.7624 199.343 58.0464 199.343 58.3777C199.343 58.6933 199.422 58.9457 199.612 59.1666C199.786 59.3717 200.024 59.5453 200.294 59.6873C200.563 59.8293 200.849 59.9397 201.15 60.0186L202.101 60.2869C202.402 60.3657 202.687 60.4762 202.989 60.6024C203.29 60.7286 203.543 60.8864 203.797 61.0757C204.035 61.2651 204.241 61.5017 204.384 61.77C204.526 62.0382 204.606 62.3695 204.606 62.7324C204.606 63.2215 204.479 63.6633 204.225 64.042C203.971 64.4364 203.607 64.7362 203.131 64.9571C202.672 65.1464 202.101 65.2569 201.435 65.2569Z" fill="#262626"/>
            <path d="M213.356 65.2411C212.754 65.2411 212.231 65.0991 211.787 64.7994C211.343 64.4996 210.978 64.0894 210.725 63.5529C210.471 63.0165 210.344 62.4169 210.344 61.7227C210.344 61.0285 210.471 60.4131 210.725 59.8767C210.978 59.3403 211.343 58.93 211.787 58.6303C212.231 58.3305 212.77 58.1885 213.356 58.1885C213.943 58.1885 214.466 58.3305 214.926 58.6303C215.385 58.93 215.734 59.3403 216.003 59.8767C216.273 60.4131 216.384 61.0285 216.384 61.7227C216.384 62.4169 216.257 63.0165 216.003 63.5529C215.75 64.0894 215.385 64.4996 214.941 64.7994C214.482 65.0991 213.959 65.2411 213.356 65.2411ZM213.356 64.4996C213.832 64.4996 214.228 64.3734 214.545 64.1209C214.878 63.8685 215.116 63.5371 215.29 63.1111C215.465 62.6851 215.544 62.2276 215.544 61.7227C215.544 61.2178 215.465 60.7445 215.29 60.3343C215.116 59.9083 214.862 59.5769 214.545 59.3245C214.212 59.072 213.816 58.9458 213.356 58.9458C212.896 58.9458 212.5 59.072 212.167 59.3245C211.834 59.5769 211.597 59.924 211.422 60.3343C211.248 60.7603 211.169 61.2178 211.169 61.7227C211.169 62.2276 211.248 62.6851 211.422 63.1111C211.597 63.5371 211.834 63.8685 212.167 64.1209C212.484 64.3734 212.881 64.4996 213.356 64.4996Z" fill="#262626"/>
            <path d="M223.184 56.011V65.099H222.344V56.011H223.184Z" fill="#262626"/>
            <path d="M231.84 65.1936C231.38 65.1936 230.968 65.099 230.619 64.9096C230.27 64.7203 229.985 64.4363 229.795 64.0576C229.589 63.679 229.494 63.2372 229.494 62.7007V58.283H230.334V62.6376C230.334 63.1899 230.492 63.6316 230.809 63.963C231.126 64.2943 231.539 64.4521 232.078 64.4521C232.442 64.4521 232.759 64.3732 233.045 64.2312C233.33 64.0892 233.552 63.8525 233.726 63.5685C233.901 63.2845 233.98 62.9374 233.98 62.5587V58.2987H234.82V65.1147H234.012V63.5212H234.138C233.948 64.1207 233.647 64.5625 233.251 64.815C232.854 65.0674 232.347 65.1936 231.84 65.1936Z" fill="#262626"/>
            <path d="M243.428 58.2831V59.0089H240.162V58.2831H243.428ZM241.177 56.658H242.017V63.4897C242.017 63.8211 242.096 64.0735 242.239 64.2313C242.381 64.3891 242.619 64.4522 242.936 64.4206C243 64.4206 243.063 64.4206 243.142 64.4048C243.222 64.3891 243.301 64.3733 243.38 64.3575L243.554 65.0675C243.459 65.0991 243.364 65.1148 243.253 65.1306C243.142 65.1464 243.031 65.1622 242.92 65.1622C242.381 65.1937 241.938 65.0675 241.636 64.7677C241.319 64.468 241.177 64.0577 241.177 63.5371V56.658Z" fill="#262626"/>
            <path d="M249.499 57.0208C249.341 57.0208 249.198 56.9577 249.071 56.8473C248.945 56.7368 248.897 56.5948 248.897 56.437C248.897 56.2793 248.96 56.1373 249.071 56.0268C249.198 55.9164 249.341 55.8533 249.499 55.8533C249.674 55.8533 249.816 55.9164 249.927 56.0268C250.038 56.1373 250.102 56.2793 250.102 56.437C250.102 56.5948 250.038 56.7368 249.927 56.8473C249.801 56.9577 249.658 57.0208 249.499 57.0208ZM249.071 65.099V58.283H249.912V65.099H249.071Z" fill="#262626"/>
            <path d="M258.9 65.2411C258.297 65.2411 257.774 65.0991 257.33 64.7994C256.886 64.4996 256.522 64.0894 256.268 63.5529C256.015 63.0165 255.888 62.4169 255.888 61.7227C255.888 61.0285 256.015 60.4131 256.268 59.8767C256.522 59.3403 256.886 58.93 257.33 58.6303C257.774 58.3305 258.313 58.1885 258.9 58.1885C259.486 58.1885 260.009 58.3305 260.469 58.6303C260.929 58.93 261.277 59.3403 261.531 59.8767C261.785 60.4131 261.912 61.0285 261.912 61.7227C261.912 62.4169 261.785 63.0165 261.531 63.5529C261.277 64.0894 260.913 64.4996 260.469 64.7994C260.009 65.0991 259.486 65.2411 258.9 65.2411ZM258.9 64.4996C259.375 64.4996 259.772 64.3734 260.089 64.1209C260.421 63.8685 260.659 63.5371 260.834 63.1111C261.008 62.6851 261.087 62.2276 261.087 61.7227C261.087 61.2178 261.008 60.7445 260.834 60.3343C260.659 59.924 260.406 59.5769 260.089 59.3245C259.756 59.072 259.359 58.9458 258.9 58.9458C258.44 58.9458 258.044 59.072 257.711 59.3245C257.378 59.5769 257.14 59.924 256.966 60.3343C256.791 60.7603 256.712 61.2178 256.712 61.7227C256.712 62.2276 256.791 62.6851 256.966 63.1111C257.14 63.5371 257.378 63.8685 257.711 64.1209C258.028 64.3734 258.424 64.4996 258.9 64.4996Z" fill="#262626"/>
            <path d="M268.712 60.8548V65.1148H267.872V58.2988H268.681V59.8923H268.554C268.744 59.2928 269.029 58.8668 269.441 58.5985C269.838 58.3303 270.297 58.2041 270.821 58.2041C271.28 58.2041 271.692 58.2988 272.041 58.4881C272.39 58.6774 272.659 58.9614 272.866 59.3401C273.056 59.7188 273.167 60.1605 273.167 60.7128V65.1305H272.342V60.7443C272.342 60.1921 272.184 59.7503 271.867 59.419C271.55 59.0877 271.138 58.9299 270.599 58.9299C270.234 58.9299 269.917 59.0088 269.632 59.1665C269.346 59.3243 269.124 59.5452 268.95 59.8292C268.792 60.1132 268.712 60.4603 268.712 60.8548Z" fill="#262626"/>
            </svg>
        </div>
        <div class="invoice-title">INVOICE</div>
    </div>

    <div class="details-grid">
        <div class="customer-info">
            <p><strong>Water Design Solution GmbH</strong></p>
            <p>${order.user.firstName} ${order.user.surname}</p>
            <p>${order.address} ${order.house||''}</p>
            <p>${order.postcode} ${order.city}</p>
            <p>${order.country}</p>
            <p>Phone: ${order.user.phone}</p>
        </div>
        <div class="invoice-info">
            <table>
                <tr><td>Invoice No:</td><td>${order.id}</td></tr>
                <tr><td>Customer No:</td><td>${order.userId}</td></tr>
                <tr><td>Date:</td><td>${formatDate(order.createdAt)}</td></tr>
                <tr><td>Invoice due date:</td><td>${formatDatePlusMonth(order.createdAt)}</td></tr>
                <tr><td>Payment Terms:</td><td>30 days net</td></tr>
                <tr><td>Reference:</td><td>Order No: ${order.id}</td></tr>
            </table>
        </div>
    </div>

    <table class="items-table">
        <thead>
            <tr>
                <th style="width: 15%;">Order No</th>
                <th style="width: 65%;">Description</th>
                <th style="width: 20%;">Net total</th>
            </tr>
        </thead>
        <tbody>
            <tr>
                <td>${order.id}</td>
                <td>Count Signs:${order.signs} (Water Sings 23)</td>
                <td>€ ${order.sum}</td>
            </tr>
        </tbody>
    </table>

    <div class="totals-section">
        <table>
            <tr>
                <td>Subtotal</td>
                <td>€ ${order.sum}</td>
            </tr>
            <tr>
                <td>Discount (5 %)</td>
                <td>€ ${orderMongo?.discountPercent||0}</td>
            </tr>
            <tr>
                <td>Shipping & Packaging cost</td>
                <td></td>
            </tr>
            <tr>
                <td>VAT 19%</td>
                <td>€</td>
            </tr>
            <tr class="total-row">
                <td style="padding-top: 10px;">Total amount</td>
                <td style="padding-top: 10px;">€ ${order.sum}</td>
            </tr>
        </table>
    </div>

    <div class="payment-info">
        <h4>Payment information:</h4>
        <table>
            <tr><td>Amount due:</td><td>€ ${order.sum}</td></tr>
            <tr><td>Account holder:</td><td>SignXpert (Kostyantyn Utvenko)</td></tr>
            <tr><td>IBAN:</td><td>DE25 0101 0101 0101 0101 01</td></tr>
            <tr><td>BIC / SWIFT:</td><td>COBADEFFXXX</td></tr>
            <tr><td>Payment reference:</td><td>Order No: ${order.id}</td></tr>
        </table>
    </div>

    <p class="thanks">Thank you for choosing SignXpert!</p>

    <div class="footer-box">
        <div class="footer-left">
            <p><strong>SignXpert</strong></p>
            <p>Owner: Kostyantyn Utvenko</p>
            <p>Address: Baumwiesen 2, Haigerloch 72401, Germany</p>
            <p>IBAN: DE25 0101 0101 0101 0101 01</p>
            <p>BIC / SWIFT: COBADEFFXXX</p>
            <p>VAT: No VAT number – Kleinunternehmer §19 UStG, EU VAT on request.</p>
        </div>
        <div class="footer-right">
            <p>sign-xpert.com</p>
            <p>info@sign-xpert.com</p>
            <p>+49 157 766 25 125</p>
        </div>
    </div>
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


export default CartRouter;
