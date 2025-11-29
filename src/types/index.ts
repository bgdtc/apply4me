export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  link: string;
  description?: string;
}

export interface UserProfile {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  cvPath: string;
  headline: string;
  summary: string;
  experience: string; // Text description of experience for AI context
  skills: string[];
  linkedInUrl: string;
}

export interface AppConfig {
  HEADLESS: boolean;
  USER_DATA_DIR: string;
  AUTH_FILE_PATH: string;
  PROFILE_PATH: string;
  OPENAI_API_KEY: string;
  SEARCH_URL: string;
}

