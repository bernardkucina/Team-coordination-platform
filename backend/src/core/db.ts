import { PrismaClient } from '@prisma/client';

/** The one database client for the whole monolith. */
export const db = new PrismaClient();
