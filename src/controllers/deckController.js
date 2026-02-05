const Deck = require('../models/Deck');
const Card = require('../models/Card');
const { Op } = require('sequelize');

function addIdAlias(value) {
    if (value && value.id != null && value._id == null) {
        value._id = value.id;
    }
    return value;
}

function toPlainWithId(modelInstance) {
    if (!modelInstance) return null;
    const data = modelInstance.toJSON ? modelInstance.toJSON() : modelInstance;
    return addIdAlias(data);
}

async function hydrateDecksWithCards(decks) {
    const decksData = decks.map(toPlainWithId);
    const cardIds = new Set();

    decksData.forEach(deck => {
        if (deck.leader && deck.leader.card) cardIds.add(Number(deck.leader.card));
        (deck.main || []).forEach(item => {
            if (item.card) cardIds.add(Number(item.card));
        });
    });

    if (cardIds.size === 0) return decksData;

    const cards = await Card.findAll({ where: { id: Array.from(cardIds) } });
    const cardMap = new Map(cards.map(card => [card.id, addIdAlias(card.toJSON())]));

    decksData.forEach(deck => {
        if (deck.leader && deck.leader.card) {
            deck.leader.card = cardMap.get(Number(deck.leader.card)) || null;
        }
        deck.main = (deck.main || []).map(item => ({
            ...item,
            card: cardMap.get(Number(item.card)) || null
        }));
    });

    return decksData;
}

