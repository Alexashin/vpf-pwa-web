/* === MIN STORAGE + PROFILE === */
(function () {

    function injectProfileModalIfMissing() {
        if (document.getElementById('firstRunModal')) return true;

        const tpl = document.createElement('template');
        tpl.innerHTML = `
            <div class="modal fade" id="firstRunModal" tabindex="-1" role="dialog" aria-labelledby="firstRunTitle" aria-modal="true">
                <div class="modal-dialog modal-dialog-centered">
                    <form class="modal-content" id="firstRunForm">
                        <div class="modal-header">
                            <h5 class="modal-title" id="firstRunTitle">Короткая анкета</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label" for="firstRunFullName">ФИО</label>
                                <input id="firstRunFullName" type="text" class="form-control" name="fullName" required />
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Организация (необязательно)</label>
                                <input type="text" class="form-control" name="company" />
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Роль</label>
                                <select class="form-select" name="role">
                                    <option value="">Не указывать</option>
                                    <option>Участник</option>
                                    <option>Спикер</option>
                                    <option>Организатор</option>
                                    <option>Гость</option>
                                </select>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="checkbox" id="consent" name="consent" required>
                                <label class="form-check-label" for="consent">Согласие на обработку персональных данных</label>
                            </div>
                        </div>
                        <div class="modal-footer">
                            <button class="btn btn-primary" type="submit" id="firstRunSaveBtn">Сохранить</button>
                        </div>
                    </form>
                </div>
            </div>`;
        document.body.appendChild(tpl.content.firstElementChild);
            return true;
    }
    // Простое key-value хранилище
    const KV = {
        get(k, fb = null) { try { return JSON.parse(localStorage.getItem(k)) ?? fb; } catch { return fb; } },
        set(k, v) { localStorage.setItem(k, JSON.stringify(v)); },
        del(k) { localStorage.removeItem(k); }
    };

    // Избранное
    const Fav = {
        key: 'vpf:favs',
        all() { return new Set(KV.get(this.key, [])); },
        has(id) { return this.all().has(String(id)); },
        add(id) { const s = this.all(); s.add(String(id)); KV.set(this.key, [...s]); },
        remove(id) { const s = this.all(); s.delete(String(id)); KV.set(this.key, [...s]); },
        toggle(id) { const key = String(id); const s = this.all(); const on = !s.has(key); on ? s.add(key) : s.delete(key); KV.set(this.key, [...s]); return on; }
    };

    // Анкета
    const Profile = {
        key: 'vpf:profile',
        get() { return KV.get(this.key, null); },
        save(obj) { KV.set(this.key, obj); },
        clear() { KV.del(this.key); }
    };

    // глобально
    window.Fav = Fav;
    window.Profile = Profile;

    const ASK_KEY = 'vpf:profile:asked'; // «анкету уже показывали»
    const FirstRunFlag = {
        was() { return localStorage.getItem(ASK_KEY) === '1'; },
        set() { localStorage.setItem(ASK_KEY, '1'); },
        reset() { localStorage.removeItem(ASK_KEY); } // удобно для тестов
    };

    // Анкета первого входа: модал #firstRunModal + #firstRunForm, иначе prompt
    window.ensureFirstRunProfile = function ensureFirstRunProfile() {
        if (window.Profile.get()) return;
        const el = document.getElementById('firstRunModal');
        if (el && window.bootstrap && bootstrap.Modal) {
            const modal = new bootstrap.Modal(el, { backdrop: 'static', keyboard: false });
            modal.show();
            const form = document.getElementById('firstRunForm');
            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const data = {
                    fullName: String(fd.get('fullName') || '').trim(),
                    company: String(fd.get('company') || '').trim(),
                    role: String(fd.get('role') || '').trim(),
                    consent: !!fd.get('consent')
                };
                if (!data.fullName) return;
                window.Profile.save(data);
                bootstrap.Modal.getInstance(el)?.hide();
            });
        } else {
            const name = (prompt('ФИО (минимум):') || '').trim();
            if (name) window.Profile.save({ fullName: name, consent: false });
        }
    };

    // Утилиты для работы с избранным в UI
    window.getEventId = function getEventId(ev) {
        if (ev && ev.id) return String(ev.id); // если есть id — используем его
        const d = (ev?.date || '').trim();
        const t = (ev?.time || '').trim();
        const ti = (ev?.title || '').trim();
        const loc = (ev?.location || '').trim();
        return [d, t, ti, loc].join('|'); // без индекса
    };

    window.renderFavState = function renderFavState(btn, on) {
        if (!btn) return;
        btn.classList.toggle('btn-primary', on);
        btn.classList.toggle('btn-outline-primary', !on);
        const icon = btn.querySelector('i') || btn.insertBefore(document.createElement('i'), btn.firstChild);
        icon.className = on ? 'bi bi-star-fill' : 'bi bi-star';
        const label = btn.querySelector('.fav-label') || btn.appendChild(Object.assign(document.createElement('span'), { className: 'fav-label' }));
        label.textContent = on ? ' В избранном' : ' В избранное';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    window.toggleFavorite = function toggleFavorite(eventId, domEvt) {
        domEvt?.stopPropagation?.();
        const on = window.Fav.toggle(eventId);
        const safeId = (window.CSS && CSS.escape) ? CSS.escape(eventId) : eventId;
        const btn = domEvt?.currentTarget || document.querySelector(`.btn-fav[data-event-id="${safeId}"]`);
        renderFavState(btn, on);
    };

    // Анкета первого входа: неблокирующая, только через модал (никаких prompt)
    window.ensureFirstRunProfile = function ensureFirstRunProfile() {
        const prof = Profile.get();
        const hasName = !!(prof && String(prof.fullName || '').trim());

        // 1) Если профиль уже есть ИЛИ мы уже показывали анкету — выходим
        if (hasName || FirstRunFlag.was()) return;

        // 2) Вставляем разметку, если её нет
        injectProfileModalIfMissing();
        const el = document.getElementById('firstRunModal');
        if (!(window.bootstrap && bootstrap.Modal) || !el) {
            // даже если бутстрапа нет — считаем, что попытка показа была, чтобы не спамить дальше
            FirstRunFlag.set();
            return;
        }

        if (el.classList.contains('show')) return; // подстраховка

        // 3) Гарантируем показ один раз: ставим флаг ПЕРЕД показом
        FirstRunFlag.set();

        requestAnimationFrame(() => {
            const modal = new bootstrap.Modal(el, { backdrop: 'static', keyboard: false });

            el.addEventListener('shown.bs.modal', () => {
                el.querySelector('#firstRunFullName')?.focus();
            }, { once: true });

            // (необязательно) косметика со фокусом при закрытии
            el.addEventListener('hide.bs.modal', () => {
                if (document.activeElement && el.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            });

            modal.show();

            const form = document.getElementById('firstRunForm');
            const saveBtn = document.getElementById('firstRunSaveBtn');
            const consentEl = document.getElementById('consent');

            if (saveBtn && consentEl) {
                saveBtn.disabled = !consentEl.checked;
                consentEl.addEventListener('change', () => {
                    saveBtn.disabled = !consentEl.checked;
                });
            }

            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const data = {
                    fullName: String(fd.get('fullName') || '').trim(),
                    company:  String(fd.get('company') || '').trim(),
                    role:     String(fd.get('role') || '').trim(),
                    consent:  !!fd.get('consent')
                };
                if (!data.fullName) return;

                Profile.save(data);
                if (data.consent) ProfileSync.enqueue(data);

                bootstrap.Modal.getInstance(el)?.hide();
            });
        });
    };

})();

