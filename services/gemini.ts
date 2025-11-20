import { Profile, Story, Language, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from "../types";
import { validateContentSafety, SafetyError } from "./safety";
import { checkRateLimit } from "./rateLimit";
import { supabase } from "./supabaseClient";

// Custom Error for Rate Limits
export class RateLimitError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RateLimitError";
  }
}

// Helper to wait
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to call the Vercel Serverless Function with Retry Logic
const callBackend = async (action: string, payload: any, retries = 3) => {
  checkRateLimit(); 
  
  // Get Token
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  
  const headers: any = {
    'Content-Type': 'application/json',
  };
  if (token) {
      headers['Authorization'] = `Bearer ${token}`;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('/api/index', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ action, payload }),
      });

      if (!response.ok) {
        // Handle 429 specifically with retry
        if (response.status === 429) {
            const errorData = await response.json().catch(() => ({}));
            const waitTime = (i + 1) * 2000; // Wait 2s, 4s, 6s...
            console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
            
            // If it's the last retry, throw the error
            if (i === retries - 1) {
                throw new RateLimitError(errorData.error || "Daily usage limit reached. Please wait a moment.");
            }
            
            await delay(waitTime);
            continue; // Retry loop
        }

        // Check for Vercel Timeout
        if (response.status === 504) {
          throw new Error("The story is taking too long to write (Timeout). Please try again.");
        }
        
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: any) {
       // If it's a rate limit error we just threw, let it bubble up
       if (error instanceof RateLimitError) throw error;
       
       // If it's a network error (fetch failed), retry
       if (i < retries - 1) {
           await delay(1000);
           continue;
       }
       throw error;
    }
  }
};

// --- EXPORTED FUNCTIONS ---

export const discoverProfiles = async (category: string, language: Language): Promise<Profile[]> => {
  const data = await callBackend('discoverProfiles', { category, language });
  if (!validateContentSafety(data)) throw new SafetyError("Content blocked by safety filters.");
  return data;
};

export const generateStory = async (
  profile: Profile, 
  englishStyleName: string, 
  englishStyleDesc: string,
  hindiStyleName: string,
  hindiStyleDesc: string
): Promise<Story> => {
  const result = await callBackend('generateStory', {
    profile,
    englishStyleName,
    englishStyleDesc,
    hindiStyleName,
    hindiStyleDesc
  });

  if (!validateContentSafety(result)) throw new SafetyError("Story content blocked by safety filters.");
  return result as Story;
};

export const discoverConcepts = async (field: string): Promise<ScienceItem[]> => {
  const data = await callBackend('discoverConcepts', { field });
  if (!validateContentSafety(data)) throw new SafetyError("Concepts blocked by safety filters.");
  return data;
};

export const generateScienceEntry = async (item: ScienceItem): Promise<ScienceEntry> => {
  const data = await callBackend('generateScienceEntry', { item });
  if (!validateContentSafety(data)) throw new SafetyError("Science entry blocked by safety filters.");
  return data;
};

export const discoverPhilosophies = async (theme: string): Promise<PhilosophyItem[]> => {
  const data = await callBackend('discoverPhilosophies', { theme });
  if (!validateContentSafety(data)) throw new SafetyError("Philosophy list blocked by safety filters.");
  return data;
};

export const generatePhilosophyEntry = async (item: PhilosophyItem): Promise<PhilosophyEntry> => {
  const data = await callBackend('generatePhilosophyEntry', { item });
  if (!validateContentSafety(data)) throw new SafetyError("Philosophy entry blocked by safety filters.");
  return data;
};

export const generateStoryImage = async (prompt: string, isMap: boolean = false): Promise<string | undefined> => {
  try { checkRateLimit(); } catch (e) { return undefined; }
  
  if (!validateContentSafety(prompt)) return `https://picsum.photos/800/600?grayscale&blur=2`;

  try {
    // Pass 'retries=0' to generateImage calls so they fail fast if quota is low
    const imageUrl = await callBackend('generateImage', { prompt, isMap }, 0);
    return imageUrl;
  } catch (error) {
    return `https://picsum.photos/800/600?grayscale&blur=2`;
  }
};

export const generateStoryAudio = async (text: string, language: Language): Promise<string | undefined> => {
  // Audio disabled per request
  return undefined;
};

export const getUserQuota = async (): Promise<{usage: number, limit: number}> => {
    try {
        return await callBackend('getUserQuota', {}, 0);
    } catch (e) {
        return { usage: 0, limit: 0 };
    }
};
