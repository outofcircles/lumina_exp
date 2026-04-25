# Lumina Content Quality — Improvement Plan
**Date:** 2026-04-24  
**Scope:** `api/index.js`, `constants.ts`, `types.ts`, StoryView / ScienceView / PhilosophyView UI, Vercel environment variables

---

## Problem Statement

Current generation has four documented failure modes:

1. **Style doesn't come through** — author voice is declared by name only; Gemini falls back to generic prose
2. **Content feels flat** — no emotional arc, no narrative tension, no formative human detail
3. **Hindi is broken** — reads like translated English; no native literary structure; vocabulary register is wrong
4. **Science/Philosophy is dry** — opens with definitions, not drama; no narrator style; no age adaptation

Root causes: shallow prompts, one-liner style descriptions, temperature too conservative (0.2), no grounding in real biographical research, no age-level parameter.

---

## Solution Overview — Option B: Full-Stack Quality Overhaul

Eight interconnected improvements across backend, data, and UI.

---

## Dimension 1: Age-Level System

### What
A new `ReadingLevel` type (`'young' | 'middle' | 'teen'`) flows through every content generator as a parameter. The user picks it via a 3-way toggle shown at story-request time (before hitting Generate), alongside the existing style picker.

### Age Level Specs

| Level | Age | Sentences | Vocabulary | Tone |
|---|---|---|---|---|
| `young` | 6–9 | Max 12 words, vary between short and very short | Everyday words only; define any new word inline in one phrase | Wonder, warmth; fairy-tale framing acceptable |
| `middle` | 10–13 | Mix short and medium; one complex sentence per paragraph allowed | Introduce 2–3 subject-specific words with brief inline explanation | Narrative adventure; real stakes; facts welcome |
| `teen` | 14+ | Full prose complexity; no length constraint | Precise and unsimplified; no dumbing down | Moral nuance; historical tension; respect the reader |

### Prompt injection per level
Each prompt receives a `[READING LEVEL]` block:

```
READING LEVEL: {young | middle | teen}
- Vocabulary: {everyday only | introduce key terms | full complexity}
- Sentence length: {max 12 words | mix short and medium | no constraint}
- Tone: {wonder and warmth | adventure and facts | nuance and respect}
```

### Word Count Matrix
Replace the current flat `WORD_COUNT` object with a 3×3 matrix:

```js
const WORD_COUNT = {
  young:  { short: 250,  medium: 450,  long: 700  },
  middle: { short: 400,  medium: 850,  long: 1400 },
  teen:   { short: 500,  medium: 1000, long: 1800 },
};
```

### Files changed
- `types.ts` — add `ReadingLevel` type
- `api/index.js` — WORD_COUNT matrix; inject level into all prompts
- `services/gemini.ts` — add `readingLevel` param to all exported functions
- `components/StoryView.tsx`, `ScienceView.tsx`, `PhilosophyView.tsx` — age toggle UI
- `types.ts` — add `readingLevel` to `ArchivedStory.metadata`

---

## Dimension 2: Web Research Pipeline (Two-Step Grounding)

### What
Before generating any story, a dedicated `handleResearch()` function runs a focused Gemini call with Google Search enabled. The result is a structured research summary passed as grounded context into the generation prompt. This replaces reliance on Gemini's training data alone for biographical, scientific, or philosophical details.

### Why this matters
Stories currently invent plausible but generic life events. Grounded research surfaces:
- The specific teacher, parent, or mentor who changed the person's trajectory
- A real moment of failure, doubt, or turning point (not a vague "faced many challenges")
- The cultural and political context that shaped their choices
- For science: the actual failed experiments and accidental discoveries
- For philosophy: the historical event that gave birth to the idea

