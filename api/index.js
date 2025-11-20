
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
const CACHE_VERSION = "v2";

// --- RETRY HELPER ---
const runWithRetry = async (fn, retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      // Check for 503 (Service Unavailable) or "overloaded" message
      const isOverloaded = error.status === 503 || (error.message && error.message.toLowerCase().includes('overloaded'));
      
      if (!isOverloaded || i === retries - 1) {
        throw error;
      }
      
      // Exponential backoff: 1s, 2s, 3s
      const delay = 1000 * (i + 1);
      console.warn(`Gemini 503 hit. Retrying in ${delay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
};

export default async function handler(req, res) {
  // CORS
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

  // --- AUTHENTICATION & QUOTA CHECK ---
  let userId = null;

  if (supabase && authHeader) {
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized: Please log in.' });
    }
    userId = user.id;

    // Check Quota for heavy generation actions
    const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
    if (quotaActions.includes(action)) {
        // Fetch user profile
        let { data: profile, error: profileError } = await supabase
            .from('user_profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        // If profile doesn't exist yet, create it or treat as 0
        if (!profile) {
           profile = { daily_usage: 0, last_reset: new Date().toISOString().split('T')[0] };
        }

        // Handle date reset
        const today = new Date().toISOString().split('T')[0];

        if (profile.last_reset !== today) {
            // Reset quota for new day
            await supabase.from('user_profiles').update({ daily_usage: 0, last_reset: today }).eq('id', userId);
        } 
    }
  } else if (!supabase) {
      console.warn("Supabase not configured in API, skipping Auth/Quota checks.");
  }

  try {
    // 1. Check Caching
    const cacheableActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
    let cacheHash = null;

    if (supabase && cacheableActions.includes(action)) {
       // Include CACHE_VERSION in hash to allow cache busting
       cacheHash = crypto.createHash('sha256').update(action + JSON.stringify(payload) + CACHE_VERSION).digest('hex');
       
       const { data: cachedData } = await supabase
         .from('cached_content')
         .select('content')
         .eq('hash', cacheHash)
         .single();

       if (cachedData) {
         return res.status(200).json(cachedData.content);
       }
    }

    // 2. Generate
    let result;
    switch (action) {
      case 'discoverProfiles': result = await handleDiscoverProfiles(payload); break;
      case 'generateStory': result = await handleGenerateStory(payload); break;
      case 'discoverConcepts': result = await handleDiscoverConcepts(payload); break;
      case 'generateScienceEntry': result = await handleGenerateScienceEntry(payload); break;
      case 'discoverPhilosophies': result = await handleDiscoverPhilosophies(payload); break;
      case 'generatePhilosophyEntry': result = await handleGeneratePhilosophyEntry(payload); break;
      case 'generateImage': result = await handleGenerateImage(payload); break;
      case 'generateAudio': result = await handleGenerateAudio(payload); break;
      case 'getUserQuota': 
         if (!userId) return res.status(200).json({ usage: 0, limit: DAILY_QUOTA_LIMIT });
         const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
         return res.status(200).json({ usage: p?.daily_usage || 0, limit: DAILY_QUOTA_LIMIT });
      default: throw new Error('Invalid action');
    }

    // 3. Post-Generation Updates (Quota & Cache)
    if (supabase) {
        if (cacheHash) {
            supabase.from('cached_content').insert({ hash: cacheHash, content: result, type: action }).then(() => {});
        }
        const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry'];
        if (userId && quotaActions.includes(action)) {
             const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
             const newUsage = (p?.daily_usage || 0) + 1;
             await supabase.from('user_profiles').update({ daily_usage: newUsage }).eq('id', userId);
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
    1. Diversity is mandatory. Focus on diversity in gender, culture, and region. Include individuals from at least 3 different continents (e.g., Asia, Africa, North America, South America, Europe).
    2. Era variety is mandatory. HISTORICAL SPREAD: 1 Ancient, 1 Middle Ages, 1 Early Modern, 2 Modern.
    3. The "values" field should list 3 key virtues they embody.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: prompt,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4 // Stabilize output
    }
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
       - Style: Emulate the writing *style* of **${englishStyleName}** (${englishStyleDesc}).
       - **IMPORTANT**: Use standard, grammatically correct English. Do NOT use heavy dialect, phonetic spelling, or slang that makes words hard to read (e.g. write "you" not "yer", "listen" not "llsten").
       - Tone: Inspiring, warm, educational.
       - Length: Approximately 850 words.
    
    2. **Hindi Version**:
       - Style: Emulate the writing style of **${hindiStyleName}**.
       - Characteristics: ${hindiStyleDesc}
       - **CRITICAL**: Do NOT translate the English story. Write a completely independent retelling.
       - Use standard Hindi grammar and spelling.
       - Length: Approximately 850 words.
    
    Structure for both:
    1. Title: Captivating.
    2. Introduction: Who they are.
    3. Main Story: Early life, challenges, turning points, and how they upheld values like ${profile.values.join(", ")}. How their contribution impacted the world.
    4. Value Reflection: A summary lesson.

    Additionally, provide:
    - A prompt for a main illustration scene (artistic, detailed).
    - A geography section with a fun fact about ${profile.region} and a map prompt.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: prompt,
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4, // Fixes "Iagine" and weird spelling
      topP: 0.95,
      topK: 40
    }
  }));
  const result = JSON.parse(response.text);
  result.englishStyle = englishStyleName;
  result.hindiStyle = hindiStyleName;
  return result;
}

async function handleDiscoverConcepts({ field }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, field: { type: Type.STRING }, era: { type: Type.STRING }, description: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "field", "era", "description", "tags"] } };
  
  const prompt = `
    Suggest 5 scientific concepts or discoveries in the field: "${field}".
    
    CRITICAL REQUIREMENTS:
    1. Include at least one discovery from non-Western science or technology.
    2. Include a mix of foundational discoveries (old) and modern breakthroughs.
    3. Focus on the story behind the concept for children and how it was impactful for humanity.
  `;

  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4
    } 
  }));
  return JSON.parse(response.text);
}

async function handleGenerateScienceEntry({ item }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, conceptDefinition: { type: Type.STRING }, humanStory: { type: Type.STRING }, experimentOrActivity: { type: Type.STRING }, sources: { type: Type.ARRAY, items: { type: Type.STRING } }, illustrationPrompt: { type: Type.STRING } }, required: ["title", "conceptDefinition", "humanStory", "experimentOrActivity", "sources", "illustrationPrompt"] };
  
  const prompt = `
    Write a children's science entry about: ${item.name}.
    Field: ${item.field}.
    Era: ${item.era}.
    Description: ${item.description}.
    Audience: Children 8-15.
    Tone: curious, factual.
    Constraint: Write roughly 900 words.
    CRITICAL CONSTRAINTS:
    1. Write in STANDARD English. 
    2. Do NOT use phonetic spelling (e.g. never write "Iagine" for "Imagine", "Te" for "The").
    3. Do NOT use heavy dialect or accents.
    Focus on the narrative of how it was discovered or developed. How it is useful for humanity.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4 
    } 
  }));
  return JSON.parse(response.text);
}

