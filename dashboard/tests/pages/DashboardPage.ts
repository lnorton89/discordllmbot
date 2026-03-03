import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the Dashboard home page
 */
export class DashboardPage {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    this.root = page.locator('#root');
  }

  async goto() {
    await this.page.goto('/');
  }

  async waitForLoad() {
    await this.root.waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Check if the dashboard is loaded successfully
   */
  async isLoaded(): Promise<boolean> {
    return await this.root.isVisible();
  }

  /**
   * Get the main navigation menu
   */
  getNavigation() {
    return this.page.locator('nav, [role="navigation"], .MuiDrawer-root');
  }

  /**
   * Navigate to a specific page by clicking a nav item
   */
  async navigateTo(pageName: string) {
    const navItem = this.page.locator(`a:has-text("${pageName}"), button:has-text("${pageName}")`);
    await navItem.click();
  }
}
