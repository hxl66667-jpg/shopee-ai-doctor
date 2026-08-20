const supabaseUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
const supabaseBrowserKey = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const openaiKey = Boolean(process.env.OPENAI_API_KEY);

console.log(`[env-check] SUPABASE_URL=${supabaseUrl} SUPABASE_BROWSER_KEY=${supabaseBrowserKey} OPENAI_API_KEY=${openaiKey}`);
