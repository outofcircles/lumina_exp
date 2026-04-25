# Implementation Log: Lumina Content Quality Overhaul
**Plan:** `2026-04-24-lumina-content-quality-overhaul.md`
**Implemented:** 2026-04-25
**Status:** ✅ Complete (Phases 0–5) — Phase 6 (smoke test) pending

---

## Summary

Full implementation of the content quality overhaul plan. All 15 sub-phases completed. TypeScript compiles clean (`npx tsc --noEmit` — zero errors, zero warnings). No runtime testing done yet — see Phase 6 checklist below.

---

## Phase 0 — Type System

**File:** `types.ts`

### Added
- `ReadingLevel = 'young' | 'middle' | 'teen'` — core age-group type used throughout the app
- Extended `AuthorStyle` interface with 4 new fields:
  - `voiceCharacteristics: string[]`
  - `avoidances: string[]`
  - `sampleTone: string`
  - `ageAlignment: ReadingLevel[]`
- `HindiAuthorStyle` — extends `AuthorStyle` + adds `vocabularyRegister: 'tatsama' | 'tadbhava' | 'modern' | 'mixed-urdu' | 'avadhi'`
- `NarratorStyle` interface (for Science and Philosophy modes):
  ```typescript
  export interface NarratorStyle {
    id: string; name: string; persona: string; era: string; description: string;
    voiceCharacteristics: string[]; avoidances: string[]; sampleTone: string;
    ageAlignment: ReadingLevel[]; majorWorks: string[];
  }
  ```
- Research data interfaces:
  ```typescript
  export interface StoryResearch {
    keyEvents: string[]; verifiedFacts: string[]; quotes: string[];
    historicalContext: string; sources: string[];
  }
  export interface ScienceResearch {
    discoveryContext: string; keyFigures: string[]; verifiedFacts: string[];
    realWorldApplications: string[]; sources: string[];
  }
  export interface PhilosophyResearch {
    historicalContext: string; keyThinkers: string[]; verifiedFacts: string[];
    societalImpacts: string[]; sources: string[];
  }
  ```
- Added `research?: StoryResearch` to `Story`
- Added `research?: ScienceResearch` to `ScienceEntry`
- Added `research?: PhilosophyResearch` to `PhilosophyEntry`
- Added `readingLevel?: ReadingLevel` to `ArchivedStory.metadata`

---

## Phase 1 — Constants

**File:** `constants.ts`

### Changed
- Import updated: `import { Category, AuthorStyle, HindiAuthorStyle, NarratorStyle, Language } from './types'`
- `AUTHOR_STYLES` — completely rewritten with 20 entries. New IDs use snake_case full names (e.g. `rabindranath_tagore`, `ruskin_bond`, `vikram_seth`). Each entry has all 4 new fields populated.
- `HINDI_AUTHOR_STYLES` — typed as `HindiAuthorStyle[]`, 18 entries, each with `vocabularyRegister`.

### Added
- `SCIENCE_NARRATOR_STYLES: NarratorStyle[]` — 6 entries:
  - `richard_feynman` — "The Joyful Explainer"
  - `carl_sagan` — "The Cosmic Poet"
  - `david_attenborough` — "The Natural Storyteller"
  - `oliver_sacks` — "The Human Scientist"
  - `marie_curie` — "The Determined Pioneer"
  - `stephen_hawking` — "The Accessible Visionary"
- `PHILOSOPHY_NARRATOR_STYLES: NarratorStyle[]` — 6 entries:
  - `alan_watts` — "The Zen Storyteller"
  - `bertrand_russell` — "The Clear Thinker"
  - `simone_de_beauvoir` — "The Existential Voice"
  - `rumi` — "The Mystical Poet"
  - `aristotle` — "The Systematic Teacher"
  - `mahatma_gandhi` — "The Practical Sage"

---

## Phase 2 — Backend API

**File:** `api/index.js`

### Architecture Changes
- Added `import OpenAI from "openai"` (npm package used to call OpenRouter/DeepSeek)
- Dual model client:
  ```javascript
  const openaiClient = process.env.OPENROUTER_API_KEY
    ? new OpenAI({ apiKey: process.env.OPENROUTER_API_KEY, baseURL: 'https://openrouter.ai/api/v1' })
    : null;
  const USE_DEEPSEEK = process.env.USE_DEEPSEEK === 'true' && openaiClient !== null;
  const RESEARCH_MODEL = "gemini-2.5-flash";
  const GENERATION_MODEL = USE_DEEPSEEK ? "deepseek/deepseek-chat-v3-0324:free" : "gemini-2.5-flash";
  ```
