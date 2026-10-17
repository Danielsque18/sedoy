(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const rub = n => n.toLocaleString('ru-RU') + ' ₽';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const url = u => /^(https?:\/\/|tel:|mailto:)/i.test(String(u || '').trim()) ? esc(u) : '#';
  const tel = p => 'tel:' + String(p).replace(/[^\d+]/g, '');
  const DEMO_KEY = 'sedoy_demo_content';
  // склонение: 1 оценка, 2 оценки, 5 оценок
  const pl = (n, f) => { n = Math.abs(parseInt(String(n).replace(/\D/g, ''), 10) || 0) % 100; const d = n % 10; return n > 10 && n < 20 ? f[2] : d === 1 ? f[0] : d >= 2 && d <= 4 ? f[1] : f[2]; };
  // буквы SEDOY из их логотипа (SEDOY_logotype-black-RU.pdf)
  const NEON_LETTERS = ["M56.62 45.29H45.3C42.13 45.29 39.45 46.39 37.26 48.58 35.07 50.77 33.97 53.45 33.97 56.62V79.27C33.97 82.44 35.07 85.12 37.26 87.31 39.45 89.5 42.13 90.59 45.3 90.59H56.62V113.24H45.3V101.91H33.97V113.24C33.97 116.41 35.07 119.09 37.26 121.28 39.45 123.47 42.13 124.56 45.3 124.56H56.62C59.79 124.56 62.47 123.47 64.66 121.28 66.85 119.09 67.95 116.41 67.95 113.24V90.59C67.95 87.42 66.85 84.74 64.66 82.55 62.47 80.36 59.79 79.27 56.62 79.27H45.3V56.62H56.62V67.94H67.95V56.62C67.95 53.45 66.85 50.77 64.66 48.58 62.47 46.39 59.79 45.29 56.62 45.29", "M79.27 124.56H113.24V113.24H90.59V90.59H107.58V79.27H90.59V56.62H113.24V45.29H79.27Z", "M147.21 113.24H135.89V56.62H147.21ZM147.21 45.29H124.56V124.56H147.21C150.38 124.56 153.06 123.47 155.25 121.28 157.44 119.09 158.54 116.41 158.54 113.24V56.62C158.54 53.45 157.44 50.77 155.25 48.58 153.06 46.39 150.38 45.29 147.21 45.29", "M192.51 113.24H181.18V56.62H192.51ZM192.51 45.29H181.18C178.01 45.29 175.33 46.39 173.14 48.58 170.95 50.77 169.86 53.45 169.86 56.62V113.24C169.86 116.41 170.95 119.09 173.14 121.28 175.33 123.47 178.01 124.56 181.18 124.56H192.51C195.68 124.56 198.36 123.47 200.55 121.28 202.74 119.09 203.83 116.41 203.83 113.24V56.62C203.83 53.45 202.74 50.77 200.55 48.58 198.36 46.39 195.68 45.29 192.51 45.29", "M240.13 45.28 234.28 70.6 232.25 84.89H232.06L230.02 70.6 224.17 45.28H212.53L226.49 105.7V124.56H237.81V105.71L251.74 45.28Z"];

  // В демо админка сохраняет черновик в браузере — сайт показывает его.
  async function loadContent() {
    let base = null;
    try {
      const r = await fetch('data/content.json?v=' + Date.now(), { cache: 'no-store' });
      if (r.ok) base = await r.json();
    } catch (e) {}
    base ||= window.SEDOY_SEED; // открыли файлом без сервера
    if (window.SEDOY_DEMO) {
      try { const d = localStorage.getItem(DEMO_KEY); if (d) return upgradeDraft(JSON.parse(d), base); } catch (e) {}
    }
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

  hero(); // вывеска и свет не ждут данных
  loadContent().then(render).catch(e => console.error('content', e));

  function render(C) {
    const B = C.brand, S = C.stats;
    const bind = {
      years: B.years, tagline: B.tagline, address: B.address, hours: B.hours,
      rating: S.rating, ratings_count: S.ratings_count, reviews_count: S.reviews_count, clients: S.clients || '', parking: B.parking || '',
      years_word: pl(B.years, ['год', 'года', 'лет']), ratings_word: pl(S.ratings_count, ['оценка', 'оценки', 'оценок']),
      reviews_word: pl(S.reviews_count, ['отзыв', 'отзыва', 'отзывов']), yc_word: pl(S.yc_ratings, ['оценка', 'оценки', 'оценок'])
    };
    $$('[data-bind]').forEach(el => {
      const k = el.dataset.bind;
      if (k === 'phone-link') { el.href = tel(B.phone); if (!el.classList.contains('mbar__call')) el.textContent = B.phone; }
      else if (k === 'phone2-link') { el.href = tel(B.phone2); el.textContent = B.phone2; }
      else if (k in bind) el.textContent = bind[k];
    });
    $('#year').textContent = new Date().getFullYear();
    // кнопку «Редактировать сайт» видит только тот, кто входил в админку с этого устройства
    try { const u = localStorage.getItem('sedoy_admin_url'); if (u && /^https?:|^file:/.test(u)) { const c = $('#ownerChip'); c.href = u; c.hidden = false; } } catch (e) {}
    extras(B);

    openNowDot();
    hall();
    counters(S);
    about(C);
    calculator(C);
    masters(C, B);
    gallery(C);
    perks(C);
    shop(C);
    promos(C);
    offers(C);
    reviews(C);
    app(B, C);
    contacts(B);
    cookies(B);
    backgrounds(C);
    booking(B);
    reveal();
  }

  /* ---------- Hero: потолок из LED-рамок и неоновая вывеска ---------- */
  function hero() {
    // Потолок зала: сетка светящихся LED-рамок, честная перспектива
    const svg = $('#ceiling');
    const NS = 'http://www.w3.org/2000/svg';
    const COLS = 7, ROWS = 14, SX = 3.2, SZ = 2.4, W = 2.3, D = 1.4, H = 1.6;
    const cells = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const g = document.createElementNS(NS, 'g');
      g.innerHTML = '<polygon class="halo"/><polygon class="tube"/>';
      g.style.opacity = 0;
      svg.appendChild(g);
      cells.push({ g, c: c - (COLS - 1) / 2, r, lit: 0 });
    }
    // включаем свет волной от дальних рядов к ближним
    cells.slice().sort((a, b) => (b.r - a.r) || (Math.abs(a.c) - Math.abs(b.c)))
      .forEach((cell, i) => setTimeout(() => flickerCell(cell), 150 + i * 14 + Math.random() * 120));
    function flickerCell(cell) {
      [0, 50, 100, 170, 240].forEach((t, i) => setTimeout(() => { cell.lit = i % 2 === 0 || i === 4 ? 1 : .15; }, t));
    }

    let mx = 0, scrollZ = 0;
    const nav = $('#nav');
    function frame() {
      const w = innerWidth, h = svg.clientHeight || innerHeight;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const f = Math.max(w, 700) * .62, cx = w / 2 + mx * 60, cy = h * .56;
      const span = ROWS * SZ;
      const off = scrollZ % SZ;
      for (const cell of cells) {
        let z = cell.r * SZ + 1.2 - off;
        if (z < .6) z += span;
        const x0 = cell.c * SX - W / 2, x1 = x0 + W, z0 = z, z1 = z + D;
        const P = (x, zz) => `${(cx + f * x / zz).toFixed(1)},${(cy - f * H / zz).toFixed(1)}`;
        const pts = `${P(x0, z0)} ${P(x1, z0)} ${P(x1, z1)} ${P(x0, z1)}`;
        cell.g.firstChild.setAttribute('points', pts);
        cell.g.lastChild.setAttribute('points', pts);
        const fade = Math.min(1, (z - .6) / 1.5) * Math.max(0, 1 - z / span);
        cell.g.style.opacity = (cell.lit * fade).toFixed(3);
      }
    }
    let raf = null;
    const tick = () => { raf = null; nav.classList.toggle('is-solid', scrollY > 40); scrollZ = scrollY / 90; frame(); };
    const req = () => { raf ||= requestAnimationFrame(tick); };
    addEventListener('scroll', req, { passive: true });
    addEventListener('resize', req);
    addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; req(); }, { passive: true });
    // пока свет «включается», перерисовываем каждый кадр
    const t0 = performance.now();
    (function boot() { frame(); if (performance.now() - t0 < 3200) requestAnimationFrame(boot); })();

    // буквы фирменного логотипа SEDOY (контуры из их PDF), каждая загорается отдельно
    const neon = $('#neon');
    neon.innerHTML = `<svg viewBox="30 40 226 90" fill-rule="evenodd">${NEON_LETTERS.map(d => `<path d="${d}"/>`).join('')}</svg>`;
    $$('path', neon).forEach((s, i) => setTimeout(() => flicker(s, 'lit'), 900 + i * 230 + Math.random() * 200));
    // буква «O» иногда моргает, как настоящая вывеска
    setInterval(() => {
      const s = $$('path', neon)[3]; if (!s) return;
      s.classList.remove('lit'); setTimeout(() => s.classList.add('lit'), 90);
      setTimeout(() => s.classList.remove('lit'), 180); setTimeout(() => s.classList.add('lit'), 260);
    }, 6500);
  }
  function flicker(el, cls) {
    const steps = [0, 60, 110, 170, 260];
    steps.forEach((t, i) => setTimeout(() => el.classList.toggle(cls, i % 2 === 0 || i === steps.length - 1), t));
  }

  // время Омска (UTC+6): «Открыто до 21:00» / «Откроемся в 10:00»
  function omskNow() { return new Date(Date.now() + (6 * 60 + new Date().getTimezoneOffset()) * 60000); }
  function openNowDot() {
    const now = omskNow(), h = now.getHours() + now.getMinutes() / 60;
    const open = h >= 10 && h < 21;
    $('.hero__kicker .dot')?.classList.toggle('closed', !open);
    $('#openNow').textContent = open ? 'Открыто до 21:00' : 'Откроемся в 10:00';
    const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
    $('#today').innerHTML = `Сегодня, ${days[now.getDay()]}: <b class="${open ? '' : 'closed'}">${open ? 'открыто' : 'закрыто'}</b>`;
  }

  /* ---------- Настоящий зал: фото «наезжает» и светлеет при прокрутке ---------- */
  function hall() {
    const sec = $('#about'), img = $('.hall__img img', sec);
    const on = () => {
      const r = sec.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / (r.height - innerHeight)));
      img.style.setProperty('--hs', (1.25 - p * .25).toFixed(3));
      img.style.setProperty('--hb', (.5 + Math.min(p * 1.6, 1) * .45).toFixed(3));
    };
    addEventListener('scroll', on, { passive: true }); on();
  }

  /* ---------- Цифры считаются, когда попадают на экран ---------- */
  function counters(S) {
    $$('[data-count]').forEach(el => {
      const to = +S[el.dataset.count] || 0;
      el.textContent = to.toLocaleString('ru-RU');
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return; io.disconnect();
        const t0 = performance.now();
        const step = t => { const k = Math.min(1, (t - t0) / 1400); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))).toLocaleString('ru-RU'); if (k < 1) requestAnimationFrame(step); };
        requestAnimationFrame(step);
      }, { threshold: .6 });
      io.observe(el);
    });
  }

  /* ---------- О нас: текст «седеет» по мере чтения ---------- */
  function about(C) {
    const A = C.about || {};
    $('#aboutTitle').textContent = A.title || '';
    $('#aboutLead').textContent = A.lead || '';
    $('#aboutText').textContent = A.text || '';
    $('#manifest').innerHTML = String(A.manifest || '').trim().split(/\s+/).map(w => `<span class="w">${esc(w)}</span> `).join('');
  }

  /* ---------- Цены + калькулятор ---------- */
  function calculator(C) {
    const levels = C.levels;
    // вкладки — конкретные мастера (у каждого свой прайс); если мастерам прайс не назначен — столбцы прайса
    const tabs = C.masters.filter(m => levels.some(l => l.id === m.level))
      .map(m => ({ id: 'm' + (m.yc_id || m.name), name: m.name, level: m.level, yc: m.yc_id }));
    if (!tabs.length) levels.forEach(l => tabs.push({ id: l.id, name: l.name, level: l.id, yc: null }));
    let tab = tabs[0];
    let level = tab.level;
    const groups = [...new Set(C.services.map(s => s.group))];
    let group = groups[0];
    const picked = new Map(); // name -> service

    const priceOf = s => s.prices.all ?? s.prices[level];

    $('#levels').innerHTML = tabs.map(l => `<button role="tab" data-l="${esc(l.id)}">${esc(l.name)}</button>`).join('');
    $('#groups').innerHTML = groups.map(g => `<button data-g="${esc(g)}">${esc(g)}</button>`).join('');

    $('#levels').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      tab = tabs.find(x => x.id === b.dataset.l) || tab; level = tab.level; draw(true);
    };
    $('#groups').onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      group = b.dataset.g; draw();
    };
    $('#svcList').onclick = e => {
      const li = e.target.closest('li'); if (!li || li.classList.contains('na')) return;
      const s = C.services[+li.dataset.i];
      picked.has(s.name) ? picked.delete(s.name) : picked.set(s.name, s);
      draw();
    };
    $('#ticketClear').onclick = () => { picked.clear(); draw(); };

    // большое фото над списком: фото вкладки, при наведении или выборе — фото услуги, если оно есть
    const GP = C.group_photos || {};
    const ph = $('#calcPhoto');
    const srcs = [...new Set([...Object.values(GP), ...C.services.map(s => s.img)].filter(Boolean))];
    ph.insertAdjacentHTML('afterbegin', srcs.map(s => `<img src="${esc(s)}" alt="" data-src="${esc(s)}" loading="lazy">`).join(''));
    if (!srcs.length) ph.remove();
    const photo = (src, cap) => {
      $$('img', ph).forEach(i => i.classList.toggle('on', i.dataset.src === src));
      $('#calcCap').textContent = cap;
    };
    const groupPhoto = () => {
      const last = [...picked.values()].reverse().find(s => s.group === group && s.img);
      last ? photo(last.img, last.name) : photo(GP[group] || C.services.find(s => s.group === group && s.img)?.img, group);
    };
    $('#svcList').onmouseover = e => { const li = e.target.closest('li'); const s = li && C.services[+li.dataset.i]; if (s?.img) photo(s.img, s.name); };
    $('#svcList').onmouseleave = groupPhoto;

    function draw(bump) {
      $$('#levels button').forEach(b => b.setAttribute('aria-selected', b.dataset.l === tab.id));
      $$('#groups button').forEach(b => b.classList.toggle('is-on', b.dataset.g === group));
      $('#svcList').innerHTML = C.services.map((s, i) => {
        if (s.group !== group) return '';
        const p = priceOf(s);
        const na = p == null;
        return `<li data-i="${i}" class="${picked.has(s.name) ? 'sel' : ''} ${na ? 'na' : ''}">
          <span class="svc__chk">✓</span>
          <span class="svc__name">${esc(s.name)}${s.desc ? `<span class="svc__desc">${esc(s.desc)}</span>` : ''}</span>
          <span class="svc__price${bump ? ' bump' : ''}">${na ? '—' : rub(p)}</span></li>`;
      }).join('');

      // убираем из чека то, чего нет у выбранного уровня
      for (const [k, s] of picked) if (priceOf(s) == null) picked.delete(k);
      groupPhoto();
      $('#ticketLevel').textContent = tab.name;
      const items = [...picked.values()];
      bookLink(tab, items);
      $('#ticketItems').innerHTML = items.length
        ? items.map(s => `<li><span>${esc(s.name)}</span><b>${rub(priceOf(s))}</b></li>`).join('')
        : '<li class="ticket__empty">Пока пусто — выберите услуги</li>';
      const total = items.reduce((a, s) => a + priceOf(s), 0);
      countTo($('#ticketTotal'), total);
      $('#mbarBtn').textContent = total ? `Записаться · ${rub(total)}` : 'Записаться';
      $('#ticketNo').textContent = String(1000 + items.length * 37 + total % 997).padStart(4, '0');

      // подсказка про абонемент
      const sub = C.offers.find(o => /стрижк/i.test(o.title) && o.price);
      const hasCut = items.some(s => /^Мужская стрижка/.test(s.name));
      const cutPrice = hasCut ? priceOf(items.find(s => /^Мужская стрижка/.test(s.name))) : 0;
      $('#ticketHint').textContent = (sub && hasCut)
        ? `С абонементом 10+1 стрижка выходит ${rub(Math.round(sub.price / 11))} вместо ${rub(cutPrice)}`
        : '';
    }
    draw();
  }

  // ссылка записи из калькулятора: мастер и услуги уже выбраны в YClients (формат o=m<мастер>s<услуга>s<услуга>)
  let calcLink = '';
  function bookLink(tab, items) {
    const svc = items.map(s => s.yc && (s.yc.all ?? s.yc[tab.level])).filter(Boolean);
    if (!svc.length) { calcLink = ''; return; }
    // маникюр делают другие мастера — с ним барбера не подставляем
    const onlyTab = items.every(s => !s.prices.all);
    calcLink = (onlyTab && tab.yc ? 'm' + tab.yc : '') + svc.map(id => 's' + id).join('');
  }

  function countTo(el, to) {
    const from = +(el.dataset.v || 0); el.dataset.v = to;
    const t0 = performance.now();
    const step = t => { const k = Math.min(1, (t - t0) / 380); el.textContent = rub(Math.round(from + (to - from) * (1 - Math.pow(1 - k, 3)))); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- Мастера ---------- */
  function masters(C, B) {
    const plural = n => n % 10 === 1 && n % 100 !== 11 ? 'отзыв' : (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'отзыва' : 'отзывов');
    $('#mastersGrid').innerHTML = C.masters.map(m => `
      <article class="mcard reveal" tabindex="0" data-master="${esc(m.yc_id || '')}">
        <div class="mcard__ph led-frame">
          <img src="${esc(m.photo)}" alt="${esc(m.name)}, ${esc(m.role)}" loading="lazy">
          ${m.quote ? `<p class="mcard__quote">«${esc(m.quote)}»<small>— ${esc(m.quote_author || 'клиент')}, отзыв</small></p>` : (m.bio ? `<p class="mcard__quote">${esc(m.bio)}</p>` : '')}
        </div>
        <div class="mcard__info">
          <div class="mcard__name">${esc(m.name)}</div>
          <div class="mcard__role">${esc(m.role)}</div>
          ${m.reviews ? `<div class="mcard__rev"><span class="stars">★★★★★</span> ${m.reviews} ${plural(m.reviews)}</div>` : ''}
          <span class="mcard__book">Записаться →</span>
        </div>
      </article>`).join('');
  }

  /* ---------- Сервис: фото слева меняется под пункт, который сейчас в центре экрана ---------- */
  function perks(C) {
    const list = C.perks.map(p => typeof p === 'string' ? { title: p, text: '', img: '' } : p);
    $('#perks').innerHTML = list.map((p, i) => `<li data-i="${i}">
      ${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}
      <h3>${esc(p.title)}</h3>${p.text ? `<p>${esc(p.text)}</p>` : ''}</li>`).join('');
    const frame = $('#perksFrame');
    frame.innerHTML = list.map((p, i) => p.img ? `<img src="${esc(p.img)}" alt="${esc(p.title)}" data-i="${i}" loading="lazy">` : '').join('');
    const items = $$('#perks li');
    let cur = -1;
    const pick = () => {
      const mid = innerHeight * .5;
      let best = 0, bd = 1e9;
      items.forEach((li, i) => { const r = li.getBoundingClientRect(); const d = Math.abs(r.top + r.height / 2 - mid); if (d < bd) { bd = d; best = i; } });
      if (best === cur) return; cur = best;
      items.forEach((li, i) => li.classList.toggle('on', i === best));
      let shown = false;
      $$('img', frame).forEach(img => { const on = +img.dataset.i === best; img.classList.toggle('on', on); shown ||= on; });
      if (!shown) $$('img', frame)[0]?.classList.add('on');
    };
    addEventListener('scroll', pick, { passive: true }); pick();
  }

  function shop(C) {
    const sh = C.shop; if (!sh || !sh.items?.length) { $('.shop')?.remove(); return; }
    $('#shopTitle').textContent = sh.title; $('#shopText').textContent = sh.text;
    $('#shopTrack').innerHTML = sh.items.map(it => `<figure class="led-frame"><img src="${esc(it.src)}" alt="${esc(it.alt)}" loading="lazy"></figure>`).join('');
  }

  /* ---------- Галерея: лента едет при прокрутке ---------- */
  function gallery(C) {
    const t = $('#gallery');
    t.innerHTML = C.gallery.map(g => `<figure><img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy"></figure>`).join('');
    const sec = t.parentElement;
    const move = () => {
      const r = sec.getBoundingClientRect();
      const p = (innerHeight - r.top) / (innerHeight + r.height);
      const max = Math.max(0, t.scrollWidth - innerWidth + 32);
      t.style.transform = `translateX(${16 - Math.min(1, Math.max(0, p)) * max}px)`;
    };
    addEventListener('scroll', move, { passive: true }); addEventListener('resize', move); move();
  }

  /* ---------- Акции ---------- */
  function promos(C) {
    const list = C.promos || [];
    if (!list.length) { $('#promo')?.remove(); $('a[href="#promo"]')?.remove(); return; }
    const visual = p => {
      if (p.kind === 'bday') {
        // полоса из 15 дней: 7 до, день рождения, 7 после — дни загораются по очереди
        return `<div class="days" aria-hidden="true">${Array.from({ length: 15 }, (_, i) => `<i style="--d:${i}" class="${i === 7 ? 'bd' : ''}">${i === 7 ? '★' : ''}</i>`).join('')}</div>
          <div class="days__cap"><span>−7 дней</span><span>день рождения</span><span>+7 дней</span></div>`;
      }
      if (p.kind === 'cash') {
        return `<div class="coins" aria-hidden="true">${'<i></i>'.repeat(6)}</div>`;
      }
      return '';
    };
    $('#promoGrid').innerHTML = list.map(p => `<article class="pcard led-frame reveal pcard--${esc(p.kind || 'plain')}">
      <div class="pcard__big">${esc(p.big || '')}</div>
      <div class="pcard__body"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p>${visual(p)}</div>
    </article>`).join('');
  }

  function offers(C) {
    $('#offersGrid').innerHTML = C.offers.map(o => {
      const isCert = !o.price;
      let save = '';
      if (o.price && /стрижк/i.test(o.title)) save = `≈ ${rub(Math.round(o.price / 11))} за стрижку`;
      if (o.price && /бород/i.test(o.title)) save = `≈ ${rub(Math.round(o.price / 11))} за визит`;
      const certs = isCert ? (o.text.match(/\d{4}/g) || []) : [];
      const inner = `<h3>${esc(o.title)}</h3><p>${esc(o.text)}</p>
        ${isCert ? `<div class="offer__chips">${certs.map(c => `<span>${(+c).toLocaleString('ru-RU')}</span>`).join('')}</div>`
                 : `${/10\s*\+\s*1/.test(o.title) ? `<div class="punch" aria-hidden="true">${'<i></i>'.repeat(10)}<i class="gift">+1</i></div>` : ''}<div class="offer__price">${rub(o.price)}</div><div class="offer__save">${save}</div>`}`;
      return o.img
        ? `<div class="offer offer--img led-frame reveal"><img src="${esc(o.img)}" alt="${esc(o.title)}" loading="lazy"><div class="offer__in">${inner}</div></div>`
        : `<div class="offer led-frame reveal">${inner}</div>`;
    }).join('');
  }

  function reviews(C) {
    const tr = $('#reviewsTrack');
    tr.innerHTML = C.reviews.map(r => `<article class="rcard">
      <div class="rcard__top"><span class="stars">★★★★★</span>${r.master ? `<span class="rcard__tag">мастер ${esc(r.master)}</span>` : ''}</div><p>${esc(r.text)}</p>
      <div class="rcard__who"><span class="rcard__ava">${esc(r.author[0])}</span><span>${esc(r.author)}<small>${esc(r.date)}${r.source ? ' · ' + esc(r.source) : ''}</small></span></div>
    </article>`).join('');
    const step = () => (tr.firstElementChild?.offsetWidth || 400) + 16;
    $('#revPrev').onclick = () => tr.scrollBy({ left: -step(), behavior: 'smooth' });
    $('#revNext').onclick = () => tr.scrollBy({ left: step(), behavior: 'smooth' });
  }

  function app(B, C) {
    $('#appList').innerHTML = (C.app_features || []).map(f => `<li>${esc(f)}</li>`).join('');
    const apple = '<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9-.1 0-2.7-1-2.7-4.1zM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5z"/></svg>';
    const play = '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M3.6 1.8 13.8 12 3.6 22.2c-.4-.2-.6-.6-.6-1.1V2.9c0-.5.2-.9.6-1.1zm11.6 11.6 2.6 2.6-11.5 6.5 8.9-9.1zm3.9-3.9 3 1.7c.8.5.8 1.2 0 1.7l-3 1.7-2.9-2.6 2.9-2.5zM6.3 1.5l11.5 6.5-2.6 2.6-8.9-9.1z"/></svg>';
    $('#appBtns').innerHTML =
      (B.app_ios ? `<a class="store" href="${url(B.app_ios)}" target="_blank" rel="noopener">${apple}<span><small>Загрузите в</small><b>App Store</b></span></a>` : '') +
      (B.app_android ? `<a class="store" href="${url(B.app_android)}" target="_blank" rel="noopener">${play}<span><small>Доступно в</small><b>Google Play</b></span></a>`
                     : `<span class="store store--soon">${play}<span><small>Android</small><b>запись на сайте</b></span></span>`);
    // QR для iPhone и для Android — переключатель под кодом
    const qrs = [['iPhone', B.app_ios], ['Android', B.app_android]].filter(x => x[1]);
    if (!qrs.length) qrs.push(['Запись', B.booking_url]);
    const cap = $('.phone__cap');
    const show = i => {
      $('#qr').innerHTML = '';
      try { new QRCode($('#qr'), { text: qrs[i][1], width: 300, height: 300, colorDark: '#0a0a0b', colorLight: '#ffffff' }); }
      catch (e) { $('#qr').remove(); }
      $$('button', cap).forEach((b, k) => b.classList.toggle('on', k === i));
    };
    cap.innerHTML = qrs.length > 1 ? qrs.map((q, i) => `<button type="button" data-q="${i}">${esc(q[0])}</button>`).join('') : 'Сканируйте, чтобы скачать';
    cap.onclick = e => { const b = e.target.closest('[data-q]'); if (b) show(+b.dataset.q); };
    show(/android/i.test(navigator.userAgent) && qrs.length > 1 ? 1 : 0);
  }

  function contacts(B) {
    const s = [
      ['Telegram', B.telegram], ['Написать администратору', B.telegram_admin],
      ['ВКонтакте', B.vk], ['WhatsApp', B.whatsapp]
    ].filter(x => x[1]);
    $('#socials').innerHTML = s.map(([n, u]) => `<a href="${url(u)}" target="_blank" rel="noopener">${esc(n)}</a>`).join('');
    // карта Яндекса ставит cookie — грузим её только после согласия (152-ФЗ), до этого заглушка
    $('#map').innerHTML = `<div class="map-stub"><b>${esc(B.address)}</b><p>Карта Яндекса загрузится после согласия на cookie.</p><button class="btn btn--ghost btn--sm" type="button" id="mapShow">Показать карту</button></div>`;
    $('#mapShow').onclick = () => setConsent('all');
    if (getConsent() === 'all') showMap();
    function showMap() {
      const ll = `${B.lon},${B.lat}`;
      $('#map').innerHTML = `<iframe src="https://yandex.ru/map-widget/v1/?ll=${ll}&z=16&pt=${ll},pm2wtm" title="SEDOY на карте" loading="lazy" allowfullscreen></iframe>`;
    }
    contacts.showMap = showMap;
  }

  /* ---------- Cookie и согласие (152-ФЗ): карта и Метрика — только после «Принять» ---------- */
  const CONSENT_KEY = 'sedoy_consent';
  function getConsent() { try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; } }
  function setConsent(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
    $('#cookie')?.classList.remove('show');
    if (v === 'all') { contacts.showMap?.(); metrika(); }
  }
  let metrikaId = '';
  function metrika() {
    if (!/^\d{5,12}$/.test(metrikaId) || window.ym) return;
    // стандартный код счётчика Яндекс Метрики
    (function (m, e, t, r, i, k, a) { m[i] = m[i] || function () { (m[i].a = m[i].a || []).push(arguments); }; m[i].l = 1 * new Date(); k = e.createElement(t), a = e.getElementsByTagName(t)[0]; k.async = 1; k.src = r; a.parentNode.insertBefore(k, a); })(window, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym');
    window.ym(+metrikaId, 'init', { clickmap: true, trackLinks: true, accurateTrackBounce: true, webvisor: false });
  }
  function cookies(B) {
    metrikaId = String(B.metrika_id || '').trim();
    const c = getConsent();
    if (c === 'all') { metrika(); return; }
    if (c) return;
    const box = $('#cookie'); if (!box) return;
    setTimeout(() => box.classList.add('show'), 1200);
    $('#cookieYes').onclick = () => setConsent('all');
    $('#cookieNo').onclick = () => setConsent('min');
  }

  /* ---------- Запись: окно YClients прямо на сайте ---------- */
  function booking(B) {
    const box = $('#book'), fr = $('#bookFrame');
    const base = B.booking_url.replace(/\/personal\/.*$/, '');
    const open = url => {
      if (!/^https:\/\//.test(url)) return;
      fr.src = url; $('#bookExt').href = url;
      box.classList.add('open'); box.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
    const close = () => { box.classList.remove('open'); box.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; };
    document.addEventListener('click', e => {
      const bk = e.target.closest('[data-book]');
      if (bk) {
        e.preventDefault();
        // если в калькуляторе выбраны услуги — любая кнопка записи переносит их и мастера в YClients
        open(calcLink ? `${base}/personal/menu?o=${calcLink}` : B.booking_url);
      }
      const m = e.target.closest('[data-master]');
      if (m && m.dataset.master) open(`${base}/personal/select-master?o=m${m.dataset.master}`);
      if (e.target.closest('[data-close]')) close();
    });
    addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
  }

  /* ---------- Мелочи ---------- */
  function toast(msg) {
    const t = $('#stoast'); t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 2200);
  }
  function extras(B) {
    const bar = $('#progress');
    const prog = () => { const max = document.documentElement.scrollHeight - innerHeight; bar.style.transform = `scaleX(${max > 0 ? scrollY / max : 0})`; };
    addEventListener('scroll', prog, { passive: true }); prog();

    $('#copyAddr').onclick = async () => {
      try { await navigator.clipboard.writeText(B.address); toast('Адрес скопирован'); }
      catch (e) { toast(B.address); }
    };
    $('#route').href = `https://yandex.ru/maps/?rtext=~${B.lat},${B.lon}&rtt=auto`;

    const ld = img => img.classList.add('ld');
    $$('img[loading=lazy]').forEach(img => img.complete ? ld(img) : img.addEventListener('load', () => ld(img), { once: true }));
    new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => {
      if (n.nodeType !== 1) return;
      [n, ...n.querySelectorAll?.('img[loading=lazy]') || []].forEach(img => { if (img.tagName === 'IMG' && img.loading === 'lazy') img.complete ? ld(img) : img.addEventListener('load', () => ld(img), { once: true }); });
    }))).observe(document.body, { childList: true, subtree: true });

    console.log('%cSEDOY', 'font:700 42px Oswald,Impact,sans-serif;color:#eef5ff;text-shadow:0 0 12px #9cc0ff', '\nТерритория мужского стиля. Сайт сделан вручную, без конструкторов.');
  }

  /* ---------- Затемнённые фото на фоне блоков (меняются в админке → Фото) ---------- */
  function backgrounds(C) {
    const B = C.backgrounds || {};
    const map = { about: '.manifest', masters: '#masters', reviews: '#reviews', contacts: '#contacts' };
    for (const k in map) {
      const sec = $(map[k]); if (!sec) continue;
      sec.querySelector(':scope > .sbg')?.remove();
      if (!B[k]) { sec.classList.remove('has-bg'); continue; }
      const d = document.createElement('div');
      d.className = 'sbg'; d.setAttribute('aria-hidden', 'true');
      const i = document.createElement('i');
      i.style.backgroundImage = `url("${String(B[k]).replace(/["\\()]/g, '')}")`;
      d.append(i);
      sec.prepend(d); sec.classList.add('has-bg');
    }
  }

  function reveal() {
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .15 });
    $$('.reveal, .sec-head').forEach(el => { el.classList.add('reveal'); io.observe(el); });
    // рамки «включаются» по очереди, как лампы
    const led = new IntersectionObserver(es => es.forEach(e => {
      if (!e.isIntersecting) return; led.unobserve(e.target);
      const sib = [...e.target.parentElement.children].indexOf(e.target);
      setTimeout(() => e.target.classList.add('lit'), 250 + sib * 140);
    }), { threshold: .35 });
    $$('.led-frame').forEach(el => led.observe(el));
  }
})();
