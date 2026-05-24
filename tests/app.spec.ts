import { test, expect } from '@playwright/test';

test.describe('Navigation', () => {
  test('home page renders with Sender and Receiver buttons', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toContainText("I'm ...");
    await expect(page.getByRole('button', { name: 'Sender' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Receiver' })).toBeVisible();
  });

  test('Sender button navigates to /sender/', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Sender' }).click();
    await expect(page).toHaveURL(/\/sender\//);
  });

  test('Receiver button navigates to /receiver/', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Receiver' }).click();
    await expect(page).toHaveURL(/\/receiver\//);
  });

  test('navbar brand links to home', async ({ page }) => {
    await page.goto('/sender/');
    await page.locator('nav').getByText('QR Code Generator').click();
    await expect(page).toHaveURL(/\/$/);
  });
});

test.describe('Sender Page', () => {
  test('renders sender page with title', async ({ page }) => {
    await page.goto('/sender/');
    await expect(page.getByRole('heading', { name: 'Sender' })).toBeVisible();
  });

  test('shows file uploader by default', async ({ page }) => {
    await page.goto('/sender/');
    await expect(page.getByText('Choose File')).toBeVisible();
  });

  test('shows all transfer profiles including XS', async ({ page }) => {
    await page.goto('/sender/');
    await expect(page.getByText('XS QR')).toBeVisible();
    await expect(page.getByText('Small QR')).toBeVisible();
    await expect(page.getByText('Medium QR')).toBeVisible();
    await expect(page.getByText('Large QR')).toBeVisible();
  });

  test('XS profile is selected by default', async ({ page }) => {
    await page.goto('/sender/');
    const xsButton = page.getByText('XS QR').locator('..');
    await expect(xsButton).toHaveClass(/border-primary/);
  });

  test('Choose File button hides when text is entered and reappears when cleared', async ({ page }) => {
    await page.goto('/sender/');
    const textarea = page.getByPlaceholder(/Enter or paste text/);
    const chooseFile = page.getByText('Choose File');

    // Initially visible
    await expect(chooseFile).toBeVisible();

    // Type text — should hide
    await textarea.fill('hello');
    await expect(chooseFile).not.toBeVisible();

    // Clear text — should reappear
    await textarea.fill('');
    await expect(chooseFile).toBeVisible();
  });

  test('text input generates QR code', async ({ page }) => {
    await page.goto('/sender/');
    const textarea = page.getByPlaceholder(/Enter or paste text/);
    await textarea.fill('Test message for QR code transfer');

    // Wait for QR code canvas to appear
    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
  });

  test('unicode text is accepted', async ({ page }) => {
    await page.goto('/sender/');
    const textarea = page.getByPlaceholder(/Enter or paste text/);
    await textarea.fill('こんにちは 🌍 émojis & spëcial çhàrs');

    await expect(page.locator('canvas')).toBeVisible({ timeout: 10000 });
  });

  test('switching profiles updates block size info', async ({ page }) => {
    await page.goto('/sender/');
    await page.getByText('Large QR').click();
    await expect(page.getByText('Block: 826 bytes')).toBeVisible();

    await page.getByText('XS QR').click();
    await expect(page.getByText('Block: 122 bytes')).toBeVisible();
  });

  test('advanced controls toggle works', async ({ page }) => {
    await page.goto('/sender/');
    await page.getByText('Show Advanced Controls').click();
    await expect(page.getByText('Block Size (bytes)')).toBeVisible();
    await expect(page.getByText('Interval (ms)')).toBeVisible();
  });
});

test.describe('Receiver Page', () => {
  test('renders receiver page with title', async ({ page }) => {
    await page.goto('/receiver/');
    await expect(page.getByRole('heading', { name: 'Receiver' })).toBeVisible();
  });

  test('shows Scan button', async ({ page }) => {
    await page.goto('/receiver/');
    await expect(page.getByRole('button', { name: 'Scan' })).toBeVisible();
  });
});

test.describe('Static Assets', () => {
  test('favicon icon is accessible', async ({ page }) => {
    const response = await page.request.get('/qr-code-icon.svg');
    expect(response.status()).toBe(200);
  });
});
