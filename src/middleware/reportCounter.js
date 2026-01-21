/**
 * Middleware para adicionar contagem de reports pendentes
 * Usado para exibir badge no menu de moderação
 */

const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const { Op } = require('sequelize');

const addReportCount = async (req, res, next) => {
    try {
        // Só executar para moderadores/admins logados
        if (req.session.user && (req.session.user.role === 'moderator' || req.session.user.role === 'admin')) {
            // Contar threads com flags
            const threadHasFlags = ForumThread.sequelize.where(
                ForumThread.sequelize.fn('jsonb_array_length', ForumThread.sequelize.col('moderationFlags')),
                { [Op.gt]: 0 }
            );
            const flaggedThreadsCount = await ForumThread.count({
                where: {
                    isDeleted: false,
                    [Op.and]: threadHasFlags
                }
            });

            // Contar posts com flags
            const postHasFlags = ForumPost.sequelize.where(
                ForumPost.sequelize.fn('jsonb_array_length', ForumPost.sequelize.col('moderationFlags')),
                { [Op.gt]: 0 }
            );
            const flaggedPostsCount = await ForumPost.count({
                where: {
                    isDeleted: false,
                    [Op.and]: postHasFlags
                }
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
