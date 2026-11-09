/* ============================================================
   ЧистоДом — Админ-панель (Supabase Auth + CRUD + Заявки)
   ============================================================ */

'use strict';

const db = window.ChistoDom;

const state = {
  services: [],
  promotions: [],
  requests: [],
  requestsFilter: 'all'  // 'all' | 'new' | 'processed'
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

const IMG_PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120"><rect width="120" height="120" fill="#EFEBE5"/><text x="60" y="64" fill="#A9A29A" font-family="Arial" font-size="12" text-anchor="middle">ЧистоДом</text></svg>'
);

let toastTimer = null;

function showToast(message, type = 'success') {
  const toast = $('#toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast toast--' + type;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.hidden = true; }, 3200);
}

function openModal(modal) {
  modal.hidden = false;
  document.body.classList.add('no-scroll');
  const first = $('input:not([type="hidden"]), textarea', modal);
  if (first) first.focus();
}

function closeModal(modal) {
  modal.hidden = true;
  if (!$$('.modal').some((m) => !m.hidden)) document.body.classList.remove('no-scroll');
}

function updateImagePreview(inputSel, previewSel) {
  const input = $(inputSel), preview = $(previewSel);
  if (!input || !preview) return;
  const src = input.value.trim();
  preview.innerHTML = '';
  if (!src) { preview.hidden = true; return; }
  const img = document.createElement('img');
  img.alt = 'Предпросмотр';
  img.addEventListener('error', () => { preview.hidden = true; }, { once: true });
  img.src = src;
  preview.appendChild(img);
  preview.hidden = false;
}

function attachImageFallbacks(root) {
  $$('img', root).forEach((img) => {
    img.addEventListener('error', () => {
      const wrap = img.parentElement;
      img.remove();
      if (wrap) { wrap.classList.add('thumb--empty'); wrap.textContent = 'нет фото'; }
    }, { once: true });
  });
}

function thumbHtml(url, alt) {
  const src = (url || '').trim();
  if (!src) return '<div class="thumb thumb--empty">нет фото</div>';
  return '<div class="thumb"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(alt || '') + '" loading="lazy"></div>';
}

function statusBadge(isActive) {
  return isActive ? '<span class="badge badge--on">Активна</span>' : '<span class="badge badge--off">Скрыта</span>';
}

/* ============================================================
   АВТОРИЗАЦИЯ (Supabase Auth)
   ============================================================ */
function initAuth() {
  const authScreen = $('#authScreen');
  const adminPanel = $('#adminPanel');
  const authForm = $('#authForm');
  const emailInput = $('#adminEmail');
  const passwordInput = $('#adminPassword');
  const authError = $('#authError');
  const logoutBtn = $('#logoutBtn');
  const loginBtn = $('#loginBtn');

  const applyState = async () => {
    const { data: { session } } = await db.client.auth.getSession();
    const authed = Boolean(session);
    authScreen.hidden = authed;
    adminPanel.hidden = !authed;
    if (authed) bootstrapAdmin();
  };

  authForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    authError.textContent = '';
    loginBtn.disabled = true;

    const { error } = await db.client.auth.signInWithPassword({
      email: emailInput.value.trim(),
      password: passwordInput.value
    });

    loginBtn.disabled = false;

    if (error) {
      authError.textContent = 'Неверный email или пароль.';
      passwordInput.classList.add('invalid');
      return;
    }

    passwordInput.value = '';
    await applyState();
  });

  passwordInput.addEventListener('input', () => {
    authError.textContent = '';
    passwordInput.classList.remove('invalid');
  });

  logoutBtn.addEventListener('click', async () => {
    await db.client.auth.signOut();
    await applyState();
  });

  applyState();
}

/* ============================================================
   ЗАГРУЗКА ДАННЫХ
   ============================================================ */
async function fetchServices() {
  const { data, error } = await db.from('services').select('*').order('id', { ascending: true });
  if (error) throw error;
  state.services = data || [];
}

