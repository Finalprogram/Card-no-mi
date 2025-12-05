require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

// Conectar ao MongoDB
mongoose.connect(process.env.MONGODB_URI)
.then(async () => {
  console.log('Conectado ao MongoDB');
  
  try {
    // Atualizar usuário para admin
    const result = await User.updateOne(
      { email: 'murilobdf14@gmail.com' },
      { $set: { accountType: 'admin' } }
    );
    
    if (result.matchedCount > 0) {
      console.log('✅ Usuário atualizado para admin com sucesso!');
      
      // Mostrar dados do usuário
      const user = await User.findOne({ email: 'murilobdf14@gmail.com' });
      console.log('\nDados do usuário:');
      console.log('Email:', user.email);
      console.log('Username:', user.username);
      console.log('Account Type:', user.accountType);
    } else {
      console.log('❌ Usuário não encontrado');
    }
  } catch (error) {
    console.error('Erro ao atualizar usuário:', error);
  }
  
  mongoose.connection.close();
  process.exit(0);
})
.catch(err => {
  console.error('Erro ao conectar ao MongoDB:', err);
  process.exit(1);
});
