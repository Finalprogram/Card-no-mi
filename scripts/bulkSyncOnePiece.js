const onepieceService = require('../src/services/onepieceService');
const Card = require('../src/models/Card');
const { connectDB, sequelize } = require('../src/database/connection'); // Import sequelize instance

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
    
    const initialCount = await Card.count({ where: { game: 'onepiece' } });
    let cardsProcessed = 0;
    for (const cardData of allCardsFromAPI) {
      const optimizedCard = {
        api_id: cardData.card_set_id,
        game: 'onepiece', // Define o jogo
        name: cardData.card_name,
        set_name: cardData.set_name,
        image_url: cardData.card_image,
        rarity: cardData.rarity,
        colors: cardData.card_color,
        type_line: cardData.card_type,
        ability: cardData.card_text || '',
        // Add other fields you standardized as needed
      };

      await Card.upsert(optimizedCard);
      cardsProcessed++;

      if (cardsProcessed % BATCH_SIZE === 0) {
        console.log(`... ${cardsProcessed} registros processados...`);
      }
    }

    // Log final count
    if (cardsProcessed % BATCH_SIZE !== 0) {
      console.log(`... ${cardsProcessed} registros processados...`);
    }

    const finalCount = await Card.count({ where: { game: 'onepiece' } });
    console.log('\n---');
    console.log('📄 RESUMO DA SINCRONIZAÇÃO DE ONE PIECE 📄');
    console.log(`Total inicial: ${initialCount}`);
    console.log(`Total final: ${finalCount}`);
    console.log(`Novas cartas adicionadas: ${finalCount - initialCount}`);
    console.log('---\n');

  } catch (error) {
    console.error('Ocorreu um erro durante a sincronização de One Piece:', error);
  } finally {
    await sequelize.close();
    console.log('Conexão com o Banco de Dados (PostgreSQL) fechada.');
    process.exit(0);
  }
}

syncAllOnePieceCards();