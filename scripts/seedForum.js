require('dotenv').config();
const mongoose = require('mongoose');
const ForumCategory = require('../src/models/ForumCategory');
const ForumThread = require('../src/models/ForumThread');
const User = require('../src/models/User');
const UserReputation = require('../src/models/UserReputation');
const logger = require('../src/config/logger');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    logger.info('MongoDB Connected');
  } catch (error) {
    logger.error('Error connecting to MongoDB:', error);
    process.exit(1);
  }
};

const seedForumData = async () => {
  try {
    await connectDB();

    // Limpar dados existentes (opcional)
    console.log('Limpando dados anteriores do fórum...');
    await ForumCategory.deleteMany({});
    await ForumThread.deleteMany({});
    await UserReputation.deleteMany({});

    // Criar Categorias
    console.log('\nCriando categorias do fórum...');
    const categories = [
      {
        name: 'Notícias & Atualizações',
        slug: 'noticias-atualizacoes',
        icon: '📰',
        description: 'Fique por dentro das últimas notícias, lançamentos e atualizações do One Piece TCG',
        order: 1,
        color: '#E53935'
      },
      {
        name: 'Discussão Geral',
        slug: 'discussao-geral',
        icon: '💬',
        description: 'Conversas gerais sobre One Piece TCG, meta, torneios e tudo relacionado ao jogo',
        order: 2,
        color: '#1E88E5'
      },
      {
        name: 'Estratégias & Decks',
        slug: 'estrategias-decks',
        icon: '🃏',
        description: 'Compartilhe seus builds, discuta combos, estratégias e análise de meta',
        order: 3,
        color: '#A259FF'
      },
      {
        name: 'Marketplace',
        slug: 'marketplace',
        icon: '💰',
        description: 'Compre, venda e troque cartas. Discussões sobre preços e valores de mercado',
        order: 4,
        color: '#FFB800'
      },
      {
        name: 'Torneios & Eventos',
        slug: 'torneios-eventos',
        icon: '🏆',
        description: 'Organize e participe de torneios da comunidade, compartilhe resultados e relatórios',
        order: 5,
        color: '#43A047'
      },
      {
        name: 'Dúvidas & Suporte',
        slug: 'duvidas-suporte',
        icon: '❓',
        description: 'Tire suas dúvidas sobre regras, mecânicas e interações de cartas',
        order: 6,
        color: '#FF6F00'
      },
      {
        name: 'Conteúdo da Comunidade',
        slug: 'conteudo-comunidade',
        icon: '🎨',
        description: 'Fan art, vídeos, streams, podcasts e outros conteúdos criados pela comunidade',
        order: 7,
        color: '#8E24AA'
      }
    ];

    const createdCategories = await ForumCategory.insertMany(categories);
    console.log(`✓ ${createdCategories.length} categorias criadas com sucesso!`);

    // Buscar usuários existentes para criar threads de exemplo
    const users = await User.find().limit(5);
    
    if (users.length === 0) {
      console.log('\n⚠ Nenhum usuário encontrado. Pulando criação de threads de exemplo.');
      console.log('Crie usuários primeiro e depois execute este script novamente.');
      process.exit(0);
    }

    console.log(`\nEncontrados ${users.length} usuários para threads de exemplo`);

    // Criar threads de exemplo
    const exampleThreads = [
      {
        category: createdCategories[0]._id, // Notícias
        author: users[0]._id,
        title: 'Bem-vindos ao Fórum Card no Mi! 🎉',
        slug: 'bem-vindos-forum-card-no-mi-' + Date.now(),
        content: `Olá, comunidade!\n\nÉ com grande prazer que anunciamos a abertura oficial do nosso fórum!\n\nAqui você pode:\n✅ Tirar dúvidas sobre o jogo\n✅ Compartilhar suas estratégias e decks\n✅ Participar de discussões sobre o meta\n✅ Comprar e vender cartas\n✅ Organizar torneios\n✅ Conectar-se com outros jogadores\n\nLembramos que:\n🛡️ Seja sempre respeitoso com outros membros\n🚫 Não faça spam ou publicidade não autorizada\n📋 Leia as regras antes de postar\n\nDivirta-se e boas discussões! 🎴`,
        tags: ['anúncio', 'bem-vindo', 'regras'],
        isPinned: true,
        lastActivityBy: users[0]._id
      },
      {
        category: createdCategories[1]._id, // Discussão Geral
        author: users[1]._id,
        title: 'Qual seu personagem favorito no jogo?',
        slug: 'qual-personagem-favorito-jogo-' + Date.now(),
        content: `E aí galera!\n\nEstava curioso para saber: qual personagem de One Piece vocês mais gostam de jogar no TCG?\n\nPra mim é difícil escolher, mas acho que o Luffy Gear 5 é muito divertido de jogar. As mecânicas dele combinam perfeitamente com o estilo agressivo que eu gosto.\n\nE vocês? Qual é o favorito de vocês e por quê?`,
        tags: ['discussão', 'personagens', 'one-piece'],
        lastActivityBy: users[1]._id
      },
      {
        category: createdCategories[2]._id, // Estratégias
        author: users[2]._id,
        title: 'Deck Vermelho Agressivo - Guia Completo para Iniciantes',
        slug: 'deck-vermelho-agressivo-guia-' + Date.now(),
        content: `Fala galera! Hoje vou compartilhar meu deck vermelho que tem dado muito resultado!\n\n**Estratégia Principal:**\n🔥 Pressão constante desde o turno 1\n⚡ Remoção eficiente de ameaças\n💥 Finalizadores poderosos\n\n**Cartas Chave:**\n- Líder: Luffy ST01\n- 4x Zoro\n- 4x Ace\n- 3x Sabo\n- 4x Trafalgar Law\n\n**Como Jogar:**\n1. Turns iniciais: estabeleça presença no board\n2. Mid-game: controle a mesa com remoções\n3. Late-game: feche com finalizadores\n\n**Matchups:**\n✅ Bom contra: Controle Azul, Midrange Verde\n❌ Difícil contra: Aggro Roxo, Combo Amarelo\n\nDúvidas? Comentem aqui!`,
        tags: ['deck', 'vermelho', 'agressivo', 'guia', 'iniciante'],
        lastActivityBy: users[2]._id
      },
      {
        category: createdCategories[3]._id, // Marketplace
        author: users[3]._id,
        title: 'Dica: Como avaliar o preço de cartas raras',
        slug: 'como-avaliar-preco-cartas-raras-' + Date.now(),
        content: `Pessoal, vejo muita gente com dúvida sobre preços de cartas, então aqui vão algumas dicas:\n\n**Fatores que influenciam o preço:**\n1. Raridade (Secret Rare > Alt Art > Super Rare > Rare)\n2. Competitividade (cartas usadas em torneios valem mais)\n3. Condição (Near Mint > Slightly Played > Moderately Played)\n4. Demanda do mercado\n5. Set de origem (sets mais antigos podem ser mais raros)\n\n**Onde consultar preços:**\n- TCGPlayer (referência internacional)\n- Ligamagic (mercado brasileiro)\n- Grupos de compra/venda\n- Nosso próprio marketplace aqui no site!\n\n**Dicas de negociação:**\n✅ Sempre tire fotos da carta\n✅ Seja transparente sobre a condição\n✅ Combine métodos de pagamento seguros\n✅ Confirme frete antes de fechar negócio\n\nBoas compras e vendas! 💰`,
        tags: ['marketplace', 'preços', 'dicas', 'compra', 'venda'],
        lastActivityBy: users[3]._id
      },
      {
        category: createdCategories[4]._id, // Torneios
        author: users[4]._id,
        title: 'Organizando Torneio Mensal - Março 2025',
        slug: 'torneio-mensal-marco-2025-' + Date.now(),
        content: `🏆 ATENÇÃO DUELISTAS! 🏆\n\nEstamos organizando o primeiro torneio mensal da comunidade!\n\n**Informações:**\n📅 Data: 15 de Março de 2025\n⏰ Horário: 14h (Brasília)\n📍 Local: A definir\n💰 Taxa: R$ 20,00\n🎁 Premiação: Total do prize pool + cartas promocionais\n\n**Formato:**\n- Swiss (4 rodadas)\n- Top 8 mata-mata\n- Tempo de rodada: 50 minutos\n\n**Regras:**\n- Decks devem estar de acordo com a banlist atual\n- Sleeves obrigatórias\n- Juiz certificado presente\n\n**Como se inscrever:**\nComente aqui ou mande DM!\n\nEspero ver todos lá! Quem tá dentro? 🎴`,
        tags: ['torneio', 'evento', 'competitivo', 'inscrições'],
        lastActivityBy: users[4]._id
      },
      {
        category: createdCategories[5]._id, // Dúvidas
        author: users[0]._id,
        title: 'Dúvida sobre interação de efeitos: Timing',
        slug: 'duvida-interacao-efeitos-timing-' + Date.now(),
        content: `Galera, preciso de ajuda com uma situação que aconteceu no último torneio:\n\n**Cenário:**\nEu ataquei com uma criatura que tem "Ao atacar: destrua uma carta"\nMeu oponente ativou um efeito instantâneo "Ao ser atacado: ganhe +2000 de poder"\n\n**Dúvida:**\nQual efeito resolve primeiro? O timing desses efeitos simultâneos é confuso pra mim.\n\nAlguém pode explicar como funciona a pilha de efeitos nesse caso?\n\nObrigado!`,
        tags: ['dúvida', 'regras', 'timing', 'efeitos'],
        lastActivityBy: users[0]._id
      },
      {
        category: createdCategories[6]._id, // Conteúdo
        author: users[1]._id,
        title: 'Novo canal no YouTube - Análise de Decks',
        slug: 'novo-canal-youtube-analise-decks-' + Date.now(),
        content: `Fala pessoal!\n\nEstou começando um canal no YouTube focado em One Piece TCG! 🎥\n\n**Conteúdo planejado:**\n📊 Análise de meta semanal\n🎴 Gameplay comentado\n💡 Dicas de deck building\n🆚 Matchup guides\n📦 Unboxing de produtos\n\n**Primeiro vídeo:**\n"Top 5 Decks do Meta Atual - Março 2025"\n\nAinda estou configurando tudo, mas em breve posto o link aqui!\n\nAlguma sugestão de conteúdo que vocês gostariam de ver?\n\nVou tentar fazer upload 2x por semana. Espero contar com o apoio de vocês! 🙏`,
        tags: ['youtube', 'conteúdo', 'vídeos', 'comunidade'],
        lastActivityBy: users[1]._id
      }
    ];

    console.log('\nCriando threads de exemplo...');
    for (const threadData of exampleThreads) {
      const thread = new ForumThread(threadData);
      await thread.save();
      console.log(`✓ Thread criada: ${thread.title}`);
    }

    // Criar reputações iniciais para os usuários
    console.log('\nCriando reputações iniciais...');
    for (const user of users) {
      const reputation = new UserReputation({
        user: user._id,
        totalPoints: Math.floor(Math.random() * 100),
        stats: {
          threadsCreated: Math.floor(Math.random() * 5),
          postsCreated: Math.floor(Math.random() * 20)
        }
      });
      await reputation.save();
      console.log(`✓ Reputação criada para: ${user.username}`);
    }

    console.log('\n✅ Seed do fórum concluído com sucesso!');
    console.log('\nResumo:');
    console.log(`- ${createdCategories.length} categorias criadas`);
    console.log(`- ${exampleThreads.length} threads de exemplo criadas`);
    console.log(`- ${users.length} reputações inicializadas`);
    console.log('\nAcesse /forum para ver o resultado!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao popular dados:', error);
    process.exit(1);
  }
};

seedForumData();
