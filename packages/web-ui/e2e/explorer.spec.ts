import { expect, test } from '@playwright/test';

test('folder and file selections update the details panel', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Codebase Explorer' })).toBeVisible();

  await page.getByRole('treeitem', { name: /src/ }).click();
  await expect(page.locator('.details-panel .eyebrow')).toHaveText('Folder');
  await expect(page.locator('.details-panel h2')).toHaveText('src');

  await page.getByRole('button', { name: 'Expand src' }).click();
  await page.getByRole('treeitem', { name: /App\.tsx/ }).click();
  await expect(page.locator('.details-panel .eyebrow')).toHaveText('File');
  await expect(page.locator('.details-panel h2')).toHaveText('App.tsx');
});
