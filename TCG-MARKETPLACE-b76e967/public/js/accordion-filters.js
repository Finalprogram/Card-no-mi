document.addEventListener('DOMContentLoaded', () => {
  const filterToggles = document.querySelectorAll('.filter-toggle');

  filterToggles.forEach(toggle => {
    const optionsContainer = toggle.nextElementSibling;

    // Se um filtro neste grupo estiver ativo, expande a seção por padrão
    if (optionsContainer && optionsContainer.querySelector('input[type="radio"]:checked')) {
      optionsContainer.removeAttribute('hidden');
      toggle.classList.add('active');
    }

    toggle.addEventListener('click', () => {
      if (optionsContainer) {
        optionsContainer.toggleAttribute('hidden');
        toggle.classList.toggle('active');
      }
    });
  });
});
