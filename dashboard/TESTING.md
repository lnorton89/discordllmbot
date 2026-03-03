# Dashboard Testing with Playwright

This document describes how to run and write end-to-end (E2E) tests for the DiscordLLMBot dashboard using Playwright.

## Quick Start

### 1. Install Dependencies

```bash
cd dashboard
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

This downloads the browser binaries (Chromium, Firefox, WebKit) needed for testing.

### 3. Start the Development Server

In a separate terminal, start the dashboard dev server:

```bash
npm run dev
```

The dashboard will be available at `http://localhost:5173`.

### 4. Run Tests

```bash
# Run all tests
npm test

# Run tests with UI mode (interactive)
npm run test:ui

# Run tests in debug mode
npm run test:debug

# Run tests in headed mode (visible browser)
npm run test:headed

# View test report after running
npm run test:report
```

## Test Commands

| Command | Description |
|---------|-------------|
| `npm test` | Run all tests in headless mode |
| `npm run test:ui` | Open Playwright UI for interactive testing |
| `npm run test:debug` | Run tests with debugger attached |
| `npm run test:headed` | Run tests with visible browser window |
| `npm run test:report` | Open HTML test report |

## Test Structure

```
tests/
├── fixtures/
│   └── test.ts          # Base test fixtures with common setup
├── pages/
│   ├── DashboardPage.ts # Page Object Model for Dashboard
│   ├── SettingsPage.ts  # Page Object Model for Settings
│   └── LogsPage.ts      # Page Object Model for Logs
├── e2e/
│   ├── dashboard.spec.ts # Dashboard E2E tests
│   ├── settings.spec.ts  # Settings E2E tests
│   ├── logs.spec.ts      # Logs E2E tests
│   ├── servers.spec.ts   # Servers E2E tests
│   └── playground.spec.ts # Playground E2E tests
├── global-setup.ts       # Global test setup
└── tsconfig.json         # TypeScript config for tests
```

## Writing Tests

### Basic Test Example

```typescript
import { test, expect } from '../fixtures/test';

test.describe('My Feature', () => {
  test('should do something', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.locator('text=Settings')).toBeVisible();
  });
});
```

### Using Page Objects

```typescript
import { test, expect } from '../fixtures/test';
import { SettingsPage } from '../pages/SettingsPage';

test.describe('Settings', () => {
  let settings: SettingsPage;

  test.beforeEach(async ({ page }) => {
    settings = new SettingsPage(page);
  });

  test('should save settings', async ({ page }) => {
    await settings.goto();
    await settings.waitForLoad();
    await settings.fillField('Username', 'TestBot');
    await settings.save();
  });
});
```

### Common Assertions

```typescript
// Visibility
await expect(locator).toBeVisible();
await expect(locator).not.toBeVisible();

// Text content
await expect(locator).toHaveText('Expected Text');
await expect(locator).toContainText('Partial Text');

// Attributes
await expect(locator).toHaveAttribute('href', '/settings');
await expect(locator).toHaveValue('input value');

// Count
await expect(locator).toHaveCount(3);

// URL
await expect(page).toHaveURL(/.*settings/);
```

## Configuration

### playwright.config.ts

Key configuration options:

- **baseURL**: `http://localhost:5173` (dashboard dev server)
- **timeout**: 30 seconds per test
- **actionTimeout**: 10 seconds per action
- **retries**: 0 in dev, 2 in CI
- **reporters**: HTML report + list output
- **browsers**: Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari

### Environment Variables

Create a `.env` file in the dashboard root:

```bash
VITE_BASE_URL=http://localhost:5173
```

## Running Specific Tests

### By File

```bash
npx playwright test tests/e2e/dashboard.spec.ts
```

### By Test Name

```bash
npx playwright test -g "should load the dashboard"
```

### By Project (Browser)

```bash
# Run only on Chromium
npx playwright test --project=chromium

# Run only on Firefox
npx playwright test --project=firefox

# Run only on mobile
npx playwright test --project="Mobile Chrome"
```

### With Options

```bash
# Run tests with specific tag
npx playwright test --grep @smoke

# Run tests in parallel
npx playwright test --workers=4

# Limit to first 5 tests
npx playwright test --max-failures=5
```

## Debugging Tests

### Playwright Inspector

```bash
npx playwright test --debug
```

This opens the Playwright Inspector with:
- Step-through debugging
- Live edit and re-run
- Actionability logs
- Locator explorer

### Trace Viewer

After running tests with `trace: 'on-first-retry'` in config:

```bash
npx playwright show-trace test-results/trace.zip
```

### Video Recording

Videos are recorded on test failure. View them in the `test-results/` directory.

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Playwright Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright
        run: npx playwright install --with-deps
      - name: Run tests
        run: npm test
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 30
```

## Best Practices

### 1. Use Page Objects

Encapsulate page structure and interactions in page object classes for maintainability.

### 2. Wait for Network Idle

```typescript
await page.goto('/settings', { waitUntil: 'networkidle' });
```

### 3. Use Data Test IDs

Add `data-testid` attributes to elements for stable selectors:

```tsx
// In your React component
<button data-testid="save-button">Save</button>
```

```typescript
// In your test
await page.locator('[data-testid="save-button"]').click();
```

### 4. Handle Async Operations

```typescript
// Wait for API response
await page.waitForResponse(response => 
  response.url().includes('/api/config') && 
  response.status() === 200
);
```

### 5. Test in Multiple Viewports

```typescript
test('should be responsive', async ({ page }) => {
  // Desktop
  await page.setViewportSize({ width: 1920, height: 1080 });
  
  // Tablet
  await page.setViewportSize({ width: 768, height: 1024 });
  
  // Mobile
  await page.setViewportSize({ width: 375, height: 667 });
});
```

## Test Coverage

The current test suite covers:

- ✅ Dashboard home page loading and navigation
- ✅ Settings page with tabs and form interactions
- ✅ Logs page with real-time streaming
- ✅ Servers page with server selection
- ✅ Playground page with message sending
- ✅ Mobile responsiveness
- ✅ Cross-browser compatibility

## Troubleshooting

### Tests Timeout

- Increase timeout in `playwright.config.ts`
- Check if dev server is running
- Verify network requests are completing

### Elements Not Found

- Use `data-testid` for stable selectors
- Add explicit waits for dynamic content
- Check if element is in iframe or shadow DOM

### Flaky Tests

- Avoid hardcoded waits (`page.waitForTimeout()`)
- Use proper locators and assertions
- Run tests in headed mode to observe behavior

### Browser Installation Issues

```bash
# Reinstall browsers
npx playwright install --force

# Install system dependencies (Linux)
npx playwright install-deps
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Playwright API Reference](https://playwright.dev/docs/api/class-playwright)
- [Playwright Test Annotations](https://playwright.dev/docs/test-annotations)
- [Playwright Best Practices](https://playwright.dev/docs/best-practices)
