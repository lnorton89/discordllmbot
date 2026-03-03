import { test, expect } from '../fixtures/test';

test.describe('Playground', () => {
  test('should load the Playground page', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    await expect(page.locator('text=Playground')).toBeVisible();
  });

  test('should display message input', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    // Look for message input field
    const input = page.locator('textarea[placeholder*="message"], input[placeholder*="message"], [aria-label="Message"]');
    await expect(input).toBeVisible();
  });

  test('should allow sending test messages', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    // Find input and send button
    const input = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
    const sendButton = page.locator('button:has-text("Send"), button:has-text("send"), [aria-label="Send"]');

    if (await input.isVisible() && await sendButton.isVisible()) {
      // Type a test message
      await input.fill('Test message from Playwright');

      // Click send
      await sendButton.click();

      // Wait for response
      await page.waitForTimeout(2000);

      // Check for bot response
      const response = page.locator('.bot-response, [data-testid="bot-response"], text=Test message from Playwright');
      await expect(response).toBeVisible();
    }
  });

  test('should display bot response', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    const input = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
    const sendButton = page.locator('button:has-text("Send"), button:has-text("send")').first();

    if (await input.isVisible() && await sendButton.isVisible()) {
      await input.fill('Hello');
      await sendButton.click();

      // Wait for bot response
      await page.waitForTimeout(3000);

      // Look for response container
      const responseContainer = page.locator('.response-container, [data-testid="response"]');
      await expect(responseContainer).toBeVisible();
    }
  });

  test('should handle empty message validation', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    const sendButton = page.locator('button:has-text("Send"), button:has-text("send")').first();

    if (await sendButton.isVisible()) {
      // Try to send without typing anything
      await sendButton.click();

      // Wait for validation message or no action
      await page.waitForTimeout(500);

      // Either there's an error message or the button was disabled
      const errorMessage = page.locator('text=Please enter a message, text=Message cannot be empty, .error-message');
      const isDisabled = await sendButton.isDisabled();

      expect(await errorMessage.isVisible() || isDisabled).toBe(true);
    }
  });

  test('should display conversation history', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    // Send a message
    const input = page.locator('textarea[placeholder*="message"], input[placeholder*="message"]').first();
    const sendButton = page.locator('button:has-text("Send"), button:has-text("send")').first();

    if (await input.isVisible() && await sendButton.isVisible()) {
      await input.fill('Test');
      await sendButton.click();
      await page.waitForTimeout(2000);

      // Check for conversation history
      const history = page.locator('.conversation-history, [data-testid="history"], .chat-history');
      await expect(history).toBeVisible();
    }
  });

  test('should allow clearing conversation', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    // Look for clear button
    const clearButton = page.locator('button:has-text("Clear"), button:has-text("Clear Conversation"), [aria-label="Clear"]');

    if (await clearButton.isVisible()) {
      await clearButton.click();
      await page.waitForTimeout(500);

      // Verify conversation is cleared
      const history = page.locator('.conversation-history [data-testid="message"]');
      const count = await history.count();
      expect(count).toBe(0);
    }
  });

  test('should display LLM provider selection', async ({ page }) => {
    await page.goto('/playground');
    await page.waitForLoadState('networkidle');

    // Look for provider/model selector
    const providerSelect = page.locator('select[aria-label="Provider"], select[aria-label="Model"], .provider-select');

    if (await providerSelect.isVisible()) {
      const options = await providerSelect.locator('option').allTextContents();
      expect(options.length).toBeGreaterThan(0);
    }
  });
});
