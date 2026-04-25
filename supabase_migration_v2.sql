-- =============================================================
-- LUMINA: Migration — Apply code review fixes to existing tables
-- Run this in Supabase SQL Editor (not the full table_create file)
-- =============================================================

-- 1. Add CHECK constraint to shared_stories.type
--    (prevents invalid mode strings from being stored)
ALTER TABLE shared_stories
  ADD CONSTRAINT shared_stories_type_check
  CHECK (type IN ('STORIES', 'CONCEPTS', 'PHILOSOPHIES'));

-- 2. user_profiles: add missing update + insert policies
CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- 3. cached_content: enable RLS + add authenticated read policy
--    (writes go through the service role key in the serverless function — no client write policy needed)
ALTER TABLE cached_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read access"
  ON cached_content FOR SELECT
  USING (auth.role() = 'authenticated');
