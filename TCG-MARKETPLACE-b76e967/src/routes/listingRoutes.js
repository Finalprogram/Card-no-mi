const express = require('express');
const router = express.Router();
const listingController = require('../controllers/listingController');
const { isAuthApi, isAuthPage } = require('../middleware/auth'); // Importa o middleware centralizado

// Rota para receber o "pacote" de novos anúncios, agora usando isAuthApi
router.post('/listings/bulk-create', isAuthApi, listingController.bulkCreateListings);

// Rotas para editar, atualizar e deletar anúncios
router.get('/listings/:id/edit', isAuthPage, listingController.showEditListingPage);
router.put('/listings/:id', isAuthPage, listingController.updateListing);
router.delete('/listings/:id', isAuthPage, listingController.deleteListing);

module.exports = router;