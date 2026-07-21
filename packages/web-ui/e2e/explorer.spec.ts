import { expect, test } from '@playwright/test';

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport + 1);
}

test('folder and file selections update the details panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Codebase Explorer' })).toBeVisible();

  await page.getByRole('treeitem', { name: /src/ }).click();
  await expect(page.locator('.details-panel .eyebrow')).toHaveText('Folder');
  await expect(page.locator('.details-panel h2')).toHaveText('src');
  await expect(page.getByRole('button', { name: 'Folder' })).toHaveClass(/active/);
  await expect(page.getByRole('combobox', { name: 'Graph view preset' })).toHaveValue('direct');

  await page.getByRole('button', { name: 'Expand src' }).click();
  await page.getByRole('treeitem', { name: /App\.tsx/ }).click();
  await expect(page.locator('.details-panel .eyebrow')).toHaveText('File');
  await expect(page.locator('.details-panel h2')).toHaveText('App.tsx');
  await expect(page.getByRole('button', { name: 'File neighborhood' })).toHaveClass(/active/);
});

test('graph presets and optional edges stay usable when a preset has no matches', async ({
  page,
}) => {
  await page.goto('/');

  const preset = page.getByRole('combobox', { name: 'Graph view preset' });
  await preset.selectOption('violations');
  await expect(page.locator('.graph-empty-overlay')).toContainText('No matching relationships');
  await preset.selectOption('overview');
  await expect(page.locator('.force-graph-canvas canvas')).toBeVisible();

  await page.getByLabel('Type-only').check();
  await page.getByLabel('Dynamic').check();
  await expect(page.getByLabel('Type-only')).toBeChecked();
  await expect(page.getByLabel('Dynamic')).toBeChecked();
});

test.describe('responsive explorer', () => {
  test('stacks panels and keeps toolbar controls usable on phones', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');

    await expect(page.getByRole('button', { name: 'Dashboard' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cycles/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Orphans/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Unused/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    const firstPanel = await page.locator('.explorer-grid > .tree-panel').boundingBox();
    const centerPanel = await page.locator('.explorer-grid > .center-column').boundingBox();
    const lastPanel = await page.locator('.explorer-grid > .right-column-container').boundingBox();
    expect(firstPanel).not.toBeNull();
    expect(centerPanel).not.toBeNull();
    expect(lastPanel).not.toBeNull();
    expect(centerPanel!.y).toBeGreaterThan(firstPanel!.y);
    expect(lastPanel!.y).toBeGreaterThan(centerPanel!.y);
  });

  test('reflows dashboard labels and bars without crowding', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Dashboard' }).click();
    await page.getByRole('button', { name: 'Explain health score' }).click();
    await expect(page.getByRole('region', { name: 'Health score explanation' })).toContainText(
      'Every scan starts at 100',
    );
    await expect(page.getByRole('region', { name: 'Health score explanation' })).toContainText(
      'Architecture violations',
    );

    const chartRow = page.locator('.dashboard-chart-row').first();
    await expect(chartRow.locator('strong')).toHaveText('GraphView.tsx');
    await expect(chartRow.locator('small')).toHaveText('src/components');

    const label = await chartRow.locator('.dashboard-chart-label').boundingBox();
    const bar = await chartRow.locator('.dashboard-bar').boundingBox();
    expect(label).not.toBeNull();
    expect(bar).not.toBeNull();
    expect(bar!.y).toBeGreaterThanOrEqual(label!.y + label!.height);
    await expectNoHorizontalOverflow(page);
  });

  test('uses a two-stage workspace layout on tablets', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/');

    const firstPanel = await page.locator('.explorer-grid > .tree-panel').boundingBox();
    const centerPanel = await page.locator('.explorer-grid > .center-column').boundingBox();
    const lastPanel = await page.locator('.explorer-grid > .right-column-container').boundingBox();
    expect(firstPanel).not.toBeNull();
    expect(centerPanel).not.toBeNull();
    expect(lastPanel).not.toBeNull();
    expect(Math.abs(firstPanel!.y - centerPanel!.y)).toBeLessThan(2);
    expect(lastPanel!.y).toBeGreaterThan(firstPanel!.y + 300);
    await expectNoHorizontalOverflow(page);
  });
});
