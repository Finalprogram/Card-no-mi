// src/middleware/auth.js

// Middleware para PÁGINAS: se não estiver logado, redireciona para /login
const isAuthPage = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.redirect('/login');
};

// Middleware para APIs: se não estiver logado, retorna um erro 401 em JSON
const isAuthApi = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ message: 'Não autorizado. Por favor, faça o login.' });
};


const isAdminPage = (req, res, next) => {
  if (req.session.user && req.session.user.accountType === 'admin') {
    return next();
  }
  // If not authenticated or not admin, redirect to login or show an error
  res.redirect('/login'); // Or render an unauthorized page
};

const isAdminApi = (req, res, next) => {
  if (req.session.user && req.session.user.accountType === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Acesso negado. Você não tem permissões de administrador.' });
};

module.exports = { isAuthPage, isAuthApi, isAdminPage, isAdminApi };