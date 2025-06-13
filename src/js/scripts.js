function toggleContent(button) {
    const content = button.nextElementSibling;
    const isOpen = content.classList.contains('open');

    // Закрыть все остальные
    document.querySelectorAll('.toggle-content.open').forEach(el => {
        if (el !== content) {
            el.style.maxHeight = null;
            el.classList.remove('open');
        }
    });

    if (!isOpen) {
        content.classList.add('open');
        content.style.maxHeight = content.scrollHeight + 'px';
    } else {
        content.style.maxHeight = null;
        content.classList.remove('open');
    }
}