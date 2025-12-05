const User = require('../models/User');
const bcrypt = require('bcryptjs');
const logger = require('../config/logger');
const crypto = require('crypto');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');
const { validateCPF } = require('../utils/validation');

// Função para MOSTRAR a página de registro
const showRegisterPage = (req, res) => {
  res.render('pages/register'); // Vamos criar esta página EJS no próximo passo
};

// Função para PROCESSAR o formulário de registro
const registerUser = async (req, res) => {
  try {
    let { email, username, phone, password, confirmPassword, documentType, documentNumber } = req.body;
    const errors = {};

    // Limpar o número de telefone no backend
    const cleanedPhone = phone ? phone.replace(/\D/g, '') : '';

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
      phone: cleanedPhone, // Usar o número de telefone limpo
      password: hashedPassword,
      accountType: 'individual', // Definido como 'individual' diretamente
      isVerified: false,
      verificationToken,
      verificationTokenExpires,
      documentType: documentType || 'CPF', // Default to CPF if not provided
      documentNumber,
    });

    await newUser.save();

    logger.info(`New user created: ${newUser.username} (ID: ${newUser._id}, Email: ${newUser.email})`);

    // Enviar email de verificação
    await sendVerificationEmail(newUser.email, verificationToken);

    res.status(201).json({ success: true, message: 'Cadastro realizado com sucesso! Por favor, verifique seu email para ativar sua conta.' });

  } catch (error) {
    logger.error("Erro no registro:", error);
    res.status(500).json({ errors: { general: 'Erro ao registrar usuário. Tente novamente.' } });
  }
};

async function verifyEmail(req, res) {
  logger.info('[verifyEmail] Função de verificação de email chamada.');
  try {
    const { token } = req.query;
    logger.info(`[verifyEmail] Token recebido: ${token}`);

    const user = await User.findOne({ verificationToken: token });

    if (!user) {
      logger.warn(`[verifyEmail] Token inválido ou não encontrado: ${token}`);
      return res.status(400).send('Token de verificação inválido ou expirado.');
    }

    logger.info(`[verifyEmail] Usuário encontrado para o token: ${user.username}`);

    if (user.verificationTokenExpires < Date.now()) {
      logger.warn(`[verifyEmail] Token expirado para o usuário: ${user.username}`);
      return res.status(400).send('Token de verificação expirado. Por favor, registre-se novamente.');
    }

    user.isVerified = true;
    user.verificationToken = undefined;
    user.verificationTokenExpires = undefined;
    await user.save();

    logger.info(`[verifyEmail] Usuário ${user.username} verificado com sucesso.`);
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
    const clientIp = req.ip; // Captura o IP do cliente

    // Validação básica
    if (!email || !password) {
      logger.warn(`[Login Attempt] Failed: Missing email or password. IP: ${clientIp}`);
      req.flash('error', 'Por favor, preencha todos os campos.');
      return res.redirect('/auth/login');
    }

    // Encontra o usuário no banco de dados pelo email
    const user = await User.findOne({ email });
    if (!user) {
      logger.warn(`[Login Attempt] Failed: User not found for email: ${email}. IP: ${clientIp}`);
      req.flash('error', 'Email ou senha inválidos.');
      return res.redirect('/auth/login');
    }

    // Compara a senha digitada com a senha criptografada (hash) no banco
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      logger.warn(`[Login Attempt] Failed: Invalid password for user: ${user.username} (ID: ${user._id}). IP: ${clientIp}`);
      req.flash('error', 'Email ou senha inválidos.');
      return res.redirect('/auth/login');
    }

    // SUCESSO! A senha corresponde.
    // Verifica se o email do usuário foi verificado
    if (!user.isVerified) {
      logger.warn(`[Login Attempt] Failed: Account not verified for user: ${user.username} (ID: ${user._id}). IP: ${clientIp}`);
      req.flash('error', 'Por favor, verifique seu email para ativar sua conta.');
      return res.redirect('/auth/login');
    }

    // Regenera a sessão para evitar session fixation
    req.session.regenerate(err => {
      if (err) {
        logger.error("Erro ao regenerar a sessão:", err);
        return res.status(500).send('Erro no servidor.');
      }

      // Salvamos as informações do usuário na nova sessão
        req.session.user = {
          id: user._id,
          username: user.username,
          accountType: user.accountType,
          avatar: user.avatar,
          role: user.role
        };
      
      logger.info(`[Login] Success: User ${user.username} (ID: ${user._id}) logged in. IP: ${clientIp}`);

      if (user.firstLogin) {
        return res.redirect('/welcome/step1');
      }

      // Redireciona para uma página de painel do usuário
      res.redirect(`/perfil/${user.id}`);
    });

  } catch (error) {
    logger.error("Erro no login:", error);
    res.status(500).send('Erro no servidor.');
  }
};

