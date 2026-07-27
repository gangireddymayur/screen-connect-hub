const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';

function sign(payload) {
  return jwt.sign(payload, SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    req.user = jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'invalid token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'forbidden' });
    }
    next();
  };
}

async function requireTrialNotExpired(req, res, next) {
  if (!req.user || req.user.role === 'super_admin' || req.user.role === 'super') return next();
  
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    try {
      const db = require('./db');
      const companyId = req.user.company_id;
      if (companyId) {
        const [rows] = await db.query(
          'SELECT subscription_status, trial_ends_at, created_at FROM companies WHERE id = :cid LIMIT 1',
          { cid: companyId }
        );
        if (rows && rows[0]) {
          const comp = rows[0];
          if (comp.subscription_status === 'expired') {
            return res.status(403).json({
              error: 'Trial Expired',
              message: 'Your 7-day free trial has expired. Contact your administrator to upgrade your plan.'
            });
          }
          if (comp.subscription_status !== 'active') {
            const trialEnd = comp.trial_ends_at
              ? new Date(comp.trial_ends_at)
              : comp.created_at
                ? new Date(new Date(comp.created_at).getTime() + 7 * 24 * 60 * 60 * 1000)
                : null;
            if (trialEnd && new Date() > trialEnd) {
              return res.status(403).json({
                error: 'Trial Expired',
                message: 'Your 7-day free trial has expired. Contact your administrator to upgrade your plan.'
              });
            }
          }
        }
      }
    } catch (e) {
      console.error('[auth] requireTrialNotExpired error:', e);
    }
  }
  next();
}

module.exports = { sign, authRequired, requireRole, requireTrialNotExpired };
