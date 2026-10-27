import { AppError } from '../utils/app-error.js';

export function notFoundHandler(req, _res, next) {
  next(
    new AppError(
      `Route not found: ${req.method} ${req.originalUrl}`,
      {
        statusCode: 404,
        code: 'ROUTE_NOT_FOUND',
      },
    ),
  );
}
