/* ========================================================================
   PÁGINA DO VENDEDOR - Adicionar ao Carrinho
========================================================================= */

document.addEventListener('DOMContentLoaded', () => {
    const floatingBtn = document.getElementById('floating-cart-button');
    const addButtons = document.querySelectorAll('.btn-add-cart');

    // Função para atualizar o badge do carrinho
    async function updateCartBadge() {
        try {
            const response = await fetch('/cart/json');
            if (!response.ok) {
                console.error('Erro ao buscar carrinho');
                return;
            }
            const data = await response.json();
            const count = Number(data.totalQty || 0);
            
            const badge = floatingBtn.querySelector('.badge');
            if (badge) {
                badge.textContent = String(count);
                badge.classList.toggle('hidden', count <= 0);
            }

            // Mostrar o botão flutuante se houver itens
            if (count > 0) {
                floatingBtn.style.display = 'flex';
            }
        } catch (error) {
            console.error('Erro ao atualizar badge do carrinho:', error);
        }
    }

    // Adicionar evento de clique em cada botão
    addButtons.forEach(button => {
        button.addEventListener('click', async (e) => {
            e.preventDefault();
            
            // Verificar se o usuário está logado
            const isLoggedIn = document.querySelector('.navbar-user-greeting') !== null;
            if (!isLoggedIn) {
                // Redirecionar para login
                window.location.href = '/auth/login?redirect=' + encodeURIComponent(window.location.pathname);
                return;
            }
            
            const listingId = button.dataset.listingId;
            const cardId = button.dataset.cardId;
            const sellerId = button.dataset.sellerId;
            const price = button.dataset.price;
            const maxQty = button.dataset.maxQty;

            // Desabilitar botão temporariamente
            const originalText = button.innerHTML;
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adicionando...';

            try {
                const response = await fetch('/cart/add', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        listingId: listingId,
                        cardId: cardId,
                        vendorId: sellerId,
                        qty: 1,
                        price: Number(price)
                    })
                });

                if (response.ok) {
                    // Sucesso
                    button.innerHTML = '<i class="fas fa-check"></i> Adicionado!';
                    button.style.background = 'var(--accent-green)';
                    
                    // Atualizar badge
                    await updateCartBadge();
                    
                    // Resetar botão após 2 segundos
                    setTimeout(() => {
                        button.disabled = false;
                        button.innerHTML = originalText;
                        button.style.background = '';
                    }, 2000);
                } else {
                    throw new Error('Erro ao adicionar ao carrinho');
                }
            } catch (error) {
                console.error('Erro:', error);
                button.innerHTML = '<i class="fas fa-exclamation-circle"></i> Erro';
                button.style.background = 'var(--accent-red)';
                
                setTimeout(() => {
                    button.disabled = false;
                    button.innerHTML = originalText;
                    button.style.background = '';
                }, 2000);
            }
        });
    });

    // Verificar se já tem itens no carrinho ao carregar a página
    updateCartBadge();
});
