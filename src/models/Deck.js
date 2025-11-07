const mongoose = require('mongoose');

const cardInDeckSchema = new mongoose.Schema({
    card: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Card'
    },
    // ghostCard: { tempId, opcgId?, name, rarity?, color?, image? }
    // For now, we'll just store the name for ghost cards
    ghostCard: {
        name: String,
        opcgId: String,
        image: String,
    },
    quantity: {
        type: Number,
        required: true,
        min: 1,
        default: 1
    }
}, { _id: false });

const deckSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    format: {
        type: String,
        enum: ['Standard', 'Unlimited'],
        default: 'Standard'
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    leader: cardInDeckSchema,
    main: [cardInDeckSchema],
    //side: [cardInDeckSchema], // Future feature
    //extra: [cardInDeckSchema], // Future feature
}, { timestamps: true });

const Deck = mongoose.model('Deck', deckSchema);

module.exports = Deck;
