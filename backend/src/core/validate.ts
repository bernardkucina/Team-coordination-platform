import { z } from 'zod';
import { badRequest } from './errors';
import { HM_PATTERN } from './clock';

/** Parses a request body or query, or throws a 400 listing what is wrong. */
export const parse = <T extends z.ZodType>(schema: T, data: unknown): z.infer<T> => {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw badRequest(
      'Some fields are not valid.',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
};

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.');
export const clockTime = z.string().regex(HM_PATTERN, 'Use HH:MM.');
export const id = z.string().min(1);
