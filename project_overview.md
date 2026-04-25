# Lumina — Project Overview & Code Review

> **Version Snapshot**: `v6-length-support` (CACHE_VERSION)  
> **Last Updated**: 2026-04-24  
> **Environment**: Vite + React 19 + TypeScript | Vercel Serverless | Supabase + Google Gemini
> **Status**: 🔴 Security Hardened | 🟢 5 New Features Implemented

---

## 1. What Is Lumina?

Lumina is a **private, AI-powered educational storytelling app** for children. Given a category (e.g. "Science & Innovation"), it uses the Google Gemini API to generate:

- **Biographical stories** of inspiring personalities (in English and Hindi)
- **Science concept entries** with child-friendly explanations and real-world impact
- **Philosophy entries** with historical episodes and modern relevance

All generated content is auto-saved to a shared Supabase library ("The Library") so a private circle of users (family / school) can read each other's saved items. Content is also cached in Supabase to avoid redundant API calls.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Client (Vite + React 19)                    │
│                                                                 │
│  App.tsx ──► CategoryGrid ──► ItemPicker (ProfilePicker)        │
│          ──► StoryView / ScienceView / PhilosophyView           │
│          ──► ArchiveGrid (Library)                              │
│          ──► LoginView (Supabase email/password auth)           │
│                                                                 │
│  services/                                                      │
│    gemini.ts      ──► /api/index (Vercel Serverless)            │
│    supabaseClient.ts ──► Supabase (auth + DB)                   │
│    storage.ts     ──► shared_stories table (CRUD)               │
│    rateLimit.ts   ──► localStorage burst/hourly limiter         │
│    safety.ts      ──► client-side keyword blocklist             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  api/index.js (Vercel Serverless)               │
│                                                                 │
│  Handles: discoverProfiles, generateStory,                      │
│           discoverConcepts, generateScienceEntry,               │
│           discoverPhilosophies, generatePhilosophyEntry,        │
│           generateImage, getUserQuota                           │
│                                                                 │
│  Auth: Supabase JWT validation per request                      │
│  Cache: SHA-256 hash → cached_content table                     │
│  Quota: user_profiles table (daily_usage counter)               │
│  AI:    gemini-2.5-flash (text), gemini-2.5-flash-image (img)   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Supabase (PostgreSQL + Auth)                       │
│                                                                 │
│  Tables: user_profiles, shared_stories, cached_content         │
│  RLS:    Public read on shared_stories                          │
│          Users can insert/delete own rows                       │
│          Users can read own user_profile row                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. File Map

| Path | Role |
|---|---|
| `index.html` | Entry HTML — loads Tailwind CDN + Google Fonts + importmap |
| `index.tsx` | React root mount |
| `App.tsx` | Root component — global state, auth, routing between steps |
| `types.ts` | All TypeScript interfaces and enums |
| `constants.ts` | Category lists, author styles (English + Hindi) |
| `vite.config.ts` | Vite config, dev proxy to `/api` |
| `vercel.json` | Route rewrites + CORS headers |
| `supabase_table_create` | SQL DDL for all 3 tables + RLS policies |
| `api/index.js` | Vercel serverless handler — all AI + DB logic |
| `api/1_old_index.js` | Previous version (not deployed) |
| `services/gemini.ts` | Client-side wrapper: callBackend(), retry, rate-limit check |
| `services/supabaseClient.ts` | Supabase client init with multi-env fallback |
| `services/storage.ts` | CRUD: getArchivedStories, saveItemToArchive, delete, favorites |
| `services/rateLimit.ts` | localStorage-based burst + hourly limiter |
| `services/safety.ts` | Client-side keyword blocklist + recursive content scanner |
| `components/LoginView.tsx` | Email/password login form |
| `components/CategoryGrid.tsx` | Landing grid of category cards |
| `components/ProfilePicker.tsx` | Item selection list (profiles/concepts/philosophies) |
| `components/StoryView.tsx` | Full story reader (EN + HI, image, map, geography) |
| `components/ScienceView.tsx` | Science entry reader |
| `components/PhilosophyView.tsx` | Philosophy entry reader |
| `components/ArchiveGrid.tsx` | Shared library with search, filters, sort |
| `components/AudioPlayer.tsx` | Audio player UI (audio generation disabled) |
| `components/FallbackIllustration.tsx` | SVG placeholder when image fails |
| `components/ParentalGate.tsx` | PIN-based parental gate (present but unclear if wired) |
| `components/ReportDialog.tsx` | Content report dialog (mockReportIssue — not wired to backend) |
| `components/Typewriter.tsx` | Animated typewriter text effect |

