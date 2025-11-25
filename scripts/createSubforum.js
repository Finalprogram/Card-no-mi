const mongoose = require('mongoose');
const ForumCategory = require('../src/models/ForumCategory');
require('dotenv').config();

async function createSubforum() {
  try {
    console.log('🔄 Conectando ao MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado!\n');

    // ============================================
    // CONFIGURAÇÃO - EDITE AQUI
    // ============================================
    
    // Slugs disponíveis:
    // 'noticias-atualizacoes', 'discussao-geral', 'estrategias-decks',
    // 'marketplace', 'torneios-eventos', 'duvidas-suporte', 'conteudo-comunidade'
    
    const PARENT_SLUG = 'estrategias-decks'; // Altere para a categoria desejada
    
    const SUBFORUM_DATA = {
      name: 'Análise de Decks',
      slug: 'analise-decks',
      icon: '🔍',
      description: 'Análise detalhada de decks competitivos e casuais',
      color: '#8b5cf6',
      order: 1
    };
    
    // ============================================
    // EXEMPLOS DE SUBFÓRUNS:
    // ============================================
    /*
    Para Marketplace:
    { name: 'Compra', slug: 'compra', icon: '🛒', description: 'Procuro cartas específicas', color: '#3b82f6', order: 1 }
    { name: 'Venda', slug: 'venda', icon: '💵', description: 'Vendo cartas da minha coleção', color: '#10b981', order: 2 }
    { name: 'Troca', slug: 'troca', icon: '🔄', description: 'Propostas de troca', color: '#f59e0b', order: 3 }
    
    Para Torneios & Eventos:
    { name: 'Resultados', slug: 'resultados', icon: '🏅', description: 'Resultados e cobertura', color: '#eab308', order: 1 }
    
    Para Conteúdo da Comunidade:
    { name: 'Fan Art', slug: 'fan-art', icon: '🎨', description: 'Arte criada pela comunidade', color: '#ec4899', order: 1 }
    */

    console.log('📋 Buscando categoria pai...');
    const parentCategory = await ForumCategory.findOne({ slug: PARENT_SLUG });
    
    if (!parentCategory) {
      console.log('\n❌ Categoria pai não encontrada!');
      console.log('📝 Categorias disponíveis:');
      const allCategories = await ForumCategory.find({});
      allCategories.forEach(cat => {
        console.log(`   - ${cat.name} (slug: ${cat.slug})`);
      });
      await mongoose.connection.close();
      process.exit(1);
    }

    console.log(`✅ Categoria pai encontrada: ${parentCategory.name}\n`);

    // Verificar se já existe
    const existing = await ForumCategory.findOne({ slug: SUBFORUM_DATA.slug });
    if (existing) {
      console.log('⚠️  Subfórum já existe!');
      console.log(`   Nome: ${existing.name}`);
      console.log(`   Slug: ${existing.slug}`);
      await mongoose.connection.close();
      process.exit(0);
    }

    // Criar subfórum
    console.log('🔨 Criando subfórum...');
    const subforum = new ForumCategory({
      ...SUBFORUM_DATA,
      parentCategory: parentCategory._id,
      isSubforum: true,
      isActive: true,
      showInHome: true
    });

    await subforum.save();
    
    console.log('\n✅ Subfórum criado com sucesso!');
    console.log(`   ${SUBFORUM_DATA.icon} ${SUBFORUM_DATA.name}`);
    console.log(`   Slug: ${SUBFORUM_DATA.slug}`);
    console.log(`   Categoria Pai: ${parentCategory.name}`);
    console.log(`   URL: /forum/${SUBFORUM_DATA.slug}`);

    await mongoose.connection.close();
    console.log('\n🔌 Conexão fechada');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Erro:', error.message);
    if (error.code === 11000) {
      console.error('💡 Slug duplicado! Tente outro slug.');
    }
    await mongoose.connection.close();
    process.exit(1);
  }
}

createSubforum();
