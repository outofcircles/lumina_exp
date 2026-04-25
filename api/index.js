import { GoogleGenAI, Type, Modality } from "@google/genai";
import OpenAI from "openai";
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

// --- CONFIGURATION ---
const genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });

const openaiClient = process.env.OPENROUTER_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENROUTER_API_KEY,
      baseURL: 'https://openrouter.ai/api/v1',
    })
  : null;

const USE_DEEPSEEK = process.env.USE_DEEPSEEK === 'true' && openaiClient !== null;
const RESEARCH_MODEL = "gemini-2.5-flash";
const GENERATION_MODEL = USE_DEEPSEEK ? "deepseek/deepseek-chat-v3-0324:free" : "gemini-2.5-flash";

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
const DAILY_QUOTA_LIMIT = 1000;
const CACHE_VERSION = "v7-research-grounded";
const WORD_COUNT = {
  young:  { short: 300,  medium: 550,  long: 900  },
  middle: { short: 400,  medium: 850,  long: 1400 },
  teen:   { short: 550,  medium: 1100, long: 1800 },
};

const getWordCount = (readingLevel, storyLength) => {
  const level = WORD_COUNT[readingLevel] || WORD_COUNT.middle;
  return level[storyLength] || level.medium;
};

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

// Routes text generation to DeepSeek (via OpenRouter) or Gemini based on USE_DEEPSEEK flag
const generateText = async (prompt, schema, temperature = 0.72) => {
  if (USE_DEEPSEEK) {
    const response = await openaiClient.chat.completions.create({
      model: GENERATION_MODEL,
      messages: [
        { role: 'system', content: 'You are a world-class educational content writer. Always respond with valid JSON matching the schema provided.' },
        { role: 'user', content: `${prompt}\n\nRespond ONLY with a valid JSON object matching this schema: ${JSON.stringify(schema)}` },
      ],
      temperature,
      response_format: { type: 'json_object' },
    });
    const text = response.choices[0]?.message?.content || '{}';
    return JSON.parse(text);
  } else {
    const geminiSchema = buildGeminiSchema(schema);
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: GENERATION_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', responseSchema: geminiSchema, temperature },
    }));
    return JSON.parse(response.text);
  }
};

// Converts a simple JSON schema object to Gemini Type schema format
const buildGeminiSchema = (schema) => {
  if (schema.type === 'object') {
    return {
      type: Type.OBJECT,
      properties: Object.fromEntries(
        Object.entries(schema.properties || {}).map(([k, v]) => [k, buildGeminiSchema(v)])
      ),
      required: schema.required || [],
    };
  }
  if (schema.type === 'array') {
    return { type: Type.ARRAY, items: buildGeminiSchema(schema.items) };
  }
  if (schema.type === 'string') return { type: Type.STRING };
  if (schema.type === 'number') return { type: Type.NUMBER };
  if (schema.type === 'boolean') return { type: Type.BOOLEAN };
  return { type: Type.STRING };
};

