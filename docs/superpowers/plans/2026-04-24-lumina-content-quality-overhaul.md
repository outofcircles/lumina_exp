# Lumina Content Quality Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add age-level reading system, web-research-grounded generation, expanded narrator styles for Science/Philosophy, and improved prompts across all three modes.

**Architecture:** Two-step pipeline — Gemini + Google Search grounding fetches real biographical/scientific/philosophical facts, then a text generation model (DeepSeek V4 Flash via OpenRouter, or Gemini fallback) writes the story/entry using that research as context. Reading level (young/middle/teen) and narrator style drive per-call prompt tailoring.

**Tech Stack:** TypeScript + React + Vite (frontend), Vercel serverless `api/index.js` (backend), `@google/genai` (research + Gemini fallback), `openai` npm package (DeepSeek via OpenRouter), Supabase (cache + quota)

---

## File Map

| File | Change |
|------|--------|
| `package.json` | Add `openai` dependency |
| `types.ts` | Add `ReadingLevel`, extend `AuthorStyle`/`HindiAuthorStyle`, add research interfaces, add `research?` field to content types, add `readingLevel` to archive metadata |
| `constants.ts` | Expand all 20 English + 18 Hindi author styles; add `SCIENCE_NARRATOR_STYLES` (6) + `PHILOSOPHY_NARRATOR_STYLES` (6) |
| `api/index.js` | Dual model clients, `generateText()` helper, `WORD_COUNT` 3×3 matrix, research handlers, rewritten generation handlers, `regenerateSalt` in cache hash, bump `CACHE_VERSION` |
| `services/gemini.ts` | Add `readingLevel`, `narratorStyleId`, `regenerate` params to all three generate functions |
| `App.tsx` | Add `readingLevel` state (localStorage), `currentNarratorStyleId` state, extend `generateForItem`/`handleRegenerate`, dynamic loading message |
| `components/ReadingLevelToggle.tsx` | New shared component — 3-button toggle (Young / Middle / Teen) |
| `components/SourcesPanel.tsx` | New shared component — collapsible research context cards |
| `components/StoryView.tsx` | Wire `ReadingLevelToggle` + `SourcesPanel` |
| `components/ScienceView.tsx` | Add narrator style picker + `ReadingLevelToggle` + `SourcesPanel` |
| `components/PhilosophyView.tsx` | Add narrator style picker + `ReadingLevelToggle` + `SourcesPanel` |

---

## Phase 0 — Environment

### Task 1: Install openai package

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

Run in terminal (project root):
```bash
npm install openai
```

- [ ] **Step 2: Verify**

```bash
cat package.json | grep '"openai"'
```
Expected output: `"openai": "^4.x.x"` (version may vary)

---

## Phase 1 — Type System & Style Data

### Task 2: Extend types.ts

**Files:**
- Modify: `types.ts`

- [ ] **Step 1: Add `ReadingLevel` type and extend `AuthorStyle`**

Replace the `AuthorStyle` interface and add new types. Open `types.ts` and replace from line 105 to end of file with:

```typescript
export type ReadingLevel = 'young' | 'middle' | 'teen';

export interface AuthorStyle {
  id: string;
  name: string;
  description: string;
  persona: string;
  era: string;
  majorWorks: string[];
  voiceCharacteristics: string[];
  avoidances: string[];
  sampleTone: string;
  ageAlignment: ReadingLevel[];
}

export interface HindiAuthorStyle extends AuthorStyle {
  vocabularyRegister: 'tatsama' | 'tadbhava' | 'modern' | 'mixed-urdu' | 'avadhi';
}

export interface NarratorStyle {
  id: string;
  name: string;
  persona: string;
  era: string;
  description: string;
  voiceCharacteristics: string[];
  avoidances: string[];
  sampleTone: string;
  ageAlignment: ReadingLevel[];
  majorWorks: string[];
}

// Research context types — returned by research handlers, embedded in content objects
export interface StoryResearch {
  keyEvents: string[];
  verifiedFacts: string[];
  quotes: string[];
  historicalContext: string;
  sources: string[];
}

export interface ScienceResearch {
  discoveryContext: string;
  keyFigures: string[];
  verifiedFacts: string[];
  realWorldApplications: string[];
  sources: string[];
}

export interface PhilosophyResearch {
  historicalContext: string;
  keyThinkers: string[];
  verifiedFacts: string[];
  societalImpacts: string[];
  sources: string[];
}
```

- [ ] **Step 2: Add `research?` field to `Story`, `ScienceEntry`, `PhilosophyEntry` and `readingLevel` to archive metadata**

In `types.ts`, update the three content interfaces and `ArchivedStory`:

```typescript
export interface Story {
  illustrationPrompt: string;
  generatedImageUrl?: string;
  generatedMapUrl?: string;
  generatedAudioUrl?: string;
  english: StoryContent;
  hindi: StoryContent;
  geography: GeographyInfo;
  englishStyle: string;
  hindiStyle: string;
  research?: StoryResearch;
}

export interface ScienceEntry {
  title: string;
  conceptDefinition: string;
  humanStory: string;
  experimentOrActivity: string;
  sources: string[];
  illustrationPrompt: string;
  generatedImageUrl?: string;
  research?: ScienceResearch;
}

export interface PhilosophyEntry {
  title: string;
  coreIdeaExplanation: string;
  historicalEpisode: string;
  modernrelevance: string;
  sources: string[];
  illustrationPrompt: string;
  generatedImageUrl?: string;
  research?: PhilosophyResearch;
}

export interface ArchivedStory {
  id: string;
  type: AppMode;
  itemData: Profile | ScienceItem | PhilosophyItem;
  content: Story | ScienceEntry | PhilosophyEntry;
  isFavorite?: boolean;
  metadata: {
    categoryId: string;
    styleName?: string;
    personaName?: string;
    primaryLanguage?: Language;
    readingLevel?: ReadingLevel;
    createdAt: number;
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```
Expected: no errors (warnings OK if any pre-existing).

---

### Task 3: Expand English AUTHOR_STYLES in constants.ts

**Files:**
- Modify: `constants.ts`

The existing `AUTHOR_STYLES` array has 20 entries each with only `id`, `name`, `description`, `persona`, `era`, `majorWorks`. Add the four new fields to each entry.

- [ ] **Step 1: Replace the full AUTHOR_STYLES export**

Open `constants.ts`. Find `export const AUTHOR_STYLES: AuthorStyle[]` and replace the entire array with the following. (Only the first 5 shown in full as a pattern — replicate for all 20, following the same structure):

