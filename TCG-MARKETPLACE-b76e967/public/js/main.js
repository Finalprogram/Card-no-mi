/* ========================================================================
   Helpers DOM — definidos uma única vez
========================================================================= */
(function () {
  if (!window.__domHelpers__) {
    window.__domHelpers__ = true;
    window.qs  = (sel, root = document) => root.querySelector(sel);
    window.qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  }
})();
// const qs  = window.qs;
// const qsa = window.qsa;
window.money = (n) => {
  let priceStr = 'R$ ' + Number(n || 0).toFixed(2).replace('.', ',');
  if (priceStr.endsWith(',00')) {
    return priceStr.slice(0, -3);
  }
  return priceStr;
};

/* ========================================================================
   UI GLOBAL
========================================================================= */
document.addEventListener('DOMContentLoaded', () => {
  // Dropdown do usuário
  const userDropdown = qs('.user-dropdown');
  if (userDropdown) {
    const toggle = userDropdown.querySelector('.dropdown-toggle');
    toggle?.addEventListener('click', (e) => {
      e.stopPropagation();
      userDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (userDropdown.classList.contains('active') && !userDropdown.contains(e.target)) {
        userDropdown.classList.remove('active');
      }
    });
  }

  // Test Dropdown
  const testDropdown = qs('.test-dropdown');
  if (testDropdown) {
    const toggle = testDropdown.querySelector('.test-dropdown-toggle');
    toggle?.addEventListener('click', () => {
      testDropdown.classList.toggle('active');
    });
  }

  // + Lista (em cards) e qty +/- genéricos
  document.body.addEventListener('click', (event) => {
    /*
    // qty +/- em qualquer .quantity-selector
    // Este bloco foi comentado por ser uma implementação genérica.
    // A lógica de quantidade é tratada de forma mais específica no modal do carrinho e na injeção de linhas de vendedor.
    if (event.target.classList.contains('quantity-btn')) {
      const btn = event.target;
      const wrap = btn.closest('.quantity-selector');
      const input = wrap?.querySelector('.quantity-input');
      if (!input) return;
      let val = parseInt(input.value || '1', 10);
      if (btn.classList.contains('plus'))  val = val + 1;
      if (btn.classList.contains('minus')) val = Math.max(1, val - 1);
      input.value = String(val);
    }
    */


  });
});

