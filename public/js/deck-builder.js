document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const searchInput = document.getElementById('card-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const searchLoader = document.getElementById('search-loader');
    const toastNotification = document.getElementById('toast-notification');
    const deckViewContainer = document.getElementById('deck-view-container');
    const leaderSectionContainer = document.getElementById('leader-section-container');
    const isOwner = window.isOwner;
    const sidebarElement = document.querySelector('.sidebar'); // Adicionado para referenciar a sidebar

    // --- Estado da Aplicação ---
    let deck = initialDeck || {
        leader: null,
        main: [],
    };
    let activeView = 'padrão';
    let debounceTimer;

    // --- Inicialização ---
    function initialize() {
        // Checa se um líder foi pré-selecionado em outra página
        const storedLeader = sessionStorage.getItem('selectedLeader');
        if (storedLeader) {
            try {
                const selectedLeader = JSON.parse(storedLeader);
                deck.leader = { card: selectedLeader, quantity: 1 };
                sessionStorage.removeItem('selectedLeader');
                showToast(`Líder ${selectedLeader.name} pré-selecionado!`);
            } catch (e) {
                console.error('Erro ao parsear líder do sessionStorage:', e);
                sessionStorage.removeItem('selectedLeader');
            }
        }
        setupEventListeners();
        renderDeck(); // Renderização inicial completa
    }

    // --- Configuração de Eventos ---
    function setupEventListeners() {
        if (isOwner) {
            searchInput.addEventListener('input', handleSearchInput);
            searchResultsContainer.addEventListener('click', handleAddCardClick);
            leaderSectionContainer.addEventListener('click', handleLeaderActionClick);
        }
        
        document.querySelector('.deck-view-tabs').addEventListener('click', handleTabViewChange);
        
        const saveDeckBtn = document.getElementById('save-deck-btn');
        if (saveDeckBtn) saveDeckBtn.addEventListener('click', saveDeck);

        deckViewContainer.addEventListener('click', handleDeckActions);

        // Image zoom preview handlers (delegated) for search results
        if (searchResultsContainer) {
            searchResultsContainer.addEventListener('mouseover', onSearchImageOver);
            searchResultsContainer.addEventListener('mouseout', onSearchImageOut);
            searchResultsContainer.addEventListener('mousemove', onSearchImageMove);
            // keyboard accessibility: show on focus/blur
            searchResultsContainer.addEventListener('focusin', onSearchImageFocus);
            searchResultsContainer.addEventListener('focusout', onSearchImageBlur);
        }

        // Card detail modal handlers (delegated click on grid items)
        const cardDetailModal = document.getElementById('card-detail-modal');
        const cardDetailContent = document.getElementById('card-detail-content');
        if (cardDetailModal) {
            // Close button
            cardDetailModal.querySelector('.close-btn')?.addEventListener('click', () => {
                cardDetailModal.style.display = 'none';
                cardDetailModal.setAttribute('aria-hidden', 'true');
                cardDetailContent.innerHTML = '';
            });
            // Close when clicking overlay
            cardDetailModal.addEventListener('click', (ev) => {
                if (ev.target === cardDetailModal) {
                    cardDetailModal.style.display = 'none';
                    cardDetailModal.setAttribute('aria-hidden', 'true');
                    cardDetailContent.innerHTML = '';
                }
            });
        }

        // Listeners de import/export e modais... (mantidos do original)
    }

    // ---------------------- Image Zoom Preview Logic -----------------------
    let zoomPreviewEl = null;
    let zoomedImgSrc = null;

    function createZoomPreview(src, alt) {
        removeZoomPreview();
        zoomPreviewEl = document.createElement('div');
        zoomPreviewEl.className = 'image-zoom-preview';
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt || '';
        zoomPreviewEl.appendChild(img);
        document.body.appendChild(zoomPreviewEl);
    }

    function removeZoomPreview() {
        if (zoomPreviewEl && zoomPreviewEl.parentNode) {
            zoomPreviewEl.parentNode.removeChild(zoomPreviewEl);
        }
        zoomPreviewEl = null;
        zoomedImgSrc = null;
    }

    function positionZoomPreview(clientX, clientY) {
        if (!zoomPreviewEl) return;
        const padding = 12;
        const rect = zoomPreviewEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        // Try to position above the cursor, otherwise below
        let left = clientX + 18; // offset to the right of cursor
        let top = clientY - rect.height / 2;

        // Keep inside viewport horizontally
        if (left + rect.width + padding > vw) {
            left = clientX - rect.width - 18;
        }
        if (left < padding) left = padding;

        // Keep inside vertically
        if (top < padding) top = padding;
        if (top + rect.height + padding > vh) top = vh - rect.height - padding;

        zoomPreviewEl.style.left = `${Math.round(left)}px`;
        zoomPreviewEl.style.top = `${Math.round(top)}px`;
    }

    function onSearchImageOver(e) {
        const img = e.target.closest && e.target.closest('.card-result img');
        if (!img) return;
        // create preview if not same src
        if (img.src && img.src !== zoomedImgSrc) {
            zoomedImgSrc = img.src;
            createZoomPreview(img.src, img.alt || img.title || '');
            // initial position
            positionZoomPreview(e.clientX, e.clientY);
        }
    }

    function onSearchImageMove(e) {
        if (!zoomPreviewEl) return;
        positionZoomPreview(e.clientX, e.clientY);
    }

    function onSearchImageOut(e) {
        // If leaving an image element, remove preview
        const fromImg = e.target.closest && e.target.closest('.card-result img');
        if (fromImg) {
            removeZoomPreview();
        }
    }

    function onSearchImageFocus(e) {
        const img = e.target.closest && e.target.closest('.card-result img');
        if (!img) return;
        if (img.src && img.src !== zoomedImgSrc) {
            zoomedImgSrc = img.src;
            createZoomPreview(img.src, img.alt || img.title || '');
            // position near the image center
            const r = img.getBoundingClientRect();
            positionZoomPreview(r.right + 10, r.top + r.height / 2);
        }
    }

    function onSearchImageBlur(e) {
        const img = e.target.closest && e.target.closest('.card-result img');
        if (img) removeZoomPreview();
    }

    // ---------------------- Card Normalization Utility ----------------------
    // Some card objects come from different sources/shapes. Normalize them so
    // the rest of the UI (same logic as leader) can rely on consistent fields.
    function normalizeCardData(raw) {
        if (!raw) return {};
        let r = raw;
        // Unwrap common wrappers
        if (r.card) r = r.card;
        if (r._doc) r = r._doc;

        // Helpers to read fields with many possible aliases
        const pick = (obj, keys) => {
            for (const k of keys) {
                if (!obj) continue;
                const v = obj[k];
                if (v !== undefined && v !== null && v !== '') return v;
            }
            return undefined;
        };

        const image_url = pick(r, ['image_url', 'imageUrl', 'imageUrlLarge'])
            || (r.image_uris && (r.image_uris.normal || r.image_uris.large || r.image_uris.small))
            || (r.image && (r.image.large || r.image.small))
            || (r.card_faces && r.card_faces[0] && r.card_faces[0].image_uris && (r.card_faces[0].image_uris.normal || r.card_faces[0].image_uris.large))
            || '';

        const name = pick(r, ['name', 'card_name', 'title']) || '';
        const colors = Array.isArray(r.colors) ? r.colors : (r.color ? [r.color] : (r.color_identity || []));

        // Ability/text can live in many places; collect from common fields and faces
        let ability = pick(r, ['ability', 'text', 'oracle_text', 'description', 'rules_text', 'card_text', 'effect', 'long_text', 'oracle', 'flavor_text']) || '';
        if (!ability && Array.isArray(r.abilities) && r.abilities.length) {
            ability = r.abilities.map(a => (a.text || a)).filter(Boolean).join('\n');
        }
        if (!ability && Array.isArray(r.card_faces) && r.card_faces.length) {
            ability = r.card_faces.map(f => f.oracle_text || f.text || '').filter(Boolean).join('\n\n');
        }

        const cost = (r.cost !== undefined && r.cost !== null) ? r.cost : (r.mana_cost !== undefined ? r.mana_cost : r.cmc);
        const power = (r.power !== undefined && r.power !== null) ? r.power : (r.attack !== undefined ? r.attack : r.strength);
        const set_name = pick(r, ['set_name', 'set', 'setName']) || '';
        const type_line = pick(r, ['type_line', 'type', 'typeLine']) || '';
        const rarity = pick(r, ['rarity']) || '';
        const id = pick(r, ['_id', 'id', 'cardId', 'card_id']) || '';

        return {
            _id: id,
            name,
            image_url,
            colors,
            ability: ability || '',
            cost,
            power,
            set_name,
            type_line,
            rarity,
            // keep original raw for debugging if needed
            __raw: r
        };
    }

    // ==========================================================================
    // SEÇÃO DO LÍDER (NOVAS FUNÇÕES)
    // ==========================================================================

    function renderLeaderSection() {
        leaderSectionContainer.innerHTML = ''; // Limpa a seção
        if (deck.leader && deck.leader.card) {
            renderLeaderDetails(deck.leader);
        } else {
            renderLeaderPlaceholder();
        }
    }

    function renderLeaderPlaceholder() {
        const placeholderHTML = `
            <div class="leader-placeholder">
                <i class="ph-bold ph-user-circle-plus"></i>
                <h3>Nenhum Líder Selecionado</h3>
                <p>Use a busca para encontrar e adicionar um líder ao seu deck.</p>
            </div>
        `;
        leaderSectionContainer.innerHTML = placeholderHTML;
    }

    function renderLeaderDetails(leaderItem) {
        const card = leaderItem.card;
        console.log('Leader Card Data:', card); // Adicionado para depuração
        const colors = card.colors || [];
        const glowColor = getGlowColor(colors[0]);

        const detailsHTML = `
            <div class="leader-content">
                <div class="leader-card-image-wrapper" style="--glow-color: ${glowColor};">
                    <img src="${card.image_url}" alt="${card.name}" class="leader-card-image">
                </div>
                <div class="leader-details-panel">
                    <h2>${card.name}</h2>
                    <div class="leader-meta">
                        <div class="leader-colors">
                            ${colors.map(color => `<div class="color-chip ${color.toLowerCase()}" title="${color}"></div>`).join('')}
                        </div>
                        <span class="leader-power">Poder: ${card.power || 'N/A'}</span>
                        <span class="leader-set">Set: ${card.set_name || 'N/A'}</span>
                    </div>
                    <div class="leader-effect">
                        ${card.ability || 'Esta carta não possui efeito descrito.'}
                    </div>
                    <div class="leader-actions">
                        ${isOwner ? '<button id="change-leader-btn" class="btn btn-secondary"><i class="ph ph-swap"></i> Trocar Líder</button>' : ''}
                        <button id="confirm-leader-btn" class="btn btn-primary"><i class="ph ph-check-circle"></i> Confirmar</button>
                    </div>
                </div>
            </div>
        `;
        leaderSectionContainer.innerHTML = detailsHTML;
    }

    function handleLeaderActionClick(e) {
        if (e.target.closest('#change-leader-btn')) {
            window.location.href = '/decks/community';
        }
        if (e.target.closest('#confirm-leader-btn')) {
            document.getElementById('deck-view-container').scrollIntoView({ behavior: 'smooth' });
        }
    }

    function getGlowColor(color) {
        const colorMap = {
            'Red': 'var(--accent-red)',
            'Blue': 'var(--accent-blue)',
            'Green': 'var(--accent-green)',
            'Purple': '#6A1B9A',
            'Black': '#FFFFFF',
            'Yellow': '#FDD835'
        };
        return colorMap[color] || 'var(--accent-purple)';
    }

    // ==========================================================================
    // RENDERIZAÇÃO PRINCIPAL E VIEWS
    // ==========================================================================

    function renderDeck() {
        renderLeaderSection(); // Renderiza a seção do líder primeiro
        
        // Continua a renderizar a view ativa para o deck principal
        switch (activeView) {
            case 'padrão':
                renderPadrãoView(deckViewContainer);
                break;
            case 'raridade':
                renderRaridadeView(deckViewContainer);
                break;
            case 'grid':
                renderGridView(deckViewContainer);
                break;
            default:
                renderPadrãoView(deckViewContainer);
        }
        updateFinancialSummary();
    }

    function renderPadrãoView(container) {
        container.innerHTML = `
            <div class="deck-main">
                <h3>Deck Principal (<span id="main-deck-count">0</span>/50)</h3>
            </div>
            <div id="main-deck-cards"></div>
        `;
        const mainDeckContainer = container.querySelector('#main-deck-cards');
        const mainDeckCounter = container.querySelector('#main-deck-count');

        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        mainDeckCounter.textContent = mainDeckCount;

        deck.main
            .sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''))
            .forEach(item => {
                mainDeckContainer.appendChild(createDeckCardElement(item));
            });
    }

    function renderRaridadeView(container) {
        container.innerHTML = ''; // Limpa o container

        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        const header = document.createElement('h3');
        header.innerHTML = `Deck Principal (<span id="main-deck-count">${mainDeckCount}</span>/50)`;
        container.appendChild(header);

        if (deck.main.length === 0) {
            container.innerHTML += '<p class="placeholder-text">O deck principal está vazio.</p>';
            return;
        }

        // Agrupa as cartas por raridade
        const cardsByRarity = deck.main.reduce((acc, item) => {
            const rarity = item.card.rarity || 'Sem Raridade';
            if (!acc[rarity]) {
                acc[rarity] = [];
            }
            acc[rarity].push(item);
            return acc;
        }, {});

        // Ordena as raridades (opcional, mas bom para consistência)
        const sortedRarities = Object.keys(cardsByRarity).sort();

        // Renderiza cada grupo de raridade
        sortedRarities.forEach(rarity => {
            const raritySection = document.createElement('div');
            raritySection.classList.add('rarity-group');

            const rarityHeader = document.createElement('h4');
            rarityHeader.textContent = rarity;
            raritySection.appendChild(rarityHeader);

            const cardsContainer = document.createElement('div');
            cardsContainer.classList.add('rarity-group-cards');
            
            cardsByRarity[rarity]
                .sort((a, b) => a.card.name.localeCompare(b.card.name))
                .forEach(item => {
                    cardsContainer.appendChild(createDeckCardElement(item));
                });
            
            raritySection.appendChild(cardsContainer);
            container.appendChild(raritySection);
        });
    }

    function renderGridView(container) {
        container.innerHTML = ''; // Limpa o container

        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        const header = document.createElement('h3');
        header.innerHTML = `Deck Principal (<span id="main-deck-count">${mainDeckCount}</span>/50)`;
        container.appendChild(header);

        if (deck.main.length === 0) {
            container.innerHTML += '<p class="placeholder-text">O deck principal está vazio.</p>';
            return;
        }

        const gridContainer = document.createElement('div');
        gridContainer.classList.add('deck-grid-view');

        deck.main
            .sort((a, b) => (a.card?.name || '').localeCompare(b.card?.name || ''))
            .forEach(item => {
                // normalize card so we always have the same fields as leader
                const rawCard = item.card || {};
                const card = normalizeCardData(rawCard);
                const gridItem = document.createElement('div');
                gridItem.classList.add('deck-grid-item');
                gridItem.dataset.card = JSON.stringify(card);
                gridItem.innerHTML = `
                    <img src="${card.image_url}" alt="${card.name}" title="${card.name}">
                    <div class="grid-hover-overlay">Clique para detalhes</div>
                    <span class="card-quantity-indicator">${item.quantity}x</span>
                `;
                gridContainer.appendChild(gridItem);
            });
        
        container.appendChild(gridContainer);
    }

    // Show card details in modal
    function showCardDetail(card) {
        const modal = document.getElementById('card-detail-modal');
        const content = document.getElementById('card-detail-content');
        if (!modal || !content) return;

        const colors = card.colors || [];
        // Render color chips without text (visual indicators only), use data-title for custom tooltip
        const colorChips = colors.map(c => `<span class="color-chip ${c.toLowerCase()}" data-title="${c}"></span>`).join(' ');

        content.innerHTML = `
            <div class="card-detail-grid" style="display:flex;gap:1rem;align-items:flex-start;flex-wrap:wrap;">
                <div style="flex:0 0 260px;min-width:200px;">
                    <img src="${card.image_url || '/images/default-avatar.png'}" alt="${card.name}" style="width:100%;border-radius:8px;box-shadow:0 10px 30px rgba(0,0,0,0.5);" />
                </div>
                <div style="flex:1;min-width:300px;">
                    <h2 style="margin-top:0;margin-bottom:8px;">${card.name}</h2>
                    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">${colorChips}<span style="background:var(--muted);padding:4px 8px;border-radius:6px;font-weight:600;">${card.rarity||'N/A'}</span></div>
                    <div style="margin-bottom:8px;">
                        <strong>Tipo:</strong> ${card.type_line || 'N/A'}<br />
                        <strong>Set:</strong> ${card.set_name || 'N/A'}<br />
                        <strong>Custo:</strong> ${card.cost !== undefined ? card.cost : 'N/A'} &nbsp; <strong>Poder:</strong> ${card.power !== undefined ? card.power : 'N/A'}
                    </div>
                    <div style="background:var(--muted);padding:12px;border-radius:8px;color:var(--text-secondary);max-height:60vh;overflow:auto;">${card.ability || 'Esta carta não possui habilidade descrita.'}</div>
                </div>
            </div>
        `;

        modal.style.display = 'block';
        modal.setAttribute('aria-hidden', 'false');
    }

    // Delegate click for grid items to open card modal
    deckViewContainer.addEventListener('click', (e) => {
        const gridItem = e.target.closest('.deck-grid-item');
        if (!gridItem) return;
        // Only handle clicks when in grid view
        if (activeView !== 'grid') return;
        const cardJson = gridItem.dataset.card;
        if (!cardJson) return;
        try {
            const card = JSON.parse(cardJson);
            showCardDetail(card);
        } catch (err) {
            console.error('Erro ao parsear dados da carta para o modal:', err);
        }
    });
    
    function createDeckCardElement(item) {
        const card = item.card;
        const cardElement = document.createElement('div');
        cardElement.classList.add('deck-card');
        cardElement.dataset.cardId = card._id;

        cardElement.innerHTML = `
            <span>${item.quantity}x</span>
            <p>${card.name} (${card.set_name})</p>
            <div class="deck-card-actions">
                ${isOwner ? `
                <button class="remove-card-btn" title="Remover 1 cópia">-</button>
                <button class="add-copy-btn" title="Adicionar 1 cópia">+</button>
                ` : ''}
            </div>
        `;
        return cardElement;
    }

    // As outras funções de renderização de view (raridade, grid) e as funções de manipulação de cartas (add, remove)
    // permanecem majoritariamente as mesmas, mas precisam ser ajustadas para não mais se preocuparem com o líder.
    
    // ==========================================================================
    // MANIPULAÇÃO DO DECK
    // ==========================================================================

    function handleSearchInput() {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput.value;
            if (query.length < 3) {
                searchResultsContainer.innerHTML = '<p class="placeholder-text">Busque por uma carta para começar!</p>';
                return;
            }
            fetchCards(query);
        }, 500);
    }

    function fetchCards(query) {
        searchLoader.style.display = 'block';
        fetch(`/api/decks/search-cards?q=${query}`)
            .then(response => response.json())
            .then(renderSearchResults)
            .catch(error => {
                console.error('Erro ao buscar cartas:', error);
                searchResultsContainer.innerHTML = '<p>Erro ao buscar cartas.</p>';
            })
            .finally(() => {
                searchLoader.style.display = 'none';
            });
    }

    function renderSearchResults(cards) {
        searchResultsContainer.innerHTML = '';
        if (cards.length === 0) {
            searchResultsContainer.innerHTML = `<p>Nenhuma carta encontrada.</p>`;
            return;
        }
        cards.forEach(card => {
            // Normalize incoming card data so fields match leader's shape
            const c = normalizeCardData(card);
            const cardElement = document.createElement('div');
            cardElement.classList.add('card-result');
            cardElement.dataset.card = JSON.stringify(c);
            cardElement.innerHTML = `
                <img src="${c.image_url}" alt="${c.name}" tabindex="0" class="search-thumb">
                <div class="card-info">
                    <p><strong>${c.name}</strong></p>
                    <p>${c.set_name} - ${c.rarity}</p>
                    <p class="card-type">${c.type_line}</p>
                </div>
                ${isOwner ? '<button class="add-card-btn">Adicionar</button>' : ''}
            `;
            searchResultsContainer.appendChild(cardElement);
        });
        // Scroll to the bottom after rendering new results
        if (sidebarElement) {
            sidebarElement.scrollTop = sidebarElement.scrollHeight;
        }
    }

    function handleAddCardClick(e) {
        // If clicked the add button, add card to deck
        if (e.target.classList.contains('add-card-btn')) {
            try {
                const cardData = JSON.parse(e.target.closest('.card-result').dataset.card);
                addCardToDeck(cardData);
            } catch (err) {
                console.error('Não foi possível obter dados da carta (add):', err, e.target.closest('.card-result'));
            }
            return;
        }

        // If clicked elsewhere on the card result (not the add button), open details modal
        const cardResult = e.target.closest && e.target.closest('.card-result');
        if (cardResult && !e.target.classList.contains('add-card-btn')) {
            try {
                const cardJson = cardResult.dataset.card;
                if (!cardJson) {
                    console.warn('Resultado da busca sem dados da carta em dataset.card', cardResult);
                    return;
                }
                const cardData = JSON.parse(cardJson);
                showCardDetail(cardData);
            } catch (err) {
                console.error('Erro ao abrir modal de detalhes da carta:', err, cardResult);
            }
        }
    }

    function addCardToDeck(card) {
        if (card.type_line === 'LEADER') {
            if (!deck.leader) {
                deck.leader = { card: card, quantity: 1 };
                showToast(`Líder ${card.name} adicionado!`);
                renderDeck();
            } else {
                showToast('Só pode haver 1 Líder no deck. Troque o atual para adicionar um novo.');
            }
            return;
        }

        const currentMainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);

        // Check if adding a new card would exceed the 50-card limit
        if (currentMainDeckCount >= 50) {
            showToast('O deck principal já atingiu o limite de 50 cartas.');
            return;
        }

        const existingCard = deck.main.find(i => i.card._id === card._id);
        if (existingCard) {
            if (existingCard.quantity < 4) {
                existingCard.quantity++;
            } else {
                showToast(`Você já tem 4 cópias de ${card.name} no deck.`);
                return;
            }
        } else {
            deck.main.push({ card: card, quantity: 1 });
        }
        showToast(`${card.name} adicionado ao deck.`);
        renderDeck();
    }

    function decreaseCardQuantity(cardId) {
        const existingCard = deck.main.find(i => i.card._id === cardId);
        if (existingCard) {
            existingCard.quantity--;
            if (existingCard.quantity === 0) {
                deck.main = deck.main.filter(i => i.card._id !== cardId);
            }
        }
    }
    
    function increaseCardQuantity(cardId) {
        const existingCard = deck.main.find(i => i.card._id === cardId);
        if (existingCard) {
            if (existingCard.quantity < 4) {
                existingCard.quantity++;
            } else {
                showToast(`Você já tem 4 cópias de ${existingCard.card.name} no deck.`);
            }
        }
    }

    function handleDeckActions(e) {
        const target = e.target;
        const cardElement = target.closest('.deck-card');
        if (!cardElement) return;
    
        const cardId = cardElement.dataset.cardId;
    
        if (target.classList.contains('add-copy-btn')) {
            increaseCardQuantity(cardId);
            renderDeck();
        }
    
        if (target.classList.contains('remove-card-btn')) {
            decreaseCardQuantity(cardId);
            renderDeck();
        }
    }

    // --- Funções utilitárias e de UI ---
    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.classList.add('show');
        setTimeout(() => {
            toastNotification.classList.remove('show');
        }, 3000);
    }
    
    function handleTabViewChange(e) {
        if (e.target.classList.contains('tab-btn')) {
            document.querySelector('.tab-btn.active').classList.remove('active');
            e.target.classList.add('active');
            activeView = e.target.dataset.view;
            renderDeck();
        }
    }

    function updateFinancialSummary() {
        // Lógica mantida...
    }

    async function saveDeck() {
        const title = document.getElementById('deck-title').value;
        const description = document.getElementById('deck-description').value;
        const isPublic = document.getElementById('deck-is-public').checked;

        if (!title) {
            showToast('O título do deck é obrigatório.');
            return;
        }

        if (!deck.leader) {
            showToast('É obrigatório selecionar um líder para o deck.');
            return;
        }

        // Prepare the payload
        const payload = {
            title,
            description,
            isPublic,
            leader: {
                card: deck.leader.card._id,
                quantity: 1
            },
            main: deck.main.map(item => ({
                card: item.card._id,
                quantity: item.quantity
            }))
        };

        const deckId = initialDeck?._id;
        const url = deckId ? `/api/decks/${deckId}` : '/api/decks';
        const method = deckId ? 'PUT' : 'POST';

        try {
            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const savedDeck = await response.json();
                showToast('Deck salvo com sucesso!');

                if (method === 'POST') {
                    // After creating a new deck, redirect to the "My Decks" page
                    window.location.href = '/my-decks';
                } else {
                    // For updates, just update the initialDeck object
                    Object.assign(initialDeck, savedDeck);
                }
            } else {
                const errorData = await response.json();
                showToast(`Erro ao salvar o deck: ${errorData.message}`);
            }
        } catch (error) {
            console.error('Erro ao salvar o deck:', error);
            showToast('Ocorreu um erro de rede ao tentar salvar o deck.');
        }
    }

    // --- Inicializa a aplicação ---
    initialize();
});

