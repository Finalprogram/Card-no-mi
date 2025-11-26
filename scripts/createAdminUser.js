require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../src/models/User');

async function createAdminUser() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB');
    
    // Verificar se já existe
    const existing = await User.findOne({ email: 'murilobdf14@gmail.com' });
    if (existing) {
      console.log('⚠️  Usuário já existe!');
      console.log('Email:', existing.email);
      console.log('Username:', existing.username);
      console.log('Role:', existing.role);
      
      // Atualizar para admin se não for
      if (existing.role !== 'admin') {
        existing.role = 'admin';
        await existing.save();
        console.log('✅ Atualizado para admin!');
      }
      
      mongoose.connection.close();
      return;
    }
    
    // Criar novo usuário
    const hashedPassword = await bcrypt.hash('Admin123!', 10);
    
    const newUser = new User({
      username: 'Murilo',
      email: 'murilobdf14@gmail.com',
      password: hashedPassword,
      role: 'admin',
      accountType: 'individual',
      isVerified: true,
      profile: {
        bio: 'Administrador do sistema',
        location: 'Brasil'
      },
      preferences: {
        emailNotifications: true,
        theme: 'light'
      }
    });
    
    await newUser.save();
    
    console.log('\n✅ Usuário admin criado com sucesso!');
    console.log('\n📧 Email: murilobdf14@gmail.com');
    console.log('🔑 Senha: Admin123!');
    console.log('👤 Username: Murilo');
    console.log('⭐ Role: admin');
    console.log('\n⚠️  IMPORTANTE: Altere a senha após o primeiro login!');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

createAdminUser();
