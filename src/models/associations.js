const User = require('./User');
const Card = require('./Card');
const Listing = require('./Listing');
const Order = require('./Order');
const Deck = require('./Deck');
const { Achievement, UserAchievement } = require('./Achievement');
const ForumCategory = require('./ForumCategory');
const ForumThread = require('./ForumThread');
const ForumPost = require('./ForumPost');
const ModerationLog = require('./ModerationLog');
const Tournament = require('./Tournament');
const TournamentParticipant = require('./TournamentParticipant');
const TournamentMatch = require('./TournamentMatch');

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

ForumCategory.hasMany(ForumThread, { as: 'threads', foreignKey: 'categoryId' });
ForumThread.belongsTo(ForumCategory, { as: 'category', foreignKey: 'categoryId' });

ForumThread.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
ForumThread.belongsTo(User, { as: 'lastActivityBy', foreignKey: 'lastActivityById' });
ForumThread.belongsTo(User, { as: 'inactivatedBy', foreignKey: 'inactivatedById' });
ForumThread.belongsTo(User, { as: 'deletedBy', foreignKey: 'deletedById' });
User.hasMany(ForumThread, { as: 'forumThreads', foreignKey: 'authorId' });

ForumPost.belongsTo(ForumThread, { as: 'thread', foreignKey: 'threadId' });
ForumThread.hasMany(ForumPost, { as: 'posts', foreignKey: 'threadId' });
ForumPost.belongsTo(User, { as: 'author', foreignKey: 'authorId' });
ForumPost.belongsTo(User, { as: 'inactivatedBy', foreignKey: 'inactivatedById' });
ForumPost.belongsTo(User, { as: 'deletedBy', foreignKey: 'deletedById' });
ForumPost.belongsTo(ForumPost, { as: 'parentPost', foreignKey: 'parentPostId' });
ForumPost.belongsTo(ForumPost, { as: 'quotedPost', foreignKey: 'quotedPostId' });

ModerationLog.belongsTo(User, { as: 'moderator', foreignKey: 'moderatorId' });
ModerationLog.belongsTo(User, { as: 'targetUser', foreignKey: 'targetUserId' });
ModerationLog.belongsTo(User, { as: 'reporter', foreignKey: 'reporterId' });

Tournament.belongsTo(User, { as: 'organizer', foreignKey: 'createdById' });
User.hasMany(Tournament, { as: 'organizedTournaments', foreignKey: 'createdById' });

TournamentParticipant.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentParticipant, { as: 'participants', foreignKey: 'tournamentId' });
TournamentParticipant.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(TournamentParticipant, { as: 'tournamentEntries', foreignKey: 'userId' });

TournamentMatch.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentMatch, { as: 'matches', foreignKey: 'tournamentId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'playerA', foreignKey: 'playerAId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'playerB', foreignKey: 'playerBId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'winner', foreignKey: 'winnerId' });
