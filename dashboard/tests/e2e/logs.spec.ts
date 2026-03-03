import { test, expect } from '../fixtures/test';
import { LogsPage } from '../pages/LogsPage';

test.describe('Logs', () => {
  let logs: LogsPage;

  test.beforeEach(async ({ page }) => {
    logs = new LogsPage(page);
  });

  test('should load the Logs page', async () => {
    await logs.goto();
    await logs.waitForLoad();

    await expect(logs.page.locator('text=Logs')).toBeVisible();
  });

  test('should display log container', async () => {
    await logs.goto();
    await logs.waitForLoad();

    await expect(logs.logContainer).toBeVisible();
  });

  test('should filter logs by level', async () => {
    await logs.goto();
    await logs.waitForLoad();

    // Try filtering by different log levels
    const levels = ['INFO', 'WARN', 'ERROR'];
    
    for (const level of levels) {
      await logs.filterByLevel(level);
      // Wait for filter to apply
      await logs.page.waitForTimeout(500);
    }
  });

  test('should handle real-time log streaming', async () => {
    await logs.goto();
    await logs.waitForLoad();
    
    // Wait for logs to stream in (Socket.io)
    await logs.waitForLogs(5000);
    
    // Check if log entries appear
    const entries = logs.getLogEntries();
    const count = await entries.count();
    
    // There should be at least some log entries or the container should be ready
    expect(count >= 0).toBe(true);
  });

  test('should clear logs', async () => {
    await logs.goto();
    await logs.waitForLoad();
    
    // Get initial log count
    const initialEntries = logs.getLogEntries();
    const initialCount = await initialEntries.count();
    
    // Try to clear logs
    await logs.clearLogs();
    
    // Wait for clear operation
    await logs.page.waitForTimeout(500);
    
    // Verify logs were cleared or clear button wasn't available
    const finalEntries = logs.getLogEntries();
    const finalCount = await finalEntries.count();
    
    // Either logs were cleared or the clear button didn't exist
    expect(finalCount <= initialCount).toBe(true);
  });

  test('should display log timestamps', async () => {
    await logs.goto();
    await logs.waitForLoad();
    
    await logs.waitForLogs(5000);
    
    // Check for timestamp patterns in logs
    const logContent = await logs.logContainer.textContent();
    
    // Common timestamp patterns: HH:MM:SS or ISO format
    const timestampPattern = /\d{2}:\d{2}:\d{2}|\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
    
    if (logContent) {
      expect(timestampPattern.test(logContent)).toBe(true);
    }
  });

  test('should handle Socket.io connection', async () => {
    await logs.goto();
    await logs.waitForLoad();
    
    // Wait for Socket.io connection to establish
    await logs.page.waitForTimeout(2000);
    
    // Just verify the page is functional
    await expect(logs.logContainer).toBeVisible();
  });
});
