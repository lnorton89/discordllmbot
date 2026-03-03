import { Page, Locator } from '@playwright/test';

/**
 * Page Object Model for the Settings page
 */
export class SettingsPage {
  readonly page: Page;
  readonly tabs: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tabs = page.locator('[role="tablist"], .MuiTabs-root');
  }

  async goto() {
    await this.page.goto('/settings');
  }

  async waitForLoad() {
    await this.page.locator('text=Settings').waitFor({ state: 'visible', timeout: 10000 });
  }

  /**
   * Navigate to a specific settings tab
   */
  async selectTab(tabName: string) {
    const tab = this.page.locator(`[role="tab"]:has-text("${tabName}"), button:has-text("${tabName}")`);
    await tab.click();
  }

  /**
   * Get a form field by label
   */
  getField(label: string): Locator {
    return this.page.locator(`label:has-text("${label}") input, label:has-text("${label}") textarea, [aria-label="${label}"]`);
  }

  /**
   * Fill a text field
   */
  async fillField(label: string, value: string) {
    const field = this.getField(label);
    await field.fill(value);
  }

  /**
   * Toggle a checkbox or switch
   */
  async toggleField(label: string) {
    const toggle = this.page.locator(`label:has-text("${label}") input[type="checkbox"], [aria-label="${label}"][role="switch"]`);
    await toggle.click();
  }

  /**
   * Save settings (if there's a save button)
   */
  async save() {
    const saveButton = this.page.locator('button:has-text("Save"), button:has-text("save")');
    if (await saveButton.isVisible()) {
      await saveButton.click();
    }
  }
}
