(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEMO_KEY = 'sedoy_demo_content';
  const DEMO_PASS = 'sedoy7431';

  let demo = false, csrf = '', C = null, saved = '', tab = 'prices', group = null;

  /* ---------- связь с сервером (или демо в браузере) ---------- */
  async function api(action, body, isForm) {
    const opt = { method: body ? 'POST' : 'GET', headers: {}, credentials: 'same-origin' };
    if (body) {
      opt.headers['X-CSRF'] = csrf;
      if (isForm) opt.body = body; else { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    }
    const r = await fetch('api.php?action=' + action, opt);
    const j = await r.json().catch(() => ({ ok: false, error: 'Сервер не ответил' }));
    if (!j.ok) throw new Error(j.error || 'Ошибка');
    return j;
  }
  async function detect() {
    try { const r = await fetch('api.php?action=ping', { cache: 'no-store' }); const j = await r.json(); return !(j && j.php); }
    catch (e) { return true; }
  }
  async function loadSiteContent() {
    let base = null;
    try {
      const r = await fetch('../data/content.json?v=' + Date.now(), { cache: 'no-store' });
      if (r.ok) base = await r.json();
    } catch (e) {}
    base ||= JSON.parse(JSON.stringify(window.SEDOY_SEED));
    if (demo) { try { const d = localStorage.getItem(DEMO_KEY); if (d) return upgradeDraft(JSON.parse(d), base); } catch (e) {} }
    return base;
  }
  // черновик демо мог быть сохранён старой версией сайта — дополняем его новыми полями из свежего content.json
  function upgradeDraft(d, base) {
    if (!base) return d;
    for (const k in base) if (!(k in d)) d[k] = base[k];
    for (const k in base.brand || {}) if (!d.brand[k]) d.brand[k] = base.brand[k];
    (d.services || []).forEach(s => { const b = base.services.find(x => x.name === s.name && x.group === s.group); if (b) { if (!s.yc && b.yc) s.yc = b.yc; if (!s.img && b.img) s.img = b.img; } });
    (d.masters || []).forEach(m => { const b = base.masters.find(x => String(x.yc_id) === String(m.yc_id)); if (b && !('level' in m)) m.level = b.level; });
    return d;
  }

  /* ---------- старт ---------- */
  (async function init() {
    demo = await detect();
    if (demo) $('#demoNote').hidden = false;
    if (!demo) {
      try { const me = await api('me'); if (me.auth) { csrf = me.csrf; return start(); } } catch (e) {}
    } else if (sessionStorage.getItem('sedoy_demo_auth')) return start();
    $('#login').hidden = false;
  })();

  $('#loginForm').onsubmit = async e => {
    e.preventDefault();
    const pass = $('#pass').value;
    $('#loginErr').textContent = '';
    try {
      if (demo) {
        if (pass !== DEMO_PASS) throw new Error('Неверный пароль');
        sessionStorage.setItem('sedoy_demo_auth', '1');
      } else {
        csrf = (await api('login', { password: pass })).csrf;
      }
      $('#login').hidden = true; start();
    } catch (err) { $('#loginErr').textContent = err.message; }
  };
  $('#logout').onclick = async () => {
    if (dirty() && !confirm('Есть несохранённые изменения. Выйти без сохранения?')) return;
    if (demo) sessionStorage.removeItem('sedoy_demo_auth'); else await api('logout').catch(() => {});
    markOwnerDevice(false);
    location.reload();
  };
  $('#demoReset').onclick = () => {
    if (!confirm('Вернуть демо к исходному виду?')) return;
    localStorage.removeItem(DEMO_KEY); location.reload();
  };

  // помечаем устройство владельца: на сайте появится кнопка «Редактировать сайт» (только у него)
  function markOwnerDevice(on) {
    try {
      if (on) localStorage.setItem('sedoy_admin_url', location.href.split('#')[0].split('?')[0]);
      else localStorage.removeItem('sedoy_admin_url');
    } catch (e) {}
  }

  async function start() {
    markOwnerDevice(true);
    C = await loadSiteContent();
    saved = JSON.stringify(C);
    group = C.services[0]?.group;
    $('#app').hidden = false;
    render(); markDirty();
  }

  /* ---------- сохранение ---------- */
  const dirty = () => JSON.stringify(C) !== saved;
  function markDirty() {
    const d = dirty();
    $('#savebar').classList.toggle('dirty', d);
    $('#saveState').textContent = d ? 'Есть несохранённые изменения' : 'Все изменения сохранены';
    $('#saveBtn').disabled = !d;
  }
  $('#saveBtn').onclick = save;
  addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); if (dirty()) save(); } });
  addEventListener('beforeunload', e => { if (C && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  async function save() {
    const json = JSON.stringify(C);
    try {
      if (demo) {
        try { localStorage.setItem(DEMO_KEY, json); }
        catch (e) { throw new Error('В демо не хватает места для фото — удалите пару загруженных'); }
      } else {
        await api('save', C);
      }
      saved = json; markDirty();
      toast('Сохранено. Обновите сайт — изменения уже там');
    } catch (err) { toast(err.message, true); }
  }

  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err);
    t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---------- фото: сжимаем в браузере, потом загружаем ---------- */
  function pickImage() {
    return new Promise(res => {
      const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/jpeg,image/png,image/webp';
      i.onchange = () => res(i.files[0] || null); i.click();
    });
  }
  async function shrink(file, max) {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0, c.width, c.height);
    return new Promise(r => c.toBlob(b => r({ blob: b, url: c.toDataURL('image/jpeg', .8) }), 'image/jpeg', .85));
  }
  async function uploadImage(file) {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) { toast('Нужна картинка JPG, PNG или WebP', true); return null; }
    toast('Загружаю фото…');
    const { blob, url } = await shrink(file, demo ? 900 : 1600);
    if (demo) return url;
    const fd = new FormData(); fd.append('file', blob, 'photo.jpg');
    try { return (await api('upload', fd, true)).path; } catch (e) { toast(e.message, true); return null; }
  }
  const imgSrc = p => !p ? '' : /^(data:|https?:)/.test(p) ? p : '../' + p;

  /* ---------- общее: поля, привязанные к данным ---------- */
  function setPath(path, val) {
    const keys = path.split('.'); let o = C;
    keys.slice(0, -1).forEach(k => { o = o[k]; });
    o[keys.at(-1)] = val;
  }
  function getPath(path) { return path.split('.').reduce((o, k) => o?.[k], C); }
  const field = (label, path, opt = {}) => {
    const v = getPath(path) ?? '';
    const tag = opt.area
      ? `<textarea data-k="${path}" placeholder="${esc(opt.ph || '')}">${esc(v)}</textarea>`
      : `<input data-k="${path}" ${opt.num ? 'data-num inputmode="numeric"' : ''} value="${esc(v)}" placeholder="${esc(opt.ph || '')}">`;
    return `<label${opt.cls ? ` class="${opt.cls}"` : ''}><span>${esc(label)}</span>${tag}</label>`;
  };
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-k]'); if (!el || !C) return;
    let v = el.value;
    if (el.hasAttribute('data-num')) { v = v.replace(/[^\d]/g, ''); el.value = v; v = v === '' ? null : +v; }
    setPath(el.dataset.k, v); markDirty();
  });
  document.addEventListener('input', e => {
    const el = e.target.closest('[data-lines]'); if (!el || !C) return;
    C[el.dataset.lines] = el.value.split('\n').map(s => s.trim()).filter(Boolean); markDirty();
  });
  const move = (arr, i, d) => { const j = i + d; if (j < 0 || j >= arr.length) return; [arr[i], arr[j]] = [arr[j], arr[i]]; };
  const tools = (list, i) => `<div class="tools">
    <button class="icon" data-act="up" data-list="${list}" data-i="${i}" title="Выше">↑</button>
    <button class="icon" data-act="down" data-list="${list}" data-i="${i}" title="Ниже">↓</button>
    <button class="icon icon--del" data-act="del" data-list="${list}" data-i="${i}" title="Удалить">✕</button></div>`;

  document.addEventListener('click', async e => {
    const t = e.target.closest('[data-act]'); if (!t || !C) return;
    const arr = t.dataset.list === 'shopItems' ? C.shop.items : C[t.dataset.list], i = +t.dataset.i;
    const a = t.dataset.act;
    if (a === 'up') move(arr, i, -1);
    if (a === 'down') move(arr, i, 1);
    if (a === 'del') { if (!confirm('Удалить?')) return; arr.splice(i, 1); }
    if (a === 'nophoto') delete arr[i].img;
    if (a === 'photo') {
      const p = await uploadImage(await pickImage()); if (!p) return;
      if (t.dataset.list === 'masters') arr[i].photo = p;
      else if (t.dataset.list === 'perks' || t.dataset.list === 'offers') arr[i].img = p;
      else arr[i].src = p;
    }
    render(); markDirty();
  });

  $('#tabs').onclick = e => {
    const b = e.target.closest('button'); if (!b) return;
    tab = b.dataset.tab; $$('#tabs button').forEach(x => x.classList.toggle('on', x === b));
    render(); scrollTo(0, 0);
  };

  /* ---------- вкладки ---------- */
  function render() { $('#panel').innerHTML = (views[tab] || views.prices)(); bindAfter(); }
  let bindAfter = () => {};

  const views = {
    prices() {
      const groups = [...new Set(C.services.map(s => s.group))];
      if (!groups.includes(group)) group = groups[0];
      bindAfter = () => {
        $$('.gtabs button').forEach(b => b.onclick = () => { group = b.dataset.g; render(); });
        $('#addSvc').onclick = () => {
          const prices = {}; C.levels.forEach(l => prices[l.id] = null);
          C.services.push({ group, name: 'Новая услуга', desc: '', prices }); render(); markDirty();
          $$('.svc').at(-1)?.querySelector('input')?.select();
        };
      };
      const rows = C.services.map((s, i) => {
        if (s.group !== group) return '';
        const single = 'all' in s.prices;
        const priceInputs = single
          ? `<div class="svc__prices" style="grid-template-columns:150px">${field('Цена', `services.${i}.prices.all`, { num: true, cls: 'price' })}</div>`
          : `<div class="svc__prices" style="grid-template-columns:repeat(${C.levels.length},150px)">${C.levels.map(l => field(l.name, `services.${i}.prices.${l.id}`, { num: true, cls: 'price', ph: 'нет' })).join('')}</div>`;
        return `<div class="card"><div class="svc">
          <div>${field('Название', `services.${i}.name`)}<div style="height:10px"></div>${field('Описание (по желанию)', `services.${i}.desc`)}${tools('services', i)}</div>
          ${priceInputs}</div></div>`;
      }).join('');
      return `<h1>Услуги и цены</h1>
        <p class="lead">Меняйте цифры и названия, потом нажмите «Сохранить» внизу. Пустая цена — этой услуги нет у этих мастеров. Калькулятор на сайте пересчитается сам.</p>
        <div class="card"><p class="muted" style="margin-bottom:10px">Колонки цен — кто из мастеров по какому прайсу (так подписан переключатель в калькуляторе)</p>
          <div class="grid2">${C.levels.map((l, k) => field(`Прайс ${k + 1}`, `levels.${k}.name`)).join('')}</div></div>
        <div class="gtabs">${groups.map(g => `<button data-g="${esc(g)}" class="${g === group ? 'on' : ''}">${esc(g)}</button>`).join('')}</div>
        ${rows}<button class="add" id="addSvc">+ Добавить услугу в «${esc(group)}»</button>`;
    },

    masters() {
      bindAfter = () => {
        $('#addM').onclick = () => { C.masters.push({ name: 'Имя', role: 'Барбер', photo: '', reviews: 0, bio: '', yc_id: '' }); render(); markDirty(); };
      };
      return `<h1>Мастера</h1><p class="lead">Фото, имя, должность и пара слов о себе. Номер в YClients нужен, чтобы кнопка «Записаться» сразу открывала этого мастера.</p>
        ${C.masters.map((m, i) => `<div class="card mst">
          <div class="ph">${m.photo ? `<img src="${esc(imgSrc(m.photo))}" alt="">` : ''}<button class="ph__btn" data-act="photo" data-list="masters" data-i="${i}">Сменить фото</button></div>
          <div>
            <div class="grid2">${field('Имя', `masters.${i}.name`)}${field('Должность', `masters.${i}.role`)}${field('Отзывов', `masters.${i}.reviews`, { num: true })}${field('Номер в YClients', `masters.${i}.yc_id`, { num: true, ph: 'необязательно' })}</div>
            <div style="height:10px"></div><label><span>Прайс мастера (вкладка в калькуляторе)</span><select data-k="masters.${i}.level"><option value="">не показывать в калькуляторе</option>${C.levels.map(l => `<option value="${esc(l.id)}"${m.level === l.id ? ' selected' : ''}>${esc(l.name)}</option>`).join('')}</select></label>
            <div style="height:10px"></div>${field('О себе', `masters.${i}.bio`, { area: true })}
            <div style="height:10px"></div><div class="grid2">${field('Цитата из отзыва (видна при наведении)', `masters.${i}.quote`)}${field('Чей отзыв', `masters.${i}.quote_author`)}</div>
            ${tools('masters', i)}
          </div></div>`).join('')}
        <button class="add" id="addM">+ Добавить мастера</button>`;
    },

    gallery() {
      bindAfter = () => {
        const d = $('#drop');
        d.onclick = async () => add(await pickImage());
        d.ondragover = e => { e.preventDefault(); d.classList.add('over'); };
        d.ondragleave = () => d.classList.remove('over');
        d.ondrop = async e => { e.preventDefault(); d.classList.remove('over'); for (const f of e.dataTransfer.files) await add(f); };
        async function add(f) { const p = await uploadImage(f); if (p) { C.gallery.push({ src: p, alt: '' }); render(); markDirty(); } }
        $$('[data-bg]').forEach(b => b.onclick = async () => {
          const k = b.dataset.bg;
          if (b.dataset.off) { delete C.backgrounds[k]; render(); markDirty(); return; }
          const p = await uploadImage(await pickImage()); if (p) { C.backgrounds[k] = p; render(); markDirty(); }
        });
      };
      C.backgrounds ||= {};
      const BG = { about: 'О нас (крупный текст)', masters: 'Мастера', reviews: 'Отзывы', contacts: 'Контакты' };
      return `<h1>Фото</h1><p class="lead">Лента фото на сайте. Перетащите снимки сюда или нажмите на рамку. Большие фото сожмутся сами.</p>
        <div class="gal">${C.gallery.map((g, i) => `<div class="card">
          <div class="ph"><img src="${esc(imgSrc(g.src))}" alt=""></div>
          ${field('Подпись', `gallery.${i}.alt`)}${tools('gallery', i)}</div>`).join('')}
          <div class="drop" id="drop">+ Добавить фото<br><span class="muted">или перетащите сюда</span></div></div>
        <h1 style="margin-top:40px">Фоны блоков</h1><p class="lead">Фото за текстом в четырёх блоках. На сайте оно сильно затемняется, чтобы текст читался.</p>
        <div class="gal">${Object.entries(BG).map(([k, name]) => `<div class="card">
          <div class="ph">${C.backgrounds[k] ? `<img src="${esc(imgSrc(C.backgrounds[k]))}" alt="">` : '<span class="muted" style="display:grid;place-items:center;height:100%">чёрный фон</span>'}</div>
          <p><b>${name}</b></p>
          <div class="tools"><button class="btn btn--sm" data-bg="${k}">${C.backgrounds[k] ? 'Сменить' : 'Добавить'}</button>${C.backgrounds[k] ? `<button class="btn btn--sm btn--ghost" data-bg="${k}" data-off="1">Убрать</button>` : ''}</div></div>`).join('')}</div>`;
    },

    offers() {
      C.shop ||= { title: 'Косметика и подарочные наборы', text: '', items: [] };
      bindAfter = () => {
        $('#addO').onclick = () => { C.offers.push({ title: 'Новая акция', price: null, text: '' }); render(); markDirty(); };
        $('#addPr').onclick = () => { C.promos.push({ big: '10%', title: 'Новая акция', text: '', kind: '' }); render(); markDirty(); };
        $('#shopDrop').onclick = async () => { const p = await uploadImage(await pickImage()); if (p) { C.shop.items.push({ src: p, alt: '' }); render(); markDirty(); } };
      };
      C.promos ||= [];
      return `<h1>Акции</h1><p class="lead">Блок «Акции» на сайте: скидки и кэшбэк. Крупная цифра — то, что видно первым.</p>
        ${C.promos.map((o, i) => `<div class="card"><div class="grid2">${field('Крупно (например, 20%)', `promos.${i}.big`)}${field('Название', `promos.${i}.title`)}</div>
          <div style="height:10px"></div>${field('Текст', `promos.${i}.text`, { area: true })}${tools('promos', i)}</div>`).join('')}
        <button class="add" id="addPr">+ Добавить акцию</button>
        <h1 style="margin-top:40px">Абонементы и сертификаты</h1><p class="lead">Цену можно не указывать.</p>
        ${C.offers.map((o, i) => `<div class="card mst">
          <div class="ph">${o.img ? `<img src="${esc(imgSrc(o.img))}" alt="">` : '<span class="muted" style="display:grid;place-items:center;height:100%">без фото</span>'}<button class="ph__btn" data-act="photo" data-list="offers" data-i="${i}">${o.img ? 'Сменить' : 'Добавить'} фото</button></div>
          <div><div class="grid2">${field('Название', `offers.${i}.title`)}${field('Цена', `offers.${i}.price`, { num: true, ph: 'без цены' })}</div>
          <div style="height:10px"></div>${field('Текст', `offers.${i}.text`, { area: true })}${tools('offers', i)}${o.img ? `<button class="btn btn--sm btn--ghost" style="margin-top:8px" data-act="nophoto" data-list="offers" data-i="${i}">Убрать фото</button>` : ''}</div></div>`).join('')}
        <button class="add" id="addO">+ Добавить абонемент или сертификат</button>
        <h1 style="margin-top:40px">Витрина</h1><p class="lead">Косметика и наборы под абонементами.</p>
        <div class="card"><div class="grid2">${field('Заголовок', 'shop.title')}${field('Текст', 'shop.text')}</div></div>
        <div class="gal">${(C.shop?.items || []).map((g, i) => `<div class="card"><div class="ph"><img src="${esc(imgSrc(g.src))}" alt=""></div>${field('Подпись', `shop.items.${i}.alt`)}
          <div class="tools"><button class="icon" data-act="up" data-list="shopItems" data-i="${i}">↑</button><button class="icon" data-act="down" data-list="shopItems" data-i="${i}">↓</button><button class="icon icon--del" data-act="del" data-list="shopItems" data-i="${i}">✕</button></div></div>`).join('')}
          <div class="drop" id="shopDrop">+ Фото товара</div></div>`;
    },

    reviews() {
      bindAfter = () => { $('#addR').onclick = () => { C.reviews.unshift({ author: '', date: '', master: '', source: '', text: '' }); render(); markDirty(); }; };
      return `<h1>Отзывы</h1><p class="lead">Копируйте настоящие отзывы из 2ГИС или Яндекса. Цифры рейтинга — во вкладке «Контакты».</p>
        <button class="add" id="addR" style="margin:0 0 12px">+ Добавить отзыв</button>
        ${C.reviews.map((r, i) => `<div class="card"><div class="grid2">${field('Имя', `reviews.${i}.author`)}${field('Дата', `reviews.${i}.date`, { ph: '12 октября 2026' })}${field('Мастер', `reviews.${i}.master`, { ph: 'необязательно' })}${field('Откуда', `reviews.${i}.source`, { ph: '2ГИС, Яндекс, YClients' })}</div>
          <div style="height:10px"></div>${field('Текст отзыва', `reviews.${i}.text`, { area: true })}${tools('reviews', i)}</div>`).join('')}`;
    },

    perks() {
      C.perks = C.perks.map(p => typeof p === 'string' ? { title: p, text: '', img: '' } : p);
      bindAfter = () => { $('#addP').onclick = () => { C.perks.push({ title: 'Новый пункт', text: '', img: '' }); render(); markDirty(); }; };
      return `<h1>Сервис</h1><p class="lead">Блок «Больше, чем стрижка»: у каждого пункта своё фото, оно меняется на сайте при прокрутке.</p>
        ${C.perks.map((p, i) => `<div class="card mst">
          <div class="ph">${p.img ? `<img src="${esc(imgSrc(p.img))}" alt="">` : ''}<button class="ph__btn" data-act="photo" data-list="perks" data-i="${i}">Сменить фото</button></div>
          <div>${field('Заголовок', `perks.${i}.title`)}<div style="height:10px"></div>${field('Текст', `perks.${i}.text`, { area: true })}${tools('perks', i)}</div></div>`).join('')}
        <button class="add" id="addP">+ Добавить пункт</button>`;
    },

    contacts() {
      bindAfter = () => {};
      C.legal ||= { operator: '', inn: '', ogrn: '', address: '', email: '', date: '' };
      const b = 'brand';
      return `<h1>Контакты</h1><p class="lead">Всё, что видно в шапке, в подвале и на карте.</p>
        <div class="card"><div class="grid2">
          ${field('Слоган', `${b}.tagline`)}${field('Лет работаем', `${b}.years`, { num: true })}
          ${field('Адрес', `${b}.address`)}${field('Часы работы', `${b}.hours`)}
          ${field('Телефон', `${b}.phone`)}${field('Второй телефон', `${b}.phone2`)}
          ${field('Почта', `${b}.email`)}${field('Ссылка на онлайн-запись (YClients)', `${b}.booking_url`)}
        </div></div>
        <div class="card"><div class="grid2">
          ${field('Telegram-канал', `${b}.telegram`)}${field('Telegram администратора', `${b}.telegram_admin`)}
          ${field('ВКонтакте', `${b}.vk`)}${field('WhatsApp', `${b}.whatsapp`)}
          ${field('Приложение в App Store', `${b}.app_ios`)}${field('Приложение в Google Play / RuStore', `${b}.app_android`, { ph: 'если есть' })}
        </div></div>
        <div class="card"><p class="muted" style="margin-bottom:10px">О нас</p>
          ${field('Заголовок', 'about.title')}<div style="height:10px"></div>${field('Текст на фото зала', 'about.lead', { area: true })}
          <div style="height:10px"></div>${field('Крупный текст', 'about.manifest', { area: true })}
          <div style="height:10px"></div>${field('Текст под ним', 'about.text', { area: true })}</div>
        <div class="card"><p class="muted" style="margin-bottom:10px">Что можно в приложении (каждый пункт с новой строки)</p>
          <textarea data-lines="app_features" rows="8">${esc((C.app_features || []).join('\n'))}</textarea></div>
        <div class="card"><p class="muted" style="margin-bottom:10px">Рейтинг и цифры на сайте</p><div class="grid3">
          ${field('Оценка в 2ГИС', 'stats.rating')}${field('Оценок в 2ГИС', 'stats.ratings_count', { num: true })}${field('Отзывов в 2ГИС', 'stats.reviews_count', { num: true })}
          ${field('Оценок в YClients', 'stats.yc_ratings', { num: true })}${field('Из них пятёрок', 'stats.yc_five', { num: true })}${field('Клиентов (текстом)', 'stats.clients', { ph: '6 500+' })}
        </div></div>
        <div class="card"><p class="muted" style="margin-bottom:10px">Юридические данные — для страницы «Политика конфиденциальности» (152-ФЗ). Заполните до запуска сайта.</p><div class="grid2">
          ${field('Владелец (ИП или ООО полностью)', 'legal.operator', { ph: 'например: ИП Фамилия Имя Отчество' })}${field('ИНН', 'legal.inn')}
          ${field('ОГРН / ОГРНИП', 'legal.ogrn')}${field('Юридический адрес', 'legal.address')}
          ${field('Почта для вопросов о данных', 'legal.email')}${field('Дата редакции политики', 'legal.date', { ph: '17.10.2026' })}
          ${field('Номер счётчика Яндекс Метрики', 'brand.metrika_id', { ph: 'только цифры, если подключена' })}
        </div></div>`;
    },

    settings() {
      bindAfter = () => {
        if (demo) return;
        $('#pwForm').onsubmit = async e => {
          e.preventDefault();
          try { await api('password', { old: $('#pwOld').value, new: $('#pwNew').value }); toast('Пароль изменён'); e.target.reset(); }
          catch (err) { toast(err.message, true); }
        };
        api('backups', {}).then(r => {
          $('#bk').innerHTML = r.items.length ? r.items.map(x => `<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
            <span>${esc(x.name.replace('content-', '').replace('.json', '').replace('_', ' в ').replace(/-(\d\d)-(\d\d)$/, ':$1:$2'))}</span>
            <button class="btn btn--sm btn--ghost" data-restore="${esc(x.name)}">Вернуть эту версию</button></div>`).join('') : '<p class="muted">Копий пока нет — они появятся после первого сохранения.</p>';
          $$('[data-restore]').forEach(b => b.onclick = async () => {
            if (!confirm('Вернуть сайт к этой версии? Текущая тоже сохранится в копиях.')) return;
            try { await api('restore', { name: b.dataset.restore }); toast('Версия восстановлена'); start(); } catch (err) { toast(err.message, true); }
          });
        }).catch(err => { $('#bk').textContent = err.message; });
      };
      if (demo) return `<h1>Настройки</h1><p class="lead">На настоящем хостинге здесь смена пароля и резервные копии: перед каждым сохранением сайт сам делает копию, последние 30 можно вернуть одной кнопкой.</p>`;
      return `<h1>Настройки</h1>
        <div class="card"><p class="muted" style="margin-bottom:12px">Сменить пароль</p>
          <form id="pwForm" class="grid2">
            <label>Старый пароль<input type="password" id="pwOld" required autocomplete="current-password"></label>
            <label>Новый пароль (от 8 символов)<input type="password" id="pwNew" required minlength="8" autocomplete="new-password"></label>
            <div class="row"><button class="btn btn--main" type="submit">Сменить</button></div>
          </form></div>
        <div class="card"><p class="muted" style="margin-bottom:6px">Резервные копии</p>
          <p class="muted" style="margin-bottom:12px">Перед каждым сохранением сайт делает копию. Если что-то пошло не так — верните прошлую версию.</p>
          <div id="bk">Загружаю…</div></div>`;
    }
  };
})();
