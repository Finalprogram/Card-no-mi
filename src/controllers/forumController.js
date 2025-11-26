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

        const user = await User.findById(req.session.user._id || req.session.user.id);
        
        // Se já tem facção, redirecionar para o fórum
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

        const userId = req.session.user._id || req.session.user.id;
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ success: false, message: 'Usuário não encontrado' });
        }

        // Se já tem facção, não permitir mudança
        if (user.faction) {
            return res.status(400).json({ success: false, message: 'Você já escolheu uma facção' });
        }

        // Definir facção
        user.faction = faction;
        user.factionRank = 0;
        user.factionPoints = 0;
        user.factionJoinedAt = new Date();
        user.factionChangedAt = new Date();
        
        await user.save();

        // Atualizar sessão
        req.session.user.faction = faction;
        req.session.user.factionRank = 0;

        logger.info(`Usuário ${user.username} escolheu a facção: ${faction}`);

        // Obter nome do rank inicial
        const factionSystem = require('../config/factionSystem');
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
        // Verificar se o usuário está logado e não tem facção escolhida
        if (req.session.user) {
            const user = await User.findById(req.session.user._id || req.session.user.id);
            if (user && !user.faction) {
                return res.redirect('/forum/faction/choose');
            }
        }
        
        // Buscar apenas categorias principais (sem parent ou com parent null/undefined)
        const categories = await ForumCategory.find({ 
            isActive: true,
            $or: [
                { parentCategory: null },
                { parentCategory: { $exists: false } }
            ]
        })
            .sort({ order: 1 })
            .lean();

        // Buscar estatísticas e subcategorias para cada categoria
        for (const category of categories) {
            // Buscar subcategorias/subfóruns desta categoria
            const subforums = await ForumCategory.find({
                parentCategory: category._id,
                isActive: true,
                isSubforum: true
            })
                .sort({ order: 1 })
                .lean();
            
            category.subforums = subforums;
            
            // Buscar estatísticas para cada subcategoria
            for (const subforum of subforums) {
                subforum.threadCount = await ForumThread.countDocuments({ 
                    category: subforum._id,
                    isDeleted: false 
                });
                
                // Última atividade do subfórum
                subforum.lastThread = await ForumThread.findOne({ 
                    category: subforum._id,
                    isDeleted: false 
                })
                    .sort({ lastActivity: -1 })
                    .select('title slug lastActivity')
                    .lean();
            }
            
            const threadCount = await ForumThread.countDocuments({ 
                category: category._id,
                isDeleted: false 
            });
            
            // Contagem de posts - usuários normais veem apenas ativos
            let postCountQuery = {
                thread: { 
                    $in: await ForumThread.find({ 
                        category: category._id,
                        isDeleted: false 
                    }).select('_id')
                },
                isDeleted: false
            };
            
            // Verificar se é admin
            const isAdminIndex = req.session.user && req.session.user.role === 'admin';
            if (!isAdminIndex) {
                postCountQuery.isActive = true;
            }
            
            const postCount = await ForumPost.countDocuments(postCountQuery);

            const lastThread = await ForumThread.findOne({ 
                category: category._id,
                isDeleted: false 
            })
                .sort({ lastActivity: -1 })
                .populate('author', 'username avatar role faction factionPoints')
                .populate('lastActivityBy', 'username')
                .lean();

            category.threadCount = threadCount;
            category.postCount = postCount;
            category.lastThread = lastThread;
        }

        res.render('pages/forum/index', {
            categories,
            user: req.session.user || null,
            pageTitle: 'Fórum Card no Mi'
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

        const category = await ForumCategory.findOne({ slug: categorySlug });
        if (!category) {
            return res.status(404).send('Categoria não encontrada');
        }

        // Buscar subfóruns desta categoria
        const subforums = await ForumCategory.find({
            parentCategory: category._id,
            isActive: true,
            isSubforum: true
        })
            .sort({ order: 1 })
            .lean();
        
        // Buscar estatísticas para cada subfórum
        for (const subforum of subforums) {
            subforum.threadCount = await ForumThread.countDocuments({ 
                category: subforum._id,
                isDeleted: false 
            });
            
            subforum.postCount = await ForumPost.countDocuments({ 
                thread: { 
                    $in: await ForumThread.find({ 
                        category: subforum._id,
                        isDeleted: false 
                    }).select('_id')
                },
                isDeleted: false 
            });
        }

        // Verificar se é admin
        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let query = { 
            category: category._id,
            isDeleted: false 
        };
        
        // Usuários normais só veem threads ativas
        if (!isAdmin) {
            query.isActive = true;
        }

        if (filterTag) {
            query.tags = filterTag;
        }

        // Buscar threads fixadas separadamente (sempre no topo)
        const pinnedThreads = await ForumThread.find({
            ...query,
            isPinned: true
        })
            .populate('author', 'username avatar role')
            .populate('lastActivityBy', 'username')
            .sort({ lastActivity: -1 })
            .lean();

        // Buscar threads não-fixadas com paginação
        const unpinnedQuery = { ...query, isPinned: { $ne: true } };
        
        // Definir ordenação para threads não-fixadas
        let sortOption = {};
        switch (sortBy) {
            case 'latest':
                sortOption = { createdAt: -1 };
                break;
            case 'popular':
                sortOption = { viewCount: -1 };
                break;
            case 'replies':
                // Será ordenado depois do populate
                break;
            case 'activity':
            default:
                sortOption = { lastActivity: -1 };
        }

        const unpinnedThreads = await ForumThread.find(unpinnedQuery)
            .populate('author', 'username avatar role')
            .populate('lastActivityBy', 'username')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        // Combinar: fixadas primeiro, depois as outras
        const threads = [...pinnedThreads, ...unpinnedThreads];

        // Buscar contagem de posts para cada thread
        for (const thread of threads) {
            let postCountQuery = { 
                thread: thread._id,
                isDeleted: false 
            };
            
            // Usuários normais só veem posts ativos
            if (!isAdmin) {
                postCountQuery.isActive = true;
            }
            
            thread.postCount = await ForumPost.countDocuments(postCountQuery);
        }

        // Contar apenas threads não-fixadas para paginação
        const totalThreads = await ForumThread.countDocuments(unpinnedQuery);
        const totalPages = Math.ceil(totalThreads / limit);

        // Buscar todas as tags da categoria
        const allThreadsInCategory = await ForumThread.find({ 
            category: category._id,
            isDeleted: false 
        }).select('tags');
        
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

        // Verificar se é admin
        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let threadQuery = { slug: threadSlug, isDeleted: false };
        
        // Usuários normais só veem threads ativas
        if (!isAdmin) {
            threadQuery.isActive = true;
        }

        const thread = await ForumThread.findOne(threadQuery)
            .populate('author', 'username avatar createdAt role')
            .populate('category')
            .lean();

        if (!thread) {
            return res.status(404).send('Thread não encontrada');
        }

        // Incrementar visualizações (não await para não bloquear)
        ForumThread.findByIdAndUpdate(thread._id, { $inc: { viewCount: 1 } }).exec();

        // Buscar todos os posts (sem paginação para estrutura hierárquica)
        let postQuery = { 
            thread: thread._id,
            isDeleted: false 
        };
        
        // Usuários normais só veem posts ativos
        if (!isAdmin) {
            postQuery.isActive = true;
        }
        
        const posts = await ForumPost.find(postQuery)
            .populate('author', 'username avatar createdAt role')
            .populate('parentPost')
            .populate('quotedPost')
            .sort({ path: 1, createdAt: 1 })
            .lean();
        
        // Construir árvore de comentários estilo Reddit
        const postsMap = {};
        const rootPosts = [];
        
        posts.forEach(post => {
            post.replies = [];
            postsMap[post._id.toString()] = post;
        });
        
        posts.forEach(post => {
            if (post.parentPost) {
                const parent = postsMap[post.parentPost._id ? post.parentPost._id.toString() : post.parentPost.toString()];
                if (parent) {
                    parent.replies.push(post);
                }
            } else {
                rootPosts.push(post);
            }
        });

        // Buscar reputação dos autores
        const authorIds = [thread.author._id, ...posts.map(p => p.author._id)];
        const reputations = await UserReputation.find({ 
            user: { $in: authorIds } 
        }).lean();

        const reputationMap = {};
        reputations.forEach(rep => {
            reputationMap[rep.user.toString()] = rep;
        });

        // Adicionar reputação aos autores
        thread.author.reputation = reputationMap[thread.author._id.toString()] || null;
        posts.forEach(post => {
            post.author.reputation = reputationMap[post.author._id.toString()] || null;
        });

        let totalPostsQuery = { 
            thread: thread._id,
            isDeleted: false 
        };
        
        // Usuários normais só veem posts ativos
        if (!isAdmin) {
            totalPostsQuery.isActive = true;
        }
        
        const totalPosts = await ForumPost.countDocuments(totalPostsQuery);

        res.render('pages/forum/thread', {
            thread,
            posts: rootPosts, // Apenas posts raiz, replies estão aninhados
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
        logger.info(`Acessando formulário de criar thread para categoria: ${req.params.categorySlug}`);
        
        if (!req.session.user) {
            logger.info('Usuário não autenticado, redirecionando para login');
            return res.redirect(`/auth/login?redirect=/forum/${req.params.categorySlug}/new`);
        }

        const category = await ForumCategory.findOne({ slug: req.params.categorySlug });
        
        if (!category) {
            logger.error(`Categoria não encontrada: ${req.params.categorySlug}`);
            return res.status(404).send('Categoria não encontrada');
        }
        
        logger.info(`Renderizando formulário para categoria: ${category.name}`);
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
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }
        
        // Obter o ID do usuário (pode ser _id ou id dependendo de como foi salvo na sessão)
        const userId = req.session.user._id || req.session.user.id;
        
        if (!userId) {
            return res.status(401).json({ success: false, message: 'ID de usuário não encontrado na sessão' });
        }

        const { title, content, tags, type } = req.body;
        
        const category = await ForumCategory.findOne({ slug: req.params.categorySlug });

        if (!category) {
            return res.status(404).json({ success: false, message: 'Categoria não encontrada' });
        }

        if (!title || !content) {
            return res.status(400).json({ success: false, message: 'Título e conteúdo são obrigatórios' });
        }

        // Criar slug
        const slug = title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .substring(0, 100) + '-' + Date.now();

        // Processar tags
        const tagsArray = tags ? tags.split(',').map(t => t.trim().toLowerCase()).filter(t => t) : [];

        // Processar imagens
        const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                images.push({
                    url: `/uploads/forum/${file.filename}`,
                    filename: file.filename
                });
            });
        }

        const thread = new ForumThread({
            title,
            type: type || 'discussao',
            slug,
            content,
            category: category._id,
            author: userId,
            tags: tagsArray,
            images: images,
            lastActivityBy: userId,
            isActive: true  // Garantir que novas threads sejam ativas
        });

        await thread.save();

        // Atualizar reputação
        let reputation = await UserReputation.findOne({ user: userId });
        if (!reputation) {
            reputation = new UserReputation({ user: userId });
        }
        reputation.stats.threadsCreated += 1;
        await reputation.addPoints(10, 'Criou uma nova thread', thread._id);
        await reputation.checkAndAwardBadges();

        // Adicionar pontos de facção (+10 por thread)
        const user = await User.findById(userId);
        if (user && user.faction) {
            const pointsAwarded = await factionSystem.addFactionPoints(user, 10, 'Criou uma thread');
            logger.info(`💰 Usuário ${user.username} ganhou ${pointsAwarded} pontos de facção (thread criada)`);
        }

        // Verificar conquistas e missões diárias
        await achievementService.checkAchievements(userId, 'threads');
        await UserDailyProgress.incrementProgress(userId, 'create_thread');

        res.json({ 
            success: true, 
            threadUrl: `/forum/${category.slug}/${thread.slug}` 
        });
    } catch (error) {
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
    try {
        console.log('📝 Iniciando criação de post...');
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const userId = req.session.user._id || req.session.user.id;
        const { content, parentPostId, quotedPostId } = req.body;
        console.log('📝 Dados recebidos:', { userId, content: content?.substring(0, 50), parentPostId, quotedPostId });
        
        const thread = await ForumThread.findOne({ 
            slug: req.params.threadSlug,
            isDeleted: false 
        });

        if (!thread) {
            console.log('❌ Thread não encontrada:', req.params.threadSlug);
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }
        
        console.log('✅ Thread encontrada:', thread._id);

        if (thread.isLocked) {
            return res.status(403).json({ success: false, message: 'Thread bloqueada' });
        }

        if (!content) {
            return res.status(400).json({ success: false, message: 'Conteúdo é obrigatório' });
        }

        // Calcular depth e path para estrutura hierárquica
        let depth = 0;
        let path = '';
        
        if (parentPostId) {
            const parentPost = await ForumPost.findById(parentPostId);
            if (parentPost) {
                depth = parentPost.depth + 1;
                path = parentPost.path ? `${parentPost.path}/${parentPost._id}` : `${parentPost._id}`;
            }
        }

        // Processar imagens
        const images = [];
        if (req.files && req.files.length > 0) {
            req.files.forEach(file => {
                images.push({
                    url: `/uploads/forum/${file.filename}`,
                    filename: file.filename
                });
            });
        }

        const post = new ForumPost({
            thread: thread._id,
            author: userId,
            content,
            parentPost: parentPostId || null,
            depth,
            path,
            images: images,
            isActive: true  // Garantir que novos posts sejam ativos
        });

        // Se está citando outro post
        if (quotedPostId) {
            const quotedPost = await ForumPost.findById(quotedPostId);
            if (quotedPost) {
                post.quotedPost = quotedPost._id;
                post.quotedContent = quotedPost.content.substring(0, 200);
            }
        }

        // Extrair menções
        const mentionRegex = /@(\w+)/g;
        const matches = [...content.matchAll(mentionRegex)];
        if (matches.length > 0) {
            const usernames = matches.map(m => m[1]);
            const mentionedUsers = await User.find({ 
                username: { $in: usernames } 
            }).select('_id');
            post.mentions = mentionedUsers.map(u => u._id);
        }

        console.log('💾 Salvando post...');
        await post.save();
        console.log('✅ Post salvo:', post._id);

        // Atualizar thread
        console.log('🔄 Atualizando thread...');
        await thread.updateLastActivity(userId);

        // Atualizar reputação
        console.log('⭐ Atualizando reputação...');
        let reputation = await UserReputation.findOne({ user: userId });
        if (!reputation) {
            reputation = new UserReputation({ user: userId });
        }
        reputation.stats.postsCreated += 1;
        await reputation.addPoints(5, 'Criou um post', thread._id, post._id);

        // Adicionar pontos de facção (+5 por post)
        console.log('💰 Adicionando pontos de facção...');
        const user = await User.findById(userId);
        if (user && user.faction) {
            const pointsAwarded = await factionSystem.addFactionPoints(user, 5, 'Criou um post');
            console.log(`✅ Pontos de facção adicionados: ${pointsAwarded.pointsAdded}`);
        }
        console.log('🏆 Verificando badges...');
        await reputation.checkAndAwardBadges();

        // Verificar conquistas e missões diárias
        console.log('🎯 Verificando conquistas...');
        await achievementService.checkAchievements(userId, 'posts');
        await UserDailyProgress.incrementProgress(userId, 'create_post');

        // Carregar dados necessários para notificações
        console.log('🔔 Preparando notificações...');
        const threadWithCategory = await ForumThread.findById(thread._id)
            .populate('category', 'slug')
            .populate('author');
        const postAuthor = await User.findById(userId);

        // Criar notificações
        // 1. Notificar autor da thread sobre nova resposta
        console.log('📧 Notificando autor da thread...');
        await notificationService.notifyThreadReply(threadWithCategory, post, postAuthor);

        // 2. Notificar usuários mencionados
        console.log('📧 Notificando menções...');
        await notificationService.notifyMention(content, threadWithCategory, post, postAuthor);

        // 3. Se citou alguém, notificar
        if (quotedPostId) {
            console.log('📧 Notificando citação...');
            const quotedPost = await ForumPost.findById(quotedPostId).populate('author');
            if (quotedPost) {
                await notificationService.notifyQuote(quotedPost, post, postAuthor);
            }
        }

        console.log('✅ Post criado com sucesso!');
        res.json({ success: true });
    } catch (error) {
        logger.error('Erro ao criar post:', error);
        res.status(500).json({ success: false, message: 'Erro ao criar post' });
    }
};

