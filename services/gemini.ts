
import { Profile, Story, Language, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry } from "../types";
import { validateContentSafety, SafetyError } from "./safety";
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
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || `Server error: ${response.statusText}`);
  }

  return await response.json();
};

// --- EXPORTED FUNCTIONS ---
// All below remain identical signature, just using the updated callBackend

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
    const imageUrl = await callBackend('generateImage', { prompt, isMap });
    return imageUrl;
  } catch (error) {
    return `https://picsum.photos/800/600?grayscale&blur=2`;
  }
};

export const generateStoryAudio = async (text: string, language: Language): Promise<string | undefined> => {
  try { checkRateLimit(); } catch (e) { return undefined; }
  if (!validateContentSafety(text)) return undefined;

  try {
    return await callBackend('generateAudio', { text });
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
