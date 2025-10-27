document.addEventListener('DOMContentLoaded', () => {
    const searchForm = document.getElementById('sell-search-form');
    const searchInput = document.getElementById('sell-search-input');
    const searchResultsContainer = document.getElementById('sell-search-results');
    const stagingArea = document.getElementById('listing-staging-area');
    const saveAllButton = document.getElementById('save-all-listings-btn');

    // --- 1. Lógica de Busca Dinâmica (com Debounce) ---
    let debounceTimer;
    searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);

        debounceTimer = setTimeout(async () => {
            const query = searchInput.value.trim();

            if (query.length < 2) {
                searchResultsContainer.innerHTML = '<p class="search-message">Digite pelo menos 2 caracteres para buscar.</p>';
                return;
            }

            searchResultsContainer.innerHTML = '<p class="search-message">Buscando...</p>';

            try {
                const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
                if (!response.ok) {
                    throw new Error('Erro na rede ao buscar as cartas.');
                }
                const results = await response.json();

                if (results.length === 0) {
                    searchResultsContainer.innerHTML = '<p class="search-message">Nenhuma carta encontrada.</p>';
                    return;
                }

                renderSearchResults(results);
            } catch (error) {
                console.error('Erro ao buscar cartas:', error);
                searchResultsContainer.innerHTML = '<p class="search-message error">Ocorreu um erro ao buscar. Tente novamente.</p>';
            }
        }, 300); // Atraso de 300ms
    });

    // Prevenir o comportamento padrão do formulário, já que a busca é dinâmica
    searchForm.addEventListener('submit', (e) => e.preventDefault());

    function renderSearchResults(cards) {
        searchResultsContainer.innerHTML = cards.map(card => `
            <div class="search-result-item" data-card-id="${card._id}" data-card-name="${card.name}" data-card-image="${card.image_url}">
                <img src="${card.image_url}" alt="${card.name}">
                <div class="result-info">
                    <h4>${card.name}</h4>
                    <p>${card.set_name}</p>
                </div>
                <button class="btn-secondary add-to-staging-btn">Adicionar</button>
            </div>
        `).join('');
    }

    // --- 2. Lógica para Adicionar à Área de Anúncio ---
    searchResultsContainer.addEventListener('click', (e) => {
        if (!e.target.classList.contains('add-to-staging-btn')) return;

        const resultItem = e.target.closest('.search-result-item');
        const { cardId, cardName, cardImage } = resultItem.dataset;

        // Evita adicionar a mesma carta múltiplas vezes na área de staging
        if (stagingArea.querySelector(`[data-card-id="${cardId}"]`)) {
            window.showToast('Esta carta já foi adicionada para anúncio.', 'info');
            return;
        }

        // Remove a mensagem de "vazio"
        const emptyMessage = stagingArea.querySelector('.empty-staging-message');
        if (emptyMessage) emptyMessage.remove();

        const listingElement = document.createElement('div');
        listingElement.className = 'staging-item';
        listingElement.dataset.cardId = cardId;
        listingElement.innerHTML = `
            <img src="${cardImage}" alt="${cardName}">
            <div class="staging-info">
                <h5>${cardName}</h5>
                <div class="staging-inputs">
                    <select name="condition" class="form-control">
                        <option value="NM">Near Mint (NM)</option>
                        <option value="SP">Slightly Played (SP)</option>
                        <option value="MP">Moderately Played (MP)</option>
                        <option value="HP">Heavily Played (HP)</option>
                        <option value="DMG">Damaged (DMG)</option>
                    </select>
                    <select name="language" class="form-control">
                        <option value="EN">Inglês</option>
                    </select>
                    <input type="number" name="quantity" class="form-control" placeholder="Qtd." min="1" value="1">
                    <input type="number" name="price" class="form-control" placeholder="Preço (R$)" step="0.01" min="0">
                </div>
            </div>
            <button class="btn-danger remove-staging-btn">Remover</button>
        `;

        stagingArea.appendChild(listingElement);
    });

    // --- 3. Lógica para Remover da Área de Anúncio ---
    stagingArea.addEventListener('click', (e) => {
        if (!e.target.classList.contains('remove-staging-btn')) return;
        e.target.closest('.staging-item').remove();

        // Se a área ficar vazia, mostra a mensagem novamente
        if (stagingArea.children.length === 0) {
            stagingArea.innerHTML = '<p class="empty-staging-message">As cartas que você adicionar aparecerão aqui.</p>';
        }
    });

    // --- 4. Lógica para Salvar Todos os Anúncios ---
    saveAllButton.addEventListener('click', async () => {
        const stagedItems = stagingArea.querySelectorAll('.staging-item');
        if (stagedItems.length === 0) {
            window.showToast('Adicione pelo menos uma carta para criar anúncios.', 'info');
            return;
        }

        const listingsData = [];
        let allValid = true;
        stagedItems.forEach(item => {
            const cardId = item.dataset.cardId;
            const condition = item.querySelector('[name="condition"]').value;
            const language = item.querySelector('[name="language"]').value;
            const quantity = item.querySelector('[name="quantity"]').value;
            const price = item.querySelector('[name="price"]').value;

            if (!price || parseFloat(price) <= 0) {
                allValid = false;
            }

            listingsData.push({ cardId, condition, language, quantity, price });
        });

        if (!allValid) {
            window.showToast('Por favor, preencha um preço válido para todos os anúncios.', 'error');
            return;
        }

        saveAllButton.disabled = true;
        saveAllButton.textContent = 'Salvando...';

        // DEBUG: Mostra os dados que serão enviados no console do navegador
        console.log('Enviando para o backend:', JSON.stringify({ listings: listingsData }, null, 2));

        try {
            const response = await fetch('/api/listings/bulk-create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ listings: listingsData })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || 'Falha ao salvar os anúncios.');
            }

            const data = await response.json();
            if (data.success) {
                window.showToast('Anúncios criados com sucesso!', 'success');
                stagingArea.innerHTML = '<p class="empty-staging-message">As cartas que você adicionar aparecerão aqui.</p>';
            } else {
                throw new Error(data.message || 'Falha ao salvar os anúncios.');
            }

        } catch (error) {
            console.error('Erro ao salvar anúncios:', error);
            window.showToast(`Erro: ${error.message}`, 'error');
        } finally {
            saveAllButton.disabled = false;
            saveAllButton.textContent = 'Salvar Todos os Anúncios';
        }
    });
});
