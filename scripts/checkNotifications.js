require('dotenv').config();
const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');

async function check() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const user = await User.findOne({ username: 'Muliru' });
        console.log('👤 Usuario ID:', user._id);
        
        const notifs = await Notification.find({ recipient: user._id })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('sender', 'username');
        
        console.log('\n📋 Notificações encontradas:', notifs.length);
        console.log('🔔 Não lidas:', notifs.filter(n => !n.isRead).length);
        
        notifs.forEach((n, i) => {
            console.log(`\n${i+1}. ${n.title}`);
            console.log('   Tipo:', n.type);
            console.log('   Lida:', n.isRead);
            console.log('   Sender:', n.sender?.username || 'N/A');
            console.log('   Link:', n.link);
            console.log('   Data:', n.createdAt.toLocaleString());
        });
        
        process.exit(0);
    } catch (error) {
        console.error('Erro:', error);
        process.exit(1);
    }
}

check();
