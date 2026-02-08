const AuditLog = require('../../models/AuditLog');

async function logAction({
  actorId,
  entityType,
  entityId,
  action,
  before = null,
  after = null,
  ip = null,
  userAgent = null
}) {
  return AuditLog.create({
    actorId,
    entityType,
    entityId: String(entityId),
    action,
    before,
    after,
    ip,
    userAgent
  });
}

module.exports = { logAction };

