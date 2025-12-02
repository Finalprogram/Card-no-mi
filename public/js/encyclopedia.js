document.addEventListener('DOMContentLoaded', () => {
        // Navegação estilo Google: clique nos botões de página
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== currentFilters.page) {
                    currentFilters.page = page;
                    fetchCards();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            }
        });
    const cardList = document.getElementById('card-list');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    const searchInput = document.getElementById('search-input');
    const resultsSection = document.querySelector('.results');
    
    // Modal elements
    const filtersModal = document.getElementById('filters-modal');
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const closeFiltersBtn = document.getElementById('close-filters-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const modalOverlay = document.querySelector('.filters-modal-overlay');

    let currentFilters = {
        page: 1
    };
    let tempFilters = {}; // Temporary filters before applying
    let debounceTimer;

    // --- FUNÇÕES ---

    // Função principal para buscar e renderizar as cartas
    const fetchCards = async () => {
        // Adiciona um loader
        const loader = document.createElement('div');
        loader.className = 'loader';
        resultsSection.appendChild(loader);

        const params = new URLSearchParams();
        for (const key in currentFilters) {
            if (currentFilters[key]) {
                params.set(key, currentFilters[key]);
            }
        }

        // Atualiza a URL do navegador
        const newUrl = `${window.location.pathname}?${params.toString()}`;
        history.pushState({ path: newUrl }, '', newUrl);

        try {
            const response = await fetch(`/api/cards/all?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            renderCards(data.cards);
            updatePagination(data.currentPage, data.hasMore);

        } catch (error) {
            console.error('Erro ao buscar cartas:', error);
            cardList.innerHTML = '<p class="text-center text-danger">Erro ao carregar as cartas. Tente novamente mais tarde.</p>';
        } finally {
            // Remove o loader
            loader.remove();
        }
    };

    // Função para renderizar as cartas na tela
    const renderCards = (cards) => {
        cardList.innerHTML = '';
        if (cards && cards.length > 0) {
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item';
                cardElement.innerHTML = `
                    <a href="/card/${card._id}" class="card-link">
                        <div class="card-image-container">
                            <img src="${card.image_url}" alt="${card.name}">
                        </div>
                        <h4>${card.name}</h4>
                    </a>
                `;
                cardList.appendChild(cardElement);
            });
        } else {
            cardList.innerHTML = '<p class="text-center">Nenhuma carta encontrada com esses filtros.</p>';
        }
    };

    // Função para atualizar os controles de paginação
    const updatePagination = (currentPage, hasMore) => {
        currentFilters.page = currentPage;
        pageIndicator.textContent = `Página ${currentPage}`;
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = !hasMore;
    };

    // --- MODAL FUNCTIONS ---

    const openModal = () => {
        // Copy current filters to temp filters
        tempFilters = { ...currentFilters };
        delete tempFilters.page;
        delete tempFilters.q;
        
        // Update modal chip states based on current filters
        document.querySelectorAll('.filter-chip').forEach(chip => {
            const key = chip.dataset.filterKey;
            const value = chip.dataset.filterValue;
            chip.classList.toggle('active', tempFilters[key] === value);
        });
        
        filtersModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        filtersModal.style.display = 'none';
        document.body.style.overflow = '';
        tempFilters = {};
    };

    const applyFilters = () => {
        // Apply temp filters to current filters
        Object.keys(tempFilters).forEach(key => {
            currentFilters[key] = tempFilters[key];
        });
        
        // Remove filters that were cleared
        const tempKeys = Object.keys(tempFilters);
        Object.keys(currentFilters).forEach(key => {
            if (key !== 'page' && key !== 'q' && !tempKeys.includes(key)) {
                delete currentFilters[key];
            }
        });
        
        currentFilters.page = 1;
        closeModal();
        fetchCards();
    };

    const clearFilters = () => {
        tempFilters = {};
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
        });
    };

    // --- EVENT LISTENERS ---

    // Modal controls
    openFiltersBtn.addEventListener('click', openModal);
    closeFiltersBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    // Filter chip clicks
    filtersModal.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-chip')) {
            const key = e.target.dataset.filterKey;
            const value = e.target.dataset.filterValue;
            
            // If clicking "Todas", remove filter
            if (value === 'all') {
                delete tempFilters[key];
                // Remove active from all chips in this group
                const groupChips = filtersModal.querySelectorAll(`.filter-chip[data-filter-key="${key}"]`);
                groupChips.forEach(chip => chip.classList.remove('active'));
                e.target.classList.add('active');
            } else {
                // Set filter and update chip states
                tempFilters[key] = value;
                // Remove active from all chips in this group
                const groupChips = filtersModal.querySelectorAll(`.filter-chip[data-filter-key="${key}"]`);
                groupChips.forEach(chip => chip.classList.remove('active'));
                e.target.classList.add('active');
            }
        }
    });

    // Listener para o campo de busca com debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentFilters.q = searchInput.value;
            currentFilters.page = 1; // Reseta para a primeira página
            fetchCards();
        }, 500); // Atraso de 500ms
    });

    // Listeners para a paginação
    prevPageButton.addEventListener('click', () => {
        if (currentFilters.page > 1) {
            currentFilters.page--;
            fetchCards();
        }
    });

    nextPageButton.addEventListener('click', () => {
        currentFilters.page++;
        fetchCards();
    });

    // --- INICIALIZAÇÃO ---

    // Função para ler os filtros da URL na carga inicial
    const initializeFilters = () => {
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => {
            currentFilters[key] = value;
        });
        
        // Initialize search input from URL
        if (currentFilters.q) {
            searchInput.value = currentFilters.q;
        }
        
        fetchCards();
    };

    initializeFilters();
});