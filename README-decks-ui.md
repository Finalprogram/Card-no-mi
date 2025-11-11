# Redesign da Página "Meus Decks"

Este documento descreve as mudanças e instruções para integrar a nova interface da página "Meus Decks".

## Artefatos Entregues

-   **View:** `src/views/pages/decks.ejs`
-   **CSS:** `public/css/decks-ui.css`
-   **JavaScript:** `public/js/decks-ui.js`

## Instruções de Integração

A integração já foi parcialmente realizada para demonstração. Os passos abaixo descrevem o que foi feito e o que é necessário para a funcionalidade completa.

### 1. Rota e Controller

A rota principal `GET /decks` foi atualizada para renderizar a nova página.

-   **Arquivo:** `src/routes/deckRoutes.js`
-   **Mudança:** O middleware da rota `GET /` foi alterado de `isAuthApi` para `isAuthPage` para garantir que usuários não autenticados sejam redirecionados para a página de login.

```javascript
// src/routes/deckRoutes.js
const { isAuthApi, isAuthPage } = require('../middleware/auth');

router.route('/')
    .get(isAuthPage, getDecks) // Alterado para isAuthPage
    .post(isAuthApi, createDeck);
```

-   **Arquivo:** `src/controllers/deckController.js`
-   **Mudança:** A função `getDecks` foi modificada para buscar os decks do usuário no banco de dados e renderizar a view `pages/decks`, passando os dados necessários.

```javascript
// src/controllers/deckController.js
exports.getDecks = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const decks = await Deck.find({ owner: userId }).populate('leader').sort({ updatedAt: -1 });
        
        res.render('pages/decks', {
            decks: decks,
            page_css: 'decks-ui.css' // Passa o novo CSS
        });
    } catch (error) {
        console.error('Error fetching decks:', error);
        res.status(500).send('Erro interno do servidor');
    }
};
```

### 2. Inclusão dos Assets

-   O arquivo EJS `src/views/pages/decks.ejs` já inclui o CSS e o JS necessários. O CSS é passado através do `header` parcial, e o JS é incluído no final do arquivo.

```ejs
<%# src/views/pages/decks.ejs %>
<%- include('../partials/header', { page_css: 'decks-ui.css' }) %>
...
<script src="/js/decks-ui.js"></script>
```

### 3. Endpoints da API (Placeholders)

O arquivo `public/js/decks-ui.js` contém a lógica do frontend. As interações que necessitam do backend (criar, duplicar, excluir, etc.) estão marcadas com comentários `// Placeholder:`. Os endpoints da API existentes em `deckRoutes.js` (`POST /`, `PUT /:id`, `DELETE /:id`) devem ser usados para implementar essa funcionalidade.

**Exemplo de Ação de Exclusão no Frontend:**

```javascript
// public/js/decks-ui.js

deleteDeckConfirmBtn?.addEventListener('click', async () => {
    if (!deckToDeleteId) return;

    // Substituir o console.log pela chamada real da API
    try {
        const response = await fetch(`/decks/${deckToDeleteId}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            const cardToDelete = deckList.querySelector(`[data-deck-id="${deckToDeleteId}"]`);
            cardToDelete?.remove();
            showToast(`Deck removido com sucesso.`, 'success');
        } else {
            showToast('Erro ao remover o deck.', 'error');
        }
    } catch (error) {
        console.error('Error deleting deck:', error);
        showToast('Erro de conexão.', 'error');
    } finally {
        closeModal(deleteDeckModal);
        deckToDeleteId = null;
    }
});
```

## IDs e Classes Preservados

Para manter a compatibilidade, os seguintes IDs foram preservados e são usados pelo JavaScript:

-   `#create-deck-btn`
-   `#deck-list`
-   `data-deck-id` (em cada card de deck)

Novas classes e IDs foram adicionados para estilização e para a nova lógica de UI, seguindo o padrão `decks-ui.css`.

## Acessibilidade

-   **Movimento Reduzido:** As animações são baseadas em CSS. Para respeitar a preferência `prefers-reduced-motion`, pode-se adicionar a seguinte media query ao `decks-ui.css`:

```css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

-   **ARIA Roles:** Foram utilizados roles ARIA para modais (`role="dialog"`) e para a lista de decks (`aria-live="polite"`) para melhorar a acessibilidade.
