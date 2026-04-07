import 'dotenv/config';
import { buildApp } from './app.js';
import { config } from './config.js';

async function main() {
  const app = await buildApp();

  try {
    await app.listen({
      port: config.PORT,
      host: '0.0.0.0',
    });
    app.log.info(`🚀 CloudERP API running at http://0.0.0.0:${config.PORT}`);
    if (config.NODE_ENV !== 'production') {
      app.log.info(`📚 Swagger docs: http://localhost:${config.PORT}/api/v1/docs`);
    }
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});

main();
