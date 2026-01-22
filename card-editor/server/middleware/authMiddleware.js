import jwt from 'jsonwebtoken';
import ErrorApi from '../error/ErrorApi.js';

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      return next(ErrorApi.noAuth('Missing Bearer token'));
    }

    const secretKey = process.env.secretKey;
    if (!secretKey) {
      return next(ErrorApi.internalServerError('secretKey is not set'));
    }

    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    return next();
  } catch (e) {
    return next(ErrorApi.unauthorized(e?.message || 'Invalid token'));
  }
}

// Optional auth: if Bearer token is present, decode it and set req.user.
// If header is missing, continue without req.user.
export function optionalAuth(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [, token] = header.split(' ');

    if (!token) {
      return next();
    }

    const secretKey = process.env.secretKey;
    if (!secretKey) {
      return next(ErrorApi.internalServerError('secretKey is not set'));
    }

    const decoded = jwt.verify(token, secretKey);
    req.user = decoded;
    return next();
  } catch (e) {
    return next(ErrorApi.unauthorized(e?.message || 'Invalid token'));
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user) {
    return next(ErrorApi.noAuth('Authentication Required'));
  }
  if (req.user.type !== 'Admin') {
    return next(ErrorApi.forbidden('Admin only'));
  }
  return next();
}
