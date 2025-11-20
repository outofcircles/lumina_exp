import { Profile, Story, Language, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from "../types";
import { validateContentSafety, SafetyError, sanitizeText } from "./safety";
import { checkRateLimit } from "./rateLimit";
import { supabase } from "./supabaseClient";

// Helper to call the Vercel Serverless Function
const callBackend = async (action: string, payload: any) => {
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

  const response = await fetch('/api/index', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ action, payload }),
  });

  if (!response.ok) {
    // Check for Vercel Timeout specifically
    if (response.status === 504) {
      throw new Error("The story is taking too long to write (Timeout). Please try again or try a different topic.");
    }
    
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.statusText}`);
  }

  return await response.json();
};

// --- NEW HELPER: Recursively sanitize object content ---
const recursiveSanitize = (data: any): any => {
  if (typeof data === 'string') {
    return sanitizeText(data);
  }
  if (Array.isArray(data)) {
    return data.map(item => recursiveSanitize(item));
  }
  if (typeof data === 'object' && data !== null) {
    const sanitizedObj: any = {};
    for (const key in data) {
      sanitizedObj[key] = recursiveSanitize(data[key]);
    }
    return sanitizedObj;
  }
  return data;
};

// --- EXPORTED FUNCTIONS ---

export const discoverProfiles = async (category: string, language: Language): Promise<Profile[]> => {
  let data = await callBackend('discoverProfiles', { category, language });
  
  // If safety check fails, sanitize instead of throwing error
  if (!validateContentSafety(data)) {
    console.warn("Unsafe content detected in profiles. Sanitizing...");
    data = recursiveSanitize(data);
  }
  return data;
};

export const generateStory = async (
  profile: Profile, 
  englishStyleName: string, 
  englishStyleDesc: string,
  hindiStyleName: string,
  hindiStyleDesc: string
): Promise<Story> => {
  let result = await callBackend('generateStory', {
    profile,
    englishStyleName,
    englishStyleDesc,
    hindiStyleName,
    hindiStyleDesc
  });

  if (!validateContentSafety(result)) {
    console.warn("Story content blocked by strict safety filters. Sanitizing...");
    // This will strip only the offending sentences from mainBody, introduction, etc.
    result = recursiveSanitize(result);
  }
  return result as Story;
};

export const discoverConcepts = async (field: string): Promise<ScienceItem[]> => {
  let data = await callBackend('discoverConcepts', { field });
  if (!validateContentSafety(data)) {
    console.warn("Concepts blocked by strict safety filters. Sanitizing...");
    data = recursiveSanitize(data);
  }
  return data;
};

export const generateScienceEntry = async (item: ScienceItem): Promise<ScienceEntry> => {
  let data = await callBackend('generateScienceEntry', { item });
  if (!validateContentSafety(data)) {
    console.warn("Science entry blocked by strict safety filters. Sanitizing...");
    data = recursiveSanitize(data);
  }
  return data;
};

export const discoverPhilosophies = async (theme: string): Promise<PhilosophyItem[]> => {
  let data = await callBackend('discoverPhilosophies', { theme });
  if (!validateContentSafety(data)) {
    console.warn("Philosophy list blocked by strict safety filters. Sanitizing...");
    data = recursiveSanitize(data);
  }
  return data;
};

export const generatePhilosophyEntry = async (item: PhilosophyItem): Promise<PhilosophyEntry> => {
  let data = await callBackend('generatePhilosophyEntry', { item });
  if (!validateContentSafety(data)) {
    console.warn("Philosophy entry blocked by strict safety filters. Sanitizing...");
    data = recursiveSanitize(data);
  }
  return data;
};

export const generateStoryImage = async (prompt: string, isMap: boolean = false): Promise<string | undefined> => {
  try { checkRateLimit(); } catch (e) { return undefined; }
  
  // For images, if the prompt is unsafe, sanitize it. 
  // If the sanitized prompt is empty, fallback to placeholder.
  let safePrompt = prompt;
  if (!validateContentSafety(safePrompt)) {
      safePrompt = sanitizeText(safePrompt);
      if (!safePrompt || safePrompt.trim().length < 5) {
          return `https://picsum.photos/800/600?grayscale&blur=2`;
      }
  }

  try {
    const imageUrl = await callBackend('generateImage', { prompt: safePrompt, isMap });
    return imageUrl;
  } catch (error) {
    return `https://picsum.photos/800/600?grayscale&blur=2`;
  }
};

export const generateStoryAudio = async (text: string, language: Language): Promise<string | undefined> => {
  try { checkRateLimit(); } catch (e) { return undefined; }
  
  // For audio, sanitize text so we don't generate speech for prohibited words
  let safeText = text;
  if (!validateContentSafety(safeText)) {
      safeText = sanitizeText(safeText);
      if (!safeText || safeText.trim().length === 0) return undefined;
  }

  try {
    return await callBackend('generateAudio', { text: safeText });
  } catch (error) {
    return undefined;
  }
};

export const getUserQuota = async (): Promise<{usage: number, limit: number}> => {
    try {
        return await callBackend('getUserQuota', {});
    } catch (e) {
        return { usage: 0, limit: 0 };
    }
};
