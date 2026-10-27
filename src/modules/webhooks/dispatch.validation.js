
import { AppError } from '../../utils/app-error.js';

export function validateDispatchRequest(req, _res, next) {
  const { destinationUrl, eventId, payload } = req.body ?? {};
  const errors = [];

  if (
    typeof destinationUrl !== 'string' ||
    destinationUrl.trim() === ''
  ) {
    errors.push({
      field: 'destinationUrl',
      message: 'Destination URL is required',
    });
  } else {
    try {
      const url = new URL(destinationUrl);

      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !url.hostname
      ) {
        errors.push({
          field: 'destinationUrl',
          message: 'A valid HTTP or HTTPS URL is required',
        });
      }
    } catch {
      errors.push({
        field: 'destinationUrl',
        message: 'Destination URL must be a valid URL',
      });
    }
  }

  if (typeof eventId !== 'string' || eventId.trim() === '') {
    errors.push({
      field: 'eventId',
      message: 'Event ID is required',
    });
  }

  if (
    payload === null ||
    typeof payload !== 'object' ||
    Array.isArray(payload)
  ) {
    errors.push({
      field: 'payload',
      message: 'Payload must be a JSON object',
    });
  }

  if (errors.length > 0) {
    return next(
      new AppError('Invalid request parameters', {
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        details: errors,
      }),
    );
  }

  next();
}
