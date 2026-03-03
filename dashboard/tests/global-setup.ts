import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * This runs once before all tests
 */
export default async function globalSetup(config: FullConfig) {
  const { baseURL } = config.projects[0].use;
  
  console.log(`Global setup: Testing against ${baseURL}`);
  
  // You can perform setup tasks here:
  // - Seed the database
  // - Create test users
  // - Start the dev server if not already running
  
  // For now, we assume the dev server is running
  // In CI, you might want to start it here
}