### Research call — Stories
```
Model: gemini-2.5-flash
Tools: [{ googleSearch: {} }]
Temperature: 0.1

Prompt:
Research the life of {profile.name} ({profile.title}, {profile.era}, {profile.region}).

Find and summarize the following with HIGH SPECIFICITY. Cite your sources.
Do not generalize. If you cannot find a specific answer, say "Not found."

1. FORMATIVE RELATIONSHIP: One specific person (teacher, parent, mentor, rival) 
   who directly shaped their values or path. Name them, describe the relationship, 
   and give one concrete episode that shows the impact.

2. TURNING POINT: One specific event, crisis, or moment of failure/doubt that 
   changed the direction of their life or work.

3. CULTURAL CONTEXT: The political, social, or historical forces operating 
   during their most active years that they had to navigate or resist.

4. CORE ACHIEVEMENT: The single most specific, concrete thing they did or 
   created — not a generalization ("fought for rights") but an event 
   ("wrote the petition in 1932 that led directly to the law passing").

5. LESSER-KNOWN DETAIL: One surprising, humanizing detail — a failure, 
   a contradiction, a personal struggle — that most people don't know.

Return as JSON: { formativeRelationship, turningPoint, culturalContext, coreAchievement, lesserKnownDetail, sources[] }
// sources[] = array of strings in format "Title — URL" (e.g. "Wikipedia: Marie Curie — https://...")
// Rendered in the UI as clickable links; plain citation text is acceptable fallback if no URL available.
```

### Research call — Science
```
Research the discovery/concept: {item.name} in the field of {item.field}.

Find:
1. THE HUMAN MOMENT: The specific person(s), the exact setting, and what they 
   were actually trying to do when the discovery happened (not what it led to).
2. THE FAILED PATH: What didn't work before this breakthrough? Specific experiments 
   or theories that were wrong.
3. REAL-WORLD SPECIFICITY: One concrete number or statistic showing impact 
   (e.g., "doubled crop yields from 1.8 to 3.7 tonnes/hectare between 1960–1980").
4. THE CONTROVERSY: Was this discovery resisted, stolen, disputed, or ignored 
   at first? What happened?

Return as JSON: { humanMoment, failedPath, realWorldImpact, controversy, sources[] }
```

### Research call — Philosophy
```
Research the philosophical idea: {item.name} from {item.origin}, {item.era}.

Find:
1. BIRTH MOMENT: The specific historical event, personal crisis, or dialogue 
   that gave birth to this idea.
2. TANGIBLE SHIFT: One concrete way this idea changed a law, government system, 
   social structure, or institution. Name the place, time, and outcome.
3. THE OPPOSITION: Who disagreed, and what was their argument? This tension 
   makes the idea real.
4. MODERN ECHO: One specific modern institution, therapy, movement, or law 
   that is a direct descendant of this idea.

Return as JSON: { birthMoment, tangibleShift, opposition, modernEcho, sources[] }
```

### Caching
Research summaries are cached in Supabase (`cached_content` table, type=`'research'`) using the same SHA-256 hash pattern as stories. A story and its research summary share the same cache lifecycle — regenerating the story also regenerates its research.

### Files changed
- `api/index.js` — new `handleResearch()`, `handleScienceResearch()`, `handlePhilosophyResearch()` functions; each generation handler calls its research counterpart first

---

## Dimension 3: Story Prompt Overhaul

### What
The `handleGenerateStory` prompt is rewritten from a 20-line loose instruction into a structured creative brief with five mandatory sections.

### New prompt structure

