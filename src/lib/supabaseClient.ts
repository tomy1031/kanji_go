import { createClient } from '@supabase/supabase-js';

// Supabase project used purely as a free realtime relay for online battles.
// The anon/publishable key is a PUBLIC key (it is always shipped in the client
// bundle for browser apps) — it is safe to commit. No database tables are used;
// only Realtime channels (broadcast + presence).
const SUPABASE_URL = 'https://iyceaspukufevktabmvy.supabase.co';
const SUPABASE_ANON_KEY =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml5Y2Vhc3B1a3VmZXZrdGFibXZ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM2NjU3NTIsImV4cCI6MjA5OTI0MTc1Mn0.btg1ezB0lVHzsZFOf59W6CwN12xm6Adwh6f6BdWW9L4';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    realtime: { params: { eventsPerSecond: 30 } },
});
