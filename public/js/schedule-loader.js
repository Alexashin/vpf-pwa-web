(function () {
    const iframe = document.getElementById('scheduleFrame');
    if (!iframe) return;

    function btn(on) {
        const b = document.createElement('button'); b.type = 'button';
        b.className = 'vpf-fav-btn' + (on ? ' is-on' : '');
        b.innerHTML = `<span class="vpf-star">★</span><span class="vpf-label">${on ? 'В избранном' : 'В избранное'}</span>`;
        return b;
    }

    function decorate(doc) {
        const rows = [...doc.querySelectorAll('.t521__row')];
        rows.forEach(row => {
            const right = row.querySelector('.t521__rightcol'); if (!right) return;
            const id = (parent.getEventIdFromRow || window.getEventIdFromRow)(row);
            const on = (parent.Fav || window.Fav).has(id);
            const wrap = doc.createElement('div'); wrap.className = 'vpf-fav-wrap';
            const b = btn(on); b.dataset.eventId = id;
            b.onclick = e => {
                e.stopPropagation(); const nowOn = (parent.Fav || window.Fav).toggle(id);
                b.classList.toggle('is-on', nowOn);
                b.querySelector('.vpf-label').textContent = nowOn ? 'В избранном' : 'В избранное';
            };
            wrap.appendChild(b); right.prepend(wrap);
            row.dataset.vpfEventId = id;
        });

        // режим "Моя программа": ?my=1 у СТРАНИЦЫ
        const onlyMine = new URL(parent.location.href).searchParams.get('my') === '1';
        if (onlyMine) {
            const fav = (parent.Fav || window.Fav).all(); let vis = 0;
            rows.forEach(r => { const show = fav.has(r.dataset.vpfEventId); r.classList.toggle('vpf-hidden', !show); if (show) vis++; });
            if (!vis) {
                const root = doc.getElementById('scheduleRoot') || doc.body;
                const m = doc.createElement('div'); m.style.cssText = 'margin:24px 0;text-align:center;font:500 16px system-ui';
                m.textContent = 'Пока пусто. Отметьте события на странице программы.'; root.appendChild(m);
            }
        }

        // авто-высота
        requestAnimationFrame(() => { iframe.style.height = Math.max(doc.documentElement.scrollHeight, 600) + 'px'; });
    }

    iframe.addEventListener('load', () => {
        const doc = iframe.contentDocument; if (!doc) return;
        try { decorate(doc); } catch (e) { console.error('[schedule-loader]', e); }
    });
})();