```typescript
export const AUTHOR_STYLES: AuthorStyle[] = [
  {
    id: 'rabindranath_tagore',
    name: 'Rabindranath Tagore',
    description: 'Poetic, lyrical prose with deep spiritual undertones',
    persona: 'The Poet-Philosopher',
    era: '1861–1941',
    majorWorks: ['Gitanjali', 'The Home and the World', 'Gora'],
    voiceCharacteristics: ['lyrical sentences', 'nature metaphors', 'inner spiritual journey', 'gentle wisdom'],
    avoidances: ['harsh technical language', 'cynicism', 'abrupt scene cuts'],
    sampleTone: 'Like morning light on still water — serene, luminous, searching.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'ruskin_bond',
    name: 'Ruskin Bond',
    description: 'Warm, conversational, Himalayan simplicity',
    persona: 'The Gentle Observer',
    era: '1934–present',
    majorWorks: ['The Room on the Roof', 'A Flight of Pigeons', 'The Blue Umbrella'],
    voiceCharacteristics: ['short clear sentences', 'vivid sensory detail', 'quiet wonder', 'warmth for ordinary people'],
    avoidances: ['grandiloquence', 'tragedy without hope', 'complex flashback structures'],
    sampleTone: 'Sitting beside a hill stream, watching clouds — unhurried, affectionate, alive.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'roald_dahl',
    name: 'Roald Dahl',
    description: 'Mischievous wit, child-eye view, delicious darkness',
    persona: 'The Mischief-Maker',
    era: '1916–1990',
    majorWorks: ['Matilda', 'Charlie and the Chocolate Factory', 'James and the Giant Peach'],
    voiceCharacteristics: ['invented words', 'conspiratorial whisper to the reader', 'surprising reversals', 'absurdist detail'],
    avoidances: ['adult political commentary', 'sentimentality', 'passive protagonists'],
    sampleTone: 'A secret shared between you and the child hero — giddy, sharp-eyed, triumphant.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'maya_angelou',
    name: 'Maya Angelou',
    description: 'Rhythmic, soulful, unflinching resilience',
    persona: 'The Testifying Voice',
    era: '1928–2014',
    majorWorks: ["I Know Why the Caged Bird Sings", 'Still I Rise', 'Mom & Me & Mom'],
    voiceCharacteristics: ['musical cadence', 'sensory richness', 'dignity in adversity', 'communal voice'],
    avoidances: ['detached narration', 'irony without warmth', 'passive constructions'],
    sampleTone: 'Rooted as an oak, open as sky — bearing witness, claiming joy.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'vikram_seth',
    name: 'Vikram Seth',
    description: 'Elegant, precise, deeply humanistic',
    persona: 'The Careful Chronicler',
    era: '1952–present',
    majorWorks: ['A Suitable Boy', 'The Golden Gate', 'Two Lives'],
    voiceCharacteristics: ['careful observation', 'emotional restraint', 'precise vocabulary', 'multicultural empathy'],
    avoidances: ['overwrought emotion', 'dialect caricature', 'rushed conclusions'],
    sampleTone: 'Patient as a miniaturist — each detail chosen, each feeling earned.',
    ageAlignment: ['teen'],
  },
  // --- entries 6-20: replicate the same 4-field pattern for the remaining existing styles ---
  // (preserve all existing id/name/description/persona/era/majorWorks values exactly)
  {
    id: 'arundhati_roy',
    name: 'Arundhati Roy',
    description: 'Dense sensory prose, political passion, layered time',
    persona: 'The Weaver of Worlds',
    era: '1961–present',
    majorWorks: ['The God of Small Things', 'The Ministry of Utmost Happiness', 'Capitalism: A Ghost Story'],
    voiceCharacteristics: ['fragmented chronology', 'visceral imagery', 'political conscience', 'invented compound words'],
    avoidances: ['simple linear narrative', 'uncomplicated heroes', 'sanitised settings'],
    sampleTone: 'Rich and restless — like monsoon air before the rain breaks.',
    ageAlignment: ['teen'],
  },
  {
    id: 'rk_narayan',
    name: 'R.K. Narayan',
    description: 'Gentle irony, small-town India, everyday epiphanies',
    persona: 'The Malgudi Chronicler',
    era: '1906–2001',
    majorWorks: ['Swami and Friends', 'The Guide', 'Malgudi Days'],
    voiceCharacteristics: ['light irony', 'unheroic heroes', 'dialogue-driven scenes', 'timeless small-town texture'],
    avoidances: ['grand historical sweep', 'melodrama', 'moralistic endings'],
    sampleTone: 'Quiet as an afternoon in a sleepy town — wry, fond, accepting.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'premchand',
    name: 'Premchand',
    description: 'Social realism, rural India, moral urgency',
    persona: 'The Voice of the Soil',
    era: '1880–1936',
    majorWorks: ['Godaan', 'Nirmala', 'Idgah'],
    voiceCharacteristics: ['vivid rural settings', 'class consciousness', 'moral clarity', 'compassion for the marginalised'],
    avoidances: ['urban sophistication', 'ambiguous morality', 'ornate language'],
    sampleTone: 'Direct as ploughed earth — honest, compassionate, unsparing.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'mark_twain',
    name: 'Mark Twain',
    description: 'Satirical wit, vernacular warmth, American adventure',
    persona: 'The Mississippi Rascal',
    era: '1835–1910',
    majorWorks: ['The Adventures of Tom Sawyer', 'Adventures of Huckleberry Finn', 'The Prince and the Pauper'],
    voiceCharacteristics: ['tall tales', 'colloquial rhythm', 'sharp social satire wrapped in humour', 'boy-hero perspective'],
    avoidances: ['phonetic dialect spelling', 'cynicism without affection', 'adult political lectures'],
    sampleTone: 'One eye winking at authority, the other watching the river — free, funny, sly.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'charles_dickens',
    name: 'Charles Dickens',
    description: 'Vivid characters, social conscience, Victorian drama',
    persona: 'The Great Chronicler',
    era: '1812–1870',
    majorWorks: ['Oliver Twist', 'A Tale of Two Cities', 'Great Expectations'],
    voiceCharacteristics: ['theatrical character introductions', 'serialised dramatic beats', 'sharp class observation', 'redemption arcs'],
    avoidances: ['modern slang', 'ambiguous villains', 'flat secondary characters'],
    sampleTone: 'Grand as a fog-lit city — generous, indignant, full of life.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'jane_austen',
    name: 'Jane Austen',
    description: 'Ironic observation, social comedy, inner life',
    persona: 'The Witty Observer',
    era: '1775–1817',
    majorWorks: ['Pride and Prejudice', 'Sense and Sensibility', 'Emma'],
    voiceCharacteristics: ['free indirect discourse', 'dry social irony', 'precise emotional observation', 'wit without cruelty'],
    avoidances: ['explicit moralising', 'melodrama', 'physical action scenes'],
    sampleTone: 'Polished as a drawing-room mirror — seeing everything, saying it sidelong.',
    ageAlignment: ['teen'],
  },
  {
    id: 'leo_tolstoy',
    name: 'Leo Tolstoy',
    description: 'Moral depth, psychological realism, epic scope',
    persona: 'The Moral Giant',
    era: '1828–1910',
    majorWorks: ['War and Peace', 'Anna Karenina', 'The Death of Ivan Ilyich'],
    voiceCharacteristics: ['long internal monologue', 'moral wrestling', 'historical panorama', 'simple peasant wisdom contrasted with noble complexity'],
    avoidances: ['irony', 'ambiguous ethics', 'rapid-fire plot'],
    sampleTone: 'Slow and searching as a Russian winter — vast, honest, inevitable.',
    ageAlignment: ['teen'],
  },
  {
    id: 'gabriel_garcia_marquez',
    name: 'Gabriel García Márquez',
    description: 'Magical realism, Latin American heat, myth and memory',
    persona: 'The Dream Weaver',
    era: '1927–2014',
    majorWorks: ['One Hundred Years of Solitude', 'Love in the Time of Cholera', 'Chronicle of a Death Foretold'],
    voiceCharacteristics: ['matter-of-fact magical events', 'circular time', 'village as cosmos', 'lush tropical imagery'],
    avoidances: ['cold rationalism', 'linear causality', 'clinical description'],
    sampleTone: 'Where the ordinary turns into miracle without apology — warm, strange, timeless.',
    ageAlignment: ['teen'],
  },
  {
    id: 'paulo_coelho',
    name: 'Paulo Coelho',
    description: 'Allegorical simplicity, spiritual quest, universal wisdom',
    persona: 'The Pilgrim',
    era: '1947–present',
    majorWorks: ['The Alchemist', 'The Pilgrimage', 'Brida'],
    voiceCharacteristics: ['short parable-like paragraphs', 'universal archetypes', 'spiritual journey structure', 'simple but resonant aphorisms'],
    avoidances: ['irony', 'complex subplot', 'ambiguous spiritual messages'],
    sampleTone: 'Plain as a desert path — each step a lesson, each stone a sign.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'chimamanda_adichie',
    name: 'Chimamanda Ngozi Adichie',
    description: 'Nigerian voice, feminist clarity, cultural duality',
    persona: 'The Double-Vision Teller',
    era: '1977–present',
    majorWorks: ['Purple Hibiscus', 'Half of a Yellow Sun', 'Americanah'],
    voiceCharacteristics: ['bicultural perspective', 'precise emotional intelligence', 'political without preaching', 'sensory Nigerian detail'],
    avoidances: ['Western-centric framing', 'passive female characters', 'pat resolutions'],
    sampleTone: 'Clear as harmattan light — honest, layered, refusing easy answers.',
    ageAlignment: ['teen'],
  },
  {
    id: 'jules_verne',
    name: 'Jules Verne',
    description: 'Scientific adventure, wonder, meticulous invention',
    persona: 'The Adventurous Engineer',
    era: '1828–1905',
    majorWorks: ['Twenty Thousand Leagues Under the Sea', 'Around the World in Eighty Days', 'Journey to the Centre of the Earth'],
    voiceCharacteristics: ['detailed technical description', 'expedition pacing', 'enthusiastic encyclopaedic digressions', 'optimism about science'],
    avoidances: ['supernatural explanations', 'emotional interiority', 'ambiguous technology'],
    sampleTone: 'Brisk and inventive — every obstacle a puzzle, every horizon an invitation.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'hg_wells',
    name: 'H.G. Wells',
    description: 'Social prophecy, scientific imagination, everyday setting invaded by the extraordinary',
    persona: 'The Prophet-Scientist',
    era: '1866–1946',
    majorWorks: ['The Time Machine', 'The War of the Worlds', 'The Invisible Man'],
    voiceCharacteristics: ['matter-of-fact extraordinary events', 'social class critique', 'journalistic clarity', 'slow dread building'],
    avoidances: ['optimistic endings', 'escapist fantasy', 'individual heroism over systemic change'],
    sampleTone: 'Calm and unsettling — the extraordinary arriving in an ordinary street.',
    ageAlignment: ['middle', 'teen'],
  },
  {
    id: 'jk_rowling',
    name: 'J.K. Rowling',
    description: 'Magical world-building, chosen hero, moral clarity',
    persona: 'The World-Builder',
    era: '1965–present',
    majorWorks: ['Harry Potter series', 'The Ickabog', 'The Christmas Pig'],
    voiceCharacteristics: ['invented proper nouns', 'chapter-ending hooks', 'warmly ironic narrator', 'boarding-school social dynamics'],
    avoidances: ['grimdark tone', 'absence of humour', 'unresolved plot threads'],
    sampleTone: 'Cosy yet urgent — the common room fire and the dark forest, always together.',
    ageAlignment: ['young', 'middle'],
  },
  {
    id: 'toni_morrison',
    name: 'Toni Morrison',
    description: 'Lyrical power, Black American experience, ancestral memory',
    persona: 'The Memory Keeper',
    era: '1931–2019',
    majorWorks: ['Beloved', 'Song of Solomon', 'The Bluest Eye'],
    voiceCharacteristics: ['non-linear memory', 'communal voice', 'haunting imagery', 'dignity of suffering'],
    avoidances: ['linear chronology', 'simple resolution', 'distanced narration'],
    sampleTone: 'Deep as root memory — grieving, beautiful, insisting on humanity.',
    ageAlignment: ['teen'],
  },
  {
    id: 'khalil_gibran',
    name: 'Kahlil Gibran',
    description: 'Prophetic prose-poetry, spiritual universalism, Lebanese mysticism',
    persona: 'The Prophet Voice',
    era: '1883–1931',
    majorWorks: ['The Prophet', 'The Madman', 'Sand and Foam'],
    voiceCharacteristics: ['aphoristic wisdom', 'nature-as-metaphor', 'direct address to the reader', 'spiritual paradox'],
    avoidances: ['narrative plot', 'irony', 'grounded mundane detail'],
    sampleTone: 'A voice from a mountain — timeless, tender, speaking of what cannot be unsaid.',
    ageAlignment: ['middle', 'teen'],
  },
];
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

---

### Task 4: Expand HINDI_AUTHOR_STYLES + add SCIENCE/PHILOSOPHY narrator styles in constants.ts

**Files:**
- Modify: `constants.ts`

- [ ] **Step 1: Replace HINDI_AUTHOR_STYLES with the HindiAuthorStyle type**

Add import of `HindiAuthorStyle` and `NarratorStyle` to the constants.ts imports at the top:

```typescript
import { AuthorStyle, HindiAuthorStyle, NarratorStyle, ReadingLevel } from './types';
```

Then replace the `HINDI_AUTHOR_STYLES` export. The key addition is `vocabularyRegister` on every entry plus the four new style fields. Below is the full array:

```typescript
export const HINDI_AUTHOR_STYLES: HindiAuthorStyle[] = [
  {
    id: 'premchand_hindi',
    name: 'प्रेमचंद',
    description: 'सामाजिक यथार्थवाद, ग्रामीण भारत, नैतिक तात्कालिकता',
    persona: 'मिट्टी की आवाज़',
    era: '1880–1936',
    majorWorks: ['गोदान', 'निर्मला', 'ईदगाह'],
    voiceCharacteristics: ['सरल ग्रामीण भाषा', 'वर्ग-चेतना', 'नैतिक स्पष्टता', 'दलितों के प्रति करुणा'],
    avoidances: ['शहरी परिष्कार', 'अस्पष्ट नैतिकता', 'अलंकृत भाषा'],
    sampleTone: 'जुती हुई ज़मीन की तरह सीधी — ईमानदार, करुणामय, निर्भीक।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tadbhava',
  },
  {
    id: 'mahadevi_varma',
    name: 'महादेवी वर्मा',
    description: 'छायावादी काव्य-गद्य, स्त्री-चेतना, आध्यात्मिक करुणा',
    persona: 'आँसुओं की रानी',
    era: '1907–1987',
    majorWorks: ['मेरा परिवार', 'अतीत के चलचित्र', 'स्मृति की रेखाएँ'],
    voiceCharacteristics: ['संगीतात्मक वाक्य', 'प्रकृति-बिम्ब', 'स्त्री-जीवन की पीड़ा', 'आध्यात्मिक गहराई'],
    avoidances: ['तार्किक शुष्कता', 'हास्य', 'राजनीतिक टिप्पणी'],
    sampleTone: 'दीपक की लौ जैसी — कोमल, स्थिर, अंधेरे में भी जलती।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'harivansh_rai_bachchan',
    name: 'हरिवंश राय बच्चन',
    description: 'मधुशाला की लय, जीवन-दर्शन, सरल गेयता',
    persona: 'जीवन-गायक',
    era: '1907–2003',
    majorWorks: ['मधुशाला', 'मधुबाला', 'क्या भूलूँ क्या याद करूँ'],
    voiceCharacteristics: ['गेय लय', 'जीवन-दर्शन', 'सरल प्रतीक', 'उत्सव-भाव'],
    avoidances: ['क्लिष्ट संस्कृत पद', 'निराशावाद', 'राजनीतिक व्याख्या'],
    sampleTone: 'मदिरालय की शाम जैसी — उत्सवी, दार्शनिक, मानवीय।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tadbhava',
  },
  {
    id: 'gulzar',
    name: 'गुलज़ार',
    description: 'उर्दू-हिंदी मिश्रण, बिम्बात्मक काव्य, शहरी उदासी',
    persona: 'धुएँ का शायर',
    era: '1934–present',
    majorWorks: ['त्रिवेणी', 'रात पश्मीने की', 'पुखराज'],
    voiceCharacteristics: ['उर्दू-हिंदी मिश्रण', 'अप्रत्याशित बिम्ब', 'मौन का सौंदर्य', 'शहरी एकाकीपन'],
    avoidances: ['ग्रामीण परिदृश्य', 'नैतिक उपदेश', 'उज्ज्वल समाधान'],
    sampleTone: 'धुएँ में लिखी इबारत — अधूरी, खूबसूरत, बेहद असरदार।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'mixed-urdu',
  },
  {
    id: 'nirala',
    name: 'सूर्यकांत त्रिपाठी निराला',
    description: 'छायावादी विद्रोह, श्रमिक-गरिमा, छंदमुक्त ओज',
    persona: 'महाप्राण',
    era: '1896–1961',
    majorWorks: ['राम की शक्तिपूजा', 'सरोज स्मृति', 'कुकुरमुत्ता'],
    voiceCharacteristics: ['ओजपूर्ण भाषा', 'विद्रोही स्वर', 'श्रमिक-प्रतीक', 'छंदमुक्त प्रवाह'],
    avoidances: ['कोमल स्वर', 'समझौतापरस्त नैतिकता', 'शहरी परिष्कार'],
    sampleTone: 'तूफ़ान में खड़े वट-वृक्ष जैसी — अडिग, ओजस्वी, स्वतंत्र।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'jaishankar_prasad',
    name: 'जयशंकर प्रसाद',
    description: 'छायावाद, भारतीय इतिहास-दर्शन, गीतात्मकता',
    persona: 'युग-दृष्टा',
    era: '1889–1937',
    majorWorks: ['कामायनी', 'चंद्रगुप्त', 'स्कंदगुप्त'],
    voiceCharacteristics: ['भव्य ऐतिहासिक परिदृश्य', 'प्रतीकात्मक पात्र', 'दार्शनिक गहराई', 'संस्कृत-निष्ठ भाषा'],
    avoidances: ['आधुनिक बोलचाल', 'हास्य', 'व्यक्तिगत आत्मकथा'],
    sampleTone: 'महाकाव्य की तरह भव्य — इतिहास और स्वप्न एक साथ।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'sumitranandan_pant',
    name: 'सुमित्रानंदन पंत',
    description: 'प्रकृति-प्रेम, सौंदर्यवाद, प्रगतिशील चेतना',
    persona: 'प्रकृति का कवि',
    era: '1900–1977',
    majorWorks: ['पल्लव', 'चिदम्बरा', 'लोकायतन'],
    voiceCharacteristics: ['प्रकृति-बिम्ब', 'कोमल संगीत', 'सौंदर्य-दृष्टि', 'मानवतावादी आदर्श'],
    avoidances: ['कटु यथार्थ', 'शहरी चित्रण', 'राजनीतिक आग्रह'],
    sampleTone: 'हिमालय की कोख में जन्मे झरने जैसी — निर्मल, सुरीली, स्वतंत्र।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'dharamvir_bharati',
    name: 'धर्मवीर भारती',
    description: 'प्रेम, संघर्ष, आधुनिक बोध',
    persona: 'आधुनिक संवेदना',
    era: '1926–1997',
    majorWorks: ['गुनाहों का देवता', 'सूरज का सातवाँ घोड़ा', 'अंधा युग'],
    voiceCharacteristics: ['भावुक गद्य', 'प्रेम-त्रिकोण', 'आधुनिक युवा-चेतना', 'पौराणिक संदर्भ'],
    avoidances: ['शुष्क तार्किकता', 'ग्रामीण परिवेश', 'उपदेशात्मक स्वर'],
    sampleTone: 'दिल की बात सीधे कहना — भावुक, ईमानदार, यादगार।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'modern',
  },
  {
    id: 'amrita_pritam',
    name: 'अमृता प्रीतम',
    description: 'पंजाबी-हिंदी दर्द, स्त्री-स्वतंत्रता, विभाजन-स्मृति',
    persona: 'दर्द की गवाह',
    era: '1919–2005',
    majorWorks: ['पिंजर', 'रसीदी टिकट', 'एक थी आनंदी'],
    voiceCharacteristics: ['साहसिक स्त्री-दृष्टि', 'विभाजन-पीड़ा', 'प्रेम और विद्रोह', 'सीधी भाषा'],
    avoidances: ['मर्द-केंद्रित नज़रिया', 'सुखद समाधान', 'औपचारिक भाषा'],
    sampleTone: 'खुली हवा में कहा गया सच — निर्भीक, दर्दनाक, सुंदर।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'tadbhava',
  },
  {
    id: 'phanishwarnath_renu',
    name: 'फणीश्वरनाथ रेणु',
    description: 'आंचलिक यथार्थ, बिहारी लोक-जीवन, ग्रामीण संगीत',
    persona: 'आँचल का कवि',
    era: '1921–1977',
    majorWorks: ['मैला आँचल', 'परती परिकथा', 'ठुमरी'],
    voiceCharacteristics: ['आंचलिक बोली के रंग', 'लोकगीत-तत्व', 'किसान-जीवन की जटिलता', 'बहुपात्री आख्यान'],
    avoidances: ['शहरी मध्यवर्गीय दृष्टि', 'सरलीकृत समाधान', 'एकल नायक'],
    sampleTone: 'मिट्टी और मेले की महक — जीवंत, बहुरंगी, अपना।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tadbhava',
  },
  {
    id: 'hazari_prasad_dwivedi',
    name: 'हज़ारीप्रसाद द्विवेदी',
    description: 'ललित निबंध, भारतीय संस्कृति, विद्वत्तापूर्ण सरसता',
    persona: 'विद्वान-लालित्य',
    era: '1907–1979',
    majorWorks: ['अशोक के फूल', 'कल्पलता', 'बाणभट्ट की आत्मकथा'],
    voiceCharacteristics: ['ललित निबंध-शैली', 'भारतीय दर्शन के संदर्भ', 'हल्की विनोदवृत्ति', 'इतिहास-सजीव करना'],
    avoidances: ['शुष्क शोधपत्र-शैली', 'राजनीतिक पक्षधरता', 'तनावपूर्ण कथानक'],
    sampleTone: 'पुरानी पोथी और आम के बौर की खुशबू — विद्वान, सरस, भारतीय।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'ismat_chughtai',
    name: 'इस्मत चुगताई',
    description: 'स्त्री-यथार्थ, उर्दू व्यंग्य, मध्यवर्गीय घर की कहानी',
    persona: 'बेबाक बेगम',
    era: '1915–1991',
    majorWorks: ['लिहाफ', 'टेढ़ी लकीर', 'जिद्दी'],
    voiceCharacteristics: ['व्यंग्यात्मक तीक्ष्णता', 'स्त्री-शरीर की राजनीति', 'मध्यवर्गीय पाखंड की आलोचना', 'बोलचाल की उर्दू'],
    avoidances: ['रूमानी आदर्शवाद', 'पुरुष-दृष्टि', 'सुखद अंत'],
    sampleTone: 'घर की दीवारों से बाहर झाँकती आँख — तीखी, साहसी, सच्ची।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'mixed-urdu',
  },
  {
    id: 'rahul_sankrityayan',
    name: 'राहुल सांकृत्यायन',
    description: 'यात्रा-वृत्तांत, तर्कशील बुद्धिवाद, बौद्ध-दर्शन',
    persona: 'महापंडित यायावर',
    era: '1893–1963',
    majorWorks: ['वोल्गा से गंगा', 'मेरी जीवन-यात्रा', 'दर्शन-दिग्दर्शन'],
    voiceCharacteristics: ['यात्रा-कथा शैली', 'तुलनात्मक दृष्टि', 'तर्कशील विश्लेषण', 'ऐतिहासिक विस्तार'],
    avoidances: ['अंधविश्वास', 'धर्म-केंद्रित आख्यान', 'भावुकता'],
    sampleTone: 'क्षितिज तक जाने वाले यायावर की डायरी — जिज्ञासु, तथ्यपरक, अदम्य।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'tatsama',
  },
  {
    id: 'nirmal_verma',
    name: 'निर्मल वर्मा',
    description: 'यूरोपीय एकाकीपन, अस्तित्ववाद, हिंदी आधुनिकता',
    persona: 'एकाकी यात्री',
    era: '1929–2005',
    majorWorks: ['परिंदे', 'वे दिन', 'लाल टीन की छत'],
    voiceCharacteristics: ['लंबे चिंतनशील वाक्य', 'यूरोपीय परिदृश्य', 'अस्तित्ववादी प्रश्न', 'मौन और स्मृति'],
    avoidances: ['सामाजिक आंदोलन', 'स्पष्ट नैतिकता', 'सुखद अंत'],
    sampleTone: 'प्राग की सर्दी में एकांत कमरे में — चिंतनशील, गहरी, उदासीन।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'modern',
  },
  {
    id: 'mannu_bhandari',
    name: 'मन्नू भंडारी',
    description: 'नई कहानी, स्त्री-मध्यवर्ग, आंतरिक द्वंद्व',
    persona: 'अंतर्मन की आवाज़',
    era: '1931–2021',
    majorWorks: ['आपका बंटी', 'महाभोज', 'एक प्लेट सैलाब'],
    voiceCharacteristics: ['स्त्री की आंतरिक आवाज़', 'परिवार के भीतर संघर्ष', 'मध्यवर्गीय यथार्थ', 'संवेदनशील शैली'],
    avoidances: ['आदर्शवादी समाधान', 'वीर-पुरुष केंद्रित आख्यान', 'ऐतिहासिक महाकाव्य'],
    sampleTone: 'घर के अंदर से देखा सच — कोमल, ईमानदार, बेचैन।',
    ageAlignment: ['teen'],
    vocabularyRegister: 'modern',
  },
  {
    id: 'vishnu_prabhakar',
    name: 'विष्णु प्रभाकर',
    description: 'गाँधीवादी मूल्य, जीवनी, सामाजिक सेवा-भाव',
    persona: 'सेवा-पथ का राही',
    era: '1912–2009',
    majorWorks: ['आवारा मसीहा', 'अर्धनारीश्वर', 'धरती अब भी घूम रही है'],
    voiceCharacteristics: ['गाँधीवादी सादगी', 'सत्याग्रह की भाषा', 'नैतिक आग्रह', 'जीवनी-शैली'],
    avoidances: ['हिंसा का महिमामंडन', 'जटिल मनोविज्ञान', 'शहरी पाखंड'],
    sampleTone: 'चरखे की लय जैसी — धीमी, नैतिक, अडिग।',
    ageAlignment: ['middle', 'teen'],
    vocabularyRegister: 'tadbhava',
  },
  {
    id: 'surdas',
    name: 'सूरदास',
    description: 'भक्ति-काव्य, बाल-कृष्ण, विनम्र भक्त-भाव',
    persona: 'अष्टछाप का भक्त',
    era: '1478–1583',
    majorWorks: ['सूरसागर', 'सूर-सारावली', 'साहित्य-लहरी'],
    voiceCharacteristics: ['बालक कृष्ण की लीलाएँ', 'माता यशोदा की ममता', 'भक्ति-भाव', 'ब्रजभाषा की मधुरता'],
    avoidances: ['दार्शनिक शुष्कता', 'राजनीतिक टिप्पणी', 'वियोग-शृंगार'],
    sampleTone: 'गोकुल की धूल और नन्दलाल की किलकारी — भक्त का प्रेम, बाल का उल्लास।',
    ageAlignment: ['young', 'middle'],
    vocabularyRegister: 'avadhi',
  },
  {
    id: 'kabir',
    name: 'कबीर',
    description: 'निर्गुण दोहे, सामाजिक क्रांति, सीधी बात',
    persona: 'जुलाहे का साधु',
    era: '1440–1518',
    majorWorks: ['बीजक', 'कबीर ग्रंथावली', 'साखी'],
    voiceCharacteristics: ['दो पंक्तियों में सत्य', 'धार्मिक पाखंड पर कड़ा व्यंग्य', 'सीधी बोलचाल', 'जाति-निरपेक्ष दृष्टि'],
    avoidances: ['जटिल शास्त्र-उद्धरण', 'बाहरी कर्मकाण्ड', 'लंबे वर्णन'],
    sampleTone: 'धागे की नोक पर रखा हीरा — छोटा, तीखा, युगों तक चमकता।',
    ageAlignment: ['young', 'middle', 'teen'],
    vocabularyRegister: 'tadbhava',
  },
];
```

- [ ] **Step 2: Add SCIENCE_NARRATOR_STYLES and PHILOSOPHY_NARRATOR_STYLES**

Append to the end of `constants.ts`:

```typescript
export const SCIENCE_NARRATOR_STYLES: NarratorStyle[] = [
  {
    id: 'feynman',
    name: 'Richard Feynman',
    persona: 'The Curious Explainer',
    era: '1918–1988',
    description: 'Playful, childlike curiosity; strips away jargon; loves thought experiments',
    voiceCharacteristics: ['rhetorical questions', 'thought experiments', 'delight in not knowing', 'building from first principles'],
    avoidances: ['authority appeals', 'unexplained jargon', 'passive voice'],
    sampleTone: 'Grinning in front of a blackboard — "Isn\'t that wonderful? Let\'s figure it out together."',
    ageAlignment: ['young', 'middle', 'teen'],
    majorWorks: ['The Feynman Lectures on Physics', 'Surely You\'re Joking, Mr. Feynman!', 'QED'],
  },
  {
    id: 'sagan',
    name: 'Carl Sagan',
    persona: 'The Cosmic Poet',
    era: '1934–1996',
    description: 'Grand cosmic scale, poetic awe, humanist perspective on science',
    voiceCharacteristics: ['cosmic scale shifts', 'poetic imagery', 'humanist urgency', 'billions and billions'],
    avoidances: ['cold reductionism', 'dismissal of wonder', 'technical-only framing'],
    sampleTone: 'Standing beneath a billion stars — filled with reverence, speaking of our pale blue dot.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['Cosmos', 'The Pale Blue Dot', 'Contact'],
  },
  {
    id: 'attenborough',
    name: 'David Attenborough',
    persona: 'The Patient Observer',
    era: '1926–present',
    description: 'Hushed reverence for nature, building drama from observation, long perspective',
    voiceCharacteristics: ['hushed pacing', 'building dramatic tension', 'evolutionary timescale', 'precise sensory observation'],
    avoidances: ['rushed explanation', 'anthropomorphism', 'abstract theory without grounding'],
    sampleTone: 'In a whisper, kneeling beside the extraordinary — patient, reverent, utterly precise.',
    ageAlignment: ['young', 'middle', 'teen'],
    majorWorks: ['Life on Earth', 'Planet Earth', 'A Life on Our Planet'],
  },
  {
    id: 'oliver_sacks',
    name: 'Oliver Sacks',
    persona: 'The Compassionate Neurologist',
    era: '1933–2015',
    description: 'Human stories at the centre of science, clinical empathy, case-study narrative',
    voiceCharacteristics: ['patient as hero', 'clinical empathy', 'unexpected connections', 'wonder at the brain'],
    avoidances: ['detached statistics', 'diagnosis without humanity', 'abstract theory without person'],
    sampleTone: 'Sitting with a patient — curious, moved, seeing the person inside the condition.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['The Man Who Mistook His Wife for a Hat', 'Awakenings', 'On the Move'],
  },
  {
    id: 'marie_curie_voice',
    name: 'Marie Curie',
    persona: 'The Determined Discoverer',
    era: '1867–1934',
    description: 'Methodical persistence, lab notebook precision, quiet revolutionary dignity',
    voiceCharacteristics: ['meticulous experimental detail', 'quiet perseverance', 'facts over fame', 'European formal elegance'],
    avoidances: ['self-promotion', 'speculation without evidence', 'dramatic overstatement'],
    sampleTone: 'Measured and exact — the glow of radium in a dark shed, recorded with steady hands.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['Radioactive: Marie & Pierre Curie', 'Research on Radioactive Substances'],
  },
  {
    id: 'stephen_hawking_voice',
    name: 'Stephen Hawking',
    persona: 'The Wit of the Cosmos',
    era: '1942–2018',
    description: 'Dry British wit, black holes made simple, defiant joy',
    voiceCharacteristics: ['dry wit', 'extreme complexity made elegant', 'defiant optimism', 'short declarative sentences'],
    avoidances: ['self-pity', 'unnecessary jargon', 'verbose hedging'],
    sampleTone: 'Deadpan in a wheelchair before the infinite — sharp, amused, absolutely serious.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['A Brief History of Time', 'The Universe in a Nutshell', 'Black Holes and Baby Universes'],
  },
];