---

## 4. Current Feature Status

| Feature | Status |
|---|---|
| Email/password auth (Supabase) | ✅ Working |
| Biographical story generation (EN + HI) | ✅ Working |
| Science concept generation | ✅ Working |
| Philosophy entry generation | ✅ Working |
| AI image generation (main illustration) | ✅ Working |
| AI map generation | ✅ Working |
| Shared library (Supabase) | ✅ Working |
| Content caching (SHA-256 hash) | ✅ Working |
| Client-side rate limiter | ✅ Working |
| Server-side daily quota | ✅ Working (limit set to 999999999 — effectively off) |
| Language toggle (EN/HI) | ✅ Working |
| Library search + filters + sort | ✅ Working |
| Local favorites | ✅ Working |
| Audio narration | ❌ Disabled (returns undefined) |
| Content reporting | ❌ Mock only — logs to console, no backend |
| Parental gate | ❌ Exists but not wired into any flow |
| Billing / quota enforcement | ⚠️ Exists but limit is infinite |

---

## 5. Deployment

- **Frontend**: Vercel (static)
- **Backend**: Vercel Serverless Function (`api/index.js`) — max 60s timeout
- **Database + Auth**: Supabase (project: `suryaagr`)
- **Gemini API Key**: Stored in Vercel env as `API_KEY`
- **CORS**: Wildcard `*` on `/api/*` (intentional for private use)

---

---

# Critical Code Review

> Conducted per the adversarial review standard. Assumes worst-case production failures.

---

## Summary

**BLUF**: The app is a well-functioning prototype with good bones. The architecture is sensible and the UX logic is mostly sound. However, it has several **real security holes and type-safety failures** that would cause data corruption, unauthorized access, and silent failures at scale. The `any` abuse is pervasive. The quota system is a fiction. The README contains **live credentials in plaintext**. These must be fixed before treating this as a production-grade private app.

---

## 🔴 Critical Issues (Blocking)

### 1. **README.md contains live credentials in plaintext**
`README.md` lines 23–26:
```
supabase - suryaagr - github login
gem api key = surbhiagr (or) outofcir
vercel - outofcirc
aistudio - suryasurabhi
```
These are **account identifiers and implied password hints** for Supabase, Gemini, Vercel, and AI Studio. If this file is ever committed to a public or semi-public git repository, all services are compromised.

**Fix**: Delete these lines entirely. Store credentials only in `.env.local` (already gitignored per convention). Rotate any API keys that have been exposed.

---

### 2. **CORS is wildcard (`*`) on a "private" API**
`api/index.js` line 50 + `vercel.json` line 17:
```js
res.setHeader('Access-Control-Allow-Origin', '*');
```
Any website on the internet can call `/api/index` directly with a valid JWT. For a truly private app, CORS should be locked to the known Vercel domain.

**Fix**: Replace `*` with your specific Vercel domain:
```js
res.setHeader('Access-Control-Allow-Origin', 'https://your-app.vercel.app');
```

---

### 3. **Server-side quota is completely non-functional**
`api/index.js` line 21:
```js
const DAILY_QUOTA_LIMIT = 999999999;
```
The quota check logic exists but the limit is set to a billion. No user will ever be stopped. There is also **no insert to `user_profiles`** when a new user generates content for the first time — `profile` defaults to `{ daily_usage: 0 }` inline (line 76) but this is never written back to the DB. The quota reset logic (line 78) runs a `.update()` even when `profile` was just a local default object with no DB row.

**Fix**:
```js
const DAILY_QUOTA_LIMIT = 10; // or whatever is appropriate
```
And use upsert for user profile creation:
```js
await supabase.from('user_profiles').upsert({ id: userId, daily_usage: 0, last_reset: today }, { onConflict: 'id' });
```

---

### 4. **`discoverProfiles` and all discover/generate calls are unauthenticated**
`api/index.js` lines 66–80: Auth is checked only if `supabase && authHeader`. The actions `discoverProfiles`, `discoverConcepts`, `discoverPhilosophies` are NOT in `quotaActions`. These actions make **free Gemini API calls** with no auth check — anyone who knows the endpoint URL can call them without a token.

