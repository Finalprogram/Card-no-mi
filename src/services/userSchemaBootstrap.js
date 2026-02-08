const logger = require('../config/logger');
const { sequelize } = require('../database/connection');

async function ensureUserAccountTypes() {
  const enumName = 'enum_users_accountType';
  const values = ['store', 'partner_store'];
  for (const value of values) {
    try {
      await sequelize.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_type t
            JOIN pg_enum e ON t.oid = e.enumtypid
            WHERE t.typname = '${enumName}' AND e.enumlabel = '${value}'
          ) THEN
            ALTER TYPE "${enumName}" ADD VALUE '${value}';
          END IF;
        END $$;
      `);
    } catch (error) {
      const message = String(error?.message || '');
      logger.warn('[users] Failed to ensure accountType enum value', { value, message });
    }
  }
}

async function ensureUserColumns() {
  try {
    await sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_name = 'users' AND column_name = 'isCreator'
        ) THEN
          ALTER TABLE "users" ADD COLUMN "isCreator" BOOLEAN DEFAULT false;
        END IF;
      END $$;
    `);
  } catch (error) {
    const message = String(error?.message || '');
    logger.warn('[users] Failed to ensure users.isCreator column', { message });
  }
}

module.exports = { ensureUserAccountTypes, ensureUserColumns };
