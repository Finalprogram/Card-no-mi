const User = require('../models/User');
const logger = require('../config/logger');

const showStep1 = (req, res) => {
    res.render('pages/welcome/step1');
};

const handleStep1 = async (req, res) => {
    try {
        const { fullName, phone } = req.body;
        const userId = req.session.user.id;

        await User.findByIdAndUpdate(userId, { $set: { fullName, phone } });

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
        const { cep, street, number, complement, city, state } = req.body;
        const userId = req.session.user.id;

        const address = {
            cep,
            street,
            number,
            complement,
            city,
            state,
        };

        await User.findByIdAndUpdate(userId, { $set: { address, firstLogin: false } });

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