// ============================================================
// SUPABASE CLIENT — stub
// No real calls in this migration phase.
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Placeholder values — replace with real env vars when Supabase is wired up
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined ?? ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined ?? ''

/** Typed Supabase client (stub — URL/key not yet configured) */
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
