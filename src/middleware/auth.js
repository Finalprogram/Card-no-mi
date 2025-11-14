// src/middleware/auth.js

const mongoose = require('mongoose');
const User = mongoose.model('User'); // Import the User model

// In-memory object to store last activity update times for debouncing
const lastActivityUpdate = {};
const DEBOUNCE_TIME_MS = 60 * 1000; // 1 minute

// Middleware para PÁGINAS: se não estiver logado, redireciona para /login
const isAuthPage = async (req, res, next) => {
  if (req.session.user) {
    // Activity tracking with debouncing
    const userId = req.session.user._id;
    const now = Date.now();

    if (!lastActivityUpdate[userId] || (now - lastActivityUpdate[userId] > DEBOUNCE_TIME_MS)) {
      try {
        await User.findByIdAndUpdate(userId, { lastActivityAt: now });
        lastActivityUpdate[userId] = now; // Update debounce timestamp
      } catch (error) {
        console.error('Error updating lastActivityAt for user:', userId, error);
        // Continue without blocking the request even if update fails
      }
    }
    return next();
  }
  res.redirect('/auth/login');
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
  res.redirect('/auth/login'); // Or render an unauthorized page
};

const isAdminApi = (req, res, next) => {
  if (req.session.user && req.session.user.accountType === 'admin') {
    return next();
  }
  res.status(403).json({ message: 'Acesso negado. Você não tem permissões de administrador.' });
};

module.exports = { isAuthPage, isAuthApi, isAdminPage, isAdminApi };