```
=== RESEARCH CONTEXT (Verified Sources) ===
{researchContext injected here as structured JSON}

=== YOUR TASK ===
Write a biographical story for children about {profile.name}.

=== READING LEVEL ===
{age-level block injected here}

=== ENGLISH VERSION ===
Author Voice: {englishStyleName}
Voice Profile:
  - {voiceCharacteristic1}
  - {voiceCharacteristic2}  
  - {voiceCharacteristic3}
Avoid: {avoidance1}. {avoidance2}.
Sample register: "{sampleTone}"

MANDATORY NARRATIVE STRUCTURE — follow this arc exactly:
1. HOOK (introduction): Open in medias res — drop the reader into a 
   specific moment, not a biography introduction. Use the research 
   context's "turningPoint" or "formativeRelationship" as the hook scene.
2. ROOTS (early life): Ground in the cultural context. Introduce the 
   formative relationship by name and scene.
3. CRISIS: The turning point. Real, specific, from research context. 
   Show inner conflict, not just external events.
4. BREAKTHROUGH: The core achievement — grounded in the specific detail 
   from research, not a generalization.
5. REFLECTION (valueReflection): What did this life teach us? One 
   concrete lesson tied to their actual values: {profile.values.join(", ")}.

USE the research context. Do not invent events that contradict it.
If research says "not found" for a detail, you may invent a plausible 
scene — but mark it as imaginative with phrases like "perhaps" or "one 
can imagine."

Standard English only. No dialect. No phonetic spelling.
Length: approximately {wordCount} words.

=== HINDI VERSION ===
Author Voice: {hindiStyleName}
Voice Profile:
  - {hindiVoiceCharacteristic1}
  - {hindiVoiceCharacteristic2}
  - {hindiVoiceCharacteristic3}
Vocabulary register: {register — e.g., "Tatsama-heavy" / "Tadbhava and colloquial" / "modern standard"}
Avoid: {hindiAvoidance1}. {hindiAvoidance2}.

CRITICAL: This is NOT a translation. Write a completely independent retelling.
USE HINDI-NATIVE STORYTELLING PATTERNS:
  - Begin with a scene or a question, not a biographical introduction
  - Use Hindi rhetorical devices where natural (anaphora, direct address to reader)
  - Paragraph breaks follow thought rhythm, not English sentence structure
  - Dialogue (if any) in natural spoken Hindi, not formal written Hindi
  
Same narrative arc as English. Same research context applies.
Length: approximately {wordCount} words.

=== ADDITIONAL OUTPUTS ===
- illustrationPrompt: A detailed, specific scene from the story 
  (not a generic portrait). Children's book style. Name the setting, 
  lighting, emotional tone, and 2-3 visual details.
- geography.countryName, geography.funFact, geography.mapPrompt
```

### Temperature change
`0.2 → 0.72` for story generation. The research call stays at `0.1` (factual retrieval). Discovery calls stay at `0.1–0.2`.

---

## Dimension 4: Style Data Expansion

### What
Every entry in `AUTHOR_STYLES` and `HINDI_AUTHOR_STYLES` in `constants.ts` expands from a one-liner description to a full voice profile. These fields are injected directly into the prompt.

### New `AuthorStyle` shape (additions to existing interface)
```ts
interface AuthorStyle {
  id: string;
  name: string;
  description: string;        // existing — kept for UI display
  persona: string;            // existing
  era: string;                // existing
  majorWorks: string[];       // existing
  // NEW:
  voiceCharacteristics: string[];  // 3 traits injected into prompt
  avoidances: string[];            // 2 things NOT to do
  sampleTone: string;              // 1 sentence showing register
  ageAlignment: ReadingLevel[];    // which levels this style suits
}

// Hindi styles extend AuthorStyle with one additional field:
interface HindiAuthorStyle extends AuthorStyle {
  vocabularyRegister: 'tatsama' | 'tadbhava' | 'modern' | 'mixed-urdu' | 'avadhi';
}
// HINDI_AUTHOR_STYLES in constants.ts changes type from AuthorStyle[] → HindiAuthorStyle[]
```

### Example expansions

**Ruskin Bond (English)**
```ts
voiceCharacteristics: [
  "Short, unhurried sentences with a quiet observational eye",
  "Nature details are specific and sensory — name the tree, the bird, the season",
  "First-person warmth even in third-person narration; the narrator is always present"
],
avoidances: [
  "Never use dramatic exclamations or action-movie pacing",
  "Never use abstract language — ground every emotion in a physical detail"
],
sampleTone: "The old schoolmaster had a way of pausing mid-sentence, as if the right word were hiding just behind the hills.",
ageAlignment: ['young', 'middle']
```

**Munshi Premchand (Hindi)**
```ts
voiceCharacteristics: [
  "Simple, direct sentences rooted in rural and small-town life",
  "Characters revealed through action and dialogue, not description",
  "Moral weight carried by the situation itself, never stated directly"
],
avoidances: [
  "Avoid Sanskrit-heavy Tatsama vocabulary — use Tadbhava and Urdu loanwords naturally",
  "Avoid ornamental prose; Premchand's power is in restraint"
],
sampleTone: "होरी ने हल उठाया और खेत की ओर चल दिया, मन में न जाने कितने बोझ लिए।",
ageAlignment: ['middle', 'teen']
```

