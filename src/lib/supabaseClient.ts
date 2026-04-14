import { createClient } from '@supabase/supabase-js'
import type { LayoutRow, PresetRow } from '@/types'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Database type mirror — keeps TypeScript aligned with Supabase schema
interface Database {
  public: {
    Tables: {
      layouts: {
        Row: LayoutRow
        Insert: Omit<LayoutRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<LayoutRow, 'id' | 'created_at'>>
      }
      presets: {
        Row: PresetRow
        Insert: Omit<PresetRow, 'id' | 'created_at'>
        Update: Partial<Omit<PresetRow, 'id' | 'created_at'>>
      }
    }
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