export const PHILOSOPHY_NARRATOR_STYLES: NarratorStyle[] = [
  {
    id: 'alan_watts',
    name: 'Alan Watts',
    persona: 'The Zen Interpreter',
    era: '1915–1973',
    description: 'Eastern wisdom in Western words, playful paradox, anti-anxiety',
    voiceCharacteristics: ['playful paradox', 'Zen koans adapted for Western ears', 'anti-goal-orientation', 'laughter as insight'],
    avoidances: ['rigid definitions', 'academic citation', 'self-improvement tone'],
    sampleTone: 'Chuckling at the cosmic joke — relaxed, liberating, surprisingly wise.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['The Way of Zen', 'The Wisdom of Insecurity', 'Tao: The Watercourse Way'],
  },
  {
    id: 'bertrand_russell',
    name: 'Bertrand Russell',
    persona: 'The Clear Rationalist',
    era: '1872–1970',
    description: 'Crystal-clear logic, anti-dogmatism, dry wit, intellectual courage',
    voiceCharacteristics: ['clear logical structure', 'gentle demolition of received wisdom', 'dry humour', 'moral conviction'],
    avoidances: ['mysticism', 'undefined terms', 'authority appeals'],
    sampleTone: 'Precise as a proof — kind, firm, absolutely unwilling to pretend.',
    ageAlignment: ['teen'],
    majorWorks: ['The Problems of Philosophy', 'Why I Am Not a Christian', 'A History of Western Philosophy'],
  },
  {
    id: 'simone_de_beauvoir',
    name: 'Simone de Beauvoir',
    persona: 'The Existential Witness',
    era: '1908–1986',
    description: 'Feminist existentialism, freedom and responsibility, lived experience',
    voiceCharacteristics: ['first-person situated knowledge', 'freedom as burden and gift', 'gender as construction', 'existentialist urgency'],
    avoidances: ['abstract without personal', 'passive acceptance', 'biological determinism'],
    sampleTone: 'Standing at the crossroads of freedom — urgent, personal, demanding more.',
    ageAlignment: ['teen'],
    majorWorks: ['The Second Sex', 'The Ethics of Ambiguity', 'Memoirs of a Dutiful Daughter'],
  },
  {
    id: 'rumi_voice',
    name: 'Rumi',
    persona: 'The Whirling Mystic',
    era: '1207–1273',
    description: 'Sufi love poetry, divine longing, parable-as-philosophy',
    voiceCharacteristics: ['parable and metaphor', 'divine love as central force', 'reed flute of longing', 'whirling surrender'],
    avoidances: ['cold logic', 'political analysis', 'literal interpretation of sacred texts'],
    sampleTone: 'A candle burning toward its own flame — ecstatic, tender, eternally returning.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['Masnavi', 'Divan-e Shams', 'Fihi Ma Fihi'],
  },
  {
    id: 'aristotle_voice',
    name: 'Aristotle',
    persona: 'The Systematic Observer',
    era: '384–322 BCE',
    description: 'Categories and causes, virtue ethics, the good life defined through practice',
    voiceCharacteristics: ['systematic classification', 'practical wisdom (phronesis)', 'virtue as habit', 'nature as teacher'],
    avoidances: ['mystical leaps', 'individualist ethics', 'ahistorical abstraction'],
    sampleTone: 'Methodical as a naturalist cataloguing species — finding virtue in the middle path.',
    ageAlignment: ['middle', 'teen'],
    majorWorks: ['Nicomachean Ethics', 'Politics', 'Poetics'],
  },
  {
    id: 'gandhi_voice',
    name: 'Mahatma Gandhi',
    persona: 'The Moral Experimenter',
    era: '1869–1948',
    description: 'Satyagraha, non-violence as active power, self-experiment as proof',
    voiceCharacteristics: ['personal experiment as argument', 'moral clarity', 'non-violence as strength', 'simple living as philosophy'],
    avoidances: ['theoretical abstraction', 'violence glorification', 'cynicism about human nature'],
    sampleTone: 'Walking barefoot to the sea — each step a statement, each act a teaching.',
    ageAlignment: ['young', 'middle', 'teen'],
    majorWorks: ['The Story of My Experiments with Truth', 'Hind Swaraj', 'Satyagraha in South Africa'],
  },
];
```

- [ ] **Step 3: Update import in constants.ts top**

Make sure the top of `constants.ts` imports the new types. The existing import line currently imports `AuthorStyle`. Change it to:

```typescript
import { AuthorStyle, HindiAuthorStyle, NarratorStyle } from './types';
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

