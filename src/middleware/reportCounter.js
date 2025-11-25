/**
 * Middleware para adicionar contagem de reports pendentes
 * Usado para exibir badge no menu de moderação
 */

const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');

const addReportCount = async (req, res, next) => {
    try {
        // Só executar para moderadores/admins logados
        if (req.session.user && (req.session.user.role === 'moderator' || req.session.user.role === 'admin')) {
            // Contar threads com flags
            const flaggedThreadsCount = await ForumThread.countDocuments({
                'moderationFlags.0': { $exists: true },
                isDeleted: false
            });

            // Contar posts com flags
            const flaggedPostsCount = await ForumPost.countDocuments({
                'moderationFlags.0': { $exists: true },
                isDeleted: false
            });

            const totalReports = flaggedThreadsCount + flaggedPostsCount;

            // Adicionar à sessão e ao objeto user
            req.session.pendingReportsCount = totalReports;
            req.session.user.pendingReportsCount = totalReports;
        } else {
            req.session.pendingReportsCount = 0;
        }
    } catch (error) {
        console.error('Erro ao contar reports:', error);
        req.session.pendingReportsCount = 0;
    }
    
    next();
};

module.exports = addReportCount;
