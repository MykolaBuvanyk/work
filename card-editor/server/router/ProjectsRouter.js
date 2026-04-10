import express from 'express';
import mongoose from 'mongoose';
import UserProject from '../models/UserProject.js';
import UserProjectCanvas from '../models/UserProjectCanvas.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const ProjectsRouter = express.Router();

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeAccessories = (value) => (Array.isArray(value) ? value : []);

const MAX_PROJECT_PAYLOAD_BYTES = 14 * 1024 * 1024;

const buildProjectLookupFilter = ({ userId, id }) => {
  const raw = String(id || '').trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw)) return { userId, _id: raw };
  return { userId, clientProjectId: raw };
};

const sanitizeCanvasForMongo = (canvas) => {
  if (!canvas || typeof canvas !== 'object') return canvas;
  const hasPreview = Object.prototype.hasOwnProperty.call(canvas, 'preview');
  const hasPreviewPng = Object.prototype.hasOwnProperty.call(canvas, 'previewPng');
  const hasPreviewSvgKey = Object.prototype.hasOwnProperty.call(canvas, 'previewSvg');
  const previewSvg = typeof canvas.previewSvg === 'string' ? canvas.previewSvg : '';
  const shouldDropPreviewSvg = hasPreviewSvgKey && !previewSvg;

  if (!hasPreview && !hasPreviewPng && !shouldDropPreviewSvg) {
    return canvas;
  }

  const next = { ...canvas };
  delete next.preview;
  delete next.previewPng;
  if (shouldDropPreviewSvg) {
    delete next.previewSvg;
  }

  return next;
};

const sanitizeCanvasesForMongo = (canvases) => {
  if (!Array.isArray(canvases)) return [];
  let changed = false;
  const nextCanvases = canvases.map((canvas) => {
    const sanitized = sanitizeCanvasForMongo(canvas);
    if (sanitized !== canvas) changed = true;
    return sanitized;
  });

  return changed ? nextCanvases : canvases;
};

const getCanvasesFromProject = (project) => {
  const base = project && typeof project === 'object' ? project : {};
  return sanitizeCanvasesForMongo(base.canvases);
};

const prepareProjectForMongo = ({ project, name, accessories }) => {
  const base = project && typeof project === 'object' ? project : {};
  const projectWithoutCanvases = { ...base };
  delete projectWithoutCanvases.canvases;

  return {
    ...projectWithoutCanvases,
    name,
    accessories: normalizeAccessories(accessories ?? base.accessories),
  };
};