**Fix**: Move the auth guard to the top of the handler, before the switch statement, and return 401 for all non-OPTIONS requests without a valid session:
```js
if (!userId) return res.status(401).json({ error: 'Unauthorized' });
```

---

### 5. **Unguarded `JSON.parse(response.text)` in every handler — will throw on malformed JSON**
All handlers in `api/index.js` (lines 158, 227, 248, etc.) call:
```js
return JSON.parse(response.text);
```
If Gemini returns a non-JSON response (e.g., during a timeout or content policy refusal), this throws an unhandled `SyntaxError` that surfaces as a generic 500 to the user. The `try/catch` at line 118 catches it but gives no actionable message.

**Fix**:
```js
let parsed;
try { parsed = JSON.parse(response.text); }
catch { throw new Error('AI returned unexpected format. Please try again.'); }
return parsed;
```

---

### 6. **`deleteStoryFromArchive` has no auth guard — any logged-in user can delete any row**
`services/storage.ts` line 101:
```js
const { error } = await supabase.from('shared_stories').delete().eq('id', id);
```
The RLS policy (`"Users can delete their own"`) should protect this at the DB level, but there is **no RLS policy defined for `user_profiles` update/insert** — any user can increment any other user's quota counter via a crafted request. The `cached_content` table has **no RLS at all**, meaning any authenticated user can read (or if they were given a service key, write) any cached content.

**Fix**: Add RLS policies to `cached_content` and `user_profiles` for update/insert.

---

## 🟡 Required Changes

### 7. **Pervasive `any` type abuse in App.tsx — defeats TypeScript entirely**
`App.tsx` lines 19, 36, 39, 94, 159, 189, 194, 213, 229:
```ts
const [session, setSession] = useState<any>(null);
const [selectedItem, setSelectedItem] = useState<any>(null);
const [generatedContent, setGeneratedContent] = useState<any>(null);
const handleError = (e: any, ...) => ...
const handleItemSelect = async (item: any) => ...
```
`session` from Supabase has a known type: `Session | null`. `selectedItem` and `generatedContent` have union types already defined in `types.ts`. Using `any` makes the TypeScript strict mode config (in `tsconfig.json`) irrelevant.

**Fix**:
```ts
import type { Session } from '@supabase/supabase-js';
const [session, setSession] = useState<Session | null>(null);
const [selectedItem, setSelectedItem] = useState<Profile | ScienceItem | PhilosophyItem | null>(null);
const [generatedContent, setGeneratedContent] = useState<Story | ScienceEntry | PhilosophyEntry | null>(null);
```

---

### 8. **Stale closure bug in `handleItemSelect` — `generatedContent` check is always falsy**
`App.tsx` lines 236–238:
```ts
if (!generatedContent) {
    setStep(AppStep.ITEM_SELECT);
}
```
`generatedContent` inside the catch block refers to the **closure-captured value at function creation time**, which is always `null` (because `setGeneratedContent(story)` is async state — it hasn't re-rendered yet). This check will always evaluate to `true`, meaning even if text generation succeeds and only image generation fails, the user will be kicked back to the item select screen.

**Fix**: Use a local variable to track success:
```ts
let textGenSucceeded = false;
// ... inside try:
setGeneratedContent(story);
textGenSucceeded = true;
// ... inside catch:
if (!textGenSucceeded) setStep(AppStep.ITEM_SELECT);
```

---

### 9. **`generateStoryImage` silently swallows all errors and returns a Picsum placeholder URL**
`services/gemini.ts` lines 132–143:
```ts
export const generateStoryImage = async (...): Promise<string | undefined> => {
  try { checkRateLimit(); } catch (e) { return undefined; }
  if (!validateContentSafety(prompt)) return `https://picsum.photos/800/600?grayscale&blur=2`;
  try {
    const imageUrl = await callBackend('generateImage', { prompt, isMap }, 0);
    return imageUrl;
  } catch (error) {
    return `https://picsum.photos/800/600?grayscale&blur=2`;
  }
};
```
Picsum URLs (`picsum.photos`) are **unrelated stock photos** — they will render random images that have nothing to do with the story. This is confusing and misleading to users. The `FallbackIllustration` component exists precisely for this purpose but is unused here.

**Fix**: Return `undefined` on failure and let the `StoryView` render `<FallbackIllustration>` explicitly. Remove the Picsum fallback.

---

### 10. **`refreshLibrary` and `refreshQuota` are called on every `step` change**
`App.tsx` line 62–68:
```ts
useEffect(() => {
    if (session) {
      refreshLibrary();
      refreshQuota();
      ...
    }
  }, [session, step]);
