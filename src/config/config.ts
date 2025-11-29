import dotenv from 'dotenv';
import path from 'path';
import { AppConfig } from '../types';

dotenv.config();

const getSearchUrl = () => {
  const keywords = encodeURIComponent(process.env.SEARCH_KEYWORDS || 'Software Engineer');
  const location = encodeURIComponent(process.env.SEARCH_LOCATION || 'Remote');
  
  let url = `https://www.linkedin.com/jobs/search/?f_AL=true&keywords=${keywords}&location=${location}`;
  
  // Add Remote filter if requested (f_WT=2)
  if (process.env.JOB_REMOTE === 'true') {
    url += '&f_WT=2';
  }

  return url;
};

export const config: AppConfig = {
  HEADLESS: process.env.HEADLESS === 'true',
  USER_DATA_DIR: path.join(process.cwd(), 'user-data'),
  AUTH_FILE_PATH: path.join(process.cwd(), 'user-data', 'auth.json'),
  PROFILE_PATH: path.join(process.cwd(), 'user-data', 'profile.json'),
  OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
  SEARCH_URL: getSearchUrl()
};
