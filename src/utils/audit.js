const AuditLog = require('../models/AuditLog');

const recordAuditLog = async ({ actor, targetUser = null, action, message, details = {} }) => {
  try {
    await AuditLog.create({ actor, targetUser, action, message, details });
  } catch (error) {
    console.error('Failed to record audit log:', error.message);
  }
};

module.exports = { recordAuditLog };
