import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RequestHandler } from 'express';
import { createApp } from './app';
import { config } from './core/config';
import { db } from './core/db';
import { localParts, now } from './core/clock';

/** The built Next.js app (frontend/.next), served from this process so the whole platform is one app. */
const loadFrontend = async (): Promise<RequestHandler> => {
  const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../../frontend');
  const mod = (await import('next')) as unknown as { default: unknown };
  // next is CommonJS; depending on the loader its function is the default export or nested one level deeper.
  const createNext = (typeof mod.default === 'function' ? mod.default : (mod.default as { default: unknown }).default) as (
    opts: { dev: boolean; dir: string },
  ) => { prepare: () => Promise<void>; getRequestHandler: () => (req: unknown, res: unknown) => Promise<void> };
  const nextApp = createNext({ dev: false, dir });
  await nextApp.prepare();
  const handle = nextApp.getRequestHandler();
  return (req, res) => void handle(req, res);
};

const main = async () => {
  const frontend = config.serveFrontend ? await loadFrontend() : undefined;
  const server = createApp(frontend).listen(config.port, () => {
    const clock = localParts(now());
    const flags = [config.demoNow && 'DEMO_NOW', config.demoMode && 'DEMO_MODE', frontend && 'serving frontend'].filter(Boolean).join(', ');
    console.log(`Hub Pulse on http://localhost:${config.port} (clock ${clock.date} ${clock.time}${flags ? `; ${flags}` : ''})`);
  });

  const shutdown = () => {
    server.close(() => {
      void db.$disconnect().finally(() => process.exit(0));
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
};

void main();
