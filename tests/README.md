# 🧪 Testes do Card'no Mi

Este diretório contém os testes automatizados do sistema.

## 📋 Pré-requisitos

1. **Instalar Jest** (se ainda não instalou):
```bash
npm install --save-dev jest
```

2. **MongoDB de Testes**: 
   - Certifique-se de ter um MongoDB rodando localmente
   - Os testes usarão o banco `cardnomi-test` (configurado em `.env.test`)

## 🚀 Como Rodar os Testes

### Rodar todos os testes
```bash
npm test
```

### Rodar testes em modo watch (re-executa ao salvar arquivos)
```bash
npm run test:watch
```

### Rodar testes com relatório de cobertura
```bash
npm run test:coverage
```

## 📁 Estrutura dos Testes

```
tests/
├── notifications.test.js    # Testes do sistema de notificações
└── ... (outros testes)
```

## 🧪 Testes Implementados

### Sistema de Notificações (`notifications.test.js`)

**Notificações de Venda:**
- ✅ Cria notificação quando uma venda é concluída
- ✅ Verifica link correto para pedidos vendidos
- ✅ Valida ícone e cor da notificação

**Notificações de Status de Pedido:**
- ✅ Pagamento confirmado (Paid)
- ✅ Pedido enviado (Shipped)
- ✅ Pedido entregue (Delivered)
- ✅ Pedido cancelado (Cancelled)
- ✅ Aguardando pagamento (PendingPayment)
- ✅ Verifica links corretos

**Modelo de Notificação:**
- ✅ Marcar como lida
- ✅ Marcar todas como lidas
- ✅ Contar não lidas
- ✅ Buscar com limite e paginação
- ✅ Expiração após 30 dias

**Validações:**
- ✅ Campos obrigatórios (recipient, sender)
- ✅ Tipos válidos de notificação
- ✅ Rejeição de tipos inválidos

## 📊 Cobertura de Testes

O relatório de cobertura é gerado em `coverage/` após executar:
```bash
npm run test:coverage
```

Abra `coverage/lcov-report/index.html` no navegador para visualizar o relatório completo.

## 🔧 Configuração

### Jest (`jest.config.js`)
- **testEnvironment**: Node.js
- **testTimeout**: 10 segundos
- **testMatch**: `tests/**/*.test.js`
- **Coverage**: Coleta de `src/**/*.js` (exceto config)

### Variáveis de Ambiente (`.env.test`)
```env
MONGODB_URI_TEST=mongodb://localhost:27017/cardnomi-test
NODE_ENV=test
SESSION_SECRET=test-secret-key
```

## 💡 Dicas

1. **Isolamento**: Cada teste limpa o banco antes de executar
2. **Mocks**: Logger é mockado para não poluir console
3. **Dados**: Usuários e pedidos de teste são criados automaticamente
4. **Limpeza**: Conexão é fechada após todos os testes

## 🐛 Troubleshooting

### Erro de conexão MongoDB
```
Ensure MongoDB is running:
sudo service mongodb start  # Linux
brew services start mongodb-community  # Mac
```

### Timeout nos testes
```
Increase timeout in jest.config.js:
testTimeout: 20000  // 20 seconds
```

### Cache do Jest
```bash
npm test -- --clearCache
```

## 📝 Adicionar Novos Testes

1. Criar arquivo em `tests/` com sufixo `.test.js`
2. Estrutura básica:
```javascript
describe('Nome do Módulo', () => {
  beforeAll(async () => {
    // Setup antes de todos os testes
  });

  beforeEach(async () => {
    // Setup antes de cada teste
  });

  test('Deve fazer algo específico', async () => {
    // Arrange
    // Act
    // Assert
  });

  afterAll(async () => {
    // Cleanup após todos os testes
  });
});
```

## 📚 Documentação

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Mongoose Testing](https://mongoosejs.com/docs/jest.html)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)

## ✅ Status dos Testes

Última execução: 26/11/2025

| Módulo | Testes | Status |
|--------|--------|--------|
| Notificações | 23 | ✅ |
| Total | 23 | ✅ |

---

Para rodar testes específicos:
```bash
npm test -- notifications.test.js
```