async function fetchPromotions() {
  const { data, error } = await db.from('promotions').select('*').order('id', { ascending: true });
  if (error) throw error;
  state.promotions = data || [];
}

async function fetchRequests() {
  const { data, error } = await db
    .from('requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  state.requests = data || [];
}

/* ============================================================
   РЕНДЕР УСЛУГ
   ============================================================ */
function renderServices() {
  const tbody = $('#servicesTbody');
  const empty = $('#servicesEmpty');
  tbody.innerHTML = '';
  if (!state.services.length) { empty.hidden = false; return; }
  empty.hidden = true;

  const frag = document.createDocumentFragment();
  state.services.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + thumbHtml(item.image_url, item.name) + '</td>' +
      '<td class="cell-name">' + escapeHtml(item.name) + '</td>' +
      '<td class="cell-desc" title="' + escapeHtml(item.description || '') + '">' + escapeHtml(item.description || '—') + '</td>' +
      '<td>' + escapeHtml(item.price || '—') + '</td>' +
      '<td>' + statusBadge(item.is_active) + '</td>' +
      '<td class="cell-actions">' +
        '<button class="icon-btn" type="button" data-action="edit-service" data-id="' + item.id + '" title="Редактировать">✎</button>' +
        '<button class="icon-btn icon-btn--danger" type="button" data-action="delete-service" data-id="' + item.id + '" title="Удалить">🗑</button>' +
      '</td>';
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  attachImageFallbacks(tbody);
}

/* ============================================================
   РЕНДЕР АКЦИЙ
   ============================================================ */
function renderPromotions() {
  const tbody = $('#promotionsTbody');
  const empty = $('#promotionsEmpty');
  tbody.innerHTML = '';
  if (!state.promotions.length) { empty.hidden = false; return; }
  empty.hidden = true;

  const frag = document.createDocumentFragment();
  state.promotions.forEach((item) => {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + thumbHtml(item.image_url, item.title) + '</td>' +
      '<td class="cell-name">' + escapeHtml(item.title) + '</td>' +
      '<td class="cell-desc" title="' + escapeHtml(item.description || '') + '">' + escapeHtml(item.description || '—') + '</td>' +
      '<td>' + statusBadge(item.is_active) + '</td>' +
      '<td class="cell-actions">' +
        '<button class="icon-btn" type="button" data-action="edit-promo" data-id="' + item.id + '" title="Редактировать">✎</button>' +
        '<button class="icon-btn icon-btn--danger" type="button" data-action="delete-promo" data-id="' + item.id + '" title="Удалить">🗑</button>' +
      '</td>';
    frag.appendChild(tr);
  });
  tbody.appendChild(frag);
  attachImageFallbacks(tbody);
}

/* ============================================================
   РЕНДЕР ЗАЯВОК
   ============================================================ */
function updateRequestsCounters() {
  const total = state.requests.length;
  const newCount = state.requests.filter((r) => !r.is_processed).length;
  const processedCount = total - newCount;

  const setText = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = String(value);
  };

  setText('countAll', total);
  setText('countNew', newCount);
  setText('countProcessed', processedCount);

  const badge = document.getElementById('requestsBadge');
  if (badge) {
    badge.textContent = String(newCount);
    badge.hidden = newCount === 0;
  }
}

function formatRequestDate(iso) {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return iso;
  }
}