- Cache version bumped: `"v6-length-support"` → `"v7-research-grounded"` (invalidates all old cache)
- `regenerateSalt` excluded from cache hash so regeneration bypasses cache without corrupting stable keys

### Word Count Matrix
```javascript
const WORD_COUNT = {
  young:  { short: 300,  medium: 550,  long: 900  },
  middle: { short: 400,  medium: 850,  long: 1400 },
  teen:   { short: 550,  medium: 1100, long: 1800 },
};
```

### New Helpers
- `generateText(prompt, schema, temperature)` — routes to DeepSeek (OpenAI SDK) or Gemini based on `USE_DEEPSEEK` flag
- `buildGeminiSchema(schema)` — converts plain JSON schema objects to Gemini `Type.*` format for structured output

### New Handlers (Research — Gemini + Google Search grounding)
- `handleResearchStory` — researches historical figure using `tools: [{ googleSearch: {} }]`, `temperature: 0.1`, returns `StoryResearch`
- `handleResearchScience` — researches scientific concept, returns `ScienceResearch`
- `handleResearchPhilosophy` — researches philosophical concept, returns `PhilosophyResearch`

### Updated Handlers (Generation)
All three generation handlers now inject:
- `levelBlock` — reading level vocabulary/complexity instructions per age group
- `narratorBlock` — narrator/author voice persona instructions
- `researchBlock` — verified facts, key events, quotes from research phase

---

## Phase 3 — Service Layer

**File:** `services/gemini.ts`

### Added exports
- `researchStory(profile, storyLength, readingLevel)` → `Promise<StoryResearch>`
- `researchScience(item, storyLength, readingLevel)` → `Promise<ScienceResearch>`
- `researchPhilosophy(item, storyLength, readingLevel)` → `Promise<PhilosophyResearch>`

### Updated signatures
```typescript
export const generateStory = async (
  profile, englishStyleName, englishStyleDesc, hindiStyleName, hindiStyleDesc,
  storyLength: StoryLength = 'medium',
  readingLevel: ReadingLevel = 'middle',
  research?: StoryResearch,
  regenerate?: boolean,
): Promise<Story>

export const generateScienceEntry = async (
  item, storyLength, readingLevel,
  narratorStyle?: NarratorStyle,
  research?: ScienceResearch,
  regenerate?: boolean,
): Promise<ScienceEntry>

export const generatePhilosophyEntry = async (
  item, storyLength, readingLevel,
  narratorStyle?: NarratorStyle,
  research?: PhilosophyResearch,
  regenerate?: boolean,
): Promise<PhilosophyEntry>
```

---

## Phase 4 — New UI Components

### `components/ReadingLevelToggle.tsx` (new file)
3-button toggle for age group selection. Accepts `accentColor` prop for theming (amber/emerald/indigo per mode).

```tsx
interface ReadingLevelToggleProps {
  value: ReadingLevel;
  onChange: (level: ReadingLevel) => void;
  accentColor?: 'amber' | 'emerald' | 'indigo';
}
// Labels: young → "Ages 6–9", middle → "Ages 10–13", teen → "Ages 14+"
```

### `components/SourcesPanel.tsx` (new file)
Collapsible panel rendered at the bottom of all three view components. Uses type guards to render the correct sections per content type:
- Stories: Key Events, Verified Facts, Notable Quotes
- Science: Discovery Context, Real-World Applications, Key Figures
- Philosophy: Historical Context, Societal Impacts, Key Thinkers

```tsx
interface SourcesPanelProps {
  research: StoryResearch | ScienceResearch | PhilosophyResearch;
  accentColor?: 'amber' | 'emerald' | 'indigo';
}
```

---

## Phase 5 — View & App Updates

### `components/StoryView.tsx`
- Added imports: `ReadingLevel`, `ReadingLevelToggle`, `SourcesPanel`
- Extended `StoryViewProps`: added `readingLevel`, `onReadingLevelChange`
- `onRegenerate` signature updated to include `narratorStyleId?` and `readingLevel?`
- Toolbar: length buttons + `ReadingLevelToggle` in a column layout
- `SourcesPanel` rendered before report footer when `story.research` exists

### `components/ScienceView.tsx`
- Added imports: `SCIENCE_NARRATOR_STYLES`, `ReadingLevelToggle`, `SourcesPanel`
- Extended `ScienceViewProps`: added `readingLevel`, `onReadingLevelChange`, `currentNarratorStyleId`
- Local state `localNarratorStyleId` initialized from `currentNarratorStyleId`
- Toolbar: Length buttons + `ReadingLevelToggle` + Voice `<select>` dropdown (6 narrators)
- Regenerate button passes `localNarratorStyleId`
- `SourcesPanel` rendered at bottom

