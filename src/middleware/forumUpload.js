const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Criar diretório se não existir
const uploadDir = './public/uploads/forum';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configurar storage
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function(req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'forum-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Validar tipo de arquivo
function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|webp/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Apenas imagens são permitidas (jpeg, jpg, png, gif, webp)'));
  }
}

// Configurar upload
const forumUpload = multer({
  storage: storage,
  limits: { 
    fileSize: 5 * 1024 * 1024, // 5MB por imagem
    files: 5 // Máximo 5 imagens por post
  },
  fileFilter: function(req, file, cb) {
    checkFileType(file, cb);
  }
});

module.exports = forumUpload;
