function estimatePackageDims(items) {
  const qty = (items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
  const pesoKg = Math.max(0.06, qty * 0.01); // 10g por carta + 60g embalagem
  let dims = { comprimentoCm: 16, larguraCm: 12, alturaCm: 4, pesoKg };
  if (qty > 20) dims = { comprimentoCm: 20, larguraCm: 16, alturaCm: 8, pesoKg: pesoKg + 0.06 };
  return dims;
}
module.exports = { estimatePackageDims };