const estimateJsonSizeBytes = (value) => {
  try {
    return mongoose.mongo.BSON.calculateObjectSize(value || {});
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};

const validateCanvasSizes = (canvases) => {
  const list = Array.isArray(canvases) ? canvases : [];

  for (let index = 0; index < list.length; index += 1) {
    const bytes = estimateJsonSizeBytes(list[index]);
    if (!Number.isFinite(bytes) || bytes > MAX_PROJECT_PAYLOAD_BYTES) {
      return { index, bytes };
    }
  }

  return null;
};

const loadCanvasesByProjectIds = async ({ userId, projectIds }) => {
  const ids = (Array.isArray(projectIds) ? projectIds : [])
    .filter(Boolean)
    .map((id) => (typeof id === 'string' ? id : String(id)));

  if (!ids.length) return new Map();

  const objectIds = ids
    .filter((id) => mongoose.isValidObjectId(id))
    .map((id) => new mongoose.Types.ObjectId(id));

  if (!objectIds.length) return new Map();

  const docs = await UserProjectCanvas.find({
    userId,
    userProjectId: { $in: objectIds },
  })
    .sort({ order: 1 })
    .lean();

  const byProject = new Map();
  for (const doc of docs || []) {
    const key = String(doc?.userProjectId || '');
    if (!key) continue;
    if (!byProject.has(key)) {
      byProject.set(key, []);
    }
    byProject.get(key).push(doc?.canvas && typeof doc.canvas === 'object' ? doc.canvas : {});
  }

  return byProject;
};

const persistProjectCanvases = async ({ userId, userProjectId, canvases }) => {
  const normalizedProjectId = String(userProjectId || '').trim();
  if (!normalizedProjectId || !mongoose.isValidObjectId(normalizedProjectId)) {
    throw new Error('Cannot persist canvases: invalid project id');
  }

  const canvasDocs = (Array.isArray(canvases) ? canvases : []).map((canvas, index) => {
    const canvasId = canvas && typeof canvas === 'object' && canvas.id != null ? String(canvas.id) : null;
    return {
      userId,
      userProjectId: new mongoose.Types.ObjectId(normalizedProjectId),
      canvasId,
      order: index,
      canvas,
    };
  });

  await UserProjectCanvas.deleteMany({
    userId,
    userProjectId: new mongoose.Types.ObjectId(normalizedProjectId),
  });

  if (canvasDocs.length) {
    await UserProjectCanvas.insertMany(canvasDocs, { ordered: true });
  }
};

const SAVE_RESULT_PROJECTION = {
  _id: 1,
  clientProjectId: 1,
  name: 1,
  createdAt: 1,
  updatedAt: 1,
  lastOrderedAt: 1,
};

const resolveProjectCanvases = ({ doc, canvases }) => {
  if (Array.isArray(canvases)) return canvases;
  const snapshot = doc?.project && typeof doc.project === 'object' ? doc.project : {};
  return Array.isArray(snapshot?.canvases) ? snapshot.canvases : [];
};

const toProjectPayload = ({ doc, canvases }) => {
  const snapshot = doc?.project && typeof doc.project === 'object' ? doc.project : {};
  return {
    id: String(doc?._id || ''),
    clientProjectId: doc?.clientProjectId || snapshot.id || null,
    name: doc?.name || snapshot.name || 'Untitled',
    createdAt: doc?.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
    lastOrderedAt: Number.isFinite(Number(doc?.lastOrderedAt))
      ? Number(doc.lastOrderedAt)
      : Number.isFinite(Number(snapshot?.lastOrderedAt))
        ? Number(snapshot.lastOrderedAt)
        : null,
    canvases: resolveProjectCanvases({ doc, canvases }),
    accessories: normalizeAccessories(doc?.accessories ?? snapshot?.accessories),
    checkout: snapshot?.checkout && typeof snapshot.checkout === 'object' ? snapshot.checkout : null,
  };
};

const toProjectPayloadFromSnapshot = ({ doc, snapshot, canvases }) => {
  const base = snapshot && typeof snapshot === 'object' ? snapshot : {};
  return {
    id: String(doc?._id || ''),
    clientProjectId: doc?.clientProjectId || base.id || null,
    name: doc?.name || base.name || 'Untitled',
    createdAt: doc?.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
    lastOrderedAt: Number.isFinite(Number(doc?.lastOrderedAt))
      ? Number(doc.lastOrderedAt)
      : Number.isFinite(Number(base?.lastOrderedAt))
        ? Number(base.lastOrderedAt)
        : null,
    canvases: Array.isArray(canvases) ? canvases : [],
    accessories: normalizeAccessories(base?.accessories),
    checkout: base?.checkout && typeof base.checkout === 'object' ? base.checkout : null,
  };
};

ProjectsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }
    const docs = await UserProject.find({ userId }).sort({ updatedAt: -1 }).lean();

    const projectIds = (docs || []).map((doc) => String(doc?._id || '')).filter(Boolean);
    const canvasesByProjectId = await loadCanvasesByProjectIds({ userId, projectIds });

    return res.json(
      (docs || []).map((doc) =>
        toProjectPayload({
          doc,
          canvases: canvasesByProjectId.get(String(doc?._id || '')),
        })
      )
    );
  } catch (e) {
    console.error('[ProjectsRouter][GET /] failed:', e);
    return next(e);
  }
});

ProjectsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }
    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }

    const filter = buildProjectLookupFilter({ userId, id });
    const doc = await UserProject.findOne(filter).lean();
    if (!doc) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    const canvasesByProjectId = await loadCanvasesByProjectIds({
      userId,
      projectIds: [String(doc?._id || '')],
    });

    return res.json(
      toProjectPayload({
        doc,
        canvases: canvasesByProjectId.get(String(doc?._id || '')),
      })
    );
  } catch (e) {
    console.error('[ProjectsRouter][GET /:id] failed:', e);
    return next(e);
  }
});

