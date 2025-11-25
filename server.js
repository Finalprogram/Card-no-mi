// 1. Imports
require('dotenv').config();
console.log('Server received a request.'); // Added for debugging
const logger = require('./src/config/logger');

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  // Application specific logging, throwing an error, or other logic here
  process.exit(1);
});

// Validação de Variáveis de Ambiente Essenciais
const requiredEnv = [
    'CWS_TOKEN', 
    'CWS_CEP_ORIGEM',
    'MELHOR_ENVIO_TOKEN',
    'MELHOR_ENVIO_USER_AGENT',
    'EMAIL_USER',
    'EMAIL_PASS'
];
const missingEnv = requiredEnv.filter(v => !process.env[v]);

if (missingEnv.length > 0) {
    logger.error(`
    ==================================================================
    ERRO DE CONFIGURAÇÃO: Variáveis de ambiente dos Correios ausentes.
    ==================================================================

    A aplicação não pode iniciar sem as seguintes variáveis no seu arquivo .env:
    
    ${missingEnv.join('\n    ')}

    Por favor, verifique se o arquivo .env existe na raiz do projeto e
    se ele contém essas variáveis com valores válidos.

    Exemplo:
    CWS_TOKEN="SEU_TOKEN_AQUI"
    CWS_CEP_ORIGEM="01001000"
    
    `);
    process.exit(1); // Encerra a aplicação com um código de erro.
}

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const methodOverride = require('method-override');
const flash = require('connect-flash');
const rateLimit = require('express-rate-limit');
const connectDB = require('./src/database/connection');
const pagesRoutes = require('./src/routes/pagesRoutes');
const cardRoutes = require('./src/routes/cardRoutes');
const listRoutes = require('./src/routes/listRoutes');
const authRoutes = require('./src/routes/authRoutes');
const sellerRoutes = require('./src/routes/sellerRoutes');
const listingRoutes = require('./src/routes/listingRoutes');
const cartRoutes = require('./src/routes/cartRoutes'); 
const checkoutRoutes = require('./src/routes/checkoutRoutes');
const paymentRoutes = require('./src/routes/paymentRoutes');
const reviewRoutes = require('./src/routes/reviewRoutes');
const adminRoutes = require('./src/routes/adminRoutes');
const welcomeRoutes = require('./src/routes/welcomeRoutes');
const couponRoutes = require('./src/routes/couponRoutes');
const deckRoutes = require('./src/routes/deckRoutes');
const deckPagesRoutes = require('./src/routes/deckPagesRoutes');
const forumRoutes = require('./src/routes/forumRoutes');
const profileRoutes = require('./src/routes/profileRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const reportCounter = require('./src/middleware/reportCounter');
const Card = require('./src/models/Card'); // Import the Card model

// 2. Inicialização do App
const app = express();
app.set('trust proxy', 1); // Confia no primeiro proxy reverso
const port = process.env.PORT || 3000;

// Helper para formatar preços
app.locals.formatPrice = function(price) {
  if (typeof price !== 'number') {
    return price;
  }
  let formattedPrice = `R$ ${price.toFixed(2).replace('.', ',')}`;
  if (formattedPrice.endsWith(',00')) {
    return formattedPrice.slice(0, -3);
  }
  return formattedPrice;
};

// 3. Conexão com o Banco de Dados
connectDB();
// Ensure Mongoose indexes are created/updated
Card.createIndexes().then(() => {
  logger.info('Mongoose indexes ensured for Card model.');
}).catch(err => {
  logger.error('Error ensuring Mongoose indexes for Card model:', err);
});

// Start the post-payment worker
require('./src/workers/postPaymentWorker.js');

// 4. Configuração dos Middlewares (A ORDEM IMPORTA)

// Habilita o "tradutor" de JSON. Deve vir antes das rotas que o usam.
app.use(express.json());

// Configura o EJS como o motor de visualização
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src', 'views'));

// Serve arquivos estáticos (CSS, JS, imagens) da pasta 'public'
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(methodOverride('_method'));
// Configuração da Sessão
app.use(session({
  secret: process.env.SESSION_SECRET || 'um_segredo_muito_forte_aqui',
  resave: false,
  saveUninitialized: true,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions',
    ttl: 14 * 24 * 60 * 60, // 14 days
    autoRemove: 'interval',
    autoRemoveInterval: 10, // In minutes. Removes expired sessions every 10 minutes
  }),
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
    httpOnly: true, // Prevents client-side JS from accessing the cookie
    sameSite: 'strict' // Mitigates CSRF attacks
  }
}));

