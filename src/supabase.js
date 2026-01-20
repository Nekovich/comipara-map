import { createClient } from '@supabase/supabase-js'

// Ganti TEKS_INI dengan URL project Supabase Anda (dari menu Settings > API)
const supabaseUrl = 'https://kitkanbzlbyomvhcappa.supabase.co'

// Ganti TEKS_INI dengan "anon public" key Anda (string panjang eyJh...)
const supabaseKey = 'sb_publishable_WOHCZtsRh_n2pEN7e91w9Q_j0b8lVbx'

export const supabase = createClient(supabaseUrl, supabaseKey)