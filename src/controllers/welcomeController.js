const User = require('../models/User');
const logger = require('../config/logger');
const { validateCPF, validateCNPJ, validateEmail, validatePhoneBR, validateWhatsApp } = require('../utils/validation'); // Importar a funcao de validacao
const PartnerStore = require('../models/PartnerStore');
const { ensurePartnerStoreSchema } = require('../services/partnerStoreBootstrap');

const showStep1 = (req, res) => {
    const user = req.session?.user;
    const isStore = user && ['store', 'partner_store'].includes(user.accountType);
    res.render('pages/welcome/step1', { isStore });
};

const handleStep1 = async (req, res) => {
    try {
        const { fullName, phone, documentNumber } = req.body;
        const userId = req.session.user.id;
        const user = await User.findByPk(userId);
        if (phone) {
            const cleanedPhone = String(phone).replace(/\D/g, '');
            if (!validatePhoneBR(cleanedPhone)) {
                return res.redirect('/welcome/step1?error=phoneInvalid');
            }
        }
        const isStore = user && ['store', 'partner_store'].includes(user.accountType);

        if (!documentNumber) {
            logger.error(`[welcome] Usuario ${userId} tentou completar o passo 1 sem documento.`);
            return res.redirect(`/welcome/step1?error=${isStore ? 'cnpjRequired' : 'cpfRequired'}`);
        }
        if (isStore) {
            if (!validateCNPJ(documentNumber)) {
                logger.error(`[welcome] Usuario ${userId} forneceu um CNPJ invalido: ${documentNumber}`);
                return res.redirect('/welcome/step1?error=cnpjInvalid');
            }
        } else if (!validateCPF(documentNumber)) {
            logger.error(`[welcome] Usuario ${userId} forneceu um CPF invalido: ${documentNumber}`);
            return res.redirect('/welcome/step1?error=cpfInvalid');
        }

        await User.update(
            { fullName, phone, documentType: isStore ? 'CNPJ' : 'CPF', documentNumber },
            { where: { id: userId } }
        );

        res.redirect('/welcome/step2');
    } catch (error) {
        logger.error('Erro no passo 1 do tutorial:', error);
        res.redirect('/welcome/step1');
    }
};

const showStep2 = (req, res) => {
    const user = req.session?.user;
    const isStore = user && ['store', 'partner_store'].includes(user.accountType);
    res.render('pages/welcome/step2', { isStore });
};

const handleStep2 = async (req, res) => {
    try {
        const { cep, street, number, complement, neighborhood, city, state } = req.body;
        const userId = req.session.user.id;

        if (!neighborhood) {
          logger.error(`[welcome] Usuario ${userId} tentou completar o passo 2 sem bairro.`);
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

        const user = await User.findByPk(userId);
        const isStore = user && ['store', 'partner_store'].includes(user.accountType);

        await User.update(
            { address },
            { where: { id: userId } }
        );

        if (isStore) {
            return res.redirect('/welcome/step3');
        }

        await User.update(
            { firstLogin: false },
            { where: { id: userId } }
        );

        res.redirect('/');
    } catch (error) {
        logger.error('Erro no passo 2 do tutorial:', error);
        res.redirect('/welcome/step2');
    }
};

const showStep3 = (req, res) => {
    res.render('pages/welcome/step3');
};

const handleStep3 = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const user = await User.findByPk(userId);
        if (!user || !['store', 'partner_store'].includes(user.accountType)) {
            return res.redirect('/');
        }

        const {
            storeName,
            logoUrl,
            websiteUrl,
            instagramUrl,
            whatsappUrl,
            contactEmail,
            city,
            state,
            description
        } = req.body;

        if (!storeName) {
            return res.redirect('/welcome/step3?error=storeNameRequired');
        }
        if (!city || !state) {
            return res.redirect('/welcome/step3?error=locationRequired');
        }
        if (!whatsappUrl && !contactEmail) {
            return res.redirect('/welcome/step3?error=contactRequired');
        }
        if (contactEmail && !validateEmail(contactEmail)) {
            return res.redirect('/welcome/step3?error=contactEmailInvalid');
        }
        if (whatsappUrl && !validateWhatsApp(whatsappUrl)) {
            return res.redirect('/welcome/step3?error=whatsappInvalid');
        }

        await ensurePartnerStoreSchema();
        const [record] = await PartnerStore.findOrCreate({
            where: { userId },
            defaults: {
                storeName,
                logoUrl,
                websiteUrl,
                instagramUrl,
                whatsappUrl,
                contactEmail,
                city,
                state,
                description,
                status: 'PENDING'
            }
        });

        if (!record.isNewRecord) {
            await record.update({
                storeName,
                logoUrl,
                websiteUrl,
                instagramUrl,
                whatsappUrl,
                contactEmail,
                city,
                state,
                description,
                status: 'PENDING'
            });
        }

        await user.update({
            businessName: storeName,
            firstLogin: false
        });

        res.redirect('/');
    } catch (error) {
        logger.error('Erro no passo 3 do tutorial:', error);
        res.redirect('/welcome/step3');
    }
};

module.exports = {
    showStep1,
    handleStep1,
    showStep2,
    handleStep2,
    showStep3,
    handleStep3
};
