/* ============================================================
   ЧистоДом — главная страница
   - бургер, тень шапки
   - динамические услуги и акции из Supabase
   - валидация формы, honeypot, согласие, отправка в requests
   ============================================================ */

'use strict';

const db = window.ChistoDom;

/* ---------- 1. Бургер ---------- */
const burger = document.getElementById('burger');
const nav = document.getElementById('nav');

if (burger && nav) {
  burger.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    burger.classList.toggle('active');
    burger.setAttribute('aria-expanded', String(open));
  });

  nav.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      nav.classList.remove('open');
      burger.classList.remove('active');
      burger.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- 2. Тень шапки ---------- */
const header = document.getElementById('header');
if (header) {
  const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
}

/* ---------- 3. Утилиты ---------- */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const PLACEHOLDER = 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">' +
  '<rect width="600" height="400" fill="#EFEBE5"/>' +
  '<text x="300" y="210" fill="#A9A29A" font-family="Arial" font-size="20" text-anchor="middle">ЧистоДом</text>' +
  '</svg>'
);

/* ---------- 4. Динамические услуги ---------- */
async function loadServices() {
  const grid = document.getElementById('servicesGrid');
  const note = document.getElementById('servicesNote');
  if (!grid) return;

  if (!db || !db.isConfigured) {
    note.hidden = false;
    note.textContent = 'Услуги временно недоступны. Позвоните нам: 8 (963) 412-75-00.';
    return;
  }

  try {
    const { data, error } = await db.from('services').select('*').order('id', { ascending: true });
    if (error) throw error;

    if (!data || !data.length) {
      note.hidden = false;
      note.textContent = 'Список услуг обновляется. Позвоните нам: 8 (963) 412-75-00.';
      return;
    }

    const fragment = document.createDocumentFragment();

    data.forEach((item) => {
      const card = document.createElement('article');
      card.className = 'service-card';
      card.innerHTML =
        '<div class="service-card__img-wrap">' +
          '<img class="service-card__img" src="' + escapeHtml(item.image_url || PLACEHOLDER) + '" ' +
            'alt="' + escapeHtml(item.name) + '" loading="lazy" width="600" height="400" ' +
            'onerror="this.onerror=null; this.src=\'' + PLACEHOLDER + '\'">' +
        '</div>' +
        '<div class="service-card__body">' +
          '<h3>' + escapeHtml(item.name) + '</h3>' +
          '<p>' + escapeHtml(item.description || '') + '</p>' +
          (item.price ? '<p class="service-card__price"><strong>' + escapeHtml(item.price) + '</strong></p>' : '') +
        '</div>';
      fragment.appendChild(card);
    });

    grid.appendChild(fragment);
  } catch (err) {
    console.error('[ЧистоДом] Ошибка загрузки услуг:', err);
    note.hidden = false;
    note.textContent = 'Не удалось загрузить услуги. Позвоните нам: 8 (963) 412-75-00.';
  }
}

/* ---------- 5. Динамические акции ---------- */
async function loadPromotions() {
  const section = document.getElementById('promotions');
  const grid = document.getElementById('promotionsGrid');
  if (!section || !grid) return;

  if (!db || !db.isConfigured) return;

  try {
    const { data, error } = await db.from('promotions').select('*').order('id', { ascending: true });
    if (error) throw error;

    if (!data || !data.length) return;

    const fragment = document.createDocumentFragment();

    data.forEach((item) => {
      const banner = document.createElement('article');
      banner.className = 'promo-banner';
      banner.innerHTML =
        '<div class="promo-banner__img-wrap">' +
          '<img class="promo-banner__img" src="' + escapeHtml(item.image_url || PLACEHOLDER) + '" ' +
            'alt="' + escapeHtml(item.title) + '" loading="lazy" width="800" height="400" ' +
            'onerror="this.onerror=null; this.src=\'' + PLACEHOLDER + '\'">' +
        '</div>' +
        '<div class="promo-banner__body">' +
          '<h3 class="promo-banner__title">' + escapeHtml(item.title) + '</h3>' +
          '<p class="promo-banner__desc">' + escapeHtml(item.description || '') + '</p>' +
          '<a href="#form" class="btn btn--primary btn--sm">Воспользоваться</a>' +
        '</div>';
      fragment.appendChild(banner);
    });

    grid.appendChild(fragment);
    section.hidden = false;
  } catch (err) {
    console.error('[ЧистоДом] Ошибка загрузки акций:', err);
  }
}

