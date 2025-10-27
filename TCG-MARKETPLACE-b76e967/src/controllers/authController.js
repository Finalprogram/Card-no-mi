const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../services/emailService');

// Função para MOSTRAR a página de registro
const showRegisterPage = (req, res) => {
  res.render('pages/register'); // Vamos criar esta página EJS no próximo passo
};

// Função para PROCESSAR o formulário de registro
const registerUser = async (req, res) => {
  try {
    const { username, email, password, confirmPassword } = req.body;
    const errors = {};

    // --- VALIDAÇÃO ---
    if (!username) {
      errors.username = 'Nome de usuário é obrigatório.';
    }
    if (!email) {
      errors.email = 'Email é obrigatório.';
    }
    if (!password) {
      errors.password = 'Senha é obrigatória.';
    }
    if (password !== confirmPassword) {
      errors.confirmPassword = 'As senhas não coincidem.';
    }

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      errors.email = 'Este email já está cadastrado.';
    }

    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      errors.username = 'Este nome de usuário já está em uso.';
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ errors });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Gerar token de verificação
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = Date.now() + 3600000; // 1 hora

    // --- CRIAÇÃO DO NOVO USUÁRIO (SEMPRE PESSOA FÍSICA) ---
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      accountType: 'individual', // Definido como 'individual' diretamente
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
    });

    await newUser.save();

    // Enviar email de verificação
    await sendVerificationEmail(newUser.email, verificationToken);

    res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso! Por favor, verifique seu email para ativar sua conta.' });

  } catch (error) {
    logger.error("Erro no registro:", error);
    res.status(500).json({ errors: { general: 'Erro ao registrar usuário. Tente novamente.' } });
  }
};

async function verifyEmail(req, res) {
  try {
    const { token } = req.query;

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      return res.status(400).send('Token de verificação inválido ou expirado.');
    }

    if (user.verificationTokenExpires < Date.now()) {
      return res.status(400).send('Token de verificação expirado. Por favor, registre-se novamente.');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    res.send('Email verificado com sucesso! Você já pode fazer login.');

  } catch (error) {
    logger.error('Erro ao verificar email:', error);
    res.status(500).send('Erro ao verificar email.');
  }
}

const showLoginPage = (req, res) => {
  res.render('pages/login'); // Vamos criar esta página no próximo passo
};

// 2. Função para PROCESSAR o formulário de login
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validação básica
    if (!email || !password) {
      return res.status(400).send('Por favor, preencha todos os campos.');
    }

    // Encontra o usuário no banco de dados pelo email
    const user = await User.findOne({ email });
    if (!user) {
      // Usamos uma mensagem genérica por segurança
      return res.status(400).send('Email ou senha inválidos.');
    }

    // Compara a senha digitada com a senha criptografada (hash) no banco
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).send('Email ou senha inválidos.');
    }

    // SUCESSO! A senha corresponde.
    // Verifica se o email do usuário foi verificado
    if (!user.isVerified) {
      return res.status(401).send('Por favor, verifique seu email para ativar sua conta.');
    }

    // Salvamos as informações do usuário na sessão para "lembrar" que ele está logado.
    req.session.user = {
      id: user._id,
      username: user.username,
      accountType: user.accountType
    };
    
    // Redireciona para uma página de painel do usuário (que criaremos no futuro)
    res.redirect(`/perfil/${user.username}`);

  } catch (error) {
    logger.error("Erro no login:", error);
    res.status(500).send('Erro no servidor.');
  }
};

const logoutUser = (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.redirect('/dashboard'); // Se der erro, manda para o dashboard
    }
    res.clearCookie('connect.sid'); // Limpa o cookie da sessão
    res.redirect('/'); // Redireciona para a página inicial
  });
};

// Atualiza o endereço do usuário
const updateAddress = async (req, res) => {
  const userId = req.session.user.id;
  logger.info(`[updateAddress] Iniciando atualização para o usuário ID: ${userId}`);
  logger.info('[updateAddress] Dados recebidos:', req.body);

  try {
    const { cep, street, number, complement, city, state } = req.body;

    if (!cep || !street || !number || !city || !state) {
        // Se houver erro de validação, busca os dados do usuário para renderizar o formulário novamente com o erro
        const user = await User.findById(userId);
        // Nota: Precisamos de uma forma de passar o erro para a página de perfil.
        // Por enquanto, apenas redirecionamos de volta com uma query string de erro (pode ser melhorado).
        return res.redirect(`/perfil/${req.session.user.username}?error=validation`);
    }

    const updatedUser = await User.findByIdAndUpdate(userId, {
      $set: {
        'address.cep': cep,
        'address.street': street,
        'address.number': number,
        'address.complement': complement,
        'address.city': city,
        'address.state': state,
      }
    }, { new: true }); // { new: true } retorna o documento atualizado

    if (updatedUser) {
        logger.info('[updateAddress] Usuário após a atualização:', updatedUser.toObject());
        logger.info('[updateAddress] Objeto de endereço salvo:', updatedUser.toObject().address);
        // Update the session user with the new address information
        req.session.user.address = updatedUser.address;
    } else {
        logger.warn('[updateAddress] Nenhum usuário encontrado para atualizar.');
    }

    // Redireciona de volta para a página de perfil.
    res.redirect(`/perfil/${req.session.user.username}`);

  } catch (error) {
    logger.error('Erro ao atualizar endereço:', error.message);
    logger.error(error.stack);
    res.status(500).send('Erro no servidor.');
  }
};

module.exports = {
  showRegisterPage,
  registerUser,
  showLoginPage,
  loginUser,
  logoutUser,
  updateAddress,
  verifyEmail
};