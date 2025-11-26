/**
 * Script para definir facção pirata para testes
 */

require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

async function setFaction() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const username = process.argv[2] || 'Muliru';
        const user = await User.findOne({ username });
        
        if (!user) {
            console.log(`❌ Usuário ${username} não encontrado`);
            process.exit(1);
        }
        
        user.faction = 'pirate';
        user.factionRank = 0;
        user.factionPoints = 0;
        user.factionJoinedAt = new Date();
        
        await user.save();
        
        console.log('✅ Facção pirata definida para', username);
        console.log('🏴‍☠️ Pronto para testar!');
        
    } catch (error) {
        console.error('❌ Erro:', error);
    } finally {
        await mongoose.connection.close();
        process.exit(0);
    }
}

setFaction();
