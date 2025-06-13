function toggleContent(button) {
      const content = button.nextElementSibling;
      if (content.style.display === 'block') {
        content.style.display = 'none';
        content.style.maxHeight = content.scrollHeight - 'px';
      } else {
        content.style.display = 'block';
        content.style.maxHeight = content.scrollHeight + 'px';
      }
    }