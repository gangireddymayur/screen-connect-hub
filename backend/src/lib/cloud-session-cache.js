// Ephemeral credentials used only for an explicit cloud entitlement refresh.
// Nothing is written to SQLite or disk; restarting the Windows server clears it.
const localLoginPasswords = new Map();

function rememberLocalLoginPassword(userId, password) {
  if (userId && password) localLoginPasswords.set(String(userId), String(password));
}

function getLocalLoginPassword(userId) {
  return userId ? localLoginPasswords.get(String(userId)) || null : null;
}

module.exports = { rememberLocalLoginPassword, getLocalLoginPassword };
