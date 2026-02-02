const { Op, fn, col, literal } = require('sequelize');
const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const UserReputation = require('../models/UserReputation');
const User = require('../models/User');
const ModerationLog = require('../models/ModerationLog');
const notificationService = require('../services/notificationService');
const achievementService = require('../services/achievementService');
const { UserDailyProgress } = require('../models/DailyMission');
const logger = require('../config/logger');
const factionSystem = require('../config/factionSystem');
const { sequelize } = require('../database/connection');

// ============================================================================ 
// SISTEMA DE FACÇÃO
// ============================================================================ 

// @desc    Show faction choice page
// @route   GET /forum/faction/choose
// @access  Private
exports.getFactionChoice = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect('/auth/login?redirect=/forum');
        }

        const user = await User.findByPk(req.session.user.id);
        
        if (user && user.faction) {
            return res.redirect('/forum');
        }

        res.render('pages/forum/faction-choice', {
            user: req.session.user,
            pageTitle: 'Escolha sua Facção'
        });
    } catch (error) {
        logger.error('Erro ao exibir escolha de facção:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Process faction choice
// @route   POST /forum/faction/choose
// @access  Private
exports.postFactionChoice = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const { faction } = req.body;
        
        if (!faction || !['pirate', 'marine'].includes(faction)) {
            return res.status(400).json({ success: false, message: 'Facção inválida' });
        }

        const userId = req.session.user.id;
        const user = await User.findByPk(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        if (user.faction) {
            return res.status(400).json({ success: false, message: 'Você já escolheu uma facção' });
        }

        await user.update({
            faction: faction,
            factionRank: 0,
            factionPoints: 0,
            factionJoinedAt: new Date(),
            factionChangedAt: new Date()
        });

        req.session.user.faction = faction;
        req.session.user.factionRank = 0;

        logger.info(`Usuário ${user.username} escolheu a facção: ${faction}`);

        const rankInfo = factionSystem.getCurrentRank(faction, 0);

        res.json({
            success: true, 
            message: 'Facção escolhida com sucesso!',
            rank: {
                name: rankInfo ? rankInfo.title : 'Recruta',
                level: 0
            }
        });
    } catch (error) {
        logger.error('Erro ao processar escolha de facção:', error);
        res.status(500).json({ success: false, message: 'Erro ao processar escolha' });
    }
};

// ============================================================================ 
// CATEGORIAS
// ============================================================================ 

// @desc    Get forum index with all categories
// @route   GET /forum
// @access  Public
exports.getForumIndex = async (req, res) => {
    try {
        if (req.session.user) {
            const user = await User.findByPk(req.session.user.id);
            if (user && !user.faction) {
                return res.redirect('/forum/faction/choose');
            }
        }
        
        const categories = await ForumCategory.findAll({
            where: {
                isActive: true,
                parentCategoryId: { [Op.is]: null }
            },
            order: [['order', 'ASC']]
        });

        for (const category of categories) {
            const subforums = await ForumCategory.findAll({
                where: {
                    parentCategoryId: category.id,
                    isActive: true,
                    isSubforum: true
                },
                order: [['order', 'ASC']]
            });
            
            category.subforums = subforums;
            
            for (const subforum of subforums) {
                subforum.threadCount = await ForumThread.count({ where: { categoryId: subforum.id, isDeleted: false } });
                subforum.lastThread = await ForumThread.findOne({
                    where: { categoryId: subforum.id, isDeleted: false },
                    order: [['lastActivity', 'DESC']],
                    attributes: ['title', 'slug', 'lastActivity']
                });
            }
            
            const threadCount = await ForumThread.count({ where: { categoryId: category.id, isDeleted: false } });
            
            const postCountQuery = {
                isDeleted: false,
                threadId: {
                    [Op.in]: (await ForumThread.findAll({ where: { categoryId: category.id, isDeleted: false }, attributes: ['id'] })).map(t => t.id)
                }
            };
            
            const isAdminIndex = req.session.user && req.session.user.role === 'admin';
            if (!isAdminIndex) {
                postCountQuery.isActive = true;
            }
            
            const postCount = await ForumPost.count({ where: postCountQuery });

            const lastThread = await ForumThread.findOne({
                where: { categoryId: category.id, isDeleted: false },
                order: [['lastActivity', 'DESC']],
                include: [
                    { model: User, as: 'author', attributes: ['username', 'avatar', 'faction', 'factionPoints'] },
                    { model: User, as: 'lastActivityBy', attributes: ['username'] }
                ]
            });

            category.threadCount = threadCount;
            category.postCount = postCount;
            category.lastThread = lastThread;
        }
        const totalUsers = await User.count();
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsersCount = await User.count({ where: { lastActivityAt: { [Op.gte]: fiveMinutesAgo } } });
        const onlineUsers = await User.findAll({
            where: { lastActivityAt: { [Op.gte]: fiveMinutesAgo } },
            attributes: ['id', 'username', 'avatar', 'faction', 'factionPoints', 'lastActivityAt'],
            order: [['lastActivityAt', 'DESC']],
            limit: 12
        });

        res.render('pages/forum/index', {
            categories,
            totalUsers,
            onlineUsersCount,
            onlineUsers,
            user: req.session.user || null,
            pageTitle: 'F?rum Card no Mi'
        });

    } catch (error) {
        logger.error('Erro ao buscar índice do fórum:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// ============================================================================ 
// THREADS
// ============================================================================ 

// @desc    Get threads from a category
// @route   GET /forum/:categorySlug
// @access  Public
exports.getCategoryThreads = async (req, res) => {
    try {
        const { categorySlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;
        const sortBy = req.query.sort || 'activity';
        const filterTag = req.query.tag;

        const category = await ForumCategory.findOne({ where: { slug: categorySlug } });
        if (!category) {
            return res.status(404).send('Categoria não encontrada');
        }

        const subforums = await ForumCategory.findAll({
            where: {
                parentCategoryId: category.id,
                isActive: true,
                isSubforum: true
            },
            order: [['order', 'ASC']]
        });
        
        for (const subforum of subforums) {
            subforum.threadCount = await ForumThread.count({ where: { categoryId: subforum.id, isDeleted: false } });
            subforum.postCount = await ForumPost.count({
                where: {
                    isDeleted: false,
                    threadId: { [Op.in]: (await ForumThread.findAll({ where: { categoryId: subforum.id, isDeleted: false }, attributes: ['id'] })).map(t => t.id) }
                }
            });
        }

        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let query = {
            categoryId: category.id,
            isDeleted: false 
        };
        
        if (!isAdmin) {
            query.isActive = true;
        }

        if (filterTag) {
            query.tags = { [Op.contains]: [filterTag] };
        }

        const pinnedThreads = await ForumThread.findAll({
            where: { ...query, isPinned: true },
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar'] },
                { model: User, as: 'lastActivityBy', attributes: ['username'] }
            ],
            order: [['lastActivity', 'DESC']]
        });

        const unpinnedQuery = { ...query, isPinned: { [Op.ne]: true } };
        
        let sortOption = [];
        switch (sortBy) {
            case 'latest':
                sortOption = [['createdAt', 'DESC']];
                break;
            case 'popular':
                sortOption = [['viewCount', 'DESC']];
                break;
            case 'activity':
            default:
                sortOption = [['lastActivity', 'DESC']];
        }

        const { count: totalThreads, rows: unpinnedThreads } = await ForumThread.findAndCountAll({
            where: unpinnedQuery,
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar'] },
                { model: User, as: 'lastActivityBy', attributes: ['username'] }
            ],
            order: sortOption,
            offset: skip,
            limit: limit
        });

        const threads = [...pinnedThreads, ...unpinnedThreads];

        for (const thread of threads) {
            let postCountQuery = {
                threadId: thread.id,
                isDeleted: false 
            };
            
            if (!isAdmin) {
                postCountQuery.isActive = true;
            }
            
            thread.postCount = await ForumPost.count({ where: postCountQuery });
        }

        const totalPages = Math.ceil(totalThreads / limit);

        const allThreadsInCategory = await ForumThread.findAll({
            where: { categoryId: category.id, isDeleted: false },
            attributes: ['tags']
        });
        
        const tagsSet = new Set();
        allThreadsInCategory.forEach(t => {
            if (t.tags) t.tags.forEach(tag => tagsSet.add(tag));
        });
        const popularTags = Array.from(tagsSet).slice(0, 20);

        res.render('pages/forum/category', {
            category,
            subforums,
            threads,
            currentPage: page,
            totalPages,
            sortBy,
            filterTag,
            popularTags,
            user: req.session.user || null,
            pageTitle: `${category.name} - Fórum`
        });
    } catch (error) {
        logger.error('Erro ao buscar threads da categoria:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Get single thread with all posts
// @route   GET /forum/:categorySlug/:threadSlug
// @access  Public
exports.getThread = async (req, res) => {
    try {
        const { categorySlug, threadSlug } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let threadQuery = { slug: threadSlug, isDeleted: false };
        
        if (!isAdmin) {
            threadQuery.isActive = true;
        }

        const thread = await ForumThread.findOne({
            where: threadQuery,
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar', 'createdAt'] },
                { model: ForumCategory, as: 'category' }
            ]
        });

        if (!thread) {
            return res.status(404).send('Thread não encontrada');
        }

        await thread.increment('viewCount');

        let postQuery = {
            threadId: thread.id,
            isDeleted: false 
        };
        
        if (!isAdmin) {
            postQuery.isActive = true;
        }
        
        const posts = await ForumPost.findAll({
            where: postQuery,
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar', 'createdAt'] },
                { model: ForumPost, as: 'parentPost' },
                { model: ForumPost, as: 'quotedPost' }
            ],
            order: [['path', 'ASC'], ['createdAt', 'ASC']]
        });
        
        const postsMap = {};
        const rootPosts = [];
        
        posts.forEach(post => {
            post.replies = [];
            postsMap[post.id] = post;
        });
        
        posts.forEach(post => {
            if (post.parentPostId) {
                const parent = postsMap[post.parentPostId];
                if (parent) {
                    parent.replies.push(post);
                }
            } else {
                rootPosts.push(post);
            }
        });

        const authorIds = [thread.authorId, ...posts.map(p => p.authorId)];
        const reputations = await UserReputation.findAll({
            where: { userId: { [Op.in]: authorIds } }
        });

        const reputationMap = {};
        reputations.forEach(rep => {
            reputationMap[rep.userId] = rep;
        });

        thread.author.reputation = reputationMap[thread.authorId] || null;
        posts.forEach(post => {
            post.author.reputation = reputationMap[post.authorId] || null;
        });

        let totalPostsQuery = {
            threadId: thread.id,
            isDeleted: false 
        };
        
        if (!isAdmin) {
            totalPostsQuery.isActive = true;
        }
        
        const totalPosts = await ForumPost.count({ where: totalPostsQuery });

        res.render('pages/forum/thread', {
            thread,
            posts: rootPosts,
            totalPosts,
            user: req.session.user || null,
            pageTitle: thread.title
        });
    } catch (error) {
        logger.error('Erro ao buscar thread:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Show create thread form
// @route   GET /forum/:categorySlug/new
// @access  Private
exports.showCreateThreadForm = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.redirect(`/auth/login?redirect=/forum/${req.params.categorySlug}/new`);
        }

        const category = await ForumCategory.findOne({ where: { slug: req.params.categorySlug } });
        
        if (!category) {
            return res.status(404).send('Categoria não encontrada');
        }
        
        res.render('pages/forum/create-thread', {
            category,
            user: req.session.user,
            pageTitle: 'Nova Thread'
        });
    } catch (error) {
        logger.error('Erro ao exibir formulário de thread:', error);
        res.status(500).send(`Erro interno do servidor: ${error.message}`);
    }
};

// @desc    Create new thread
// @route   POST /forum/:categorySlug/new
// @access  Private
exports.createThread = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.session.user) {
            await t.rollback();
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }
        
        const userId = req.session.user.id;
        
        if (!userId) {
            await t.rollback();
            return res.status(401).json({ success: false, message: 'ID de usuário não encontrado na sessão' });
        }

        const { title, content, tags, type } = req.body;
        
        const category = await ForumCategory.findOne({ where: { slug: req.params.categorySlug }, transaction: t });

        if (!category) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Categoria não encontrada' });
        }

        if (!title || !content) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Título e conteúdo são obrigatórios' });
        }

        const slug = title.toLowerCase().replace(/[^ -~ -ÿ]/g, '').replace(/[^a-z0-9_ -]/g, '').replace(/ +/g, '-').substring(0, 100) + '-' + Date.now();
        const tagsArray = tags ? tags.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag) : [];
        const images = req.files?.map(file => ({ url: `/uploads/forum/${file.filename}`, filename: file.filename })) || [];

        const thread = await ForumThread.create({
            title,
            type: type || 'discussao',
            slug,
            content,
            categoryId: category.id,
            authorId: userId,
            tags: tagsArray,
            images: images,
            lastActivityById: userId,
            isActive: true
        }, { transaction: t });

        let [reputation, created] = await UserReputation.findOrCreate({ where: { userId: userId }, defaults: { userId: userId }, transaction: t });
        reputation.stats.threadsCreated = (reputation.stats.threadsCreated || 0) + 1;
        await reputation.addPoints(10, 'Criou uma nova thread', thread.id, null, { transaction: t });
        await reputation.checkAndAwardBadges({ transaction: t });

        const user = await User.findByPk(userId, { transaction: t });
        if (user && user.faction) {
            const pointsAwarded = await factionSystem.addFactionPoints(user, 10, 'Criou uma thread', { transaction: t });
            logger.info(`💰 Usuário ${user.username} ganhou ${pointsAwarded} pontos de facção (thread criada)`);
        }

        await achievementService.checkAchievements(userId, 'threads', { transaction: t });
        await UserDailyProgress.incrementProgress(userId, 'create_thread', { transaction: t });

        await t.commit();

        res.json({
            success: true, 
            threadUrl: `/forum/${category.slug}/${thread.slug}` 
        });
    } catch (error) {
        await t.rollback();
        logger.error('Erro ao criar thread:', error);
        res.status(500).json({ success: false, message: `Erro ao criar thread: ${error.message}` });
    }
};

