/**
 * Script de Migração: Adicionar campo isActive aos posts e threads existentes
 * 
 * Este script adiciona o campo isActive=true a todos os posts e threads
 * que não possuem esse campo (criados antes da implementação da feature)
 */

const mongoose = require('mongoose');
require('dotenv').config();

const ForumThread = require('../src/models/ForumThread');
const ForumPost = require('../src/models/ForumPost');

async function migrateActiveStatus() {
    try {
        console.log('🔄 Iniciando migração do campo isActive...\n');

        // Conectar ao banco de dados
        await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/card-no-mi', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('✅ Conectado ao banco de dados\n');

        // ========================================
        // MIGRAR THREADS
        // ========================================
        console.log('📋 Verificando threads...');
        
        // Contar threads sem isActive ou com isActive undefined
        const threadsWithoutActive = await ForumThread.countDocuments({
            $or: [
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        });
        
        console.log(`   Threads sem isActive: ${threadsWithoutActive}`);

        if (threadsWithoutActive > 0) {
            const threadUpdateResult = await ForumThread.updateMany(
                {
                    $or: [
                        { isActive: { $exists: false } },
                        { isActive: null }
                    ]
                },
                {
                    $set: { isActive: true }
                }
            );
            console.log(`   ✅ ${threadUpdateResult.modifiedCount} threads atualizadas\n`);
        } else {
            console.log('   ✅ Todas as threads já possuem o campo isActive\n');
        }

        // ========================================
        // MIGRAR POSTS
        // ========================================
        console.log('📋 Verificando posts...');
        
        // Contar posts sem isActive ou com isActive undefined
        const postsWithoutActive = await ForumPost.countDocuments({
            $or: [
                { isActive: { $exists: false } },
                { isActive: null }
            ]
        });
        
        console.log(`   Posts sem isActive: ${postsWithoutActive}`);

        if (postsWithoutActive > 0) {
            const postUpdateResult = await ForumPost.updateMany(
                {
                    $or: [
                        { isActive: { $exists: false } },
                        { isActive: null }
                    ]
                },
                {
                    $set: { isActive: true }
                }
            );
            console.log(`   ✅ ${postUpdateResult.modifiedCount} posts atualizados\n`);
        } else {
            console.log('   ✅ Todos os posts já possuem o campo isActive\n');
        }

        // ========================================
        // ESTATÍSTICAS FINAIS
        // ========================================
        console.log('📊 Estatísticas finais:');
        
        const totalThreads = await ForumThread.countDocuments();
        const activeThreads = await ForumThread.countDocuments({ isActive: true });
        const inactiveThreads = await ForumThread.countDocuments({ isActive: false });
        
        const totalPosts = await ForumPost.countDocuments();
        const activePosts = await ForumPost.countDocuments({ isActive: true });
        const inactivePosts = await ForumPost.countDocuments({ isActive: false });

        console.log(`\n   Threads:`);
        console.log(`   - Total: ${totalThreads}`);
        console.log(`   - Ativas: ${activeThreads}`);
        console.log(`   - Inativas: ${inactiveThreads}`);
        
        console.log(`\n   Posts:`);
        console.log(`   - Total: ${totalPosts}`);
        console.log(`   - Ativos: ${activePosts}`);
        console.log(`   - Inativos: ${inactivePosts}`);

        console.log('\n✅ Migração concluída com sucesso!\n');

    } catch (error) {
        console.error('❌ Erro durante a migração:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('🔌 Conexão com o banco de dados fechada');
        process.exit(0);
    }
}

// Executar migração
migrateActiveStatus();
