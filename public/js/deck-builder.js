document.addEventListener('DOMContentLoaded', () => {
    console.log('deck-builder.js loaded'); // Debug log
    const isOwner = window.isOwner;
    console.log('isOwner:', isOwner); // Debug log
    const searchInput = document.getElementById('card-search-input');
    console.log('searchInput element:', searchInput); // Debug log
    const searchResultsContainer = document.getElementById('search-results');
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
        if (!isOwner) return;
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
                    console.log('API returned cards:', cards); // Debug log
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
        console.log('renderSearchResults called with cards:', cards); // Debug log
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
                ${isOwner ? '<button class="add-card-btn">Adicionar</button>' : ''}
            `;
            searchResultsContainer.appendChild(cardElement);
        });
    }

    searchResultsContainer.addEventListener('click', (e) => {
        if (!isOwner) return;
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
        const ghostCard = item.ghostCard;

        if (card) {
            const imageUrl = card.image_url === 'placeholder-leader.png' ? '/images/default-avatar.png' : card.image_url;
            cardElement.dataset.cardId = card._id;
            cardElement.innerHTML = `
                <span>${item.quantity}x</span>
                <p>${card.name} (${card.set_name}) - R$ ${card.price ? card.price.toFixed(2) : '0.00'}</p>
                ${window.isOwner ? `<button class="remove-card-btn">-</button>
                <button class="add-copy-btn">+</button>` : ''}
            `;
        } else if (ghostCard) {
            cardElement.dataset.cardId = ghostCard.name;
            cardElement.classList.add('ghost-card');
            cardElement.innerHTML = `
                <span>${item.quantity}x</span>
                <p>${ghostCard.name} (Não encontrada)</p>
                ${window.isOwner ? `<button class="remove-card-btn">-</button>
                <button class="add-copy-btn">+</button>` : ''}
            `;
        }
        return cardElement;
    }

    renderDeck(); // Initial render

    deckViewContainer.addEventListener('click', (e) => {
        if (!isOwner) return;
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
    });

    const saveDeckBtn = document.getElementById('save-deck-btn');
    if (saveDeckBtn) {
        saveDeckBtn.addEventListener('click', () => {
            const title = document.getElementById('deck-title').value;
            const description = document.getElementById('deck-description').value;
            const isPublic = document.getElementById('deck-is-public').checked;

            if (!title) {
                showToast('Por favor, dê um título ao seu deck.');
                return;
            }

            const deckData = {
                title,
                description,
                isPublic,
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
    }

    const validateDeckBtn = document.getElementById('validate-deck-btn');
    if (validateDeckBtn) {
        validateDeckBtn.addEventListener('click', () => {
            validateDeck();
        });
    }

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
        container.innerHTML = `
            <h3>Líder</h3>
            <div id="leader-card-grid"></div>
            <div class="deck-divider"></div>
            <div class="deck-main">
                <h3>Deck Principal (0/50)</h3>
            </div>
            <div id="main-deck-cards-grid" class="grid-view"></div>
        `;

        const leaderCardGridContainer = container.querySelector('#leader-card-grid');
        const mainDeckCardsGridContainer = container.querySelector('#main-deck-cards-grid');
        const mainDeckCounter = container.querySelector('.deck-main h3');

        // Render Leader card
        if (deck.leader) {
            leaderCardGridContainer.appendChild(createGridDeckCardElement(deck.leader));
        }

        // Render Main Deck cards
        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        if (mainDeckCounter) mainDeckCounter.textContent = `Deck Principal (${mainDeckCount}/50)`;
        deck.main.forEach(item => {
            mainDeckCardsGridContainer.appendChild(createGridDeckCardElement(item));
        });
        updateFinancialSummary();
    }

    function createGridDeckCardElement(item) {
        const cardElement = document.createElement('div');
        cardElement.classList.add('deck-card-grid');
        const card = item.card;
        const ghostCard = item.ghostCard;

        if (card) {
            const imageUrl = card.image_url === 'placeholder-leader.png' ? '/images/default-avatar.png' : card.image_url;

            let cardContent = `
                <img src="${imageUrl}" alt="${card.name}">
            `;

            if (card.type_line === 'LEADER') {
                if (card.ability) {
                    cardContent += `<div class="leader-ability">${card.ability}</div>`;
                }
            }
            cardElement.innerHTML = cardContent;
        } else if (ghostCard) {
            cardElement.classList.add('ghost-card');
            let cardContent = `
                <img src="/images/default-avatar.png" alt="${ghostCard.name}">
                <div class="ghost-card-name">${ghostCard.name}</div>
            `;
            cardElement.innerHTML = cardContent;
        }

        return cardElement;
    }

    function renderRaridadeView(container) {
        container.innerHTML = ''; // Clear previous content
        const groupedByRarity = {};

        // Add leader card to rarity grouping
        if (deck.leader) {
            const rarity = deck.leader.card ? deck.leader.card.rarity : 'Unknown';
            if (!groupedByRarity[rarity]) {
                groupedByRarity[rarity] = [];
            }
            groupedByRarity[rarity].push(deck.leader);
        }

        deck.main.forEach(item => {
            const rarity = item.card ? item.card.rarity : 'Unknown'; // Fallback for rarity
            if (!groupedByRarity[rarity]) {
                groupedByRarity[rarity] = [];
            }
            groupedByRarity[rarity].push(item);
        });

        // Sort rarities alphabetically for consistent display
        const sortedRarities = Object.keys(groupedByRarity).sort();

        sortedRarities.forEach(rarity => {
            const section = document.createElement('div');
            section.classList.add('rarity-section');
            section.innerHTML = `<h3>${rarity}</h3>`;
            groupedByRarity[rarity].forEach(item => {
                section.appendChild(createDeckCardElement(item));
            });
            container.appendChild(section);
        });
    }

    function renderPadrãoView(container) {
        container.innerHTML = `
            <h3>Líder</h3>
            <div id="leader-card"></div>
            <div class="deck-divider"></div>
            <div class="deck-main">
                <h3>Deck Principal (0/50)</h3>
            </div>
            <div id="main-deck-cards"></div>
        `;

        const leaderCardContainer = container.querySelector('#leader-card');
        const mainDeckContainer = container.querySelector('#main-deck-cards');
        const mainDeckCounter = container.querySelector('.deck-main h3');
        const leaderPlaceholder = container.querySelector('.leader-placeholder');

        // Leader
        if (deck.leader) {
            leaderCardContainer.appendChild(createDeckCardElement(deck.leader));
            if (leaderPlaceholder) leaderPlaceholder.style.display = 'none';
        } else {
            if (leaderPlaceholder) leaderPlaceholder.style.display = 'flex';
        }

        // Main Deck
        const mainDeckCount = deck.main.reduce((acc, item) => acc + item.quantity, 0);
        if (mainDeckCounter) mainDeckCounter.textContent = `Deck Principal (${mainDeckCount}/50)`;
        deck.main.sort((a, b) => {
            const nameA = a.card ? a.card.name : (a.ghostCard ? a.ghostCard.name : '');
            const nameB = b.card ? b.card.name : (b.ghostCard ? b.ghostCard.name : '');
            return nameA.localeCompare(nameB);
        });
        deck.main.forEach(item => {
            mainDeckContainer.appendChild(createDeckCardElement(item));
        });
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

    if (importDeckBtn) {
        importDeckBtn.addEventListener('click', () => {
            importModal.style.display = 'block';
        });
    }

    if(closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            importModal.style.display = 'none';
        });
    }

    window.addEventListener('click', (event) => {
        if (event.target == importModal) {
            importModal.style.display = 'none';
        }
    });

    if (importConfirmBtn) {
        importConfirmBtn.addEventListener('click', () => {
            if (!isOwner) return;
            const decklist = document.getElementById('deck-import-textarea').value;
            fetch('/api/decks/parse', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ decklist }),
            })
            .then(response => {
                if (!response.ok) {
                    return response.json().then(err => { throw err; });
                }
                return response.json();
            })
            .then(parsedDeck => {
                deck = parsedDeck;
                renderDeck();
                importModal.style.display = 'none';
            })
            .catch(error => {
                console.error('Erro ao importar deck:', error);
                const errorMessage = error.message || 'Erro ao importar deck. Verifique o formato e os nomes das cartas.';
                alert(errorMessage);
            });
        });
    }

    exportDeckBtn.addEventListener('click', () => {
        exportDeckAsTxt();
        exportDeckAsJson();
    });

function exportDeckAsTxt() {
        let content = ``;

        // Leader
        if (deck.leader) {
            const cardIdentifier = (deck.leader.card?.code) ?? (deck.leader.card?.api_id) ?? (deck.leader.card?.name) ?? (deck.leader.ghostCard?.name) ?? '';
            if (cardIdentifier) {
                content += `1x ${cardIdentifier}\n`;
            }
        }

        // Main Deck
        deck.main.forEach(item => {
            const cardIdentifier = (item.card?.code) ?? (item.card?.api_id) ?? (item.card?.name) ?? (item.ghostCard?.name) ?? '';
            if (cardIdentifier) {
                content += `${item.quantity}x ${cardIdentifier}\n`;
            }
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
