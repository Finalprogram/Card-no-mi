const fs = require('fs'); // Usamos o File System do Node
const path = require('path');
const mongoose = require('mongoose');
const JSONStream = require('JSONStream');
const Card = require('../src/models/Card');
const connectDB = require('../src/database/connection');

// Caminho para o arquivo JSON local que você salvou na raiz
const bulkDataPath = path.join(__dirname, '../one-piece-cards.json');

const BATCH_SIZE = 1000;

async function bulkSyncOnePiece() {
  await connectDB();

  try {
    console.log('📊 Contando cartas de One Piece antes da sincronização...');
    const initialCount = await Card.countDocuments({ game: 'onepiece' });
    console.log(`Total inicial: ${initialCount}`);
    
    console.log(`📦 Iniciando leitura do arquivo local: ${bulkDataPath}`);

    let operations = [];
    let processedCount = 0;

    // A GRANDE MUDANÇA ESTÁ AQUI: Trocamos o download (axios) pela leitura de arquivo (fs)
    const readStream = fs.createReadStream(bulkDataPath, { encoding: 'utf8' });
    const parser = JSONStream.parse('*');
    
    readStream.pipe(parser); // Conectamos a leitura do arquivo ao parser

    // O restante do código continua EXATAMENTE IGUAL
    parser.on('data', async (cardData) => {
      parser.pause();

     const optimizedCard = {
  // CORREÇÃO: Usamos o campo 'id' do JSON, que já é único para cada impressão
  api_id: cardData.id, 
  
  game: 'onepiece',
  name: cardData.name,
  set_name: cardData.set?.name,
  image_url: cardData.images?.large || cardData.images?.small, // Usa imagem grande, se não tiver, usa a pequena
  rarity: cardData.rarity,
  colors: cardData.color ? cardData.color.split('/') : [], // Transforma a string de cores em um array
  type_line: cardData.type,
  legalities: {},
};

      operations.push({
        updateOne: {
          filter: { api_id: optimizedCard.api_id, game: 'onepiece' },
          update: { $set: optimizedCard },
          upsert: true
        }
      });

      processedCount++;

      if (operations.length >= BATCH_SIZE) {
        await Card.bulkWrite(operations);
        console.log(`... ${processedCount} cartas processadas e salvas...`);
        operations = [];
      }
      
      parser.resume();
    });

    parser.on('end', async () => {
      if (operations.length > 0) {
        await Card.bulkWrite(operations);
        console.log(`... Lote final de ${operations.length} cartas salvo...`);
      }

      console.log('✅ Sincronização em massa de One Piece concluída!');
      const finalCount = await Card.countDocuments({ game: 'onepiece' });
      
      console.log('\n---');
      console.log('📄 RESUMO DA SINCRONIZAÇÃO DE ONE PIECE 📄');
      console.log(`Total inicial: ${initialCount}`);
      console.log(`Total final: ${finalCount}`);
      console.log(`Novas cartas adicionadas: ${finalCount - initialCount}`);
      console.log('---\n');

      await mongoose.connection.close();
      process.exit(0);
    });

    readStream.on('error', (err) => { throw err; });

  } catch (error) {
    console.error('Ocorreu um erro durante a sincronização em massa de One Piece:', error);
    await mongoose.connection.close();
    process.exit(1);
  }
}

bulkSyncOnePiece();