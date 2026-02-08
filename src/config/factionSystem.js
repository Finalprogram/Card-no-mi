/**
 * Sistema de Facções - Piratas vs Marinha
 * 
 * Define a hierarquia de ranks, pontos necessários e títulos
 * para cada facção do fórum.
 */

const factionSystem = {
    pirate: {
        name: 'Piratas',
        color: '#8B0000',
        icon: '☠️',
        description: 'Navegue pelos mares em busca de liberdade e aventura!',
        ranks: [
            {
                rank: 0,
                title: 'Recruta Pirata',
                pointsRequired: 0,
                description: 'Você acabou de começar sua jornada pirata',
                color: '#A9A9A9'
            },
            {
                rank: 1,
                title: 'Pirata Novato',
                pointsRequired: 100,
                description: 'Seus primeiros passos no mar',
                color: '#CD853F'
            },
            {
                rank: 2,
                title: 'Pirata Experiente',
                pointsRequired: 500,
                description: 'Já conhece as ondas do mar',
                color: '#DAA520'
            },
            {
                rank: 3,
                title: 'Corsário',
                pointsRequired: 1500,
                description: 'Um pirata temido pelos mares',
                color: '#FF8C00'
            },
            {
                rank: 4,
                title: 'Capitão Pirata',
                pointsRequired: 3000,
                description: 'Comandante de sua própria tripulação',
                color: '#FF4500'
            },
            {
                rank: 5,
                title: 'Supernova',
                pointsRequired: 6000,
                description: 'Uma estrela em ascensão no mundo pirata',
                color: '#DC143C'
            },
            {
                rank: 6,
                title: 'Shichibukai',
                pointsRequired: 12000,
                description: 'Um dos Sete Senhores dos Mares',
                color: '#B22222'
            },
            {
                rank: 7,
                title: 'Comandante de Frota',
                pointsRequired: 25000,
                description: 'Líder de uma grande frota pirata',
                color: '#8B0000'
            },
            {
                rank: 8,
                title: 'Yonkou',
                pointsRequired: 50000,
                description: 'Um dos Quatro Imperadores do Mar',
                color: '#800000'
            },
            {
                rank: 9,
                title: 'Rei dos Piratas',
                pointsRequired: 100000,
                description: 'O pirata mais livre e poderoso dos mares',
                color: '#4B0000'
            }
        ]
    },
    
    marine: {
        name: 'Marinha',
        color: '#000080',
        icon: '⚓',
        description: 'Defenda a justiça e mantenha a ordem nos mares!',
        ranks: [
            {
                rank: 0,
                title: 'Recruta da Marinha',
                pointsRequired: 0,
                description: 'Você acabou de se alistar na Marinha',
                color: '#A9A9A9'
            },
            {
                rank: 1,
                title: 'Marinheiro',
                pointsRequired: 100,
                description: 'Um soldado raso da Marinha',
                color: '#4682B4'
            },
            {
                rank: 2,
                title: 'Cabo',
                pointsRequired: 500,
                description: 'Primeiro passo na hierarquia militar',
                color: '#4169E1'
            },
            {
                rank: 3,
                title: 'Sargento',
                pointsRequired: 1500,
                description: 'Líder de pequenos grupos',
                color: '#0000CD'
            },
            {
                rank: 4,
                title: 'Tenente',
                pointsRequired: 3000,
                description: 'Oficial da Marinha',
                color: '#00008B'
            },
            {
                rank: 5,
                title: 'Capitão',
                pointsRequired: 6000,
                description: 'Comandante de um navio de guerra',
                color: '#191970'
            },
            {
                rank: 6,
                title: 'Comodoro',
                pointsRequired: 12000,
                description: 'Líder de múltiplas embarcações',
                color: '#000080'
            },
            {
                rank: 7,
                title: 'Vice-Almirante',
                pointsRequired: 25000,
                description: 'Um dos oficiais de elite da Marinha',
                color: '#00004D'
            },
            {
                rank: 8,
                title: 'Almirante',
                pointsRequired: 50000,
                description: 'Uma das três maiores forças da Marinha',
                color: '#000033'
            },
            {
                rank: 9,
                title: 'Almirante de Frota',
                pointsRequired: 100000,
                description: 'O comandante supremo da Marinha',
                color: '#000020'
            }
        ]
    }
};

