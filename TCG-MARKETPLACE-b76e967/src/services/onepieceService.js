const axios = require('axios');
const http = require('http'); // 1. Garanta que esta linha de importação existe

// 2. Cria o "agente" de conexão que força o uso de IPv4
const httpAgent = new http.Agent({ family: 4 });

// 3. Cria a instância do axios com a configuração correta
const api = axios.create({
  baseURL: 'https://api.onepiecetopdecks.com/v2',
  httpAgent: httpAgent, // 4. Garante que o agente está sendo usado aqui
});

// O resto do seu arquivo de serviço
async function searchCards(query) {
  try {
    const response = await api.get('/cards/search', {
      params: { card_name: query }
    });

    const formattedCards = response.data.map(card => ({
      api_id: card.id,
      name: card.name,
      image_url: card.card_images[0].image_path,
      set_name: card.set_name,
    }));
    return formattedCards;

  } catch (error) {
    // Agora o erro completo aparecerá no console
    console.error("Erro ao buscar cartas de One Piece:", error);
    return [];
  }
}

async function fetchAllCardsByPage(page = 1) {
    try {
      const response = await api.get('/cards', {
        params: { page: page }
      });
      return response.data;
    } catch (error) {
      console.error(`Erro ao buscar a página ${page} de cartas de One Piece:`, error.message);
      return [];
    }
  }

module.exports = {
  searchCards,
  fetchAllCardsByPage,
};