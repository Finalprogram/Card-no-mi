const Deck = require('../models/Deck');
const Card = require('../models/Card');

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
        const cards = await Card.find({
            $or: [
                { name: { $regex: query, $options: 'i' } },
                { code: { $regex: query, $options: 'i' } }
            ]
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
        const decks = await Deck.find()
            .populate('owner', 'username') // Populate owner's username
            .populate('leader.card')   // Populate leader card details
            .sort({ updatedAt: -1 });
        
        res.render('pages/decks', {
            decks: decks,
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
        const decks = await Deck.find({ owner: userId })
            .populate('owner', 'username') // Populate owner's username
            .populate('leader.card')   // Populate leader card details
            .sort({ updatedAt: -1 });
        
        res.render('pages/my-decks', {
            decks: decks,
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
        const decks = await Deck.find({ isPublic: true })
            .populate('owner', 'username')
            .populate('leader.card')
            .sort({ updatedAt: -1 });
        
        res.render('pages/community-decks', {
            decks: decks,
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
        const deck = await Deck.findById(req.params.id)
            .populate('leader.card')
            .populate('main.card')
            .populate('owner', 'username');

        if (!deck) {
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        res.status(200).json(deck);
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

        const newDeck = new Deck({
            title,
            description,
            owner,
            leader,
            main,
            isPublic: isPublic // Assign directly, as it's already a boolean
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
        const { title, description, leader, main, isPublic } = req.body;
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
        deck.isPublic = isPublic;

        // Sanitize the leader and main deck to store only the necessary info
        if (leader && leader.card) {
            deck.leader = {
                card: leader.card._id,
                quantity: 1
            };
        } else {
            deck.leader = null;
        }

        if (main && Array.isArray(main)) {
            deck.main = main.map(item => ({
                card: item.card._id,
                quantity: item.quantity
            }));
        } else {
            deck.main = [];
        }


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
    try {
        const deckId = req.params.id;
        const ownerId = req.session.user.id;

        const deck = await Deck.findById(deckId);

        if (!deck) {
            return res.status(404).json({ message: 'Deck não encontrado.' });
        }

        if (deck.owner.toString() !== ownerId) {
            return res.status(403).json({ message: 'Você não tem permissão para excluir este deck.' });
        }

        await deck.deleteOne();

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
        const lines = decklist.split('\n').filter(line => line.trim() !== '');

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
                $or: [
                    { code: { $regex: new RegExp(`^${identifier}$`, 'i') } },
                    { api_id: { $regex: new RegExp(`^${identifier}$`, 'i') } }
                ]
            });

            if (!card) {
                notFoundCards.push(identifier);
                continue; // Continue to find all missing cards
            }

            const deckItem = {
                card: card.toObject(),
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