### Hindi-specific addition
Each Hindi style also gets a `vocabularyRegister` field:
```ts
vocabularyRegister: 'tatsama' | 'tadbhava' | 'modern' | 'mixed-urdu' | 'avadhi'
```
This is injected into the Hindi prompt section to direct Gemini's word choices at the vocabulary level.

### New style sets added to `constants.ts`

**`SCIENCE_NARRATOR_STYLES`** (6 voices):
| ID | Name | Core Voice |
|---|---|---|
| `feynman` | Richard Feynman | Playful curiosity; makes hard things feel obvious in hindsight |
| `sagan` | Carl Sagan | Cosmic wonder; the universe as context for everything human |
| `attenborough` | David Attenborough | Patient, observational; builds to revelation |
| `sacks` | Oliver Sacks | Clinical precision + profound human empathy |
| `curie` | Marie Curie | Methodical, understated; the work speaks |
| `hawking` | Stephen Hawking | Accessible wit; complexity explained through analogy |

**`PHILOSOPHY_NARRATOR_STYLES`** (6 voices):
| ID | Name | Core Voice |
|---|---|---|
| `watts` | Alan Watts | Conversational, Zen-inflected; dissolves complexity through story |
| `russell` | Bertrand Russell | Sharp, logical, a little dry wit; defines terms before using them |
| `beauvoir` | Simone de Beauvoir | Relational; ideas emerge from lived experience |
| `rumi` | Rumi | Lyrical and metaphoric; truth through parable |
| `aristotle` | Aristotle | Systematic; builds from first principles step by step |
| `gandhi` | Gandhi | Direct moral clarity; personal example as argument |

Each new style has the full `voiceCharacteristics`, `avoidances`, `sampleTone`, `ageAlignment` profile.

---

## Dimension 5: Science Entry Prompt Overhaul

### New structure
```
=== RESEARCH CONTEXT ===
{scienceResearchContext}

=== NARRATOR VOICE ===
{narratorStyleName}: {voiceCharacteristics injected}
Avoid: {avoidances}

=== READING LEVEL ===
{age-level block}

=== MANDATORY STRUCTURE ===
1. HOOK: Open with the human moment from research — the specific person, 
   place, and what they were actually doing. NOT a definition.
2. THE FAILED PATH: What didn't work. Specific. This is where drama lives.
3. THE BREAKTHROUGH: What happened, grounded in the research's "humanMoment."
4. REAL-WORLD IMPACT: Use the specific statistic or number from research. 
   Connect to something in the reader's daily life.
5. THE CONTROVERSY OR SURPRISE: From research context. Humanizes science.
6. EXPERIMENT/ACTIVITY: One thought experiment or safe home observation.

Length: {wordCount} words.
Standard English. No jargon without inline definition.
```

---

## Dimension 6: Philosophy Entry Prompt Overhaul

### New structure
```
=== RESEARCH CONTEXT ===
{philosophyResearchContext}

=== NARRATOR VOICE ===
{narratorStyleName}: {voiceCharacteristics}
Avoid: {avoidances}

=== READING LEVEL ===
{age-level block}

=== MANDATORY STRUCTURE ===
1. HOOK: The birth moment from research — the historical event or crisis 
   that forced this idea into existence.
2. THE CORE IDEA: Explained through a concrete analogy suited to the 
   reading level. No abstract definitions first.
3. THE OPPOSITION: Who disagreed and why? The tension makes the idea real.
4. TANGIBLE SHIFT: The specific law, institution, or movement this idea 
   created. Named, dated, located.
5. MODERN ECHO: Where do we see this idea alive today?

Length: {wordCount} words.
```

---

## Dimension 7: Regenerate Button

### What
A "Try a different version" button on every content view. It forces a fresh generation by appending a random 6-char salt to the cache hash, bypassing the cached result. The new result replaces the cached version.

### Behavior
- Button appears after content is loaded, below the story
- On click: shows a confirmation ("This will use 1 generation from your daily quota")
- Sends the same payload with an added `regenerateSalt: randomHex(6)` field
- Backend ignores salt in logic but includes it in hash computation → cache miss → fresh generation
- New result saved back to cache (overwrites old)

