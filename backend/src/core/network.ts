import type { Request } from 'express';

/** Drops the IPv6 prefix Node adds to IPv4 addresses. */
const clean = (ip: string): string => ip.trim().replace(/^::ffff:/, '');

/**
 * The client's public address. Vercel sets x-forwarded-for to the real client address (it overwrites what the
 * client sent); locally the Next.js proxy forwards it. Falls back to the socket address.
 */
export const clientIp = (req: Request): string => {
  const vercel = req.headers['x-vercel-forwarded-for'];
  const forwarded = req.headers['x-forwarded-for'];
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.split(',')[0];
  return clean(first(vercel) || first(forwarded) || req.socket.remoteAddress || 'unknown');
};
