const mongoose = require('mongoose');
const ForumCategory = require('../src/models/ForumCategory');
require('dotenv').config();

async function addSubforums() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');

    // Buscar categorias existentes
    const categories = await ForumCategory.find({});
    console.log(`\n📋 Categorias encontradas: ${categories.length}`);
    
    categories.forEach(cat => {
      console.log(`  - ${cat.name} (${cat.slug})`);
    });

    // Exemplo: Criar subcategorias para uma categoria específica
    // Ajuste o slug abaixo para a categoria que você quer adicionar subfóruns
    
    const parentCategorySlug = 'discussoes-gerais'; // AJUSTE AQUI
    const parentCategory = await ForumCategory.findOne({ slug: parentCategorySlug });
    
    if (!parentCategory) {
      console.log(`\n❌ Categoria "${parentCategorySlug}" não encontrada!`);
      console.log('💡 Use um dos slugs listados acima ou crie a categoria primeiro.');
      process.exit(1);
    }

    console.log(`\n🎯 Adicionando subfóruns para: ${parentCategory.name}`);

    // Exemplos de subfóruns
    const subforums = [
      {
        name: 'Estratégias de Deck',
        slug: 'estrategias-deck',
        icon: '🎯',
        description: 'Discuta e compartilhe estratégias para seus decks',
        color: '#10b981',
        parentCategory: parentCategory._id,
        isSubforum: true,
        order: 1
      },
      {
        name: 'Dúvidas sobre Cartas',
        slug: 'duvidas-cartas',
        icon: '❓',
        description: 'Tire suas dúvidas sobre cartas específicas e suas mecânicas',
        color: '#f59e0b',
        parentCategory: parentCategory._id,
        isSubforum: true,
        order: 2
      },
      {
        name: 'Eventos e Torneios',
        slug: 'eventos-torneios',
        icon: '🏆',
        description: 'Informações sobre eventos, torneios e campeonatos',
        color: '#ef4444',
        parentCategory: parentCategory._id,
        isSubforum: true,
        order: 3
      }
    ];

    // Criar ou atualizar subfóruns
    for (const subforumData of subforums) {
      const existing = await ForumCategory.findOne({ slug: subforumData.slug });
      
      if (existing) {
        console.log(`  ⚠️  Subfórum "${subforumData.name}" já existe, pulando...`);
        continue;
      }

      const subforum = new ForumCategory(subforumData);
      await subforum.save();
      console.log(`  ✅ Subfórum criado: ${subforumData.icon} ${subforumData.name}`);
    }

    console.log('\n✅ Subfóruns adicionados com sucesso!');
    console.log('\n📌 Para adicionar mais subfóruns:');
    console.log('   1. Edite este arquivo (scripts/addSubforums.js)');
    console.log('   2. Altere o "parentCategorySlug" para a categoria desejada');
    console.log('   3. Modifique o array "subforums" com seus subfóruns');
    console.log('   4. Execute: node scripts/addSubforums.js');

    await mongoose.connection.close();
    console.log('\n🔌 Conexão fechada');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    console.error('Stack:', error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

addSubforums();
