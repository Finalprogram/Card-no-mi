// public/js/decks-ui.js
console.log('decks-ui.js script started.'); // Log at the very beginning

try {
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
        const pendingDeletes = new Map(); // deckId -> { timeoutId, cardNode, title }

        // --- New elements for Leader Selection Modal ---
        const createDeckBtn = qs('#create-deck-btn');
        const leaderSelectionModal = qs('#leader-selection-modal');
        const leaderModalCloseBtn = qs('#leader-selection-modal .close-btn');
        const leaderSearchInput = qs('#leader-search-input');
        const leaderColorFilter = qs('#leader-color-filter');
        const leaderEditionFilter = qs('#leader-edition-filter');
        const leaderGallery = qs('#leader-gallery');

        let allLeaders = []; // To store all fetched leaders
        let filteredLeaders = []; // To store currently filtered leaders

        // --- Leader Selection Modal Functions ---
        async function fetchLeaders() {
            try {
                leaderGallery.innerHTML = '<p class="placeholder-text">Carregando líderes...</p>';
                const response = await fetch('/api/cards/leaders');
                if (!response.ok) {
                    throw new Error('Failed to fetch leaders');
                }
                const leaders = await response.json();
                allLeaders = leaders;
                populateEditionFilter(leaders);
                filterLeaders(); // Initial render with no filters
            } catch (error) {
                console.error('Error fetching leaders:', error);
                leaderGallery.innerHTML = '<p class="placeholder-text">Erro ao carregar líderes.</p>';
            }
        }

        function populateEditionFilter(leaders) {
            const editions = new Set();
            leaders.forEach(leader => {
                if (leader.set_name) {
                    editions.add(leader.set_name);
                }
            });
            leaderEditionFilter.innerHTML = '<option value="">Todas as Edições</option>';
            Array.from(editions).sort().forEach(edition => {
                const option = document.createElement('option');
                option.value = edition;
                option.textContent = edition;
                leaderEditionFilter.appendChild(option);
            });
        }

        function renderLeaderGallery(leadersToRender) {
            leaderGallery.innerHTML = '';
            if (leadersToRender.length === 0) {
                leaderGallery.innerHTML = '<p class="placeholder-text">Nenhum líder encontrado com os filtros aplicados.</p>';
                return;
            }
            leadersToRender.forEach(leader => {
                const leaderCardElement = document.createElement('div');
                leaderCardElement.classList.add('leader-card-item');
                leaderCardElement.dataset.leader = JSON.stringify(leader);
                
                const imageUrl = leader.image_url || '/images/default-avatar.png'; // Fallback image
                
                let colorDots = '';
                if (leader.colors && leader.colors.length > 0) {
                    colorDots = `<div class="leader-colors">${leader.colors.map(color => `<span class="color-dot ${color.toLowerCase()}"></span>`).join('')}</div>`;
                }

                leaderCardElement.innerHTML = `
                    <img src="${imageUrl}" alt="${leader.name}">
                    <p>${leader.name}</p>
                    ${colorDots}
                `;
                leaderGallery.appendChild(leaderCardElement);
            });
        }

        function filterLeaders() {
            const searchTerm = leaderSearchInput.value.toLowerCase();
            const selectedColor = leaderColorFilter.value.toLowerCase();
            const selectedEdition = leaderEditionFilter.value.toLowerCase();

            filteredLeaders = allLeaders.filter(leader => {
                const matchesSearch = leader.name.toLowerCase().includes(searchTerm);
                const matchesColor = selectedColor === '' || (leader.colors && leader.colors.some(c => c.toLowerCase() === selectedColor));
                const matchesEdition = selectedEdition === '' || (leader.set_name && leader.set_name.toLowerCase() === selectedEdition);
                return matchesSearch && matchesColor && matchesEdition;
            });
            renderLeaderGallery(filteredLeaders);
        }

        // --- Event Listeners for Leader Selection Modal ---
        createDeckBtn?.addEventListener('click', () => {
            leaderSelectionModal.style.display = 'block';
            fetchLeaders(); // Fetch leaders when modal opens
        });

        leaderModalCloseBtn?.addEventListener('click', () => {
            leaderSelectionModal.style.display = 'none';
        });

        leaderSearchInput?.addEventListener('input', filterLeaders);
        leaderColorFilter?.addEventListener('change', filterLeaders);
        leaderEditionFilter?.addEventListener('change', filterLeaders);

        leaderGallery?.addEventListener('click', (e) => {
            const leaderCardItem = e.target.closest('.leader-card-item');
            if (leaderCardItem) {
                const selectedLeader = JSON.parse(leaderCardItem.dataset.leader);
                sessionStorage.setItem('selectedLeader', JSON.stringify(selectedLeader));
                window.location.href = '/deck-builder'; // Redirect to deck builder
            }
        });

        // --- Toasts ---
        const toastContainer = qs('#toast-container');
        const showToast = (message, type = 'info', options = {}) => {
            const toast = document.createElement('div');
            toast.className = `toast ${type}`;

            const msgSpan = document.createElement('span');
            msgSpan.textContent = message;
            toast.appendChild(msgSpan);

            if (options.actionText && typeof options.actionCallback === 'function') {
                const actionBtn = document.createElement('button');
                actionBtn.className = 'toast-action';
                actionBtn.type = 'button';
                actionBtn.textContent = options.actionText;
                actionBtn.addEventListener('click', (ev) => {
                    ev.stopPropagation();
                    try {
                        options.actionCallback();
                    } catch (e) {
                        console.error('Error in toast action callback', e);
                    }
                    // remove toast immediately
                    toast.classList.add('hiding');
                    toast.addEventListener('animationend', () => toast.remove());
                });
                toast.appendChild(actionBtn);
            }

            toastContainer.appendChild(toast);

            const duration = options.duration || 3000;
            if (!options.persistent) {
                setTimeout(() => {
                    toast.classList.add('hiding');
                    toast.addEventListener('animationend', () => toast.remove());
                }, duration);
            }
            return toast;
        };

        // --- Modals ---
        const openModal = (modal) => {
            if (!modal) return;
            // Remove `hidden` attribute (if present) so styles take effect
            try {
                modal.hidden = false;
            } catch (e) {}
            if (modal.hasAttribute && modal.hasAttribute('hidden')) {
                try { modal.removeAttribute('hidden'); } catch (e) {}
            }
            // Force display even if UA stylesheet hides [hidden]
            try {
                modal.style.setProperty('display', 'flex', 'important');
            } catch (e) {
                modal.style.display = 'flex';
            }
            modal.style.opacity = '1';
            modal.style.pointerEvents = 'auto';
            modal.setAttribute('aria-hidden', 'false');
        };
        const closeModal = (modal) => {
            if (!modal) return;
            try {
                modal.style.setProperty('display', 'none', 'important');
            } catch (e) {
                modal.style.display = 'none';
            }
            modal.style.opacity = '0';
            modal.style.pointerEvents = 'none';
            // Ensure the element is hidden for accessibility/semantics
            try {
                modal.setAttribute('hidden', '');
                modal.hidden = true;
            } catch (e) {
                // ignore
            }
            modal.setAttribute('aria-hidden', 'true');
        };

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
                    const viewBtn = target.closest('.view-btn');
                    if (viewBtn) viewBtn.classList.add('loading');
                    const response = await fetch(`/api/decks/${deckId}`);
                    if (!response.ok) {
                        if (viewBtn) { viewBtn.classList.remove('loading'); viewBtn.classList.add('error'); setTimeout(()=>{viewBtn.classList.remove('error');},1200); }
                        throw new Error('Erro ao buscar detalhes do deck.');
                    }
                    const deckDetails = await response.json();

                    const leaderImage = deckDetails.leader && deckDetails.leader.card ? deckDetails.leader.card.image_url : '/images/default-avatar.png';
                    const cardCount = deckDetails.main.reduce((acc, item) => acc + item.quantity, 0);

                    drawerContent.innerHTML = `
                        <img src="${leaderImage}" alt="Leader" style="width:70%; max-width: 280px; display: block; margin: 0 auto 1rem; border-radius: 8px;">
                        ${deckDetails.leader && deckDetails.leader.card ? `
                            <div class="leader-card">
                                                        <h3>${deckDetails.leader.card.name}</h3>
                                                        <p><strong>Cor:</strong> ${deckDetails.leader.card.color || 'N/A'}</p>
                                                        <p><strong>Habilidade:</strong> ${deckDetails.leader.card.ability || 'N/A'}</p>
                                                        <p><strong>Custo:</strong> ${deckDetails.leader.card.cost !== undefined ? deckDetails.leader.card.cost : 'N/A'}</p>
                                                        <p><strong>Poder:</strong> ${deckDetails.leader.card.power !== undefined ? deckDetails.leader.card.power : 'N/A'}</p>                        </div>
                        ` : ''}
                        <h3>${deckDetails.title}</h3>
                        <p><strong>Autor:</strong> ${deckDetails.owner.username}</p>
                        <p><strong>Total de Cartas:</strong> ${cardCount}</p>
                        <a href="/decks/analytics/${deckId}" class="btn btn-primary" style="width: 100%; margin-top: 1rem;">Ver Estatísticas do Deck</a>
                    `;
                    openDrawer();
                    if (viewBtn) { viewBtn.classList.remove('loading'); viewBtn.classList.add('success'); setTimeout(()=>{viewBtn.classList.remove('success');},900); }
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
                    const dupBtn = target.closest('.duplicate-btn');
                    if (dupBtn) dupBtn.classList.add('loading');
                    const response = await fetch(`/api/decks/${deckId}`);
                    if (!response.ok) {
                        if (dupBtn) { dupBtn.classList.remove('loading'); dupBtn.classList.add('error'); setTimeout(()=>{dupBtn.classList.remove('error');},1200); }
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
                        if (dupBtn) { dupBtn.classList.remove('loading'); dupBtn.classList.add('success'); setTimeout(()=>{dupBtn.classList.remove('success');},900); }
                    } catch (clipboardError) {
                        console.error('Erro ao copiar para a área de transferência:', clipboardError);
                        showToast('Erro ao copiar para a área de transferência. Verifique as permissões do navegador.', 'error');
                        if (dupBtn) { dupBtn.classList.remove('loading'); dupBtn.classList.add('error'); setTimeout(()=>{dupBtn.classList.remove('error');},1200); }
                    }

                } catch (error) {
                    console.error('Erro ao copiar lista do deck:', error);
                    showToast('Erro ao copiar lista do deck.', 'error');
                }
            }

            // Delete with undo (grace period)
            if (target.closest('.delete-btn')) {
                e.preventDefault();
                const card = target.closest('.deck-card');
                if (!card) return;
                const deckId = card.dataset.deckId;
                const deckTitle = card.querySelector('.deck-card-title')?.textContent || '';

                // Clone node to allow reinsertion if user undoes
                const cardClone = card.cloneNode(true);
                // Remove from DOM optimistically
                card.remove();

                const graceMs = 8000;

                const undo = () => {
                    const pending = pendingDeletes.get(deckId);
                    if (!pending) return;
                    clearTimeout(pending.timeoutId);
                    // Reinsert the cloned card
                    deckList.appendChild(pending.cardNode);
                    pendingDeletes.delete(deckId);
                    showToast('Exclusão cancelada.', 'info');
                };

                const timeoutId = setTimeout(async () => {
                    try {
                        const response = await fetch(`/api/decks/${deckId}`, {
                            method: 'DELETE',
                            credentials: 'same-origin',
                            headers: { 'Accept': 'application/json' }
                        });

                        if (response.ok) {
                            showToast(`Deck "${deckTitle}" excluído.`, 'success');
                        } else {
                            // reinstate on error
                            deckList.appendChild(cardClone);
                            let errMsg = 'Erro ao excluir deck.';
                            try {
                                const errorData = await response.json();
                                if (errorData && errorData.message) errMsg = `Erro ao excluir deck: ${errorData.message}`;
                            } catch (e) {}
                            showToast(errMsg, 'error');
                        }
                    } catch (error) {
                        console.error('Erro ao excluir deck:', error);
                        deckList.appendChild(cardClone);
                        showToast('Ocorreu um erro de rede ao tentar excluir o deck.', 'error');
                    } finally {
                        pendingDeletes.delete(deckId);
                    }
                }, graceMs);

                pendingDeletes.set(deckId, { timeoutId, cardNode: cardClone, title: deckTitle });

                showToast(`Deck "${deckTitle}" excluído.`, 'info', { actionText: 'Desfazer', actionCallback: undo, duration: graceMs });
            }
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
} catch (e) {
    console.error('Error executing decks-ui.js:', e);
}