app.use(flash());

// Import and use the visitorTracker middleware
const visitorTracker = require('./src/middleware/visitorTracker');
app.use(visitorTracker);

app.use(async (req, res, next) => {
  // Se há usuário na sessão, buscar dados atualizados do banco
  if (req.session.user && req.session.user.id) {
    try {
      const User = require('./src/models/User');
      const updatedUser = await User.findById(req.session.user.id).select('username email avatar role').lean();
      if (updatedUser) {
        // Atualizar sessão com dados mais recentes
        req.session.user = {
          id: updatedUser._id,
          username: updatedUser.username,
          email: updatedUser.email,
          avatar: updatedUser.avatar,
          role: updatedUser.role
        };
      }
    } catch (error) {
      console.error('Erro ao atualizar dados do usuário:', error);
    }
  }
  
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  res.locals.error = req.flash('error');
  next();
});

// 5. Configuração das Rotas (VÊM POR ÚLTIMO)

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // Limita cada IP a 100 requisições por janela
  standardHeaders: true, // Retorna informações do limite nos cabeçalhos `RateLimit-*`
  legacyHeaders: false, // Desabilita os cabeçalhos `X-RateLimit-*`
  message: 'Muitas requisições originadas deste IP, por favor, tente novamente após 15 minutos.',
});

app.use('/auth', authLimiter, authRoutes);
app.use('/', pagesRoutes);
app.use('/', cardRoutes);
// app.use('/api', cartRoutes);
app.use('/api', listRoutes);
app.use('/', sellerRoutes);
app.use('/api', listingRoutes);
app.use('/api/coupon', couponRoutes);
app.use('/api/decks', deckRoutes);
app.use('/decks', deckPagesRoutes);
app.use('/cart', cartRoutes);
app.use('/checkout', checkoutRoutes);
app.use('/payment', paymentRoutes);
app.use('/', reviewRoutes);
app.use('/forum', reportCounter, forumRoutes);
app.use('/forum', profileRoutes);
app.use('/forum', notificationRoutes);
app.use('/admin', adminRoutes);
app.use('/welcome', welcomeRoutes);

// 6. Inicia o Servidor

// Middleware de tratamento de erros
app.use((err, req, res, next) => {
  logger.error({
    message: err.message,
    stack: err.stack,
    request: {
      method: req.method,
      url: req.url,
      ip: req.ip,
      body: req.body
    }
  });

  // Evitar vazar detalhes do erro para o cliente em produção
  const errorResponse = process.env.NODE_ENV === 'production'
    ? { message: 'Ocorreu um erro interno no servidor.' }
    : { message: err.message, stack: err.stack };

  res.status(500).json(errorResponse);
});

const cron = require('node-cron');
const { recordPriceHistory } = require('./src/services/priceTracker');
const { performance } = require('perf_hooks');

// Schedule to run once a day at midnight
cron.schedule('0 0 * * *', async () => {
  logger.info('Running daily price history recording...');
  const startTime = performance.now();
  await recordPriceHistory();
  const endTime = performance.now();
  logger.info(`Price history recording finished in ${(endTime - startTime).toFixed(2)}ms`);
});

app.listen(port, () => {
  logger.info(`Servidor rodando em http://localhost:${port}`);
});
