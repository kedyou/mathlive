import type { MathfieldElement } from '../../src/public/mathfield-element';

import { test, expect } from '@playwright/test';

// Use process.platform (the real OS), as in physical-keyboard.spec.ts
const modifierKey = process.platform === 'darwin' ? 'Meta' : 'Control';

// On macOS, Cmd+A doesn't select all in Playwright's bundled Chromium
const selectAll = (browserName: string) =>
  modifierKey === 'Meta' && browserName === 'chromium'
    ? 'Control+a'
    : `${modifierKey}+a`;

const skipClipboardOnWebkitCI = (browserName: string) =>
  test.skip(
    browserName === 'webkit' && Boolean(process.env.CI),
    'Keyboard paste does not work when headless on Linux'
  );

test('home/end move to the start/end of a single-line mathfield', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  await mf.pressSequentially('bc');
  await mf.press('Home');
  await mf.pressSequentially('a');
  await mf.press('End');
  await mf.pressSequentially('d');

  const latex = await mf.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('abcd');
});

test('home/end stay inside the aligned environment', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  // Enter creates a two-row aligned environment, with the caret on the second row
  await mf.press('Enter');
  await mf.pressSequentially('x');
  await mf.press('Home');
  await mf.pressSequentially('a');
  await mf.press('End');
  await mf.pressSequentially('y');

  const latex = await mf.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('\\begin{align}a & \\\\ x & y\\end{align}');
});

test('typing a delimiter in the first aligned column moves it to the second column', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  await mf.press('Enter');
  await mf.pressSequentially('x=y');

  const latex = await mf.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('\\begin{align} & \\\\ x & =y\\end{align}');
});

test('pasting text into the first aligned column keeps the left-hand side', async ({
  page,
  browserName,
}) => {
  skipClipboardOnWebkitCI(browserName);
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');
  const textarea = page.locator('#ta-2');

  // Copy plain text, as if from another application
  await textarea.fill('a=b');
  await textarea.press(selectAll(browserName));
  await textarea.press(`${modifierKey}+c`);

  await mf.press('Enter');
  await mf.press(`${modifierKey}+v`);

  let latex = await mf.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('\\begin{align} & \\\\ a & =b\\end{align}');

  // Pasting after existing content in the first column
  await textarea.fill('+1=2');
  await textarea.press(selectAll(browserName));
  await textarea.press(`${modifierKey}+c`);

  await mf.press('Enter');
  await mf.pressSequentially('x');
  await mf.press(`${modifierKey}+v`);

  latex = await mf.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('\\begin{align} & \\\\ a & =b\\\\ x+1 & =2\\end{align}');
});

test('pasting a copied mathfield expression into the first aligned column moves the delimiter', async ({
  page,
  browserName,
}) => {
  skipClipboardOnWebkitCI(browserName);
  await page.goto('/dist/playwright-test-page/');
  const source = page.locator('#mf-2');
  const target = page.locator('#mf-1');

  // Copying from a mathfield puts serialized atoms on the clipboard,
  // which are pasted through a different path than plain text.
  // (Headless Firefox only keeps the text flavors, so this path is only
  // covered by Chromium.)
  await source.pressSequentially('a=b');
  await source.press(selectAll(browserName));
  await source.press(`${modifierKey}+c`);

  await target.press('Enter');
  await target.press(`${modifierKey}+v`);

  const latex = await target.evaluate((mfe: MathfieldElement) => mfe.value);
  expect(latex).toBe('\\begin{align} & \\\\ a & =b\\end{align}');
});

//
// Kedyou overrides of upstream behavior. The upstream tests these replace are
// commented out in physical-keyboard.spec.ts and virtual-keyboard.spec.ts.
//

// Replaces 'escape to enter/exit latex mode'
test('escape cancels latex mode', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  // Escape enters latex mode, and a second Escape discards the command
  await mf.press('Escape');
  await mf.pressSequentially('\\frac');
  await mf.press('Escape');
  await mf.pressSequentially('x');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe('x');

  // As upstream: Escape does nothing when latex mode is disabled
  const mf5 = page.locator('#mf-5');
  await mf5.press('Escape');
  await mf5.pressSequentially('lozenge');
  await mf5.press('Escape');

  expect(await mf5.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    'lozenge'
  );
});

test('enter accepts the latex command suggestion', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  // `\fr` is completed to `\frac`, with the caret in the numerator
  await mf.pressSequentially('\\fr');
  await mf.press('Enter');
  await mf.pressSequentially('x');
  await mf.press('ArrowDown');
  await mf.pressSequentially('y');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\frac{x}{y}'
  );
});

// Replaces 'backslash to enter, enter to exit latex mode'
test('enter exits latex mode, then creates an aligned environment', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');

  // As upstream: Enter exits latex mode
  const mf = page.locator('#mf-1');
  await mf.pressSequentially('\\frac');
  await mf.press('Enter');
  await mf.pressSequentially('x');
  await mf.press('ArrowDown');
  await mf.pressSequentially('y');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\frac{x}{y}'
  );

  // In math mode, Enter moves the content into an aligned environment
  const mf5 = page.locator('#mf-5');
  await mf5.pressSequentially('\\lozenge');
  await mf5.press('Enter');

  expect(await mf5.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\begin{align}\\backslash lozenge & \\\\  & \\end{align}'
  );
});

// Replaces 'mathbb with superscript (issue #2867)'
test('enter keeps \\mathbb{R}^0 intact in the aligned environment', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  await mf.pressSequentially('\\mathbb{R}^0');
  await mf.press('Enter');

  // Should serialize as \mathbb{R}^0, not \mathbb{R^0}
  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\begin{align}\\mathbb{R}^0 & \\\\  & \\end{align}'
  );
});

