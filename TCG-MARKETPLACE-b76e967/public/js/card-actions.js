document.addEventListener('DOMContentLoaded', () => {
  document.body.addEventListener('click', (event) => {
    // + Lista (em cards)
    if (event.target.classList.contains('add-to-list-btn')) {
      event.stopPropagation();
      const btn = event.target;
      const cardItem = btn.closest('.card-item');
      const input = cardItem?.querySelector('.quantity-input');
      const cardId = btn.dataset.cardid;
      const quantity = input ? input.value : 1;

      fetch('/api/list/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId, quantity }),
      })
        .then(res => res.json())
        .then(data => {
          if (data?.success) {
            const badge = document.querySelector('#floating-list-button .list-item-count');
            if (badge) {
              badge.textContent = data.totalItems;
              badge.classList.toggle('hidden', !data.totalItems || data.totalItems === 0);
            }
            const t = btn.textContent;
            btn.textContent = 'Adicionado!';
            btn.style.backgroundColor = '#28a745';
            setTimeout(() => { btn.textContent = t || '+ Lista'; btn.style.backgroundColor = ''; }, 1200);
          }
        })
        .catch(err => console.error('Erro ao adicionar à lista:', err));
    }
  });
});