function renderRequests() {
  const tbody = document.getElementById('requestsTbody');
  const empty = document.getElementById('requestsEmpty');
  if (!tbody || !empty) return;

  const filter = state.requestsFilter || 'all';
  const list = state.requests.filter((r) => {
    if (filter === 'new') return !r.is_processed;
    if (filter === 'processed') return r.is_processed;
    return true;
  });

  tbody.innerHTML = '';

  if (!list.length) {
    empty.hidden = false;
    empty.textContent =
      filter === 'all'
        ? 'Пока нет ни одной заявки.'
        : filter === 'new'
          ? 'Новых заявок нет — все обработаны.'
          : 'Обработанных заявок пока нет.';
    return;
  }

  empty.hidden = true;
  const frag = document.createDocumentFragment();

  list.forEach((item) => {
    const tr = document.createElement('tr');
    if (item.is_processed) tr.classList.add('req-row--processed');

    const phoneDigits = String(item.phone || '').replace(/[^\d+]/g, '');
    const telHref = phoneDigits ? 'tel:' + phoneDigits : '#';

    const toggleIcon = item.is_processed ? '↺' : '✓';
    const toggleTitle = item.is_processed ? 'Вернуть в «Новые»' : 'Пометить как обработанную';

    tr.innerHTML =
      '<td class="req-date">' + escapeHtml(formatRequestDate(item.created_at)) + '</td>' +
      '<td class="cell-name">' + escapeHtml(item.name) + '</td>' +
      '<td class="req-phone"><a href="' + escapeHtml(telHref) + '">' + escapeHtml(item.phone) + '</a></td>' +
      '<td class="req-comment' + (item.comment ? '' : ' req-comment--empty') + '" ' +
      'title="' + escapeHtml(item.comment || '') + '">' +
    escapeHtml(item.comment || '—') +
      '</td>' +
      '<td>' + (item.is_processed
        ? '<span class="badge badge--processed">Обработана</span>'
        : '<span class="badge badge--new">Новая</span>') + '</td>' +
      '<td class="cell-actions">' +
        '<button class="icon-btn" type="button" data-action="toggle-request" data-id="' + item.id + '" title="' + toggleTitle + '">' + toggleIcon + '</button>' +
        '<button class="icon-btn icon-btn--danger" type="button" data-action="delete-request" data-id="' + item.id + '" title="Удалить">🗑</button>' +
      '</td>';

    frag.appendChild(tr);
  });

  tbody.appendChild(frag);
}

async function toggleRequestProcessed(id) {
  const item = state.requests.find((r) => r.id === id);
  if (!item) return;

  try {
    const { error } = await db
      .from('requests')
      .update({ is_processed: !item.is_processed })
      .eq('id', id);
    if (error) throw error;

    await fetchRequests();
    renderRequests();
    updateRequestsCounters();
  } catch (err) {
    console.error('[Админка] Ошибка смены статуса заявки:', err);
    showToast('Не удалось обновить: ' + (err.message || 'ошибка'), 'error');
  }
}

async function deleteRequest(id) {
  if (!window.confirm('Удалить заявку? Действие необратимо.')) return;

  try {
    const { error } = await db.from('requests').delete().eq('id', id);
    if (error) throw error;

    showToast('Заявка удалена');
    await fetchRequests();
    renderRequests();
    updateRequestsCounters();
  } catch (err) {
    console.error('[Админка] Ошибка удаления заявки:', err);
    showToast('Не удалось удалить: ' + (err.message || 'ошибка'), 'error');
  }
}

