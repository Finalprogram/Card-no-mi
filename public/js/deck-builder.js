document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('card-search-input');
    const searchResultsContainer = document.getElementById('search-results');
    const leaderCardContainer = document.getElementById('leader-card');
    const mainDeckContainer = document.getElementById('main-deck-cards');
    const mainDeckCounter = document.querySelector('.deck-main h3');
    const searchLoader = document.getElementById('search-loader');
    const toastNotification = document.getElementById('toast-notification');
    const deckViewContainer = document.getElementById('deck-view-container');
    const leaderPlaceholder = document.querySelector('.leader-placeholder');

    let deck = {
        leader: null,
        main: [],
    };

    if (initialDeck) {
        deck = initialDeck;
    }

    let activeView = 'padrão';
    let debounceTimer;

    function showToast(message) {
        toastNotification.textContent = message;
        toastNotification.style.display = 'block';
        setTimeout(() => {
            toastNotification.style.display = 'none';
        }, 3000);
    }

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const query = searchInput.value;
            if (query.length < 3) {
                searchResultsContainer.innerHTML = '';
                return;
            }

            searchLoader.style.display = 'block';
            fetch(`/api/decks/search-cards?q=${query}`)
                .then(response => response.json())
                .then(cards => {
                    renderSearchResults(cards);
                })
                .catch(error => {
                    console.error('Erro ao buscar cartas:', error);
                    searchResultsContainer.innerHTML = '<p>Erro ao buscar cartas.</p>';
                })
                .finally(() => {
                    searchLoader.style.display = 'none';
                });
        }, 300); // 300ms debounce
    });

    function renderSearchResults(cards) {
        searchResultsContainer.innerHTML = '';
        if (cards.length === 0) {
            const query = searchInput.value;
            searchResultsContainer.innerHTML = `
                <p>Nenhuma carta encontrada para "${query}".</p>
            `;
            return;
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.classList.add('card-result', card.status);
            cardElement.dataset.card = JSON.stringify(card);
            cardElement.innerHTML = `
                <img src="${card.image_url}" alt="${card.name}">
                <div class="card-info">
                    <p><strong>${card.name}</strong></p>
                    <p>${card.set_name} - ${card.rarity}</p>
                    <p class="card-type">${card.type_line}</p>
                </div>
                <button class="add-card-btn">Adicionar</button>
            `;
            searchResultsContainer.appendChild(cardElement);
        });
    }

    searchResultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('add-card-btn')) {
            const cardData = JSON.parse(e.target.closest('.card-result').dataset.card);
            addCardToDeck(cardData);
        }
    });

    function addCardToDeck(card) {
        // Handle Leader cards
        if (card.type_line && typeof card.type_line === 'string' && card.type_line === 'LEADER') {
            if (!deck.leader) {
                deck.leader = { card: card, quantity: 1 };
                showToast(`Líder ${card.name} adicionado ao deck!`);
                leaderPlaceholder.style.display = 'none';
                renderDeck();
            } else {
                showToast('Só pode haver 1 carta do tipo Líder no deck!');
            }
            return; // Stop execution after handling leader card
        }

        // Handle Main Deck cards
        const cardId = card._id;
        const existingCard = deck.main.find(i => {
            return i.card._id === cardId;
        });

        if (existingCard) {
            if (existingCard.quantity < 4) {
                existingCard.quantity++;
                showToast(`Adicionado ${card.name} ao deck. Total: ${existingCard.quantity}`);
                renderDeck();
            }
        } else {
            deck.main.push({ 
                card: card,
                quantity: 1 
            });
            showToast('Carta adicionada ao deck!');
            renderDeck();
        }
    }

    function renderDeck() {

        switch (activeView) {
            case 'padrão':
                renderPadrãoView(deckViewContainer);
                break;
            case 'raridade':
                renderRaridadeView(deckViewContainer);
                break;
            case 'visual':
                renderVisualView(deckViewContainer);
                break;
            case 'grid':
                renderGridView(deckViewContainer);
                break;
            // Add other views here
            default:
                renderPadrãoView(deckViewContainer);
        }
    }

    function createDeckCardElement(item) {
        const cardElement = document.createElement('div');
        cardElement.classList.add('deck-card');
        const card = item.card;

        cardElement.dataset.cardId = card._id;

        cardElement.innerHTML = `
            <span>${item.quantity}x</span>
            <p>${card.name} (${card.set_name}) - R$ ${card.price ? card.price.toFixed(2) : '0.00'}</p>
            <button class="remove-card-btn">-</button>
            <button class="add-copy-btn">+</button>
        `;
        return cardElement;
    }

    renderDeck(); // Initial render

    deckViewContainer.addEventListener('click', (e) => {
        const target = e.target;
        const cardElement = target.closest('.deck-card');
        if (!cardElement) return;

        const cardId = cardElement.dataset.cardId;
        const item = deck.main.find(i => {
            const i_id = i.ghostCard ? i.ghostCard.name : i.card._id;
            return i_id === cardId;
        });

        if (target.classList.contains('remove-card-btn')) {
            item.quantity--;
            if (item.quantity === 0) {
                deck.main = deck.main.filter(i => {
                    const i_id = i.ghostCard ? i.ghostCard.name : i.card._id;
                    return i_id !== cardId;
                });
            }
        }

        if (target.classList.contains('add-copy-btn')) {
            if (item.quantity < 4) {
                item.quantity++;
                        }
                    }
                    renderDeck();
                    showToast('Carta adicionada ao deck!');
                });

    const saveDeckBtn = document.getElementById('save-deck-btn');
    saveDeckBtn.addEventListener('click', () => {
        const title = document.getElementById('deck-title').value;
        const description = document.getElementById('deck-description').value;

        if (!title) {
            showToast('Por favor, dê um título ao seu deck.');
            return;
        }

        const deckData = {
            title,
            description,
            leader: deck.leader,
            main: deck.main
        };

        const method = deck._id ? 'PUT' : 'POST';
        const url = deck._id ? `/api/decks/${deck._id}` : '/api/decks';

        fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(deckData),
        })
        .then(response => response.json())
        .then(data => {
            if (data.message) {
                showToast(data.message);
            } else {
                showToast('Deck salvo com sucesso!');
                setTimeout(() => {
                    window.location.href = '/my-decks'; // Redirect to decks page
                }, 1000);
            }
        })
        .catch(error => {
            console.error('Erro ao salvar o deck:', error);
            showToast('Erro ao salvar o deck.');
        });
    });

    const validateDeckBtn = document.getElementById('validate-deck-btn');
    validateDeckBtn.addEventListener('click', () => {
        validateDeck();
    });

    function validateDeck() {
        const validationSummary = document.getElementById('validation-summary');
        validationSummary.innerHTML = '';
        let errors = [];

        // 1. Leader check
        if (!deck.leader) {
            errors.push('O deck deve ter 1 líder.');
        }

        // 2. Main deck count
        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        if (mainDeckCount !== 50) {
            errors.push(`O deck principal deve ter 50 cartas (atualmente tem ${mainDeckCount}).`);
        }

        // 3. Max 4 copies
        deck.main.forEach(item => {
            if (item.quantity > 4) {
                const cardName = item.card ? item.card.name : item.ghostCard.name;
                errors.push(`Você só pode ter até 4 cópias de cada carta (problema com "${cardName}").`);
            }
        });

        if (errors.length > 0) {
            validationSummary.classList.add('errors');
            validationSummary.classList.remove('success');
            validationSummary.innerHTML = `<ul>${errors.map(e => `<li>${e}</li>`).join('')}</ul>`;
        } else {
            validationSummary.classList.add('success');
            validationSummary.classList.remove('errors');
            validationSummary.innerHTML = '<p>Deck válido!</p>';
        }
    }

    const viewTabs = document.querySelector('.deck-view-tabs');

    viewTabs.addEventListener('click', (e) => {
        if (e.target.classList.contains('tab-btn')) {
            viewTabs.querySelector('.active').classList.remove('active');
            e.target.classList.add('active');
            activeView = e.target.dataset.view;
            renderDeck();
        }
    });

    function renderGridView(container) {
        const gridContainer = document.createElement('div');
        gridContainer.classList.add('deck-grid-container');
        deck.main.forEach(item => {
            gridContainer.appendChild(createGridDeckCardElement(item));
        });
        container.appendChild(gridContainer);
    }

    function createGridDeckCardElement(item) {
        const cardContainer = document.createElement('div');
        cardContainer.classList.add('deck-card-grid-container');
        const card = item.card;

        for (let i = 0; i < item.quantity; i++) {
            const cardElement = document.createElement('div');
            cardElement.classList.add('deck-card-grid');
            if (i > 0) {
                cardElement.classList.add('stacked-card');
                cardElement.style.transform = `translate(${i * 5}px, ${i * 5}px)`;
                cardElement.style.zIndex = -i;
            }
            cardElement.innerHTML = `
                <img src="${card.image_url}" alt="${card.name}">
            `;
            cardContainer.appendChild(cardElement);
        }

        const quantitySpan = document.createElement('span');
        quantitySpan.textContent = `${item.quantity}x`;
        cardContainer.appendChild(quantitySpan);

        return cardContainer;
    }

    function renderVisualView(container) {
        deck.main.forEach(item => {
            container.appendChild(createVisualDeckCardElement(item));
        });
    }

    function createVisualDeckCardElement(item) {
        const cardElement = document.createElement('div');
        cardElement.classList.add('deck-card-visual');
        const card = item.card;

        cardElement.innerHTML = `
            <img src="${card.image_url}" alt="${card.name}">
            <div>
                <p><strong>${card.name}</strong></p>
                <p>${item.quantity}x</p>
            </div>
        `;
        return cardElement;
    }

    function renderRaridadeView(container) {
        const groupedByRarity = {};

        deck.main.forEach(item => {
            const rarity = item.card ? item.card.rarity : 'Fantasma';
            if (!groupedByRarity[rarity]) {
                groupedByRarity[rarity] = [];
            }
            groupedByRarity[rarity].push(item);
        });

        for (const rarity in groupedByRarity) {
            const section = document.createElement('div');
            section.innerHTML = `<h3>${rarity}</h3>`;
            groupedByRarity[rarity].forEach(item => {
                section.appendChild(createDeckCardElement(item));
            });
            container.appendChild(section);
        }
    }

    function renderPadrãoView(container) {
        leaderCardContainer.innerHTML = ''; // Clear container at the beginning

        // Leader
        if (deck.leader) {
            leaderCardContainer.appendChild(createDeckCardElement(deck.leader));
            leaderPlaceholder.style.display = 'none';
        } else {
            leaderPlaceholder.style.display = 'flex'; // Or 'block', depending on desired layout
        }

        // Main Deck
        mainDeckContainer.innerHTML = '';
        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        mainDeckCounter.textContent = `Deck Principal (${mainDeckCount}/50)`;
        deck.main.sort((a, b) => {
            const nameA = a.card ? a.card.name : '';
            const nameB = b.card ? b.card.name : '';
            return nameA.localeCompare(nameB);
        });
        deck.main.forEach(item => {
            mainDeckContainer.appendChild(createDeckCardElement(item));
        });
        // container.appendChild(mainDeckSection);
        updateFinancialSummary();
    }

    function updateFinancialSummary() {
        const availablePriceEl = document.getElementById('available-price');
        const totalPriceEl = document.getElementById('total-price');

        let availablePrice = 0;

        if (deck.leader && deck.leader.card && deck.leader.card.status === 'available') {
            availablePrice += deck.leader.card.price || 0;
        }

        deck.main.forEach(item => {
            if (item.card && item.card.status === 'available') {
                availablePrice += (item.card.price || 0) * item.quantity;
            }
        });

        availablePriceEl.textContent = `R$ ${availablePrice.toFixed(2)}`;
        totalPriceEl.textContent = `R$ ${availablePrice.toFixed(2)}`;
    }

    // Initial render
    renderDeck();

    const importDeckBtn = document.getElementById('import-deck-btn');
    const exportDeckBtn = document.getElementById('export-deck-btn');
    const importModal = document.getElementById('import-deck-modal');
    const closeModalBtn = document.querySelector('.close-btn');
    const importConfirmBtn = document.getElementById('import-deck-confirm-btn');

    importDeckBtn.addEventListener('click', () => {
        importModal.style.display = 'block';
    });

    closeModalBtn.addEventListener('click', () => {
        importModal.style.display = 'none';
    });

    window.addEventListener('click', (event) => {
        if (event.target == importModal) {
            importModal.style.display = 'none';
        }
    });

    importConfirmBtn.addEventListener('click', () => {
        const decklist = document.getElementById('deck-import-textarea').value;
        fetch('/api/decks/parse', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ decklist }),
        })
        .then(response => response.json())
        .then(parsedDeck => {
            deck = parsedDeck;
            renderDeck();
            importModal.style.display = 'none';
        })
        .catch(error => {
            console.error('Erro ao importar deck:', error);
            alert('Erro ao importar deck.');
        });
    });

    exportDeckBtn.addEventListener('click', () => {
        exportDeckAsTxt();
        exportDeckAsJson();
    });

    function exportDeckAsTxt() {
        let content = `Líder:\n`;
        if (deck.leader) {
            const card = deck.leader.card;
            content += `1 ${card.name}\n`;
        }
        content += `\nDeck Principal:\n`;
        deck.main.forEach(item => {
            const card = item.card;
            content += `${item.quantity} ${card.name}\n`;
        });

        const blob = new Blob([content], { type: 'text/plain' });
        const anchor = document.createElement('a');
        anchor.download = `${deck.title || 'deck'}.txt`;
        anchor.href = window.URL.createObjectURL(blob);
        anchor.click();
        window.URL.revokeObjectURL(anchor.href);
    }

    function exportDeckAsJson() {
        const content = JSON.stringify(deck, null, 2);
        const blob = new Blob([content], { type: 'application/json' });
        const anchor = document.createElement('a');
        anchor.download = `${deck.title || 'deck'}.json`;
        anchor.href = window.URL.createObjectURL(blob);
        anchor.click();
        window.URL.revokeObjectURL(anchor.href);
    }
});
