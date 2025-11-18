// Script para inicializar as taxas padrão do marketplace em 8%
const mongoose = require('mongoose');
require('dotenv').config();

const Setting = require('../src/models/Setting');

async function initDefaultFees() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Conectado ao MongoDB');

    // Definir taxa padrão de 8% para contas individuais
    await Setting.findOneAndUpdate(
      { key: 'fee_individual_percentage' },
      { 
        value: 8.0, 
        description: 'Taxa padrão para vendedores do tipo "individual", em porcentagem.' 
      },
      { upsert: true, new: true }
    );
    console.log('✅ Taxa padrão para contas "individual" definida em 8%');

    // Definir taxa padrão de 8% para lojas
    await Setting.findOneAndUpdate(
      { key: 'fee_shop_percentage' },
      { 
        value: 8.0, 
        description: 'Taxa padrão para vendedores do tipo "loja" (shop), em porcentagem.' 
      },
      { upsert: true, new: true }
    );
    console.log('✅ Taxa padrão para contas "shop" definida em 8%');

    console.log('\n✨ Taxas padrão inicializadas com sucesso!');
    console.log('📊 Todas as contas sem taxa personalizada usarão 8%');

  } catch (error) {
    console.error('❌ Erro ao inicializar taxas:', error);
  } finally {
    await mongoose.disconnect();
    console.log('Desconectado do MongoDB');
  }
}

initDefaultFees();
