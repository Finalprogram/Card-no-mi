// 1. Importamos o axios para fazer as requisições HTTP
const axios = require('axios');
const http = require('http');
const cache = require('memory-cache');
const httpAgent = new http.Agent({ family: 4 }); // Força o uso de IPv4
// 2. Definimos a URL base da API para não ter que repetir
const api = axios.create({
  baseURL: 'https://api.scryfall.com',
  httpAgent: httpAgent // Usa o agente HTTP que força IPv4
});

/**
 * Busca uma única carta pelo nome.
 * @param {string} cardName - O nome da carta a ser pesquisada.
 * @returns {object} - O objeto com os dados da carta.
 */
async function fetchCardByName(cardName) {
  try {
    // Faz a requisição GET para o endpoint /cards/named?fuzzy=<nome_da_carta>
    const response = await api.get(`/cards/named`, {
      params: {
        fuzzy: cardName
      }
    });

    // A Scryfall retorna os dados da carta em response.data
    return response.data;

  } catch (error) {
    // Se a carta não for encontrada, a API retorna um erro 404
    if (error.response && error.response.status === 404) {
      console.log('Carta não encontrada:', cardName);
      return null; // Retornamos null para que o controller saiba que não encontrou
    }
    // Para outros tipos de erro (ex: API fora do ar), a gente lança o erro
    console.error('Erro ao buscar dados da Scryfall:', error.message);
    throw new Error('Falha ao se comunicar com a API da Scryfall.');
  }
}

/**
 * Busca uma lista de cartas baseada em uma query de pesquisa.
 * @param {string} query - A string de pesquisa (ex: "t:dragon c:r").
 * @returns {array} - Uma lista de objetos de cartas.
 */
async function searchCards(query, page = 1) {
  const cacheKey = `${query}-page${page}`;
  const cachedResult = cache.get(cacheKey);
  if (cachedResult) {
    console.log(`Usando cache para: ${cacheKey}`);
    return cachedResult;
  }
   console.log(`Cache MISS! Buscando na Scryfall para a chave: ${cacheKey}`);
  try {
    const response = await api.get(`/cards/search`, {
      params: {
        q: query,
        page: page
      }
    });
    cache.put(cacheKey, response.data, 3600 * 1000);
    // Retorna a lista de cartas que fica dentro do campo "data"
    return response.data;

 } catch (error) {
    // --- BLOCO CATCH MELHORADO ---
    console.error('--- ERRO DETALHADO DA SCRYFALL ---');
    
    // Verifica se a resposta de erro veio da API
    if (error.response) {
      // A Scryfall envia os detalhes do erro em error.response.data
      console.error('Status:', error.response.status); // Ex: 400
      console.error('Data:', JSON.stringify(error.response.data, null, 2)); // Exibe o JSON do erro formatado
    } else {
      // Erro de rede ou outro problema
      console.error('Erro na requisição:', error.message);
    }
    console.error('--- FIM DO ERRO DETALHADO ---');

    // Mantemos o lançamento do erro para o controller saber que falhou
    throw new Error('Falha ao realizar a busca na API da Scryfall.');
  }
}


// 3. Exportamos as funções para que outros arquivos (como os controllers) possam usá-las
module.exports = {
  fetchCardByName,
  searchCards
};