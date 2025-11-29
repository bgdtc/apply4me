import { Page, ElementHandle } from 'playwright';
import { Job, AppConfig } from '../types';
import { config } from '../config/config';

export class JobSearchService {
  private page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async searchJobs(): Promise<Job[]> {
    console.log(`Navigating to: ${config.SEARCH_URL}`);
    await this.page.goto(config.SEARCH_URL);
    
    // Debug: Dump HTML structure to understand what's going on if it fails
    try {
        console.log("Waiting for ANY common job container...");
        
        // Wait for a very generic element to ensure page loaded
        await this.page.waitForSelector('body', { timeout: 10000 });
        await this.page.waitForTimeout(3000); // Extra safety

        // Try to identify what kind of layout we have by checking for known classes
        const layouts = {
            "search-results": await this.page.$('.jobs-search-results-list'),
            "scaffold": await this.page.$('.scaffold-layout__list-container'),
            "basic-list": await this.page.$('ul.jobs-search__results-list'),
            "feed-updates": await this.page.$('.feed-shared-update-v2') // Sometimes shows as feed
        };

        console.log("Detected Layouts:", Object.keys(layouts).filter(k => layouts[k as keyof typeof layouts] !== null));

    } catch (e) {
        console.log("Error detecting layout:", e);
    }

    await this.page.waitForTimeout(2000);

    const jobs: Job[] = [];
    
    // Strategy: Find ALL links that look like job links, regardless of container
    // This is more robust than looking for containers first.
    // Links usually match /jobs/view/ or have job posting IDs
    
    console.log("Scanning for job links directly...");
    
    const jobLinks = await this.page.$$('a[href*="/jobs/view/"], a[href*="currentJobId"]');
    console.log(`Found ${jobLinks.length} potential job links.`);

    const processedIds = new Set<string>();

    for (const link of jobLinks) {
        try {
            const href = await link.getAttribute('href');
            if (!href) continue;

            // Extract ID
            const jobIdMatch = href.match(/currentJobId=(\d+)/) || href.match(/\/jobs\/view\/(\d+)/);
            const id = jobIdMatch ? jobIdMatch[1] : null;

            if (!id || processedIds.has(id)) continue;
            processedIds.add(id);

            // Get Title (usually inside the link or the parent text)
            // Cleanest way: Navigate up to find the card container, then search down
            // But finding parent is tricky in simple Playwright without XPath
            // Let's just try to get text from the link itself first
            let title = await link.innerText();
            const splitTitle = title.split('\n');
            if (splitTitle.length > 0 && splitTitle[0]) {
                title = splitTitle[0].trim();
            } else {
                title = title.trim();
            }

            if (title.length < 3) {
                 // Maybe the link wraps the title element?
                 const innerTitle = await link.$('.job-card-list__title');
                 if (innerTitle) title = await innerTitle.innerText();
            }

            // Company Name (heuristics)
            // Often next to the title or in a sibling container
            let company = "Unknown";
            // Try to find a company element relative to this link using XPath or closest
            // Since we are iterating links, let's just store basic info. 
            // We can get details later if needed.
            
            console.log(`Found Job: ${id} - ${title}`);

            jobs.push({
                id,
                title: title.trim(),
                company: company,
                location: 'Unknown',
                link: href.startsWith('http') ? href : `https://www.linkedin.com${href}`
            });
            
            if (jobs.length >= 25) break; // Limit to first page

        } catch (e) {
            // Ignore parsing errors for single items
        }
    }

    return jobs;
  }
}
