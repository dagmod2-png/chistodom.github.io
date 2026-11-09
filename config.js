/* ============================================================
   ЧистоДом — единая конфигурация Supabase
   Подключается на index.html и admin.html перед script.js/admin.js
   ============================================================ */

(function () {
  'use strict';

  /* 🔑 ВПИШИТЕ СВОИ ЗНАЧЕНИЯ:
     Supabase → Project Settings → API
     (или URL вашего self-hosted Supabase на российском сервере) */
  const SUPABASE_URL = 'https://ybdfjsiktddhroebnsxh.supabase.co';
  const SUPABASE_ANON_KEY = 'sb_publishable_AeeOMvDiZHaUHHvHoi-sGg_mI9lSIjM';

  let client = null;

  try {
    if (typeof supabase !== 'undefined' && typeof supabase.createClient === 'function') {
      client = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    } else {
      console.warn('[ЧистоДом] supabase-js не загружен. Проверьте CDN-скрипт.');
    }
  } catch (err) {
    console.warn('[ЧистоДом] Ошибка инициализации Supabase:', err);
  }

  const isConfigured =
    Boolean(client) &&
    !SUPABASE_URL.includes('ВАШ') &&
    !SUPABASE_ANON_KEY.includes('ВАШ') &&
    SUPABASE_URL.startsWith('https://');

  window.ChistoDom = {
    client,
    isConfigured,
    from(table) {
      if (!client) throw new Error('Supabase-клиент не инициализирован.');
      return client.from(table);
    }
  };

  if (!isConfigured) {
    console.warn('[ЧистоДом] Supabase не настроен — впишите URL и anon-ключ в config.js.');
  }
})();