export default async function handler(req, res) {
  // CORS — lock to configured origin, not wildcard
  const allowedOrigin = process.env.ALLOWED_ORIGIN || 'http://localhost:5173';
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // --- AUTH GUARD: All actions require a valid Supabase session ---
  const authHeader = req.headers.authorization;
  if (!supabase || !authHeader) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Unauthorized: Please log in.' });
  }
  const userId = user.id;

  const { action, payload } = req.body;

  try {
    // --- QUOTA CHECK for content-generating actions ---
    const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry', 'researchStory', 'researchScience', 'researchPhilosophy'];
    if (quotaActions.includes(action)) {
      const today = new Date().toISOString().split('T')[0];

      await supabase.from('user_profiles').upsert(
        { id: userId, daily_usage: 0, last_reset: today },
        { onConflict: 'id', ignoreDuplicates: true }
      );

      const { data: profile } = await supabase.from('user_profiles').select('daily_usage, last_reset').eq('id', userId).single();

      if (profile && profile.last_reset !== today) {
        await supabase.from('user_profiles').update({ daily_usage: 0, last_reset: today }).eq('id', userId);
        profile.daily_usage = 0;
      }

      if (profile && profile.daily_usage >= DAILY_QUOTA_LIMIT) {
        return res.status(429).json({ error: `Daily limit of ${DAILY_QUOTA_LIMIT} reached. Come back tomorrow!` });
      }
    }

    // --- CACHE CHECK ---
    const cacheableActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry', 'researchStory', 'researchScience', 'researchPhilosophy'];
    let cacheHash = null;
    if (cacheableActions.includes(action)) {
      const saltedPayload = { ...payload };
      delete saltedPayload.regenerateSalt;
      const hashSource = payload.regenerateSalt
        ? action + JSON.stringify(saltedPayload) + CACHE_VERSION + payload.regenerateSalt
        : action + JSON.stringify(payload) + CACHE_VERSION;
      cacheHash = crypto.createHash('sha256').update(hashSource).digest('hex');
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
      case 'researchStory': result = await handleResearchStory(payload); break;
      case 'researchScience': result = await handleResearchScience(payload); break;
      case 'researchPhilosophy': result = await handleResearchPhilosophy(payload); break;
      case 'getUserQuota': {
        const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
        return res.status(200).json({ usage: p?.daily_usage || 0, limit: DAILY_QUOTA_LIMIT });
      }
      case 'reportContent': {
        const { contentTitle, reason } = payload;
        await supabase.from('content_reports').insert({ reported_by: userId, content_title: contentTitle, reason });
        return res.status(200).json({ success: true });
      }
      default: throw new Error('Invalid action');
    }

    // --- POST-SUCCESS: cache + increment quota ---
    if (cacheHash) supabase.from('cached_content').insert({ hash: cacheHash, content: result, type: action }).then(() => {});
    if (quotaActions.includes(action)) {
      const { data: p } = await supabase.from('user_profiles').select('daily_usage').eq('id', userId).single();
      await supabase.from('user_profiles').update({ daily_usage: (p?.daily_usage || 0) + 1 }).eq('id', userId);
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
  try { return JSON.parse(response.text); }
  catch { throw new Error('AI returned unexpected format for profiles. Please try again.'); }
}

async function handleResearchStory({ profile }) {

  const prompt = `Research ${profile.name} (${profile.title}, ${profile.region}, ${profile.era}).

  Use Google Search to find verified biographical information. Respond with a JSON object with these exact keys:
  - keyEvents: array of 5-7 strings, specific dated events from their life (real incidents, not generic)
  - verifiedFacts: array of 8-10 strings, precise facts (dates, names of places/people, measurable achievements)
  - quotes: array of 3-5 strings, actual documented quotes (with source attribution in brackets)
  - historicalContext: string, 2-3 sentences on the world they lived in
  - sources: array of strings, Wikipedia URL and 2-3 authoritative references

  Return only the JSON object, no markdown.`;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.warn('Story research failed, returning stub:', e.message);
    return { keyEvents: [], verifiedFacts: [], quotes: [], historicalContext: 'Not found.', sources: [] };
  }
}

async function handleResearchScience({ item }) {
  const prompt = `Research the scientific concept: "${item.name}" (${item.field}, ${item.era}).

  Use Google Search. Respond with a JSON object with these exact keys:
  - discoveryContext: string, precise historical circumstances of the discovery/invention
  - keyFigures: array of strings, names of scientists involved with brief roles
  - verifiedFacts: array of 8-10 strings, specific facts (dates, measurements, first applications)
  - realWorldApplications: array of 5-7 strings, specific modern uses with named technologies
  - sources: array of strings, Wikipedia URL and 2-3 authoritative references

  Return only the JSON object, no markdown.`;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.warn('Science research failed:', e.message);
    return { discoveryContext: 'Not found.', keyFigures: [], verifiedFacts: [], realWorldApplications: [], sources: [] };
  }
}

