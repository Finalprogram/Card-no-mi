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
const TournamentStage = require('./TournamentStage');
const TournamentPayment = require('./TournamentPayment');
const DecklistSnapshot = require('./DecklistSnapshot');
const TournamentStanding = require('./TournamentStanding');
const AuditLog = require('./AuditLog');
const PartnerStore = require('./PartnerStore');
const StoreCredit = require('./StoreCredit');

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

Tournament.belongsTo(User, { as: 'organizer', foreignKey: 'organizerId' });
User.hasMany(Tournament, { as: 'organizedTournaments', foreignKey: 'organizerId' });
Tournament.belongsTo(User, { as: 'storeCreditStore', foreignKey: 'storeCreditStoreId' });
User.hasMany(Tournament, { as: 'storeCreditTournaments', foreignKey: 'storeCreditStoreId' });

TournamentParticipant.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentParticipant, { as: 'participants', foreignKey: 'tournamentId' });
TournamentParticipant.belongsTo(User, { as: 'user', foreignKey: 'userId' });
User.hasMany(TournamentParticipant, { as: 'tournamentEntries', foreignKey: 'userId' });

TournamentMatch.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentMatch, { as: 'matches', foreignKey: 'tournamentId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'playerA', foreignKey: 'playerAId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'playerB', foreignKey: 'playerBId' });
TournamentMatch.belongsTo(TournamentParticipant, { as: 'winner', foreignKey: 'winnerRegistrationId' });

TournamentStage.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentStage, { as: 'stages', foreignKey: 'tournamentId' });

TournamentMatch.belongsTo(TournamentStage, { as: 'stage', foreignKey: 'stageId' });
TournamentStage.hasMany(TournamentMatch, { as: 'matches', foreignKey: 'stageId' });

TournamentPayment.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentPayment, { as: 'payments', foreignKey: 'tournamentId' });
TournamentPayment.belongsTo(TournamentParticipant, { as: 'registration', foreignKey: 'registrationId' });
TournamentParticipant.hasMany(TournamentPayment, { as: 'payments', foreignKey: 'registrationId' });
TournamentPayment.belongsTo(User, { as: 'player', foreignKey: 'playerId' });
User.hasMany(TournamentPayment, { as: 'tournamentPayments', foreignKey: 'playerId' });

DecklistSnapshot.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(DecklistSnapshot, { as: 'decklists', foreignKey: 'tournamentId' });
DecklistSnapshot.belongsTo(TournamentParticipant, { as: 'registration', foreignKey: 'registrationId' });
DecklistSnapshot.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

TournamentStanding.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(TournamentStanding, { as: 'standings', foreignKey: 'tournamentId' });
TournamentStanding.belongsTo(TournamentStage, { as: 'stage', foreignKey: 'stageId' });
TournamentStanding.belongsTo(TournamentParticipant, { as: 'registration', foreignKey: 'registrationId' });
TournamentStanding.belongsTo(User, { as: 'player', foreignKey: 'playerId' });

AuditLog.belongsTo(User, { as: 'actor', foreignKey: 'actorId' });
User.hasMany(AuditLog, { as: 'auditLogs', foreignKey: 'actorId' });

PartnerStore.belongsTo(User, { as: 'owner', foreignKey: 'userId' });
User.hasMany(PartnerStore, { as: 'partnerStores', foreignKey: 'userId' });

StoreCredit.belongsTo(Tournament, { as: 'tournament', foreignKey: 'tournamentId' });
Tournament.hasMany(StoreCredit, { as: 'storeCredits', foreignKey: 'tournamentId' });
StoreCredit.belongsTo(User, { as: 'store', foreignKey: 'storeId' });
User.hasMany(StoreCredit, { as: 'storeCredits', foreignKey: 'storeId' });
StoreCredit.belongsTo(User, { as: 'player', foreignKey: 'playerId' });
User.hasMany(StoreCredit, { as: 'playerCredits', foreignKey: 'playerId' });
