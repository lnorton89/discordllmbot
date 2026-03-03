import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the Logs page
 */
export class LogsPage {
  readonly page: Page;
  readonly logContainer: Locator;

  constructor(page: Page) {
    this.page = page;
    this.logContainer = page.locator('[data-testid="logs"], .log-container, code, pre');
  }

  async goto() {
    await this.page.goto('/logs');
  }

  async waitForLoad() {
    await this.page.locator('text=Logs').waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Get log entries
   */
  getLogEntries(): Locator {
    return this.page.locator('.log-entry, [data-testid="log-entry"]');
  }

  /**
   * Filter logs by level
   */
  async filterByLevel(level: string) {
    const filterButton = this.page.locator(`button:has-text("${level}"), [aria-label="${level}"]`);
    if (await filterButton.isVisible()) {
      await filterButton.click();
    }
  }

  /**
   * Clear logs
   */
  async clearLogs() {
    const clearButton = this.page.locator('button:has-text("Clear"), button:has-text("clear")');
    if (await clearButton.isVisible()) {
      await clearButton.click();
    }
  }

  /**
   * Wait for new log entries to appear
   */
  async waitForLogs(timeout = 5000) {
    await this.logContainer.waitFor({ state: 'visible', timeout });
  }
}
