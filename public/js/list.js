/* ========================================================================
   LISTA — Toggle "Ver vendedores" por delegation (robusto)
========================================================================= */
(function () {
  // limite à página da lista (se existir); se não, usa document
  const root = document.querySelector('.want-list-container') || document;

  root.addEventListener('click', (e) => {
    const btn = e.target.closest('.toggle-sellers-btn, [data-toggle="sellers"]');
    if (!btn || !root.contains(btn)) return;

    e.preventDefault();
    e.stopPropagation();

    // 1) tenta via aria-controls / data-target
    let id = btn.getAttribute('aria-controls') || btn.dataset.target;
    let panel = id ? document.getElementById(id) : null;

    // 2) fallback: painel dentro do mesmo card
    if (!panel) {
      const card = btn.closest('.want-list-item, .card-row, .card-item, .list-card') || root;
      panel = card.querySelector(':scope > .sellers-panel') || card.querySelector('.sellers-panel');
    }
    if (!panel) {
      console.warn('[sellers] painel não encontrado para o botão:', btn);
      return;
    }

    // 3) estado atual
    const isHiddenAttr = panel.hasAttribute('hidden');
    const isHiddenCss  = getComputedStyle(panel).display === 'none' || panel.classList.contains('hidden');
    const willOpen = isHiddenAttr || isHiddenCss;

    if (willOpen) {
      panel.removeAttribute('hidden');
      panel.style.display = 'block';
      panel.classList.add('open');
      btn.innerHTML = 'Ocultar vendedores ▴';
      // injeta controles
      window.enhanceVendorRows?.(panel);
    } else {
      panel.setAttribute('hidden', '');
      panel.style.display = 'none';
      panel.classList.remove('open');
      btn.innerHTML = 'Ver vendedores ▾';
    }
  });
})();

/* ========================================================================
   LISTA — Injeta [−][qty][+] + Adicionar em cada .vendor-row
   (envia 'meta' junto ao /cart/add)
========================================================================= */
(function () {
  window.enhanceVendorRows = function enhanceVendorRows(scope = document) {
    const rows = Array.from(scope.querySelectorAll('.vendor-row'));
    if (!rows.length) return;

    rows.forEach(row => {
      if (row.__enhanced) return;

      // dados
      const cardId   = row.dataset.cardid   || '';
      const vendorId = row.dataset.vendorid || '';
      let   price    = Number(row.dataset.price || 0);
      const max      = Math.max(1, Number(row.dataset.available || 99));

      // fallback de preço pelo texto
      if (!price) {
        const priceCell = row.querySelector('.js-price-cell, .price');
        if (priceCell) {
          const txt = priceCell.textContent.replace(/[^\d,.,-]/g, '').replace('.', '').replace(',', '.');
          const n = parseFloat(txt);
          if (!Number.isNaN(n)) price = n;
        }
      }

      // destino: .action-cell (ou cria)
      let actionCell = row.querySelector('.action-cell');
      if (!actionCell) {
        actionCell = document.createElement('span');
        actionCell.className = 'right action-cell';
        row.appendChild(actionCell);
      }

      if (actionCell.querySelector('.vendor-actions')) {
        row.__enhanced = true;
        return;
      }

      // UI
      const wrap = document.createElement('div');
      wrap.className = 'vendor-actions';

      const qtyBox = document.createElement('div');
      qtyBox.className = 'qty-box';

      const minus = document.createElement('button');
      minus.type = 'button';
      minus.className = 'qty-btn minus';
      minus.textContent = '−';

      const input = document.createElement('input');
      input.type = 'number';
      input.className = 'qty-input';
      input.min = '1';
      input.max = String(max);
      input.value = '1';

      const plus = document.createElement('button');
      plus.type = 'button';
      plus.className = 'qty-btn plus';
      plus.textContent = '+';

      qtyBox.append(minus, input, plus);

      const addBtn = document.createElement('button');
      addBtn.type = 'button';
      addBtn.className = 'btn btn-primary add-cart';
      addBtn.textContent = 'Adicionar';

      wrap.append(qtyBox, addBtn);
      actionCell.appendChild(wrap);

      // qty
      minus.addEventListener('click', () => {
        input.value = String(Math.max(1, (parseInt(input.value || '1', 10) - 1)));
      });
      plus.addEventListener('click', () => {
        input.value = String(Math.min(max, (parseInt(input.value || '1', 10) + 1)));
      });

      // ===== add to cart (com META) =====
      addBtn.addEventListener('click', async () => {
        const qty = Math.max(1, Math.min(max, parseInt(input.value || '1', 10)));

        // Puxa infos do DOM para preencher meta
        const cardEl   = row.closest('.list-card, .want-list-item, .card-item');
        const cardName = cardEl?.querySelector('.card-title')?.textContent?.trim()
                      || cardEl?.querySelector('.summary-info h3')?.textContent?.trim()
                      || '';
        const imageUrl = cardEl?.querySelector('.card-thumb, .summary-img, img')?.src || '';

        // Em nossa tabela: 1º span = vendedor, 2º = condição, 3º = idioma, 4º = disp.
        const sellerName = row.querySelector('.seller-name')?.childNodes?.[0]?.textContent?.trim()
                        || row.querySelector('.seller-name')?.textContent?.trim()
                        || '';
        const conditionLabel = (row.children?.[1]?.textContent || '').trim();
        const languageLabel  = (row.children?.[2]?.textContent || '').trim();
        const availableLabel = (row.children?.[3]?.textContent || '').trim();

        const body = {
          cardId,
          vendorId,
          price,
          qty,
          meta: {
            cardName,
            imageUrl,
            sellerName,
            condition: conditionLabel,
            language: languageLabel,
            available: availableLabel
          }
        };

        const old = addBtn.textContent;
        addBtn.disabled = true;
        addBtn.textContent = 'Adicionando…';
        try {
          const res  = await fetch('/cart/add', {
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body: JSON.stringify(body)
          });
          const data = res.ok ? await res.json() : { count:0 };

          const badge = qs('#floating-cart-button .badge');
          if (badge) {
            const c = Number(data.count || 0);
            badge.textContent = String(c);
            badge.classList.toggle('hidden', c <= 0);
          }

          // se o modal estiver aberto, recarrega
          window.refreshCartIfOpen?.();

          addBtn.textContent = 'Adicionado ✓';
          setTimeout(() => { addBtn.textContent = old; addBtn.disabled = false; }, 900);
        } catch (err) {
          console.error('[cart/add] erro:', err);
          addBtn.textContent = 'Falhou';
          setTimeout(() => { addBtn.textContent = old; addBtn.disabled = false; }, 900);
        }
      });

      row.__enhanced = true;
    });
  };

  /*
  // O código abaixo, que chama enhanceVendorRows para painéis abertos por SSR e usa um MutationObserver,
  // foi comentado por ser considerado redundante. A função enhanceVendorRows já é chamada 
  // explicitamente quando um painel de vendedores é aberto ou quando os filtros são aplicados.

  // chama para painéis abertos por SSR
  qsa('.sellers-panel:not([hidden])').forEach(p => window.enhanceVendorRows(p));

  // observa abertura de gavetas e injeta quando abrir
  const obs = new MutationObserver(muts => {
    muts.forEach(m => {
      const el = m.target;
      if (!(el instanceof Element)) return;
      if (!el.classList?.contains('sellers-panel')) return;
      const isOpen = !el.hasAttribute('hidden') || el.classList.contains('open');
      if (isOpen) window.enhanceVendorRows(el);
    });
  });
  qsa('.sellers-panel').forEach(p => obs.observe(p, { attributes:true, attributeFilter:['hidden','class'] }));
  */
})();