### Files changed
- `api/index.js` — include `regenerateSalt` in hash input if present
- `services/gemini.ts` — add optional `regenerate?: boolean` param that generates a salt
- `components/StoryView.tsx`, `ScienceView.tsx`, `PhilosophyView.tsx` — regenerate button UI

---

## Dimension 8: UI — Age Toggle & Sources Panel

### Age Toggle
- Location: story request screen, between style picker and Generate button
- Design: 3-chip toggle (Young · Middle · Teen), defaults to Middle
- Persists in `localStorage` across sessions
- Stored in `ArchivedStory.metadata.readingLevel`

### Sources & Key Events Panel
- Location: collapsible section at the bottom of every content view
- Content: research context surfaced as readable cards
  - Story: "Formative Relationship", "Turning Point", "Lesser-Known Detail" + source links
  - Science: "The Human Moment", "Real-World Impact", "The Controversy" + source links
  - Philosophy: "Birth Moment", "Tangible Shift", "Modern Echo" + source links
- Purpose: educational scaffolding; shows kids (and parents) where the story comes from

---

## Dimension 9: Model Provider Configuration

### What
Two API clients in `api/index.js` — one Gemini, one DeepSeek. A single environment variable `USE_DEEPSEEK` controls which client handles text generation. Switching modes requires no code change — only a Vercel env var update and redeploy.

### Environment Variables

| Variable | Value | Purpose |
|---|---|---|
| `API_KEY` | Gemini API key | Already exists. Now used for: research calls + image generation |
| `DEEPSEEK_API_KEY` | DeepSeek API key | New. Used only when `USE_DEEPSEEK=true` |
| `USE_DEEPSEEK` | `true` or `false` | Master toggle. `true` = combo mode. `false` = Gemini-only mode |

### Client Setup in `api/index.js`

```js
import { GoogleGenAI } from "@google/genai";
import OpenAI from "openai"; // DeepSeek uses OpenAI-compatible API

const gemini = new GoogleGenAI({ apiKey: process.env.API_KEY });

const deepseek = process.env.DEEPSEEK_API_KEY
  ? new OpenAI({
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseURL: "https://openrouter.ai/api/v1",
    })
  : null;

const USE_DEEPSEEK = process.env.USE_DEEPSEEK === 'true' && deepseek !== null;
```

### Model Routing

```js
// Research + images: always Gemini 3 Flash Preview (requires Google Search grounding)
const RESEARCH_MODEL = "gemini-3-flash-preview";

// Text generation: DeepSeek Flash in combo mode, Gemini 3 Flash Preview in gemini-only mode
const GENERATION_MODEL = USE_DEEPSEEK ? "deepseek/deepseek-v4-flash" : "gemini-3-flash-preview";
```

### Two Generation Helpers

All generation handlers (`handleGenerateStory`, `handleGenerateScienceEntry`, `handleGeneratePhilosophyEntry`, `handleDiscoverProfiles`, etc.) call a single helper:

```js
const generateText = async (prompt, schema, temperature) => {
  if (USE_DEEPSEEK) {
    // DeepSeek path — OpenAI-compatible, JSON mode
    const response = await deepseek.chat.completions.create({
      model: "deepseek/deepseek-v4-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature,
    });
    return JSON.parse(response.choices[0].message.content);
  } else {
    // Gemini path — structured output with schema
    const response = await runWithRetry(() =>
      gemini.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: schema, temperature },
      })
    );
    return JSON.parse(response.text);
  }
};
```

Research calls always use the Gemini path directly (not via `generateText`) since they need the `googleSearch` tool.

### How to Switch Modes

**To use combo mode (Gemini for research + DeepSeek for generation):**
```
Vercel env: USE_DEEPSEEK = true
           DEEPSEEK_API_KEY = <your key>
```

**To use Gemini-only mode (everything on Gemini 3 Flash Preview):**
```
Vercel env: USE_DEEPSEEK = false
(DEEPSEEK_API_KEY can stay set — it won't be used)
```

Redeploy after changing the env var. No code changes required.

### Schema Note
DeepSeek's `json_object` mode does not accept a typed schema the way Gemini does. The prompt must describe the expected JSON structure in natural language at the end of the prompt block. Add a `JSON FORMAT` section to every generation prompt:

