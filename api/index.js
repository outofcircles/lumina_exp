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

  const prompt = `You are writing a biographical story about ${profile.name} (${profile.title}) from ${profile.region} (${profile.era}).

${levelBlock}

${researchBlock}

## ANTI-SLOP RULES (apply to both versions)
- Every sentence must earn its place. Cut anything that could appear in any biography of any person.
- NO filler phrases: "tectonic plates of history", "ripple through time", "silent symphony", "indelible mark", "journey of a thousand miles", "changed the world forever", "left a lasting legacy". These are banned.
- NO vague praise. Every claim needs a specific fact behind it. Not "he was brilliant" — say what he discovered and when.
- Quotes: only include a quote if it appears in the research block above. If uncertain of source, do not use it. Never invent quotes.
- The narrator voice must be sustained throughout ALL sections — not just the opening paragraph. If the narrator is García Márquez, the LEGACY section must still feel like García Márquez, not a Wikipedia summary.
- The valueReflection must be a short, personal, felt insight — NOT a recap of what just happened. Write it as if speaking directly to the reader about what this person's life means for their own.

## ENGLISH VERSION
Narrator voice: ${englishStyleName} — ${englishStyleDesc}
Length: approximately ${wordCount} words
Write in STANDARD English. No dialect or phonetic spelling.

Narrative arc:
1. HOOK (introduction field): Drop the reader into one specific, sensory scene — a real moment from this person's life. Name the place, time, what they were doing. Make it feel like we are there.
2. ROOTS + CRUCIBLE + BREAKTHROUGH (mainBody field): Weave these together as continuous prose, not labeled sections. Show the formative experiences, the specific obstacle they faced, and the moment they broke through — using named events, dates, and places from the research. Show how ${profile.values.join(', ')} manifested in a concrete decision or action, not as abstract virtues.
3. LEGACY + VALUE REFLECTION (valueReflection field): Two short paragraphs. First: what specifically changed because of this person — name the laws, movements, inventions, or people they influenced. Second: a direct, felt reflection for the reader on what this life teaches us today.

## HINDI VERSION
Narrator voice: ${hindiStyleName} — ${hindiStyleDesc}
Length: approximately ${wordCount} words
Write an INDEPENDENT retelling in standard, literary Hindi (not translated English). Same structure as above. The Hindi version should feel native to its narrator voice — not a translation.

## ADDITIONAL FIELDS
- illustrationPrompt: Describe one specific scene from the story — name the setting, the person's posture/expression, what surrounds them. Artistic children's book style, warm colors.
- geography.countryName: The country most associated with ${profile.name}
- geography.funFact: One surprising, concrete geographic or cultural fact about that country that most people don't know
- geography.mapPrompt: Prompt for an illustrated educational map highlighting the key locations from this person's life`;

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

  const prompt = `You are writing a science entry about: ${item.name} (${item.field}, ${item.era}).

${levelBlock}

${narratorBlock}

${researchBlock}

Length: approximately ${wordCount} words total across all sections.

## ANTI-SLOP RULES
- No filler sentences. Every sentence must contain a fact, an image, or a question — never all three vague adjectives in a row.
- Banned phrases: "changed the world", "revolutionary breakthrough", "mankind would never be the same", "paved the way", "opened new doors". Cut them.
- Name the scientists. Name the year. Name the city. Name the specific experiment or paper. Vague references to "researchers" or "scientists of the era" are not allowed.
- The narrator voice must be consistent from first sentence to last.

Content structure:
1. CONCEPT DEFINITION (conceptDefinition field, ~15% of words): Explain what this is in one powerful analogy that a child could picture. Then give the precise scientific definition in one sentence.
2. HUMAN STORY (humanStory field, ~50% of words): Write this as narrative prose, not bullet points. Show:
   - The specific problem or observation that triggered the discovery — with a named person in a named place
   - One failed attempt or wrong turn that makes the eventual breakthrough feel earned
   - The breakthrough moment itself — as a scene, not a summary
3. TRY THIS (experimentOrActivity field, ~20% of words): One hands-on experiment using household items, OR one thought experiment. Give exact steps. Make it feel like an invitation, not an instruction manual.
4. REAL-WORLD IMPACT woven into humanStory or as a closing paragraph: Name 3-5 specific technologies. For each, say in one sentence HOW the discovery made it possible — not just that it exists.

sources: Only include URLs you are confident exist (Wikipedia article, Khan Academy, BBC, known textbooks). DO NOT invent URLs. If unsure, name the source without a URL.
illustrationPrompt: Describe one specific scene — the scientist's face, the equipment around them, the moment of realisation. Warm, detailed, children's book illustration style.`;

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

  const prompt = `You are writing a philosophy entry about: ${item.name} (${item.origin}, ${item.era}). Core idea: ${item.coreIdea}.

${levelBlock}

${narratorBlock}

${researchBlock}

Length: approximately ${wordCount} words total.

## ANTI-SLOP RULES
- Philosophy entries fail when they stay abstract. Every idea must be grounded in a specific person making a specific choice in a specific year.
- Banned phrases: "timeless wisdom", "humanity has always wondered", "this idea transcends cultures", "at its core", "in today's fast-paced world". Cut them.
- Do not define the philosophy in the first sentence. Start with a scene or a person.
- The narrator voice must hold through the entire entry. A Rumi-style narrator does not suddenly sound like a textbook in section 3.

Content structure:
1. CORE IDEA (coreIdeaExplanation field, ~20% of words): Open with a short parable, a real historical anecdote, or a thought experiment that makes the idea viscerally clear — before naming it. Then name and define it in one sentence.
2. HISTORICAL EPISODE (historicalEpisode field, ~40% of words): One specific moment — a trial, a debate, a text being written, a law being passed — where this idea was born or tested. Name the person, place, year, and what was at stake. Write it as a scene with tension, not as a summary.
3. HOW IT MOVED HUMANITY FORWARD (woven into historicalEpisode or as closing prose in modernrelevance field): Name real institutions, laws, or movements this idea shaped. For each, say specifically how the idea caused the change — not just that it "influenced" them.
4. MODERN RELEVANCE (modernrelevance field, ~10% of words): One concrete, current situation where this idea is either urgently needed or being actively applied — name a country, movement, or event from the last 20 years.

sources: Stanford Encyclopedia of Philosophy URL or Wikipedia + 2-3 real references. Only include URLs you are confident exist.
illustrationPrompt: A specific historical scene — name the setting, the figures present, what they are doing. Warm, detailed, children's book illustration style.`;

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