---

## Phase 2 — Backend Core

### Task 5: Add dual model clients and generateText() helper to api/index.js

**Files:**
- Modify: `api/index.js` (lines 1–6)

- [ ] **Step 1: Replace the configuration block at the top of api/index.js**

Find lines 1–6 (the imports and genAI setup) and replace with:

```javascript
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
```

- [ ] **Step 2: Add generateText() helper after the RETRY HELPER block**

After the closing `};` of `runWithRetry`, add:

```javascript
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
```

- [ ] **Step 3: Verify the server starts without error**

```bash
node --input-type=module < api/index.js 2>&1 | head -5
```
Expected: no syntax errors (will fail at runtime without env vars, that's fine).

---

### Task 6: Update WORD_COUNT to 3×3 matrix and bump CACHE_VERSION

**Files:**
- Modify: `api/index.js` (lines 22–23)

- [ ] **Step 1: Replace CACHE_VERSION and WORD_COUNT constants**

Find:
```javascript
const CACHE_VERSION = "v6-length-support";
const WORD_COUNT = { short: 400, medium: 850, long: 1400 };
```

Replace with:
```javascript
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
```

- [ ] **Step 2: Update cache hash to include regenerateSalt**

Find the cache check block:
```javascript
cacheHash = crypto.createHash('sha256').update(action + JSON.stringify(payload) + CACHE_VERSION + (payload.storyLength || 'medium')).digest('hex');
```

Replace with:
```javascript
const saltedPayload = { ...payload };
delete saltedPayload.regenerateSalt; // exclude salt from stable hash so normal requests cache correctly
const hashSource = payload.regenerateSalt
  ? action + JSON.stringify(saltedPayload) + CACHE_VERSION + payload.regenerateSalt
  : action + JSON.stringify(payload) + CACHE_VERSION;
cacheHash = crypto.createHash('sha256').update(hashSource).digest('hex');
```

---

### Task 7: Add research handlers to api/index.js

**Files:**
- Modify: `api/index.js`

- [ ] **Step 1: Register research actions in the switch statement**

In the switch block, add three new cases before `default`:

```javascript
case 'researchStory': result = await handleResearchStory(payload); break;
case 'researchScience': result = await handleResearchScience(payload); break;
case 'researchPhilosophy': result = await handleResearchPhilosophy(payload); break;
```

Also add these actions to `cacheableActions` (so research results are cached):
```javascript
const cacheableActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry', 'researchStory', 'researchScience', 'researchPhilosophy'];
```

And add them to `quotaActions`:
```javascript
const quotaActions = ['generateStory', 'generateScienceEntry', 'generatePhilosophyEntry', 'researchStory', 'researchScience', 'researchPhilosophy'];
```

- [ ] **Step 2: Implement the three research handler functions**

Add after `handleDiscoverProfiles` in the handlers section:

```javascript
async function handleResearchStory({ profile }) {
  const schema = {
    type: 'object',
    properties: {
      keyEvents: { type: 'array', items: { type: 'string' } },
      verifiedFacts: { type: 'array', items: { type: 'string' } },
      quotes: { type: 'array', items: { type: 'string' } },
      historicalContext: { type: 'string' },
      sources: { type: 'array', items: { type: 'string' } },
    },
    required: ['keyEvents', 'verifiedFacts', 'quotes', 'historicalContext', 'sources'],
  };

  const prompt = `Research ${profile.name} (${profile.title}, ${profile.region}, ${profile.era}).
  
  Use Google Search to find verified biographical information. Return:
  - keyEvents: 5-7 specific dated events from their life (real incidents, not generic)
  - verifiedFacts: 8-10 precise facts (dates, names of places/people, measurable achievements)
  - quotes: 3-5 actual documented quotes (with source attribution in brackets)
  - historicalContext: 2-3 sentences on the world they lived in
  - sources: Wikipedia URL, 2-3 authoritative references`;

  try {
    const geminiSchema = {
      type: Type.OBJECT,
      properties: {
        keyEvents: { type: Type.ARRAY, items: { type: Type.STRING } },
        verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
        quotes: { type: Type.ARRAY, items: { type: Type.STRING } },
        historicalContext: { type: Type.STRING },
        sources: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['keyEvents', 'verifiedFacts', 'quotes', 'historicalContext', 'sources'],
    };
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    return JSON.parse(response.text);
  } catch (e) {
    console.warn('Story research failed, returning stub:', e.message);
    return { keyEvents: [], verifiedFacts: [], quotes: [], historicalContext: 'Not found.', sources: [] };
  }
}

async function handleResearchScience({ item }) {
  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      discoveryContext: { type: Type.STRING },
      keyFigures: { type: Type.ARRAY, items: { type: Type.STRING } },
      verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
      realWorldApplications: { type: Type.ARRAY, items: { type: Type.STRING } },
      sources: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['discoveryContext', 'keyFigures', 'verifiedFacts', 'realWorldApplications', 'sources'],
  };

  const prompt = `Research the scientific concept: "${item.name}" (${item.field}, ${item.era}).

  Use Google Search. Return:
  - discoveryContext: Precise historical circumstances of the discovery/invention
  - keyFigures: Names of scientists involved with brief roles
  - verifiedFacts: 8-10 specific facts (dates, measurements, first applications)
  - realWorldApplications: 5-7 specific modern uses with named technologies
  - sources: Wikipedia URL + 2-3 authoritative references`;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    return JSON.parse(response.text);
  } catch (e) {
    console.warn('Science research failed:', e.message);
    return { discoveryContext: 'Not found.', keyFigures: [], verifiedFacts: [], realWorldApplications: [], sources: [] };
  }
}

async function handleResearchPhilosophy({ item }) {
  const geminiSchema = {
    type: Type.OBJECT,
    properties: {
      historicalContext: { type: Type.STRING },
      keyThinkers: { type: Type.ARRAY, items: { type: Type.STRING } },
      verifiedFacts: { type: Type.ARRAY, items: { type: Type.STRING } },
      societalImpacts: { type: Type.ARRAY, items: { type: Type.STRING } },
      sources: { type: Type.ARRAY, items: { type: Type.STRING } },
    },
    required: ['historicalContext', 'keyThinkers', 'verifiedFacts', 'societalImpacts', 'sources'],
  };

  const prompt = `Research the philosophy: "${item.name}" (${item.origin}, ${item.era}).

  Use Google Search. Return:
  - historicalContext: When and why this idea emerged, 2-3 sentences
  - keyThinkers: Names + one-line roles of major contributors
  - verifiedFacts: 8-10 precise facts (dates, key texts, institutional changes caused)
  - societalImpacts: 5-7 specific tangible ways this idea changed laws, governments, or movements
  - sources: Stanford Encyclopedia of Philosophy URL + 2-3 authoritative references`;

  try {
    const response = await runWithRetry(() => genAI.models.generateContent({
      model: RESEARCH_MODEL,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: geminiSchema,
        temperature: 0.1,
        tools: [{ googleSearch: {} }],
      },
    }));
    return JSON.parse(response.text);
  } catch (e) {
    console.warn('Philosophy research failed:', e.message);
    return { historicalContext: 'Not found.', keyThinkers: [], verifiedFacts: [], societalImpacts: [], sources: [] };
  }
}
```

---

### Task 8: Rewrite the three generation handlers in api/index.js

**Files:**
- Modify: `api/index.js`

The reading-level instruction blocks referenced below are constant strings embedded in the prompt.

- [ ] **Step 1: Rewrite handleGenerateStory**

Replace the entire `handleGenerateStory` function with:

```javascript
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
Voice characteristics: ${englishStyleDesc}
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
```

- [ ] **Step 2: Rewrite handleGenerateScienceEntry**

Replace the entire `handleGenerateScienceEntry` function with:

```javascript
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
```

- [ ] **Step 3: Rewrite handleGeneratePhilosophyEntry**

Replace the entire `handleGeneratePhilosophyEntry` function with:

```javascript
async function handleGeneratePhilosophyEntry({ item, storyLength, readingLevel = 'middle', narratorStyle, research }) {
  const wordCount = getWordCount(readingLevel, storyLength);

  const levelBlock = {
    young:  'READING LEVEL: Young (ages 6-10). Use story and analogy exclusively. No abstract philosophical terms. Anchor every idea in a character\'s choice or feeling.',
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
```

- [ ] **Step 4: Verify syntax**

```bash
node --input-type=module --eval "import('./api/index.js')" 2>&1 | grep -i "syntax\|error" | head -5
```
Expected: no syntax errors printed.

---

## Phase 3 — Service Layer

### Task 9: Update services/gemini.ts

**Files:**
- Modify: `services/gemini.ts`

- [ ] **Step 1: Update imports to include new types**

Replace the top import line with:

```typescript
import { Profile, Story, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry, StoryLength, ReadingLevel, NarratorStyle, StoryResearch, ScienceResearch, PhilosophyResearch } from "../types";
```

- [ ] **Step 2: Add research functions**

After the `discoverProfiles` export, add:

```typescript
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
```

- [ ] **Step 3: Update generateStory signature**

Replace:
```typescript
export const generateStory = async (
  profile: Profile,
  englishStyleName: string,
  englishStyleDesc: string,
  hindiStyleName: string,
  hindiStyleDesc: string,
  storyLength: StoryLength = 'medium'
): Promise<Story> => {
  const result = await callBackend('generateStory', {
    profile, englishStyleName, englishStyleDesc, hindiStyleName, hindiStyleDesc, storyLength,
  });
  return result as Story;
};
```

With:
```typescript
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
```

- [ ] **Step 4: Update generateScienceEntry signature**

Replace:
```typescript
export const generateScienceEntry = async (item: ScienceItem, storyLength: StoryLength = 'medium'): Promise<ScienceEntry> => {
  const data = await callBackend('generateScienceEntry', { item, storyLength });
  return data as ScienceEntry;
};
```

With:
```typescript
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
```

- [ ] **Step 5: Update generatePhilosophyEntry signature**

Replace:
```typescript
export const generatePhilosophyEntry = async (item: PhilosophyItem, storyLength: StoryLength = 'medium'): Promise<PhilosophyEntry> => {
  const data = await callBackend('generatePhilosophyEntry', { item, storyLength });
  return data as PhilosophyEntry;
};
```

With:
```typescript
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
```

- [ ] **Step 6: Export new research functions from gemini.ts and verify**

Make sure the new `researchStory`, `researchScience`, `researchPhilosophy` are exported (they are, per step 2).

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Phase 4 — App State

### Task 10: Update App.tsx

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Update imports**

Replace the existing imports at the top of App.tsx with (add new imports):

```typescript
import { AppStep, AppMode, Language, Profile, Story, ArchivedStory, ScienceItem, ScienceEntry, PhilosophyItem, PhilosophyEntry, StoryLength, ReadingLevel, NarratorStyle } from './types';
import { discoverProfiles, generateStory, generateStoryImage, discoverConcepts, generateScienceEntry, discoverPhilosophies, generatePhilosophyEntry, getUserQuota, researchStory, researchScience, researchPhilosophy, RateLimitError, SafetyError } from './services/gemini';
import { CATEGORIES, SCIENCE_CATEGORIES, PHILOSOPHY_CATEGORIES, AUTHOR_STYLES, HINDI_AUTHOR_STYLES, SCIENCE_NARRATOR_STYLES, PHILOSOPHY_NARRATOR_STYLES, DEFAULT_LANGUAGE } from './constants';
```

- [ ] **Step 2: Add new state variables**

After `const [currentHindiStyleId, setCurrentHindiStyleId] = useState<string>('');`, add:

```typescript
const [readingLevel, setReadingLevel] = useState<ReadingLevel>(() => {
  return (localStorage.getItem('lumina_reading_level') as ReadingLevel) || 'middle';
});
const [currentNarratorStyleId, setCurrentNarratorStyleId] = useState<string>('');
const [loadingMessage, setLoadingMessage] = useState<string>('Generating content...');
```

- [ ] **Step 3: Persist readingLevel to localStorage**

After the `resetToHome` function, add:

```typescript
useEffect(() => {
  localStorage.setItem('lumina_reading_level', readingLevel);
}, [readingLevel]);
```

- [ ] **Step 4: Rewrite generateForItem**

Replace the entire `generateForItem` useCallback with:

```typescript
const generateForItem = useCallback(async (
  item: Profile | ScienceItem | PhilosophyItem,
  englishStyleId: string,
  hindiStyleId: string,
  length: StoryLength,
  currentMode: AppMode,
  catId: string | null,
  narratorStyleId?: string,
  isRegenerate?: boolean,
) => {
  setGeneratedContent(null);
  setLoadingContent(true);
  setLoadingImages(false);
  setError(null);
  let textGenSucceeded = false;

  try {
    if (currentMode === AppMode.STORIES) {
      const profile = item as Profile;
      const englishStyle = AUTHOR_STYLES.find(s => s.id === englishStyleId) || AUTHOR_STYLES[0];
      const hindiStyle = HINDI_AUTHOR_STYLES.find(s => s.id === hindiStyleId) || HINDI_AUTHOR_STYLES[0];

      setLoadingMessage(`Researching ${profile.name}...`);
      let research;
      try { research = await researchStory(profile); } catch { research = undefined; }

      setLoadingMessage(`Writing story in the style of ${englishStyle.name}...`);
      const story = await generateStory(
        profile, englishStyle.name, englishStyle.description,
        hindiStyle.name, hindiStyle.description,
        length, readingLevel, research, isRegenerate,
      );
      setGeneratedContent(story);
      textGenSucceeded = true;
      setLoadingContent(false);
      setCurrentEnglishStyleId(englishStyle.id);
      setCurrentHindiStyleId(hindiStyle.id);
      refreshQuota();

      if (catId) {
        await saveItemToArchive(AppMode.STORIES, profile, story, catId, {
          styleName: englishStyle.name, personaName: englishStyle.persona,
          primaryLanguage: language, readingLevel,
        });
        refreshLibrary();
      }

      setLoadingImages(true);
      const imageUrl = await generateStoryImage(story.illustrationPrompt, false);
      setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: imageUrl } : prev);
      if (story.geography) {
        const mapUrl = await generateStoryImage(story.geography.mapPrompt, true);
        setGeneratedContent(prev => prev ? { ...prev, generatedMapUrl: mapUrl } : prev);
      }
      setLoadingImages(false);

    } else if (currentMode === AppMode.CONCEPTS) {
      const scienceItem = item as ScienceItem;
      const narratorStyle = SCIENCE_NARRATOR_STYLES.find(s => s.id === narratorStyleId) || SCIENCE_NARRATOR_STYLES[0];
      setCurrentNarratorStyleId(narratorStyle.id);

      setLoadingMessage(`Researching ${scienceItem.name}...`);
      let research;
      try { research = await researchScience(scienceItem); } catch { research = undefined; }

      setLoadingMessage(`Writing science entry...`);
      const entry = await generateScienceEntry(scienceItem, length, readingLevel, narratorStyle, research, isRegenerate);
      setGeneratedContent(entry);
      textGenSucceeded = true;
      setLoadingContent(false);
      refreshQuota();
      if (catId) { await saveItemToArchive(AppMode.CONCEPTS, scienceItem, entry, catId, { readingLevel }); refreshLibrary(); }

      setLoadingImages(true);
      const img = await generateStoryImage(entry.illustrationPrompt, false);
      setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: img } : prev);
      setLoadingImages(false);

    } else if (currentMode === AppMode.PHILOSOPHIES) {
      const philoItem = item as PhilosophyItem;
      const narratorStyle = PHILOSOPHY_NARRATOR_STYLES.find(s => s.id === narratorStyleId) || PHILOSOPHY_NARRATOR_STYLES[0];
      setCurrentNarratorStyleId(narratorStyle.id);

      setLoadingMessage(`Researching ${philoItem.name}...`);
      let research;
      try { research = await researchPhilosophy(philoItem); } catch { research = undefined; }

      setLoadingMessage(`Writing philosophy entry...`);
      const entry = await generatePhilosophyEntry(philoItem, length, readingLevel, narratorStyle, research, isRegenerate);
      setGeneratedContent(entry);
      textGenSucceeded = true;
      setLoadingContent(false);
      refreshQuota();
      if (catId) { await saveItemToArchive(AppMode.PHILOSOPHIES, philoItem, entry, catId, { readingLevel }); refreshLibrary(); }

      setLoadingImages(true);
      const img = await generateStoryImage(entry.illustrationPrompt, false);
      setGeneratedContent(prev => prev ? { ...prev, generatedImageUrl: img } : prev);
      setLoadingImages(false);
    }
  } catch (e) {
    handleError(e, 'Could not generate content. Please try again.');
    if (!textGenSucceeded) setStep(AppStep.ITEM_SELECT);
    setLoadingContent(false);
    setLoadingImages(false);
  }
}, [language, readingLevel, refreshQuota, refreshLibrary]);
```

- [ ] **Step 5: Update handleItemSelect to pass narratorStyleId**

Replace:
```typescript
const handleItemSelect = async (item: Profile | ScienceItem | PhilosophyItem) => {
  setSelectedItem(item);
  setStep(AppStep.CONTENT_VIEW);
  const englishStyle = AUTHOR_STYLES[Math.floor(Math.random() * AUTHOR_STYLES.length)];
  const hindiStyle = HINDI_AUTHOR_STYLES[Math.floor(Math.random() * HINDI_AUTHOR_STYLES.length)];
  await generateForItem(item, englishStyle.id, hindiStyle.id, storyLength, mode, selectedCategory);
};
```

With:
```typescript
const handleItemSelect = async (item: Profile | ScienceItem | PhilosophyItem) => {
  setSelectedItem(item);
  setStep(AppStep.CONTENT_VIEW);
  const englishStyle = AUTHOR_STYLES[Math.floor(Math.random() * AUTHOR_STYLES.length)];
  const hindiStyle = HINDI_AUTHOR_STYLES[Math.floor(Math.random() * HINDI_AUTHOR_STYLES.length)];
  const scienceNarrator = SCIENCE_NARRATOR_STYLES[Math.floor(Math.random() * SCIENCE_NARRATOR_STYLES.length)];
  const philoNarrator = PHILOSOPHY_NARRATOR_STYLES[Math.floor(Math.random() * PHILOSOPHY_NARRATOR_STYLES.length)];
  const narratorId = mode === AppMode.CONCEPTS ? scienceNarrator.id : philoNarrator.id;
  await generateForItem(item, englishStyle.id, hindiStyle.id, storyLength, mode, selectedCategory, narratorId, false);
};
```

- [ ] **Step 6: Update handleRegenerate to accept narratorStyleId**

Replace:
```typescript
const handleRegenerate = async (newEnglishStyleId?: string, newHindiStyleId?: string, newLength?: StoryLength) => {
  if (!selectedItem) return;
  const effectiveLength = newLength ?? storyLength;
  if (newLength) setStoryLength(newLength);
  await generateForItem(
    selectedItem,
    newEnglishStyleId || currentEnglishStyleId,
    newHindiStyleId || currentHindiStyleId,
    effectiveLength,
    mode,
    selectedCategory,
  );
};
```

With:
```typescript
const handleRegenerate = async (newEnglishStyleId?: string, newHindiStyleId?: string, newLength?: StoryLength, newNarratorStyleId?: string, newReadingLevel?: ReadingLevel) => {
  if (!selectedItem) return;
  const effectiveLength = newLength ?? storyLength;
  if (newLength) setStoryLength(newLength);
  if (newReadingLevel) setReadingLevel(newReadingLevel);
  await generateForItem(
    selectedItem,
    newEnglishStyleId || currentEnglishStyleId,
    newHindiStyleId || currentHindiStyleId,
    effectiveLength,
    mode,
    selectedCategory,
    newNarratorStyleId || currentNarratorStyleId,
    true,
  );
};
```

- [ ] **Step 7: Update the loading content UI to show loadingMessage**

Find in App.tsx where loading content is rendered (the `loadingContent` conditional). Find the text that says `"Generating content..."` and replace it with `{loadingMessage}`.

- [ ] **Step 8: Pass new props to view components**

Find where `<StoryView>` is rendered and add `readingLevel` and `onReadingLevelChange` props:
```tsx
<StoryView
  story={generatedContent as Story}
  profile={selectedItem as Profile}
  category={getCurrentCategoryObj()}
  onBack={handleBackFromView}
  displayLanguage={language}
  loadingImages={loadingImages}
  storyLength={storyLength}
  currentEnglishStyleId={currentEnglishStyleId}
  currentHindiStyleId={currentHindiStyleId}
  onRegenerate={handleRegenerate}
  readingLevel={readingLevel}
  onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
/>
```

Find where `<ScienceView>` is rendered and add:
```tsx
<ScienceView
  entry={generatedContent as ScienceEntry}
  item={selectedItem as ScienceItem}
  onBack={handleBackFromView}
  loadingImages={loadingImages}
  category={getCurrentCategoryObj()}
  storyLength={storyLength}
  onRegenerate={handleRegenerate}
  readingLevel={readingLevel}
  onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
  currentNarratorStyleId={currentNarratorStyleId}
/>
```

Find where `<PhilosophyView>` is rendered and add:
```tsx
<PhilosophyView
  entry={generatedContent as PhilosophyEntry}
  item={selectedItem as PhilosophyItem}
  onBack={handleBackFromView}
  loadingImages={loadingImages}
  category={getCurrentCategoryObj()}
  storyLength={storyLength}
  onRegenerate={handleRegenerate}
  readingLevel={readingLevel}
  onReadingLevelChange={(level: ReadingLevel) => handleRegenerate(undefined, undefined, undefined, undefined, level)}
  currentNarratorStyleId={currentNarratorStyleId}
/>
```

- [ ] **Step 9: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

---

## Phase 5 — UI Components

### Task 11: Create ReadingLevelToggle component

**Files:**
- Create: `components/ReadingLevelToggle.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React from 'react';
import { ReadingLevel } from '../types';
import { BookOpen } from 'lucide-react';

interface ReadingLevelToggleProps {
  value: ReadingLevel;
  onChange: (level: ReadingLevel) => void;
  accentColor?: string;
}

const LEVEL_LABELS: Record<ReadingLevel, string> = {
  young: 'Ages 6–10',
  middle: 'Ages 10–14',
  teen: 'Ages 14+',
};

export const ReadingLevelToggle: React.FC<ReadingLevelToggleProps> = ({
  value, onChange, accentColor = 'indigo',
}) => (
  <div className="flex items-center gap-2">
    <BookOpen size={14} className={`text-${accentColor}-400 shrink-0`} />
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Age</span>
    {(['young', 'middle', 'teen'] as ReadingLevel[]).map(level => (
      <button
        key={level}
        onClick={() => onChange(level)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
          value === level
            ? `bg-${accentColor}-600 text-white border-${accentColor}-600`
            : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
        }`}
      >
        {LEVEL_LABELS[level]}
      </button>
    ))}
  </div>
);
```

---

### Task 12: Create SourcesPanel component

**Files:**
- Create: `components/SourcesPanel.tsx`

- [ ] **Step 1: Write the component**

```tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp, ExternalLink, Search } from 'lucide-react';
import { StoryResearch, ScienceResearch, PhilosophyResearch } from '../types';

