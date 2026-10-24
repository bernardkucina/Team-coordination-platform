import { createApp } from './app';
import { config } from './core/config';
import { db } from './core/db';
import { localParts, now } from './core/clock';

const server = createApp().listen(config.port, () => {
  const clock = localParts(now());
  console.log(`Hub Pulse API on http://localhost:${config.port} (clock ${clock.date} ${clock.time}${config.demoNow ? ', DEMO_NOW' : ''}${config.demoMode ? ', DEMO_MODE' : ''})`);
});

const shutdown = () => {
  server.close(() => {
    void db.$disconnect().finally(() => process.exit(0));
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
