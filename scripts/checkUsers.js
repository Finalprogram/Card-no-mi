require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('Conectado ao MongoDB');
  
  try {
    // Contar total de usuários
    const count = await User.countDocuments();
    console.log(`\n📊 Total de usuários no banco: ${count}`);
    
    // Listar todos os usuários
    if (count > 0) {
      const users = await User.find().select('username email role accountType createdAt').lean();
      console.log('\n👥 Usuários encontrados:');
      users.forEach((user, index) => {
        console.log(`\n${index + 1}. ${user.username}`);
        console.log(`   Email: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Account Type: ${user.accountType}`);
        console.log(`   Criado em: ${user.createdAt}`);
      });
    } else {
      console.log('\n⚠️  Nenhum usuário encontrado no banco de dados!');
    }
    
    // Verificar coleções disponíveis
    const collections = await mongoose.connection.db.listCollections().toArray();
    console.log('\n📦 Coleções disponíveis no banco:');
    collections.forEach(col => {
      console.log(`   - ${col.name}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar usuários:', error);
  }
  
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.error('❌ Erro ao conectar ao MongoDB:', err);
  process.exit(1);
});