async function handleDiscoverPhilosophies({ theme }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, origin: { type: Type.STRING }, era: { type: Type.STRING }, coreIdea: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "origin", "era", "coreIdea", "tags"] } };
  
  const prompt = `
    Suggest 5 philosophy topics regarding "${theme}".
    
    CRITICAL REQUIREMENTS:
    1. You MUST provide a mix of Eastern (Indian, Chinese, Japanese) and Western (Greek, European) schools of thought.
    2. Do not limit to just one region or one era.
    3. Ensure the ideas are useful, important and interesting for a younger audience.
  `;

  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4 
    } 
  }));
  return JSON.parse(response.text);
}

async function handleGeneratePhilosophyEntry({ item }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.OBJECT, properties: { title: { type: Type.STRING }, coreIdeaExplanation: { type: Type.STRING }, historicalEpisode: { type: Type.STRING }, modernrelevance: { type: Type.STRING }, sources: { type: Type.ARRAY, items: { type: Type.STRING } }, illustrationPrompt: { type: Type.STRING } }, required: ["title", "coreIdeaExplanation", "historicalEpisode", "modernrelevance", "sources", "illustrationPrompt"] };
  
  const prompt = `
    Write a children's philosophy entry about: ${item.name}.
    Origin: ${item.origin}.
    Era: ${item.era}.
    Core Idea: ${item.coreIdea}.
    Constraint: Write roughly 800 words. 
    The idea is to introduce children about the development of ${item.name} and its positive impact on world.
    Simplify the complex thought into an interesting lesson.
    CRITICAL CONSTRAINTS:
    1. Write in STANDARD English. 
    2. Do NOT use phonetic spelling (e.g. never write "Iagine" for "Imagine", "Te" for "The").
    3. Do NOT use heavy dialect or accents.
  `;
  
  const response = await runWithRetry(() => genAI.models.generateContent({ 
    model, 
    contents: prompt, 
    config: { 
      responseMimeType: "application/json", 
      responseSchema: schema,
      temperature: 0.4 
    } 
  }));
  return JSON.parse(response.text);
}

async function handleGenerateImage({ prompt, isMap }) {
  const styleSuffix = isMap  ? " -- illustrated map style, colorful, educational, cute icons, parchment background, high quality"
    : " -- warm colors, children's book illustration style, high quality, artistic, detailed, masterpiece";
  
  const fullPrompt = prompt + styleSuffix;

  try {
    // Switching to gemini-2.5-flash-image for better reliability and speed compared to Imagen 4
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts: [{ text: fullPrompt }] },
      config: { 
        responseModalities: [Modality.IMAGE],
        //temperature: 0.4 
      },
    }));
    
    // Extract inline data from the response
    const parts = response.candidates?.[0]?.content?.parts;
    if (parts && parts[0]?.inlineData) {
        return `data:image/jpeg;base64,${parts[0].inlineData.data}`;
    }
    throw new Error("No image data returned");
  } catch (e) {
    console.error("Image Gen Error:", e);
    return `https://picsum.photos/800/600?grayscale&blur=2`;
  }
}

async function handleGenerateAudio({ text }) {
  const model = "gemini-2.5-flash-preview-tts";
  try {
      const response = await runWithRetry(() => genAI.models.generateContent({
        model,
        contents: [{ parts: [{ text }] }],
        config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Kore' } } } },
      }));
      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  } catch (e) { return null; }
}
