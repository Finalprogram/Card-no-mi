const Coupon = require('../models/Coupon');

const applyCoupon = async (req, res) => {
  const { couponCode, subtotal } = req.body;

  if (!couponCode || subtotal === undefined) {
    return res.status(400).json({ success: false, message: 'Código do cupom e subtotal são obrigatórios.' });
  }

  try {
    const coupon = await Coupon.findOne({ where: { code: couponCode } });

    if (!coupon) {
      return res.status(404).json({ success: false, message: 'Cupom inválido ou não encontrado.' });
    }

    if (!coupon.isActive) {
      return res.status(400).json({ success: false, message: 'Cupom inativo.' });
    }

    if (coupon.expirationDate < new Date()) {
      return res.status(400).json({ success: false, message: 'Cupom expirado.' });
    }

    if (coupon.usedCount >= coupon.usageLimit) {
      return res.status(400).json({ success: false, message: 'Limite de uso do cupom atingido.' });
    }

    if (subtotal < coupon.minimumOrderAmount) {
      return res.status(400).json({ success: false, message: `Subtotal mínimo de R$${coupon.minimumOrderAmount.toFixed(2)} não atingido.` });
    }

    let discountAmount = 0;
    if (coupon.discountType === 'fixed') {
      discountAmount = coupon.discountValue;
    } else if (coupon.discountType === 'percentage') {
      discountAmount = subtotal * (coupon.discountValue / 100);
    }

    // Ensure discount doesn't exceed subtotal
    discountAmount = Math.min(discountAmount, subtotal);

    const newTotal = subtotal - discountAmount;

    // Store applied coupon in session for later use during order creation
    req.session.coupon = {
      code: coupon.code,
      discountAmount: discountAmount,
      couponId: coupon.id,
    };

    res.json({
      success: true,
      message: 'Cupom aplicado com sucesso!',
      discountAmount: discountAmount,
      newTotal: newTotal,
    });

  } catch (error) {
    console.error('Erro interno do servidor ao aplicar cupom.');
  }
};

const removeCoupon = (req, res) => {
  try {
    delete req.session.coupon;
    res.json({ success: true, message: 'Cupom removido com sucesso!' });
  } catch (error) {
    console.error('Erro ao remover cupom:', error);
    res.status(500).json({ success: false, message: 'Erro interno do servidor ao remover cupom.' });
  }
};

module.exports = {
  applyCoupon,
  removeCoupon,
};