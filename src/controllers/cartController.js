const User = require('../models/User');

/** Cria/retorna o carrinho na sessão */
function getCart(req) {
  if (!req.session.cart) {
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
  }
  return req.session.cart;
}

/** Recalcula totais do carrinho */
function recompute(cart) {
  let totalQty = 0;
  let totalPrice = 0;
  for (const it of cart.items) {
    totalQty += it.qty;
    totalPrice += it.qty * it.price;
  }
  cart.totalQty = totalQty;
  cart.totalPrice = Number(totalPrice.toFixed(2));
}

/** Normaliza meta para garantir campos úteis no front/checkout */
function normalizeMeta(baseMeta = {}, { cardId, vendorId }) {
  const safe = { ...baseMeta };

  // IDs chave para split por vendedor no checkout
  safe.sellerId   = safe.sellerId   || vendorId;
  safe.sellerName = safe.sellerName || baseMeta?.sellerName || 'Vendedor';

  // Dados da carta para exibir no modal
  safe.cardId    = safe.cardId    || cardId;
  safe.cardName  = safe.cardName  || baseMeta?.cardName  || 'Carta';
  safe.imageUrl  = safe.imageUrl  || baseMeta?.imageUrl  || '/img/card-placeholder.png';
  safe.condition = safe.condition || baseMeta?.condition || null;

  // Origem do frete (se você já tiver isso por vendedor)
  // Pode vir preenchido do front ou popular aqui via DB num próximo passo
  safe.originZip = (safe.originZip || '').replace?.(/\D/g, '') || null;

  return safe;
}

/** POST /cart/add  (JSON: { cardId, vendorId, price, qty, meta? }) */
async function add(req, res) {
  try {
    const { cardId, vendorId, price, qty, meta, listingId } = req.body || {};
    const q = Number(qty);
    const p = Number(price);

    if (!cardId || !vendorId || !Number.isFinite(p) || !Number.isFinite(q) || q < 1) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }

    // --- NOVA VALIDAÇÃO ---
    // Verifica se o vendedor realmente existe antes de adicionar ao carrinho
    const seller = await User.findById(vendorId);
    if (!seller) {
      return res.status(404).json({ error: 'Vendedor não encontrado. O anúncio pode ter sido removido.' });
    }
    // --- FIM DA VALIDAÇÃO ---

    const cart = getCart(req);
    const key = `${cardId}:${vendorId}`;

    let found = cart.items.find(i => i.key === key);
    if (!found) {
      found = {
        key,
        cardId,
        vendorId,
        listingId, // Adicionado para referência futura
        price: p,
        qty: 0,
        meta: normalizeMeta(meta, { cardId, vendorId })
      };
      cart.items.push(found);
    } else {
      if (Number.isFinite(p)) found.price = p;
      found.meta = normalizeMeta({ ...(found.meta || {}), ...(meta || {}) }, { cardId, vendorId });
    }

    found.qty = Math.min(999, found.qty + q);
    recompute(cart);

    return res.json({ ok: true, count: cart.totalQty, total: cart.totalPrice });
  } catch (err) {
    console.error('cartController.add error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

/** POST /cart/update  (JSON: { key, qty }) */
async function update(req, res) {
  try {
    const { key, qty } = req.body || {};
    const q = Number(qty);
    if (!key || !Number.isFinite(q) || q < 1) {
      return res.status(400).json({ error: 'Dados inválidos' });
    }
    const cart = getCart(req);
    const it = cart.items.find(i => i.key === key);
    if (!it) return res.status(404).json({ error: 'Item não encontrado' });

    it.qty = Math.min(999, q);
    recompute(cart);
    return res.json({ ok: true, count: cart.totalQty, total: cart.totalPrice });
  } catch (err) {
    console.error('cartController.update error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

/** POST /cart/remove  (JSON: { key }) */
async function remove(req, res) {
  try {
    const { key } = req.body || {};
    const cart = getCart(req);
    const before = cart.items.length;
    cart.items = cart.items.filter(i => i.key !== key);
    if (cart.items.length !== before) recompute(cart);
    return res.json({ ok: true, count: cart.totalQty, total: cart.totalPrice });
  } catch (err) {
    console.error('cartController.remove error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

/** POST /cart/clear */
async function clear(req, res) {
  try {
    req.session.cart = { items: [], totalQty: 0, totalPrice: 0 };
    return res.json({ ok: true, count: 0, total: 0 });
  } catch (err) {
    console.error('cartController.clear error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

/**
 * GET /cart → renderiza a página se existir; se não, devolve JSON
 * Dica: se você não tem views/cart.ejs, prefira usar apenas /cart/json no modal
 */
async function show(req, res) {
  try {
    const cart = getCart(req);
    return res.render('pages/cart', { cart });
  } catch (err) {
    // fallback em JSON caso a view não exista para não quebrar
    return res.json(getCart(req));
  }
}

/** GET /cart/json → resposta limpa pro modal do front */
async function json(req, res) {
  try {
    const cart = getCart(req);

    // Garante que todos os itens têm meta normalizada (evita undefined no front)
    cart.items = cart.items.map(it => ({
      ...it,
      meta: normalizeMeta(it.meta, { cardId: it.cardId, vendorId: it.vendorId })
    }));

    // recompute por segurança (se algo mudou)
    recompute(cart);

    return res.json(cart);
  } catch (err) {
    console.error('cartController.json error:', err);
    return res.status(500).json({ error: 'Erro interno' });
  }
}

module.exports = {
  add,
  update,
  remove,
  clear,
  show,
  json,
};
