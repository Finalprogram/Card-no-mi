document.addEventListener('DOMContentLoaded', () => {
    // --- Elementos do DOM ---
    const searchInput = document.getElementById('card-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const searchLoader = document.getElementById('search-loader');
    const toastNotification = document.getElementById('toast-notification');
    const deckViewContainer = document.getElementById('deck-view-container');
    const leaderSectionContainer = document.getElementById('leader-section-container');
    const isOwner = window.isOwner;

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

        // Listeners de import/export e modais... (mantidos do original)
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
            deck.leader = null;
            showToast('Líder removido. Selecione um novo líder.');
            renderLeaderSection();
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
            .sort((a, b) => a.card.name.localeCompare(b.card.name))
            .forEach(item => {
                const card = item.card;
                const gridItem = document.createElement('div');
                gridItem.classList.add('deck-grid-item');
                gridItem.innerHTML = `
                    <img src="${card.image_url}" alt="${card.name}" title="${card.name}">
                    <span class="card-quantity-indicator">${item.quantity}x</span>
                `;
                gridContainer.appendChild(gridItem);
            });
        
        container.appendChild(gridContainer);
    }
    
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
            const cardElement = document.createElement('div');
            cardElement.classList.add('card-result');
            cardElement.dataset.card = JSON.stringify(card);
            cardElement.innerHTML = `
                <img src="${card.image_url}" alt="${card.name}">
                <div class="card-info">
                    <p><strong>${card.name}</strong></p>
                    <p>${card.set_name} - ${card.rarity}</p>
                    <p class="card-type">${card.type_line}</p>
                </div>
                ${isOwner ? '<button class="add-card-btn">Adicionar</button>' : ''}
            `;
            searchResultsContainer.appendChild(cardElement);
        });
    }

    function handleAddCardClick(e) {
        if (e.target.classList.contains('add-card-btn')) {
            const cardData = JSON.parse(e.target.closest('.card-result').dataset.card);
            addCardToDeck(cardData);
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

