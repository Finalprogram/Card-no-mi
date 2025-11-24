# 📰 Sistema de Fórum - Card no Mi

## 📋 Índice
- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Estrutura](#estrutura)
- [Instalação](#instalação)
- [Uso](#uso)
- [API](#api)
- [Modelos](#modelos)
- [Sistema de Reputação](#sistema-de-reputação)
- [Moderação](#moderação)

## 🎯 Visão Geral

Sistema de fórum completo para a comunidade One Piece TCG com recursos modernos de interação, gamificação e integração com marketplace.

## ✨ Funcionalidades

### 🔥 Core
- **7 Categorias Principais:**
  - 📰 Notícias & Atualizações
  - 💬 Discussão Geral
  - 🃏 Estratégias & Decks
  - 💰 Marketplace
  - 🏆 Torneios & Eventos
  - ❓ Dúvidas & Suporte
  - 🎨 Conteúdo da Comunidade

- **Threads e Posts:**
  - Criação de tópicos com título, conteúdo e tags
  - Respostas com threading (conversas aninhadas)
  - Sistema de citações (quote)
  - Histórico de edições
  - Fixar e trancar threads (moderadores)
  - Contador de visualizações
  - Atividade recente

### 💬 Interação Social
- **Sistema de Reações:**
  - 👍 Like
  - ❤️ Love
  - 😮 Wow
  - 😂 Haha
  - 😢 Sad
  - 😡 Angry

- **Menções:** Sistema de @username para notificar usuários
- **Perfis de Usuário:** Estatísticas, conquistas, atividade recente

### 🏆 Gamificação
- **Sistema de Reputação:**
  - Pontos por atividade (criar threads, posts, reações)
  - Níveis de 1 a infinito
  - Títulos baseados em nível:
    - Novato (1-5)
    - Aprendiz (6-10)
    - Experiente (11-20)
    - Veterano (21-35)
    - Mestre (36-50)
    - Grande Mestre (51-75)
    - Lenda (76+)
  
- **Sistema de Conquistas:**
  - Badges automáticos por marcos
  - Conquistas customizáveis
  - Exibição no perfil

### 🔍 Busca e Filtros
- Busca full-text em threads e posts
- Filtros por categoria
- Filtros por tags
- Ordenação (relevância, data, popularidade)
- Paginação

### 🎨 Design
- Modo escuro/claro integrado
- Totalmente responsivo (mobile-first)
- Animações suaves
- UI moderna e intuitiva

### 🔒 Moderação
- Sistema de flags/denúncias
- Status de moderação
- Histórico de ações
- Permissões por categoria
- Bloqueio de threads/posts

## 📁 Estrutura

```
src/
├── models/
│   ├── ForumCategory.js      # Categorias do fórum
│   ├── ForumThread.js         # Threads/tópicos
│   ├── ForumPost.js           # Posts/respostas
│   └── UserReputation.js      # Sistema de reputação
├── controllers/
│   └── forumController.js     # Lógica de negócio
├── routes/
│   └── forumRoutes.js         # Rotas Express
└── views/pages/forum/
    ├── index.ejs              # Página inicial
    ├── category.ejs           # Listagem de threads
    ├── thread.ejs             # Visualização de thread
    ├── create-thread.ejs      # Criar novo thread
    ├── user-profile.ejs       # Perfil do usuário
    └── search.ejs             # Resultados de busca

public/css/
└── forum.css                  # Estilos completos

scripts/
└── seedForum.js               # Popular banco de dados
```

## 🚀 Instalação

### 1. Dependências já instaladas
O fórum usa as dependências existentes do projeto:
- Express
- Mongoose
- EJS
- Express-session

### 2. Popular o Banco de Dados

Execute o script de seed para criar categorias iniciais:

```bash
node scripts/seedForum.js
```

Isso criará:
- 7 categorias principais
- Threads de exemplo (se houver usuários)
- Reputações iniciais

### 3. Acessar o Fórum

Navegue para: `http://localhost:3000/forum`

## 📖 Uso

### Criar uma Thread

1. Acesse a categoria desejada
2. Clique em "Criar Thread"
3. Preencha:
   - Título (máx. 200 caracteres)
   - Conteúdo (mín. 20, máx. 50000 caracteres)
   - Tags (opcional)
4. Clique em "Publicar Thread"

### Responder a um Thread

1. Abra o thread
2. Role até o formulário de resposta
3. Digite sua resposta
4. Opcionalmente:
   - Cite outro post (clique em "Citar")
   - Mencione usuários com @username
5. Clique em "Enviar Resposta"

### Reagir a Posts

- Clique no emoji desejado abaixo do post
- Clique novamente para remover sua reação
- Veja quantas pessoas reagiram

### Buscar no Fórum

1. Use a barra de busca no topo
2. Digite palavras-chave
3. Use filtros para refinar:
   - Categoria específica
   - Tipo (threads ou posts)
   - Ordenação

## 🔌 API

### Rotas Públicas

```javascript
GET  /forum                           # Página inicial
GET  /forum/search?q=query            # Buscar
GET  /forum/user/:username            # Perfil do usuário
GET  /forum/:categorySlug             # Ver categoria
GET  /forum/:categorySlug/:threadSlug # Ver thread
```

### Rotas Autenticadas

```javascript
GET  /forum/:categorySlug/new              # Formulário criar thread
POST /forum/:categorySlug/new              # Criar thread
POST /forum/:categorySlug/:threadSlug/reply # Criar post
POST /forum/thread/:threadId/react         # Reagir a thread
POST /forum/post/:postId/react             # Reagir a post
```

### Parâmetros

**Query Params:**
- `page`: Número da página (padrão: 1)
- `sort`: Ordenação (activity, latest, popular, replies)
- `tag`: Filtrar por tag
- `q`: Query de busca
- `category`: Filtrar por categoria
- `type`: Tipo de resultado (all, threads, posts)

**Body (Criar Thread):**
```json
{
  "title": "Título do Thread",
  "content": "Conteúdo...",
  "tags": ["tag1", "tag2"]
}
```

**Body (Criar Post):**
```json
{
  "content": "Resposta...",
  "replyTo": "postId (opcional)",
  "quotedPost": "postId (opcional)"
}
```

**Body (Reagir):**
```json
{
  "emoji": "like" // ou love, wow, haha, sad, angry
}
```

## 🗄️ Modelos

### ForumCategory

```javascript
{
  name: String,          // Nome da categoria
  slug: String,          // URL amigável
  icon: String,          // Emoji da categoria
  description: String,   // Descrição
  order: Number,         // Ordem de exibição
  color: String,         // Cor (hex)
  permissions: {
    canView: [String],   // Roles que podem ver
    canPost: [String],   // Roles que podem postar
    canModerate: [String] // Roles que podem moderar
  },
  isActive: Boolean
}
```

### ForumThread

```javascript
{
  category: ObjectId,    // Referência à categoria
  author: ObjectId,      // Referência ao usuário
  title: String,         // Título do thread
  slug: String,          // URL amigável
  content: String,       // Conteúdo principal
  tags: [String],        // Tags
  reactions: [{
    user: ObjectId,
    emoji: String
  }],
  isPinned: Boolean,     // Thread fixado
  isLocked: Boolean,     // Thread trancado
  isDeleted: Boolean,    // Soft delete
  viewCount: Number,     // Visualizações
  replyCount: Number,    // Número de respostas
  lastActivity: Date,    // Última atividade
  lastActivityBy: ObjectId,
  linkedListing: ObjectId, // Produto vinculado
  linkedCard: ObjectId,    // Carta vinculada
  moderationFlags: [],   // Denúncias
  moderationStatus: String,
  editHistory: []        // Histórico de edições
}
```

### ForumPost

```javascript
{
  thread: ObjectId,      // Thread pai
  author: ObjectId,      // Autor do post
  content: String,       // Conteúdo
  replyTo: ObjectId,     // Post respondido
  quotedPost: ObjectId,  // Post citado
  quotedContent: String, // Conteúdo citado
  mentions: [ObjectId],  // Usuários mencionados
  reactions: [{
    user: ObjectId,
    emoji: String
  }],
  isDeleted: Boolean,
  moderationFlags: [],
  editHistory: []
}
```

### UserReputation

```javascript
{
  user: ObjectId,
  totalPoints: Number,
  level: Number,         // Calculado: floor(points/100) + 1
  title: String,         // Título baseado no nível
  stats: {
    threadsCreated: Number,
    postsCreated: Number,
    reactionsReceived: Number,
    bestAnswers: Number,
    helpfulVotes: Number,
    warningsReceived: Number
  },
  badges: [{
    name: String,
    icon: String,
    description: String,
    earnedAt: Date
  }],
  pointsHistory: [],
  preferences: {
    emailNotifications: Boolean,
    mentionNotifications: Boolean
  }
}
```

## 🏆 Sistema de Reputação

### Ganhar Pontos

| Ação | Pontos |
|------|--------|
| Criar Thread | +10 |
| Criar Post | +5 |
| Receber Reação | +2 |
| Melhor Resposta | +15 |
| Voto Útil | +3 |

### Perder Pontos

| Ação | Pontos |
|------|--------|
| Post Deletado | -5 |
| Aviso de Moderação | -10 |
| Banimento Temporário | -50 |

### Badges Automáticos

- 🎉 **Bem-vindo** - Primeiro post
- 📝 **Escritor** - 10 threads criados
- 💬 **Conversador** - 50 posts criados
- ⭐ **Popular** - 100 reações recebidas
- 🏆 **Veterano** - 1 ano de membro
- 👑 **Lenda** - Nível 50+

### Customizar Sistema

Edite `src/models/UserReputation.js` para:
- Ajustar pontos por ação
- Mudar fórmula de nível
- Adicionar novos badges
- Alterar títulos de nível

## 🔒 Moderação

### Permissões

Configure permissões por categoria em `ForumCategory.permissions`:

```javascript
permissions: {
  canView: ['all'],                    // Todos podem ver
  canPost: ['user', 'premium', 'admin'], // Apenas logados
  canModerate: ['moderator', 'admin']  // Apenas moderadores
}
```

### Ações de Moderação

**Fixar Thread:**
```javascript
await ForumThread.findByIdAndUpdate(threadId, { isPinned: true });
```

**Trancar Thread:**
```javascript
await ForumThread.findByIdAndUpdate(threadId, { isLocked: true });
```

**Deletar (Soft Delete):**
```javascript
await ForumThread.findByIdAndUpdate(threadId, { isDeleted: true });
```

**Adicionar Flag:**
```javascript
thread.moderationFlags.push({
  reporter: userId,
  reason: 'spam',
  description: 'Conteúdo promocional não autorizado'
});
await thread.save();
```

### Dashboard de Moderação (Futuro)

Planejado para implementação:
- Painel com todos os flags
- Histórico de ações
- Estatísticas de moderação
- Gerenciamento de usuários
- Logs de auditoria

## 🎨 Personalização

### Cores

Edite `/public/css/forum.css` para alterar cores do tema:

```css
:root {
  --primary-color: #A259FF;
  --secondary-color: #FF6F00;
  /* ... outras variáveis ... */
}
```

### Categorias

Execute script customizado para criar/editar categorias:

```javascript
const category = new ForumCategory({
  name: 'Nova Categoria',
  slug: 'nova-categoria',
  icon: '🆕',
  description: 'Descrição...',
  order: 8,
  color: '#FF5733'
});
await category.save();
```

### Tags Sugeridas

Adicione tags pré-definidas editando a view `create-thread.ejs`:

```javascript
const suggestedTags = ['dúvida', 'estratégia', 'deck', 'meta', 'torneio'];
```

## 🐛 Troubleshooting

### Threads não aparecem

Verifique:
1. Categoria está ativa (`isActive: true`)
2. Thread não está deletado (`isDeleted: false`)
3. Usuário tem permissão para ver a categoria

### Reações não funcionam

Verifique:
1. Usuário está autenticado
2. JavaScript está habilitado
3. Console do navegador para erros

### Busca não retorna resultados

Verifique:
1. Índice de texto foi criado:
   ```javascript
   await ForumThread.createIndexes();
   ```
2. Query tem pelo menos 3 caracteres
3. Termos existem no banco de dados

## 📝 TODO / Roadmap

- [ ] Sistema de notificações em tempo real (WebSockets)
- [ ] Dashboard de moderação completo
- [ ] Sistema de relatórios e analytics
- [ ] Upload de imagens nos posts
- [ ] Markdown/BBCode para formatação
- [ ] Sistema de votação útil/não útil
- [ ] Melhor resposta marcada pelo autor
- [ ] Subscrição a threads (notificações)
- [ ] RSS feeds por categoria
- [ ] API REST completa
- [ ] Integração com Discord (webhooks)
- [ ] Sistema de recompensas por conquistas

## 📞 Suporte

Para problemas ou dúvidas:
1. Verifique a documentação acima
2. Procure no fórum de Dúvidas & Suporte
3. Entre em contato com a equipe

## 📄 Licença

Parte do projeto Card no Mi - One Piece TCG Marketplace