function exportRequestsCSV() {
  if (!state.requests.length) {
    showToast('Нет заявок для экспорта', 'error');
    return;
  }

  const headers = ['Дата', 'Имя', 'Телефон', 'Комментарий', 'Статус'];

  const rows = state.requests.map((r) => [
    formatRequestDate(r.created_at),
    r.name || '',
    r.phone || '',
    r.comment || '',
    r.is_processed ? 'Обработана' : 'Новая'
  ]);

  const esc = (value) => '"' + String(value ?? '').replace(/"/g, '""') + '"';

  const csv =
    '\uFEFF' +
    [headers, ...rows].map((row) => row.map(esc).join(';')).join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().slice(0, 10);

  a.href = url;
  a.download = 'zayavki-' + stamp + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Экспортировано заявок: ' + state.requests.length);
}

/* ============================================================
   CRUD УСЛУГ
   ============================================================ */
function openServiceModal(item) {
  const modal = $('#serviceModal');
  $('#serviceModalTitle').textContent = item ? 'Редактировать услугу' : 'Новая услуга';
  $('#serviceId').value = item ? item.id : '';
  $('#serviceName').value = item ? item.name : '';
  $('#serviceDescription').value = item ? (item.description || '') : '';
  $('#servicePrice').value = item ? (item.price || '') : '';
  $('#serviceImage').value = item ? (item.image_url || '') : '';
  $('#serviceActive').value = item ? String(Boolean(item.is_active)) : 'true';
  $('#serviceFormError').textContent = '';
  updateImagePreview('#serviceImage', '#serviceImagePreview');
  openModal(modal);
}

async function saveService(e) {
  e.preventDefault();
  const formError = $('#serviceFormError');
  const submitBtn = $('#serviceSubmit');
  formError.textContent = '';
  const id = $('#serviceId').value;

  const payload = {
    name: $('#serviceName').value.trim(),
    description: $('#serviceDescription').value.trim(),
    price: $('#servicePrice').value.trim(),
    image_url: $('#serviceImage').value.trim(),
    is_active: $('#serviceActive').value === 'true'
  };

  if (!payload.name) { formError.textContent = 'Укажите название.'; $('#serviceName').focus(); return; }

  submitBtn.disabled = true;
  try {
    let error;
    if (id) ({ error } = await db.from('services').update(payload).eq('id', id));
    else ({ error } = await db.from('services').insert(payload));
    if (error) throw error;

    closeModal($('#serviceModal'));
    showToast(id ? 'Услуга обновлена' : 'Услуга добавлена');
    await fetchServices();
    renderServices();
  } catch (err) {
    console.error(err);
    formError.textContent = 'Не удалось сохранить: ' + (err.message || 'ошибка');
  } finally {
    submitBtn.disabled = false;
  }
}

async function deleteService(id) {
  const item = state.services.find((s) => s.id === id);
  if (!window.confirm('Удалить «' + (item ? item.name : 'услугу') + '»?')) return;
  try {
    const { error } = await db.from('services').delete().eq('id', id);
    if (error) throw error;
    showToast('Услуга удалена');
    await fetchServices();
    renderServices();
  } catch (err) {
    console.error(err);
    showToast('Не удалось удалить: ' + (err.message || 'ошибка'), 'error');
  }
}

/* ============================================================
   CRUD АКЦИЙ
   ============================================================ */
function openPromoModal(item) {
  const modal = $('#promoModal');
  $('#promoModalTitle').textContent = item ? 'Редактировать акцию' : 'Новая акция';
  $('#promoId').value = item ? item.id : '';
  $('#promoTitle').value = item ? item.title : '';
  $('#promoDescription').value = item ? (item.description || '') : '';
  $('#promoImage').value = item ? (item.image_url || '') : '';
  $('#promoActive').value = item ? String(Boolean(item.is_active)) : 'true';
  $('#promoFormError').textContent = '';
  updateImagePreview('#promoImage', '#promoImagePreview');
  openModal(modal);
}

async function savePromotion(e) {
  e.preventDefault();
  const formError = $('#promoFormError');
  const submitBtn = $('#promoSubmit');
  formError.textContent = '';
  const id = $('#promoId').value;

  const payload = {
    title: $('#promoTitle').value.trim(),
    description: $('#promoDescription').value.trim(),
    image_url: $('#promoImage').value.trim(),
    is_active: $('#promoActive').value === 'true'
  };

  if (!payload.title) { formError.textContent = 'Укажите заголовок.'; $('#promoTitle').focus(); return; }

  submitBtn.disabled = true;
  try {
    let error;
    if (id) ({ error } = await db.from('promotions').update(payload).eq('id', id));
    else ({ error } = await db.from('promotions').insert(payload));
    if (error) throw error;

    closeModal($('#promoModal'));
    showToast(id ? 'Акция обновлена' : 'Акция добавлена');
    await fetchPromotions();
    renderPromotions();
  } catch (err) {
    console.error(err);
    formError.textContent = 'Не удалось сохранить: ' + (err.message || 'ошибка');
  } finally {
    submitBtn.disabled = false;
  }
}

async function deletePromotion(id) {
  const item = state.promotions.find((p) => p.id === id);
  if (!window.confirm('Удалить «' + (item ? item.title : 'акцию') + '»?')) return;
  try {
    const { error } = await db.from('promotions').delete().eq('id', id);
    if (error) throw error;
    showToast('Акция удалена');
    await fetchPromotions();
    renderPromotions();
  } catch (err) {
    console.error(err);
    showToast('Не удалось удалить: ' + (err.message || 'ошибка'), 'error');
  }
}

/* ============================================================
   ИНИЦИАЛИЗАЦИЯ
   ============================================================ */
async function bootstrapAdmin() {
  const warning = $('#configWarning');
  if (warning && (!db || !db.isConfigured)) { warning.hidden = false; return; }

  try {
    await Promise.all([fetchServices(), fetchPromotions(), fetchRequests()]);
    renderServices();
    renderPromotions();
    renderRequests();
    updateRequestsCounters();
  } catch (err) {
    console.error('[Админка] Ошибка загрузки:', err);
    showToast('Не удалось загрузить данные', 'error');
  }
}

function initTabs() {
  $$('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', async () => {
      const name = tab.dataset.tab;

      $$('.admin-tab').forEach((t) => t.classList.toggle('is-active', t === tab));
      $('#tab-services').hidden = name !== 'services';
      $('#tab-promotions').hidden = name !== 'promotions';
      $('#tab-requests').hidden = name !== 'requests';

      if (name === 'requests') {
        try {
          await fetchRequests();
          renderRequests();
          updateRequestsCounters();
        } catch (err) {
          console.error('[Админка] Ошибка обновления заявок:', err);
          showToast('Не удалось загрузить заявки', 'error');
        }
      }
    });
  });
}