ProjectsRouter.post('/save-as', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }
    const body = req.body || {};
    const project = body.project;
    const name = String(body.name || body.project?.name || '').trim();
    const normalizedName = normalizeName(name);
    const clientProjectIdRaw = body.clientProjectId || body.projectId || body.project?.id || null;
    const clientProjectId = clientProjectIdRaw ? String(clientProjectIdRaw).trim() : null;

    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }
    if (!name) {
      return res.status(400).json({ status: 400, message: 'Project name is required' });
    }

    const safeProject = prepareProjectForMongo({
      project,
      name,
      accessories: body.accessories,
    });
    const safeCanvases = getCanvasesFromProject(project);

    const payloadSize = estimateJsonSizeBytes(safeProject);
    if (!Number.isFinite(payloadSize) || payloadSize > MAX_PROJECT_PAYLOAD_BYTES) {
      return res.status(413).json({
        status: 413,
        message: 'Project payload is too large for MongoDB. Please reduce project size and try again.',
        bytes: payloadSize,
      });
    }

    const oversizedCanvas = validateCanvasSizes(safeCanvases);
    if (oversizedCanvas) {
      return res.status(413).json({
        status: 413,
        message: 'One of canvases is too large for MongoDB. Please reduce canvas size and try again.',
        canvasIndex: oversizedCanvas.index,
        bytes: oversizedCanvas.bytes,
      });
    }

    const safeAccessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
    const nextLastOrderedAt = Number.isFinite(Number(body.lastOrderedAt))
      ? Number(body.lastOrderedAt)
      : null;

    const setData = {
      name,
      normalizedName,
      project: safeProject,
      accessories: safeAccessories,
      ...(nextLastOrderedAt !== null ? { lastOrderedAt: nextLastOrderedAt } : {}),
    };

    let saved = null;

    if (clientProjectId) {
      saved = await UserProject.findOneAndUpdate(
        { userId, clientProjectId },
        {
          $set: {
            ...setData,
            clientProjectId,
          },
        },
        { new: true, projection: SAVE_RESULT_PROJECTION }
      ).lean();
    }

    if (!saved && normalizedName) {
      saved = await UserProject.findOneAndUpdate(
        { userId, normalizedName },
        {
          $set: {
            ...setData,
            ...(clientProjectId ? { clientProjectId } : {}),
          },
        },
        { new: true, projection: SAVE_RESULT_PROJECTION }
      ).lean();
    }

    if (!saved) {
      try {
        const created = await UserProject.create({
          userId,
          clientProjectId,
          ...setData,
          lastOrderedAt: nextLastOrderedAt,
        });
        saved = created.toObject();
      } catch (createError) {
        if (createError?.code === 11000 && clientProjectId) {
          saved = await UserProject.findOneAndUpdate(
            { userId, clientProjectId },
            {
              $set: {
                ...setData,
                clientProjectId,
              },
            },
            { new: true, projection: SAVE_RESULT_PROJECTION }
          ).lean();
        } else {
          throw createError;
        }
      }
    }

    await persistProjectCanvases({
      userId,
      userProjectId: saved?._id,
      canvases: safeCanvases,
    });

    return res.json(
      toProjectPayloadFromSnapshot({
        doc: saved,
        snapshot: safeProject,
        canvases: safeCanvases,
      })
    );
  } catch (e) {
    console.error('[ProjectsRouter][POST /save-as] failed:', e);
    return next(e);
  }
});

ProjectsRouter.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }
    const id = String(req.params?.id || '').trim();
    const body = req.body || {};
    const project = body.project;
    const name = String(body.name || body.project?.name || '').trim();
    const clientProjectId = body.clientProjectId ? String(body.clientProjectId).trim() : null;

    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }
    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    const existingFilter = clientProjectId
      ? { userId, clientProjectId }
      : buildProjectLookupFilter({ userId, id });

    const existing = existingFilter
      ? await UserProject.findOne(existingFilter).select({ name: 1 }).lean()
      : null;
    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    const nextName = name || existing.name || 'Untitled';
    const safeProject = prepareProjectForMongo({
      project,
      name: nextName,
      accessories: body.accessories,
    });
    const safeCanvases = getCanvasesFromProject(project);

    const payloadSize = estimateJsonSizeBytes(safeProject);
    if (!Number.isFinite(payloadSize) || payloadSize > MAX_PROJECT_PAYLOAD_BYTES) {
      return res.status(413).json({
        status: 413,
        message: 'Project payload is too large for MongoDB. Please reduce project size and try again.',
        bytes: payloadSize,
      });
    }

    const oversizedCanvas = validateCanvasSizes(safeCanvases);
    if (oversizedCanvas) {
      return res.status(413).json({
        status: 413,
        message: 'One of canvases is too large for MongoDB. Please reduce canvas size and try again.',
        canvasIndex: oversizedCanvas.index,
        bytes: oversizedCanvas.bytes,
      });
    }

    const safeAccessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
    const nextLastOrderedAt = Number.isFinite(Number(body.lastOrderedAt))
      ? Number(body.lastOrderedAt)
      : null;

    const saved = await UserProject.findOneAndUpdate(
      existingFilter,
      {
        $set: {
          name: nextName,
          normalizedName: normalizeName(nextName),
          project: safeProject,
          accessories: safeAccessories,
          ...(clientProjectId ? { clientProjectId } : {}),
          ...(nextLastOrderedAt !== null ? { lastOrderedAt: nextLastOrderedAt } : {}),
        },
      },
      { new: true, projection: SAVE_RESULT_PROJECTION }
    ).lean();

    await persistProjectCanvases({
      userId,
      userProjectId: saved?._id,
      canvases: safeCanvases,
    });

    return res.json(
      toProjectPayloadFromSnapshot({
        doc: saved,
        snapshot: safeProject,
        canvases: safeCanvases,
      })
    );
  } catch (e) {
    console.error('[ProjectsRouter][PUT /:id] failed:', e);
    return next(e);
  }
});

ProjectsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    if (!userId) {
      return res.status(401).json({ status: 401, message: 'Unauthorized' });
    }
    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }

    const filter = buildProjectLookupFilter({ userId, id });
    const deleted = await UserProject.findOneAndDelete(filter).lean();
    if (!deleted) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    await UserProjectCanvas.deleteMany({
      userId,
      userProjectId: deleted._id,
    });

    return res.json({ status: 'ok', id });
  } catch (e) {
    console.error('[ProjectsRouter][DELETE /:id] failed:', e);
    return next(e);
  }
});

export default ProjectsRouter;