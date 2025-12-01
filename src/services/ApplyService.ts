import { Page, Locator } from 'playwright';
import { OpenAIService } from './OpenAIService';
import { Job, UserProfile } from '../types';

export class ApplyService {
  private page: Page;
  private ai: OpenAIService;
  private profile: UserProfile;

  constructor(page: Page, profile: UserProfile) {
    this.page = page;
    this.profile = profile;
    this.ai = new OpenAIService(profile);
  }

  async applyToJob(job: Job): Promise<boolean> {
    console.log(`Attempting to apply to: ${job.title} at ${job.company}`);

    try {
        // Go to job page
        await this.page.goto(job.link);
        await this.page.waitForLoadState('domcontentloaded');
        await this.page.waitForTimeout(3000); // Wait for load to be visually complete
        
        // Strategy: Find button primarily by TEXT or ARIA LABEL which is more stable than CSS classes
        console.log("Looking for apply button...");

        // Define locators to try in order
        const applyLocators = [
            this.page.locator('button.jobs-apply-button'),
            this.page.locator('.jobs-apply-button--top-card button'),
            this.page.locator('button[aria-label*="Easy Apply"]'),
            this.page.locator('button[aria-label*="Candidature simplifiée"]'),
            this.page.getByText('Easy Apply', { exact: false }),
            this.page.getByText('Candidature simplifiée', { exact: false }),
            this.page.getByText('Postuler maintenant', { exact: false })
        ];

        let applyBtn: Locator | null = null;

        for (const locator of applyLocators) {
            if (await locator.count() > 0 && await locator.first().isVisible()) {
                applyBtn = locator.first();
                console.log("Found button using locator strategy.");
                break;
            }
        }

        if (!applyBtn) {
            console.log("No Easy Apply button found (checked text and classes).");
            // Debug: print some page content to understand where we are
            const title = await this.page.title();
            console.log(`Current Page Title: ${title}`);
            return false;
        }
        
        const btnText = await applyBtn.innerText();
        console.log(`Clicking button with text: "${btnText}"`);

        // 1. Scroll to center to avoid sticky headers
        await applyBtn.scrollIntoViewIfNeeded();

        // 2. Hide potential overlays (sticky navs, chat, ads) using JS
        await this.page.evaluate(() => {
            const overlays = document.querySelectorAll('.global-nav, .msg-overlay-list-bubble, .jobs-search-results-list__header, .authentication-outlet');
            overlays.forEach(el => {
                if (el instanceof HTMLElement) el.style.display = 'none';
            });
        });

        // 3. Use JS click which is often more reliable than Playwright's trusted click for this specific case
        await applyBtn.evaluate((el) => {
            if (el instanceof HTMLElement) el.click();
        });
        
        console.log("Clicked Apply button.");

        // Wait for modal
        try {
            await this.page.waitForSelector('.jobs-easy-apply-content, .artdeco-modal', { timeout: 5000 });
            console.log("Application modal detected.");
        } catch (e) {
            console.log("No modal appeared. Likely an external application.");
            return false;
        }
        
        // Form Loop
        let maxSteps = 15; // Increased steps
        let step = 0;

        while (step < maxSteps) {
            await this.page.waitForTimeout(1000); // Stability wait
            
            // Scope everything to the modal to avoid interacting with background page
            const modal = this.page.locator('.artdeco-modal');
            if (await modal.count() === 0) {
                 console.log("Modal closed unexpectedly (in loop). Assuming success or dismissal.");
                 return true;
            }

            // Always try to fill form fields if we are in the modal
            // This ensures fields are filled even if button detection is tricky initially
            await this.handleFormFields(modal);

            // Check for Submit Button
            const submitBtn = modal.locator('button[aria-label="Submit application"], button[aria-label="Envoyer la candidature"]');
            const submitBtnText = modal.locator('button').filter({ hasText: /Submit application|Envoyer la candidature/i });

            if ((await submitBtn.isVisible()) || (await submitBtnText.count() > 0 && await submitBtnText.first().isVisible())) {
                if (await submitBtn.isVisible()) {
                    await submitBtn.click();
                } else {
                    await submitBtnText.first().click();
                }

                console.log("Application Submitted!");
                await this.page.waitForTimeout(3000);
                
                // Close success modal
                const doneBtn = this.page.locator('button:has-text("Done"), button:has-text("Terminé")');
                if (await doneBtn.isVisible()) {
                    await doneBtn.click();
                }
                return true;
            }

            // Check for Review Button first (usually leads to Submit)
            const reviewBtn = modal.locator('button[aria-label="Review your application"], button[aria-label="Vérifier votre candidature"]');
            const reviewBtnText = modal.locator('button').filter({ hasText: /Review|Vérifier/i });

            if (await reviewBtn.isVisible() || (await reviewBtnText.count() > 0 && await reviewBtnText.first().isVisible())) {
                 const btn = (await reviewBtn.isVisible()) ? reviewBtn : reviewBtnText.first();
                 console.log("Clicking Review button...");
                 await btn.click();
                 await this.page.waitForTimeout(2000); // Wait longer for summary to load
                 continue; // Re-loop to find Submit
            }

            // Check for Next Button
            const nextBtn = modal.locator('button[aria-label="Continue to next step"], button[aria-label="Aller à l’étape suivante"]');
            const nextBtnText = modal.locator('button').filter({ hasText: /Next|Suivant/i });

            if (await nextBtn.isVisible() || (await nextBtnText.count() > 0 && await nextBtnText.first().isVisible())) {
                 const btn = (await nextBtn.isVisible()) ? nextBtn : nextBtnText.first();
                 console.log("Clicking Next button...");
                 await btn.click();
                 await this.page.waitForTimeout(1000);
                 
                 // Check for errors immediately after Next
                 const errorMsg = modal.locator('.artdeco-inline-feedback--error');
                 if (await errorMsg.count() > 0) {
                    console.log("Form validation failed. Stopping application.");
                    return false;
                 }
                 continue;
            } else {
                 // Maybe stuck or finished?
                 // Check for "Submit" one more time
                 const submitPostReview = modal.locator('button[aria-label="Submit application"], button[aria-label="Envoyer la candidature"]');
                 if (await submitPostReview.isVisible()) {
                     await submitPostReview.click();
                     console.log("Application Submitted (post-review)!");
                     await this.page.waitForTimeout(3000);
                     const doneBtn = this.page.locator('button:has-text("Done"), button:has-text("Terminé")');
                     if (await doneBtn.isVisible()) await doneBtn.click();
                     return true;
                 }
                 
                 // Check if modal closed (success?) - Recheck fresh state
                 if (await this.page.locator('.artdeco-modal').count() === 0) {
                     console.log("Modal closed unexpectedly. Assuming success or dismissal.");
                     return true; 
                 }

                 console.log("Unknown state or loading. Waiting...");
                 
                 // --- FORCE SUBMIT CHECK ---
                 // Sometimes the text is just "Review" then it submits automatically? 
                 // Or maybe the button text is slightly different.
                 // Let's try to find the primary button in the footer and click it if it looks like a forward action
                 const footerButtons = modal.locator('.artdeco-modal__actionbar button.artdeco-button--primary');
                 if (await footerButtons.count() > 0 && await footerButtons.first().isVisible()) {
                      const btnText = await footerButtons.first().innerText();
                      console.log(`Found primary footer button: "${btnText}"`);
                      if (btnText.match(/Review|Submit|Next|Suivant|Vérifier|Envoyer/i)) {
                          await footerButtons.first().click();
                          await this.page.waitForTimeout(1000);
                          continue;
                      }
                 }
            }

            step++;
        }

    } catch (e) {
        console.error("Error applying to job:", e);
        return false;
    }
    
    return false;
  }

