import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- CONFIGURATION ---
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const config = {
  maxDuration: 60,
};

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

const DAILY_QUOTA_LIMIT = 999999999; 
// Increment version to invalidate old caches
const CACHE_VERSION = "v7-mixed-content-strategy";

// --- RETRY HELPER ---
const runWithRetry = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      const status = error.status || error.response?.status;
      const message = error.message?.toLowerCase() || '';
      const isRateLimit = status === 429 || message.includes('usage limit') || message.includes('resource exhausted');
      const isOverloaded = status === 503 || message.includes('overloaded');

      if ((!isRateLimit && !isOverloaded) || i === retries - 1) {
        throw error;
      }

      const baseDelay = isRateLimit ? 2000 : 1000; 
      const delay = baseDelay * Math.pow(2, i); 
      console.warn(`Gemini ${status || 'Error'} Hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { action, payload } = req.body;
  const authHeader = req.headers.authorization;

  let userId = null;
  if (supabase && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized: Please log in.' });
    userId = user.id;

    const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
    if (quotaActions.includes(action)) {
        let { data: profile } = await supabase.from('user_profiles').select('*').eq('id', userId).single();
        if (!profile) profile = { daily_usage: 0, last_reset: new Date().toISOString().split('T')[0] };
        const today = new Date().toISOString().split('T')[0];
        if (profile.last_reset !== today) await supabase.from('user_profiles').update({ daily_usage: 0, last_reset: today }).eq('id', userId);
    }
  }

  try {
    // 1. Handle Discovery Actions with Mixed Content Strategy
    const discoveryActions = ['discoverProfiles', 'discoverConcepts', 'discoverPhilosophies'];
    
    if (supabase && discoveryActions.includes(action)) {
        const categoryKey = action + JSON.stringify(payload.category || payload.field || payload.theme);
        const contentHash = crypto.createHash('sha256').update(categoryKey + CACHE_VERSION).digest('hex');

        // Try to fetch cache
        const { data: fullCache } = await supabase.from('cached_content').select('content').eq('hash', contentHash).single();
        
        // OPTION A: Serve full cache (30% chance)
        if (fullCache && Math.random() > 0.7) { 
            console.log(`[CACHE HIT] Serving full cached list for ${action}`);
            return res.status(200).json(fullCache.content);
        }

        // OPTION B: Mix Strategy
        let cachedItem = null;
        if (fullCache && Array.isArray(fullCache.content) && fullCache.content.length > 0) {
            cachedItem = fullCache.content[Math.floor(Math.random() * fullCache.content.length)];
        }

        // FIX: Determine how many fresh items we need
        // If we have a cached item, we need 2. If not (first run), we need 3.
        const itemsNeeded = cachedItem ? 2 : 3;
        
        const freshItems = await handleDiscoveryAction(action, payload, itemsNeeded); 
        
        let finalResult = freshItems;
        
        if (cachedItem) {
            const isDuplicate = freshItems.some(i => (i.name || i.title) === (cachedItem.name || cachedItem.title));
            if (!isDuplicate) {
                finalResult = [cachedItem, ...freshItems];
            } else {
                // If duplicate, we are stuck with 2 items. 
                // To ensure 3, we could technically fetch one more, but for quota safety,
                // let's check if the cache has *another* item, or just accept 2 is better than crashing.
                // Better fix: If duplicate, just use the fresh 2, OR duplicate the first fresh one to fill the gap (hacky).
                // Real Fix: Since we requested 2, and the 3rd failed, we just return 2. 
                // To guarantee 3 every time, we'd need to request 3 fresh ones if cache fails, which defeats the purpose.
                
                // However, for "First Run" scenario, itemsNeeded is 3, so freshItems has 3. logic holds.
            }
        }

        // Save this new mix to cache for future
        if (supabase) {
            supabase.from('cached_content').insert({ hash: contentHash, content: finalResult, type: action }).then(() => {});
        }

        return res.status(200).json(finalResult);
    }

    // 2. Handle Other Actions
    let result;
    switch (action) {
      case 'discoverProfiles': 
      case 'discoverConcepts': 
      case 'discoverPhilosophies':
          result = await handleDiscoveryAction(action, payload, 3); // Default to 3 if no supabase
          break;
          
      case 'generateStory': result = await handleGenerateStory(payload); break;
      case 'generateScienceEntry': result = await handleGenerateScienceEntry(payload); break;
      case 'generatePhilosophyEntry': result = await handleGeneratePhilosophyEntry(payload); break;
      case 'generateImage': result = await handleGenerateImage(payload); break;
      case 'getUserQuota': 
         if (!userId) return res.status(200).json({ usage: 0, limit: DAILY_QUOTA_LIMIT });
         const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
         return res.status(200).json({ usage: p?.daily_usage || 0, limit: DAILY_QUOTA_LIMIT });
      default: throw new Error('Invalid action');
    }

    if (supabase) {
        const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
        if (userId && quotaActions.includes(action)) {
             const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
             await supabase.from('user_profiles').update({ daily_usage: (p?.daily_usage || 0) + 1 }).eq('id', userId);
        }
    }

    res.status(200).json(result);
  } catch (error) {
    console.error(`API Error [${action}]:`, error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// --- HELPER FOR DISCOVERY ---
async function handleDiscoveryAction(action, payload, count) {
    switch (action) {
        case 'discoverProfiles': return await handleDiscoverProfiles(payload, count);
        case 'discoverConcepts': return await handleDiscoverConcepts(payload, count);
        case 'discoverPhilosophies': return await handleDiscoverPhilosophies(payload, count);
        default: return [];
    }
}

// --- HANDLERS ---

async function handleDiscoverProfiles({ category, language }, count) {
  const model = "gemini-2.5-flash";
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
        region: { type: Type.STRING },
        era: { type: Type.STRING },
        values: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["name", "title", "description", "region", "era", "values"]
    }
  };
  
  const prompt = `
    Generate a list of ${count} inspiring individuals in the category: "${category}". 
    Language: ${language}.
    CRITICAL REQUIREMENTS:
    1. Diversity is mandatory.
    2. Era variety is mandatory.
    3. "values" field must list 3 key virtues.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 }
  }));
  return JSON.parse(response.text);
}

