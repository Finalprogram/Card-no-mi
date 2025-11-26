/**
 * Script de teste para sistema de pontos de facção
 * Testa criação de threads, posts e upvotes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const ForumThread = require('../src/models/ForumThread');
const ForumPost = require('../src/models/ForumPost');
const ForumCategory = require('../src/models/ForumCategory');
const factionSystem = require('../src/config/factionSystem');

async function testFactionPoints() {
    try {
        console.log('🔗 Conectando ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado!\n');

        // Buscar usuário de teste
        const username = process.argv[2] || 'Muliru';
        const user = await User.findOne({ username });

        if (!user) {
            console.log(`❌ Usuário ${username} não encontrado`);
            process.exit(1);
        }

        console.log('👤 Usuário:', user.username);
        console.log('🏴‍☠️ Facção:', user.faction || 'Nenhuma');
        console.log('📊 Pontos iniciais:', user.factionPoints || 0);
        console.log('🎖️ Rank inicial:', user.factionRank || 0);
        
        if (user.faction) {
            const rankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints || 0);
            console.log('👑 Título:', rankInfo.title);
        }
        console.log('');

        if (!user.faction) {
            console.log('⚠️ Usuário não tem facção! Escolha uma facção primeiro em /forum/faction/choose');
            process.exit(0);
        }

        // Buscar uma categoria para criar thread de teste
        const category = await ForumCategory.findOne({ isActive: true });
        if (!category) {
            console.log('❌ Nenhuma categoria encontrada');
            process.exit(1);
        }

        console.log('📝 TESTE 1: Criando thread de teste...');
        const pointsBefore1 = user.factionPoints;
        
        // Simular ganho de pontos por criar thread
        const result1 = await factionSystem.addFactionPoints(user, 10, 'Teste: Criou uma thread');
        
        console.log(`   ✅ Thread criada!`);
        console.log(`   💰 Pontos antes: ${pointsBefore1}`);
        console.log(`   💰 Pontos depois: ${result1.totalPoints}`);
        console.log(`   📈 Ganhou: +${result1.pointsAdded} pontos`);
        if (result1.rankedUp) {
            console.log(`   🎉 RANK UP! ${result1.oldRank.title} → ${result1.newRank.title}`);
        }
        console.log('');

        console.log('💬 TESTE 2: Criando 3 posts...');
        for (let i = 1; i <= 3; i++) {
            const pointsBefore = user.factionPoints;
            const result = await factionSystem.addFactionPoints(user, 5, `Teste: Criou post #${i}`);
            console.log(`   Post ${i}: ${pointsBefore} → ${result.totalPoints} (+${result.pointsAdded})`);
            if (result.rankedUp) {
                console.log(`   🎉 RANK UP! ${result.oldRank.title} → ${result.newRank.title}`);
            }
        }
        console.log('');

        console.log('⬆️ TESTE 3: Recebendo 5 upvotes...');
        for (let i = 1; i <= 5; i++) {
            const pointsBefore = user.factionPoints;
            const result = await factionSystem.addFactionPoints(user, 2, `Teste: Recebeu upvote #${i}`);
            console.log(`   Upvote ${i}: ${pointsBefore} → ${result.totalPoints} (+${result.pointsAdded})`);
            if (result.rankedUp) {
                console.log(`   🎉 RANK UP! ${result.oldRank.title} → ${result.newRank.title}`);
            }
        }
        console.log('');

        console.log('📊 RESULTADO FINAL:');
        console.log('=====================================');
        console.log('👤 Usuário:', user.username);
        console.log('🏴‍☠️ Facção:', user.faction);
        console.log('💰 Pontos finais:', user.factionPoints);
        console.log('🎖️ Rank:', user.factionRank);
        
        const finalRank = factionSystem.getCurrentRank(user.faction, user.factionPoints);
        console.log('👑 Título:', finalRank.title);
        console.log('💵 Bounty:', `₿${(user.factionPoints * 10000).toLocaleString('pt-BR')}`);
        
        const progress = factionSystem.getRankProgress(user.faction, user.factionPoints);
        if (!progress.isMaxRank) {
            console.log('');
            console.log('📈 PRÓXIMO RANK:', progress.nextRank.title);
            console.log('🎯 Faltam:', progress.pointsToNext, 'pontos');
            console.log('⚡ Progresso:', `${progress.progress}%`);
        } else {
            console.log('🏆 RANK MÁXIMO ATINGIDO!');
        }

        console.log('\n✅ Teste concluído com sucesso!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

testFactionPoints();
