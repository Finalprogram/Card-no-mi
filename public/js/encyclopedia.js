document.addEventListener('DOMContentLoaded', () => {
    const cardList = document.getElementById('card-list');
    const prevPageButton = document.getElementById('prev-page');
    const nextPageButton = document.getElementById('next-page');
    const pageIndicator = document.getElementById('page-indicator');

    let currentPage = 1;

    const fetchAndDisplayCards = async (page) => {
        try {
            // Pega os filtros da URL atual
            const params = new URLSearchParams(window.location.search);
            // Define ou atualiza o parâmetro da página
            params.set('page', page);

            const response = await fetch(`/api/cards/all?${params.toString()}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            cardList.innerHTML = ''; // Limpa a lista antes de adicionar novas cartas

            if (data.cards && data.cards.length > 0) {
                data.cards.forEach(card => {
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

            // Atualiza o estado da paginação
            currentPage = data.currentPage;
            pageIndicator.textContent = `Página ${currentPage}`;
            prevPageButton.disabled = currentPage === 1;
            nextPageButton.disabled = !data.hasMore;

        } catch (error) {
            console.error('Erro ao buscar cartas:', error);
            cardList.innerHTML = '<p class="text-center text-danger">Erro ao carregar as cartas. Tente novamente mais tarde.</p>';
        }
    };

    prevPageButton.addEventListener('click', () => {
        if (currentPage > 1) {
            fetchAndDisplayCards(currentPage - 1);
        }
    });

    nextPageButton.addEventListener('click', () => {
        fetchAndDisplayCards(currentPage + 1);
    });

    // Carrega as cartas da página inicial, considerando os filtros da URL
    const initialParams = new URLSearchParams(window.location.search);
    const initialPage = parseInt(initialParams.get('page')) || 1;
    fetchAndDisplayCards(initialPage);
});
