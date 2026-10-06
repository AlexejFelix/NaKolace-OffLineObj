import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

if (!url || !key) {
  throw new Error('Chýba VITE_SUPABASE_URL alebo VITE_SUPABASE_PUBLISHABLE_KEY v súbore .env.local.')
}

export const supabase = createClient(url, key)
