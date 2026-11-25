import type { Request, Response } from 'express';
import { z } from 'zod';
import type { ZodType } from 'zod';

const uuidSchema = z.string().uuid();

export function parseBody<T>(
  schema: ZodType<T>,
  request: Request,
  response: Response,
): T | undefined {
  const result = schema.safeParse(request.body);
  if (!result.success) {
    response.status(400).json({
      error: 'Validation failed',
      details: result.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    });
    return undefined;
  }
  return result.data;
}

export function parseUuid(value: string): string | null {
  const result = uuidSchema.safeParse(value);
  return result.success ? result.data : null;
}
