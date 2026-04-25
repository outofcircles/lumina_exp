
import { createClient } from '@supabase/supabase-js';

// Helper to safely access environment variables in various environments
const getEnv = (key: string) => {
  // Check import.meta.env (Vite)
  try {
    // @ts-ignore
    if (import.meta && import.meta.env && import.meta.env[key]) {
      // @ts-ignore
      return import.meta.env[key];
    }
  } catch (e) {}

  // Check process.env (Node/CRA/Next)
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) {}

  return '';
};

// Attempt to find the URL and KEY using common prefixes
const supabaseUrl = 
  getEnv('VITE_SUPABASE_URL') || 
  getEnv('REACT_APP_SUPABASE_URL') || 
  getEnv('NEXT_PUBLIC_SUPABASE_URL') || 
  getEnv('SUPABASE_URL');

const supabaseKey = 
  getEnv('VITE_SUPABASE_ANON_KEY') || 
  getEnv('REACT_APP_SUPABASE_ANON_KEY') || 
  getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY') || 
  getEnv('SUPABASE_KEY');

// Fallback to placeholder to prevent app crash on initialization.
// Calls will fail gracefully with network errors instead of blank screen.
const validUrl = supabaseUrl || 'https://placeholder.supabase.co';
const validKey = supabaseKey || 'placeholder';

if (!supabaseUrl || !supabaseKey) {
  console.warn("Lumina: Supabase credentials missing. Authentication will fail.");
}

export const supabase = createClient(validUrl, validKey);
