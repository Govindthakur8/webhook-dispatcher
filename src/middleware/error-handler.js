
import { AppError } from '../utils/app-error.js';

export function errorHandler(error, _req, res, _next) {
  const isOperational = error instanceof AppError;

  const statusCode =
    isOperational &&
    Number.isInteger(error.statusCode) &&
    error.statusCode >= 400 &&
    error.statusCode <= 599
      ? error.statusCode
      : 500;

  if (statusCode >= 500) {
    console.error(error);
  }

  res.status(statusCode).json({
    error: isOperational ? error.details : null,
    isSuccess: false,
    statusCode,
    message:
      statusCode >= 500
        ? 'Internal server error'
        : error.message,
  });
}
