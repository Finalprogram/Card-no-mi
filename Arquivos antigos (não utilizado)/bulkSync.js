const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const JSONStream = require('JSONStream');
const es = require('event-stream');
const Card = require('../src/models/Card');
const connectDB = require('../src/database/connection');

const bulkDataPath = path.join(__dirname, '../all-cards.json');

// Define o tamanho do nosso lote de operações
const BATCH_SIZE = 1000;

async function bulkSync() {
  await connectDB();

  try {
    console.log('📊 Contando cartas antes da sincronização...');
    const initialCount = await Card.countDocuments();
    console.log(`Total inicial: ${initialCount}`);
    
    console.log(`📦 Iniciando leitura do arquivo em modo streaming...`);

    // Array para agrupar as operações de banco de dados
    let operations = [];
    let processedCount = 0;

    const readStream = fs.createReadStream(bulkDataPath, { encoding: 'utf8' });
    const parser = JSONStream.parse('*');
    
    readStream.pipe(parser);

    parser.on('data', (cardData) => {
      const optimizedCard = {
        scryfall_id: cardData.id,
        name: cardData.name,
        set: cardData.set,
        image_url: cardData.image_uris?.normal || cardData.card_faces?.[0]?.image_uris?.normal || null,
        rarity: cardData.rarity,
        colors: cardData.colors,
        legalities: cardData.legalities,
        type_line: cardData.type_line,
        price_usd: cardData.prices?.usd, // Usando optional chaining aqui também por segurança
        editions: cardData.set_name,
      };

      // Em vez de executar a operação, nós a preparamos e adicionamos ao nosso lote
      operations.push({
        updateOne: {
          filter: { scryfall_id: optimizedCard.scryfall_id },
          update: { $set: optimizedCard },
          upsert: true
        }
      });
      
      processedCount++;

      // Se o lote atingir o tamanho máximo, pausamos o stream, enviamos o lote e o limpamos.
      if (operations.length >= BATCH_SIZE) {
        parser.pause(); // Pausa a leitura do arquivo
        
        console.log(`... Enviando lote de ${operations.length} operações para o banco... (${processedCount} cartas processadas)`);
        Card.bulkWrite(operations).then(() => {
          operations = []; // Limpa o lote
          parser.resume(); // Retoma a leitura do arquivo
        }).catch(err => {
          console.error('Erro durante o bulkWrite:', err);
          parser.resume(); // Mesmo com erro, continua para não travar
        });
      }
    });

    parser.on('end', async () => {
      // Garante que o último lote, que pode ser menor que BATCH_SIZE, seja enviado.
      if (operations.length > 0) {
        console.log(`... Enviando lote final de ${operations.length} operações...`);
        await Card.bulkWrite(operations);
      }

      console.log('✅ Sincronização em massa concluída!');
      const finalCount = await Card.countDocuments();
      console.log(`Total final de cartas no banco: ${finalCount}`);

      await mongoose.connection.close();
      console.log('Conexão com o MongoDB fechada.');
      process.exit(0);
    });

    readStream.on('error', (err) => { throw err; });

  } catch (error) {
    console.error('Ocorreu um erro durante a sincronização em massa:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

bulkSync();