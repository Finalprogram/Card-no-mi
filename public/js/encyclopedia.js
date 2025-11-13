document.addEventListener('DOMContentLoaded', () => {
    const cardList = document.getElementById('card-list');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');
    const filtersContainer = document.querySelector('.filters-container');
    const searchInput = document.getElementById('search-input');
    const resultsSection = document.querySelector('.results');

    let currentFilters = {
        page: 1
    };
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

    // --- EVENT LISTENERS ---

    // Listener para os filtros
    filtersContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('filter-option')) {
            e.preventDefault();
            const key = e.target.dataset.filterKey;
            const value = e.target.dataset.filterValue;

            // Remove a classe 'active' de outras opções no mesmo grupo
            const siblings = e.target.closest('.filter-options').querySelectorAll('.filter-option');
            siblings.forEach(sib => sib.classList.remove('active'));

            // Adiciona a classe 'active' à opção clicada
            e.target.classList.add('active');

            currentFilters[key] = value;
            currentFilters.page = 1; // Reseta para a primeira página ao aplicar um novo filtro
            fetchCards();
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
            
            // Ativa visualmente os filtros que vieram da URL
            const activeFilter = filtersContainer.querySelector(`.filter-option[data-filter-key="${key}"][data-filter-value="${value}"]`);
            if (activeFilter) {
                activeFilter.classList.add('active');
            }
        });
        fetchCards();
    };

    initializeFilters();
});