### `components/PhilosophyView.tsx`
- Same pattern as ScienceView
- Uses `PHILOSOPHY_NARRATOR_STYLES` and `accentColor="indigo"`

### `App.tsx`
**New state:**
```typescript
const [readingLevel, setReadingLevel] = useState<ReadingLevel>(() =>
  (localStorage.getItem('lumina_reading_level') as ReadingLevel) || 'middle'
);
const [currentNarratorStyleId, setCurrentNarratorStyleId] = useState<string>('');
const [loadingMessage, setLoadingMessage] = useState<string>('Generating content...');
```

**Two-step pipeline in `generateForItem`:**
1. Set `loadingMessage` to `"Researching [Name/Topic]..."`
2. Call research function → get `StoryResearch | ScienceResearch | PhilosophyResearch`
3. Set `loadingMessage` to `"Writing story..." / "Writing science entry..." / "Writing entry..."`
4. Call generation function with research data

**Other changes:**
- `readingLevel` persisted to `localStorage` on change
- `handleRegenerate` accepts `newNarratorStyleId?` and `newReadingLevel?`
- Loading spinner displays `{loadingMessage}` instead of static string
- All three view components receive `readingLevel`, `onReadingLevelChange`, `currentNarratorStyleId` props

---

## Bug Fixes (incidental)

### `services/storage.ts`
- **Error TS2353**: `metadataExtras` param didn't include `readingLevel` → added `readingLevel?: import('../types').ReadingLevel` to inline type
- **Error TS2322**: `getArchivedStories` metadata spread typed as `Record<string, unknown>` but `ArchivedStory.metadata` requires `categoryId: string` → cast spread to `ArchivedStory['metadata']`

### `services/safety.ts`
- **Error TS2304**: `supabase` used in `reportIssue()` without import → added `import { supabase } from './supabaseClient'`

---

## Phase 6 — Smoke Test (Pending)

No code changes required. Manual steps only.

### Environment Setup (`.env.local`)
```bash
# Option A: DeepSeek via OpenRouter (free, faster generation)
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
USE_DEEPSEEK=true

# Option B: Gemini only (no extra key needed)
USE_DEEPSEEK=false
```

### Test Checklist

**Stories mode**
- [ ] Generate a story — loading message changes: "Researching [Name]..." → "Writing story..."
- [ ] Age toggle (Ages 6–9 / Ages 10–13 / Ages 14+) appears in toolbar
- [ ] Switching age and regenerating produces noticeably different vocabulary
- [ ] "Research Sources" panel visible at bottom, collapses/expands

**Science mode**
- [ ] Narrator dropdown shows 6 options (Feynman, Sagan, Attenborough, Sacks, Curie, Hawking)
- [ ] Switching narrator and regenerating changes voice/tone
- [ ] Age toggle works
- [ ] SourcesPanel shows: Discovery Context, Real-World Applications

**Philosophy mode**
- [ ] Narrator dropdown shows 6 options (Watts, Russell, de Beauvoir, Rumi, Aristotle, Gandhi)
- [ ] Age toggle works
- [ ] SourcesPanel shows: Historical Context, Societal Impacts

**Archive**
- [ ] Save a generated item — appears in archive
- [ ] `readingLevel` stored in metadata (check Supabase `shared_stories` table)
- [ ] Favorites toggle still works

**Regression**
- [ ] Hindi stories still generate and display correctly
- [ ] Map image still loads in Story view geography section
- [ ] Audio player appears when audio is available
- [ ] Report dialog opens and submits

---

## File Change Summary

| File | Status |
|---|---|
| `types.ts` | Modified — 5 new types, 3 new interfaces, 3 updated interfaces |
| `constants.ts` | Rewritten — new IDs, 20+18 author styles, 6+6 narrator styles |
| `api/index.js` | Rewritten — dual model, word count matrix, 6 new/updated handlers |
| `services/gemini.ts` | Modified — 3 new research exports, updated generation signatures |
| `components/ReadingLevelToggle.tsx` | New file |
| `components/SourcesPanel.tsx` | New file |
| `components/StoryView.tsx` | Modified — reading level toggle, SourcesPanel, prop updates |
| `components/ScienceView.tsx` | Modified — narrator dropdown, reading level, SourcesPanel |
| `components/PhilosophyView.tsx` | Modified — narrator dropdown, reading level, SourcesPanel |
| `App.tsx` | Modified — two-step pipeline, new state, loading messages, prop wiring |
| `services/storage.ts` | Modified — readingLevel in metadata, type cast fix |
| `services/safety.ts` | Modified — added missing supabase import |