```
=== JSON FORMAT ===
Return a JSON object with exactly these fields:
{
  "english": { "title": string, "introduction": string, "mainBody": string, "valueReflection": string },
  "hindi":   { "title": string, "introduction": string, "mainBody": string, "valueReflection": string },
  "illustrationPrompt": string,
  "geography": { "countryName": string, "funFact": string, "mapPrompt": string }
}
```
This section is ignored by Gemini (it uses the typed schema) but guides DeepSeek's output correctly.

---

## Implementation Sequence

The dimensions have dependencies. Build in this order:

```
Phase 0 — Model provider setup (do this first, everything else builds on it)
  0a. Add `openai` npm package (DeepSeek client)
  0b. Set up Gemini + DeepSeek clients and USE_DEEPSEEK toggle in api/index.js
  0c. Wire generateText() helper with dual-path routing
  0d. Set Vercel env vars: API_KEY (update to Gemini 3 Flash), DEEPSEEK_API_KEY, USE_DEEPSEEK
  0e. Smoke test: generate one story in combo mode, one in gemini-only mode

Phase 1 — Foundation (no UI changes, immediate quality gain)
  1a. Expand style data in constants.ts (voiceCharacteristics, avoidances, sampleTone)
  1b. Add SCIENCE_NARRATOR_STYLES and PHILOSOPHY_NARRATOR_STYLES to constants.ts
  1c. Update AuthorStyle interface in types.ts

Phase 2 — Backend core
  2a. Add ReadingLevel type and WORD_COUNT matrix to types.ts / api/index.js
  2b. Build handleResearch(), handleScienceResearch(), handlePhilosophyResearch()
  2c. Rewrite handleGenerateStory() prompt with research context + new structure
  2d. Rewrite handleGenerateScienceEntry() prompt
  2e. Rewrite handleGeneratePhilosophyEntry() prompt
  2f. Raise temperature to 0.72 on all generation calls
  2g. Add regenerateSalt support to cache hash logic

Phase 3 — Service layer
  3a. Add readingLevel + narratorStyle params to gemini.ts exported functions
  3b. Add regenerate option to generateStory / generateScienceEntry / generatePhilosophyEntry

Phase 4 — UI
  4a. Age toggle component (shared, used in all three views)
  4b. Narrator style picker for Science and Philosophy views
  4c. Sources & Key Events collapsible panel (shared component)
  4d. Regenerate button in all three content views

Phase 5 — Cache migration
  5a. Bump CACHE_VERSION to "v7-research-grounded"
      (invalidates all old cached content so it regenerates with the new pipeline)
```

---

## Risk Notes

| Risk | Mitigation |
|---|---|
| DeepSeek JSON output may drift from expected schema | Include `=== JSON FORMAT ===` block in every generation prompt; existing parse-error handling throws and returns a user-facing retry message |
| USE_DEEPSEEK=false (gemini-only) costs ~10× more per story | Acceptable as a quality-testing fallback; switch back to combo once quality is confirmed |
| Research call adds ~3–5s latency | Run research + any other parallel setup concurrently; show a "Researching {name}..." loading state |
| Google Search grounding may return outdated or incorrect info | Research prompt instructs Gemini to say "Not found" rather than invent; story prompt allows imagination only when research says "not found" |
| CACHE_VERSION bump invalidates all existing cache | Expected and intentional — old stories without research context are lower quality |
| Hindi vocabulary register injection may conflict with style | Test Premchand (Tadbhava) vs Prasad (Tatsama) specifically — these are the highest-contrast pair |
| Temperature 0.72 may produce inconsistent output quality | Monitor first 20 generations post-deploy; roll back to 0.5 if variance is too high |

---

## Success Criteria

A generation is considered improved when:
- The English story names a real specific person from the subject's life (not "a mentor")
- The Hindi story uses sentence-opening patterns native to the chosen style (not subject-verb-object English order)
- A 10-year-old reader encounters at least one fact they didn't know and couldn't have guessed
- The science entry opens with a person doing something, not a definition
- The philosophy entry names a real historical event in the first paragraph
- Switching between Ruskin Bond and Roald Dahl produces a perceptibly different story for the same subject