// ============================================================================ 
// POSTS/RESPOSTAS
// ============================================================================ 

// @desc    Create post/reply
// @route   POST /forum/:categorySlug/:threadSlug/reply
// @access  Private
exports.createPost = async (req, res) => {
    const t = await sequelize.transaction();
    try {
        if (!req.session.user) {
            await t.rollback();
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const userId = req.session.user.id;
        const { content, parentPostId, quotedPostId } = req.body;
        
        const thread = await ForumThread.findOne({
            where: { slug: req.params.threadSlug, isDeleted: false },
            transaction: t
        });

        if (!thread) {
            await t.rollback();
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }
        
        if (thread.isLocked) {
            await t.rollback();
            return res.status(403).json({ success: false, message: 'Thread bloqueada' });
        }

        if (!content) {
            await t.rollback();
            return res.status(400).json({ success: false, message: 'Conteúdo é obrigatório' });
        }

        let depth = 0;
        let path = '';
        
        if (parentPostId) {
            const parentPost = await ForumPost.findByPk(parentPostId, { transaction: t });
            if (parentPost) {
                depth = parentPost.depth + 1;
                path = parentPost.path ? `${parentPost.path}/${parentPost.id}` : `${parentPost.id}`;
            }
        }

        const images = req.files?.map(file => ({ url: `/uploads/forum/${file.filename}`, filename: file.filename })) || [];

        const postData = {
            threadId: thread.id,
            authorId: userId,
            content,
            parentPostId: parentPostId || null,
            depth,
            path,
            images: images,
            isActive: true
        };

        if (quotedPostId) {
            const quotedPost = await ForumPost.findByPk(quotedPostId, { transaction: t });
            if (quotedPost) {
                postData.quotedPostId = quotedPost.id;
                postData.quotedContent = quotedPost.content.substring(0, 200);
            }
        }

        const mentionRegex = /@(\w+)/g;
        const matches = [...content.matchAll(mentionRegex)];
        if (matches.length > 0) {
            const usernames = matches.map(m => m[1]);
            const mentionedUsers = await User.findAll({
                where: { username: { [Op.in]: usernames } },
                attributes: ['id'],
                transaction: t
            });
            postData.mentions = mentionedUsers.map(u => u.id);
        }

        const post = await ForumPost.create(postData, { transaction: t });

        await thread.update({ lastActivity: new Date(), lastActivityById: userId }, { transaction: t });

        let [reputation, created] = await UserReputation.findOrCreate({ where: { userId: userId }, defaults: { userId: userId }, transaction: t });
        reputation.stats.postsCreated = (reputation.stats.postsCreated || 0) + 1;
        await reputation.addPoints(5, 'Criou um post', thread.id, post.id, { transaction: t });

        const user = await User.findByPk(userId, { transaction: t });
        if (user && user.faction) {
            const pointsAwarded = await factionSystem.addFactionPoints(user, 5, 'Criou um post', { transaction: t });
        }
        await reputation.checkAndAwardBadges({ transaction: t });

        await achievementService.checkAchievements(userId, 'posts', { transaction: t });
        await UserDailyProgress.incrementProgress(userId, 'create_post', { transaction: t });

        const threadWithCategory = await ForumThread.findByPk(thread.id, {
            include: [{ model: ForumCategory, as: 'category', attributes: ['slug'] }, { model: User, as: 'author' }],
            transaction: t
        });
        const postAuthor = await User.findByPk(userId, { transaction: t });

        await notificationService.notifyThreadReply(threadWithCategory, post, postAuthor);
        await notificationService.notifyMention(content, threadWithCategory, post, postAuthor);

        if (quotedPostId) {
            const quotedPost = await ForumPost.findByPk(quotedPostId, { include: [{ model: User, as: 'author' }], transaction: t });
            if (quotedPost) {
                await notificationService.notifyQuote(quotedPost, post, postAuthor);
            }
        }

        await t.commit();
        res.json({ success: true });
    } catch (error) {
        await t.rollback();
        logger.error('Erro ao criar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar post' });
    }
};