// @desc    Search for cards
// @route   GET /api/decks/search-cards
// @access  Private
exports.searchCards = async (req, res) => {
    try {
        const query = req.query.q;
        console.log(`Search query received: "${query}"`);

        if (!query || query.length < 3) {
            return res.json([]);
        }

        // Use a case-insensitive regex to find cards
        const cards = await Card.findAll({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${query}%` } },
                    { code: { [Op.iLike]: `%${query}%` } }
                ]
            }
        });

        console.log(`Found ${cards.length} cards for query "${query}"`);

        res.json(cards);
    } catch (error) {
        console.error('Error searching cards:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar cartas.' });
    }
};

// @desc    Get all decks for a user and render the page
// @route   GET /decks
// @access  Private
exports.getDecks = async (req, res) => {
    try {
        const decks = await Deck.findAll({
            include: [{ model: require('../models/User'), as: 'owner', attributes: ['id', 'username'] }],
            order: [['updatedAt', 'DESC']]
        });
        const hydratedDecks = await hydrateDecksWithCards(decks);
        
        res.render('pages/decks', {
            decks: hydratedDecks,
            page_css: 'decks-ui.css' // Pass the new CSS file
        });
    } catch (error) {
        console.error('Error fetching decks:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Get all decks for a user and render the page
// @route   GET /my-decks
// @access  Private
exports.getMyDecks = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const decks = await Deck.findAll({
            where: { ownerId: userId },
            include: [{ model: require('../models/User'), as: 'owner', attributes: ['id', 'username'] }],
            order: [['updatedAt', 'DESC']]
        });
        const hydratedDecks = await hydrateDecksWithCards(decks);
        
        res.render('pages/my-decks', {
            decks: hydratedDecks,
            page_css: 'decks-ui.css' // Pass the new CSS file
        });
    } catch (error) {
        console.error('Error fetching decks:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Get all public decks for the community page
// @route   GET /decks/community
// @access  Public
exports.getCommunityDecks = async (req, res) => {
    try {
        const decks = await Deck.findAll({
            where: { isPublic: true },
            include: [{ model: require('../models/User'), as: 'owner', attributes: ['id', 'username'] }],
            order: [['updatedAt', 'DESC']]
        });
        const hydratedDecks = await hydrateDecksWithCards(decks);
        
        res.render('pages/community-decks', {
            decks: hydratedDecks,
            page_css: 'decks-ui.css'
        });
    } catch (error) {
        console.error('Error fetching community decks:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Get a single deck
// @route   GET /api/decks/:id
// @access  Private
exports.getDeck = async (req, res) => {
    try {
        const deck = await Deck.findByPk(req.params.id, {
            include: [{ model: require('../models/User'), as: 'owner', attributes: ['id', 'username'] }]
        });

        if (!deck) {
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        const [hydratedDeck] = await hydrateDecksWithCards([deck]);
        res.status(200).json(hydratedDeck);
    } catch (error) {
        console.error('Erro ao buscar deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao buscar deck.' });
    }
};

// @desc    Create a deck
// @route   POST /api/decks
// @access  Private
exports.createDeck = async (req, res) => {
    try {
        const { title, description, leader, main, isPublic } = req.body;
        const owner = req.session.user.id;

        if (!title) {
            return res.status(400).json({ message: 'O título do deck é obrigatório.' });
        }

        const newDeck = await Deck.create({
            title,
            description,
            ownerId: owner,
            leader,
            main,
            isPublic: isPublic // Assign directly, as it's already a boolean
        });

        res.status(201).json(toPlainWithId(newDeck));

    } catch (error) {
        console.error('Erro ao criar deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao criar deck.' });
    }
};

// @desc    Update a deck
// @route   PUT /api/decks/:id
// @access  Private
exports.updateDeck = async (req, res) => {
    try {
        const { title, description, leader, main, isPublic } = req.body;
        const deckId = req.params.id;
        const ownerId = req.session.user.id;

        const deck = await Deck.findByPk(deckId);

        if (!deck) {
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        if (deck.ownerId.toString() !== ownerId) {
            return res.status(403).json({ message: 'Você não tem permissão para editar este deck.' });
        }

        deck.title = title;
        deck.description = description;
        deck.isPublic = isPublic;

        // Sanitize the leader and main deck to store only the necessary info
        if (leader && leader.card) {
            // Check if card is already an ID or an object
            const leaderCardId = typeof leader.card === 'string' ? leader.card : leader.card.id || leader.card._id;
            deck.leader = {
                card: leaderCardId,
                quantity: 1
            };
        } else {
            deck.leader = null;
        }

        if (main && Array.isArray(main)) {
            deck.main = main.map(item => {
                // Check if card is already an ID or an object
                const cardId = typeof item.card === 'string' ? item.card : item.card.id || item.card._id;
                return {
                    card: cardId,
                    quantity: item.quantity
                };
            });
        } else {
            deck.main = [];
        }


        const updatedDeck = await deck.save();

        res.status(200).json(toPlainWithId(updatedDeck));

    } catch (error) {
        console.error('Erro ao atualizar deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar deck.' });
    }
};

// @desc    Delete a deck
// @route   DELETE /api/decks/:id
// @access  Private
exports.deleteDeck = async (req, res) => {
    try {
        const deckId = req.params.id;
        const ownerId = req.session.user.id;

        console.log(`Attempting to delete deck with ID: ${deckId}`);
        console.log(`User attempting deletion (ownerId): ${ownerId}`);

        const deck = await Deck.findByPk(deckId);

        if (!deck) {
            console.log(`Deck with ID ${deckId} not found.`);
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        console.log(`Found deck. Deck owner: ${deck.ownerId.toString()}`);

        if (deck.ownerId.toString() !== ownerId) {
            console.log(`Authorization failed: deck owner (${deck.ownerId.toString()}) does not match user (${ownerId}).`);
            return res.status(403).json({ message: 'Você não tem permissão para excluir este deck.' });
        }

        await deck.destroy();

        res.status(200).json({ message: 'Deck excluído com sucesso.' });
    } catch (error) {
        console.error('Erro ao excluir deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao excluir deck.' });
    }
};

// @desc    Parse a decklist from text
// @route   POST /api/decks/parse
// @access  Private
exports.parseDeck = async (req, res) => {
    try {
        const { decklist } = req.body;
        if (!decklist || typeof decklist !== 'string') {
            return res.status(400).json({ message: 'Decklist inválida.' });
        }
        const lines = decklist
            .split(/[\n;]+/)
            .map((line) => line.trim())
            .filter((line) => line !== '');

        let deck = {
            leader: null,
            main: [],
        };

        let isLeaderSection = true;
        const notFoundCards = [];

        for (const line of lines) {
            if (line.toLowerCase().includes('leader') || line.toLowerCase().includes('líder')) {
                isLeaderSection = true;
                continue;
            }
            if (line.toLowerCase().includes('main')) {
                isLeaderSection = false;
                continue;
            }

            const parts = line.match(/(\d+)?x?\s*(.*)/);
            if (!parts || !parts[2]) continue;

            const quantity = parseInt(parts[1] || '1', 10);
            const identifier = parts[2].trim();
            
            if (!identifier) continue;

            const card = await Card.findOne({
                where: {
                    [Op.or]: [
                        { code: { [Op.iLike]: identifier } },
                        { api_id: { [Op.iLike]: identifier } }
                    ]
                }
            });

            if (!card) {
                notFoundCards.push(identifier);
                continue; // Continue to find all missing cards
            }

            const deckItem = {
                card: addIdAlias(card.toJSON()),
                quantity: quantity,
            };

            if (isLeaderSection) {
                deck.leader = deckItem;
                isLeaderSection = false; // Assume only one leader
            } else {
                deck.main.push(deckItem);
            }
        }

        if (notFoundCards.length > 0) {
            return res.status(400).json({
                message: `As seguintes cartas não foram encontradas pelo código/ID: ${notFoundCards.join(', ')}. Verifique os códigos e tente novamente.`,
                notFoundCards: notFoundCards,
            });
        }

        res.status(200).json(deck);

    } catch (error) {
        console.error('Erro ao fazer parse do deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fazer parse do deck.' });
    }
};
