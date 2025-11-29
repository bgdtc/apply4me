import OpenAI from 'openai';
import { UserProfile } from '../types';
import { config } from '../config/config';

export class OpenAIService {
  private openai: OpenAI;
  private profile: UserProfile;

  constructor(profile: UserProfile) {
    this.openai = new OpenAI({
      apiKey: config.OPENAI_API_KEY,
    });
    this.profile = profile;
  }

  async generateAnswer(question: string, options?: string[]): Promise<string> {
    const context = `
      You are an intelligent assistant helping a user apply for jobs on LinkedIn.
      
      User Profile:
      First Name: ${this.profile.firstName}
      Last Name: ${this.profile.lastName}
      Email: ${this.profile.email}
      Phone: ${this.profile.phone}
      Headline: ${this.profile.headline}
      Summary: ${this.profile.summary}
      Experience: ${this.profile.experience}
      Skills: ${this.profile.skills.join(', ')}
      LinkedIn: ${this.profile.linkedInUrl}

      The user is filling out a job application form. 
      Question from the form: "${question}"
      ${options ? `Available options: ${options.join(', ')}` : ''}

      Instructions:
      1. Answer the question truthfully based on the User Profile.
      2. If options are provided, choose the best match from the options list strictly. Return ONLY the option text.
      3. If the question asks for a number (e.g. years of experience), return ONLY the digit(s) (e.g. "5"). Do not add "years" or text.
      4. **Specific Years of Experience Rules**:
         - If asked about **React, Node.js, TypeScript, JavaScript**: Return "8".
         - If asked about **Cloud, AWS, GCP**: Return "5".
         - If asked about other tech in your skills: Return "5".
         - If asked about tech NOT in your skills: Return "1" (to show willingness to learn but be honest-ish).
      5. If the question asks for **Salary** expectations:
         - If the currency is EUR or not specified, provide a number between 55000 and 65000.
         - Return ONLY the number (e.g. "60000").
      6. If you don't know the answer and it's not in the profile, make a reasonable professional guess or say "0" for numbers if unsure.
      7. Keep the answer concise.
    `;

    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: context }],
        temperature: 0.3,
      });

      const choices = response.choices;
      if (!choices || choices.length === 0 || !choices[0]?.message?.content) {
          return "";
      }
      let answer = choices[0].message.content.trim();
      
      // Remove prefixes like "Option: " or "Answer: " or "Phone:"
      answer = answer.replace(/^(Option|Answer|Reponse|Phone)\s*:?\s*/i, "").trim();
      
      // Remove quotes if present
      if (answer.startsWith('"') && answer.endsWith('"')) {
          answer = answer.slice(1, -1);
      }

      // Force numeric answer for experience questions if no options are provided
      // This cleans up "5 years" to "5"
      if (!options || options.length === 0) {
          if (question.match(/how many|combien|years|années|experience|expérience/i) && answer.match(/\d+/)) {
               // If the answer contains a number and the question seems numeric
               const digitMatch = answer.match(/(\d+)/);
               if (digitMatch && digitMatch[1]) {
                   answer = digitMatch[1];
               }
          }
          
          // Force numeric for Salary
          if (question.match(/salary|salaire/i)) {
             const digitMatch = answer.match(/(\d+)/);
             if (digitMatch && digitMatch[1]) {
                 answer = digitMatch[1];
             }
          }
      }
      
      console.log(`[AI] Q: "${question}" -> A: "${answer}"`);
      return answer;
    } catch (error) {
      console.error("Error calling OpenAI:", error);
      // Fallback defaults
      if (options && options.length > 0) return options[0] || "";
      return "Yes"; // Optimistic default
    }
  }
}

