window.Fav = (() => {
    const KEY = 'vpf:favs';
    const get = () => { try { return new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch { return new Set(); } };
    const save = (s) => localStorage.setItem(KEY, JSON.stringify([...s]));
    return {
        all: () => get(), has: id => get().has(String(id)),
        toggle(id) { const s = get(); id = String(id); const on = !s.has(id); on ? s.add(id) : s.delete(id); save(s); return on; }
    };
})();
window.getEventIdFromRow = function (row) {
    const t = row.querySelector('.t521__time')?.innerText?.trim().replace(/\s+/g, ' ') || '';
    const txt = row.querySelector('.t521__text')?.innerText?.trim().replace(/\s+/g, ' ') || '';
    return `${t}|${txt.slice(0, 120)}`;
};