async function handleResearchPhilosophy({ item }) {
  const prompt = `Research the philosophy: "${item.name}" (${item.origin}, ${item.era}).

  Use Google Search. Respond with a JSON object with these exact keys:
  - historicalContext: string, when and why this idea emerged, 2-3 sentences
  - keyThinkers: array of strings, names and one-line roles of major contributors
  - verifiedFacts: array of 8-10 strings, precise facts (dates, key texts, institutional changes caused)
  - societalImpacts: array of 5-7 strings, specific tangible ways this idea changed laws, governments, or movements
  - sources: array of strings, Stanford Encyclopedia of Philosophy URL and 2-3 authoritative references

  Return only the JSON object, no markdown.`;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    const text = response.text.replace(/```json\n?|\n?```/g, '').trim();
    return JSON.parse(text);
  } catch (e) {
    console.warn('Philosophy research failed:', e.message);
    return { historicalContext: 'Not found.', keyThinkers: [], verifiedFacts: [], societalImpacts: [], sources: [] };
  }
}

async function handleGenerateStory({ profile, englishStyleName, englishStyleDesc, hindiStyleName, hindiStyleDesc, storyLength, readingLevel = 'middle', research }) {
  const wordCount = getWordCount(readingLevel, storyLength);

  const levelBlock = {
    young:  'READING LEVEL: Young (ages 6-10). Use simple words (max 2 syllables preferred). Short sentences (max 15 words). Concrete imagery only. No abstractions. Define any unusual word immediately after using it.',
    middle: 'READING LEVEL: Middle (ages 10-14). Varied sentence length. May use moderate vocabulary. Abstract ideas need one concrete example each. Avoid academic jargon.',
    teen:   'READING LEVEL: Teen (ages 14+). Full vocabulary. Complex sentences allowed. Philosophical and historical nuance welcome. Treat reader as a near-adult.',
  }[readingLevel] || '';

  const researchBlock = research ? `
## VERIFIED RESEARCH CONTEXT (use these facts — do not invent alternatives)
Key Events: ${research.keyEvents.join(' | ')}
Verified Facts: ${research.verifiedFacts.join(' | ')}
Documented Quotes (cite source in story): ${research.quotes.join(' | ')}
Historical Context: ${research.historicalContext}
` : '';

  const schema = {
    type: 'object',
    properties: {
      english: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          introduction: { type: 'string' },
          mainBody: { type: 'string' },
          valueReflection: { type: 'string' },
        },
        required: ['title', 'introduction', 'mainBody', 'valueReflection'],
      },
      hindi: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          introduction: { type: 'string' },
          mainBody: { type: 'string' },
          valueReflection: { type: 'string' },
        },
        required: ['title', 'introduction', 'mainBody', 'valueReflection'],
      },
      illustrationPrompt: { type: 'string' },
      geography: {
        type: 'object',
        properties: {
          countryName: { type: 'string' },
          funFact: { type: 'string' },
          mapPrompt: { type: 'string' },
        },
        required: ['countryName', 'funFact', 'mapPrompt'],
      },
    },
    required: ['english', 'hindi', 'illustrationPrompt', 'geography'],
  };

  const prompt = `Write a biographical story about ${profile.name} (${profile.title}) from ${profile.region} (${profile.era}).

${levelBlock}

${researchBlock}

## ENGLISH VERSION
Narrator voice: ${englishStyleName} — ${englishStyleDesc}
Length: approximately ${wordCount} words
CRITICAL: Write in STANDARD English. No dialect, phonetic spelling, or slang.
CRITICAL: Use only verified facts from the research block above. If a quote is provided, include it verbatim with attribution.

Narrative arc (mandatory):
1. HOOK: Open in media res — a single vivid scene that drops the reader into a defining moment
2. ROOTS: Early life, formative experiences that explain who they became
3. CRUCIBLE: The central struggle or turning point — make it specific, not generic
4. BREAKTHROUGH: How they upheld the values of ${profile.values.join(', ')} when it mattered most
5. LEGACY: How their contribution changed the world — with specific impact, not vague praise

## HINDI VERSION
Narrator voice: ${hindiStyleName} — ${hindiStyleDesc}
Length: approximately ${wordCount} words
CRITICAL: Write an INDEPENDENT retelling in standard Hindi. Do NOT translate the English story.
Same 5-act narrative arc as English version.

## ADDITIONAL FIELDS
- illustrationPrompt: A vivid, specific scene from the story for illustration (artistic children's book style)
- geography.countryName: The country most associated with ${profile.name}
- geography.funFact: One surprising, specific geographic or cultural fact about that region
- geography.mapPrompt: Prompt for an illustrated educational map of the region`;

  const result = await generateText(prompt, schema, 0.72);
  result.englishStyle = englishStyleName;
  result.hindiStyle = hindiStyleName;
  if (research) result.research = research;
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
  try { return JSON.parse(response.text); }
  catch { throw new Error('AI returned unexpected format for concepts. Please try again.'); }
}

