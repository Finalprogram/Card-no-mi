const mongoose = require('mongoose');
const onepieceService = require('../src/services/onepieceService');
const Card = require('../src/models/Card');
const connectDB = require('../src/database/connection');

const BATCH_SIZE = 500; // Lotes de 500 para salvar no banco

async function syncAllOnePieceCards() {
  await connectDB();

  try {
    // --- FASE 1: BUSCAR TODAS AS CARTAS DA API ---
    console.log('📦 Iniciando busca de todas as cartas de One Piece. Isso pode levar alguns minutos...');
    
    const allCardsFromAPI = await onepieceService.fetchAllCards();
    
    console.log(`✅ Busca finalizada! Total de ${allCardsFromAPI.length} cartas encontradas na API.`);
    console.log('Total cards from API:', allCardsFromAPI.length);

    // --- FASE 2: SALVAR TUDO NO BANCO DE DADOS EM LOTES ---
    console.log('🔄 Iniciando sincronização com o banco de dados...');
    
    const initialCount = await Card.countDocuments({ game: 'onepiece' });
    let operations = [];

    for (const cardData of allCardsFromAPI) {
      console.log('Processing cardData:', cardData);
      const optimizedCard = {
        api_id: cardData.card_set_id,
        game: 'onepiece', // Define o jogo
        name: cardData.card_name,
        set_name: cardData.set_name,
        image_url: cardData.card_image, // Corrected field
        // (Adicione outros campos que você padronizou, como raridade, cores, etc.)
        rarity: cardData.rarity,
        colors: cardData.card_color, // Corrected field
        type_line: cardData.card_type, // Corrected field
        ability: cardData.card_text || '', // Corrected field
      };

      operations.push({
        updateOne: {
          filter: { api_id: optimizedCard.api_id, game: 'onepiece' },
          update: { $set: optimizedCard },
          upsert: true
        }
      });

      if (operations.length >= BATCH_SIZE) {
        await Card.bulkWrite(operations);
        console.log(`... ${operations.length} registros salvos...`);
        operations = []; // Limpa o lote
      }
    }

    // Salva o lote final restante
    if (operations.length > 0) {
      await Card.bulkWrite(operations);
      console.log(`... ${operations.length} registros salvos...`);
    }

    const finalCount = await Card.countDocuments({ game: 'onepiece' });
    console.log('\n---');
    console.log('📄 RESUMO DA SINCRONIZAÇÃO DE ONE PIECE 📄');
    console.log(`Total inicial: ${initialCount}`);
    console.log(`Total final: ${finalCount}`);
    console.log(`Novas cartas adicionadas: ${finalCount - initialCount}`);
    console.log('---\n');

  } catch (error) {
    console.error('Ocorreu um erro durante a sincronização de One Piece:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexão com o MongoDB fechada.');
    process.exit(0);
  }
}

syncAllOnePieceCards();