// === PROFILE SYNC -> GOOGLE FORMS ===
(function () {
  const QUEUE_KEY = 'vpf:profile:syncQueue';
  const UID_KEY = 'vpf:uid';

  function getUID(){
    let u = localStorage.getItem(UID_KEY);
    if (!u) {
      u = (crypto.randomUUID?.() || (Date.now().toString(36)+Math.random().toString(36).slice(2)));
      localStorage.setItem(UID_KEY, u);
    }
    return u;
  }

  // --- НАСТРОЙКИ: ---
  const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdZlC6xbE6cVXdfbNCasuetSJ71ifBwBsY4nXS49Wfkk_xG0w/formResponse';

  function mapToGoogleForm(profile){
    return {
      'entry.1702008284': profile.fullName,                // ФИО
      'entry.401848522': profile.company || '',            // Организация
      'entry.251234440': profile.role || '',               // Роль
      'entry.585744429': profile.consent ? 'Согласен' : '',// Согласие
      'entry.414224166': getUID(),                         // UID устройства (доп.столбец)
      'entry.659803648': navigator.userAgent               // User-Agent (доп.столбец)
    };
  }
  // ------------------------------------

  function qGet(key, fb = []) { try { return JSON.parse(localStorage.getItem(key)) ?? fb; } catch { return fb; } }
  function qSet(key, v)      { localStorage.setItem(key, JSON.stringify(v)); }

  const Q = {
    get(){ return qGet(QUEUE_KEY, []); },
    set(v){ qSet(QUEUE_KEY, v); },
    push(item){ const q = Q.get(); q.push(item); Q.set(q); },
    shift(){ const q = Q.get(); const it = q.shift(); Q.set(q); return it; },
    empty(){ return Q.get().length === 0; }
  };

  async function sendOne(profile){
    // Отправка в форму: form-urlencoded + no-cors (простой путь без CORS-головной боли)
    const body = new URLSearchParams(mapToGoogleForm(profile));
    await fetch(GOOGLE_FORM_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body
    });
    // В no-cors нельзя прочитать ответ, считаем оптимистично, что ушло
    const p = Profile.get() || {};
    p.sync = { provider:'google_form', sent:true, ts: Date.now() };
    Profile.save(p);
  }

  async function flush(){
    if (Q.empty()) return;
    // Гоним очередь по одному, чтобы не забанить форму пачкой
    const snapshot = Q.get().slice(0, 10); 
    const rest = [];
    for (const item of snapshot){
      try { await sendOne(item.profile); }
      catch(e){ rest.push(item); }
      Q.shift(); 
    }
    // если были ошибки — положим обратно в конец
    if (rest.length) Q.set(Q.get().concat(rest));
  }

  function enqueue(profile){
    Q.push({ profile, ts: Date.now() });
    if (navigator.onLine) flush();
  }

  window.addEventListener('online', flush);
  document.addEventListener('DOMContentLoaded', flush);

  window.ProfileSync = { enqueue, flush, getUID };
})();

