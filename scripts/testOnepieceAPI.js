// scripts/testOnePieceAPI.js
const onepieceService = require('../src/services/onepieceService');

async function runTest() {
  console.log("Buscando pela carta 'Luffy' na API de One Piece...");

  // Chama a função do nosso novo serviço
  const cards = await onepieceService.searchCards('Luffy');

  if (cards && cards.length > 0) {
    console.log(`Encontradas ${cards.length} cartas!`);
    console.log("Aqui está a primeira carta no nosso formato padronizado:");
    console.log(cards[0]); // Mostra o primeiro resultado já traduzido
  } else {
    console.log("Nenhuma carta encontrada ou erro na API.");
  }
}

runTest();