async function handleGenerateScienceEntry({ item, storyLength, readingLevel = 'middle', narratorStyle, research }) {
  const wordCount = getWordCount(readingLevel, storyLength);

  const levelBlock = {
    young:  'READING LEVEL: Young (ages 6-10). Use simple words. Short sentences. Concrete imagery. Analogies to everyday objects (not technical equipment).',
    middle: 'READING LEVEL: Middle (ages 10-14). Moderate vocabulary. Abstract ideas need one analogy each. Light technical terms OK if immediately explained.',
    teen:   'READING LEVEL: Teen (ages 14+). Full scientific vocabulary. Historical and societal depth welcome.',
  }[readingLevel] || '';

  const narratorBlock = narratorStyle
    ? `NARRATOR VOICE: Write as ${narratorStyle.name} (${narratorStyle.persona}). Voice: ${narratorStyle.voiceCharacteristics?.join(', ')}. Avoid: ${narratorStyle.avoidances?.join(', ')}.`
    : 'NARRATOR VOICE: Warm, curious science educator — enthusiastic but precise.';

  const researchBlock = research ? `
## VERIFIED RESEARCH CONTEXT
Discovery Context: ${research.discoveryContext}
Key Figures: ${research.keyFigures.join(' | ')}
Verified Facts: ${research.verifiedFacts.join(' | ')}
Real-World Applications: ${research.realWorldApplications.join(' | ')}
` : '';

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      conceptDefinition: { type: 'string' },
      humanStory: { type: 'string' },
      experimentOrActivity: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      illustrationPrompt: { type: 'string' },
    },
    required: ['title', 'conceptDefinition', 'humanStory', 'experimentOrActivity', 'sources', 'illustrationPrompt'],
  };

  const prompt = `Write a science entry about: ${item.name} (${item.field}, ${item.era}).

${levelBlock}

${narratorBlock}

${researchBlock}

Length: approximately ${wordCount} words total across all sections.
CRITICAL: Use verified facts from research context. Name specific scientists, dates, and places.

Content structure:
1. CONCEPT DEFINITION (~15% of words): Explain what this is in simple, accurate terms. Use one powerful analogy.
2. HUMAN STORY (~50% of words): The narrative of discovery. Include:
   - The specific moment/problem that triggered the research
   - Named scientists and their roles
   - A setback or failed experiment on the path to success
   - The moment of breakthrough (specific scene if possible)
3. TRY THIS / THINK ABOUT THIS (~20% of words): A hands-on experiment OR a thought experiment the reader can do right now. Must be doable with household items or pure imagination.
4. REAL-WORLD IMPACT (~15% of words): Name 3-5 specific technologies/applications that exist because of this discovery. Say HOW they work, not just that they exist.

sources: Include Wikipedia URL + 2-3 real references (books, educational sites). DO NOT invent URLs.
illustrationPrompt: A visually striking scene showing the moment of discovery or a key experiment.`;

  const result = await generateText(prompt, schema, 0.72);
  if (research) result.research = research;
  return result;
}

