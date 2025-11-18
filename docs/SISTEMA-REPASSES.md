# 💰 Sistema de Repasses para Vendedores - Car'D No Mi

## Visão Geral

Este documento descreve a arquitetura completa do sistema de repasses (payouts) implementado para gerenciar pagamentos aos vendedores da plataforma Car'D No Mi.

---

## 📋 Índice

1. [Fluxo de Dinheiro](#fluxo-de-dinheiro)
2. [Arquitetura do Sistema](#arquitetura-do-sistema)
3. [Modelos de Dados](#modelos-de-dados)
4. [Fluxo de Processos](#fluxo-de-processos)
5. [Segurança e Compliance](#segurança-e-compliance)
6. [Integrações](#integrações)
7. [Configuração](#configuração)

---

## 💸 Fluxo de Dinheiro

### Jornada Completa

```
1. COMPRADOR PAGA
   ↓
2. MERCADO PAGO RECEBE (100%)
   ↓
3. WEBHOOK NOTIFICA PLATAFORMA
   ↓
4. PEDIDO MUDA PARA "Paid"
   ↓
5. SALDO DO VENDEDOR ATUALIZADO (Pending)
   ↓
6. PEDIDO ENVIADO → "Shipped"
   ↓
7. PEDIDO ENTREGUE → "Delivered"
   ↓
8. SALDO MOVE PARA "Available"
   ↓
9. VENDEDOR SOLICITA REPASSE (ou automático)
   ↓
10. ADMIN APROVA REPASSE
   ↓
11. GATEWAY PROCESSA PAGAMENTO (PIX/TED)
   ↓
12. VENDEDOR RECEBE O DINHEIRO
```

---

## 🏗️ Arquitetura do Sistema

### Componentes Principais

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND                             │
│  - Painel do Vendedor                                    │
│  - Solicitação de Repasses                               │
│  - Histórico de Pagamentos                               │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                   BACKEND API                            │
│  - PayoutController                                      │
│  - BalanceService                                        │
│  - PaymentController (webhook)                           │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                   WORKERS                                │
│  - PostPaymentWorker (atualiza saldo)                    │
│  - AutoPayoutWorker (cron diário)                        │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│                   DATABASE                               │
│  - Orders (pedidos)                                      │
│  - Users (vendedores + saldo)                            │
│  - Payouts (repasses)                                    │
└──────────────────┬──────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────┐
│              PAYMENT GATEWAY                             │
│  - Mercado Pago (recebimento)                            │
│  - Asaas/PagSeguro/Stripe (repasses)                     │
└─────────────────────────────────────────────────────────┘
```

---

## 🗄️ Modelos de Dados

### 1. User (Vendedor)

```javascript
{
  // ... campos existentes ...
  
  bankInfo: {
    pixKey: String,              // Chave PIX
    pixKeyType: String,          // Tipo: cpf, email, phone, random
    bankName: String,            // Nome do banco
    accountType: String,         // checking ou savings
    accountNumber: String,       // Número da conta
    preferredPaymentMethod: String, // PIX, BankTransfer, etc
    isVerified: Boolean          // Dados verificados?
  },
  
  payoutSettings: {
    frequency: String,           // weekly, monthly, on-demand
    minimumAmount: Number,       // Valor mínimo (ex: R$ 50)
    autoPayoutEnabled: Boolean,  // Ativar repasse automático?
    preferredPayoutDay: Number   // Dia do mês (1-31)
  },
  
  balance: {
    available: Number,           // Disponível para saque
    pending: Number,             // Aguardando entrega
    frozen: Number,              // Retido (disputas)
    lifetime: Number             // Total histórico
  }
}
```

### 2. Payout (Repasse)

```javascript
{
  seller: ObjectId,              // Ref: User
  
  orders: [{                     // Pedidos incluídos
    orderId: ObjectId,
    items: [...],
    orderTotal: Number
  }],
  
  amount: Number,                // Valor total
  
  breakdown: {
    grossAmount: Number,         // Valor bruto
    marketplaceFee: Number,      // Taxa do marketplace
    shippingCost: Number,        // Custo de envio
    adjustments: Number,         // Ajustes
    netAmount: Number            // Valor líquido
  },
  
  status: String,                // Pending, Scheduled, Processing, Completed, Failed
  
  periodStart: Date,             // Período coberto
  periodEnd: Date,
  
  scheduledDate: Date,           // Data agendada
  processedDate: Date,           // Data de processamento
  completedDate: Date,           // Data de conclusão
  
  bankInfo: {...},               // Snapshot dos dados bancários
  paymentMethod: String,         // PIX, BankTransfer, etc
  externalTransactionId: String, // ID da transação
  
  receipt: {
    url: String,                 // URL do comprovante
    uploadedAt: Date
  }
}
```

### 3. Order (Item)

```javascript
orderItem: {
  // ... campos existentes ...
  
  marketplaceFee: Number,        // Taxa retida
  sellerNet: Number,             // Valor líquido do vendedor
  
  balanceProcessed: Boolean,     // Saldo já creditado?
  includedInPayout: Boolean,     // Incluído em repasse?
  payoutId: ObjectId             // Ref: Payout
}
```

---

## 🔄 Fluxo de Processos

### Processo 1: Atualização de Saldo

**Trigger:** Mudança de status do pedido

```javascript
// 1. Pedido muda para "Paid"
Order.status = 'Paid'
→ updateSellerBalancesForOrder()
→ seller.balance.pending += sellerNet

// 2. Pedido muda para "Delivered"
Order.status = 'Delivered'
→ updateSellerBalancesForOrder()
→ seller.balance.pending -= sellerNet
→ seller.balance.available += sellerNet

// 3. Pedido cancelado
Order.status = 'Cancelled'
→ updateSellerBalancesForOrder()
→ seller.balance.pending -= sellerNet
```

### Processo 2: Solicitação de Repasse Manual

**Trigger:** Vendedor clica em "Solicitar Repasse"

```javascript
// Validações
✓ Dados bancários configurados?
✓ Saldo disponível >= minimumAmount?
✓ Pedidos elegíveis existem?

// Criação
payout = Payout.createFromOrders(sellerId, orderIds)
payout.status = 'Scheduled'
payout.scheduledDate = now + 2 dias

// Atualização de Saldo
seller.balance.available -= payout.amount
seller.balance.pending += payout.amount

// Marcação de Pedidos
items.forEach(item => {
  item.includedInPayout = true
  item.payoutId = payout._id
})
```

### Processo 3: Repasse Automático

**Trigger:** Cron job diário às 3h AM

```javascript
// Para cada vendedor com autoPayoutEnabled = true
sellers.forEach(seller => {
  if (seller.balance.available >= seller.payoutSettings.minimumAmount) {
    // Buscar pedidos entregues não incluídos em repasse
    orders = Order.find({
      'items.seller': seller._id,
      status: 'Delivered',
      'items.includedInPayout': false
    })
    
    // Criar repasse agendado
    payout = Payout.createFromOrders(seller._id, orders)
    payout.status = 'Scheduled'
    payout.save()
  }
})
```

### Processo 4: Processamento do Repasse

**Trigger:** Admin aprova repasse

```javascript
// 1. Validação
✓ Status = 'Scheduled' ou 'Pending'?
✓ Dados bancários válidos?

// 2. Mudança de Status
payout.status = 'Processing'

// 3. Integração com Gateway
// Exemplo com PIX
response = await gateway.createPixPayment({
  amount: payout.amount,
  pixKey: payout.bankInfo.pixKey,
  description: `Repasse pedido #${payout._id}`
})

// 4. Webhook do Gateway
// Quando pagamento é confirmado
payout.status = 'Completed'
payout.externalTransactionId = response.transactionId
payout.completedDate = new Date()

// 5. Atualização Final do Saldo
seller.balance.pending -= payout.amount
seller.balance.lifetime += payout.amount
```

---

## 🔒 Segurança e Compliance

### Medidas de Segurança

1. **Validação de Dados Bancários**
   - Verificação de CPF/CNPJ
   - Validação de chave PIX
   - Confirmação por e-mail/SMS

2. **Período de Retenção**
   - Pedidos só elegíveis após 7 dias de entrega
   - Permite tempo para disputas/devoluções

3. **Limites de Valor**
   - Valor mínimo: R$ 50,00
   - Valor máximo por repasse: R$ 50.000,00
   - Frequência máxima: 1x por dia

4. **Auditoria**
   - Log de todas as operações
   - Histórico de mudanças de status
   - Rastreabilidade completa

5. **Congelamento**
   - Saldo pode ser congelado em caso de:
     - Disputas abertas
     - Suspeita de fraude
     - Problemas com vendedor

### Compliance Financeiro

- **Retenção de Impostos**: Preparado para reter IR/CSLL se necessário
- **Notas Fiscais**: Integração futura com emissão automática
- **Relatórios**: Geração de relatórios fiscais mensais
- **PCI-DSS**: Não armazenamos dados sensíveis de cartão

---

## 🔌 Integrações

### Gateways Recomendados

#### 1. **Mercado Pago** (Atual - Recebimento)
- ✅ Já implementado
- Recebe pagamentos dos compradores
- Webhook automatizado

#### 2. **Asaas** (Recomendado - Repasses)
```javascript
// Exemplo de integração
const asaas = require('asaas');

async function createPixPayout(payout) {
  const payment = await asaas.payments.create({
    customer: payout.seller.asaasCustomerId,
    billingType: 'PIX',
    value: payout.amount,
    description: `Repasse ${payout._id}`,
    pixAddressKey: payout.bankInfo.pixKey
  });
  
  return payment;
}
```

**Vantagens:**
- API simples
- Suporte a PIX automático
- Taxas competitivas (R$ 0,50 por TED/PIX)
- Split de pagamento nativo

#### 3. **Stripe Connect** (Alternativa)
```javascript
// Exemplo de integração
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createStripePayout(payout) {
  const transfer = await stripe.transfers.create({
    amount: payout.amount * 100, // em centavos
    currency: 'brl',
    destination: payout.seller.stripeAccountId,
    transfer_group: `payout_${payout._id}`
  });
  
  return transfer;
}
```

**Vantagens:**
- Plataforma global
- Connect permite splits automáticos
- Bom para internacionalização

#### 4. **PagSeguro Split** (Nacional)
- API de split de pagamentos
- Ideal para marketplace
- Repasse automático ou sob demanda

---

## ⚙️ Configuração

### 1. Variáveis de Ambiente

```bash
# .env
MERCADO_PAGO_ACCESS_TOKEN=seu_token
ASAAS_API_KEY=seu_api_key
ASAAS_WALLET_ID=seu_wallet_id

# Configurações de repasse
PAYOUT_MINIMUM_AMOUNT=50.00
PAYOUT_RETENTION_DAYS=7
PAYOUT_AUTO_ENABLED=false
```

### 2. Cron Jobs

```javascript
// server.js ou arquivo de inicialização
const cron = require('node-cron');
const { processAutomaticPayouts } = require('./controllers/payoutController');

// Todo dia às 3h AM
cron.schedule('0 3 * * *', async () => {
  console.log('Processando repasses automáticos...');
  await processAutomaticPayouts();
});
```

### 3. Configuração Inicial do Banco

```javascript
// scripts/setupPayouts.js
const User = require('./models/User');
const Setting = require('./models/Setting');

async function setupPayouts() {
  // Inicializar saldos de todos os vendedores
  await User.updateMany(
    { accountType: { $in: ['shop', 'individual'] } },
    {
      $set: {
        'balance.available': 0,
        'balance.pending': 0,
        'balance.frozen': 0,
        'balance.lifetime': 0
      }
    }
  );
  
  // Criar configurações padrão
  await Setting.findOneAndUpdate(
    { key: 'payout_minimum_amount' },
    { value: 50.00 },
    { upsert: true }
  );
  
  console.log('Setup de repasses concluído!');
}

setupPayouts();
```

### 4. Recalcular Saldos (Manutenção)

```javascript
// scripts/recalculateBalances.js
const { recalculateSellerBalance } = require('./services/balanceService');
const User = require('./models/User');

async function recalculateAll() {
  const sellers = await User.find({ 
    accountType: { $in: ['shop', 'individual'] } 
  });
  
  for (const seller of sellers) {
    console.log(`Recalculando ${seller.username}...`);
    await recalculateSellerBalance(seller._id);
  }
  
  console.log('Recálculo concluído!');
}

recalculateAll();
```

---

## 📊 Endpoints da API

### Vendedor

```
GET  /seller/payouts              - Lista repasses
GET  /seller/payouts/:id          - Detalhes de um repasse
POST /seller/payouts/request      - Solicitar repasse
GET  /seller/balance              - Ver saldo
```

### Admin

```
GET  /admin/payouts               - Painel de repasses
POST /admin/payouts/:id/approve   - Aprovar repasse
POST /admin/payouts/:id/reject    - Rejeitar repasse
GET  /admin/payouts/stats         - Estatísticas
POST /admin/balance/recalculate   - Recalcular saldos
```

---

## 🎯 Roadmap

### Fase 1: MVP ✅
- [x] Modelo de dados
- [x] Atualização automática de saldo
- [x] Solicitação manual de repasse
- [x] Painel do vendedor

### Fase 2: Automação
- [ ] Repasses automáticos (cron)
- [ ] Integração com gateway (PIX)
- [ ] Painel administrativo completo
- [ ] Notificações por e-mail

### Fase 3: Avançado
- [ ] Split automático (pagamento direto)
- [ ] Multi-gateway (fallback)
- [ ] Retenção de impostos
- [ ] Relatórios fiscais
- [ ] API pública para vendedores

---

## 📚 Referências

- [Mercado Pago Split](https://www.mercadopago.com.br/developers/pt/docs/split-payments/introduction)
- [Asaas API](https://asaasv3.docs.apiary.io/)
- [Stripe Connect](https://stripe.com/docs/connect)
- [PagSeguro Split](https://dev.pagseguro.uol.com.br/reference/split-de-pagamentos-1)

---

**Última atualização:** Novembro 2025  
**Versão:** 1.0.0  
**Autor:** Equipe Car'D No Mi