function shouldShowProfileHere() {
    // Явный флаг со страницы — приоритет
    if (typeof window.SHOW_PROFILE_ON_THIS_PAGE !== 'undefined') {
        return !!window.SHOW_PROFILE_ON_THIS_PAGE;
    }
    // Эвристика «главная»: путь пустой, '/', '/index.html' или '/vpf-pwa-web[/index.html]'
    const p = location.pathname.replace(/\/+$/, '');
    return (
        p === '' || p === '/' ||
        p.endsWith('/index.html') ||
        p.endsWith('/vpf-pwa-web') ||
        p.endsWith('/vpf-pwa-web/index.html')
    );
}


function removeFromFavorites(index, domEvt) {
    domEvt?.stopPropagation?.();
    const eid = getEventId(originalEvents[index]);
    if (!confirm('Удалить это мероприятие из избранного?')) return;

    window.Fav.remove(eid);

    const container = document.getElementById('programContainer');
    const card = container?.children[index];
    if (card) {
        card.style.opacity = '0';
        card.style.transition = 'opacity 0.3s ease';
        setTimeout(() => { card.remove(); }, 300);
    }
}

//schedule
let originalEvents = [];

async function loadProgramData() {
    try {
        const response = await fetch('/vpf-pwa-web/data/schedule.json');
        const data = await response.json();
        originalEvents = data.events;
        renderProgram(originalEvents);
    } catch (error) {
        console.error('Ошибка загрузки JSON:', error);
    }
}

async function loadMyProgramData() {
    try {
        const resp = await fetch('/vpf-pwa-web/data/schedule.json');
        const data = await resp.json();
        const all = Array.isArray(data.events) ? data.events : [];

        const favSet = new Set(JSON.parse(localStorage.getItem('vpf:favs') || '[]'));
        const filtered = all.filter(ev => favSet.has(getEventId(ev)));

        // чтобы индексы в UI соответствовали текущему списку
        originalEvents = filtered;

        const container = document.getElementById('programContainer');
        if (!filtered.length) {
            container.innerHTML = '<div class="text-muted">Пока пусто. Отметьте события звездой на странице программы.</div>';
            return;
        }
        renderProgram(filtered);
    } catch (e) {
        console.error('Ошибка загрузки «Моей программы»:', e);
        document.getElementById('programContainer').innerHTML =
            '<div class="text-danger">Не удалось загрузить «Мою программу».</div>';
    }
}

