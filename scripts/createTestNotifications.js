require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Notification = require('../src/models/Notification');

async function createNotifications() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB\n');

        // Buscar usuário Muliru
        const muliru = await User.findOne({ username: 'Muliru' });
        
        if (!muliru) {
            console.log('❌ Usuário Muliru não encontrado');
            process.exit(1);
        }

        console.log('👤 Usuário encontrado:', muliru.username);
        console.log('📧 Email:', muliru.email);
        console.log('');

        // Criar notificações de teste
        console.log('📝 Criando notificações de teste...\n');

        // 1. Notificação de menção
        await Notification.create({
            recipient: muliru._id,
            sender: muliru._id, // Usando o próprio usuário como sender
            type: 'mention',
            title: '📢 Você foi mencionado!',
            message: '@Muliru foi mencionado em uma discussão sobre One Piece TCG',
            icon: 'fa-at',
            color: '#8b5cf6',
            link: '/forum',
            createdAt: new Date()
        });
        console.log('✅ Notificação 1/4 criada: Menção');

        // 2. Notificação de resposta
        await Notification.create({
            recipient: muliru._id,
            sender: muliru._id,
            type: 'reply',
            title: '💬 Nova resposta no seu tópico',
            message: 'Alguém respondeu ao seu tópico "Melhores cartas Roxa do momento"',
            icon: 'fa-comment',
            color: '#3b82f6',
            link: '/forum',
            createdAt: new Date()
        });
        console.log('✅ Notificação 2/4 criada: Resposta');

        // 3. Notificação de quote
        await Notification.create({
            recipient: muliru._id,
            sender: muliru._id,
            type: 'quote',
            title: '💬 Alguém citou seu post',
            message: 'Seu post sobre estratégias de deck foi citado em outra discussão',
            icon: 'fa-quote-left',
            color: '#10b981',
            link: '/forum',
            createdAt: new Date()
        });
        console.log('✅ Notificação 3/4 criada: Quote');

        // 4. Notificação de reputação
        await Notification.create({
            recipient: muliru._id,
            sender: muliru._id,
            type: 'reputation',
            title: '🏴‍☠️ Rank Up!',
            message: 'Parabéns! Você subiu de rank na facção Pirata!',
            icon: 'fa-trophy',
            color: '#FFB800',
            link: '/forum/leaderboard',
            createdAt: new Date()
        });
        console.log('✅ Notificação 4/4 criada: Reputação');

        // Contar notificações não lidas
        const count = await Notification.countDocuments({ 
            recipient: muliru._id, 
            isRead: false 
        });

        console.log('');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('📊 RESUMO:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('👤 Usuário:', muliru.username);
        console.log('🔔 Notificações não lidas:', count);
        console.log('');
        console.log('✨ Acesse o site e clique no sino 🔔');
        console.log('   para ver as notificações!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        await mongoose.connection.close();
        process.exit(0);
    } catch (error) {
        console.error('❌ Erro:', error);
        process.exit(1);
    }
}

createNotifications();