test('enter splits an equation at its delimiter into an aligned environment', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  await mf.pressSequentially('a=b');
  await mf.press('Enter');
  // The caret is on the new row
  await mf.pressSequentially('c');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\begin{align}a & =b\\\\ c & \\end{align}'
  );
});

// Replaces 'backspace on empty displaylines (issue #2739)'
test('deleting everything leaves an empty aligned environment', async ({
  page,
  browserName,
}) => {
  const errors: Error[] = [];
  page.on('pageerror', (error) => errors.push(error));

  await page.goto('/dist/playwright-test-page/');
  const mf = page.locator('#mf-1');

  // addRowAfter creates an aligned environment rather than displaylines
  await mf.pressSequentially('a');
  await mf.press(`${modifierKey}+Enter`);
  await mf.pressSequentially('b');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\begin{align}a & \\\\ b & \\end{align}'
  );

  // The caret can't leave the aligned environment, so it is kept
  await mf.press(selectAll(browserName));
  await mf.press('Backspace');
  await mf.press('Backspace');

  expect(await mf.evaluate((mfe: MathfieldElement) => mfe.value)).toBe(
    '\\begin{align} & \\end{align}'
  );
  expect(errors).toEqual([]);
});

// Replaces 'virtual keyboard with two math fields'
test('virtual keyboard stays visible when no mathfield is focused', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const keycap = (label: string) =>
    page.locator(`.MLK__layer.is-visible [aria-label="${label}"]`).first();

  // As upstream: the keyboard types into the focused mathfield
  await page.locator('.ML__virtual-keyboard-toggle').nth(0).click();
  await keycap('1').click();
  await page.locator('#mf-2').click();
  await page.waitForTimeout(100);
  await keycap('2').click();

  expect(
    await page.locator('#mf-1').evaluate((mfe: MathfieldElement) => mfe.value)
  ).toBe('1');
  expect(
    await page.locator('#mf-2').evaluate((mfe: MathfieldElement) => mfe.value)
  ).toBe('2');

  // Our client decides when to hide the keyboard, so it is not hidden when
  // focus leaves the mathfields (upstream hides it after 300ms)
  await page.locator('#ta-2').click();
  await page.waitForTimeout(500);

  await expect(page.getByRole('toolbar').getByText('123')).toBeVisible();
});

test('virtual keyboard close button hides the keyboard', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');

  await page.locator('.ML__virtual-keyboard-toggle').nth(0).click();
  const toolbar = page.getByRole('toolbar');
  await expect(toolbar.getByText('123')).toBeVisible();

  await page.evaluate(() => {
    window.mathVirtualKeyboard.addEventListener('manual-close', () => {
      document.body.dataset.manualClose = 'true';
    });
  });
  await toolbar.locator(`[data-command='"closeVirtualKeyboard"']`).click();

  await expect(page.locator('body')).toHaveAttribute(
    'data-manual-close',
    'true'
  );
  await toolbar.getByText('123').waitFor({ state: 'detached' });
});

test('virtual keyboard menu inserts a matrix', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');

  await page.locator('.ML__virtual-keyboard-toggle').nth(0).click();
  await page.locator('.MLK__layer.is-visible .MLK__menu-toggle').click();

  // The keyboard menu only has the insert menus of the mathfield menu
  await expect(page.getByRole('menuitem')).toHaveText([
    'Insert Matrix',
    'Insert',
  ]);

  await page.getByRole('menuitem', { name: 'Insert Matrix' }).click();
  await page.locator('[data-tooltip="2 × 3"]').click();

  await expect
    .poll(() =>
      page.locator('#mf-1').evaluate((mfe: MathfieldElement) => mfe.value)
    )
    .toBe(
      '\\begin{pmatrix}\\placeholder{} & \\placeholder{} & \\placeholder{}\\\\ \\placeholder{} & \\placeholder{} & \\placeholder{}\\end{pmatrix}'
    );
  await expect(page.getByRole('menu')).toHaveCount(0);
});

test('virtual keyboard menu insert keeps the mathfield focused', async ({
  page,
}) => {
  await page.goto('/dist/playwright-test-page/');
  const keycap = (label: string) =>
    page.locator(`.MLK__layer.is-visible [aria-label="${label}"]`).first();

  await page.locator('.ML__virtual-keyboard-toggle').nth(0).click();
  await page.locator('.MLK__layer.is-visible .MLK__menu-toggle').click();
  await page.getByRole('menuitem', { name: 'Insert', exact: true }).click();
  await page.getByRole('menuitem', { name: /Absolute Value/ }).click();
  await expect(page.getByRole('menu')).toHaveCount(0);

  // The keyboard still types into the mathfield, inside the inserted template
  await keycap('1').click();

  await expect
    .poll(() =>
      page.locator('#mf-1').evaluate((mfe: MathfieldElement) => mfe.value)
    )
    .toBe('|1|');
  expect(
    await page
      .locator('#mf-1')
      .evaluate((mfe: MathfieldElement) => mfe.hasFocus())
  ).toBe(true);
});

test('virtual keyboard menu is dismissed with escape', async ({ page }) => {
  await page.goto('/dist/playwright-test-page/');

  await page.locator('.ML__virtual-keyboard-toggle').nth(0).click();
  await page.locator('.MLK__layer.is-visible .MLK__menu-toggle').click();
  await expect(page.getByRole('menu')).toHaveCount(1);

  await page.keyboard.press('Escape');

  await expect(page.getByRole('menu')).toHaveCount(0);
  await expect(page.getByRole('toolbar').getByText('123')).toBeVisible();
  expect(
    await page
      .locator('#mf-1')
      .evaluate((mfe: MathfieldElement) => mfe.hasFocus())
  ).toBe(true);
});
