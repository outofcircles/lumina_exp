import { GoogleGenAI, Type, Modality } from "@google/genai";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- CONFIGURATION ---
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Increase Vercel Function Timeout
export const config = {
  maxDuration: 60,
};

// Initialize Supabase 
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY; 
const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

// Daily Quota Limit per user (Billing Protection)
const DAILY_QUOTA_LIMIT = 999999999; 
// Increment this version to invalidate all previous cached content
const CACHE_VERSION = "v5-real-relevance";

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
    const cacheableActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
    let cacheHash = null;

    if (supabase && cacheableActions.includes(action)) {
       cacheHash = crypto.createHash('sha256').update(action + JSON.stringify(payload) + CACHE_VERSION).digest('hex');
       const { data: cachedData } = await supabase.from('cached_content').select('content').eq('hash', cacheHash).single();
       if (cachedData) return res.status(200).json(cachedData.content);
    }

    let result;
    switch (action) {
      case 'discoverProfiles': result = await handleDiscoverProfiles(payload); break;
      case 'generateStory': result = await handleGenerateStory(payload); break;
      case 'discoverConcepts': result = await handleDiscoverConcepts(payload); break;
      case 'generateScienceEntry': result = await handleGenerateScienceEntry(payload); break;
      case 'discoverPhilosophies': result = await handleDiscoverPhilosophies(payload); break;
      case 'generatePhilosophyEntry': result = await handleGeneratePhilosophyEntry(payload); break;
      case 'generateImage': result = await handleGenerateImage(payload); break;
      case 'getUserQuota': 
         if (!userId) return res.status(200).json({ usage: 0, limit: DAILY_QUOTA_LIMIT });
         const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
         return res.status(200).json({ usage: p?.daily_usage || 0, limit: DAILY_QUOTA_LIMIT });
      default: throw new Error('Invalid action');
    }

    if (supabase) {
        if (cacheHash) supabase.from('cached_content').insert({ hash: cacheHash, content: result, type: action }).then(() => {});
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

// --- HANDLERS ---

async function handleDiscoverProfiles({ category, language }) {
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
    Generate a list of 5 inspiring individuals in the category: "${category}". 
    Language: ${language}.
    CRITICAL REQUIREMENTS:
    1. Diversity is mandatory (3+ continents).
    2. Era variety is mandatory (Ancient to Modern).
    3. "values" field must list 3 key virtues.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 }
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
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2, topP: 0.90 }
  }));
  const result = JSON.parse(response.text);
  result.englishStyle = englishStyleName;
  result.hindiStyle = hindiStyleName;

  // Images generated sequentially on client side to save server time/quota here
  return result;
}

async function handleDiscoverConcepts({ field }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, field: { type: Type.STRING }, era: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "field", "era", "description", "tags"] } };
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: `Suggest 5 scientific concepts or discoveries in the field: "${field}".
    Requirements:
    1. Include at least one non-Western discovery.
    2. Mix of foundational and modern breakthroughs.
    3. Focus on the story behind the concept for children.`, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.1 } 
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
    2. **Human Story**: Discuss the process of innovation, from ideation to execution.
    3. **Real-World Impact (Crucial)**: Instead of a generic "Try it out", provide a concrete section titled "Impact on Society".
       - Discuss **specific** real-world applications (e.g., "This is why MRI machines work" or "This allows GPS to track your location").
       - Avoid vague statements like "It changed the world." Say *how* (e.g., "It doubled food production during the 1960s").
       - Connect it to modern daily life.
    
    Constraints:
    - Length: 800-900 words.
    - Write in STANDARD English.
  `;

  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 } 
  }));
  return JSON.parse(response.text);
}

async function handleDiscoverPhilosophies({ theme }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, origin: { type: Type.STRING }, era: { type: Type.STRING }, coreIdea: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "origin", "era", "coreIdea", "tags"] } };
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: `Suggest 5 philosophy topics regarding "${theme}". Shall contain both Eastern and Western ideas from different timelines/ eras. Ensure ideas are interesting for a younger audience.`, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 } 
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
       - Focus on **tangible shifts in society** (e.g., "How Stoicism influenced modern cognitive therapy" or "How Confucianism built the civil service exam system").
       - Discuss how it helped ideas evolve toward more comprehensive states (e.g., from "might makes right" to "social contract").
       - Avoid platitudes. Give historical or sociological examples of this idea in action shaping laws, governments, or movements.
    
    Constraints:
    - Length: 800-900 words.
    - Write in STANDARD English.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 } 
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
    }), 0); // 0 retries for images to prevent blocking
    
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
