/**
 * Kitchen ERP API — Server Entry Point
 * Consumes enterprise @kitchen-erp/database and centralized @kitchen-erp/config.
 */

import app from './app';
import { config, getMissingEnvVars } from './config/env';
import { db } from '@kitchen-erp/database';

async function start() {
  console.log('[LOG] Application Started');

  const missingEnv = getMissingEnvVars();
  if (missingEnv.length > 0) {
    console.warn(`[LOG] Environment Validation - Missing variables: ${missingEnv.join(', ')}`);
  } else {
    console.log('[LOG] Environment Validation - All required environment variables present');
  }

  try {
    // Verify database connection via enterprise DatabaseClient
    console.log('[LOG] Connecting to Database...');
    await db.connect();
    console.log('[LOG] Prisma Connected');
    console.log('[LOG] Database Connected');

    app.listen(config.port, () => {
      console.log(`\n🚀  Kitchen ERP API is running`);
      console.log(`    URL: http://localhost:${config.port}`);
      console.log(`    Env: ${config.nodeEnv}`);
      console.log(`    API: http://localhost:${config.port}${config.apiPrefix}\n`);
    });
  } catch (error) {
    console.error('❌  Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await db.disconnect();
  process.exit(0);
});

start();
