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
    const { email, username, phone, password, confirmPassword, documentType, documentNumber } = req.body;
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
    if (!documentNumber) {
      errors.documentNumber = 'CPF/CNPJ é obrigatório.';
    }

    const existingUserByUsername = await User.findOne({ username });
    if (existingUserByUsername) {
      errors.username = 'Este nome de usuário já está em uso.';
    }

    const existingUserByEmail = await User.findOne({ email });
    if (existingUserByEmail) {
      errors.email = 'Este email já está cadastrado.';
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
      phone,
      password: hashedPassword,
      accountType: 'individual', // Definido como 'individual' diretamente
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      documentType: documentType || 'CPF', // Default to CPF if not provided
      documentNumber,
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

    res.render('pages/verification-success');

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
      accountType: user.accountType
    };
    
    if (user.firstLogin) {
      return res.redirect('/welcome/step1');
    }

    // Redireciona para uma página de painel do usuário (que criaremos no futuro)
    res.redirect(`/perfil/${user.id}`);

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

// Atualiza os dados do perfil do usuário
const updateProfile = async (req, res) => {
  const userId = req.session.user.id;
  logger.info(`[updateProfile] Iniciando atualização para o usuário ID: ${userId}`);
  logger.info('[updateProfile] Dados recebidos:', req.body);

  try {
    const { fullName, phone, cep, street, number, complement, neighborhood, city, state, documentType, documentNumber } = req.body;
    const errors = {};

    if (!fullName) errors.fullName = 'Nome completo é obrigatório.';
    if (!cep) errors.cep = 'CEP é obrigatório.';
    if (!street) errors.street = 'Rua é obrigatória.';
    if (!number) errors.number = 'Número é obrigatório.';
    if (!neighborhood) errors.neighborhood = 'Bairro é obrigatório.';
    if (!city) errors.city = 'Cidade é obrigatória.';
    if (!state) errors.state = 'Estado é obrigatório.';
    if (!documentNumber) errors.documentNumber = 'CPF/CNPJ é obrigatório.';

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({ success: false, message: 'Erro de validação', errors });
    }

    const updatedUser = await User.findByIdAndUpdate(userId, {
      $set: {
        fullName: fullName,
        phone: phone,
        'address.cep': cep,
        'address.street': street,
        'address.number': number,
        'address.complement': complement,
        'address.neighborhood': neighborhood,
        'address.city': city,
        'address.state': state,
        documentType: documentType || 'CPF',
        documentNumber: documentNumber,
      }
    }, { new: true });

    if (updatedUser) {
        logger.info('[updateProfile] Usuário após a atualização:', updatedUser.toObject());
        req.session.user.address = updatedUser.address;
        req.session.user.fullName = updatedUser.fullName;
        req.session.user.phone = updatedUser.phone;
        req.session.user.documentType = updatedUser.documentType;
        req.session.user.documentNumber = updatedUser.documentNumber;
        return res.json({ success: true, message: 'Perfil atualizado com sucesso!' });
    } else {
        logger.warn('[updateProfile] Nenhum usuário encontrado para atualizar.');
        return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

  } catch (error) {
    logger.error('Erro ao atualizar perfil:', error.message);
    logger.error(error.stack);
    return res.status(500).json({ success: false, message: 'Erro no servidor ao atualizar perfil.' });
  }
};

module.exports = {
  showRegisterPage,
  registerUser,
  showLoginPage,
  loginUser,
  logoutUser,
  updateProfile, // Nome da função atualizado
  verifyEmail
};