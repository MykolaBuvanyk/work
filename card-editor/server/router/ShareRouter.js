import express from 'express';
import { randomBytes } from 'crypto';
import SharedProject from '../models/SharedProject.js';
import { optionalAuth } from '../middleware/authMiddleware.js';

const ShareRouter = express.Router();

const createShareToken = () => randomBytes(24).toString('hex');

const normalizeAccessories = (input) => (Array.isArray(input) ? input : []);

const buildShareUrl = (req, token) => {
  const origin = String(req.headers.origin || '').trim();
  const path = `/share/${token}`;
  if (origin) return `${origin}${path}`;
  return path;
};

ShareRouter.post('/', optionalAuth, async (req, res, next) => {
  try {
    const body = req.body || {};
    const project = body.project;
    const projectNameRaw = body.projectName ?? body?.project?.name;
    const projectName = String(projectNameRaw || '').trim();
    const createdById = req.user?.id ? String(req.user.id) : null;
    const sourceProjectId = body.projectId ? String(body.projectId) : project?.id ? String(project.id) : null;

    if (!project || typeof project !== 'object') {
      return res.status(400).json({ status: 400, message: 'Project payload is required' });
    }

    if (!projectName) {
      return res.status(400).json({ status: 400, message: 'Project name is required' });
    }

    if (createdById && sourceProjectId) {
      const existing = await SharedProject.findOne({
        createdById,
        sourceProjectId,
        accessType: 'anyone_with_link',
      });

      if (existing) {
        existing.projectName = projectName;
        existing.project = project;
        existing.accessories = normalizeAccessories(body.accessories);
        existing.checkout = body?.checkout && typeof body.checkout === 'object' ? body.checkout : null;
        await existing.save();

        return res.json({
          id: String(existing._id),
          token: existing.token,
          accessType: existing.accessType,
          projectName: existing.projectName,
          url: buildShareUrl(req, existing.token),
          createdAt: existing.createdAt,
          updatedAt: existing.updatedAt,
          reused: true,
        });
      }
    }

    let token = createShareToken();
    let attempts = 0;
    while (attempts < 5) {
      const exists = await SharedProject.findOne({ token }).lean();
      if (!exists) break;
      token = createShareToken();
      attempts += 1;
    }

    const created = await SharedProject.create({
      token,
      accessType: 'anyone_with_link',
      createdById,
      sourceProjectId,
      projectName,
      project,
      accessories: normalizeAccessories(body.accessories),
      checkout: body?.checkout && typeof body.checkout === 'object' ? body.checkout : null,
    });

    return res.json({
      id: String(created._id),
      token: created.token,
      accessType: created.accessType,
      projectName: created.projectName,
      url: buildShareUrl(req, created.token),
      createdAt: created.createdAt,
      updatedAt: created.updatedAt,
      reused: false,
    });
  } catch (e) {
    return next(e);
  }
});

ShareRouter.get('/:token', optionalAuth, async (req, res, next) => {
  try {
    const token = String(req.params?.token || '').trim();
    if (!token) {
      return res.status(400).json({ status: 400, message: 'Share token is required' });
    }

    const item = await SharedProject.findOneAndUpdate(
      { token, accessType: 'anyone_with_link' },
      {
        $inc: { viewsCount: 1 },
        $set: { lastOpenedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!item) {
      return res.status(404).json({ status: 404, message: 'Shared project not found' });
    }

    return res.json({
      id: String(item._id),
      token: item.token,
      accessType: item.accessType,
      projectId: item.sourceProjectId,
      projectName: item.projectName,
      project: item.project,
      accessories: item.accessories,
      checkout: item.checkout,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    });
  } catch (e) {
    return next(e);
  }
});

ShareRouter.post('/:token/copied', optionalAuth, async (req, res, next) => {
  try {
    const token = String(req.params?.token || '').trim();
    if (!token) {
      return res.status(400).json({ status: 400, message: 'Share token is required' });
    }

    const item = await SharedProject.findOneAndUpdate(
      { token, accessType: 'anyone_with_link' },
      {
        $inc: { copiesCount: 1 },
        $set: { lastOpenedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!item) {
      return res.status(404).json({ status: 404, message: 'Shared project not found' });
    }

    return res.json({ status: 'ok', token: item.token, copiesCount: item.copiesCount });
  } catch (e) {
    return next(e);
  }
});

export default ShareRouter;
