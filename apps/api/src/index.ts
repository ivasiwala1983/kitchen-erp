/**
 * Kitchen ERP API — Server Entry Point
 */

import app from './app';
import { config, getMissingEnvVars } from './config/env';
import prisma from './config/database';

async function start() {
  console.log('[LOG] Application Started');

  const missingEnv = getMissingEnvVars();
  if (missingEnv.length > 0) {
    console.warn(`[LOG] Environment Validation - Missing variables: ${missingEnv.join(', ')}`);
  } else {
    console.log('[LOG] Environment Validation - All required environment variables present');
  }

  try {
    // Verify database connection
    console.log('[LOG] Prisma Connected');
    await prisma.$connect();
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
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

start();
