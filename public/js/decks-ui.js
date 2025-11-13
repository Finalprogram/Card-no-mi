// public/js/decks-ui.js
document.addEventListener('DOMContentLoaded', () => {
    const qs = (sel) => document.querySelector(sel);
    const qsa = (sel) => document.querySelectorAll(sel);

    // --- DOM Elements ---
    const deleteDeckModal = qs('#delete-deck-modal');
    const deleteDeckCancelBtn = qs('#delete-deck-cancel-btn');
    const deleteDeckConfirmBtn = qs('#delete-deck-confirm-btn');
    const deckNameToDelete = qs('#deck-name-to-delete');

    const deckList = qs('#deck-list');
    const deckDrawer = qs('#deck-drawer');
    const drawerCloseBtn = qs('#drawer-close-btn');
    const drawerContent = qs('#drawer-content');

    const searchInput = qs('#deck-search-input');
    
    let deckToDeleteId = null;
    let draggedItem = null;

    // --- Toasts ---
    const toastContainer = qs('#toast-container');
    const showToast = (message, type = 'info') => {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            toast.addEventListener('animationend', () => toast.remove());
        }, 3000);
    };

    // --- Modals ---
    const openModal = (modal) => modal.removeAttribute('hidden');
    const closeModal = (modal) => modal.setAttribute('hidden', '');

    deleteDeckCancelBtn?.addEventListener('click', () => closeModal(deleteDeckModal));
    
    // Close modal on overlay click
    qsa('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal);
        });
    });

    // --- Drawer ---
    const openDrawer = () => deckDrawer.classList.add('open');
    const closeDrawer = () => deckDrawer.classList.remove('open');

    drawerCloseBtn?.addEventListener('click', closeDrawer);
    
    document.addEventListener('click', (e) => {
        // Close drawer if clicking outside of it
        if (deckDrawer.classList.contains('open') && !deckDrawer.contains(e.target) && !e.target.closest('.view-btn')) {
            closeDrawer();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && deckDrawer.classList.contains('open')) {
            closeDrawer();
        }
    });

    // --- Deck Actions ---
    deckList?.addEventListener('click', async (e) => {
        const target = e.target;
        const card = target.closest('.deck-card');
        if (!card) return;

        const deckId = card.dataset.deckId;
        const deckName = card.querySelector('.deck-card-title').textContent;

        // View (Quick Preview)
        if (target.closest('.view-btn')) {
            try {
                const response = await fetch(`/api/decks/${deckId}`);
                if (!response.ok) {
                    throw new Error('Erro ao buscar detalhes do deck.');
                }
                const deckDetails = await response.json();

                const leaderImage = deckDetails.leader && deckDetails.leader.card ? deckDetails.leader.card.image_url : '/images/default-avatar.png';
                const cardCount = deckDetails.main.reduce((acc, item) => acc + item.quantity, 0);

                drawerContent.innerHTML = `
                    <img src="${leaderImage}" alt="Leader" style="width:100%; border-radius: 8px; margin-bottom: 1rem;">
                    ${deckDetails.leader && deckDetails.leader.card ? `
                        <div class="leader-card">
                            <h3>${deckDetails.leader.card.name}</h3>
                            ${deckDetails.leader.card.color ? `<p><strong>Cor:</strong> ${deckDetails.leader.card.color}</p>` : ''}
                            ${deckDetails.leader.card.ability ? `<p><strong>Habilidade:</strong> ${deckDetails.leader.card.ability}</p>` : ''}
                            ${deckDetails.leader.card.cost !== undefined ? `<p><strong>Custo:</strong> ${deckDetails.leader.card.cost}</p>` : ''}
                            ${deckDetails.leader.card.power !== undefined ? `<p><strong>Poder:</strong> ${deckDetails.leader.card.power}</p>` : ''}
                        </div>
                    ` : ''}
                    <h3>${deckDetails.title}</h3>
                    <p><strong>Autor:</strong> ${deckDetails.owner.username}</p>
                    <p><strong>Total de Cartas:</strong> ${cardCount}</p>
                    <a href="/decks/analytics/${deckId}" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Ver Estatísticas do Deck</a>
                `;
                openDrawer();
            } catch (error) {
                console.error('Erro ao carregar a visualização rápida do deck:', error);
                showToast('Não foi possível carregar os detalhes do deck.', 'error');
            }
        }

        // Edit
        if (target.closest('.edit-btn')) {
            // Placeholder: Redirect to deck editor page
            console.log(`Redirect to edit page for deck ${deckId}`);
            window.location.href = `/decks/edit/${deckId}`; // Example URL
        }

        // Duplicate
        if (target.closest('.duplicate-btn')) {
            try {
                const response = await fetch(`/api/decks/${deckId}`);
                if (!response.ok) {
                    throw new Error('Erro ao buscar detalhes do deck.');
                }
                const deckDetails = await response.json();

                let decklist = '';
                if (deckDetails.leader && deckDetails.leader.card && deckDetails.leader.card.api_id) {
                    decklist += `1x${deckDetails.leader.card.api_id}\n`;
                } else if (deckDetails.leader && deckDetails.leader.ghostCard && deckDetails.leader.ghostCard.name) {
                    decklist += `1x${deckDetails.leader.ghostCard.name}\n`;
                }

                deckDetails.main.forEach(item => {
                    if (item.card && item.card.api_id) {
                        decklist += `${item.quantity}x${item.card.api_id}\n`;
                    } else if (item.ghostCard && item.ghostCard.name) {
                        decklist += `${item.quantity}x${item.ghostCard.name}\n`;
                    }
                });

                try {
                    await navigator.clipboard.writeText(decklist.trim());
                    console.log('Calling showToast for copy confirmation'); // Debug log
                    showToast(`Lista do deck "${deckDetails.title}" copiada para a área de transferência!`, 'success');
                } catch (clipboardError) {
                    console.error('Erro ao copiar para a área de transferência:', clipboardError);
                    showToast('Erro ao copiar para a área de transferência. Verifique as permissões do navegador.', 'error');
                }

            } catch (error) {
                console.error('Erro ao copiar lista do deck:', error);
                showToast('Erro ao copiar lista do deck.', 'error');
            }
        }

        // Delete
        if (target.closest('.delete-btn')) {
            deckToDeleteId = deckId;
            deckNameToDelete.textContent = deckName;
            openModal(deleteDeckModal);
        }
    });

    deleteDeckConfirmBtn?.addEventListener('click', () => {
        // Placeholder: Send delete request to backend
        console.log(`Deleting deck ${deckToDeleteId}`);
        const cardToDelete = deckList.querySelector(`[data-deck-id="${deckToDeleteId}"]`);
        cardToDelete?.remove();
        closeModal(deleteDeckModal);
        showToast(`Deck removido com sucesso.`, 'success');
        deckToDeleteId = null;
    });

    // --- Search (Client-side) ---
    let debounceTimer;
    searchInput?.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const searchTerm = searchInput.value.toLowerCase();
            qsa('.deck-card').forEach(card => {
                const title = card.querySelector('.deck-card-title').textContent.toLowerCase();
                card.hidden = !title.includes(searchTerm);
            });
        }, 300);
    });

    // --- Drag and Drop ---
    deckList?.addEventListener('dragstart', (e) => {
        draggedItem = e.target.closest('.deck-card');
        if (draggedItem) {
            setTimeout(() => {
                draggedItem.classList.add('dragging');
            }, 0);
        }
    });

    deckList?.addEventListener('dragend', () => {
        if (draggedItem) {
            draggedItem.classList.remove('dragging');
            draggedItem = null;
        }
    });

    deckList?.addEventListener('dragover', (e) => {
        e.preventDefault();
        const afterElement = getDragAfterElement(deckList, e.clientY);
        const currentDragged = qs('.dragging');
        if (currentDragged) {
            if (afterElement == null) {
                deckList.appendChild(currentDragged);
            } else {
                deckList.insertBefore(currentDragged, afterElement);
            }
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.deck-card:not(.dragging)')];

        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
});
