import { test, expect, type Page } from '@playwright/test';

const ready =
  !!process.env.PERSONAL_OS_TEST_EMAIL &&
  !!process.env.PERSONAL_OS_TEST_PASSWORD &&
  !!process.env.NEXT_PUBLIC_FINANION_SUPABASE_URL &&
  !!process.env.PERSONAL_OS_OWNER_USER_ID;

test.skip(!ready, 'Requires an isolated Supabase test project and owner credentials.');

async function pickOption(page: Page, label: string, optionText: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: optionText, exact: true }).click();
}

test('creates a project, account, expense and task with connected totals', async ({ page }) => {
  const stamp = Date.now();
  const projectName = `E2E project ${stamp}`;
  const accountName = `E2E cash ${stamp}`;
  const taskName = `E2E task ${stamp}`;

  await page.goto('/login');
  await page.getByLabel('Email').fill(process.env.PERSONAL_OS_TEST_EMAIL!);
  await page.getByLabel('Mật khẩu').fill(process.env.PERSONAL_OS_TEST_PASSWORD!);
  await page.getByRole('button', { name: 'Vào workspace' }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.goto('/app/finance/accounts?new=1');
  await page.getByLabel('Tên tài khoản').fill(accountName);
  await pickOption(page, 'Loại', 'Tiền mặt');
  await page.getByRole('button', { name: 'Lưu', exact: true }).click();
  await expect(page.getByText(accountName)).toBeVisible();

  await page.goto('/app/projects?new=1');
  await page.getByLabel('Tên dự án').fill(projectName);
  await page.getByRole('button', { name: 'Lưu dự án' }).click();
  await expect(page.getByText(projectName)).toBeVisible();

  await page.goto('/app/finance/transactions?new=1');
  await pickOption(page, 'Loại giao dịch', 'Chi tiêu');
  await page.getByLabel('Số tiền').fill('20000');
  await pickOption(page, 'Tài khoản', accountName);
  await pickOption(page, 'Danh mục', 'Dự án');
  await pickOption(page, 'Dự án (tùy chọn)', projectName);
  await page.getByLabel('Mô tả').fill(`E2E expense ${stamp}`);
  await page.getByRole('button', { name: 'Lưu giao dịch' }).click();
  await expect(page.getByText(`E2E expense ${stamp}`)).toBeVisible();

  await page.goto('/app/projects');
  const projectCard = page.locator('.card').filter({ hasText: projectName });
  await expect(projectCard).toContainText('20.000 ₫');

  await page.goto('/app/tasks?new=1');
  await page.getByLabel('Tên công việc').fill(taskName);
  await pickOption(page, 'Dự án', projectName);
  await page.getByRole('button', { name: 'Lưu công việc' }).click();
  await expect(page.getByText(taskName)).toBeVisible();
});
