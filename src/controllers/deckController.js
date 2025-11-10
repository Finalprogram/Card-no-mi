const Deck = require('../models/Deck');
const Card = require('../models/Card');

// @desc    Get all decks for a user
// @route   GET /api/decks
// @access  Private
exports.getDecks = async (req, res) => {
    res.status(200).json({ message: 'getDecks placeholder' });
};

// @desc    Get a single deck
// @route   GET /api/decks/:id
// @access  Private
exports.getDeck = async (req, res) => {
    res.status(200).json({ message: 'getDeck placeholder' });
};

// @desc    Create a deck
// @route   POST /api/decks
// @access  Private
exports.createDeck = async (req, res) => {
    try {
        const { title, description, leader, main } = req.body;
        const owner = req.session.user.id;

        if (!title) {
            return res.status(400).json({ message: 'O título do deck é obrigatório.' });
        }

        if (!leader) {
            return res.status(400).json({ message: 'O deck deve ter um líder.' });
        }

        const newDeck = new Deck({
            title,
            description,
            owner,
            leader,
            main
        });

        const savedDeck = await newDeck.save();

        res.status(201).json(savedDeck);

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
        const { title, description, leader, main } = req.body;
        const deckId = req.params.id;
        const ownerId = req.session.user.id;

        const deck = await Deck.findById(deckId);

        if (!deck) {
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        if (deck.owner.toString() !== ownerId) {
            return res.status(403).json({ message: 'Você não tem permissão para editar este deck.' });
        }

        deck.title = title;
        deck.description = description;
        deck.leader = leader;
        deck.main = main;

        const updatedDeck = await deck.save();

        res.status(200).json(updatedDeck);

    } catch (error) {
        console.error('Erro ao atualizar deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao atualizar deck.' });
    }
};

// @desc    Delete a deck
// @route   DELETE /api/decks/:id
// @access  Private
exports.deleteDeck = async (req, res) => {
    res.status(200).json({ message: 'deleteDeck placeholder' });
};

// @desc    Parse a decklist from text
// @route   POST /api/decks/parse
// @access  Private
exports.parseDeck = async (req, res) => {
    try {
        const { decklist } = req.body;
        const lines = decklist.split('\n').filter(line => line.trim() !== '');

        let deck = {
            leader: null,
            main: [],
        };

        let isLeaderSection = true;

        for (const line of lines) {
            if (line.toLowerCase().includes('leader')) {
                isLeaderSection = true;
                continue;
            }
            if (line.toLowerCase().includes('main')) {
                isLeaderSection = false;
                continue;
            }

            const parts = line.match(/(\d+)?x?\s*(.*)/);
            if (!parts) continue;

            const quantity = parseInt(parts[1] || '1', 10);
            const cardName = parts[2].trim();

            const card = await Card.findOne({ name: { $regex: new RegExp(`^${cardName}$`, 'i') } });

            const deckItem = {
                card: card ? card.toObject() : null,
                ghostCard: card ? null : { name: cardName },
                quantity: quantity,
            };

            if (isLeaderSection) {
                deck.leader = deckItem;
                isLeaderSection = false; // Assume only one leader
            } else {
                deck.main.push(deckItem);
            }
        }

        res.status(200).json(deck);

    } catch (error) {
        console.error('Erro ao fazer parse do deck:', error);
        res.status(500).json({ message: 'Erro interno do servidor ao fazer parse do deck.' });
    }
};
