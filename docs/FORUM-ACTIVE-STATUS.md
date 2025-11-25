# Sistema de Ativação/Inativação do Fórum

## ✅ Correções Implementadas

### Problema Identificado
- Posts e threads criados antes da implementação do campo `isActive` não tinham esse campo definido
- Isso causava comportamento inconsistente, onde posts apareciam como inativos

### Soluções Aplicadas

#### 1. Script de Migração
Criado `scripts/migrateForumActiveStatus.js` que:
- ✅ Adiciona `isActive: true` a todas as threads existentes
- ✅ Adiciona `isActive: true` a todos os posts existentes
- ✅ Fornece estatísticas sobre a migração

**Como executar:**
```bash
node scripts/migrateForumActiveStatus.js
```

**Resultado da última execução:**
- 9 threads atualizadas
- 7 posts atualizados
- Todos agora possuem `isActive: true`

#### 2. Garantia na Criação
Atualizado o código para definir explicitamente `isActive: true` ao criar:
- ✅ Novas threads (`forumController.createThread`)
- ✅ Novos posts (`forumController.createPost`)

#### 3. Contagens Corretas
Atualizado as queries de contagem para considerar `isActive`:
- ✅ Índice do fórum (contagem de posts por categoria)
- ✅ Lista de threads por categoria (contagem de posts por thread)
- ✅ Visualização de thread individual (total de posts)

**Comportamento:**
- **Usuários normais**: Veem apenas posts/threads com `isActive: true`
- **Admins**: Veem todos os posts/threads (ativos e inativos)

## 📊 Funcionalidades do Sistema

### Para Admins
- **Inativar Thread**: Oculta a thread de usuários normais
- **Inativar Post**: Oculta o post de usuários normais
- **Visualização**: Badge laranja indica conteúdo inativo
- **Contagens**: Veem contagens reais (incluindo inativos)

### Para Usuários Normais
- Não veem threads/posts inativos
- Contagens refletem apenas conteúdo ativo
- Navegação limpa sem indicadores de conteúdo oculto

## 🔧 Manutenção

### Se novos posts aparecerem como inativos
Execute novamente o script de migração:
```bash
node scripts/migrateForumActiveStatus.js
```

### Verificar status no banco
```javascript
// Threads sem isActive
db.forumthreads.countDocuments({ isActive: { $exists: false } })

// Posts sem isActive
db.forumposts.countDocuments({ isActive: { $exists: false } })
```

## 📝 Notas Técnicas

### Schema Default
Ambos os modelos têm `default: true` no campo `isActive`:
```javascript
isActive: {
  type: Boolean,
  default: true
}
```

### Queries de Filtro
Exemplo de query para usuários normais:
```javascript
const isAdmin = req.session.user && req.session.user.role === 'admin';

let query = { isDeleted: false };
if (!isAdmin) {
  query.isActive = true;
}
```

## ✨ Status Atual
- ✅ Todos os posts existentes têm `isActive: true`
- ✅ Todas as threads existentes têm `isActive: true`
- ✅ Novos posts/threads são criados com `isActive: true`
- ✅ Contagens respeitam o status de ativação
- ✅ Sistema funcional e testado