// @desc    Add reaction to thread
// @route   POST /forum/thread/:threadId/react
// @access  Private
exports.reactToThread = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const { reactionType } = req.body;
        const thread = await ForumThread.findById(req.params.threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const validReactions = ['like', 'love', 'wow', 'haha', 'sad', 'angry'];
        if (!validReactions.includes(reactionType)) {
            return res.status(400).json({ success: false, message: 'Reação inválida' });
        }

        const userId = req.session.user._id || req.session.user.id;
        
        // Verificar se já reagiu
        const existingReaction = thread.reactions.find(
            r => r.user.toString() === userId.toString()
        );

        if (existingReaction && existingReaction.type === reactionType) {
            // Remover reação
            await thread.removeReaction(userId);
        } else {
            // Adicionar/atualizar reação
            await thread.addReaction(userId, reactionType);
        }

        // Contar reações por tipo
        const reactionCounts = {};
        validReactions.forEach(type => {
            reactionCounts[type] = thread.reactions.filter(r => r.type === type).length;
        });

        res.json({ success: true, reactions: reactionCounts });
    } catch (error) {
        logger.error('Erro ao reagir à thread:', error);
        res.status(500).json({ success: false, message: 'Erro ao reagir' });
    }
};

// @desc    Vote on post (upvote/downvote estilo Reddit)
// @route   POST /forum/post/:postId/vote
// @access  Private
exports.votePost = async (req, res) => {
    try {
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const { voteType } = req.body; // 'upvote', 'downvote', ou 'remove'
        const post = await ForumPost.findById(req.params.postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        if (!['upvote', 'downvote', 'remove'].includes(voteType)) {
            return res.status(400).json({ success: false, message: 'Tipo de voto inválido' });
        }

        const userId = req.session.user._id || req.session.user.id;
        
        // Verificar se é um novo upvote (não uma remoção ou mudança)
        const hadUpvote = post.upvotes.some(id => id.toString() === userId.toString());
        const hadDownvote = post.downvotes.some(id => id.toString() === userId.toString());
        
        if (voteType === 'remove') {
            await post.removeVote(userId);
        } else {
            await post.addVote(userId, voteType);
        }

        // Adicionar pontos de facção ao autor do post quando recebe upvote (+2 pontos)
        if (voteType === 'upvote' && !hadUpvote && post.author.toString() !== userId.toString()) {
            const postAuthor = await User.findById(post.author);
            if (postAuthor && postAuthor.faction) {
                const pointsAwarded = await factionSystem.addFactionPoints(postAuthor, 2, 'Recebeu um upvote');
                logger.info(`💰 Usuário ${postAuthor.username} ganhou ${pointsAwarded} pontos de facção (upvote recebido)`);
            }
        }

        // Incrementar progresso da missão diária de upvotes
        if (voteType === 'upvote' && !hadUpvote) {
            await UserDailyProgress.incrementProgress(userId, 'upvote');
        }

        res.json({ 
            success: true, 
            score: post.score,
            upvotes: post.upvotes.length,
            downvotes: post.downvotes.length
        });
    } catch (error) {
        logger.error('Erro ao votar no post:', error);
        res.status(500).json({ success: false, message: 'Erro ao votar' });
    }
};

// ============================================================================
// PERFIL DO USUÁRIO NO FÓRUM
// ============================================================================

// @desc    Get user forum profile
// @route   GET /forum/user/:username
// @access  Public
exports.getUserProfile = async (req, res) => {
    try {
        const user = await User.findOne({ username: req.params.username });
        if (!user) {
            return res.status(404).send('Usuário não encontrado');
        }

        const reputation = await UserReputation.findOne({ user: user._id }) || {
            totalPoints: 0,
            level: 1,
            title: 'Novato',
            stats: {},
            badges: []
        };

        // Verificar se é admin
        const isAdmin = req.session.user && req.session.user.role === 'admin';

        let threadQuery = { 
            author: user._id,
            isDeleted: false 
        };
        
        let postQuery = { 
            author: user._id,
            isDeleted: false 
        };
        
        // Usuários normais só veem conteúdo ativo
        if (!isAdmin) {
            threadQuery.isActive = true;
            postQuery.isActive = true;
        }

        const recentThreads = await ForumThread.find(threadQuery)
            .populate('category', 'name slug')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const recentPosts = await ForumPost.find(postQuery)
            .populate({
                path: 'thread',
                select: 'title slug category',
                populate: {
                    path: 'category',
                    select: 'slug'
                }
            })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        // Calcular estatísticas
        const threadCount = await ForumThread.countDocuments({
            author: user._id,
            isDeleted: false
        });
        
        const postCount = await ForumPost.countDocuments({
            author: user._id,
            isDeleted: false
        });
        
        // Reputação
        const reputationScore = reputation.totalPoints || 0;
        const reputationLevel = reputation.title || 'Novato';
        
        // Data de registro formatada
        const memberSince = new Date(user.createdAt).toLocaleDateString('pt-BR', {
            year: 'numeric',
            month: 'long'
        });
        
        // Verificar se é o próprio usuário
        const isOwnProfile = req.session.user && req.session.user.username === req.params.username;

        // Obter informações de facção se existir
        let factionRankInfo = null;
        if (user.faction) {
            const factionSystem = require('../config/factionSystem');
            factionRankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints || 0);
        }

        res.render('pages/forum/profile', {
            profileUser: user,
            reputation,
            recentThreads,
            recentPosts,
            threadCount,
            postCount,
            reputationScore,
            reputationLevel,
            memberSince,
            isOwnProfile,
            factionRankInfo,
            user: req.session.user || null,
            pageTitle: `Perfil de ${user.username}`
        });
    } catch (error) {
        logger.error('Erro ao buscar perfil do usuário:', error);
        res.status(500).send('Erro interno do servidor');
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
        const categories = await ForumCategory.find().sort({ name: 1 }).lean();

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

        let searchQuery = {
            $text: { $search: q },
            isDeleted: false
        };
        
        // Usuários normais só veem threads ativas
        if (!isAdmin) {
            searchQuery.isActive = true;
        }

        if (category) {
            const cat = await ForumCategory.findOne({ slug: category });
            if (cat) {
                searchQuery.category = cat._id;
            }
        }

        if (author) {
            const authorUser = await User.findOne({ username: author });
            if (authorUser) {
                searchQuery.author = authorUser._id;
            }
        }

        let sortOption = {};
        if (sort === 'date') {
            sortOption = { createdAt: -1 };
        } else {
            sortOption = { score: { $meta: 'textScore' } };
            searchQuery.score = { $meta: 'textScore' };
        }

        const threads = await ForumThread.find(searchQuery, searchQuery.score ? { score: { $meta: 'textScore' } } : {})
            .populate('author', 'username avatar role')
            .populate('category', 'name slug')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        const totalResults = await ForumThread.countDocuments(searchQuery);
        const totalPages = Math.ceil(totalResults / limit);

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
            totalResults,
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
        const thread = await ForumThread.findById(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const wasPinned = thread.isPinned;
        thread.isPinned = !thread.isPinned;
        await thread.save();

        // Registrar no histórico
        const userId = req.session.user._id || req.session.user.id;
        const moderator = await User.findById(userId).select('username');
        const threadAuthor = await User.findById(thread.author).select('username');
        await ModerationLog.create({
            actionType: thread.isPinned ? 'thread_pinned' : 'thread_unpinned',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: thread.author,
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
        const thread = await ForumThread.findById(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const wasLocked = thread.isLocked;
        thread.isLocked = !thread.isLocked;
        await thread.save();

        // Registrar no histórico
        const userId = req.session.user._id || req.session.user.id;
        const moderator = await User.findById(userId).select('username');
        const threadAuthor = await User.findById(thread.author).select('username');
        await ModerationLog.create({
            actionType: thread.isLocked ? 'thread_locked' : 'thread_unlocked',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: thread.author,
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
        const userId = req.session.user._id || req.session.user.id;
        
        const thread = await ForumThread.findById(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        // Arquivar flags se existirem
        const archivedFlags = thread.moderationFlags || [];

        thread.isDeleted = true;
        thread.deletedAt = new Date();
        thread.deletedBy = userId;
        await thread.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        const threadAuthor = await User.findById(thread.author).select('username');
        await ModerationLog.create({
            actionType: 'thread_deleted',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: thread.author,
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
        const userId = req.session.user._id || req.session.user.id;
        
        const post = await ForumPost.findById(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Se não for moderador, verificar se é o autor
        if (req.userRole !== 'moderator' && req.userRole !== 'admin') {
            const postAuthorId = post.author._id || post.author;
            if (postAuthorId.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: 'Você não pode deletar este post' });
            }
        }

        // Arquivar flags se existirem
        const archivedFlags = post.moderationFlags || [];

        post.isDeleted = true;
        post.deletedAt = new Date();
        post.deletedBy = userId;
        await post.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        const postAuthor = await User.findById(post.author).select('username');
        await ModerationLog.create({
            actionType: 'post_deleted',
            targetType: 'post',
            targetId: post._id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: post.author,
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
        const userId = req.session.user._id || req.session.user.id;
        
        if (!content || content.trim().length < 10) {
            return res.status(400).json({ success: false, message: 'Conteúdo deve ter no mínimo 10 caracteres' });
        }

        const post = await ForumPost.findById(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Se não for moderador, verificar se é o autor
        if (req.userRole !== 'moderator' && req.userRole !== 'admin') {
            const postAuthorId = post.author._id || post.author;
            if (postAuthorId.toString() !== userId.toString()) {
                return res.status(403).json({ success: false, message: 'Você não pode editar este post' });
            }
        }

        // Salvar histórico de edição
        post.editHistory.push({
            editedBy: userId,
            editedAt: new Date(),
            previousContent: post.content
        });

        post.content = content;
        post.isEdited = true;
        post.editedAt = new Date();
        await post.save();

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
        const userId = req.session.user._id || req.session.user.id;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Motivo deve ter no mínimo 5 caracteres' });
        }

        const thread = await ForumThread.findById(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        // Verificar se usuário já denunciou
        const alreadyFlagged = thread.moderationFlags.some(
            flag => flag.user.toString() === userId.toString()
        );

        if (alreadyFlagged) {
            return res.status(400).json({ success: false, message: 'Você já denunciou esta thread' });
        }

        thread.moderationFlags.push({
            user: userId,
            reason: reason,
            createdAt: new Date()
        });

        await thread.save();

        // Registrar no histórico
        const reporter = await User.findById(userId).select('username');
        const threadAuthor = await User.findById(thread.author).select('username');
        await ModerationLog.create({
            actionType: 'thread_flagged',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            reporter: userId,
            reporterUsername: reporter ? reporter.username : 'Desconhecido',
            targetUser: thread.author,
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
        const userId = req.session.user._id || req.session.user.id;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ success: false, message: 'Motivo deve ter no mínimo 5 caracteres' });
        }

        const post = await ForumPost.findById(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Verificar se usuário já denunciou
        const alreadyFlagged = post.moderationFlags.some(
            flag => flag.user.toString() === userId.toString()
        );

        if (alreadyFlagged) {
            return res.status(400).json({ success: false, message: 'Você já denunciou este post' });
        }

        post.moderationFlags.push({
            user: userId,
            reason: reason,
            createdAt: new Date()
        });

        await post.save();

        // Registrar no histórico
        const reporter = await User.findById(userId).select('username');
        const postAuthor = await User.findById(post.author).select('username');
        await ModerationLog.create({
            actionType: 'post_flagged',
            targetType: 'post',
            targetId: post._id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            reporter: userId,
            reporterUsername: reporter ? reporter.username : 'Desconhecido',
            targetUser: post.author,
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
        // Threads com flags
        const flaggedThreads = await ForumThread.find({
            'moderationFlags.0': { $exists: true },
            isDeleted: false
        })
            .populate('author', 'username avatar role')
            .populate('category', 'name slug')
            .populate('moderationFlags.user', 'username')
            .sort({ 'moderationFlags.createdAt': -1 })
            .limit(50)
            .lean();

        // Posts com flags
        const flaggedPosts = await ForumPost.find({
            'moderationFlags.0': { $exists: true },
            isDeleted: false
        })
            .populate('author', 'username avatar role')
            .populate('thread', 'title slug')
            .populate('moderationFlags.user', 'username')
            .sort({ 'moderationFlags.createdAt': -1 })
            .limit(50)
            .lean();

        // Estatísticas
        const stats = {
            totalFlags: flaggedThreads.length + flaggedPosts.length,
            flaggedThreadsCount: flaggedThreads.length,
            flaggedPostsCount: flaggedPosts.length,
            deletedThreadsToday: await ForumThread.countDocuments({
                isDeleted: true,
                deletedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
            }),
            deletedPostsToday: await ForumPost.countDocuments({
                isDeleted: true,
                deletedAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) }
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
        const userId = req.session.user._id || req.session.user.id;
        
        const thread = await ForumThread.findById(threadId).populate('author', 'username');

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        // Arquivar flags antes de limpar
        const archivedFlags = thread.moderationFlags.map(flag => ({
            user: flag.user,
            reason: flag.reason,
            createdAt: flag.createdAt
        }));

        // Buscar usernames dos reporters
        const reporterIds = thread.moderationFlags.map(f => f.user);
        const reporters = await User.find({ _id: { $in: reporterIds } }).select('_id username');
        const reporterMap = reporters.reduce((acc, r) => {
            acc[r._id.toString()] = r.username;
            return acc;
        }, {});

        const archivedFlagsWithUsernames = archivedFlags.map(flag => ({
            ...flag,
            username: reporterMap[flag.user.toString()] || 'Desconhecido'
        }));

        thread.moderationFlags = [];
        await thread.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        await ModerationLog.create({
            actionType: 'thread_flags_dismissed',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: thread.author._id || thread.author,
            targetUsername: thread.author.username || 'Desconhecido',
            archivedFlags: archivedFlagsWithUsernames,
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
        const userId = req.session.user._id || req.session.user.id;
        
        const post = await ForumPost.findById(postId).populate('author', 'username');

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        // Arquivar flags antes de limpar
        const archivedFlags = post.moderationFlags.map(flag => ({
            user: flag.user,
            reason: flag.reason,
            createdAt: flag.createdAt
        }));

        // Buscar usernames dos reporters
        const reporterIds = post.moderationFlags.map(f => f.user);
        const reporters = await User.find({ _id: { $in: reporterIds } }).select('_id username');
        const reporterMap = reporters.reduce((acc, r) => {
            acc[r._id.toString()] = r.username;
            return acc;
        }, {});

        const archivedFlagsWithUsernames = archivedFlags.map(flag => ({
            ...flag,
            username: reporterMap[flag.user.toString()] || 'Desconhecido'
        }));

        post.moderationFlags = [];
        await post.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        await ModerationLog.create({
            actionType: 'post_flags_dismissed',
            targetType: 'post',
            targetId: post._id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: post.author._id || post.author,
            targetUsername: post.author.username || 'Desconhecido',
            archivedFlags: archivedFlagsWithUsernames,
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
        const userId = req.session.user._id || req.session.user.id;
        
        const thread = await ForumThread.findById(threadId);

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

        const wasActive = thread.isActive;
        thread.isActive = !thread.isActive;
        
        if (!thread.isActive) {
            thread.inactivatedAt = new Date();
            thread.inactivatedBy = userId;
        } else {
            thread.inactivatedAt = null;
            thread.inactivatedBy = null;
        }
        
        await thread.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        const threadAuthor = await User.findById(thread.author).select('username');
        await ModerationLog.create({
            actionType: thread.isActive ? 'thread_activated' : 'thread_inactivated',
            targetType: 'thread',
            targetId: thread._id,
            targetModel: 'ForumThread',
            targetTitle: thread.title,
            targetContent: thread.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: thread.author,
            targetUsername: threadAuthor ? threadAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ 
            success: true, 
            message: thread.isActive ? 'Thread ativada com sucesso' : 'Thread inativada com sucesso',
            isActive: thread.isActive
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
        const userId = req.session.user._id || req.session.user.id;
        
        const post = await ForumPost.findById(postId);

        if (!post) {
            return res.status(404).json({ success: false, message: 'Post não encontrado' });
        }

        const wasActive = post.isActive;
        post.isActive = !post.isActive;
        
        if (!post.isActive) {
            post.inactivatedAt = new Date();
            post.inactivatedBy = userId;
        } else {
            post.inactivatedAt = null;
            post.inactivatedBy = null;
        }
        
        await post.save();

        // Registrar no histórico
        const moderator = await User.findById(userId).select('username');
        const postAuthor = await User.findById(post.author).select('username');
        await ModerationLog.create({
            actionType: post.isActive ? 'post_activated' : 'post_inactivated',
            targetType: 'post',
            targetId: post._id,
            targetModel: 'ForumPost',
            targetContent: post.content.substring(0, 200),
            moderator: userId,
            moderatorUsername: moderator ? moderator.username : 'Desconhecido',
            targetUser: post.author,
            targetUsername: postAuthor ? postAuthor.username : 'Desconhecido',
            ipAddress: req.ip,
            userAgent: req.get('user-agent')
        });

        res.json({ 
            success: true, 
            message: post.isActive ? 'Post ativado com sucesso' : 'Post inativado com sucesso',
            isActive: post.isActive
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

        const filter = req.query.action ? { actionType: req.query.action } : {};
        if (req.query.moderator) {
            filter.moderator = req.query.moderator;
        }
        if (req.query.targetUser) {
            filter.targetUser = req.query.targetUser;
        }

        const totalLogs = await ModerationLog.countDocuments(filter);
        const logs = await ModerationLog.find(filter)
            .populate('moderator', 'username avatar')
            .populate('targetUser', 'username avatar')
            .populate('reporter', 'username')
            .sort({ createdAt: -1 })
            .limit(limit)
            .skip(skip)
            .lean();

        const totalPages = Math.ceil(totalLogs / limit);

        res.render('pages/forum/moderation-history', {
            logs,
            currentPage: page,
            totalPages,
            totalLogs,
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
        const limit = 20; // Top 20 de cada facção

        // Buscar top piratas
        const topPirates = await User.find({ 
            faction: 'pirate',
            factionPoints: { $gt: 0 }
        })
            .select('username avatar faction factionPoints factionRank')
            .sort({ factionPoints: -1 })
            .limit(limit)
            .lean();

        // Buscar top marines
        const topMarines = await User.find({ 
            faction: 'marine',
            factionPoints: { $gt: 0 }
        })
            .select('username avatar faction factionPoints factionRank')
            .sort({ factionPoints: -1 })
            .limit(limit)
            .lean();

        // Adicionar informações de rank para cada usuário
        topPirates.forEach(user => {
            user.rankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints);
            user.bounty = user.factionPoints * 10000;
        });

        topMarines.forEach(user => {
            user.rankInfo = factionSystem.getCurrentRank(user.faction, user.factionPoints);
            user.bounty = user.factionPoints * 10000;
        });

        // Calcular estatísticas gerais
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

module.exports = exports;
