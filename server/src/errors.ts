import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  if (
    error instanceof SyntaxError &&
    typeof error === 'object' &&
    error !== null &&
    'status' in error &&
    error.status === 400
  ) {
    response.status(400).json({ error: 'Request body contains invalid JSON.' });
    return;
  }

  if (error instanceof ZodError) {
    response.status(400).json({
      error: 'Validation failed',
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return;
  }

  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = error.code;
    if (code === '23505') {
      response.status(409).json({ error: 'A record with that value already exists.' });
      return;
    }
    if (code === '23503') {
      response.status(400).json({ error: 'The referenced record does not exist.' });
      return;
    }
  }

  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ error: error.message });
    return;
  }

  console.error('Unhandled API error:', error);
  response.status(500).json({ error: 'Internal server error.' });
};
