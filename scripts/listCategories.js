const mongoose = require('mongoose');
const ForumCategory = require('../src/models/ForumCategory');
require('dotenv').config();

async function listCategories() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    const categories = await ForumCategory.find({}).sort({ order: 1 });
    
    console.log('📋 CATEGORIAS NO BANCO DE DADOS:\n');
    console.log('Total:', categories.length);
    console.log('─'.repeat(60));
    
    for (const cat of categories) {
      const parent = cat.parentCategory ? await ForumCategory.findById(cat.parentCategory) : null;
      const indent = parent ? '  └─ ' : '';
      
      console.log(`${indent}${cat.icon} ${cat.name}`);
      console.log(`${indent}   Slug: ${cat.slug}`);
      console.log(`${indent}   Ativa: ${cat.isActive ? '✅' : '❌'}`);
      if (parent) {
        console.log(`${indent}   Categoria Pai: ${parent.name}`);
      }
      console.log(`${indent}   showInHome: ${cat.showInHome !== false ? '✅' : '❌'}`);
      console.log(`${indent}   isSubforum: ${cat.isSubforum ? '✅' : '❌'}`);
      console.log('');
    }
    
    console.log('─'.repeat(60));
    
    // Contar categorias principais
    const mainCategories = categories.filter(c => !c.parentCategory);
    const subforums = categories.filter(c => c.parentCategory);
    
    console.log(`\n📊 Estatísticas:`);
    console.log(`   Categorias Principais: ${mainCategories.length}`);
    console.log(`   Subfóruns: ${subforums.length}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

listCategories();
