//schedule
let originalEvents = [];
let currentSort = 'timeAsc';

async function loadProgramData() {
    try {
        const response = await fetch('/vpf-pwa-web/data/schedule.json');
        const data = await response.json();
        originalEvents = data.events;
        renderFilteredAndSorted(); // отрисовываем с учётом фильтров
        setupControls(); // навешиваем слушатели
    } catch (error) {
        console.error('Ошибка загрузки JSON:', error);
    }
}

function setupControls() {
    const sortBtn = document.getElementById('sortToggleBtn');
    const sortSelect = document.getElementById('sortSelect');
    const filterDropdown = document.getElementById('filterDropdown');

    if (filterDropdown && filterLabel) {
        filterDropdown.querySelectorAll('.dropdown-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const value = item.getAttribute('data-value');
                const text = item.textContent;
                filterLabel.textContent = 'Фильтрация: ' + text;
                filterLabel.dataset.value = value;
                renderFilteredAndSorted();
            });
        });
    }

    if (sortBtn) {
        sortBtn.addEventListener('click', () => {
            currentSort = currentSort === 'timeAsc' ? 'timeDesc' : 'timeAsc';
            sortBtn.textContent = 'Сортировка: ' + (currentSort === 'timeAsc' ? 'Время ↑' : 'Время ↓');
            renderFilteredAndSorted();
        });
    }
}

function renderFilteredAndSorted() {
    const filterSelect = document.getElementById('filterSelect');
    const sortSelect = document.getElementById('sortSelect');

    let events = [...originalEvents];

    // Фильтрация по залу
    const filterValue = document.getElementById('filterLabel')?.dataset.value || '';
    if (filterValue) {
        events = events.filter(event => event.location === filterValue);
    }

    // Сортировка по времени
    if (currentSort === 'timeAsc') {
        events.sort((a, b) => a.time.localeCompare(b.time));
    } else if (currentSort === 'timeDesc') {
        events.sort((a, b) => b.time.localeCompare(a.time));
    }

    renderProgram(events);
}

function renderProgram(events) {
    const container = document.getElementById('programContainer');
    if (!container) return;
    container.innerHTML = '';

    events.forEach((event, index) => {
        const div = document.createElement('div');
        div.className = 'program-section';
        const collapseId = `collapse-${index}`;

        const topics = event.topics?.map(t => `<li class="section-topic">${t}</li>`).join('') || '';
        const speakers = event.speakers?.map(s =>
            `<li class="section-speaker">${s.name}${s.topic ? ` — ${s.topic}` : ''}${s.position ? ` (${s.position})` : ''}</li>`
        ).join('') || '';

        div.innerHTML = `
    <div class="section-time">${event.time}</div>
    <div class="section-title">${event.title}</div>
    <div class="section-location">${event.location || ''}</div>

    <button class="btn btn-outline-primary btn-sm btn-toggle" type="button"
        data-bs-toggle="collapse" data-bs-target="#${collapseId}" aria-expanded="false"
        aria-controls="${collapseId}">
        Подробнее
    </button>

    <div class="collapse mt-3" id="${collapseId}">
        ${topics ? `<strong>Темы:</strong><ul>${topics}</ul>` : ''}
        ${speakers ? `<strong>Спикеры:</strong><ul>${speakers}</ul>` : ''}
    </div>
`;

        container.appendChild(div);
    });
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

                            <a href="${contact.button.link}" class="btn btn-contact"></a> 
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
    loadProgramData(); 
    loadTransferData();
    loadContacts();
    loadMapData();
});        