/* ========================================================================
   LISTA — Remover item + Filtros (recarrega vendedores)
========================================================================= */
(() => {
  const root = qs('.want-list-container') || document;

  // remover item
  root.addEventListener('click', (event) => {
    if (!event.target.classList.contains('remove-from-list-btn') && !event.target.closest('.remove-item')) return;
    const btn = event.target.closest('.remove-from-list-btn, .remove-item');
    const cardId = btn?.dataset.cardid || btn?.dataset.remove;
    const row = btn?.closest('.want-list-item, .list-card');
    if (!cardId || !row) return;

    if (confirm('Tem certeza que deseja remover esta carta da lista?')) {
      fetch('/api/list/remove', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cardId })
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(data?.message || 'Falha ao remover');
          row.remove();
          window.showToast('Item removido da lista com sucesso!', 'success'); // Added success toast
        })
        .catch(err => window.showToast(`Erro ao remover item: ${err.message}`, 'error')); // Replaced alert
    }
  });

    // filtros (se sua rota existir)

    root.addEventListener('change', async (event) => {

      if (!event.target.classList.contains('filter-select')) return;

  

      const panel = event.target.closest('.sellers-panel');

      const listingsContainer = panel?.querySelector('.sellers-body');

      const cardId = panel?.closest('[data-card-id]')?.dataset.cardId;

      if (!panel || !listingsContainer || !cardId) return;

  

      const filters = {};

      panel.querySelectorAll('.filter-select').forEach(s => {

        if (s.value) filters[s.dataset.filter] = s.value;

      });

  

      listingsContainer.innerHTML = '<div class="no-sellers">Atualizando…</div>';

  

      try {

        const response = await fetch('/api/list/filter-sellers', {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify({ cardId, filters })

        });

        const listings = await response.json();

  

        if (Array.isArray(listings) && listings.length) {

          listingsContainer.innerHTML = listings.map(v => {

            const available  = v.availableQty || v.quantity || 0;

            const price      = Number(v.price || 0);

            const vendorId   = v.seller?._id || v.vendorId || v._id || v.sellerId || v.seller || '';

            const sellerName = v.seller?.username || v.sellerName || (v.seller && (v.seller.username || v.seller.name)) || v.seller || 'Vendedor';

            const condLabel  = v.conditionLabel || v.condition || '—';

            const langLabel  = v.languageLabel  || v.language  || '—';

            const isShop     = v.seller && v.seller.accountType === 'shop';

  

            return `

              <div class="seller-row vendor-row"

                   data-cardid="${cardId}"

                   data-vendorid="${vendorId}"

                   data-price="${price}"

                   data-available="${available}">

                <span class="seller-name">${sellerName} ${isShop ? '<span class="shop-badge">LOJA</span>' : ''}</span>

                <span>${condLabel}</span>

                <span>${langLabel}</span>

                <span>${available}</span>

                <span class="right price js-price-cell">${money(price)}</span>

                <span class="right qty-col"></span>

                <span class="right action-cell"></span>

              </div>`;

          }).join('');

          // injeta controles nas novas linhas

          window.enhanceVendorRows?.(panel);

        } else {

          listingsContainer.innerHTML = '<div class="no-sellers">Nenhum anúncio encontrado com estes filtros.</div>';

        }

      } catch (error) {

        console.error('Erro ao atualizar vendedores:', error);

        listingsContainer.innerHTML = '<div class="no-sellers">Erro ao carregar vendedores.</div>';

      }

    });

  })();
