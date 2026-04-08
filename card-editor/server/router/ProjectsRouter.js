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

const toSaveResponse = (doc) => ({
  id: String(doc?._id || ''),
  clientProjectId: doc?.clientProjectId || null,
  name: doc?.name || 'Untitled',
  createdAt: doc?.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
  updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).getTime() : Date.now(),
  lastOrderedAt: Number.isFinite(Number(doc?.lastOrderedAt)) ? Number(doc.lastOrderedAt) : null,
});

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

    const accessories = normalizeAccessories(body.accessories ?? safeProject.accessories);
    const hasLastOrderedAt = Number.isFinite(Number(body.lastOrderedAt));

    const updateDoc = {
      $set: {
        name,
        normalizedName,
        project: safeProject,
        accessories,
      },
      $setOnInsert: {
        userId,
        clientProjectId: clientProjectId || null,
      },
    };

    if (clientProjectId) {
      updateDoc.$set.clientProjectId = clientProjectId;
    }
    if (hasLastOrderedAt) {
      updateDoc.$set.lastOrderedAt = Number(body.lastOrderedAt);
    }

    const projection = {
      _id: 1,
      clientProjectId: 1,
      name: 1,
      createdAt: 1,
      updatedAt: 1,
      lastOrderedAt: 1,
    };

    let saved = null;
    if (clientProjectId) {
      saved = await UserProject.findOneAndUpdate(
        { userId, clientProjectId },
        updateDoc,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          projection,
        }
      ).lean();
    } else if (normalizedName) {
      saved = await UserProject.findOneAndUpdate(
        { userId, normalizedName },
        updateDoc,
        {
          upsert: true,
          new: true,
          setDefaultsOnInsert: true,
          projection,
        }
      ).lean();
    } else {
      const created = await UserProject.create({
        userId,
        clientProjectId,
        name,
        normalizedName,
        project: safeProject,
        accessories,
        lastOrderedAt: hasLastOrderedAt ? Number(body.lastOrderedAt) : null,
      });
      saved = {
        _id: created._id,
        clientProjectId: created.clientProjectId,
        name: created.name,
        createdAt: created.createdAt,
        updatedAt: created.updatedAt,
        lastOrderedAt: created.lastOrderedAt,
      };
    }

    return res.json(toSaveResponse(saved));
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

    const nextName = name || 'Untitled';
    const safeProject = {
      ...project,
      name: nextName,
      accessories: normalizeAccessories(body.accessories ?? project?.accessories),
    };

    const updateDoc = {
      $set: {
        name: nextName,
        normalizedName: normalizeName(nextName),
        project: safeProject,
        accessories: normalizeAccessories(body.accessories ?? safeProject.accessories),
      },
    };
    if (body.clientProjectId) {
      updateDoc.$set.clientProjectId = String(body.clientProjectId).trim();
    }
    if (Number.isFinite(Number(body.lastOrderedAt))) {
      updateDoc.$set.lastOrderedAt = Number(body.lastOrderedAt);
    }

    const saved = await UserProject.findOneAndUpdate({ _id: id, userId }, updateDoc, {
      new: true,
      projection: {
        _id: 1,
        clientProjectId: 1,
        name: 1,
        createdAt: 1,
        updatedAt: 1,
        lastOrderedAt: 1,
      },
    }).lean();

    if (!saved) {
      return res.status(404).json({ status: 404, message: 'Project not found' });
    }

    return res.json(toSaveResponse(saved));
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