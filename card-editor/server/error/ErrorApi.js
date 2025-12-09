class ErrorApi extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }

  static badRequest(message) {
    return new ErrorApi(400, message);
  }

  static internalServerError(err) {
    return new ErrorApi(500, err.message || err);
  }

  static unauthorized(err) {
    return new ErrorApi(401, {
      status: 401,
      message: 'Unauthorized',
      text: err,
    });
  }

  static forbidden(err) {
    return new ErrorApi(403, { status: 403, message: 'Forbidden', text: err });
  }

  static notFound(err) {
    return new ErrorApi(404, {
      status: 404,
      message: 'Unauthorized',
      text: err,
    });
  }
  static noAuth(err) {
    return new ErrorApi(401, {
      status: 401,
      message: 'Authentication Required',
      text: err,
    });
  }
}

export default ErrorApi;