// ============================================================================ 
// BUSCA
// ============================================================================ 

// @desc    Search forum
// @route   GET /forum/search
// @access  Public
exports.searchForum = async (req, res) => {
    try {
        const { q, category, author, sort = 'relevance' } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        // Buscar todas as categorias para o filtro
        const categories = await ForumCategory.findAll({ order: [['name', 'ASC']] });

        if (!q) {
            return res.render('pages/forum/search', {
                results: [],
                query: '',
                categories,
                categoryFilter: category || '',
                authorFilter: author || '',
                sortFilter: sort,
                typeFilter: 'all',
                user: req.session.user || null,
                pageTitle: 'Buscar no Fórum'
            });
        }

        // Verificar se é admin
        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let whereClause = {
            isDeleted: false
        };
        
        if (!isAdmin) {
            whereClause.isActive = true;
        }

        if (category) {
            const cat = await ForumCategory.findOne({ where: { slug: category } });
            if (cat) {
                whereClause.categoryId = cat.id;
            }
        }

        if (author) {
            const authorUser = await User.findOne({ where: { username: author } });
            if (authorUser) {
                whereClause.authorId = authorUser.id;
            }
        }
        
        const fullTextSearch = literal("to_tsvector('portuguese', title || ' ' || content) @@ to_tsquery('portuguese', :query)");


        let orderOption = [];
        if (sort === 'date') {
            orderOption = [['createdAt', 'DESC']];
        } else {
            whereClause[Op.and] = [fullTextSearch];
            orderOption = [[literal('ts_rank(to_tsvector(title || \' \' || content), to_tsquery(:query))'), 'DESC']];
        }

        const { count, rows: threads } = await ForumThread.findAndCountAll({
            where: whereClause,
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar'] },
                { model: ForumCategory, as: 'category', attributes: ['name', 'slug'] }
            ],
            order: orderOption,
            limit: limit,
            offset: skip,
            replacements: { query: q.split(' ').join(' & ') }
        });

        const totalPages = Math.ceil(count / limit);

        res.render('pages/forum/search', {
            results: threads,
            query: q,
            categories,
            categoryFilter: category || '',
            authorFilter: author || '',
            sortFilter: sort,
            typeFilter: 'all', // Por enquanto só threads, mas preparado para posts também
            currentPage: page,
            totalPages,
            totalResults: count,
            user: req.session.user || null,
            pageTitle: `Buscar: ${q}`
        });
    } catch (error) {
        logger.error('Erro ao buscar no fórum:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// ============================================================================ 
// MODERAÇÃO
// ============================================================================ 

// @desc    Pin/Unpin thread
// @route   POST /forum/moderation/thread/:threadId/pin
// @access  Moderator/Admin
exports.pinThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const thread = await ForumThread.findByPk(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        await thread.update({ isPinned: !thread.isPinned });

        const userId = req.session.user.id;
        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const threadAuthor = await User.findByPk(thread.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: thread.isPinned ? 'thread_pinned' : 'thread_unpinned',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true, 
            message: thread.isPinned ? 'Thread fixada com sucesso' : 'Thread desafixada com sucesso',
            isPinned: thread.isPinned
        });
    } catch (error) {
        logger.error('Erro ao fixar thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao fixar thread' });
    }
};

