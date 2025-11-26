require('dotenv').config();
const mongoose = require('mongoose');
const { Achievement } = require('../src/models/Achievement');
const { DailyMission } = require('../src/models/DailyMission');

const achievements = [
  // Conquistas de Posts
  {
    key: 'first_post',
    name: 'Primeira Palavra',
    description: 'Faça seu primeiro post no fórum',
    icon: 'fa-comment',
    category: 'posts',
    tier: 'bronze',
    requirement: 1,
    rewardPoints: 10,
    order: 1
  },
  {
    key: 'posts_10',
    name: 'Conversador',
    description: 'Faça 10 posts no fórum',
    icon: 'fa-comments',
    category: 'posts',
    tier: 'bronze',
    requirement: 10,
    rewardPoints: 25,
    order: 2
  },
  {
    key: 'posts_50',
    name: 'Participante Ativo',
    description: 'Faça 50 posts no fórum',
    icon: 'fa-comment-dots',
    category: 'posts',
    tier: 'silver',
    requirement: 50,
    rewardPoints: 50,
    order: 3
  },
  {
    key: 'posts_100',
    name: 'Veterano',
    description: 'Faça 100 posts no fórum',
    icon: 'fa-star',
    category: 'posts',
    tier: 'gold',
    requirement: 100,
    rewardPoints: 100,
    order: 4
  },
  {
    key: 'posts_500',
    name: 'Lenda Viva',
    description: 'Faça 500 posts no fórum',
    icon: 'fa-crown',
    category: 'posts',
    tier: 'platinum',
    requirement: 500,
    rewardPoints: 250,
    order: 5
  },
  {
    key: 'posts_1000',
    name: 'Rei dos Piratas',
    description: 'Faça 1000 posts no fórum',
    icon: 'fa-skull-crossbones',
    category: 'posts',
    tier: 'diamond',
    requirement: 1000,
    rewardPoints: 500,
    order: 6
  },

  // Conquistas de Threads
  {
    key: 'first_thread',
    name: 'Iniciador de Discussões',
    description: 'Crie seu primeiro tópico',
    icon: 'fa-file-alt',
    category: 'threads',
    tier: 'bronze',
    requirement: 1,
    rewardPoints: 15,
    order: 10
  },
  {
    key: 'threads_10',
    name: 'Criador de Conteúdo',
    description: 'Crie 10 tópicos',
    icon: 'fa-edit',
    category: 'threads',
    tier: 'silver',
    requirement: 10,
    rewardPoints: 50,
    order: 11
  },
  {
    key: 'threads_25',
    name: 'Mestre das Discussões',
    description: 'Crie 25 tópicos',
    icon: 'fa-book',
    category: 'threads',
    tier: 'gold',
    requirement: 25,
    rewardPoints: 100,
    order: 12
  },
  {
    key: 'threads_50',
    name: 'Lendário Debatedor',
    description: 'Crie 50 tópicos',
    icon: 'fa-scroll',
    category: 'threads',
    tier: 'platinum',
    requirement: 50,
    rewardPoints: 200,
    order: 13
  },

  // Conquistas de Reações
  {
    key: 'reactions_10',
    name: 'Popular',
    description: 'Receba 10 reações em seus posts',
    icon: 'fa-heart',
    category: 'reactions',
    tier: 'bronze',
    requirement: 10,
    rewardPoints: 20,
    order: 20
  },
  {
    key: 'reactions_50',
    name: 'Querido pela Comunidade',
    description: 'Receba 50 reações em seus posts',
    icon: 'fa-fire',
    category: 'reactions',
    tier: 'silver',
    requirement: 50,
    rewardPoints: 50,
    order: 21
  },
  {
    key: 'reactions_100',
    name: 'Ídolo do Fórum',
    description: 'Receba 100 reações em seus posts',
    icon: 'fa-trophy',
    category: 'reactions',
    tier: 'gold',
    requirement: 100,
    rewardPoints: 100,
    order: 22
  },

  // Conquistas de Facção
  {
    key: 'faction_join',
    name: 'Escolha seu Lado',
    description: 'Junte-se a uma facção (Pirata ou Marinha)',
    icon: 'fa-flag',
    category: 'faction',
    tier: 'bronze',
    requirement: 1,
    rewardPoints: 25,
    order: 30
  },
  {
    key: 'faction_rank_5',
    name: 'Ascensão',
    description: 'Alcance o rank 5 em sua facção',
    icon: 'fa-level-up-alt',
    category: 'faction',
    tier: 'silver',
    requirement: 5,
    rewardPoints: 75,
    order: 31
  },
  {
    key: 'faction_rank_10',
    name: 'Elite da Facção',
    description: 'Alcance o rank máximo (10) em sua facção',
    icon: 'fa-medal',
    category: 'faction',
    tier: 'diamond',
    requirement: 10,
    rewardPoints: 250,
    order: 32
  },

  // Conquistas Especiais
  {
    key: 'welcome',
    name: 'Bem-vindo!',
    description: 'Crie sua conta no Card\'no Mi',
    icon: 'fa-user-plus',
    category: 'special',
    tier: 'bronze',
    requirement: 1,
    rewardPoints: 5,
    order: 0
  }
];

const dailyMissions = [
  {
    key: 'daily_login',
    title: 'Fazer Login',
    description: 'Faça login no fórum',
    icon: 'fa-sign-in-alt',
    type: 'login',
    requirement: 1,
    rewardPoints: 5,
    isActive: true
  },
  {
    key: 'daily_post',
    title: 'Criar Post',
    description: 'Faça 3 posts no fórum',
    icon: 'fa-comment',
    type: 'create_post',
    requirement: 3,
    rewardPoints: 15,
    isActive: true
  },
  {
    key: 'daily_thread',
    title: 'Criar Tópico',
    description: 'Crie 1 tópico no fórum',
    icon: 'fa-file-alt',
    type: 'create_thread',
    requirement: 1,
    rewardPoints: 20,
    isActive: true
  },
  {
    key: 'daily_reactions',
    title: 'Reagir a Posts',
    description: 'Reaja a 5 posts diferentes',
    icon: 'fa-thumbs-up',
    type: 'give_reaction',
    requirement: 5,
    rewardPoints: 10,
    isActive: true
  },
  {
    key: 'daily_upvotes',
    title: 'Dar Upvotes',
    description: 'Dê 3 upvotes em posts',
    icon: 'fa-arrow-up',
    type: 'upvote',
    requirement: 3,
    rewardPoints: 10,
    isActive: true
  }
];

async function seedData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');

    // Limpar dados existentes
    await Achievement.deleteMany({});
    await DailyMission.deleteMany({});
    console.log('🗑️  Dados antigos removidos\n');

    // Inserir conquistas
    await Achievement.insertMany(achievements);
    console.log(`✅ ${achievements.length} conquistas inseridas\n`);

    // Inserir missões diárias
    await DailyMission.insertMany(dailyMissions);
    console.log(`✅ ${dailyMissions.length} missões diárias inseridas\n`);

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Sistema de conquistas e missões criado!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error);
    process.exit(1);
  }
}

seedData();
