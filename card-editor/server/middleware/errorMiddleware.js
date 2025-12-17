import ErrorApi from '../error/ErrorApi.js';

export default function errorMiddleware(err, req, res, next) {
  try {
    if (!err) return next();

    if (err instanceof ErrorApi) {
      // Some ErrorApi variants pass an object as message.
      if (typeof err.message === 'object') {
        return res.status(err.status).json(err.message);
      }
      return res.status(err.status).json({ status: err.status, message: err.message });
    }

    const message = err?.message || String(err);
    return res.status(500).json({ status: 500, message });
  } catch (handlerErr) {
    return res.status(500).json({ status: 500, message: 'Unhandled error' });
  }
}
