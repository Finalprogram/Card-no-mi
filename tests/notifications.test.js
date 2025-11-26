// Testes do Sistema de Notificações

const mongoose = require('mongoose');
const Notification = require('../src/models/Notification');
const User = require('../src/models/User');
const Order = require('../src/models/Order');
const notificationService = require('../src/services/notificationService');

// Mock do logger para evitar logs durante testes
jest.mock('../src/config/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Sistema de Notificações', () => {
  let testUser1, testUser2, testOrder;

  // Conectar ao banco de testes antes de todos os testes
  beforeAll(async () => {
    // Usar o mesmo banco do .env se não houver banco de teste
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/cardnomi';
    
    // Desconectar se já estiver conectado
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }
    
    await mongoose.connect(mongoUri);
  }, 30000); // Timeout de 30 segundos

  // Limpar dados antes de cada teste
  beforeEach(async () => {
    await Notification.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});

    // Criar usuários de teste
    testUser1 = await User.create({
      username: 'vendedor_teste',
      email: 'vendedor@test.com',
      password: 'senha123',
      fullName: 'Vendedor Teste',
      accountType: 'shop',
      role: 'user'
    });

    testUser2 = await User.create({
      username: 'comprador_teste',
      email: 'comprador@test.com',
      password: 'senha123',
      fullName: 'Comprador Teste',
      accountType: 'individual',
      role: 'user'
    });

    // Criar pedido de teste
    testOrder = await Order.create({
      user: testUser2._id,
      items: [{
        card: new mongoose.Types.ObjectId(),
        listing: new mongoose.Types.ObjectId(),
        seller: testUser1._id,
        cardName: 'Monkey D. Luffy',
        price: 50,
        quantity: 2
      }],
      status: 'Processing',
      totalPrice: 100,
      shippingAddress: {
        street: 'Rua Teste',
        number: '123',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        cep: '01000-000'
      }
    });
  });

  // Desconectar após todos os testes
  afterAll(async () => {
    await mongoose.connection.close();
  }, 30000); // Timeout de 30 segundos

  describe('Notificações de Venda', () => {
    test('Deve criar notificação quando uma venda é concluída', async () => {
      await notificationService.notifySale(
        testUser1._id,
        testUser2.username,
        'Monkey D. Luffy',
        2,
        100,
        testOrder._id
      );

      const notifications = await Notification.find({ recipient: testUser1._id });
      
      expect(notifications).toHaveLength(1);
      expect(notifications[0].type).toBe('sale');
      expect(notifications[0].title).toBe('💰 Você fez uma venda!');
      expect(notifications[0].message).toContain('comprador_teste');
      expect(notifications[0].message).toContain('2x Monkey D. Luffy');
      expect(notifications[0].message).toContain('100.00');
      expect(notifications[0].isRead).toBe(false);
    });

    test('Notificação de venda deve ter o link correto', async () => {
      await notificationService.notifySale(
        testUser1._id,
        testUser2.username,
        'Monkey D. Luffy',
        1,
        50,
        testOrder._id
      );

      const notification = await Notification.findOne({ recipient: testUser1._id });
      expect(notification.link).toBe(`/meus-pedidos-vendidos?order=${testOrder._id}`);
    });

    test('Deve ter ícone e cor corretos para notificação de venda', async () => {
      await notificationService.notifySale(
        testUser1._id,
        testUser2.username,
        'Roronoa Zoro',
        1,
        75,
        testOrder._id
      );

      const notification = await Notification.findOne({ recipient: testUser1._id });
      expect(notification.icon).toBe('fa-shopping-cart');
      expect(notification.color).toBe('#10b981');
    });
  });

  describe('Notificações de Status de Pedido', () => {
    test('Deve criar notificação quando pedido é confirmado (Paid)', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'Paid'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      
      expect(notification).toBeDefined();
      expect(notification.type).toBe('order_status');
      expect(notification.title).toBe('✅ Pagamento confirmado!');
      expect(notification.message).toContain('confirmado');
    });

    test('Deve criar notificação quando pedido é enviado (Shipped)', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'Shipped'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      
      expect(notification.title).toBe('📦 Pedido enviado!');
      expect(notification.message).toContain('enviado');
      expect(notification.icon).toBe('fa-shipping-fast');
      expect(notification.color).toBe('#3b82f6');
    });

    test('Deve criar notificação quando pedido é entregue (Delivered)', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'Delivered'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      
      expect(notification.title).toBe('🎉 Pedido entregue!');
      expect(notification.message).toContain('entregue');
    });

    test('Deve criar notificação quando pedido é cancelado (Cancelled)', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'Cancelled'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      
      expect(notification.title).toBe('❌ Pedido cancelado');
      expect(notification.icon).toBe('fa-times-circle');
      expect(notification.color).toBe('#ef4444');
    });

    test('Deve criar notificação para pagamento pendente (PendingPayment)', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'PendingPayment'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      
      expect(notification.title).toBe('⏳ Aguardando pagamento');
      expect(notification.color).toBe('#f59e0b');
    });

    test('Notificação de pedido deve ter o link correto', async () => {
      await notificationService.notifyOrderStatus(
        testUser2._id,
        testOrder._id,
        'Paid'
      );

      const notification = await Notification.findOne({ recipient: testUser2._id });
      expect(notification.link).toBe(`/meus-pedidos?order=${testOrder._id}`);
    });
  });

  describe('Modelo de Notificação', () => {
    test('Deve marcar notificação como lida', async () => {
      const notification = await Notification.create({
        recipient: testUser1._id,
        sender: testUser2._id,
        type: 'sale',
        title: 'Teste',
        message: 'Mensagem de teste',
        link: '/test'
      });

      expect(notification.isRead).toBe(false);

      await Notification.markAsRead(notification._id, testUser1._id);
      
      const updated = await Notification.findById(notification._id);
      expect(updated.isRead).toBe(true);
      expect(updated.readAt).toBeDefined();
    });

    test('Deve marcar todas as notificações como lidas', async () => {
      await Notification.create([
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: 'Venda 1',
          message: 'Mensagem 1',
          link: '/test1'
        },
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: 'Venda 2',
          message: 'Mensagem 2',
          link: '/test2'
        },
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'order_status',
          title: 'Pedido',
          message: 'Mensagem 3',
          link: '/test3'
        }
      ]);

      await Notification.markAllAsRead(testUser1._id);
      
      const notifications = await Notification.find({ recipient: testUser1._id });
      expect(notifications.every(n => n.isRead)).toBe(true);
    });

    test('Deve contar notificações não lidas', async () => {
      await Notification.create([
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: 'Venda 1',
          message: 'Mensagem 1',
          link: '/test1',
          isRead: false
        },
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: 'Venda 2',
          message: 'Mensagem 2',
          link: '/test2',
          isRead: false
        },
        {
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: 'Venda 3',
          message: 'Mensagem 3',
          link: '/test3',
          isRead: true
        }
      ]);

      const count = await Notification.getUnreadCount(testUser1._id);
      expect(count).toBe(2);
    });

    test('Deve buscar notificações do usuário com limite', async () => {
      // Criar 10 notificações
      for (let i = 1; i <= 10; i++) {
        await Notification.create({
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'sale',
          title: `Venda ${i}`,
          message: `Mensagem ${i}`,
          link: `/test${i}`
        });
      }

      const notifications = await Notification.getUserNotifications(testUser1._id, 5, 0);
      expect(notifications).toHaveLength(5);
    });

    test('Notificação deve expirar após 30 dias', async () => {
      const notification = await Notification.create({
        recipient: testUser1._id,
        sender: testUser2._id,
        type: 'sale',
        title: 'Teste',
        message: 'Mensagem',
        link: '/test'
      });

      const expiresAt = new Date(notification.expiresAt);
      const createdAt = new Date(notification.createdAt);
      const diffDays = Math.round((expiresAt - createdAt) / (1000 * 60 * 60 * 24));
      
      expect(diffDays).toBe(30);
    });
  });

  describe('Validações do Modelo', () => {
    test('Não deve criar notificação sem recipient', async () => {
      await expect(
        Notification.create({
          sender: testUser1._id,
          type: 'sale',
          title: 'Teste',
          message: 'Mensagem',
          link: '/test'
        })
      ).rejects.toThrow();
    });

    test('Não deve criar notificação sem sender', async () => {
      await expect(
        Notification.create({
          recipient: testUser1._id,
          type: 'sale',
          title: 'Teste',
          message: 'Mensagem',
          link: '/test'
        })
      ).rejects.toThrow();
    });

    test('Não deve criar notificação com tipo inválido', async () => {
      await expect(
        Notification.create({
          recipient: testUser1._id,
          sender: testUser2._id,
          type: 'tipo_invalido',
          title: 'Teste',
          message: 'Mensagem',
          link: '/test'
        })
      ).rejects.toThrow();
    });

    test('Deve aceitar tipos válidos de notificação', async () => {
      const validTypes = [
        'reply', 'mention', 'quote', 'pm', 
        'thread_moved', 'thread_locked', 'thread_pinned',
        'post_liked', 'badge_earned', 'reputation',
        'sale', 'order_status'
      ];

      for (const type of validTypes) {
        const notification = await Notification.create({
          recipient: testUser1._id,
          sender: testUser2._id,
          type: type,
          title: 'Teste',
          message: 'Mensagem',
          link: '/test'
        });
        expect(notification.type).toBe(type);
      }
    });
  });
});