type Research = StoryResearch | ScienceResearch | PhilosophyResearch;

interface SourcesPanelProps {
  research: Research;
  accentColor?: string;
}

const isStoryResearch = (r: Research): r is StoryResearch => 'keyEvents' in r;
const isScienceResearch = (r: Research): r is ScienceResearch => 'discoveryContext' in r;

const renderSourceLink = (source: string, accentColor: string) => {
  const isUrl = /^(http|www)/.test(source);
  const href = isUrl
    ? (source.startsWith('http') ? source : `https://${source}`)
    : `https://www.google.com/search?q=${encodeURIComponent(source)}`;
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className={`hover:text-${accentColor}-600 hover:underline transition-colors flex items-center gap-1 font-medium text-gray-600`}>
      <span className="truncate max-w-[260px]">{source}</span>
      <ExternalLink size={10} className="shrink-0" />
    </a>
  );
};

export const SourcesPanel: React.FC<SourcesPanelProps> = ({ research, accentColor = 'indigo' }) => {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-gray-100 rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <Search size={14} className={`text-${accentColor}-500`} />
          <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Research Sources</span>
        </div>
        {open ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
      </button>

      {open && (
        <div className="p-6 space-y-6 bg-white">
          {isStoryResearch(research) && (
            <>
              {research.keyEvents.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key Events</h4>
                  <ul className="space-y-2">
                    {research.keyEvents.map((e, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {e}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {research.quotes.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Documented Quotes</h4>
                  <ul className="space-y-2">
                    {research.quotes.map((q, i) => (
                      <li key={i} className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">{q}</li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {isScienceResearch(research) && (
            <>
              {research.realWorldApplications.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Real-World Applications</h4>
                  <ul className="space-y-2">
                    {research.realWorldApplications.map((a, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {!isStoryResearch(research) && !isScienceResearch(research) && (
            <>
              {'societalImpacts' in research && research.societalImpacts.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Societal Impacts</h4>
                  <ul className="space-y-2">
                    {(research as PhilosophyResearch).societalImpacts.map((s, i) => (
                      <li key={i} className="text-sm text-gray-600 flex gap-2">
                        <span className={`w-1 h-1 bg-${accentColor}-300 rounded-full mt-2 shrink-0`}></span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {research.sources.length > 0 && (
            <div>
              <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Sources</h4>
              <ul className="space-y-2">
                {research.sources.map((s, i) => (
                  <li key={i} className="text-sm flex gap-2">
                    <span className="text-gray-400">·</span>
                    {renderSourceLink(s, accentColor)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

### Task 13: Wire ReadingLevelToggle and SourcesPanel into StoryView

**Files:**
- Modify: `components/StoryView.tsx`

- [ ] **Step 1: Add imports and new props**

At the top of StoryView.tsx, add imports:
```typescript
import { ReadingLevelToggle } from './ReadingLevelToggle';
import { SourcesPanel } from './SourcesPanel';
import { ReadingLevel } from '../types';
```

Add to `StoryViewProps` interface:
```typescript
readingLevel: ReadingLevel;
onReadingLevelChange: (level: ReadingLevel) => void;
```

Add `readingLevel` and `onReadingLevelChange` to the destructured props.

- [ ] **Step 2: Add ReadingLevelToggle to the toolbar**

In the toolbar div (the flex container with the length buttons), add the toggle after the length buttons:

```tsx
<ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} accentColor="amber" />
```

- [ ] **Step 3: Add SourcesPanel before the Report Footer**

Before the `<div className="no-print flex justify-center...">` (report button div), add:

```tsx
{story.research && (
  <SourcesPanel research={story.research} accentColor="amber" />
)}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

---

### Task 14: Wire narrator picker, ReadingLevelToggle, and SourcesPanel into ScienceView

**Files:**
- Modify: `components/ScienceView.tsx`

- [ ] **Step 1: Add imports and new props to ScienceView**

Add at top:
```typescript
import { ReadingLevelToggle } from './ReadingLevelToggle';
import { SourcesPanel } from './SourcesPanel';
import { ReadingLevel, NarratorStyle } from '../types';
import { SCIENCE_NARRATOR_STYLES } from '../constants';
```

Add to `ScienceViewProps`:
```typescript
readingLevel: ReadingLevel;
onReadingLevelChange: (level: ReadingLevel) => void;
currentNarratorStyleId: string;
```

Add these to the destructured props in the function signature.

- [ ] **Step 2: Add local narrator style state**

Inside the component, before the return:
```typescript
const [localNarratorStyleId, setLocalNarratorStyleId] = useState(currentNarratorStyleId || SCIENCE_NARRATOR_STYLES[0].id);
```

- [ ] **Step 3: Add narrator picker and ReadingLevelToggle to toolbar**

In the toolbar section, replace the existing `<div className="flex items-center gap-2">` (length buttons) with:

```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Length</span>
    {(['short', 'medium', 'long'] as StoryLength[]).map(l => (
      <button key={l} onClick={() => onRegenerate(undefined, undefined, l)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${storyLength === l ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
        {LENGTH_LABELS[l]}
      </button>
    ))}
  </div>
  <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} accentColor="emerald" />
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Voice</span>
    <select
      value={localNarratorStyleId}
      onChange={e => setLocalNarratorStyleId(e.target.value)}
      className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
    >
      {SCIENCE_NARRATOR_STYLES.map(s => <option key={s.id} value={s.id}>{s.persona} ({s.name})</option>)}
    </select>
  </div>
</div>
```

Also update the Regenerate button to pass the narrator style:
```tsx
<button onClick={() => onRegenerate(undefined, undefined, undefined, localNarratorStyleId)}
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-all">
  <RefreshCw size={15} /> Regenerate
</button>
```

Update the `onRegenerate` type in the interface:
```typescript
onRegenerate: (englishStyleId?: string, hindiStyleId?: string, length?: StoryLength, narratorStyleId?: string) => void;
```

- [ ] **Step 4: Add SourcesPanel**

Before the report footer div, add:
```tsx
{entry.research && (
  <SourcesPanel research={entry.research} accentColor="emerald" />
)}
```

- [ ] **Step 5: Verify**

```bash
npx tsc --noEmit
```

---

### Task 15: Wire narrator picker, ReadingLevelToggle, and SourcesPanel into PhilosophyView

**Files:**
- Modify: `components/PhilosophyView.tsx`

- [ ] **Step 1: Add imports and new props**

Same pattern as Task 14 but for philosophy. Add at top:
```typescript
import { ReadingLevelToggle } from './ReadingLevelToggle';
import { SourcesPanel } from './SourcesPanel';
import { ReadingLevel, NarratorStyle } from '../types';
import { PHILOSOPHY_NARRATOR_STYLES } from '../constants';
```

Add to `PhilosophyViewProps`:
```typescript
readingLevel: ReadingLevel;
onReadingLevelChange: (level: ReadingLevel) => void;
currentNarratorStyleId: string;
```

- [ ] **Step 2: Add local narrator style state**

```typescript
const [localNarratorStyleId, setLocalNarratorStyleId] = useState(currentNarratorStyleId || PHILOSOPHY_NARRATOR_STYLES[0].id);
```

- [ ] **Step 3: Add narrator picker and ReadingLevelToggle to toolbar**

Replace the existing length toggle div with:

```tsx
<div className="flex flex-col gap-3">
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Length</span>
    {(['short', 'medium', 'long'] as StoryLength[]).map(l => (
      <button key={l} onClick={() => onRegenerate(undefined, undefined, l)}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${storyLength === l ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'}`}>
        {LENGTH_LABELS[l]}
      </button>
    ))}
  </div>
  <ReadingLevelToggle value={readingLevel} onChange={onReadingLevelChange} accentColor="indigo" />
  <div className="flex items-center gap-2">
    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mr-1">Voice</span>
    <select
      value={localNarratorStyleId}
      onChange={e => setLocalNarratorStyleId(e.target.value)}
      className="px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
    >
      {PHILOSOPHY_NARRATOR_STYLES.map(s => <option key={s.id} value={s.id}>{s.persona} ({s.name})</option>)}
    </select>
  </div>
</div>
```

Update Regenerate button:
```tsx
<button onClick={() => onRegenerate(undefined, undefined, undefined, localNarratorStyleId)}
  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-indigo-700 border border-indigo-200 hover:bg-indigo-50 transition-all">
  <RefreshCw size={15} /> Regenerate
</button>
```

Update the `onRegenerate` type:
```typescript
onRegenerate: (englishStyleId?: string, hindiStyleId?: string, length?: StoryLength, narratorStyleId?: string) => void;
```

- [ ] **Step 4: Add SourcesPanel**

Before the report footer:
```tsx
{entry.research && (
  <SourcesPanel research={entry.research} accentColor="indigo" />
)}
```

- [ ] **Step 5: Final TypeScript check**

```bash
npx tsc --noEmit
```
Expected: no errors.

---

## Phase 6 — Environment Variables & Manual Smoke Test

### Task 16: Configure environment variables and smoke test

**Files:**
- No code changes — environment configuration only

- [ ] **Step 1: Add OPENROUTER_API_KEY to .env.local**

```
OPENROUTER_API_KEY=sk-or-v1-YOUR_KEY_HERE
USE_DEEPSEEK=true
```

To test without DeepSeek (Gemini only), set `USE_DEEPSEEK=false` or omit `OPENROUTER_API_KEY`.

- [ ] **Step 2: Start the dev server**

```bash
npm run dev
```

- [ ] **Step 3: Smoke test Stories mode**

1. Open `http://localhost:5173`
2. Select any Story category
3. Select any profile — loading message should show "Researching [Name]..." then "Writing story in the style of..."
4. Content view loads — verify length toggle, age toggle, and regenerate button appear
5. Click a different age level — verify regeneration starts with new reading level

- [ ] **Step 4: Smoke test Science mode**

1. Switch to Science tab
2. Select a concept
3. Verify narrator voice dropdown appears in toolbar with 6 options
4. Verify age toggle appears
5. Click Regenerate — verify loading starts

- [ ] **Step 5: Smoke test Philosophy mode**

Same as Science — verify narrator dropdown has 6 philosophy voices.

- [ ] **Step 6: Smoke test SourcesPanel**

For any generated content where research loaded successfully, scroll to bottom of content — verify "Research Sources" collapsible panel appears. Click it — verify cards expand with facts/events/sources.

- [ ] **Step 7: Smoke test cache bust**

Generate the same content twice — second load should return instantly (from cache). Click "Regenerate" on an existing entry — verify it generates fresh content (not cached), confirmed by different text.
