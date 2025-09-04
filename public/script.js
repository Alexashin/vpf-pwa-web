/* === MIN STORAGE + PROFILE (NO MODULES) === */
(function () {
    const KV = {
        get(k, fb=null){ try{ return JSON.parse(localStorage.getItem(k)) ?? fb; }catch{ return fb; } },
        set(k, v){ localStorage.setItem(k, JSON.stringify(v)); },
        del(k){ localStorage.removeItem(k); }
    };

    const Fav = {
        key: 'vpf:favs',
        all(){ return new Set(KV.get(this.key, [])); },
        has(id){ return this.all().has(String(id)); },
        add(id){ const s=this.all(); s.add(String(id)); KV.set(this.key,[...s]); },
        remove(id){ const s=this.all(); s.delete(String(id)); KV.set(this.key,[...s]); },
        toggle(id){ const key=String(id); const s=this.all(); const on=!s.has(key); on?s.add(key):s.delete(key); KV.set(this.key,[...s]); return on; }
    };

    const Profile = {
        key: 'vpf:profile',
        get(){ return KV.get(this.key, null); },
        save(obj){ KV.set(this.key, obj); },
        clear(){ KV.del(this.key); }
    };

  // глобально
    window.Fav = Fav;
    window.Profile = Profile;

  // Анкета первого входа: модал #firstRunModal + #firstRunForm, иначе prompt
    window.ensureFirstRunProfile = function ensureFirstRunProfile() {
        if (window.Profile.get()) return;
        const el = document.getElementById('firstRunModal');
        if (el && window.bootstrap && bootstrap.Modal) {
            const modal = new bootstrap.Modal(el, { backdrop:'static', keyboard:false });
            modal.show();
            const form = document.getElementById('firstRunForm');
            form?.addEventListener('submit', (e) => {
                e.preventDefault();
                const fd = new FormData(form);
                const data = {
                    fullName: String(fd.get('fullName')||'').trim(),
                    company: String(fd.get('company')||'').trim(),
                    role: String(fd.get('role')||'').trim(),
                    consent: !!fd.get('consent')
                };
                if (!data.fullName) return;
                window.Profile.save(data);
                bootstrap.Modal.getInstance(el)?.hide();
            });
        } else {
            const name = (prompt('ФИО (минимум):') || '').trim();
            if (name) window.Profile.save({ fullName: name, consent:false });
        }
    };

    // Утилиты для работы с избранным в UI
    window.getEventId = function getEventId(ev){
        if (ev && ev.id) return String(ev.id); // если есть id — используем его
        const d = (ev?.date || '').trim();
        const t = (ev?.time || '').trim();
        const ti = (ev?.title || '').trim();
        const loc = (ev?.location || '').trim();
        return [d,t,ti,loc].join('|'); // без индекса
    };

    window.renderFavState = function renderFavState(btn, on){
        if (!btn) return;
        btn.classList.toggle('btn-primary', on);
        btn.classList.toggle('btn-outline-primary', !on);
        const icon = btn.querySelector('i') || btn.insertBefore(document.createElement('i'), btn.firstChild);
        icon.className = on ? 'bi bi-star-fill' : 'bi bi-star';
        const label = btn.querySelector('.fav-label') || btn.appendChild(Object.assign(document.createElement('span'), {className:'fav-label'}));
        label.textContent = on ? ' В избранном' : ' В избранное';
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    };

    window.toggleFavorite = function toggleFavorite(eventId, domEvt){
        domEvt?.stopPropagation?.();
        const on = window.Fav.toggle(eventId);
        const safeId = (window.CSS && CSS.escape) ? CSS.escape(eventId) : eventId;
        const btn = domEvt?.currentTarget || document.querySelector(`.btn-fav[data-event-id="${safeId}"]`);
        renderFavState(btn, on);
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

function removeFromFavorites(index, event) {
    if (event) event.stopPropagation();

    // Удаляем мероприятие из избранного
    if (confirm('Удалить это мероприятие из избранного?')) {
        // Здесь должна быть логика удаления из избранного
        // Например, удаление из localStorage или отправка на сервер
        console.log('Удаляем мероприятие из избранного:', originalEvents[index]);

        // Удаляем карточку из DOM
        const container = document.getElementById('programContainer');
        const card = container.children[index];
        if (card) {
            card.style.opacity = '0';
            card.style.transition = 'opacity 0.3s ease';
            setTimeout(() => {
                card.remove();
            }, 300);
        }
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
async function loadContacts() {
    try {
        const response = await fetch('/vpf-pwa-web/data/contacts.json');
        if (!response.ok) throw new Error('Ошибка загрузки');
        const data = await response.json();

        const container = document.getElementById('contactsContainer');

        // Фильтруем контакты, оставляя только те, которые не являются карточкой регистрации
        const regularContacts = data.contacts.filter(c => !c.isRegistrationCard);
        const forumContact = data.contacts.find(c => c.isRegistrationCard);

        // Рендерим основные контакты
        container.innerHTML = regularContacts.map(contact => {
            return `
                    <div class="col-md-6 mb-4">
                        <div class="contact-card">
                            <h3 class="contact-title">${contact.title}</h3>
                            ${contact.description ? `<p class="contact-text">${contact.description}</p>` : ''}

                            ${contact.phones ? `
                            <div class="contact-info">
                                ${contact.phones.map(phone => `
                                    <div class="contact-item">
                                        <div class="contact-icon">
                                            <i class="bi bi-telephone"></i>
                                        </div>
                                        <div class="contact-details">
                                            <div class="contact-phone">${phone.number}</div>
                                            <div class="contact-name">${phone.person}</div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            ` : ''}

                            ${contact.email ? `
                            <div class="contact-email">
                                Также можно отправить запрос на почту:<br>
                                <strong>${contact.email}</strong>
                            </div>
                            ` : ''}

                            <a href="${contact.button.link}" class="btn btn-contact">
                                ${contact.button.text}
                            </a> 
                        </div>
                    </div>
                `;
        }).join('');

        // Добавляем карточку регистрации отдельно внизу
        if (forumContact) {
            container.innerHTML += `
                    <div class="col-12">
                        <div class="register-section">
                            <div class="register-card">
                                <h3 class="register-title">${forumContact.title}</h3>
                                <a href="${forumContact.button.link}" class="btn btn-contact">
                                    ${forumContact.button.text}
                                </a>
                            </div>
                        </div>
                    </div>
                `;
        }

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
    if (document.getElementById('programContainer') && !window.MY_SCHEDULE_ONLY) {
        loadProgramData();
    }
    if (document.getElementById('transferContainer')) loadTransferData();
    if (document.getElementById('contactsContainer')) loadContacts();
    if (document.getElementById('hallsContainer')) loadMapData();

    ensureFirstRunProfile();
});
