import express from 'express';
import mongoose from 'mongoose';
import UserProject from '../models/UserProject.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const ProjectsRouter = express.Router();

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeAccessories = (value) => (Array.isArray(value) ? value : []);

const MAX_PROJECT_PAYLOAD_BYTES = 14 * 1024 * 1024;
const MAX_CANVAS_PREVIEW_BYTES = 2_000_000;

const buildProjectLookupFilter = ({ userId, id }) => {
  const raw = String(id || '').trim();
  if (!raw) return null;
  if (mongoose.isValidObjectId(raw)) return { userId, _id: raw };
  return { userId, clientProjectId: raw };
};

const sanitizeCanvasForMongo = (canvas) => {
  if (!canvas || typeof canvas !== 'object') return canvas;
  const hasPreviewSvg = typeof canvas.previewSvg === 'string';
  const hasLargePreview =
    typeof canvas.preview === 'string' && canvas.preview.length > MAX_CANVAS_PREVIEW_BYTES;

  if (!hasPreviewSvg && !hasLargePreview) {
    return canvas;
  }

  const next = { ...canvas };
  if (hasPreviewSvg) {
    delete next.previewSvg;
  }
  if (hasLargePreview) {
    next.preview = '';
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

const prepareProjectForMongo = ({ project, name, accessories }) => {
  const base = project && typeof project === 'object' ? project : {};
  return {
    ...base,
    name,
    accessories: normalizeAccessories(accessories ?? base?.accessories),
    canvases: sanitizeCanvasesForMongo(base.canvases),
  };
};

const estimateJsonSizeBytes = (value) => {
  try {
    return mongoose.mongo.BSON.calculateObjectSize(value || {});
  } catch {
    return Number.POSITIVE_INFINITY;
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

const toProjectPayload = (doc) => {
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
    canvases: Array.isArray(snapshot?.canvases) ? snapshot.canvases : [],
    accessories: normalizeAccessories(doc?.accessories ?? snapshot?.accessories),
    checkout: snapshot?.checkout && typeof snapshot.checkout === 'object' ? snapshot.checkout : null,
  };
};

const toProjectPayloadFromSnapshot = ({ doc, snapshot }) => {
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
    canvases: Array.isArray(base?.canvases) ? base.canvases : [],
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
    return res.json((docs || []).map(toProjectPayload));
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

    return res.json(toProjectPayload(doc));
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

    const payloadSize = estimateJsonSizeBytes(safeProject);
    if (!Number.isFinite(payloadSize) || payloadSize > MAX_PROJECT_PAYLOAD_BYTES) {
      return res.status(413).json({
        status: 413,
        message: 'Project payload is too large for MongoDB. Please reduce project size and try again.',
        bytes: payloadSize,
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

    return res.json(toProjectPayloadFromSnapshot({ doc: saved, snapshot: safeProject }));
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

    const payloadSize = estimateJsonSizeBytes(safeProject);
    if (!Number.isFinite(payloadSize) || payloadSize > MAX_PROJECT_PAYLOAD_BYTES) {
      return res.status(413).json({
        status: 413,
        message: 'Project payload is too large for MongoDB. Please reduce project size and try again.',
        bytes: payloadSize,
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

    return res.json(toProjectPayloadFromSnapshot({ doc: saved, snapshot: safeProject }));
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

    return res.json({ status: 'ok', id });
  } catch (e) {
    console.error('[ProjectsRouter][DELETE /:id] failed:', e);
    return next(e);
  }
});

export default ProjectsRouter;