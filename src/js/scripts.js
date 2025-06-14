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

document.addEventListener('DOMContentLoaded', function () {
    const ruLang = {
    search: "Поиск:",
    lengthMenu: "Показать _MENU_ записей",
    info: "Показано с _START_ по _END_ из _TOTAL_ записей",
    paginate: {
      first: "Первая",
      last: "Последняя",
      next: "След.",
      previous: "Пред."
    },
    zeroRecords: "Ничего не найдено",
    infoEmpty: "Нет доступных записей",
    infoFiltered: "(отфильтровано из _MAX_ записей)"
    };

    $('#schedule-table').DataTable({
      language: ruLang,
      order: [[0, 'asc'], [1, 'asc']] 
    });
});