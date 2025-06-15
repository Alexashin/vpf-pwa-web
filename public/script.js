//schedule
let originalEvents = [];

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
    const filterSelect = document.getElementById('filterSelect');
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

    if (sortSelect) {
        sortSelect.addEventListener('change', renderFilteredAndSorted);
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
    const sortValue = sortSelect?.value;
    if (sortValue === 'timeAsc') {
        events.sort((a, b) => a.time.localeCompare(b.time));
    } else if (sortValue === 'timeDesc') {
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

document.addEventListener('DOMContentLoaded', () => {
    loadProgramData(); 
    loadTransferData();
});        