/**
 * Obter informações do rank atual baseado na facção e pontos
 * @param {String} faction - 'pirate' ou 'marine'
 * @param {Number} points - Pontos de facção do usuário
 * @returns {Object} Informações do rank atual
 */
function getCurrentRank(faction, points) {
    if (!faction || !factionSystem[faction]) {
        return null;
    }
    
    const ranks = factionSystem[faction].ranks;
    let currentRank = ranks[0];
    
    for (let i = ranks.length - 1; i >= 0; i--) {
        if (points >= ranks[i].pointsRequired) {
            currentRank = ranks[i];
            break;
        }
    }
    
    return currentRank;
}

/**
 * Obter próximo rank na hierarquia
 * @param {String} faction - 'pirate' ou 'marine'
 * @param {Number} currentRankNumber - Número do rank atual
 * @returns {Object|null} Informações do próximo rank ou null se já está no máximo
 */
function getNextRank(faction, currentRankNumber) {
    if (!faction || !factionSystem[faction]) {
        return null;
    }
    
    const ranks = factionSystem[faction].ranks;
    const nextRankIndex = currentRankNumber + 1;
    
    if (nextRankIndex >= ranks.length) {
        return null; // Já está no rank máximo
    }
    
    return ranks[nextRankIndex];
}

/**
 * Calcular progresso para o próximo rank
 * @param {String} faction - 'pirate' ou 'marine'
 * @param {Number} points - Pontos de facção do usuário
 * @returns {Object} Objeto com informações de progresso
 */
function getRankProgress(faction, points) {
    const currentRank = getCurrentRank(faction, points);
    if (!currentRank) {
        return null;
    }
    
    const nextRank = getNextRank(faction, currentRank.rank);
    
    if (!nextRank) {
        return {
            currentRank,
            nextRank: null,
            progress: 100,
            pointsToNext: 0,
            isMaxRank: true
        };
    }
    
    const pointsInCurrentRank = points - currentRank.pointsRequired;
    const pointsNeededForNext = nextRank.pointsRequired - currentRank.pointsRequired;
    const progress = Math.min(100, Math.floor((pointsInCurrentRank / pointsNeededForNext) * 100));
    
    return {
        currentRank,
        nextRank,
        progress,
        pointsToNext: nextRank.pointsRequired - points,
        isMaxRank: false
    };
}

/**
 * Adicionar pontos de facção e verificar se subiu de rank
 * @param {Object} user - Objeto do usuário
 * @param {Number} points - Pontos a adicionar
 * @param {String} reason - Razão da adição de pontos
 * @returns {Promise<Object>} Informações sobre a adição de pontos
 */
async function addFactionPoints(user, points, reason = 'Atividade no fórum') {
    if (!user.faction || points <= 0) {
        return {
            success: false,
            rankedUp: false,
            message: 'Facção inválida ou pontos negativos'
        };
    }
    
    const oldPoints = user.factionPoints || 0;
    const oldRank = getCurrentRank(user.faction, oldPoints);
    
    user.factionPoints = oldPoints + points;
    const newRank = getCurrentRank(user.faction, user.factionPoints);
    
    const rankedUp = newRank.rank > oldRank.rank;
    
    if (rankedUp) {
        user.factionRank = newRank.rank;
    }
    
    // Salvar automaticamente
    await user.save();
    
    return {
        success: true,
        rankedUp,
        oldRank,
        newRank,
        totalPoints: user.factionPoints,
        pointsAdded: points,
        reason
    };
}

/**
 * Obter todas as ações que concedem pontos de facção
 * @returns {Object} Objeto com as ações e seus pontos
 */
function getFactionPointsActions() {
    return {
        createThread: 15,
        createPost: 5,
        receiveUpvote: 2,
        threadPinned: 50,
        helpfulAnswer: 10,
        dailyLogin: 1,
        weeklyActive: 20
    };
}

module.exports = {
    factionSystem,
    getCurrentRank,
    getNextRank,
    getRankProgress,
    addFactionPoints,
    getFactionPointsActions
};
