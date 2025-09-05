/* === MIN STORAGE + PROFILE === */
(function () {

    function injectProfileModalIfMissing() {
        if (document.getElementById('firstRunModal')) return true;

        const tpl = document.createElement('template');
        tpl.innerHTML = `
            <div class="modal fade" id="firstRunModal" tabindex="-1" role="dialog" aria-modal="true">
                <div class="modal-dialog modal-dialog-centered">
                    <form class="modal-content" id="firstRunForm">
                    <div class="modal-header">
                        <h5 class="modal-title">Короткая анкета</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Закрыть"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <label class="form-label">ФИО</label>
                            <input type="text" class="form-control" name="fullName" required />
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
                            <input class="form-check-input" type="checkbox" id="consent" name="consent">
                            <label class="form-check-label" for="consent">Согласие на обработку персональных данных</label>
                        </div>
                        <small class="text-muted d-block mt-2">Данные сохраняются только на вашем устройстве.</small>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-primary" type="submit">Сохранить</button>
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
        if (hasName) return;

        injectProfileModalIfMissing();
        const el = document.getElementById('firstRunModal');
        if (!(window.bootstrap && bootstrap.Modal) || !el) return;

        if (el.classList.contains('show')) return; // уже открыт

        requestAnimationFrame(() => {
            const modal = new bootstrap.Modal(el, { backdrop: 'static', keyboard: false });
            // автофокус на поле
            el.addEventListener('shown.bs.modal', () => {
                el.querySelector('#firstRunFullName')?.focus();
            }, { once: true });
            // перед скрытием — убираем фокус, чтобы не было конфликта с aria-hidden
            el.addEventListener('hide.bs.modal', () => {
                if (document.activeElement && el.contains(document.activeElement)) {
                    document.activeElement.blur();
                }
            });

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
                Profile.save(data);
                bootstrap.Modal.getInstance(el)?.hide();
            });
        });
    };
})();

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

// === РЕНДЕР ТОЛЬКО ДЛЯ СТРАНИЦЫ program ===
function renderProgram(events) {
  const container = document.getElementById('programContainer');
  if (!container) return;
  container.innerHTML = '';

  events.forEach((ev, index) => {
    const eid = getEventId(ev);
    const isFav = window.Fav?.has(eid);

    const topicsBlock = Array.isArray(ev.topics) && ev.topics.length
      ? `
        <div class="ev-block">
          ${ev.topics.map(t => `<div class="ev-line">${t}</div>`).join('')}
        </div>`
      : '';

    const speakersBlock = Array.isArray(ev.speakers) && ev.speakers.length
      ? `
        <div class="ev-block">
          <div class="ev-block-title">Спикеры:</div>
          ${ev.speakers.map(s => {
            const parts = [
              s.name || '',
              s.topic ? ` — ${s.topic}` : '',
              s.position ? ` (${s.position})` : ''
            ];
            return `<div class="ev-line">${parts.join('')}</div>`;
          }).join('')}
        </div>`
      : '';

    const details = `
      ${ev.title ? `<div class="ev-title">${ev.title}</div>` : ''}
      ${ev.description ? `<div class="ev-block"><div class="ev-line">${ev.description}</div></div>` : ''}
      ${topicsBlock}
      ${speakersBlock}
    `;

    const cardHTML = `
      <section class="program-card">
        <!-- Левая колонка -->
        <div class="program-left">
          <div class="ev-time">${ev.time || ''}</div>
          <div class="ev-hall">${ev.location || ''}</div>

          <button class="btn-program btn-fav ${isFav ? '' : 'btn-program--ghost'}"
                  data-event-id="${eid}"
                  onclick="toggleFavorite('${eid}', event)">
            <i class="bi ${isFav ? 'bi-star-fill' : 'bi-star'}"></i>
            <span class="fav-label">${isFav ? ' В избранном' : ' В избранное'}</span>
          </button>
        </div>

        <!-- Правая колонка -->
        <div class="program-right">
          ${details}
        </div>
      </section>
    `;

    container.insertAdjacentHTML('beforeend', cardHTML);
  });
}

// Универсальный (но простой) тогглер только для этой страницы
function toggleCollapse(collapseId, btnEl, evt) {
  if (evt) evt.stopPropagation();
  const box = document.getElementById(collapseId);
  if (!box) return;
  box.classList.toggle('active');

  const icon = btnEl?.querySelector('i');
  if (!icon) return;
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


(() => {
  const lb = document.getElementById('lightbox');
  const lbImg = document.getElementById('lightbox-img');

  // открытие
  document.querySelectorAll('.plan-item').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const src = a.dataset.full || a.href;
      lbImg.src = src;
      lbImg.alt = a.querySelector('img')?.alt || '';
      lb.hidden = false;
      document.body.style.overflow = 'hidden'; // запрет скролла фона
    });
  });

  // закрытие по клику по фону/крестику
  const close = () => {
    lb.hidden = true;
    lbImg.src = '';
    document.body.style.overflow = '';
  };
  lb.addEventListener('click', e => {
    if (e.target === lb || e.target.classList.contains('lightbox-close')) close();
  });
  // закрытие по Esc
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !lb.hidden) close();
  });
})();


// window.addEventListener('load', () => { ВЕРНУТЬ ЧТОБЫ ОТОБРАЗИЛОСЬ ОКНО
//     setTimeout(ensureFirstRunProfile, 0);
// });