// @desc    Lock/Unlock thread
// @route   POST /forum/moderation/thread/:threadId/lock
// @access  Moderator/Admin
exports.lockThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const thread = await ForumThread.findByPk(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        await thread.update({ isLocked: !thread.isLocked });

        const userId = req.session.user.id;
        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const threadAuthor = await User.findByPk(thread.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: thread.isLocked ? 'thread_locked' : 'thread_unlocked',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true, 
            message: thread.isLocked ? 'Thread bloqueada com sucesso' : 'Thread desbloqueada com sucesso',
            isLocked: thread.isLocked
        });
    } catch (error) {
        logger.error('Erro ao bloquear thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao bloquear thread' });
    }
};

// @desc    Delete thread (soft delete)
// @route   DELETE /forum/moderation/thread/:threadId
// @access  Moderator/Admin
exports.deleteThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const userId = req.session.user.id;
        
        const thread = await ForumThread.findByPk(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        await thread.update({
            isDeleted: true,
            deletedAt: new Date(),
            deletedById: userId
        });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const threadAuthor = await User.findByPk(thread.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'thread_deleted',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Thread deletada com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar thread' });
    }
};

// @desc    Delete post (soft delete)
// @route   DELETE /forum/moderation/post/:postId
// @access  Moderator/Admin or Author
exports.deletePost = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.session.user.id;
        
        const post = await ForumPost.findByPk(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        if (req.session.user.role !== 'moderator' && req.session.user.role !== 'admin') {
            if (post.authorId !== userId) {
                return res.status(403).json({ success: false, message: 'Você não pode deletar este post' });
            }
        }

        await post.update({
            isDeleted: true,
            deletedAt: new Date(),
            deletedById: userId
        });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const postAuthor = await User.findByPk(post.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'post_deleted',
            targetType: 'post',
            targetId: post.id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: post.authorId,
            targetUsername: postAuthor ? postAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Post deletado com sucesso' });
    } catch (error) {
        logger.error('Erro ao deletar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao deletar post' });
    }
};

