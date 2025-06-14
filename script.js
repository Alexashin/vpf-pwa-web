async function loadProgramData() {
    try {
        const response = await fetch('/vpf-pwa-web/data/schedule.json');
        const data = await response.json();
        renderProgram(data.events);
    } catch (error) {
        console.error('Ошибка загрузки JSON:', error);
    }
}

function renderProgram(events) {
    const container = document.getElementById('programContainer');
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
document.addEventListener('DOMContentLoaded', () => {
    loadProgramData(); 
    loadTransferData();
});        