/* ========================================================================
   CARRINHO — Modal lateral (abre pelo botão flutuante)
========================================================================= */
(() => {
  if (window.__cartBound) return;
  window.__cartBound = true;

  const fab      = qs('#floating-cart-button');
  const modal    = qs('#cart-modal');
  const backdrop = qs('#cart-backdrop');
  const content  = qs('#cart-content');
  const totalEl  = qs('#cart-total');
  const closeBtn = qs('#cart-close-btn');
  const clearBtn = qs('#cart-clear-btn');

  if (!modal || !backdrop) return; // página sem modal, ignore

  let lastFocus;

  async function loadCart() {
    if (!content || !totalEl) return;
    try {
      const res  = await fetch('/cart/json', { headers: { 'Accept': 'application/json' } });
      const cart = res.ok ? await res.json() : { items: [], totalQty: 0, totalPrice: 0 };

      if (!cart.items?.length) {
        content.innerHTML = `
          <div class="cart-empty">
            <p>Seu carrinho está vazio.</p>
            <a href="/cards" class="btn btn-primary">Explorar cartas</a>
          </div>`;
        totalEl.textContent = money(0);
      } else {
        content.innerHTML = cart.items.map(it => {
          const img  = it?.meta?.imageUrl ? `<img src="${it.meta.imageUrl}" class="cart-thumb" alt="">` : '';
          const name = (it?.meta?.cardName || '').trim() || 'Carta';

          // oculta ids tipo ObjectId quando faltar meta de vendedor
          const vendRaw = (it?.meta?.sellerName || it.vendorId || '').trim();
          const vend = /^[a-f0-9]{24}$/i.test(vendRaw) ? '' : vendRaw;

          const cond = it?.meta?.condition ? ` • ${it.meta.condition}` : '';
          const line = (it.qty * it.price);
          return `
            <div class="cart-row" data-key="${it.key}">
              <div class="cart-left">
                ${img}
                <div class="cart-info">
                  <div class="cart-title">${name}</div>
                  <div class="cart-sub">${vend ? `Vendedor: ${vend}` : ''}${cond}</div>
                </div>
              </div>
              <div class="cart-right">
                <div class="cart-price">${money(it.price)}</div>
                <div class="qty-box">
                  <button class="qty-btn minus" type="button">−</button>
                  <input class="qty-input" type="number" min="1" value="${it.qty}">
                  <button class="qty-btn plus" type="button">+</button>
                </div>
                <div class="cart-line-total">${money(line)}</div>
                <button class="btn icon-only cart-remove" title="Remover">✕</button>
              </div>
            </div>`;
        }).join('');
        totalEl.textContent = money(cart.totalPrice);
      }

      // badge no FAB
      const badge = qs('#floating-cart-button .badge');
      if (badge) {
        const c = Number(cart.totalQty || 0);
        badge.textContent = String(c);
        badge.classList.toggle('hidden', c <= 0);
      }
    } catch (err) {
      console.error('[cart] loadCart error:', err);
      if (content) content.innerHTML = '<div class="cart-empty"><p>Não foi possível carregar o carrinho.</p></div>';
      if (totalEl) totalEl.textContent = money(0);
    }
  }

  function openCart(e) {
    e?.preventDefault?.();
    lastFocus = document.activeElement;

    modal.removeAttribute('hidden');
    backdrop.removeAttribute('hidden');
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = '';

    (qs('#cart-close-btn', modal) || modal).focus?.();
    loadCart();
  }

  function closeCart() {
    if (modal.contains(document.activeElement)) document.activeElement.blur();

    modal.setAttribute('hidden', '');
    backdrop.setAttribute('hidden', '');
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';

    lastFocus?.focus?.();
  }

  fab?.setAttribute('href', '#');
  fab?.addEventListener('click', openCart);
  backdrop?.addEventListener('click', closeCart);
  closeBtn?.addEventListener('click', closeCart);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeCart(); });

  clearBtn?.addEventListener('click', async (e) => {
    e.preventDefault();
    await fetch('/cart/clear', { method:'POST' });
    loadCart();
  });

  content?.addEventListener('click', async (ev) => {
    const row = ev.target.closest('.cart-row'); if (!row) return;
    const key = row.dataset.key;

    if (ev.target.closest('.qty-btn.minus') || ev.target.closest('.qty-btn.plus')) {
      const input = row.querySelector('.qty-input'); if (!input) return;
      let val = parseInt(input.value || '1', 10);
      if (ev.target.closest('.qty-btn.minus')) val = Math.max(1, val - 1);
      if (ev.target.closest('.qty-btn.plus'))  val = Math.max(1, val + 1);
      input.value = String(val);
      await fetch('/cart/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key, qty: val }) });
      loadCart();
    }

    if (ev.target.closest('.cart-remove')) {
      await fetch('/cart/remove', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key }) });
      loadCart();
    }
  });

  content?.addEventListener('change', async (ev) => {
    const input = ev.target.closest('.qty-input'); if (!input) return;
    const row = ev.target.closest('.cart-row');   if (!row) return;
    const key = row.dataset.key;
    const val = Math.max(1, parseInt(input.value || '1', 10));
    input.value = String(val);
    await fetch('/cart/update', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ key, qty: val }) });
    loadCart();
  });

  // expõe compat para recarregar se o modal estiver aberto
  window.refreshCartIfOpen = () => { if (!modal.hasAttribute('hidden')) loadCart(); };
})();

  // Função para exibir notificações toast
  window.showToast = (message, type = 'info') => {
    const toastContainer = document.getElementById('toast-container') || (() => {
      const div = document.createElement('div');
      div.id = 'toast-container';
      Object.assign(div.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: '1000',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      });
      document.body.appendChild(div);
      return div;
    })();

    const toast = document.createElement('div');
    toast.classList.add('toast', `toast-${type}`);
    toast.textContent = message;
    Object.assign(toast.style, {
      backgroundColor: type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#007bff',
      color: 'white',
      padding: '10px 20px',
      borderRadius: '5px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      opacity: '0',
      transition: 'opacity 0.5s ease-in-out'
    });

    toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '1';
    }, 100);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3000);
  };