// @desc    Edit post
// @route   PUT /forum/moderation/post/:postId
// @access  Moderator/Admin or Author
exports.editPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { content } = req.body;
        const userId = req.session.user.id;
        
        if (!content || content.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Conteúdo deve ter no mínimo 10 caracteres' });
        }

        const post = await ForumPost.findByPk(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        if (req.session.user.role !== 'moderator' && req.session.user.role !== 'admin') {
            if (post.authorId !== userId) {
                return res.status(403).json({ success: false, message: 'Você não pode editar este post' });
            }
        }

        const editHistory = post.editHistory || [];
        editHistory.push({
            editedBy: userId,
            editedAt: new Date(),
            previousContent: post.content
        });

        await post.update({
            content: content,
            isEdited: true,
            editedAt: new Date(),
            editHistory: editHistory
        });

        res.json({ success: true, message: 'Post editado com sucesso', content: post.content });
    } catch (error) {
        logger.error('Erro ao editar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao editar post' });
    }
};

// @desc    Flag thread
// @route   POST /forum/moderation/thread/:threadId/flag
// @access  Private
exports.flagThread = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user.id;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Motivo deve ter no mínimo 5 caracteres' });
        }

        const thread = await ForumThread.findByPk(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const moderationFlags = thread.moderationFlags || [];
        const alreadyFlagged = moderationFlags.some(flag => flag.user === userId);

        if (alreadyFlagged) {
            return res.status(400).json({ success: false, message: 'Você já denunciou esta thread' });
        }

        moderationFlags.push({
            user: userId,
            reason: reason,
            createdAt: new Date()
        });

        await thread.update({ moderationFlags: moderationFlags });

        const reporter = await User.findByPk(userId, { attributes: ['username'] });
        const threadAuthor = await User.findByPk(thread.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'thread_flagged',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            reporterId: userId,
            reporterUsername: reporter ? reporter.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            reportReason: reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Thread denunciada com sucesso' });
    } catch (error) {
        logger.error('Erro ao denunciar thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao denunciar thread' });
    }
};