```
`step` cycles through `CATEGORY_SELECT → ITEM_SELECT → CONTENT_VIEW → ARCHIVE_LIST` on every user action. This fires a full Supabase query (`getArchivedStories`, `getUserQuota`) on every single navigation. With a large library this is expensive and unnecessary.

**Fix**: Separate the effects. Refresh library only when entering `ARCHIVE_LIST`. Refresh quota only on session change and after successful content generation.

---

### 11. **`RateLimitError` is defined in two separate files**
`services/rateLimit.ts` line 2 and `services/gemini.ts` line 7 both export a class named `RateLimitError`. They are separate classes — `instanceof` checks between them will always fail.

In `App.tsx` line 14:
```ts
import { RateLimitError } from './services/rateLimit';
```
But `gemini.ts` throws its own local `RateLimitError` (line 49). The `instanceof RateLimitError` check in `handleError` (line 96) imports from `rateLimit.ts`, so it will **never match** the error thrown from `gemini.ts`.

**Fix**: Delete the duplicate in `gemini.ts`. Import and re-throw the one from `rateLimit.ts`.

---

### 12. **`api/1_old_index.js` is a dead file committed to the repo**
This file (16,733 bytes) is the previous version of the API handler. It serves no purpose in the deployed app and adds confusion.

**Fix**: Delete `api/1_old_index.js`.

---

### 13. **`type` column in `shared_stories` has no validation constraint**
`supabase_table_create` line 13: `type text` — no `CHECK` constraint. Any string can be stored as the type. This means if a bug or malformed request writes a bad `type`, the client will silently cast it to `AppMode` and render the wrong view.

**Fix**:
```sql
type text CHECK (type IN ('STORIES', 'CONCEPTS', 'PHILOSOPHIES')) NOT NULL,
```

---

### 14. **`safety.ts` blocklist blocks legitimate educational content**
`services/safety.ts` line 18: `"sex"` is in the blocklist. This will trigger on perfectly valid educational topics like "The Science of Sexual Reproduction in Plants", "Genetics and Sex Chromosomes", or any biography mentioning "sex-based discrimination". The word-boundary regex (`\bsex\b`) makes partial-word matches safer, but "sex" as a standalone word appears constantly in biology and history.

**Fix**: Either remove `"sex"` from the client-side list and rely on Gemini's own safety filters (which are far more context-aware), or move the check to the server side where you have more control.

---

### 15. **`validateContentSafety` is called on the entire API response object**
`services/gemini.ts` lines 85–86:
```ts
const data = await callBackend('discoverProfiles', ...);
if (!validateContentSafety(data)) throw new SafetyError(...);
```
This recursively traverses the entire response tree. For a story of ~850 words in two languages, this is a significant string scan happening client-side after every generation. Since Gemini already applies safety filters server-side, this is redundant work that can block legitimate content (see issue #14).

**Fix**: Remove client-side safety scanning. Trust Gemini's built-in filters for AI-generated content. Keep only user-input validation if any free-text user input is introduced.

---

## 🟢 Suggestions

### 16. **`ParentalGate.tsx` and `ReportDialog.tsx` are dead components**
Both exist in the components folder but are not imported or used anywhere in `App.tsx`. `ReportDialog` calls `mockReportIssue` which only `console.log`s.

- Either wire them into the app (e.g., ReportDialog accessible from StoryView) or remove them to reduce dead code.

---

### 17. **`generateStoryAudio` is permanently disabled**
`services/gemini.ts` lines 146–149:
```ts
export const generateStoryAudio = async (...): Promise<string | undefined> => {
  // Audio disabled per request
  return undefined;
};
```
The `AudioPlayer.tsx` component exists. If audio is planned for the future, leave it. If it's cancelled, remove both to avoid confusion.

---

### 18. **`useEffect` dependency on `refreshLibrary` and `refreshQuota` — missing from deps array**
Both functions are defined inside the component but are not memoized with `useCallback`. They're referenced in a `useEffect` without being listed as dependencies, which technically violates the `exhaustive-deps` rule. This is low risk currently because they close over stable Supabase client state, but will cause bugs if they ever reference `state` variables.

---

### 19. **No `<title>` update when navigating between modes**
The page title is static: `Lumina - Stories of Values`. When user switches to Science or Wisdom mode, the title doesn't update. Minor SEO / usability issue.

---

### 20. **`callBackend` sends to `/api/index` — mismatched with `vercel.json` which rewrites `/api/(.*)` to `/api/index.js`**
`services/gemini.ts` line 34: `fetch('/api/index', ...)`.
`vercel.json` rewrites `/api/(.*)` → `/api/index.js`. This works in production because Vercel resolves it, but during local dev the Vite proxy targets `http://localhost:3000/api` where no server is running unless you start one separately. The dev workflow is broken without an explicit note.

