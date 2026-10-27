
export class AppError extends Error {
  constructor(
    message,
    {
      statusCode = 500,
      details = null,
      code = 'INTERNAL_SERVER_ERROR',
    } = {},
  ) {
    super(message);

    this.name = 'AppError';
    this.statusCode = statusCode;
    this.details = details;
    this.code = code;

    Error.captureStackTrace?.(this, AppError);
  }
}