// @desc    Flag post
// @route   POST /forum/moderation/post/:postId/flag
// @access  Private
exports.flagPost = async (req, res) => {
    try {
        const { postId } = req.params;
        const { reason } = req.body;
        const userId = req.session.user.id;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Motivo deve ter no mínimo 5 caracteres' });
        }

        const post = await ForumPost.findByPk(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const moderationFlags = post.moderationFlags || [];
        const alreadyFlagged = moderationFlags.some(flag => flag.user === userId);

        if (alreadyFlagged) {
            return res.status(400).json({ success: false, message: 'Você já denunciou este post' });
        }

        moderationFlags.push({
            user: userId,
            reason: reason,
            createdAt: new Date()
        });

        await post.update({ moderationFlags: moderationFlags });

        const reporter = await User.findByPk(userId, { attributes: ['username'] });
        const postAuthor = await User.findByPk(post.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'post_flagged',
            targetType: 'post',
            targetId: post.id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            reporterId: userId,
            reporterUsername: reporter ? reporter.username : 'Desconhecido',
            targetUserId: post.authorId,
            targetUsername: postAuthor ? postAuthor.username : 'Desconhecido',
            reportReason: reason,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Post denunciado com sucesso' });
    } catch (error) {
        logger.error('Erro ao denunciar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao denunciar post' });
    }
};

