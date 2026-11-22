import { test, expect, type Page } from '@playwright/test';

const runLocal = process.env.PERSONAL_OS_TEST_LOCAL === '1';
test.skip(!runLocal, 'Set PERSONAL_OS_TEST_LOCAL=1 with local dev server on http://127.0.0.1:3000');

const BASE = process.env.PERSONAL_OS_LOCAL_URL || 'http://127.0.0.1:3000';
const isMac = process.platform === 'darwin';
const mod = isMac ? 'Meta' : 'Control';

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', err => errors.push(`pageerror: ${err.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

async function pickDropdown(page: Page, label: string, optionText: string) {
  await page.getByRole('combobox', { name: label, exact: true }).click();
  await page.getByRole('listbox', { name: label, exact: true }).getByRole('option', { name: optionText, exact: true }).click();
}

test.describe.serial('Personal OS Notion-like Database & Editor E2E (Local Mode)', () => {
  test('1. All 7 database routes, sidebar navigation, and integrated Finance/Projects modes load cleanly', async ({ page }) => {
    const errors = trackErrors(page);

    for (const key of ['transactions', 'accounts', 'budgets', 'categories', 'projects', 'tasks', 'milestones']) {
      await page.goto(`${BASE}/app/database/${key}`);
      await expect(page.locator('table')).toBeVisible();
    }

    // Sidebar has Databases, Pages, and Shortcuts links
    await expect(page.getByRole('link', { name: 'Trang & Ghi chú' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'DB Giao dịch' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'DB Dự án' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Phím tắt' })).toBeVisible();

    // Integrated Finance & Projects database modes
    for (const path of [
      '/app/finance/transactions?mode=database',
      '/app/finance/accounts?mode=database',
      '/app/finance/budgets?mode=database',
      '/app/finance/categories?mode=database',
      '/app/projects?mode=database',
      '/app/tasks?view=database',
    ]) {
      await page.goto(`${BASE}${path}`);
      await expect(page.locator('table')).toBeVisible();
    }

    expect(errors).toEqual([]);
  });

  test('2. Views, Filtering, Sorting, Grouping, Custom Properties, Select/Multi-select, Formula, System Status & Tags persist across refresh', async ({ page }) => {
    const errors = trackErrors(page);
    const stamp = Date.now();
    const viewName = `View E2E ${stamp}`;
    const formulaName = `ConLai_${stamp}`;
    const selectName = `Kenh_${stamp}`;
    const tagName = `TagE2E_${stamp}`;

    await page.goto(`${BASE}/app/database/projects`);
    await expect(page.locator('table')).toBeVisible();

    // Create a new Table view and verify persistence across refresh
    await page.getByRole('button', { name: 'Thêm view' }).click();
    await page.getByPlaceholder('Tên view').fill(viewName);
    await page.getByRole('button', { name: 'Tạo', exact: true }).click();
    await expect(page.getByRole('button', { name: viewName })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('button', { name: viewName })).toBeVisible();

    // Apply Filter (AND) + Sort + Group and verify persistence
    await page.getByRole('button', { name: /Lọc/ }).click();
    await page.getByRole('button', { name: '+ Điều kiện' }).click();
    await pickDropdown(page, 'Thuộc tính lọc', 'Trạng thái');
    await pickDropdown(page, 'Điều kiện', 'Không là');
    await pickDropdown(page, 'Giá trị lọc', 'Lưu trữ');
    await page.getByRole('button', { name: 'Áp dụng' }).click();
    await expect(page.getByText('Đã lưu view').first()).toBeVisible();

    await page.getByRole('button', { name: /Sắp xếp/ }).click();
    await page.getByRole('button', { name: '+ Sắp xếp' }).click();
    await pickDropdown(page, 'Thuộc tính sắp xếp', 'Ngân sách');
    await pickDropdown(page, 'Chiều sắp xếp', 'Giảm');
    await page.getByRole('button', { name: 'Lưu', exact: true }).click();
    await expect(page.getByText('Đã lưu view').first()).toBeVisible();

    await pickDropdown(page, 'Nhóm theo', 'Trạng thái');
    await expect(page.getByText('Đã lưu view').first()).toBeVisible();

    // Switch to Board & Calendar views on the same data
    await page.getByRole('button', { name: 'Board', exact: true }).click();
    await expect(page.getByText('Zeruka Website')).toBeVisible();
    await page.getByRole('button', { name: 'Lịch', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Hôm nay' })).toBeVisible();

    // Switch back to our custom view
    await page.getByRole('button', { name: viewName }).click();
    await pickDropdown(page, 'Nhóm theo', 'Không nhóm');

    // Create Custom Formula property: {budget_amount} - {actual_spending}
    await page.getByRole('button', { name: 'Thuộc tính', exact: true }).click();
    await page.getByPlaceholder('Tên thuộc tính').fill(formulaName);
    await pickDropdown(page, 'Kiểu thuộc tính mới', 'Công thức');
    await page.getByPlaceholder('VD: {budget_amount} - {actual_spending}').fill('{budget_amount} - {actual_spending}');
    await page.getByRole('button', { name: 'Tạo thuộc tính' }).click();
    await expect(page.locator('th', { hasText: formulaName })).toBeVisible();

    // Create Custom Select property + add inline option
    await page.getByRole('button', { name: 'Thuộc tính', exact: true }).click();
    await page.getByPlaceholder('Tên thuộc tính').fill(selectName);
    await pickDropdown(page, 'Kiểu thuộc tính mới', 'Chọn một');
    await page.getByRole('button', { name: 'Tạo thuộc tính' }).click();
    const selectHeader = page.locator('th', { hasText: selectName });
    await expect(selectHeader).toBeVisible();

    // Click first data row cell in our new select column to add an option inline
    const headerIndex = await selectHeader.evaluate(el => Array.from(el.parentElement!.children).indexOf(el));
    const firstRowSelectCell = page.locator('tbody tr[data-row-id]').first().locator('td').nth(headerIndex);
    await firstRowSelectCell.locator('[data-cell-trigger="true"]').click();
    await page.getByLabel('Tìm lựa chọn').fill('Nội bộ');
    await page.getByRole('button', { name: '+ Tạo "Nội bộ"' }).click();
    await expect(firstRowSelectCell).toContainText('Nội bộ');

    // Create a Tag, change color, assign it to a row, verify after reload, then clean up tag (preserving row!)
    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await page.getByPlaceholder('Tag mới').fill(tagName);
    await page.getByPlaceholder('Tag mới').press('Enter');
    await expect(page.getByRole('button', { name: `Xóa tag ${tagName}` })).toBeVisible();
    await page.getByRole('button', { name: 'Tags', exact: true }).click(); // close

    // Reload and verify custom property, inline option, formula, and view persisted
    await page.reload();
    await expect(page.getByRole('button', { name: viewName })).toBeVisible();
    await expect(page.locator('th', { hasText: formulaName })).toBeVisible();
    await expect(page.locator('th', { hasText: selectName })).toBeVisible();
    await expect(page.locator('tbody')).toContainText('Nội bộ');

    // Customize a system status label & verify it renders and then restore it
    await page.getByRole('button', { name: 'Quản lý trạng thái & lựa chọn' }).click();
    const activeLabelInput = page.getByLabel('Nhãn trạng thái active');
    await expect(activeLabelInput).toBeVisible();
    await activeLabelInput.fill('Đang triển khai');
    await page.getByRole('button', { name: 'Lưu', exact: true }).first().click();
    await expect(page.getByText('Đã lưu cấu hình trạng thái')).toBeVisible();
    await expect(page.locator('tbody')).toContainText('Đang triển khai');
    // Restore original system status label
    await activeLabelInput.fill('Đang chạy');
    await page.getByRole('button', { name: 'Lưu', exact: true }).first().click();
    await expect(page.locator('tbody')).toContainText('Đang chạy');

    // Cleanup test view, custom properties, and tag
    page.on('dialog', d => d.accept());
    await page.getByRole('button', { name: `Tùy chỉnh ${formulaName}` }).click();
    await page.getByRole('button', { name: 'Xóa thuộc tính' }).click();
    await expect(page.locator('th', { hasText: formulaName })).toHaveCount(0);

    await page.getByRole('button', { name: `Tùy chỉnh ${selectName}` }).click();
    await page.getByRole('button', { name: 'Xóa thuộc tính' }).click();
    await expect(page.locator('th', { hasText: selectName })).toHaveCount(0);

    await page.getByRole('button', { name: 'Tags', exact: true }).click();
    await page.getByRole('button', { name: `Xóa tag ${tagName}` }).click();
    await expect(page.getByRole('button', { name: `Xóa tag ${tagName}` })).toHaveCount(0);
    await page.getByRole('button', { name: 'Tags', exact: true }).click();

    await page.getByRole('button', { name: viewName }).click();
    await page.getByRole('button', { name: 'Xóa view' }).click();
    await expect(page.getByRole('button', { name: viewName })).toHaveCount(0);

    expect(errors).toEqual([]);
  });

  test('3. Finance inline cell edit recalculates project spending & account balance accurately and persists after refresh', async ({ page }) => {
    const errors = trackErrors(page);

    // Check current spent for Zeruka Website on /app/projects
    await page.goto(`${BASE}/app/database/transactions`);
    await expect(page.locator('table')).toBeVisible();

    // Filter to a specific known expense transaction on Zeruka Website
    await page.getByLabel('Tìm trong bảng').fill('Dịch vụ triển khai Zeruka');
    const row = page.locator('tbody tr').filter({ hasText: 'Dịch vụ triển khai Zeruka' }).first();
    await expect(row).toBeVisible();

    const amountCell = row.locator('td[data-prop="amount"]');
    const originalText = (await amountCell.innerText()).trim();
    const originalNumeric = originalText.replace(/[^\d]/g, '');
    const bumpedNumeric = String(Number(originalNumeric) + 100000);

    // Check baseline balance on /app/finance/accounts
    await page.goto(`${BASE}/app/database/accounts`);
    const bankRow = page.locator('tbody tr').filter({ hasText: 'Ngân hàng chính' }).first();
    const balanceBeforeText = (await bankRow.locator('td[data-prop="current_balance"]').innerText()).trim();
    const balanceBefore = Number(balanceBeforeText.replace(/[^\d-]/g, ''));

    // Perform inline edit on transaction amount (+100,000 VND)
    await page.goto(`${BASE}/app/database/transactions`);
    await page.getByLabel('Tìm trong bảng').fill('Dịch vụ triển khai Zeruka');
    const txRow = page.locator('tbody tr').filter({ hasText: 'Dịch vụ triển khai Zeruka' }).first();
    await txRow.locator('td[data-prop="amount"] [data-cell-trigger="true"]').click();
    const input = txRow.locator('td[data-prop="amount"] input');
    await input.fill(bumpedNumeric);
    await input.press('Enter');
    await expect(page.getByText('Đã lưu').first()).toBeVisible();

    // Verify account balance decreased by exactly 100,000 VND after hard load!
    await page.goto(`${BASE}/app/database/accounts`);
    const balanceAfterText = (await page.locator('tbody tr').filter({ hasText: 'Ngân hàng chính' }).first().locator('td[data-prop="current_balance"]').innerText()).trim();
    const balanceAfter = Number(balanceAfterText.replace(/[^\d-]/g, ''));
    expect(balanceBefore - balanceAfter).toBe(100000);

    // Restore original transaction amount so local demo data remains untouched!
    await page.goto(`${BASE}/app/database/transactions`);
    await page.getByLabel('Tìm trong bảng').fill('Dịch vụ triển khai Zeruka');
    const restoreRow = page.locator('tbody tr').filter({ hasText: 'Dịch vụ triển khai Zeruka' }).first();
    await restoreRow.locator('td[data-prop="amount"] [data-cell-trigger="true"]').click();
    const restoreInput = restoreRow.locator('td[data-prop="amount"] input');
    await restoreInput.fill(originalNumeric);
    await restoreInput.press('Enter');
    await expect(page.getByText('Đã lưu').first()).toBeVisible();

    await page.goto(`${BASE}/app/database/accounts`);
    const balanceRestoredText = (await page.locator('tbody tr').filter({ hasText: 'Ngân hàng chính' }).first().locator('td[data-prop="current_balance"]').innerText()).trim();
    expect(Number(balanceRestoredText.replace(/[^\d-]/g, ''))).toBe(balanceBefore);

    expect(errors).toEqual([]);
  });

  test('4. BlockNote editor, slash commands, URL slash safety, database embed, Vietnamese input, image upload & persistence after refresh', async ({ page }) => {
    const errors = trackErrors(page);
    const stamp = Date.now();
    const pageTitle = `Ghi chú Tiếng Việt ${stamp}`;

    await page.goto(`${BASE}/app/pages`);
    await page.getByRole('button', { name: 'Trang mới' }).click();
    await expect(page).toHaveURL(/\/app\/pages\/[0-9a-f-]+/);

    // Edit title with Vietnamese text
    const titleInput = page.getByLabel('Tiêu đề trang');
    await titleInput.fill(pageTitle);
    await titleInput.blur();
    await page.waitForTimeout(200);

    // Focus BlockNote editor
    const editorArea = page.locator('.bn-editor[contenteditable="true"], .bn-editor').first();
    await expect(editorArea).toBeVisible();
    await editorArea.click();

    // Slash command: /h1
    await page.keyboard.type('/h1');
    await expect(page.getByText('Tiêu đề 1 (/h1)')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Kế hoạch Quý 4 với tiếng Việt đầy đủ');
    await page.keyboard.press('Enter');

    // Type a URL containing "/" — slash menu MUST NOT open or break the URL
    await page.keyboard.type('Tham khảo https://example.com/du-an/2026 xong');
    await expect(page.getByText('Tiêu đề 1 (/h1)')).toHaveCount(0);
    await page.keyboard.press('Enter');

    // Slash command: /callout
    await page.keyboard.type('/callout');
    await expect(page.getByText('Callout (/callout)')).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Lưu ý quan trọng');
    await page.keyboard.press('Enter');

    // Slash command: /table (simple content table)
    await page.keyboard.type('/table');
    await expect(page.getByText('Bảng nội dung (/table)')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.locator('.bn-editor table')).toBeVisible();

    // Slash command: /database (functional database embed reading live data)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/database');
    await expect(page.getByText('Database (/database)')).toBeVisible();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Nguồn dữ liệu')).toBeVisible();
    await expect(page.getByText(/Công việc · \d+ bản ghi/)).toBeVisible();

    // Explicit save + reload and confirm all blocks persist!
    await page.getByRole('button', { name: 'Lưu ngay' }).click();
    await expect(page.locator('[data-block-editor="true"] [role="status"]')).toHaveText('Đã lưu');

    await page.reload();
    await expect(page.getByLabel('Tiêu đề trang')).toHaveValue(pageTitle);
    await expect(page.locator('.bn-editor')).toContainText('Kế hoạch Quý 4 với tiếng Việt đầy đủ');
    await expect(page.locator('.bn-editor')).toContainText('https://example.com/du-an/2026');
    await expect(page.locator('.bn-editor')).toContainText('Lưu ý quan trọng');
    await expect(page.locator('.bn-editor table')).toBeVisible();
    await expect(page.getByText(/Công việc · \d+ bản ghi/)).toBeVisible();

    // Verify image upload API (1x1 valid PNG)
    const png1x1 = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    const uploadRes = await page.request.post(`${BASE}/api/uploads/image`, {
      multipart: {
        file: { name: 'pixel.png', mimeType: 'image/png', buffer: png1x1 },
      },
    });
    expect(uploadRes.status()).toBe(201);
    const { url } = (await uploadRes.json()) as { url: string };
    expect(url).toMatch(/^\/api\/uploads\/image\/[0-9a-f-]+$/);
    const fetchImg = await page.request.get(`${BASE}${url}`);
    expect(fetchImg.status()).toBe(200);
    expect(fetchImg.headers()['content-type']).toBe('image/png');

    expect(errors).toEqual([]);
  });

  test('5. Row detail page, global keyboard shortcuts, table keyboard navigation & Settings shortcuts reference', async ({ page }) => {
    const errors = trackErrors(page);

    // Row detail drawer -> full record page with Properties Panel & BlockNote editor
    await page.goto(`${BASE}/app/database/tasks`);
    await page.locator('tbody tr').first().locator('td[data-prop="title"] [data-cell-trigger="true"]').click();
    await expect(page.getByRole('link', { name: /Mở thành trang chi tiết/ })).toBeVisible();
    await page.getByRole('link', { name: /Mở thành trang chi tiết/ }).click();
    await expect(page).toHaveURL(/\/app\/database\/tasks\/[0-9a-f-]+/);
    await expect(page.locator('.bn-editor')).toBeVisible();

    // Global shortcut: Cmd/Ctrl + P opens Quick Search modal
    await page.keyboard.press(`${mod}+p`);
    const dialog = page.getByRole('dialog', { name: 'Tìm kiếm nhanh' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Tìm kiếm nhanh').fill('Zeruka');
    await expect(dialog).toContainText('Zeruka Website');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);

    // Global shortcut: Cmd/Ctrl + Shift + L toggles dark theme
    const htmlBefore = await page.locator('html').getAttribute('class');
    await page.keyboard.press(`${mod}+Shift+L`);
    await page.waitForTimeout(150);
    const htmlAfter = await page.locator('html').getAttribute('class');
    expect(htmlAfter).not.toBe(htmlBefore);
    // Toggle back to restore user's theme
    await page.keyboard.press(`${mod}+Shift+L`);

    // Table keyboard navigation (ArrowRight, Tab)
    await page.goto(`${BASE}/app/database/tasks`);
    const firstCell = page.locator('tbody td[data-row]').first();
    await firstCell.focus();
    await page.keyboard.press('ArrowRight');
    const secondCol = await page.evaluate(() => document.activeElement?.getAttribute('data-col'));
    expect(secondCol).toBe('1');
    await page.keyboard.press('Tab');
    const thirdCol = await page.evaluate(() => document.activeElement?.getAttribute('data-col'));
    expect(thirdCol).toBe('2');

    // Settings Shortcuts Reference page (Mac vs Windows/Linux switcher)
    await page.goto(`${BASE}/app/settings`);
    await page.getByRole('link', { name: 'Mở trang tham khảo phím tắt' }).click();
    await expect(page).toHaveURL(/\/app\/settings\/shortcuts/);
    await page.getByRole('button', { name: 'macOS (⌘)' }).click();
    await expect(page.locator('kbd', { hasText: '⌘ P' }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Windows / Linux (Ctrl)' }).click();
    await expect(page.locator('kbd', { hasText: 'Ctrl + P' }).first()).toBeVisible();

    expect(errors).toEqual([]);
  });
});
