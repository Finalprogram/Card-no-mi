require('dotenv').config();
const fs = require('fs');
const path = require('path');
const Card = require('../src/models/Card');
const { sequelize } = require('../src/database/connection');

function toInt(value) {
  const n = parseInt(value, 10);
  return Number.isFinite(n) ? n : null;
}

function normalizeColors(value) {
  if (!value) return [];
  return String(value)
    .split('/')
    .map(part => part.trim())
    .filter(Boolean);
}



function isPlainCodeImage(url, code) {
  if (!url || !code) return false;
  const normalized = String(url).split('?')[0].toLowerCase();
  return normalized.endsWith(`/${String(code).toLowerCase()}.png`);
}

function normalizeImageUrl(url) {
  if (!url) return null;
  return String(url).split('?')[0].toLowerCase();
}

function inferVariantFromImageUrl(imageUrl) {
  if (!imageUrl) return null;
  const lower = String(imageUrl).toLowerCase();
  const match = lower.match(/_(p|r)(\d+)\.png/);
  if (!match) return null;
  const family = match[1];
  const index = Number(match[2]);
  const suffix = `_${family}${index}`;
  switch (suffix) {
    case '_p1':
      return { variant: 1, label: 'parallel / AA', suffix };
    case '_r1':
      return { variant: 1, label: 'parallel / AA', suffix };
    case '_r2':
      return { variant: 2, label: 'alternate art especial', suffix };
    case '_p2':
      return { variant: 3, label: 'reprint ou varia??o', suffix };
    default:
      // Preserve unknown suffixes (e.g. _p3, _r3) as unique variants.
      // This avoids collisions on api_id when JSON ships Variante=0 for alternate prints.
      return {
        variant: family === 'p' ? (10 + index) : (20 + index),
        label: `variante ${suffix}`,
        suffix
      };
  }
}

function mapCard(raw) {
  const code = raw.Codigo || raw.Código || raw.code || null;
  const imageUrl = raw.Imagem_URL || raw.image_url || null;
  const variantInfo = inferVariantFromImageUrl(imageUrl);
  const jsonVariant = raw.Variante ?? raw.variante ?? raw.variant;
  const parsedJsonVariant = jsonVariant != null && jsonVariant !== '' ? Number(jsonVariant) : null;
  let variant = parsedJsonVariant != null && Number.isFinite(parsedJsonVariant)
    ? parsedJsonVariant
    : (variantInfo ? variantInfo.variant : 0);

  // Regra de base: somente "variant=0" + imagem plain "<code>.png" e sem sufixo.
  // Se vier variant=0 em URL com sufixo (_p1/_p2/_r1/_r2...), forca variante do sufixo.
  if (variant === 0 && variantInfo && !isPlainCodeImage(imageUrl, code)) {
    variant = variantInfo.variant;
  }
  const name = raw.Nome || raw.name || null;
  const edition = raw.Edicao || raw.Edicao_Set || raw.set_name || raw.Card_Set || null;
  const type = raw.Tipo || raw.type || null;
  const rarity = raw.Raridade || raw.rarity || null;
  const apiId = code ? `${code}::${variant}` : null;

  return {
    api_id: apiId,
    code: code || null,
    variant,
    name,
    set_name: edition,
    rarity,
    type: type || null,
    type_line: type || null,
    game: 'onepiece',
    cost: toInt(raw.Cost),
    power: toInt(raw.Power),
    counter: raw.Counter && raw.Counter !== '-' ? String(raw.Counter) : null,
    color: raw.Color || null,
    colors: normalizeColors(raw.Color),
    family: raw.Type_Card || null,
    ability: raw.Effect || null,
    trigger: raw.Trigger || null,
    image_url: imageUrl,
    images: {
      url: imageUrl || null,
      file: raw.Imagem_Arquivo || null,
      variant: variantInfo ? variantInfo.label : null,
      suffix: variantInfo ? variantInfo.suffix : null
    },
    attribute: {
      value: raw.Attribute || null
    },
    set: {
      value: raw.Card_Set || null
    }
  };
}

function loadJsonFromFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed : [parsed];
}

async function importCardsFromPath(targetPath) {
  const stat = fs.statSync(targetPath);
  const files = [];

  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(targetPath)) {
      if (entry.toLowerCase().endsWith('.json')) {
        files.push(path.join(targetPath, entry));
      }
    }
  } else {
    files.push(targetPath);
  }

  const records = [];
  const dedupe = new Set();

  for (const file of files) {
    const items = loadJsonFromFile(file);
    for (const item of items) {
      const code = item.Codigo || item['Código'] || item.code || '';
      const imageUrl = item.Imagem_URL || item.image_url || null;
      const normalizedUrl = normalizeImageUrl(imageUrl) || '';
      const key = `${code}::${normalizedUrl}`;
      if (dedupe.has(key)) continue;
      dedupe.add(key);

      const mapped = mapCard(item);
      records.push(mapped);
    }
  }

  let created = 0;
  let updated = 0;

  for (const record of records) {
    if (!record.code || !record.name) continue;
    const existing = await Card.findOne({ where: { api_id: record.api_id } });
    if (existing) {
      await existing.update(record);
      updated += 1;
    } else {
      await Card.create(record);
      created += 1;
    }
  }

  return { created, updated, total: records.length };
}

async function main() {
  try {
    const argPath = process.argv[2] || path.join('imgs one piece', 'json', 'cartas_TODAS.json');
    const resolved = path.isAbsolute(argPath) ? argPath : path.join(process.cwd(), argPath);
    await sequelize.authenticate();
    const result = await importCardsFromPath(resolved);
    console.log(`Importacao concluida. Total: ${result.total} | Criadas: ${result.created} | Atualizadas: ${result.updated}`);
  } catch (error) {
    console.error('Erro ao importar cartas:', error);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

main();
