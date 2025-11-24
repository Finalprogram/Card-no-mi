const ForumCategory = require('../models/ForumCategory');
const ForumThread = require('../models/ForumThread');
const ForumPost = require('../models/ForumPost');
const UserReputation = require('../models/UserReputation');
const User = require('../models/User');
const logger = require('../config/logger');

// ============================================================================
// CATEGORIAS
// ============================================================================

// @desc    Get forum index with all categories
// @route   GET /forum
// @access  Public
exports.getForumIndex = async (req, res) => {
    try {
        const categories = await ForumCategory.find({ isActive: true })
            .sort({ order: 1 })
            .lean();

        // Buscar estatísticas para cada categoria
        for (const category of categories) {
            const threadCount = await ForumThread.countDocuments({ 
                category: category._id,
                isDeleted: false 
            });
            
            const postCount = await ForumPost.countDocuments({
                thread: { 
                    $in: await ForumThread.find({ 
                        category: category._id,
                        isDeleted: false 
                    }).select('_id')
                }
            });

            const lastThread = await ForumThread.findOne({ 
                category: category._id,
                isDeleted: false 
            })
                .sort({ lastActivity: -1 })
                .populate('author', 'username avatar role')
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

        let query = { 
            category: category._id,
            isDeleted: false 
        };

        if (filterTag) {
            query.tags = filterTag;
        }

        // Definir ordenação
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
                sortOption = { isPinned: -1, lastActivity: -1 };
        }

        const threads = await ForumThread.find(query)
            .populate('author', 'username avatar role')
            .populate('lastActivityBy', 'username')
            .sort(sortOption)
            .skip(skip)
            .limit(limit)
            .lean();

        // Buscar contagem de posts para cada thread
        for (const thread of threads) {
            thread.postCount = await ForumPost.countDocuments({ 
                thread: thread._id,
                isDeleted: false 
            });
        }

        const totalThreads = await ForumThread.countDocuments(query);
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

        const thread = await ForumThread.findOne({ slug: threadSlug, isDeleted: false })
            .populate('author', 'username avatar createdAt role')
            .populate('category')
            .lean();

        if (!thread) {
            return res.status(404).send('Thread não encontrada');
        }

        // Incrementar visualizações (não await para não bloquear)
        ForumThread.findByIdAndUpdate(thread._id, { $inc: { viewCount: 1 } }).exec();

        // Buscar todos os posts (sem paginação para estrutura hierárquica)
        const posts = await ForumPost.find({ 
            thread: thread._id,
            isDeleted: false 
        })
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

        const totalPosts = await ForumPost.countDocuments({ 
            thread: thread._id,
            isDeleted: false 
        });

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

        const { title, content, tags } = req.body;
        
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

        const thread = new ForumThread({
            title,
            slug,
            content,
            category: category._id,
            author: userId,
            tags: tagsArray,
            lastActivityBy: userId
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
        if (!req.session.user) {
            return res.status(401).json({ success: false, message: 'Não autorizado' });
        }

        const userId = req.session.user._id || req.session.user.id;
        const { content, parentPostId, quotedPostId } = req.body;
        const thread = await ForumThread.findOne({ 
            slug: req.params.threadSlug,
            isDeleted: false 
        });

        if (!thread) {
            return res.status(404).json({ success: false, message: 'Thread não encontrada' });
        }

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

        const post = new ForumPost({
            thread: thread._id,
            author: userId,
            content,
            parentPost: parentPostId || null,
            depth,
            path
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

        await post.save();

        // Atualizar thread
        await thread.updateLastActivity(userId);

        // Atualizar reputação
        let reputation = await UserReputation.findOne({ user: userId });
        if (!reputation) {
            reputation = new UserReputation({ user: userId });
        }
        reputation.stats.postsCreated += 1;
        await reputation.addPoints(5, 'Criou um post', thread._id, post._id);
        await reputation.checkAndAwardBadges();

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
        
        if (voteType === 'remove') {
            await post.removeVote(userId);
        } else {
            await post.addVote(userId, voteType);
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

        const recentThreads = await ForumThread.find({ 
            author: user._id,
            isDeleted: false 
        })
            .populate('category', 'name slug')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const recentPosts = await ForumPost.find({ 
            author: user._id,
            isDeleted: false 
        })
            .populate('thread', 'title slug')
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        res.render('pages/forum/user-profile', {
            profileUser: user,
            reputation,
            recentThreads,
            recentPosts,
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

        let searchQuery = {
            $text: { $search: q },
            isDeleted: false
        };

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

        thread.isPinned = !thread.isPinned;
        await thread.save();

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

        thread.isLocked = !thread.isLocked;
        await thread.save();

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

        thread.isDeleted = true;
        thread.deletedAt = new Date();
        thread.deletedBy = userId;
        await thread.save();

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

        post.isDeleted = true;
        post.deletedAt = new Date();
        post.deletedBy = userId;
        await post.save();

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

module.exports = exports;
