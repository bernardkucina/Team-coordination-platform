import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import type { ApiError } from '@hub-pulse/shared';

export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export const badRequest = (message: string, details?: unknown) => new HttpError(400, message, details);
export const unauthorized = (message = 'Please sign in.') => new HttpError(401, message);
export const forbidden = (message = 'Only admins can do that.') => new HttpError(403, message);
export const notFound = (what: string) => new HttpError(404, `${what} not found.`);
export const conflict = (message: string) => new HttpError(409, message);

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  let status = 500;
  let body: ApiError = { error: 'Something went wrong.' };

  if (err instanceof HttpError) {
    status = err.status;
    body = { error: err.message, details: err.details };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
    status = 404;
    body = { error: 'Not found.' };
  } else if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003') {
    status = 400;
    body = { error: 'It refers to something that does not exist.' };
  } else if (err?.type === 'entity.parse.failed') {
    status = 400;
    body = { error: 'The request body is not valid JSON.' };
  }

  if (status === 500) console.error(err);
  res.status(status).json(body);
};
