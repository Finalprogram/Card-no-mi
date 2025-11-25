const mongoose = require('mongoose');

const moderationLogSchema = new mongoose.Schema({
    // Tipo de ação
    actionType: {
        type: String,
        enum: [
            'thread_flagged',
            'post_flagged',
            'thread_flags_dismissed',
            'post_flags_dismissed',
            'thread_deleted',
            'post_deleted',
            'thread_locked',
            'thread_unlocked',
            'thread_pinned',
            'thread_unpinned',
            'thread_inactivated',
            'thread_activated',
            'post_inactivated',
            'post_activated'
        ],
        required: true
    },

    // Referência ao conteúdo afetado
    targetType: {
        type: String,
        enum: ['thread', 'post'],
        required: true
    },
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'targetModel',
        required: true
    },
    targetModel: {
        type: String,
        enum: ['ForumThread', 'ForumPost'],
        required: true
    },
    targetTitle: String, // Para preservar o título mesmo se deletado
    targetContent: String, // Preview do conteúdo

    // Usuário que realizou a ação (moderador/admin)
    moderator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    moderatorUsername: String, // Preservar username

    // Usuário que foi alvo da ação (autor do post/thread)
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    targetUsername: String,

    // Para ações de denúncia
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    reporterUsername: String,
    reportReason: String,

    // Detalhes adicionais
    details: {
        type: String,
        maxlength: 500
    },

    // Flags arquivadas (quando dismissar ou deletar)
    archivedFlags: [{
        user: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        },
        username: String,
        reason: String,
        createdAt: Date
    }],

    // Metadados
    ipAddress: String,
    userAgent: String
}, {
    timestamps: true
});

// Índices para busca eficiente
moderationLogSchema.index({ actionType: 1, createdAt: -1 });
moderationLogSchema.index({ moderator: 1, createdAt: -1 });
moderationLogSchema.index({ targetUser: 1, createdAt: -1 });
moderationLogSchema.index({ targetId: 1, targetType: 1 });

module.exports = mongoose.model('ModerationLog', moderationLogSchema);
