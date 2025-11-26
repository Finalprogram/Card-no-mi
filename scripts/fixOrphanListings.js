require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');
const Listing = require('../src/models/Listing');
const Order = require('../src/models/Order');
const Review = require('../src/models/Review');
const ForumThread = require('../src/models/ForumThread');
const ForumPost = require('../src/models/ForumPost');
const Notification = require('../src/models/Notification');

async function fixOrphanData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Conectado ao MongoDB\n');
    
    // Buscar o usuário admin
    const adminUser = await User.findOne({ email: 'murilobdf14@gmail.com' });
    if (!adminUser) {
      console.log('❌ Usuário admin não encontrado!');
      process.exit(1);
    }
    
    console.log(`👤 Usuário encontrado: ${adminUser.username} (${adminUser.email})`);
    console.log(`🆔 ID: ${adminUser._id}\n`);
    
    // Verificar e corrigir Listings
    const orphanListings = await Listing.countDocuments({ seller: { $exists: false } });
    const listingsWithDeletedSeller = await Listing.find({ seller: { $exists: true } });
    
    let listingsToFix = orphanListings;
    for (const listing of listingsWithDeletedSeller) {
      const sellerExists = await User.findById(listing.seller);
      if (!sellerExists) {
        listingsToFix++;
      }
    }
    
    if (listingsToFix > 0) {
      const resultListings = await Listing.updateMany(
        {
          $or: [
            { seller: { $exists: false } },
            { seller: null }
          ]
        },
        { $set: { seller: adminUser._id } }
      );
      
      // Corrigir listings com sellers que não existem mais
      const allListings = await Listing.find();
      let fixedCount = 0;
      for (const listing of allListings) {
        if (listing.seller) {
          const sellerExists = await User.findById(listing.seller);
          if (!sellerExists) {
            listing.seller = adminUser._id;
            await listing.save();
            fixedCount++;
          }
        }
      }
      
      console.log(`📦 Anúncios (Listings) órfãos corrigidos: ${resultListings.modifiedCount + fixedCount}`);
    } else {
      console.log(`📦 Anúncios: Nenhum órfão encontrado`);
    }
    
    // Verificar e corrigir Orders (comprador e vendedor)
    const orders = await Order.find();
    let ordersFixed = 0;
    for (const order of orders) {
      let modified = false;
      
      if (!order.buyer || !(await User.findById(order.buyer))) {
        order.buyer = adminUser._id;
        modified = true;
      }
      
      if (!order.seller || !(await User.findById(order.seller))) {
        order.seller = adminUser._id;
        modified = true;
      }
      
      if (modified) {
        await order.save();
        ordersFixed++;
      }
    }
    console.log(`🛒 Pedidos (Orders) órfãos corrigidos: ${ordersFixed}`);
    
    // Verificar e corrigir Reviews
    const reviews = await Review.find();
    let reviewsFixed = 0;
    for (const review of reviews) {
      let modified = false;
      
      if (!review.reviewer || !(await User.findById(review.reviewer))) {
        review.reviewer = adminUser._id;
        modified = true;
      }
      
      if (review.reviewee && !(await User.findById(review.reviewee))) {
        review.reviewee = adminUser._id;
        modified = true;
      }
      
      if (modified) {
        await review.save();
        reviewsFixed++;
      }
    }
    console.log(`⭐ Avaliações (Reviews) órfãs corrigidas: ${reviewsFixed}`);
    
    // Verificar e corrigir ForumThreads
    const threads = await ForumThread.find();
    let threadsFixed = 0;
    for (const thread of threads) {
      if (!thread.author || !(await User.findById(thread.author))) {
        thread.author = adminUser._id;
        await thread.save();
        threadsFixed++;
      }
    }
    console.log(`💬 Tópicos do fórum órfãos corrigidos: ${threadsFixed}`);
    
    // Verificar e corrigir ForumPosts
    const posts = await ForumPost.find();
    let postsFixed = 0;
    for (const post of posts) {
      if (!post.author || !(await User.findById(post.author))) {
        post.author = adminUser._id;
        await post.save();
        postsFixed++;
      }
    }
    console.log(`📝 Posts do fórum órfãos corrigidos: ${postsFixed}`);
    
    // Verificar e corrigir Notifications
    const notifications = await Notification.find();
    let notificationsFixed = 0;
    for (const notification of notifications) {
      let modified = false;
      
      if (!notification.user || !(await User.findById(notification.user))) {
        notification.user = adminUser._id;
        modified = true;
      }
      
      if (notification.sender && !(await User.findById(notification.sender))) {
        notification.sender = adminUser._id;
        modified = true;
      }
      
      if (modified) {
        await notification.save();
        notificationsFixed++;
      }
    }
    console.log(`🔔 Notificações órfãs corrigidas: ${notificationsFixed}`);
    
    console.log('\n✅ Correção concluída com sucesso!');
    
  } catch (error) {
    console.error('❌ Erro ao corrigir dados órfãos:', error);
  } finally {
    mongoose.connection.close();
    process.exit(0);
  }
}

fixOrphanData();
