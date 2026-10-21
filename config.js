// ============================================================================
// IDEAS BOARD CONFIGURATION
// ============================================================================
// 1. Create a free Supabase project at https://supabase.com
// 2. Paste your Project URL and Anon Key below.
//
// SECURITY NOTE:
// The Supabase "anon" (anonymous) key is public by design and meant to be
// used in frontend code. Security is enforced through Row Level Security (RLS)
// policies defined in supabase.sql.
//
// NEVER paste or use your "service_role" key anywhere in client code!
// ============================================================================

export const SUPABASE_URL = "PASTE_YOUR_SUPABASE_URL_HERE";
export const SUPABASE_ANON_KEY = "PASTE_YOUR_ANON_KEY_HERE";

/**
 * Checks whether the configuration placeholders have been replaced with real values.
 * @returns {boolean} True if real credentials are present, false otherwise.
 */
export function isConfigured() {
  return (
    SUPABASE_URL !== "PASTE_YOUR_SUPABASE_URL_HERE" &&
    SUPABASE_ANON_KEY !== "PASTE_YOUR_ANON_KEY_HERE" &&
    SUPABASE_URL.trim().length > 0 &&
    SUPABASE_ANON_KEY.trim().length > 0
  );
}