// @desc    Get moderation dashboard
// @route   GET /forum/moderation
// @access  Moderator/Admin
exports.getModerationDashboard = async (req, res) => {
    try {
        const flaggedThreads = await ForumThread.findAll({
            where: {
                moderationFlags: { [Op.ne]: null },
                isDeleted: false
            },
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar'] },
                { model: ForumCategory, as: 'category', attributes: ['name', 'slug'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        const flaggedPosts = await ForumPost.findAll({
            where: {
                moderationFlags: { [Op.ne]: null },
                isDeleted: false
            },
            include: [
                { model: User, as: 'author', attributes: ['username', 'avatar', 'role'] },
                { model: ForumThread, as: 'thread', attributes: ['title', 'slug'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: 50
        });

        const stats = {
            totalFlags: flaggedThreads.length + flaggedPosts.length,
            flaggedThreadsCount: flaggedThreads.length,
            flaggedPostsCount: flaggedPosts.length,
            deletedThreadsToday: await ForumThread.count({
                where: {
                    isDeleted: true,
                    deletedAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            }),
            deletedPostsToday: await ForumPost.count({
                where: {
                    isDeleted: true,
                    deletedAt: { [Op.gte]: new Date(new Date().setHours(0, 0, 0, 0)) }
                }
            })
        };

        res.render('pages/forum/moderation-dashboard', {
            flaggedThreads,
            flaggedPosts,
            stats,
            user: req.session.user,
            pageTitle: 'Painel de Moderação'
        });
    } catch (error) {
        logger.error('Erro ao carregar dashboard de moderação:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Dismiss flags from thread
// @route   POST /forum/moderation/thread/:threadId/dismiss-flags
// @access  Moderator/Admin
exports.dismissThreadFlags = async (req, res) => {
    try {
        const { threadId } = req.params;
        const userId = req.session.user.id;
        
        const thread = await ForumThread.findByPk(threadId, { include: [{ model: User, as: 'author', attributes: ['username'] }] });

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const archivedFlags = thread.moderationFlags || [];
        await thread.update({ moderationFlags: [] });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'thread_flags_dismissed',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: thread.author ? thread.author.username : 'Desconhecido',
            archivedFlags: archivedFlags,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Denúncias da thread descartadas com sucesso' });
    } catch (error) {
        logger.error('Erro ao descartar denúncias da thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao descartar denúncias' });
    }
};

// @desc    Dismiss flags from post
// @route   POST /forum/moderation/post/:postId/dismiss-flags
// @access  Moderator/Admin
exports.dismissPostFlags = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.session.user.id;
        
        const post = await ForumPost.findByPk(postId, { include: [{ model: User, as: 'author', attributes: ['username'] }] });

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const archivedFlags = post.moderationFlags || [];
        await post.update({ moderationFlags: [] });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: 'post_flags_dismissed',
            targetType: 'post',
            targetId: post.id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: post.authorId,
            targetUsername: post.author ? post.author.username : 'Desconhecido',
            archivedFlags: archivedFlags,
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ success: true, message: 'Denúncias do post descartadas com sucesso' });
    } catch (error) {
        logger.error('Erro ao descartar denúncias do post:', error);
        res.status(500).json({ success: false, message: 'Erro ao descartar denúncias' });
    }
};

// @desc    Toggle thread active status (hide/show)
// @route   POST /forum/moderation/thread/:threadId/toggle-active
// @access  Admin
exports.toggleThreadActive = async (req, res) => {
    try {
        const { threadId } = req.params;
        const userId = req.session.user.id;
        
        const thread = await ForumThread.findByPk(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const isActive = !thread.isActive;
        await thread.update({
            isActive: isActive,
            inactivatedAt: isActive ? null : new Date(),
            inactivatedById: isActive ? null : userId
        });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const threadAuthor = await User.findByPk(thread.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: isActive ? 'thread_activated' : 'thread_inactivated',
            targetType: 'thread',
            targetId: thread.id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: thread.authorId,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true, 
            message: isActive ? 'Thread ativada com sucesso' : 'Thread inativada com sucesso',
            isActive: isActive
        });
    } catch (error) {
        logger.error('Erro ao inativar/ativar thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao inativar/ativar thread' });
    }
};

// @desc    Toggle post active status (hide/show)
// @route   POST /forum/moderation/post/:postId/toggle-active
// @access  Admin
exports.togglePostActive = async (req, res) => {
    try {
        const { postId } = req.params;
        const userId = req.session.user.id;
        
        const post = await ForumPost.findByPk(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const isActive = !post.isActive;
        await post.update({
            isActive: isActive,
            inactivatedAt: isActive ? null : new Date(),
            inactivatedById: isActive ? null : userId
        });

        const moderator = await User.findByPk(userId, { attributes: ['username'] });
        const postAuthor = await User.findByPk(post.authorId, { attributes: ['username'] });
        await ModerationLog.create({
            actionType: isActive ? 'post_activated' : 'post_inactivated',
            targetType: 'post',
            targetId: post.id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderatorId: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUserId: post.authorId,
            targetUsername: postAuthor ? postAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({
            success: true, 
            message: isActive ? 'Post ativado com sucesso' : 'Post inativado com sucesso',
            isActive: isActive
        });
    } catch (error) {
        logger.error('Erro ao inativar/ativar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao inativar/ativar post' });
    }
};

// @desc    Get moderation history
// @route   GET /forum/moderation/history
// @access  Moderator/Admin
exports.getModerationHistory = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = 50;
        const skip = (page - 1) * limit;

        const filter = {};
        if (req.query.action) filter.actionType = req.query.action;
        if (req.query.moderator) filter.moderatorId = req.query.moderator;
        if (req.query.targetUser) filter.targetUserId = req.query.targetUser;

        const { count, rows: logs } = await ModerationLog.findAndCountAll({
            where: filter,
            include: [
                { model: User, as: 'moderator', attributes: ['username', 'avatar'] },
                { model: User, as: 'targetUser', attributes: ['username', 'avatar'] },
                { model: User, as: 'reporter', attributes: ['username'] }
            ],
            order: [['createdAt', 'DESC']],
            limit: limit,
            offset: skip
        });

        const totalPages = Math.ceil(count / limit);

        res.render('pages/forum/moderation-history', {
            logs,
            currentPage: page,
            totalPages,
            totalLogs: count,
            filters: {
                action: req.query.action || '',
                moderator: req.query.moderator || '',
                targetUser: req.query.targetUser || ''
            },
            user: req.session.user,
            pageTitle: 'Histórico de Moderação'
        });
    } catch (error) {
        logger.error('Erro ao carregar histórico de moderação:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// ============================================================================ 
// LEADERBOARD DE FACÇÕES
// ============================================================================ 

// @desc    Show faction leaderboard
// @route   GET /forum/leaderboard
// @access  Public
exports.getLeaderboard = async (req, res) => {
    try {
        const limit = 20;

        const topPirates = await User.findAll({
            where: {
                faction: 'pirate',
                factionPoints: { [Op.gt]: 0 }
            },
            attributes: ['username', 'avatar', 'faction', 'factionPoints', 'factionRank'],
            order: [['factionPoints', 'DESC']],
            limit: limit
        });

        const topMarines = await User.findAll({
            where: {
                faction: 'marine',
                factionPoints: { [Op.gt]: 0 }
            },
            attributes: ['username', 'avatar', 'faction', 'factionPoints', 'factionRank'],
            order: [['factionPoints', 'DESC']],
            limit: limit
        });

        topPirates.forEach(user => {
            user.rankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints);
            user.bounty = user.factionPoints * 10000;
        });

        topMarines.forEach(user => {
            user.rankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints);
            user.bounty = user.factionPoints * 10000;
        });

        const totalPiratePoints = topPirates.reduce((sum, u) => sum + u.factionPoints, 0);
        const totalMarinePoints = topMarines.reduce((sum, u) => sum + u.factionPoints, 0);

        const stats = {
            pirates: {
                total: topPirates.length,
                totalBounty: totalPiratePoints * 10000,
                avgBounty: topPirates.length > 0 ? Math.floor((totalPiratePoints * 10000) / topPirates.length) : 0
            },
            marines: {
                total: topMarines.length,
                totalBounty: totalMarinePoints * 10000,
                avgBounty: topMarines.length > 0 ? Math.floor((totalMarinePoints * 10000) / topMarines.length) : 0
            }
        };

        res.render('pages/forum/leaderboard', {
            topPirates,
            topMarines,
            stats,
            user: req.session.user || null,
            pageTitle: 'Ranking de Facções'
        });
    } catch (error) {
        logger.error('Erro ao carregar leaderboard:', error);
        res.status(500).send('Erro interno do servidor');
    }
};

// @desc    Vote on post
// @route   POST /forum/post/:postId/vote
// @access  Private
exports.votePost = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Nao autorizado' });
        }

        const { postId } = req.params;
        const { voteType } = req.body;

        if (!['upvote', 'downvote', 'remove'].includes(voteType)) {
            return res.status(400).json({ success: false, message: 'Tipo de voto invalido' });
        }

        const post = await ForumPost.findByPk(postId);
        if (!post) {
            return res.status(404).json({ success: false, message: 'Post nao encontrado' });
        }

        const userId = req.session.user.id;
        const userIdStr = userId.toString();
        const removeUser = (arr) => (arr || []).filter(id => id != null && id.toString() !== userIdStr);

        let upvotes = Array.isArray(post.upvotes) ? post.upvotes.slice() : [];
        let downvotes = Array.isArray(post.downvotes) ? post.downvotes.slice() : [];

        if (voteType === 'remove') {
            upvotes = removeUser(upvotes);
            downvotes = removeUser(downvotes);
        } else if (voteType === 'upvote') {
            downvotes = removeUser(downvotes);
            if (!upvotes.some(id => id != null && id.toString() === userIdStr)) {
                upvotes.push(userId);
            }
        } else {
            upvotes = removeUser(upvotes);
            if (!downvotes.some(id => id != null && id.toString() === userIdStr)) {
                downvotes.push(userId);
            }
        }

        const score = upvotes.length - downvotes.length;
        await post.update({ upvotes, downvotes, score });

        return res.json({
            success: true,
            score,
            upvotes: upvotes.length,
            downvotes: downvotes.length
        });
    } catch (error) {
        logger.error('Erro ao votar no post:', error);
        res.status(500).json({ success: false, message: 'Erro ao votar' });
    }
};

// @desc    React to thread
// @route   POST /forum/thread/:threadId/react
// @access  Private
exports.reactToThread = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Nao autorizado' });
        }

        const { threadId } = req.params;
        const { reactionType } = req.body;
        const allowedReactions = ['like', 'love', 'wow', 'haha', 'sad', 'angry'];

        if (!allowedReactions.includes(reactionType)) {
            return res.status(400).json({ success: false, message: 'Reacao invalida' });
        }

        const thread = await ForumThread.findByPk(threadId);
        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread nao encontrada' });
        }

        const userId = req.session.user.id;
        const userIdStr = userId.toString();
        const reactions = Array.isArray(thread.reactions) ? thread.reactions.slice() : [];

        const existingIndex = reactions.findIndex(r => r && r.user != null && r.user.toString() === userIdStr);
        let action = 'added';

        if (existingIndex >= 0 && reactions[existingIndex].type === reactionType) {
            reactions.splice(existingIndex, 1);
            action = 'removed';
        } else {
            if (existingIndex >= 0) {
                reactions.splice(existingIndex, 1);
            }
            reactions.push({ user: userId, type: reactionType, createdAt: new Date() });
        }

        await thread.update({ reactions });

        return res.json({ success: true, action, reactionsCount: reactions.length });
    } catch (error) {
        logger.error('Erro ao reagir na thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao reagir' });
    }
};
