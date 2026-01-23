require('dotenv').config();
const { sequelize } = require('../src/database/connection');
const ForumCategory = require('../src/models/ForumCategory');
const ForumThread = require('../src/models/ForumThread');
const User = require('../src/models/User');
const UserReputation = require('../src/models/UserReputation');

async function seedForumData() {
  try {
    await sequelize.authenticate();

    const categories = [
      {
        name: 'Noticias e Atualizacoes',
        slug: 'noticias-atualizacoes',
        icon: 'NEWS',
        description: 'Fique por dentro das ultimas noticias, lancamentos e atualizacoes do One Piece TCG',
        order: 1,
        color: '#E53935'
      },
      {
        name: 'Discussao Geral',
        slug: 'discussao-geral',
        icon: 'CHAT',
        description: 'Conversas gerais sobre One Piece TCG, meta, torneios e tudo relacionado ao jogo',
        order: 2,
        color: '#1E88E5'
      },
      {
        name: 'Estrategias e Decks',
        slug: 'estrategias-decks',
        icon: 'DECK',
        description: 'Compartilhe seus builds, discuta combos, estrategias e analise de meta',
        order: 3,
        color: '#A259FF'
      },
      {
        name: 'Marketplace',
        slug: 'marketplace',
        icon: 'MARKET',
        description: 'Compre, venda e troque cartas. Discussao sobre precos e valores de mercado',
        order: 4,
        color: '#FFB800'
      },
      {
        name: 'Torneios e Eventos',
        slug: 'torneios-eventos',
        icon: 'EVENT',
        description: 'Organize e participe de torneios da comunidade, compartilhe resultados e relatorios',
        order: 5,
        color: '#43A047'
      },
      {
        name: 'Duvidas e Suporte',
        slug: 'duvidas-suporte',
        icon: 'HELP',
        description: 'Tire suas duvidas sobre regras, mecanicas e interacoes de cartas',
        order: 6,
        color: '#FF6F00'
      },
      {
        name: 'Conteudo da Comunidade',
        slug: 'conteudo-comunidade',
        icon: 'MEDIA',
        description: 'Fan art, videos, streams, podcasts e outros conteudos criados pela comunidade',
        order: 7,
        color: '#8E24AA'
      }
    ];

    const categoryMap = new Map();
    for (const data of categories) {
      const [category, created] = await ForumCategory.findOrCreate({
        where: { slug: data.slug },
        defaults: data
      });
      if (!created) {
        await category.update(data);
      }
      categoryMap.set(data.slug, category);
    }

    const users = await User.findAll({ limit: 5, order: [['id', 'ASC']] });
    if (users.length === 0) {
      console.log('Nenhum usuario encontrado. Crie um usuario antes de popular o forum.');
      return;
    }

    const [userA, userB, userC, userD, userE] = users;
    const exampleThreads = [
      {
        categorySlug: 'noticias-atualizacoes',
        author: userA,
        title: 'Bem-vindos ao forum Card no Mi!',
        slug: 'bem-vindos-forum-card-no-mi',
        content:
          'Ola, comunidade!\n\n' +
          'Com grande prazer anunciamos a abertura do nosso forum.\n\n' +
          'Aqui voce pode tirar duvidas, compartilhar estrategias, participar de discussoes e conectar-se com outros jogadores.\n\n' +
          'Seja respeitoso e leia as regras antes de postar. Divirta-se!',
        tags: ['anuncio', 'bem-vindo', 'regras'],
        isPinned: true
      },
      {
        categorySlug: 'discussao-geral',
        author: userB || userA,
        title: 'Qual seu personagem favorito no jogo?',
        slug: 'qual-personagem-favorito-jogo',
        content:
          'Qual personagem de One Piece voce mais gosta de jogar no TCG e por que?',
        tags: ['discussao', 'personagens', 'one-piece']
      },
      {
        categorySlug: 'estrategias-decks',
        author: userC || userA,
        title: 'Deck vermelho agressivo - guia para iniciantes',
        slug: 'deck-vermelho-agressivo-guia',
        content:
          'Compartilhe suas listas e dicas para quem esta começando com decks agressivos.',
        tags: ['deck', 'vermelho', 'agressivo', 'guia', 'iniciante']
      },
      {
        categorySlug: 'marketplace',
        author: userD || userA,
        title: 'Como avaliar preco de cartas raras',
        slug: 'como-avaliar-preco-cartas-raras',
        content:
          'Dicas para avaliar raridade, condicao, demanda e onde consultar precos.',
        tags: ['marketplace', 'precos', 'dicas', 'compra', 'venda']
      },
      {
        categorySlug: 'torneios-eventos',
        author: userE || userA,
        title: 'Organizando torneio mensal da comunidade',
        slug: 'torneio-mensal-comunidade',
        content:
          'Vamos organizar um torneio mensal. Deixe sua disponibilidade e sugestoes aqui.',
        tags: ['torneio', 'evento', 'competitivo']
      },
      {
        categorySlug: 'duvidas-suporte',
        author: userA,
        title: 'Duvida sobre interacao de efeitos: timing',
        slug: 'duvida-interacao-efeitos-timing',
        content:
          'Qual efeito resolve primeiro em casos de efeitos simultaneos? Compartilhe exemplos.',
        tags: ['duvida', 'regras', 'timing', 'efeitos']
      },
      {
        categorySlug: 'conteudo-comunidade',
        author: userB || userA,
        title: 'Novo canal no YouTube - analise de decks',
        slug: 'novo-canal-youtube-analise-decks',
        content:
          'Estou iniciando um canal focado em One Piece TCG. Sugestoes sao bem-vindas.',
        tags: ['youtube', 'conteudo', 'videos', 'comunidade']
      }
    ];

    for (const thread of exampleThreads) {
      const category = categoryMap.get(thread.categorySlug);
      if (!category) continue;

      await ForumThread.findOrCreate({
        where: { slug: thread.slug },
        defaults: {
          title: thread.title,
          slug: thread.slug,
          categoryId: category.id,
          authorId: thread.author.id,
          content: thread.content,
          tags: thread.tags,
          isPinned: thread.isPinned || false,
          lastActivityById: thread.author.id,
          lastActivity: new Date()
        }
      });
    }

    for (const user of users) {
      await UserReputation.findOrCreate({
        where: { userId: user.id },
        defaults: {
          totalPoints: 0,
          level: 1,
          title: 'Novato',
          stats: {
            threadsCreated: 0,
            postsCreated: 0,
            reactionsReceived: 0,
            reactionsGiven: 0,
            bestAnswers: 0,
            helpfulVotes: 0
          }
        }
      });
    }

    console.log('Categorias e topicos do forum criados com sucesso.');
  } catch (error) {
    console.error('Erro ao popular o forum:', error);
  } finally {
    await sequelize.close();
  }
}

seedForumData();
