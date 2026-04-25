-- Run in Supabase SQL Editor

-- 1. User favorites table (personal, per-user)
CREATE TABLE user_favorites (
  user_id uuid REFERENCES auth.users ON DELETE CASCADE,
  story_id uuid REFERENCES shared_stories(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, story_id)
);
ALTER TABLE user_favorites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own favorites" ON user_favorites
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 2. Content reports table
CREATE TABLE content_reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at timestamptz DEFAULT now(),
  reported_by uuid REFERENCES auth.users,
  content_title text NOT NULL,
  reason text NOT NULL,
  status text DEFAULT 'pending'
);
ALTER TABLE content_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert reports" ON content_reports
  FOR INSERT WITH CHECK (auth.uid() = reported_by);
CREATE POLICY "Users can read own reports" ON content_reports
  FOR SELECT USING (auth.uid() = reported_by);
