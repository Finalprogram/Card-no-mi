const nodemailer = require('nodemailer');
const { URL } = require('url');
const logger = require('../config/logger');

const transporter = nodemailer.createTransport({
  host: 'smtp.hostinger.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// Função genérica para enviar e-mails
const sendEmail = async (to, subject, htmlContent) => {
  const mailOptions = {
    from: '"TCG Marketplace" <' + process.env.EMAIL_USER + '>',
    to,
    subject,
    html: htmlContent,
  };

  try {
    await transporter.sendMail(mailOptions);
    logger.info(`Email enviado para ${to} com assunto: ${subject}`);
  } catch (error) {
    logger.error(`Erro ao enviar email para ${to} (Assunto: ${subject}):`, error);
    throw error; // Re-lança o erro para ser tratado pelo chamador
  }
};

const sendVerificationEmail = async (to, token) => {
  let baseUrl = process.env.BASE_URL;
  // Remove 'www.' if present
  if (baseUrl.startsWith('www.')) {
    baseUrl = baseUrl.substring(4);
  }
  // If no protocol is present, default to 'https://'
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const verificationUrl = new URL('/auth/verify-email', baseUrl);
  verificationUrl.searchParams.set('token', token);
  const verificationLink = verificationUrl.toString();

  const subject = 'Verifique seu Email - TCG Marketplace';
  const htmlContent = `
      <p>Olá,</p>
      <p>Obrigado por se registrar no TCG Marketplace. Por favor, verifique seu email clicando no link abaixo:</p>
      <p><a href="${verificationLink}">Verificar Email</a></p>
      <p>Este link expirará em 1 hora.</p>
      <p>Se você não se registrou em nosso site, por favor, ignore este email.</p>
    `;

  await sendEmail(to, subject, htmlContent);
};

module.exports = { sendVerificationEmail, sendEmail };