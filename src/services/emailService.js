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

const sendPasswordResetEmail = async (to, token) => {
  let baseUrl = process.env.BASE_URL;
  // Remove 'www.' if present
  if (baseUrl.startsWith('www.')) {
    baseUrl = baseUrl.substring(4);
  }
  // If no protocol is present, default to 'https://'
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const resetUrl = new URL(`/auth/reset-password/${token}`, baseUrl);
  const resetLink = resetUrl.toString();

  const subject = 'Recuperação de Senha - TCG Marketplace';
  const htmlContent = `
      <p>Olá,</p>
      <p>Você solicitou a redefinição da sua senha. Clique no link abaixo para criar uma nova senha:</p>
      <p><a href="${resetLink}">Redefinir Senha</a></p>
      <p>Este link expirará em 1 hora.</p>
      <p>Se você não solicitou a redefinição de senha, por favor, ignore este email.</p>
    `;

  await sendEmail(to, subject, htmlContent);
};


const sendOrderStatusEmail = async (to, orderId, status, data = {}) => {
  let baseUrl = process.env.BASE_URL;
  if (baseUrl.startsWith('www.')) {
    baseUrl = baseUrl.substring(4);
  }
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const orderUrl = new URL(`/meus-pedidos/${orderId}`, baseUrl).toString();

  const statusMap = {
    PendingPayment: 'Pagamento pendente',
    Processing: 'Em processamento',
    Paid: 'Pagamento confirmado',
    Shipped: 'Enviado',
    Delivered: 'Entregue',
    Cancelled: 'Cancelado'
  };

  const subject = `Atualizacao do pedido #${orderId} - ${statusMap[status] || status}`;
  const htmlContent = `
      <p>Ola${data.name ? `, ${data.name}` : ''}!</p>
      <p>Seu pedido <strong>#${orderId}</strong> foi atualizado para: <strong>${statusMap[status] || status}</strong>.</p>
      <p>Acompanhe os detalhes aqui: <a href="${orderUrl}">${orderUrl}</a></p>
      <p>Obrigado por comprar na Card no Mi.</p>
    `;

  await sendEmail(to, subject, htmlContent);
};

const sendSaleEmail = async (to, orderId, itemName, quantity, totalPrice, data = {}) => {
  let baseUrl = process.env.BASE_URL;
  if (baseUrl.startsWith('www.')) {
    baseUrl = baseUrl.substring(4);
  }
  if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
    baseUrl = `https://${baseUrl}`;
  }
  const orderUrl = new URL(`/meus-pedidos-vendidos?order=${orderId}`, baseUrl).toString();

  const subject = `Voce tem uma nova venda - Pedido #${orderId}`;
  const htmlContent = `
      <p>Ola${data.name ? `, ${data.name}` : ''}!</p>
      <p>Voce vendeu <strong>${quantity}x ${itemName}</strong> no pedido <strong>#${orderId}</strong>.</p>
      <p>Total da venda: <strong>R$ ${Number(totalPrice || 0).toFixed(2).replace('.', ',')}</strong></p>
      <p>Detalhes: <a href="${orderUrl}">${orderUrl}</a></p>
    `;

  await sendEmail(to, subject, htmlContent);
};

module.exports = { sendVerificationEmail, sendEmail, sendPasswordResetEmail, sendOrderStatusEmail, sendSaleEmail };