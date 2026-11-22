import { test,expect } from '@playwright/test';
test('login has no public registration',async({page})=>{
 await page.goto('/login');
 await expect(page.getByRole('heading',{name:'Đăng nhập'})).toBeVisible();
 await expect(page.getByRole('link',{name:/sign up|đăng ký/i})).toHaveCount(0);
});
test('workspace and CSV export require owner authentication',async({page})=>{
 await page.goto('/app');
 await expect(page).toHaveURL(/\/login/);
 await page.goto('/api/transactions/export');
 await expect(page).toHaveURL(/\/login/);
});
