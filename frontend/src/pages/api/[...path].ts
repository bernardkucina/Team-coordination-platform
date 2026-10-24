/**
 * The whole backend behind one route: every /api/* request goes to the Express app from backend/src/app.ts.
 * This is how the monolith runs on Vercel (one deploy; this route is its serverless function). Locally,
 * `npm run dev:frontend` therefore serves the API too.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { createApp } from '@hub-pulse/backend/app';

const app = createApp();

export const config = {
  // Express reads the body itself; externalResolver tells Next that Express sends the response.
  api: { bodyParser: false, externalResolver: true },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  return new Promise<void>((resolve) => {
    res.on('finish', () => resolve());
    res.on('close', () => resolve());
    app(req, res);
  });
}