async function handleDiscoverPhilosophies({ theme }) {
  const model = "gemini-2.5-flash";
  const schema = { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, origin: { type: Type.STRING }, era: { type: Type.STRING }, coreIdea: { type: Type.STRING }, tags: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["name", "origin", "era", "coreIdea", "tags"] } };

  const response = await runWithRetry(() => genAI.models.generateContent({
    model,
    contents: `Suggest 5 philosophy topics regarding "${theme}". Shall contain both Eastern and Western ideas from different timelines/ eras. Ensure ideas are interesting for a younger audience.`,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.2 }
  }));
  try { return JSON.parse(response.text); }
  catch { throw new Error('AI returned unexpected format for philosophies. Please try again.'); }
}

async function handleGeneratePhilosophyEntry({ item, storyLength, readingLevel = 'middle', narratorStyle, research }) {
  const wordCount = getWordCount(readingLevel, storyLength);

  const levelBlock = {
    young:  "READING LEVEL: Young (ages 6-10). Use story and analogy exclusively. No abstract philosophical terms. Anchor every idea in a character's choice or feeling.",
    middle: 'READING LEVEL: Middle (ages 10-14). Introduce one philosophical term per section with immediate plain-English definition. Use historical examples.',
    teen:   'READING LEVEL: Teen (ages 14+). Full philosophical vocabulary. Engage with complexity and counter-arguments.',
  }[readingLevel] || '';

  const narratorBlock = narratorStyle
    ? `NARRATOR VOICE: Write as ${narratorStyle.name} (${narratorStyle.persona}). Voice: ${narratorStyle.voiceCharacteristics?.join(', ')}. Avoid: ${narratorStyle.avoidances?.join(', ')}.`
    : 'NARRATOR VOICE: Thoughtful, accessible philosophy educator — curious and non-preachy.';

  const researchBlock = research ? `
## VERIFIED RESEARCH CONTEXT
Historical Context: ${research.historicalContext}
Key Thinkers: ${research.keyThinkers.join(' | ')}
Verified Facts: ${research.verifiedFacts.join(' | ')}
Societal Impacts: ${research.societalImpacts.join(' | ')}
` : '';

  const schema = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      coreIdeaExplanation: { type: 'string' },
      historicalEpisode: { type: 'string' },
      modernrelevance: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
      illustrationPrompt: { type: 'string' },
    },
    required: ['title', 'coreIdeaExplanation', 'historicalEpisode', 'modernrelevance', 'sources', 'illustrationPrompt'],
  };

  const prompt = `Write a philosophy entry about: ${item.name} (${item.origin}, ${item.era}). Core idea: ${item.coreIdea}.

${levelBlock}

${narratorBlock}

${researchBlock}

Length: approximately ${wordCount} words total.
CRITICAL: Use verified facts. Name specific thinkers, texts, dates, and institutions changed by this idea.

Content structure:
1. CORE IDEA (~20% of words): Explain the philosophy clearly. Use a vivid parable, story, or thought experiment — not abstract definitions alone.
2. HISTORICAL EPISODE (~40% of words): A SPECIFIC moment when this idea was born, tested, or dramatically applied. Name the people, place, year. Show the stakes.
3. HOW IT MOVED HUMANITY FORWARD (~30% of words): Tangible societal shifts caused by this idea. Name real laws, governments, movements, or institutions it shaped. Avoid "it changed how people think" — say HOW specifically.
4. MODERN RELEVANCE (~10% of words): One contemporary situation where this idea is urgently needed or actively applied.

sources: Stanford Encyclopedia of Philosophy or Wikipedia URL + 2-3 real references.
illustrationPrompt: A vivid historical scene capturing the moment or setting of the philosophy.`;

  const result = await generateText(prompt, schema, 0.72);
  if (research) result.research = research;
  return result;
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
