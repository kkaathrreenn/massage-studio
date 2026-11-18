/* Публичные настройки подключения Supabase.
   Здесь используется только Publishable key; Secret key / service_role в браузер не помещать. */
window.SUPABASE_CONFIG = {
  url: 'https://otseqztskhkocwomdigq.supabase.co',
  publishableKey: 'sb_publishable_R516nMqHJO5H21ZJ3Vc_Bw_egYAa3gL'
};

window.createStudioSupabase = function () {
  const config = window.SUPABASE_CONFIG;
  const key = config?.publishableKey || config?.anonKey;
  if (!window.supabase || !config || !config.url || config.url.includes('YOUR_') || !key || key.includes('YOUR_')) return null;
  return window.supabase.createClient(config.url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
};