const logoutUser = (req, res) => {
  const user = req.session.user;
  if (user) {
    logger.info(`[Logout] User ${user.username} (ID: ${user.id}) logged out.`);
  }

  req.session.destroy(err => {
    if (err) {
      logger.error(`[Logout] Error destroying session for user ID: ${user?.id}:`, err);
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
    if (!documentNumber) {
      errors.documentNumber = 'CPF/CNPJ é obrigatório.';
    } else if (documentType === 'CPF' && !validateCPF(documentNumber)) {
      errors.documentNumber = 'CPF inválido.';
    }

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
        logger.info(`[updateProfile] Profile updated successfully for user ID: ${userId}.`);
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

const updateAvatar = async (req, res) => {
  try {
    const userId = req.session.user.id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuário não encontrado.' });
    }

    if (req.file) {
      user.avatar = `/uploads/avatars/${req.file.filename}`;
      await user.save();
      req.session.user.avatar = user.avatar;
      res.json({ success: true, message: 'Avatar atualizado com sucesso!', avatar: user.avatar });
    } else {
      res.status(400).json({ success: false, message: 'Nenhum arquivo foi enviado.' });
    }
  } catch (error) {
    logger.error('Erro ao atualizar avatar:', error);
    res.status(500).json({ success: false, message: 'Erro no servidor ao atualizar avatar.' });
  }
};

const showForgotPasswordPage = (req, res) => {
  res.render('auth/forgot-password');
};

const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      req.flash('success_msg', 'Se um usuário com este email existir, um link de recuperação de senha será enviado.');
      return res.redirect('/auth/forgot-password');
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const passwordResetExpires = Date.now() + 3600000; // 1 hora

    user.passwordResetToken = passwordResetToken;
    user.passwordResetExpires = passwordResetExpires;
    await user.save();

    await sendPasswordResetEmail(user.email, resetToken);

    req.flash('success_msg', 'Se um usuário com este email existir, um link de recuperação de senha será enviado.');
    res.redirect('/auth/forgot-password');
  } catch (error) {
    logger.error('Erro no processo de esqueci a senha:', error);
    req.flash('error_msg', 'Erro ao processar a sua solicitação. Tente novamente.');
    res.redirect('/auth/forgot-password');
  }
};

const showResetPasswordPage = async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash('error_msg', 'Token de redefinição de senha inválido ou expirado.');
      return res.redirect('/auth/forgot-password');
    }

    res.render('pages/reset-password', { token });
  } catch (error) {
    logger.error('Erro ao mostrar a página de redefinir senha:', error);
    res.status(500).send('Erro no servidor.');
  }
};

const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password, confirmPassword } = req.body;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      req.flash('error_msg', 'Token de redefinição de senha inválido ou expirado.');
      return res.redirect('/auth/forgot-password');
    }

    if (password !== confirmPassword) {
      req.flash('error_msg', 'As senhas não coincidem.');
      return res.redirect(`/auth/reset-password/${token}`);
    }

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(password, salt);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    req.flash('success_msg', 'Sua senha foi redefinida com sucesso! Você já pode fazer login.');
    res.redirect('/auth/login');
  } catch (error) {
    logger.error('Erro ao redefinir a senha:', error);
    req.flash('error_msg', 'Erro ao redefinir sua senha. Tente novamente.');
    res.redirect(`/auth/reset-password/${token}`);
  }
};

module.exports = {
  showRegisterPage,
  registerUser,
  showLoginPage,
  loginUser,
  logoutUser,
  updateProfile, // Nome da função atualizado
  verifyEmail,
  updateAvatar,
  showForgotPasswordPage,
  forgotPassword,
  showResetPasswordPage,
  resetPassword,
};
