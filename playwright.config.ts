import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
if (existsSync('.env.local')) process.loadEnvFile('.env.local');
const chrome='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export default defineConfig({testDir:'tests/e2e',timeout:30000,use:{baseURL:'http://127.0.0.1:3100',browserName:'chromium',launchOptions:existsSync(chrome)?{executablePath:chrome}:{},headless:true},webServer:{command:'pnpm exec next start -H 127.0.0.1 -p 3100',url:'http://127.0.0.1:3100/login',reuseExistingServer:!process.env.CI,timeout:120000}});
