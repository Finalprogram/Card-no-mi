const mongoose = require('mongoose');
const ForumCategory = require('../src/models/ForumCategory');
require('dotenv').config();

async function fixCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    const categories = await ForumCategory.find({});
    
    console.log(`📋 Encontradas ${categories.length} categorias`);
    console.log('🔧 Corrigindo campos faltantes...\n');
    
    let fixed = 0;
    
    for (const cat of categories) {
      let needsUpdate = false;
      const updates = {};
      
      // Garantir que showInHome existe e é true por padrão
      if (cat.showInHome === undefined || cat.showInHome === null) {
        updates.showInHome = true;
        needsUpdate = true;
        console.log(`  ✓ ${cat.name}: showInHome definido como true`);
      }
      
      // Garantir que isSubforum existe
      if (cat.isSubforum === undefined || cat.isSubforum === null) {
        updates.isSubforum = false;
        needsUpdate = true;
        console.log(`  ✓ ${cat.name}: isSubforum definido como false`);
      }
      
      if (needsUpdate) {
        await ForumCategory.updateOne(
          { _id: cat._id },
          { $set: updates }
        );
        fixed++;
      }
    }
    
    console.log(`\n✅ ${fixed} categorias corrigidas!`);
    console.log('🎉 Todas as categorias agora devem aparecer no fórum!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

fixCategories();
