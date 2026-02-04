const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env') });
const Card = require('../src/models/Card');
const { sequelize } = require('../src/database/connection');

function normalizeImageUrl(url) {
  if (!url) return null;
  return String(url).split('?')[0].toLowerCase();
}

function extractSuffix(url) {
  if (!url) return null;
  const match = String(url).toLowerCase().match(/(_p1|_p2|_r1|_r2)\.png/);
  return match ? match[1] : null;
}

function isPlainCodeImage(url, code) {
  if (!url || !code) return false;
  const normalized = normalizeImageUrl(url);
  return normalized && normalized.endsWith(`/${String(code).toLowerCase()}.png`);
}

async function main() {
  await sequelize.authenticate();

  const cards = await Card.findAll({ order: [['id', 'ASC']] });
  const byCode = new Map();
  let updated = 0;
  let deleted = 0;

  for (const card of cards) {
    if (!card.code) continue;
    const key = String(card.code);
    if (!byCode.has(key)) byCode.set(key, []);
    byCode.get(key).push(card);
  }

  // Remove duplicates: same code + same normalized image_url.
  const refreshed = await Card.findAll({ order: [['id', 'ASC']] });
  const seen = new Map();

  for (const card of refreshed) {
    if (!card.code) continue;
    const key = `${card.code}::${normalizeImageUrl(card.image_url)}`;
    if (!seen.has(key)) {
      seen.set(key, card);
      continue;
    }

    const keep = seen.get(key);
    if (keep.id <= card.id) {
      await card.destroy();
      deleted += 1;
    } else {
      await keep.destroy();
      seen.set(key, card);
      deleted += 1;
    }
  }

  console.log(`Dedupe concluido. Atualizadas: ${updated} | Removidas: ${deleted}`);
}

main()
  .catch((error) => {
    console.error('Erro no dedupe:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
