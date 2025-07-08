// app.js
// Регистрирует Service Worker для PWA
// apk
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker
            .register('/vpf-pwa-web/sw.js')
            .then(reg => {
                console.log('[SW] Успешно зарегистрирован:', reg.scope);
            })
            .catch(err => {
                console.error('[SW] Ошибка регистрации:', err);
            });
    });
}