function renderProgram(events) {
    const container = document.getElementById('programContainer');
    if (!container) return;
    container.innerHTML = '';

    events.forEach((event, index) => {
        const collapseId = `collapse-${index}`;

        const topics = event.topics?.map(t => `<li class="section-topic">${t}</li>`).join('') || '';
        const speakers = event.speakers?.map(s =>
            `<li class="section-speaker">${s.name}${s.topic ? ` — ${s.topic}` : ''}${s.position ? ` (${s.position})` : ''}</li>`
        ).join('') || '';

        const eid = getEventId(event);
        const isFav = window.Fav.has(eid);

        const cardHTML = `
    <div class="program-section">
        <div class="section-time">${event.time || ''}</div>
        <div class="section-title">${event.title || ''}</div>
        <div class="section-location">${event.location || ''}</div>

        <div class="buttons-container">
            <button class="btn ${isFav ? 'btn-primary' : 'btn-outline-primary'} btn-fav"
                    data-event-id="${eid}"
                    onclick="toggleFavorite('${eid}', event)">
                <i class="bi ${isFav ? 'bi-star-fill' : 'bi-star'}"></i>
                <span class="fav-label">${isFav ? ' В избранном' : ' В избранное'}</span>
            </button>

            <button class="btn btn-details" onclick="toggleCollapse(${index}, event)">
                <i class="bi bi-chevron-down"></i> Подробнее
            </button>
        </div>

        <div class="collapse-box" id="${collapseId}">
            ${topics ? `<strong>Темы:</strong><ul>${topics}</ul>` : ''}
            ${speakers ? `<strong>Спикеры:</strong><ul>${speakers}</ul>` : ''}
        </div>
    </div>
    `;

        container.insertAdjacentHTML('beforeend', cardHTML);
    });
}


function toggleCollapse(index, event) {
    if (event) event.stopPropagation();

    const box = document.getElementById(`collapse-${index}`);
    if (!box) return;

    box.classList.toggle('active');

    const btn = box.previousElementSibling.querySelector('.btn-details');
    const icon = btn.querySelector('i');

    if (box.classList.contains('active')) {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    } else {
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    }
}

//location

async function loadTransferData() {
    try {
        const response = await fetch('/vpf-pwa-web/data/location.json');
        const data = await response.json();
        renderTransfer(data.transfer);
    } catch (error) {
        console.error('Ошибка загрузки JSON:', error);
        document.getElementById('transferContainer').innerHTML =
            '<div class="text-danger">Не удалось загрузить информацию о трансфере</div>';
    }
}

function renderTransfer(transferData) {
    const container = document.getElementById('transferContainer');

    if (!container) return;

    if (!transferData || !transferData.buses || transferData.buses.length === 0) {
        container.innerHTML = '<div class="text-muted">Информация о трансфере будет доступна позже</div>';
        return;
    }

    let html = '<div class="mb-4"><strong>Автобусы:</strong>';

    // Информация об автобусах
    transferData.buses.forEach(bus => {
        html += `
            <div class="bus-info">
                ${bus.number} автобус ${bus.model} (${bus.seats} мест) - ${bus.plate}
            </div>
        `;
    });

    html += '</div>';

    // Точки отправления
    html += '<div><strong>Точки отправления:</strong>';

    transferData.points.forEach(point => {
        html += `
            <div class="point-item">
                <div class="point-title">${point.name}</div>
                <div class="point-time">Время отправления: ${point.time}</div>
            </div>
        `;
    });

    html += '</div>';

    container.innerHTML = html;
}

window.addEventListener('DOMContentLoaded', () => {
    const ymap = document.getElementById('ymap');
    const fallback = document.getElementById('mapFallback')

    if (!ymap || !fallback) return;

    const timeout = setTimeout(() => {
        console.warn('[Карта] Превышен таймаут ожидания ответа. Показываем fallback.');
        showFallback();
    }, 5000)
    fetch('https://yandex.ru/favicon.ico', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-store'
    })
        .then(() => {
            clearTimeout(timeout);
            console.info('[Карта] Доступ к yandex.ru есть. Показываем карту.');
            showMap();
        })
        .catch(() => {
            clearTimeout(timeout);
            console.warn('[Карта] Ошибка при проверке доступа к yandex.ru. Показываем fallback.');
            showFallback();
        });

    function showMap() {
        ymap.style.display = 'block';
        fallback.style.display = 'none';
    }

    function showFallback() {
        ymap.style.display = 'none';
        fallback.style.display = 'block';
    }
});

