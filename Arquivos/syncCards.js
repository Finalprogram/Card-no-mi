const mongoose = require('mongoose');
const scryfallService = require('../src/services/scryfallService');
const Card = require('../src/models/Card');
const connectDB = require('../src/database/connection');

// Função que sincroniza UMA ÚNICA coleção (agora com busca de todas as páginas)
async function syncSingleSet(setCode) {
  console.log(`\n------------------------------------------`);
  console.log(`Iniciando sincronização completa para a coleção: ${setCode}...`);

  const allCardsFromSet = [];
  let hasMore = true;
  let page = 1;

  // Loop 'do-while' para buscar todas as páginas de uma coleção
  do {
    console.log(`Buscando página ${page} de "${setCode}"...`);
    const scryfallResult = await scryfallService.searchCards(`e:${setCode}`, page);

    if (scryfallResult && scryfallResult.data && scryfallResult.data.length > 0) {
      // Adiciona as cartas encontradas nesta página à nossa lista principal
      allCardsFromSet.push(...scryfallResult.data);
      
      // Verifica se a API informou que há mais páginas
      hasMore = scryfallResult.has_more;
      
      // Incrementa o contador para a próxima requisição
      page++;
    } else {
      // Se não houver resultado ou a lista de dados estiver vazia, para o loop
      hasMore = false;
    }
  } while (hasMore);

  console.log(`Total de ${allCardsFromSet.length} cartas encontradas para "${setCode}".\nSincronizando com o banco de dados...`);
  
  let newCardsCount = 0;

  // Agora, fazemos o loop na lista completa de cartas que baixamos
  for (const cardData of allCardsFromSet) {
    const optimizedCard = {
      scryfall_id: cardData.id,
      name: cardData.name,
      set: cardData.set,
      image_url: cardData.image_uris ? cardData.image_uris.normal : (cardData.card_faces ? cardData.card_faces[0].image_uris.normal : null),
      rarity: cardData.rarity,
      colors: cardData.colors,
      type_line: cardData.type_line,
      price_usd: cardData.prices.usd,
    };

    const result = await Card.updateOne(
      { scryfall_id: optimizedCard.scryfall_id },
      { $set: optimizedCard },
      { upsert: true }
    );

    if (result.upsertedCount > 0) {
      newCardsCount++;
      console.log(`✅ Adicionada: ${optimizedCard.name}`);
    }
  }

  console.log(`\nSincronização da coleção "${setCode}" concluída. ${newCardsCount} novas cartas adicionadas.`);
  return newCardsCount;
}

// Função principal que gerencia a sincronização (sem alterações aqui)
async function syncMultipleSets(setCodes) {
  await connectDB();
  
  try {
    const initialCount = await Card.countDocuments();
    console.log(`📊 Total de cartas no banco antes da sincronização: ${initialCount}`);
    
    let totalNewCards = 0;

    for (const setCode of setCodes) {
      const newCards = await syncSingleSet(setCode);
      totalNewCards += newCards;
    }

    const finalCount = await Card.countDocuments();
    console.log('\n---');
    console.log('📄 RESUMO GERAL DA SINCRONIZAÇÃO 📄');
    console.log(`Total inicial: ${initialCount}`);
    console.log(`Total final: ${finalCount}`);
    console.log(`Total de novas cartas adicionadas: ${totalNewCards}`);
    console.log('---\n');

  } catch (error) {
    console.error('Ocorreu um erro durante a sincronização:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Conexão com o MongoDB fechada.');
    process.exit(0);
  }
}

// Lógica principal para pegar os argumentos (sem alterações aqui)
const setCodesToSync = process.argv.slice(2);

if (setCodesToSync.length === 0) {
  console.error('Erro: Por favor, forneça um ou mais códigos de coleção.');
  console.error('Exemplo: npm run sync:cards -- mom dmu lci');
  process.exit(1);
}

syncMultipleSets(setCodesToSync);