/* ---------- 6. Форма ---------- */
const form = document.getElementById('requestForm');
const nameInput = document.getElementById('name');
const phoneInput = document.getElementById('phone');
const commentInput = document.getElementById('comment');
const consentInput = document.getElementById('consent');
const websiteInput = document.getElementById('website');
const nameError = document.getElementById('nameError');
const phoneError = document.getElementById('phoneError');
const consentError = document.getElementById('consentError');
const formStatus = document.getElementById('formStatus');
const submitBtn = document.getElementById('submitBtn');

function validateName(value) {
  const t = value.trim();
  if (t.length < 2) return 'Введите имя (минимум 2 символа).';
  if (!/^[А-Яа-яЁёA-Za-z\s-]+$/.test(t)) return 'Имя: только буквы, пробелы и дефис.';
  return '';
}

function validatePhone(value) {
  const t = value.trim();
  if (!t) return 'Введите номер телефона.';
  const digits = t.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) return 'Введите корректный номер (10–15 цифр).';
  return '';
}

[nameInput, phoneInput].forEach((input) => {
  input.addEventListener('input', () => {
    const err = input === nameInput ? nameError : phoneError;
    err.textContent = '';
    input.classList.remove('invalid');
  });
});

consentInput.addEventListener('change', () => {
  consentError.textContent = '';
});

function setLoading(isLoading) {
  const text = submitBtn.querySelector('.btn__text');
  const loader = submitBtn.querySelector('.btn__loader');
  submitBtn.disabled = isLoading;
  if (text) text.hidden = isLoading;
  if (loader) loader.hidden = !isLoading;
}

function showStatus(message, type = '') {
  formStatus.textContent = message;
  formStatus.className = 'form-status' + (type ? ' ' + type : '');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  nameError.textContent = '';
  phoneError.textContent = '';
  consentError.textContent = '';
  nameInput.classList.remove('invalid');
  phoneInput.classList.remove('invalid');
  showStatus('');

  if (websiteInput.value.trim() !== '') {
    showStatus('Спасибо! Заявка отправлена.', 'success');
    form.reset();
    return;
  }

  const nameErr = validateName(nameInput.value);
  const phoneErr = validatePhone(phoneInput.value);

  if (nameErr) { nameError.textContent = nameErr; nameInput.classList.add('invalid'); }
  if (phoneErr) { phoneError.textContent = phoneErr; phoneInput.classList.add('invalid'); }

  if (!consentInput.checked) {
    consentError.textContent = 'Отметьте согласие на обработку персональных данных.';
  }

  if (nameErr || phoneErr || !consentInput.checked) return;

  setLoading(true);

  try {
    if (!db || !db.isConfigured) {
      throw new Error('Supabase не настроен. Проверьте config.js.');
    }

    const { error } = await db.from('requests').insert([{
      name: nameInput.value.trim(),
      phone: phoneInput.value.trim(),
      comment: commentInput.value.trim() || ''
    }]);

    if (error) throw error;

    showStatus('Спасибо! Заявка отправлена. Мы перезвоним в течение 15 минут.', 'success');
    form.reset();
  } catch (err) {
    console.error('[ЧистоДом] Ошибка отправки:', err);

    let msg = 'Не удалось отправить заявку. Позвоните: 8 (963) 412-75-00.';
    if (err.message && /слишком часто/i.test(err.message)) {
      msg = 'Заявка уже отправлена недавно. Попробуйте через минуту.';
    } else if (err.message && /row-level security|policy/i.test(err.message)) {
      msg = 'Ошибка доступа. Проверьте RLS-политики в Supabase.';
    } else if (err.message && /fetch|network/i.test(err.message)) {
      msg = 'Нет связи с сервером. Проверьте интернет.';
    }
    showStatus(msg, 'error');
  } finally {
    setLoading(false);
  }
});

/* ---------- 7. Старт ---------- */
document.addEventListener('DOMContentLoaded', () => {
  loadServices();
  loadPromotions();
});