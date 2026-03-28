import express from 'express';
import UserProject from '../models/UserProject.js';
import { requireAuth } from '../middleware/authMiddleware.js';

const ProjectsRouter = express.Router();

const normalizeName = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();

const normalizeAccessories = (value) => (Array.isArray(value) ? value : []);

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

ProjectsRouter.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const docs = await UserProject.find({ userId }).sort({ updatedAt: -1 }).lean();
    return res.json((docs || []).map(toProjectPayload));
  } catch (e) {
    return next(e);
  }
});

ProjectsRouter.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }

    const doc = await UserProject.findOne({ _id: id, userId }).lean();
    if (!doc) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    return res.json(toProjectPayload(doc));
  } catch (e) {
    return next(e);
  }
});

ProjectsRouter.post('/save-as', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
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

    const safeProject = {
      ...project,
      name,
      accessories: normalizeAccessories(body.accessories ?? project?.accessories),
    };

    let existing = null;
    if (clientProjectId) {
      existing = await UserProject.findOne({ userId, clientProjectId });
    }
    if (!existing && normalizedName) {
      existing = await UserProject.findOne({ userId, normalizedName });
    }

    let saved;
    if (existing) {
      existing.name = name;
      existing.normalizedName = normalizedName;
      existing.clientProjectId = clientProjectId || existing.clientProjectId || null;
      existing.project = safeProject;
      existing.accessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
      if (Number.isFinite(Number(body.lastOrderedAt))) {
        existing.lastOrderedAt = Number(body.lastOrderedAt);
      }
      saved = await existing.save();
    } else {
      try {
        saved = await UserProject.create({
          userId,
          clientProjectId,
          name,
          normalizedName,
          project: safeProject,
          accessories: normalizeAccessories(body.accessories ?? safeProject.accessories),
          lastOrderedAt: Number.isFinite(Number(body.lastOrderedAt))
            ? Number(body.lastOrderedAt)
            : null,
        });
      } catch (createError) {
        // In rare race conditions, unique key may already be taken. Reuse the existing row.
        if (createError?.code === 11000 && clientProjectId) {
          const concurrent = await UserProject.findOne({ userId, clientProjectId });
          if (concurrent) {
            concurrent.name = name;
            concurrent.normalizedName = normalizedName;
            concurrent.project = safeProject;
            concurrent.accessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
            if (Number.isFinite(Number(body.lastOrderedAt))) {
              concurrent.lastOrderedAt = Number(body.lastOrderedAt);
            }
            saved = await concurrent.save();
          } else {
            throw createError;
          }
        } else {
          throw createError;
        }
      }
    }

    return res.json(toProjectPayload(saved));
  } catch (e) {
    return next(e);
  }
});

ProjectsRouter.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const id = String(req.params?.id || '').trim();
    const body = req.body || {};
    const project = body.project;
    const name = String(body.name || body.project?.name || '').trim();

    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }
    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    const existing = await UserProject.findOne({ _id: id, userId });
    if (!existing) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    const nextName = name || existing.name || 'Untitled';
    const safeProject = {
      ...project,
      name: nextName,
      accessories: normalizeAccessories(body.accessories ?? project?.accessories),
    };

    existing.name = nextName;
    existing.normalizedName = normalizeName(nextName);
    existing.project = safeProject;
    existing.accessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
    if (body.clientProjectId) {
      existing.clientProjectId = String(body.clientProjectId).trim();
    }
    if (Number.isFinite(Number(body.lastOrderedAt))) {
      existing.lastOrderedAt = Number(body.lastOrderedAt);
    }

    const saved = await existing.save();
    return res.json(toProjectPayload(saved));
  } catch (e) {
    return next(e);
  }
});

ProjectsRouter.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = String(req.user?.id || '').trim();
    const id = String(req.params?.id || '').trim();
    if (!id) {
      return res.status(400).json({ status: 400, message: 'Project id is required' });
    }

    const deleted = await UserProject.findOneAndDelete({ _id: id, userId }).lean();
    if (!deleted) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    return res.json({ status: 'ok', id });
  } catch (e) {
    return next(e);
  }
});

export default ProjectsRouter;