require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function resetFaction() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // Buscar seu usuário (altere o username se necessário)
        const username = process.argv[2];
        
        if (!username) {
            console.log('❌ Uso: node scripts/resetMyFaction.js SEU_USERNAME');
            process.exit(1);
        }

        const user = await User.findOne({ username: username });

        if (!user) {
            console.log(`❌ Usuário "${username}" não encontrado`);
            process.exit(1);
        }

        console.log(`\n📋 Usuário encontrado: ${user.username}`);
        console.log(`   Facção atual: ${user.faction || 'Nenhuma'}`);
        console.log(`   Rank: ${user.factionRank || 0}`);
        console.log(`   Pontos: ${user.factionPoints || 0}`);

        // Resetar facção
        user.faction = null;
        user.factionRank = 0;
        user.factionPoints = 0;
        user.factionJoinedAt = null;
        user.factionChangedAt = null;

        await user.save();

        console.log('\n✅ Facção resetada com sucesso!');
        console.log('🔄 Agora você pode acessar /forum e escolher novamente');

        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

resetFaction();
