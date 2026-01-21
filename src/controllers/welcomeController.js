const User = require('../models/User');
const logger = require('../config/logger');
const { validateCPF } = require('../utils/validation'); // Importar a função de validação

const showStep1 = (req, res) => {
    res.render('pages/welcome/step1');
};

const handleStep1 = async (req, res) => {
    try {
        const { fullName, phone, documentNumber } = req.body;
        const userId = req.session.user.id;

        // Validação do CPF
        if (!documentNumber) {
            logger.error(`[welcome] Usuário ${userId} tentou completar o passo 1 sem CPF.`);
            return res.redirect('/welcome/step1?error=cpfRequired');
        }
        if (!validateCPF(documentNumber)) {
            logger.error(`[welcome] Usuário ${userId} forneceu um CPF inválido: ${documentNumber}`);
            return res.redirect('/welcome/step1?error=cpfInvalid');
        }

        await User.update(
            { fullName, phone, documentType: 'CPF', documentNumber },
            { where: { id: userId } }
        );

        res.redirect('/welcome/step2');
    } catch (error) {
        logger.error('Erro no passo 1 do tutorial:', error);
        res.redirect('/welcome/step1');
    }
};

const showStep2 = (req, res) => {
    res.render('pages/welcome/step2');
};

const handleStep2 = async (req, res) => {
    try {
        const { cep, street, number, complement, neighborhood, city, state } = req.body;
        const userId = req.session.user.id;

        // Basic validation for neighborhood
        if (!neighborhood) {
          logger.error(`[welcome] Usuário ${userId} tentou completar o passo 2 sem bairro.`);
          return res.redirect('/welcome/step2?error=neighborhoodRequired');
        }

        const address = {
            cep,
            street,
            number,
            complement,
            neighborhood,
            city,
            state,
        };

        await User.update(
            { address, firstLogin: false },
            { where: { id: userId } }
        );

        res.redirect('/'); // Redireciona para a home page após a finalização
    } catch (error) {
        logger.error('Erro no passo 2 do tutorial:', error);
        res.redirect('/welcome/step2');
    }
};

module.exports = {
    showStep1,
    handleStep1,
    showStep2,
    handleStep2,
};