//contact
// contact.js
async function loadContacts() {
    try {
        const response = await fetch('/vpf-pwa-web/data/contacts.json');
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();

        const container = document.getElementById('contactsContainer');

        // Рендерим контакты для выставочной экспозиции
        container.innerHTML = data.contacts.map(contact => {
            return `
                <div class="col-12">
                    <div class="contact-card">
                        <h3 class="contact-title">${contact.title}</h3>

                        ${contact.phones ? `
                        <div class="contact-info">
                            ${contact.phones.map(phone => `
                                <div class="contact-item">
                                    <div class="contact-phone-row">
                                        <div class="contact-icon">
                                            <i class="bi bi-telephone"></i>
                                        </div>
                                        <div class="contact-phone">${phone.number}</div>
                                    </div>
                                    <div class="contact-details">
                                        <div class="contact-name">${phone.person}</div>
                                        ${phone.email ? `
                                        <div class="contact-email">${phone.email}</div>
                                        ` : ''}
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('contactsContainer').innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="alert alert-danger">
                    Не удалось загрузить контакты. Пожалуйста, попробуйте позже.
                </div>
            </div>`;
    }
}

//map

async function loadMapData() {
    try {
        const response = await fetch('/vpf-pwa-web/data/map.json');
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();

        const hallsContainer = document.getElementById('hallsContainer');
        hallsContainer.innerHTML = data.halls.map(hall => {
            const hasScheme = hall.scheme && hall.scheme !== "";

            return `
                <div class="col-md-6 col-lg-3 mb-4">
                    <div class="hall-card">
                        <div class="hall-img" style="background-image: url('${hall.image}')"
                             ${hasScheme ? `onclick="toggleScheme(${hall.id})"` : ''}></div>
                        <div class="hall-info">
                            <h4 class="hall-title">${hall.name}</h4>
                            <div class="hall-capacity">
                                <i class="bi bi-people"></i> Вместимость: до ${hall.capacity} чел.
                            </div>
                            <p>${hall.description}</p>
                            ${hasScheme ?
                    `<button class="btn btn-details visible w-100" onclick="toggleScheme(${hall.id}, event)">
                                    <i class="bi bi-chevron-down"></i> Подробнее
                                </button>` :
                    `<div class="no-scheme">Схема зала отсутствует</div>`
                }
                        </div>
                        ${hasScheme ? `
                        <div class="hall-scheme" id="scheme-${hall.id}">
                            <div class="text-center mt-2">
                                <h5>Схема зала</h5>
                                <img src="${hall.scheme}" alt="Схема ${hall.name}" class="scheme-img">
                            </div>
                        </div>` : ''}
                    </div>
                </div>
            `;
        }).join('');

        document.getElementById('floorPlanImage').src = data.floor_plan;

    } catch (error) {
        console.error('Ошибка:', error);
        document.getElementById('hallsContainer').innerHTML = `
            <div class="col-12 text-center py-4">
                <div class="alert alert-danger">
                    Не удалось загрузить данные. Пожалуйста, попробуйте позже.
                </div>
            </div>`;
    }
}

function toggleScheme(hallId, event) {
    if (event) event.stopPropagation();
    const scheme = document.getElementById(`scheme-${hallId}`);
    if (!scheme) return;

    scheme.classList.toggle('active');

    const btn = scheme.previousElementSibling.querySelector('button');
    const icon = btn.querySelector('i');

    if (scheme.classList.contains('active')) {
        icon.classList.remove('bi-chevron-down');
        icon.classList.add('bi-chevron-up');
    } else {
        icon.classList.remove('bi-chevron-up');
        icon.classList.add('bi-chevron-down');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('programContainer')) {
        if (window.MY_SCHEDULE_ONLY) {
            loadMyProgramData();      // только избранное
        } else {
            loadProgramData();        // обычная страница программы
        }
    }
    if (document.getElementById('transferContainer')) loadTransferData();
    if (document.getElementById('contactsContainer')) loadContacts();
    if (document.getElementById('hallsContainer')) loadMapData();
});

window.addEventListener('load', () => {
    setTimeout(ensureFirstRunProfile, 0);
});
