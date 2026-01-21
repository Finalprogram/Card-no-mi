const User = require('./User');
const Card = require('./Card');
const Listing = require('./Listing');
const Order = require('./Order');
const Deck = require('./Deck');
const { Achievement, UserAchievement } = require('./Achievement');

Listing.belongsTo(Card, { as: 'card', foreignKey: 'cardId' });
Listing.belongsTo(User, { as: 'seller', foreignKey: 'sellerId' });
Card.hasMany(Listing, { as: 'listings', foreignKey: 'cardId' });
User.hasMany(Listing, { as: 'listings', foreignKey: 'sellerId' });

Order.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(Order, { as: 'orders', foreignKey: 'userId' });

Deck.belongsTo(User, { as: 'owner', foreignKey: 'ownerId' });
User.hasMany(Deck, { as: 'decks', foreignKey: 'ownerId' });

UserAchievement.belongsTo(Achievement, { as: 'achievement', foreignKey: 'achievementId' });
UserAchievement.belongsTo(User, { as: 'user', foreignKey: 'userId' });
Achievement.hasMany(UserAchievement, { as: 'userAchievements', foreignKey: 'achievementId' });
User.hasMany(UserAchievement, { as: 'achievements', foreignKey: 'userId' });