  private async handleFormFields(modal: Locator) {
     try {
         // Detect Inputs within Modal
         // 1. Text Inputs (including email, tel, number, etc.)
         const textInputs = await modal.locator('input[type="text"], input[type="email"], input[type="tel"], input[type="number"], textarea').all();
         
         for (const input of textInputs) {
             try {
                 const isVisible = await input.isVisible().catch(() => false);
                 if (!isVisible) continue;

                 const id = await input.getAttribute('id').catch(() => null);
                 if (!id) continue;
                 
                 // Check if already filled
                 const val = await input.inputValue().catch(() => '');
                 
                 // Special handling for "0" values in experience fields
                 let shouldRefill = false;
                 const label = await modal.locator(`label[for="${id}"]`).innerText().catch(() => '');
                 if (!label) continue;

                 if (val) {
                     if (val === '0') {
                         // Check if it looks like an experience question
                         const isExperienceQuestion = /experience|years|années|ans/i.test(label);
                         if (isExperienceQuestion) {
                             console.log(`Found '0' value in experience field ("${label}"), refilling...`);
                             shouldRefill = true;
                             await input.fill(''); // Clear the 0
                         } else {
                             continue; // Keep the 0 for non-experience fields
                         }
                     } else {
                         continue; // Keep other pre-filled values
                     }
                 }

                 let answer = await this.ai.generateAnswer(label);
                 
                 // If we are refilling a numeric experience field, ensure we get a number
                 // and if the AI returns something non-numeric or too low, fallback to user preference
                 if (shouldRefill) {
                     // Simple heuristic: if the answer is not a number or is 0, force a realistic value
                     // Based on user request: "3 to 6 or 8"
                     const num = parseInt(answer.replace(/\D/g, ''));
                     if (isNaN(num) || num === 0) {
                         // Calculate a random reasonable number between 3 and 6 as a fallback
                         // or based on the "Senior" title in profile (~4-5 years usually)
                         const randomExp = Math.floor(Math.random() * (6 - 3 + 1) + 3); // 3 to 6
                         answer = randomExp.toString();
                     }
                 }

                 await input.fill(answer);
             } catch (e) {
                 // Element probably detached, ignore
             }
         }

         // 2. Radio Buttons / Selects
         const fieldsets = await modal.locator('fieldset').all();
         for (const fieldset of fieldsets) {
             try {
                 const legend = await fieldset.locator('legend').first();
                 let question = "";
                 // The question can be in the legend OR in a span aria-hidden="true" just above/inside
                 if (await legend.isVisible()) {
                     question = await legend.innerText().catch(() => '');
                 }
                 
                 // Sometimes the visual question is in a span, and legend is hidden/screenreader only
                 // Try to find a preceding visual label if legend is empty or weird
                 if (!question) {
                      const preSpan = await fieldset.locator('span[aria-hidden="true"]').first();
                      if (await preSpan.isVisible()) {
                          question = await preSpan.innerText();
                      }
                 }

                 const radios = await fieldset.locator('input[type="radio"]').all();
                 if (radios.length > 0) {
                     let isChecked = false;
                     for (const r of radios) {
                         if (await r.isChecked().catch(() => false)) isChecked = true;
                     }
                     
                     if (!isChecked) {
                         const options: string[] = [];
                         const optionMap = new Map<string, any>();
                         
                         for (const r of radios) {
                             const id = await r.getAttribute('id').catch(() => null);
                             if (!id) continue;
                             // LinkedIn labels often have extra spans/junk. Get pure text.
                             const labelEl = modal.locator(`label[for="${id}"]`);
                             let label = await labelEl.innerText().catch(() => '');
                             
                             // Clean label (remove newlines, "Yes", "No" hidden text)
                             label = label.replace(/\n/g, " ").trim();

                             options.push(label);
                             optionMap.set(label, r);
                         }
                         
                         const answer = await this.ai.generateAnswer(question, options);
                         
                         // Loose matching
                         const match = options.find(o => 
                             o.toLowerCase().includes(answer.toLowerCase()) || 
                             answer.toLowerCase().includes(o.toLowerCase())
                         );
                         
                         // Strategy: Click the LABEL associated with the radio, not the radio itself.
                         // Often the radio input is hidden or tiny, but the label is clickable.
                         if (match && optionMap.has(match)) {
                             const radioId = await optionMap.get(match).getAttribute('id');
                             if (radioId) {
                                 await modal.locator(`label[for="${radioId}"]`).click().catch(() => {
                                     // Fallback to clicking the input directly if label click fails
                                     return optionMap.get(match).click({ force: true }); 
                                 });
                             }
                         } else {
                             // Fallback: if binary Yes/No question, try to map intelligently
                             if (options.length === 2 && (options.some(o => o.match(/yes|oui/i)) && options.some(o => o.match(/no|non/i)))) {
                                  const yesOption = options.find(o => o.match(/yes|oui/i));
                                  const noOption = options.find(o => o.match(/no|non/i));
                                  
                                  let targetOption = null;
                                  if (answer.match(/yes|oui/i) && yesOption) targetOption = yesOption;
                                  else if (answer.match(/no|non/i) && noOption) targetOption = noOption;
                                  
                                  if (targetOption && optionMap.has(targetOption)) {
                                      const radioId = await optionMap.get(targetOption).getAttribute('id');
                                      if (radioId) {
                                          await modal.locator(`label[for="${radioId}"]`).click().catch(() => optionMap.get(targetOption).click({ force: true }));
                                      }
                                  } else {
                                      if (radios[0]) await radios[0].click({ force: true }).catch(() => {}); // Default
                                  }
                             } else {
                                  if (radios[0]) await radios[0].click({ force: true }).catch(() => {});
                             }
                         }
                     }
                 }
             } catch (e) {
                 // Fieldset detached
             }
         }
         
         // 3. Select dropdowns
         const selects = await modal.locator('select').all();
         for (const select of selects) {
             try {
                const isVisible = await select.isVisible().catch(() => false);
                if (!isVisible) continue;

                const id = await select.getAttribute('id').catch(() => null);
                if (!id) continue;

                const label = await modal.locator(`label[for="${id}"]`).innerText().catch(() => '');
                
                // Check if valid options exist
                const options = await select.locator('option').allInnerTexts().catch(() => []);
                if (options.length === 0) continue;

                if (label) {
                     const answer = await this.ai.generateAnswer(label, options);
                     await select.selectOption({ label: answer }).catch(() => {
                          // If exact label fails, try index 1
                          return select.selectOption({ index: 1 }).catch(() => {});
                     });
                }
             } catch (e) {
                 // Select detached
             }
         }

         // 4. File Uploads (Resume)
         // We look for ANY file input in the modal, regardless of visibility
         // because LinkedIn often hides the real input.
         const fileInputs = await modal.locator('input[type="file"]').all();
         for (const input of fileInputs) {
             try {
                 if (this.profile.cvPath) {
                     // Check if it already has a value or if UI indicates upload
                     // Hard to check specific UI, so just try setting files. 
                     // Playwright won't re-upload if it's the same usually, but let's be safe.
                     
                     // Only upload if we haven't already (check value empty)
                     // Note: some inputs might clear value from DOM after upload but show in UI. 
                     // But usually safe to re-upload.
                     
                     console.log(`Uploading CV from: ${this.profile.cvPath}`);
                     await input.setInputFiles(this.profile.cvPath).catch((e) => {
                         console.log("Upload attempt failed (harmless if redundant):", e);
                     });
                 }
             } catch (e) {
                 console.log("Error handling file upload:", e);
             }
         }
        // 5. Checkboxes (Terms, Privacy, etc.)
        const checkboxes = await modal.locator('input[type="checkbox"]').all();
        for (const checkbox of checkboxes) {
            try {
                const id = await checkbox.getAttribute('id').catch(() => null);
                if (!id) continue;

                const label = await modal.locator(`label[for="${id}"]`).innerText().catch(() => '');
                // Determine if we should check it
                // Usually "I agree", "I understand", "Yes" are good defaults
                // If the label implies a negative (e.g. "I do NOT want..."), we might not want to check it.
                // Let's ask AI simply
                
                const isChecked = await checkbox.isChecked().catch(() => false);
                if (isChecked) continue; // Already good

                // Simple heuristic first
                if (label.match(/agree|accept|confirm|compris|accepte|confirme|lu et accepté/i)) {
                    await checkbox.check();
                } else {
                    // Ask AI for complex ones
                    const answer = await this.ai.generateAnswer(label, ["Yes", "No"]);
                    if (answer.toLowerCase().includes("yes")) {
                        await checkbox.check();
                    }
                }
            } catch (e) {
                // Checkbox detached
            }
        }
     } catch (error) {
         console.log("Error in handleFormFields (harmless if nav changed):", error);
     }
  }
}
