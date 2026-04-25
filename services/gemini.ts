import { Profile, Story, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry, StoryLength, ReadingLevel, NarratorStyle, StoryResearch, ScienceResearch, PhilosophyResearch } from "../types";
import { SafetyError } from "./safety";
import { RateLimitError, checkRateLimit } from "./rateLimit";
import { supabase } from "./supabaseClient";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callBackend = async (action: string, payload: unknown, retries = 3): Promise<unknown> => {
  checkRateLimit();

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('/api/index', {
        method: 'POST',
        headers,
        body: JSON.stringify({ action, payload }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          const errorData = await response.json().catch(() => ({}));
          const waitTime = (i + 1) * 2000;
          console.warn(`Rate limit hit. Retrying in ${waitTime}ms...`);
          if (i === retries - 1) {
            throw new RateLimitError(errorData.error || "Daily usage limit reached. Please wait a moment.");
          }
          await delay(waitTime);
          continue;
        }

        if (response.status === 504) {
          throw new Error("The story is taking too long to write (Timeout). Please try again.");
        }

        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Server error: ${response.statusText}`);
      }

      return await response.json();

    } catch (error: unknown) {
      if (error instanceof RateLimitError) throw error;
      if (i < retries - 1) {
        await delay(1000);
        continue;
      }
      throw error;
    }
  }
  throw new Error("Request failed after all retries.");
};

// --- EXPORTED FUNCTIONS ---

export const discoverProfiles = async (category: string, language: string): Promise<Profile[]> => {
  const data = await callBackend('discoverProfiles', { category, language });
  return data as Profile[];
};

export const researchStory = async (profile: Profile): Promise<StoryResearch> => {
  const data = await callBackend('researchStory', { profile });
  return data as StoryResearch;
};

export const researchScience = async (item: ScienceItem): Promise<ScienceResearch> => {
  const data = await callBackend('researchScience', { item });
  return data as ScienceResearch;
};

export const researchPhilosophy = async (item: PhilosophyItem): Promise<PhilosophyResearch> => {
  const data = await callBackend('researchPhilosophy', { item });
  return data as PhilosophyResearch;
};

export const generateStory = async (
  profile: Profile,
  englishStyleName: string,
  englishStyleDesc: string,
  hindiStyleName: string,
  hindiStyleDesc: string,
  storyLength: StoryLength = 'medium',
  readingLevel: ReadingLevel = 'middle',
  research?: StoryResearch,
  regenerate?: boolean,
): Promise<Story> => {
  const result = await callBackend('generateStory', {
    profile, englishStyleName, englishStyleDesc, hindiStyleName, hindiStyleDesc,
    storyLength, readingLevel, research,
    ...(regenerate ? { regenerateSalt: Math.random().toString(36).slice(2, 8) } : {}),
  });
  return result as Story;
};

export const discoverConcepts = async (field: string): Promise<ScienceItem[]> => {
  const data = await callBackend('discoverConcepts', { field });
  return data as ScienceItem[];
};

export const generateScienceEntry = async (
  item: ScienceItem,
  storyLength: StoryLength = 'medium',
  readingLevel: ReadingLevel = 'middle',
  narratorStyle?: NarratorStyle,
  research?: ScienceResearch,
  regenerate?: boolean,
): Promise<ScienceEntry> => {
  const data = await callBackend('generateScienceEntry', {
    item, storyLength, readingLevel,
    narratorStyle: narratorStyle ? { name: narratorStyle.name, persona: narratorStyle.persona, voiceCharacteristics: narratorStyle.voiceCharacteristics, avoidances: narratorStyle.avoidances } : undefined,
    research,
    ...(regenerate ? { regenerateSalt: Math.random().toString(36).slice(2, 8) } : {}),
  });
  return data as ScienceEntry;
};

export const discoverPhilosophies = async (theme: string): Promise<PhilosophyItem[]> => {
  const data = await callBackend('discoverPhilosophies', { theme });
  return data as PhilosophyItem[];
};

export const generatePhilosophyEntry = async (
  item: PhilosophyItem,
  storyLength: StoryLength = 'medium',
  readingLevel: ReadingLevel = 'middle',
  narratorStyle?: NarratorStyle,
  research?: PhilosophyResearch,
  regenerate?: boolean,
): Promise<PhilosophyEntry> => {
  const data = await callBackend('generatePhilosophyEntry', {
    item, storyLength, readingLevel,
    narratorStyle: narratorStyle ? { name: narratorStyle.name, persona: narratorStyle.persona, voiceCharacteristics: narratorStyle.voiceCharacteristics, avoidances: narratorStyle.avoidances } : undefined,
    research,
    ...(regenerate ? { regenerateSalt: Math.random().toString(36).slice(2, 8) } : {}),
  });
  return data as PhilosophyEntry;
};

export const generateStoryImage = async (prompt: string, isMap: boolean = false): Promise<string | undefined> => {
  try { checkRateLimit(); } catch { return undefined; }

  try {
    const imageUrl = await callBackend('generateImage', { prompt, isMap }, 0);
    return imageUrl as string;
  } catch {
    return undefined;
  }
};

export const getUserQuota = async (): Promise<{ usage: number; limit: number }> => {
  try {
    const result = await callBackend('getUserQuota', {}, 0);
    if (!result || typeof result !== 'object') {
      return { usage: 0, limit: 1000 };
    }
    const r = result as { usage?: unknown; limit?: unknown };
    return {
      usage: typeof r.usage === 'number' ? r.usage : 0,
      limit: typeof r.limit === 'number' ? r.limit : 1000,
    };
  } catch (e) {
    console.warn("Failed to fetch quota:", e);
    return { usage: 0, limit: 1000 };
  }
};

export const generateStoryAudio = async (_text: string, _language: string): Promise<string | undefined> => {
  return undefined;
};

export { RateLimitError, SafetyError };