async function handleGenerateStory({ profile, englishStyleName, englishStyleDesc, hindiStyleName, hindiStyleDesc }) {
  const model = "gemini-2.5-flash";
  
  const storyContentSchema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      introduction: { type: Type.STRING },
      mainBody: { type: Type.STRING },
      valueReflection: { type: Type.STRING },
    },
    required: ["title", "introduction", "mainBody", "valueReflection"]
  };
  const schema = {
    type: Type.OBJECT,
    properties: {
      english: storyContentSchema,
      hindi: storyContentSchema,
      illustrationPrompt: { type: Type.STRING },
      geography: {
        type: Type.OBJECT,
        properties: {
            countryName: { type: Type.STRING },
            funFact: { type: Type.STRING },
            mapPrompt: { type: Type.STRING }
        },
        required: ["countryName", "funFact", "mapPrompt"]
      }
    },
    required: ["english", "hindi", "illustrationPrompt", "geography"]
  };
  
  const prompt = `
    Write a biographical story for children about ${profile.name} (${profile.title}) from ${profile.region} (${profile.era}).
    
    I need TWO versions of the story.
    
    1. **English Version**:
       - Style: Adopt the **narrative voice** and **tone** of ${englishStyleName} (${englishStyleDesc}).
       - **CRITICAL CONSTRAINT**: You MUST write in **Standard English**. 
       - **DO NOT** use dialect, phonetic spelling, or slang. Use correct grammar and spelling.
       - Tone: Genuine, grounded, inspiring.
       - Length: Approximately 850 words.
    
    2. **Hindi Version**:
       - Style: Emulate the narrative voice of ${hindiStyleName} (${hindiStyleDesc}).
       - **CRITICAL**: Do NOT translate the English story. Write a completely independent retelling.
       - Use standard Hindi grammar and spelling.
       - Length: Approximately 850 words.
    
    Structure for both:
    1. Title: Captivating.
    2. Introduction: Who they are.
    3. Main Story: Early life, challenges, turning points, and how they upheld values like ${profile.values.join(", ")}. How their contribution impacted the world. Identify real incidents from their lives.
    4. Value Reflection: A summary lesson.

    Additionally, provide:
    - A prompt for a main illustration scene (artistic, detailed).
    - A geography section with a fun fact about ${profile.region} and a map prompt.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.3, topP: 0.90 }
  }));
  const result = JSON.parse(response.text);
  result.englishStyle = englishStyleName;
  result.hindiStyle = hindiStyleName;

  return result;
}

async function handleDiscoverConcepts({ field }, count) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, field: { type: Type.STRING }, era: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "field", "era", "description", "tags"] } };
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: `Suggest ${count} scientific concepts or discoveries in the field: "${field}".
    Requirements:
    1. Include at least one non-Western discovery if applicable.
    2. Mix of foundational and modern breakthroughs.
    3. Focus on the story behind the concept for children.`, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 } 
  }));
  return JSON.parse(response.text);
}

async function handleGenerateScienceEntry({ item }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, conceptDefinition: { type: Type.STRING }, humanStory: { type: Type.STRING }, experimentOrActivity: { type: Type.STRING }, sources: { type: Type.ARRAY, items: { type: Type.STRING } }, illustrationPrompt: { type: Type.STRING } }, required: ["title", "conceptDefinition", "humanStory", "experimentOrActivity", "sources", "illustrationPrompt"] };
  
  const prompt = `
    Write a children's science entry about: ${item.name}.
    Field: ${item.field}. Era: ${item.era}.
    
    Content Guide:
    1. **Concept Definition**: Explain the technology/concept in simple, accurate terms.
    2. **Human Story**: Discuss the process of innovation.
    3. **Real-World Impact (Crucial)**: Instead of a generic "Try it out", provide a concrete section titled "Impact on Society".
       - Discuss **specific** real-world applications.
       - Avoid vague statements like "It changed the world." Say *how*.
       - Connect it to modern daily life.
    
    Constraints:
    - Length: 800-900 words.
    - Write in STANDARD English.
  `;

  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 } 
  }));
  return JSON.parse(response.text);
}

async function handleDiscoverPhilosophies({ theme }, count) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, origin: { type: Type.STRING }, era: { type: Type.STRING }, coreIdea: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "origin", "era", "coreIdea", "tags"] } };
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: `Suggest ${count} philosophy topics regarding "${theme}". Mix Eastern and Western. Ensure ideas are interesting for a younger audience.`, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 } 
  }));
  return JSON.parse(response.text);
}

async function handleGeneratePhilosophyEntry({ item }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, coreIdeaExplanation: { type: Type.STRING }, historicalEpisode: { type: Type.STRING }, modernrelevance: { type: Type.STRING }, sources: { type: Type.ARRAY, items: { type: Type.STRING } }, illustrationPrompt: { type: Type.STRING } }, required: ["title", "coreIdeaExplanation", "historicalEpisode", "modernrelevance", "sources", "illustrationPrompt"] };
  
  const prompt = `
    Write a children's philosophy entry about: ${item.name}.
    Origin: ${item.origin}. Era: ${item.era}. Core Idea: ${item.coreIdea}.
    
    Content Guide:
    1. **Core Idea**: Explain the philosophy clearly.
    2. **Historical Episode**: A moment in history where this idea was born or tested.
    3. **Societal Progress (Crucial)**: Instead of a generic "Why it matters", provide a section on "How This Idea Moved Humanity Forward".
       - Focus on **tangible shifts in society**.
       - Discuss how it helped ideas evolve toward more comprehensive states.
       - Give historical or sociological examples.
    
    Constraints:
    - Length: 800-900 words.
    - Write in STANDARD English.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 } 
  }));
  return JSON.parse(response.text);
}

async function handleGenerateImage({ prompt, isMap }) {
  const styleSuffix = isMap  
    ? " -- illustrated map style, colorful, educational, cute icons, parchment background, high quality"
    : " -- warm colors, children's book illustration style, high quality, artistic, detailed, masterpiece";
  
  const fullPrompt = prompt + styleSuffix;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: 'gemini-2.5-flash-image', 
      contents: { parts: [{ text: fullPrompt }] },
      config: { responseModalities: [Modality.IMAGE] },
    }), 0); 
    
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts[0]?.inlineData) {
        return `data:image/jpeg;base64,${parts[0].inlineData.data}`;
    }
    throw new Error("No image data returned");
  } catch (e) {
    console.error("Image Gen Error:", e.message);
    return `https://placehold.co/800x600?text=${isMap ? 'Map+Unavailable' : 'Image+Unavailable'}`;
  }
}
