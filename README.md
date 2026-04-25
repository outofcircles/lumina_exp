<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1c9ATceb8tr1YUPKyMUCvgmvHoCrQNaEP

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


Store all secrets in `.env.local` (gitignored). Required variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_ALLOWED_ORIGIN` (your Vercel deployment URL, for CORS)

Vercel environment variables (set in Vercel dashboard):
- `API_KEY` (Gemini)
- `SUPABASE_URL`
- `SUPABASE_KEY` (service role or anon key)
