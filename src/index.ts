import { chromium } from 'playwright';
import fs from 'fs';
import { config } from './config/config';
import { UserProfile } from './types';
import { JobSearchService } from './services/JobSearchService';
import { ApplyService } from './services/ApplyService';

async function main() {
  // Load Profile
  if (!fs.existsSync(config.PROFILE_PATH)) {
    console.error(`Profile not found at ${config.PROFILE_PATH}. Please create it.`);
    process.exit(1);
  }
  const profile: UserProfile = JSON.parse(fs.readFileSync(config.PROFILE_PATH, 'utf-8'));

  // Check Auth
  if (!fs.existsSync(config.AUTH_FILE_PATH)) {
    console.error(`Auth file not found at ${config.AUTH_FILE_PATH}. Please run 'npm run login' first.`);
    process.exit(1);
  }

  // Launch Browser
  const browser = await chromium.launch({ headless: config.HEADLESS });
  const context = await browser.newContext({ storageState: config.AUTH_FILE_PATH });
  const page = await context.newPage();

  try {
    // 1. Search Jobs
    const searchService = new JobSearchService(page);
    const jobs = await searchService.searchJobs();

    if (jobs.length === 0) {
        console.log("No jobs found.");
        return;
    }

    console.log(`Found ${jobs.length} jobs. Starting application process...`);

    // 2. Apply
    const applyService = new ApplyService(page, profile);

    for (const job of jobs) {
        // Apply
        const success = await applyService.applyToJob(job);
        console.log(`Job ${job.title}: ${success ? 'APPLIED' : 'SKIPPED/FAILED'}`);
        
        // Wait a bit between applications to be safe
        await page.waitForTimeout(5000 + Math.random() * 5000);
    }

  } catch (error) {
    console.error("Fatal error:", error);
  } finally {
    await browser.close();
  }
}

main();

