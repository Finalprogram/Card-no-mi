document.addEventListener('DOMContentLoaded', () => {
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('page-btn')) {
            const page = parseInt(e.target.dataset.page, 10);
            if (!Number.isNaN(page) && page !== currentFilters.page) {
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
    const totalPagesIndicator = document.getElementById('total-pages');
    const googleStylePagination = document.getElementById('google-style-pagination');
    const searchInput = document.getElementById('search-input');
    const activeFiltersSummary = document.getElementById('active-filters-summary');
    const resultsSection = document.querySelector('.results');

    const filtersModal = document.getElementById('filters-modal');
    const openFiltersBtn = document.getElementById('open-filters-btn');
    const closeFiltersBtn = document.getElementById('close-filters-btn');
    const applyFiltersBtn = document.getElementById('apply-filters-btn');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');
    const modalOverlay = document.querySelector('.filters-modal-overlay');

    let currentFilters = { page: 1 };
    let tempFilters = {};
    let debounceTimer;

    const multiSelectKeys = new Set(['rarity', 'color', 'type', 'set', 'don', 'variant']);

    const extractSuffix = (value) => {
        if (!value) return null;
        const match = String(value).match(/(_p1|_p2|_r1|_r2)\.png/i);
        return match ? match[1].toLowerCase() : null;
    };

    const normalizeCardName = (value) => {
        if (!value) return value;
        return String(value).replace(/\s*\(\d+\)\s*$/, '');
    };

    const getFilterArray = (container, key) => {
        const value = container[key];
        if (Array.isArray(value)) return value;
        if (value == null || value === '') return [];
        return String(value).split(',').map(v => v.trim()).filter(Boolean);
    };

    const setFilterArray = (container, key, values) => {
        const normalized = [...new Set(values.map(v => String(v).trim()).filter(Boolean))];
        if (!normalized.length) {
            delete container[key];
            return;
        }
        container[key] = normalized;
    };

    const getVariantBadge = (card) => {
        const variantValue = Number(card && card.variant);
        if (variantValue === 0) return '';

        let images = card && card.images ? card.images : null;
        if (typeof images === 'string') {
            try {
                images = JSON.parse(images);
            } catch (err) {
                images = null;
            }
        }

        const suffix = images && images.suffix ? String(images.suffix).toLowerCase() : extractSuffix(card && card.image_url);
        const map = {
            _p1: { label: 'AA', className: 'variant-badge variant-aa' },
            _r1: { label: 'Alt Art', className: 'variant-badge variant-alt' },
            _r2: { label: 'Reprint', className: 'variant-badge variant-reprint' },
            _p2: { label: 'Reprint', className: 'variant-badge variant-reprint' }
        };

        if (suffix && map[suffix]) {
            const info = map[suffix];
            return `<span class="${info.className}">${info.label}</span>`;
        }

        const variantMap = {
            1: { label: 'AA', className: 'variant-badge variant-aa' },
            2: { label: 'Alt Art', className: 'variant-badge variant-alt' },
            3: { label: 'Reprint', className: 'variant-badge variant-reprint' }
        };

        if (variantMap[variantValue]) {
            const info = variantMap[variantValue];
            return `<span class="${info.className}">${info.label}</span>`;
        }

        return '';
    };

    const buildParams = (filters) => {
        const params = new URLSearchParams();
        Object.keys(filters).forEach(key => {
            const value = filters[key];
            if (Array.isArray(value)) {
                value.forEach(item => params.append(key, item));
            } else if (value) {
                params.set(key, value);
            }
        });
        return params;
    };

    const getFilterLabel = (key, value) => {
        if (!filtersModal) return value;
        const chip = filtersModal.querySelector(`.filter-chip[data-filter-key="${key}"][data-filter-value="${value}"]`);
        return chip ? chip.textContent.trim() : value;
    };

    const renderActiveFiltersSummary = () => {
        if (!activeFiltersSummary) return;
        const items = [];
        Object.keys(currentFilters).forEach(key => {
            if (key === 'page') return;
            if (key === 'q' && currentFilters.q) {
                items.push({ key: 'q', value: currentFilters.q, label: `Busca: ${currentFilters.q}` });
                return;
            }
            if (!multiSelectKeys.has(key)) return;
            getFilterArray(currentFilters, key).forEach(value => {
                items.push({ key, value, label: getFilterLabel(key, value) });
            });
        });

        activeFiltersSummary.innerHTML = items.map(item => `
            <button type="button" class="active-filter-chip" data-key="${item.key}" data-value="${item.value}">
                ${item.label} <span class="remove">×</span>
            </button>
        `).join('');
    };

    const renderGooglePagination = (currentPage, totalPages) => {
        if (!googleStylePagination) return;
        googleStylePagination.innerHTML = '';
        if (!totalPages || totalPages <= 1) return;

        const appendPageButton = (page, isActive) => {
            const btn = document.createElement('button');
            btn.className = `page-btn ${isActive ? 'active' : ''}`.trim();
            btn.dataset.page = page;
            btn.textContent = page;
            googleStylePagination.appendChild(btn);
        };

        const appendEllipsis = () => {
            const span = document.createElement('span');
            span.textContent = '...';
            googleStylePagination.appendChild(span);
        };

        const start = Math.max(1, currentPage - 2);
        const end = Math.min(totalPages, currentPage + 2);

        if (start > 1) {
            appendPageButton(1, false);
            if (start > 2) appendEllipsis();
        }

        for (let i = start; i <= end; i++) appendPageButton(i, i === currentPage);

        if (end < totalPages) {
            if (end < totalPages - 1) appendEllipsis();
            appendPageButton(totalPages, false);
        }
    };

    const updatePagination = (currentPage, hasMore, totalPages) => {
        currentFilters.page = currentPage;
        pageIndicator.textContent = `Página ${currentPage}`;
        if (totalPagesIndicator) totalPagesIndicator.textContent = `de ${totalPages || 1}`;
        renderGooglePagination(currentPage, totalPages || 1);
        prevPageButton.disabled = currentPage === 1;
        nextPageButton.disabled = !hasMore;
    };

    const renderCards = (cards) => {
        cardList.innerHTML = '';
        if (!cards || !cards.length) {
            cardList.innerHTML = '<p class="text-center">Nenhuma carta encontrada com esses filtros.</p>';
            return;
        }

        cards.forEach(card => {
            const cardElement = document.createElement('div');
            cardElement.className = 'card-item';
            const cardId = card._id || card.id;
            const variantBadge = getVariantBadge(card);
            const displayName = normalizeCardName(card.name);
            cardElement.innerHTML = `
                <a href="/card/${cardId}" class="card-link">
                    <div class="card-image-container">
                        <img src="${card.image_url}" alt="${displayName}">
                    </div>
                    <h4>${displayName} ${variantBadge}</h4>
                </a>
            `;
            cardList.appendChild(cardElement);
        });
    };

    const fetchCards = async () => {
        const loader = document.createElement('div');
        loader.className = 'loader';
        resultsSection.appendChild(loader);

        const params = buildParams(currentFilters);
        history.pushState({ path: `${window.location.pathname}?${params.toString()}` }, '', `${window.location.pathname}?${params.toString()}`);

        try {
            const response = await fetch(`/api/cards/all?${params.toString()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            renderCards(data.cards);
            updatePagination(data.currentPage, data.hasMore, data.totalPages);
            renderActiveFiltersSummary();
        } catch (error) {
            console.error('Erro ao buscar cartas:', error);
            cardList.innerHTML = '<p class="text-center text-danger">Erro ao carregar as cartas. Tente novamente mais tarde.</p>';
        } finally {
            loader.remove();
        }
    };

    const syncModalChipsFromFilters = (filters) => {
        if (!filtersModal) return;
        filtersModal.querySelectorAll('.filter-group-modal').forEach(group => {
            const key = group.querySelector('.filter-chip')?.dataset.filterKey;
            if (!key) return;
            const chips = group.querySelectorAll('.filter-chip');
            chips.forEach(chip => chip.classList.remove('active'));

            const selectedValues = multiSelectKeys.has(key)
                ? getFilterArray(filters, key)
                : [filters[key]].filter(Boolean);

            if (!selectedValues.length) {
                const allChip = group.querySelector('.filter-chip[data-filter-value=""]');
                if (allChip) allChip.classList.add('active');
                return;
            }

            selectedValues.forEach(value => {
                const chip = group.querySelector(`.filter-chip[data-filter-key="${key}"][data-filter-value="${value}"]`);
                if (chip) chip.classList.add('active');
            });
        });
    };

    const openModal = () => {
        tempFilters = JSON.parse(JSON.stringify(currentFilters));
        delete tempFilters.page;
        delete tempFilters.q;
        syncModalChipsFromFilters(tempFilters);
        filtersModal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        filtersModal.style.display = 'none';
        document.body.style.overflow = '';
        tempFilters = {};
    };

    const applyFilters = () => {
        currentFilters = { ...currentFilters, ...tempFilters };
        Object.keys(currentFilters).forEach(key => {
            if (key !== 'page' && key !== 'q' && !(key in tempFilters)) delete currentFilters[key];
        });
        currentFilters.page = 1;
        closeModal();
        fetchCards();
    };

    const clearFilters = () => {
        tempFilters = {};
        syncModalChipsFromFilters(tempFilters);
    };

    openFiltersBtn.addEventListener('click', openModal);
    closeFiltersBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    applyFiltersBtn.addEventListener('click', applyFilters);
    clearFiltersBtn.addEventListener('click', clearFilters);

    filtersModal.addEventListener('click', (e) => {
        if (!e.target.classList.contains('filter-chip')) return;

        const key = e.target.dataset.filterKey;
        const value = e.target.dataset.filterValue;
        const group = e.target.closest('.filter-group-modal');
        const siblings = group.querySelectorAll('.filter-chip');
        const allChip = group.querySelector('.filter-chip[data-filter-value=""]');

        if (multiSelectKeys.has(key)) {
            if (value === '') {
                siblings.forEach(chip => chip.classList.remove('active'));
                e.target.classList.add('active');
                delete tempFilters[key];
            } else {
                e.target.classList.toggle('active');
                if (allChip) allChip.classList.remove('active');
                const selected = Array.from(siblings)
                    .filter(chip => chip.classList.contains('active') && chip.dataset.filterValue !== '')
                    .map(chip => chip.dataset.filterValue);
                if (!selected.length) {
                    if (allChip) allChip.classList.add('active');
                    delete tempFilters[key];
                } else {
                    setFilterArray(tempFilters, key, selected);
                }
            }
            return;
        }

        siblings.forEach(chip => chip.classList.remove('active'));
        e.target.classList.add('active');
        if (value === '') delete tempFilters[key];
        else tempFilters[key] = value;
    });

    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            currentFilters.q = searchInput.value;
            if (!currentFilters.q) delete currentFilters.q;
            currentFilters.page = 1;
            fetchCards();
        }, 500);
    });

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

    activeFiltersSummary?.addEventListener('click', (e) => {
        const chip = e.target.closest('.active-filter-chip');
        if (!chip) return;
        const { key, value } = chip.dataset;
        if (key === 'q') {
            delete currentFilters.q;
            if (searchInput) searchInput.value = '';
        } else if (multiSelectKeys.has(key)) {
            const next = getFilterArray(currentFilters, key).filter(v => v !== value);
            setFilterArray(currentFilters, key, next);
        } else {
            delete currentFilters[key];
        }
        currentFilters.page = 1;
        syncModalChipsFromFilters(currentFilters);
        fetchCards();
    });

    const initializeFilters = () => {
        const params = new URLSearchParams(window.location.search);
        params.forEach((value, key) => {
            if (multiSelectKeys.has(key)) {
                const existing = getFilterArray(currentFilters, key);
                existing.push(value);
                setFilterArray(currentFilters, key, existing);
            } else {
                currentFilters[key] = value;
            }
            if (key === 'q') searchInput.value = value;
        });

        syncModalChipsFromFilters(currentFilters);
        renderActiveFiltersSummary();
        fetchCards();
    };

    initializeFilters();
});
