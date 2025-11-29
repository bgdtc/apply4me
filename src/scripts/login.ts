import { chromium } from 'playwright';
import { config } from '../config/config';
import fs from 'fs';
import path from 'path';

async function login() {
  console.log('Launching browser for login...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log('Navigating to LinkedIn...');
  await page.goto('https://www.linkedin.com/login');

  console.log('Please log in manually in the browser window.');
  console.log('Waiting for successful login (detecting feed or profile)...');

  try {
    // Wait for a selector that appears after login (e.g., the global nav bar or feed)
    // Increase timeout to 5 minutes to give user enough time
    await page.waitForURL('**/feed/**', { timeout: 300000 }); 
    console.log('Login detected!');

    // Save storage state
    const authPath = config.AUTH_FILE_PATH;
    await context.storageState({ path: authPath });
    console.log(`Session saved to ${authPath}`);

  } catch (error) {
    console.error('Timeout or error during login:', error);
  } finally {
    await browser.close();
  }
}

login();