function initCrud() {
  /* --- Услуги и акции --- */
  $('#addServiceBtn').addEventListener('click', () => openServiceModal(null));
  $('#addPromoBtn').addEventListener('click', () => openPromoModal(null));

  $('#servicesTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit-service') {
      const item = state.services.find((s) => s.id === id);
      if (item) openServiceModal(item);
    } else if (btn.dataset.action === 'delete-service') deleteService(id);
  });

  $('#promotionsTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    if (btn.dataset.action === 'edit-promo') {
      const item = state.promotions.find((p) => p.id === id);
      if (item) openPromoModal(item);
    } else if (btn.dataset.action === 'delete-promo') deletePromotion(id);
  });

  $('#serviceForm').addEventListener('submit', saveService);
  $('#promoForm').addEventListener('submit', savePromotion);

  $('#serviceImage').addEventListener('input', () => updateImagePreview('#serviceImage', '#serviceImagePreview'));
  $('#promoImage').addEventListener('input', () => updateImagePreview('#promoImage', '#promoImagePreview'));

  /* --- Заявки --- */
  $$('.req-filter').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.requestsFilter = btn.dataset.filter;
      $$('.req-filter').forEach((b) => b.classList.toggle('is-active', b === btn));
      renderRequests();
    });
  });

  $('#refreshRequestsBtn').addEventListener('click', async () => {
    try {
      await fetchRequests();
      renderRequests();
      updateRequestsCounters();
      showToast('Список обновлён');
    } catch (err) {
      console.error(err);
      showToast('Не удалось обновить: ' + (err.message || 'ошибка'), 'error');
    }
  });

  $('#exportRequestsBtn').addEventListener('click', exportRequestsCSV);

  $('#requestsTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const id = Number(btn.dataset.id);

    if (btn.dataset.action === 'toggle-request') toggleRequestProcessed(id);
    else if (btn.dataset.action === 'delete-request') deleteRequest(id);
  });

  /* --- Модалки --- */
  $$('[data-close-modal]').forEach((el) => {
    el.addEventListener('click', () => {
      const modal = el.closest('.modal');
      if (modal) closeModal(modal);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    $$('.modal').forEach((m) => { if (!m.hidden) closeModal(m); });
  });
  $('#requestsTbody').addEventListener('click', (e) => {
  const cell = e.target.closest('.req-comment');
  if (!cell || cell.classList.contains('req-comment--empty')) return;
  cell.classList.toggle('is-expanded');
});
}

document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initTabs();
  initCrud();
});