---

## Verdict

**Request Changes** on issues #1–#6 (credentials in README + CORS + quota fiction + unauthenticated discover actions + JSON parse crash + missing DB policies). These are the production-blockers.

Issues #7–#15 are **required** before calling this production-ready.

---

## Next Steps (Resolved)

1. **[DONE] Immediate:** Removed credentials from README.md.
2. **[DONE] Security Pass:** Fixed CORS, added auth guard to all actions, added DB constraints (RLS).
3. **[DONE] Type Safety Pass:** Eliminated `any` in App.tsx, fixed duplicate `RateLimitError`.
4. **[DONE] Logic Fix:** Fixed stale closure bug, Picsum fallback, and useEffect over-fetching.
5. **[DONE] Cleanup:** Deleted `api/1_old_index.js`.
6. **[DONE] Quota:** Set real limit (1000), implemented upsert for `user_profiles`.

---

# Future Work Roadmap (Updated)

| Priority | Feature | Notes |
|---|---|---|
| ✅ DONE | Fix security issues | Resolved all 6 Blocking issues |
| ✅ DONE | Set real quota limit | Set to 1000 |
| ✅ DONE | Wire `ReportDialog` | Connected to `content_reports` table |
| ✅ DONE | "Download as PDF" | Added `window.print()` support |
| ✅ DONE | Configurable story length | Added Short/Medium/Long toggle |
| ✅ DONE | Favorites Sync | Moved to Supabase `user_favorites` table |
| ✅ DONE | Style Picker | Added storyteller selection and regeneration |
| 🟡 Medium | Wire `ParentalGate` | PIN for specific modes |
| 🟡 Medium | Enable audio narration | TTS support |
| 🟡 Medium | Admin dashboard | Manage users, library, quota |
| 🟢 Low | Google/OTP login | OAuth integration |
| 🟢 Low | Daily e-mail digest | Automated updates |
| 🟢 Low | Offline mode / PWA | Service worker caching |
| 🟢 Low | Hindi UI strings | Full bilingual interface |

---

*Review assisted by the critical-code-reviewer skill (Antigravity).*

---

# Decision Log

## 2026-04-24: Security Hardening & Feature Expansion
**Type**: Decision/Change

**Context**: Following a critical code review, the application was found to have several security vulnerabilities including exposed credentials, insecure CORS settings, and unauthorized API actions. Additionally, the user requested 5 key improvements to enhance the educational experience.

**Decisions**:
- **Security**: 
    - Purged credentials from `README.md` and updated setup instructions.
    - Restricted CORS origin to `ALLOWED_ORIGIN` environment variable.
    - Implemented a mandatory Auth Guard for all API actions in `api/index.js`.
    - Enabled Row Level Security (RLS) on all Supabase tables (`user_profiles`, `shared_stories`, `cached_content`, `user_favorites`, `content_reports`).
- **Architecture**:
    - Replaced `localStorage` favorites with a server-side `user_favorites` table to support cross-device sync.
    - Refactored `App.tsx` to eliminate `any` types and memoize key functions using `useCallback`.
    - Implemented a "Batch Generation" logic for stories to handle text and images sequentially, improving reliability.
- **Features**:
    - Added **Story Length Toggle** (Short/Medium/Long) with word counts 400/850/1400.
    - Added **Storyteller Style Picker** allowing users to select between different English and Hindi authors before/during regeneration.
    - Added **Regenerate** capability to all content views.
    - Wired the **Report Issue** dialog to a real backend endpoint and Supabase table.
    - Added **Print/PDF** support via `@media print` CSS.

**Verification**:
- Verified that API actions now return 401 when unauthorized.
- Verified that quota limits are enforced server-side.
- Verified that generated content caches correctly based on both prompt and length.
