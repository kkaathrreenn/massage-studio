/* Вставьте Project URL и публичный publishable key из Supabase.
   Publishable key начинается с sb_publishable_. Secret key сюда вставлять НЕЛЬЗЯ. */
window.SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',
  publishableKey: 'YOUR_SUPABASE_PUBLISHABLE_KEY'
};

window.createStudioSupabase = function () {
  const config = window.SUPABASE_CONFIG;
  const key = config?.publishableKey || config?.anonKey;
  if (!window.supabase || !config || !config.url || config.url.includes('YOUR_') || !key || key.includes('YOUR_')) return null;
  return window.supabase.createClient(config.url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
};
