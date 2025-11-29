document.addEventListener('DOMContentLoaded', () => {
        // Navegação estilo Google: clique nos botões de página
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('page-btn')) {
                const page = parseInt(e.target.dataset.page);
                if (!isNaN(page) && page !== currentFilters.p) {
                    currentFilters.p = page;
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
        p: 1
    };
    let debounceTimer;

    // --- FUNÇÕES ---

    // Função principal para buscar e renderizar as cartas
    const fetchCards = async () => {
        // Adiciona um loader
        const loader = document.createElement('div');
        loader.className = 'loader';
        loader.textContent = 'Carregando...';
        cardList.innerHTML = '';
        cardList.appendChild(loader);

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
            const response = await fetch(`/api/cards/available?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            
            const data = await response.json();
            renderCards(data.cards);
            updatePagination(data.currentPage, data.hasMore);

        } catch (error) {
            console.error('Erro ao buscar cartas:', error);
            cardList.innerHTML = '<p class="text-center text-danger">Erro ao carregar as cartas. Tente novamente mais tarde.</p>';
        }
    };

    // Função para renderizar as cartas na tela
    const renderCards = (cards) => {
        cardList.innerHTML = '';
        if (cards && cards.length > 0) {
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'card-item';
                
                const priceDisplay = card.lowestAvailablePrice ? 
                    `R$ ${card.lowestAvailablePrice.toFixed(2).replace('.', ',')}` : 'N/A';
                
                let trendIcon = '→';
                let trendColor = '#555';
                if (card.price_trend === 'up') {
                    trendIcon = '▲';
                    trendColor = 'green';
                } else if (card.price_trend === 'down') {
                    trendIcon = '▼';
                    trendColor = 'red';
                }
                
                cardElement.innerHTML = `
                    <a href="/card/${card._id}" class="card-link">
                        <div class="card-image-container">
                            <img src="${card.image_url}" alt="${card.name}">
                        </div>
                        <h4>${card.name}</h4>
                        <p>
                            Menor Preço: ${priceDisplay}
                            <span style="color: ${trendColor}; font-size: 1.5em;">${trendIcon}</span>
                        </p>
                    </a>
                    <button class="add-to-list-btn" data-cardid="${card._id}">+ Lista</button>
                `;
                cardList.appendChild(cardElement);
            });
        } else {
            cardList.innerHTML = '<p class="text-center">Nenhuma carta encontrada com esses filtros.</p>';
        }
    };

    // Função para atualizar os controles de paginação
    const updatePagination = (currentPage, hasMore) => {
        currentFilters.p = currentPage;
        pageIndicator.textContent = `Página ${currentPage}`;
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = !hasMore;
        // TODO: Adicionar navegação avançada (total de páginas, botões numerados estilo Google)
    };

    // --- EVENT LISTENERS ---

    // Modal controls
    openFiltersBtn?.addEventListener('click', () => {
        filtersModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    const closeModal = () => {
        filtersModal.style.display = 'none';
        document.body.style.overflow = '';
    };

    closeFiltersBtn?.addEventListener('click', closeModal);
    modalOverlay?.addEventListener('click', closeModal);

    // Listener para os filtros (chips no modal)
    filtersModal?.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-chip')) {
            const key = e.target.dataset.filterKey;
            const value = e.target.dataset.filterValue;

            // Remove a classe 'active' de outras opções no mesmo grupo
            const group = e.target.closest('.filter-group-modal');
            const siblings = group.querySelectorAll('.filter-chip');
            siblings.forEach(sib => sib.classList.remove('active'));

            // Adiciona a classe 'active' à opção clicada
            e.target.classList.add('active');

            currentFilters[key] = value;
        }
    });

    // Aplicar filtros
    applyFiltersBtn?.addEventListener('click', () => {
        currentFilters.p = 1;
        fetchCards();
        closeModal();
    });

    // Limpar filtros
    clearFiltersBtn?.addEventListener('click', () => {
        // Remove todos os filtros exceto a página
        currentFilters = { p: 1 };
        
        // Remove todas as classes 'active' dos chips
        filtersModal.querySelectorAll('.filter-chip').forEach(chip => {
            chip.classList.remove('active');
            // Marca "Todas" como ativo
            if (chip.dataset.filterValue === '') {
                chip.classList.add('active');
            }
        });
        
        // Limpa o campo de busca
        if (searchInput) searchInput.value = '';
        
        fetchCards();
        closeModal();
    });

    // Listener para o campo de busca com debounce
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentFilters.q = searchInput.value;
            currentFilters.p = 1; // Reseta para a primeira página
            fetchCards();
        }, 500); // Atraso de 500ms
    });

    // Listeners para a paginação
    prevPageButton.addEventListener('click', () => {
        if (currentFilters.p > 1) {
            currentFilters.p--;
            fetchCards();
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    });

    nextPageButton.addEventListener('click', () => {
        currentFilters.p++;
        fetchCards();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // --- INICIALIZAÇÃO ---

    // Função para ler os filtros da URL na carga inicial
    const initializeFilters = () => {
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => {
            currentFilters[key] = value;
            
            // Ativa visualmente os filtros que vieram da URL
            const activeFilter = filtersModal?.querySelector(`.filter-chip[data-filter-key="${key}"][data-filter-value="${value}"]`);
            if (activeFilter) {
                activeFilter.classList.add('active');
            }
            
            // Preenche o campo de busca se houver
            if (key === 'q' && searchInput) {
                searchInput.value = value;
            }
        });
        fetchCards();
    };

    initializeFilters();
});