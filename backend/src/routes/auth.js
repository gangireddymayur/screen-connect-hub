const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { sign, authRequired } = require('../lib/auth');

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });

    const [rows] = await db.query(
      'SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, r.role ' +
      'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
      'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
      { email }
    );
    let user = rows[0];
    const isOffline = process.env.IS_OFFLINE === 'true';

    if (!user && isOffline) {
      console.log(`[local-auth] User ${email} not found locally. Attempting cloud fallback authentication...`);
      const cloudUrl = process.env.CLOUD_URL || 'https://agitated-satoshi.103-69-196-157.plesk.page';
      try {
        const loginRes = await fetch(`${cloudUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        if (loginRes.ok) {
          const loginData = await loginRes.json();
          const cloudToken = loginData.token;
          
          console.log(`[local-auth] Cloud login successful. Fetching cloud database backup segment...`);
          const backupRes = await fetch(`${cloudUrl}/api/backup`, {
            headers: { 'Authorization': `Bearer ${cloudToken}` }
          });
          if (backupRes.ok) {
            const backupPayload = await backupRes.json();
            const { restoreBackupPayload } = require('../lib/backup-helper');
            
            // Add the authenticated cloud user detail to the payload so it is seeded locally
            backupPayload.users = backupPayload.users || [];
            if (!backupPayload.users.some(u => u.email === email)) {
              const uId = loginData.user.id || require('uuid').v4();
              backupPayload.users.push({
                id: uId,
                email: loginData.user.email,
                full_name: loginData.user.full_name,
                password_hash: await bcrypt.hash(password, 10),
                company_id: loginData.user.company_id,
                role: loginData.user.role,
                is_active: 1
              });
            }

            console.log(`[local-auth] Restoring backup payload to local database...`);
            await restoreBackupPayload(backupPayload, db);
            
            // Re-query local database
            const [retryRows] = await db.query(
              'SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, r.role ' +
              'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
              'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
              { email }
            );
            user = retryRows[0];
          }
        }
      } catch (e) {
        console.error(`[local-auth] Cloud fallback auth error:`, e.message);
      }
    }

    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const token = sign({ id: user.id, email: user.email, role: user.role, company_id: user.company_id });
    res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, company_id: user.company_id },
    });
  } catch (err) {
    console.error('LOGIN_ERROR:', err.stack || err);
    res.status(500).json({ 
      error: 'Login failed. Check backend database connection and logs.',
      details: err.message,
      stack: err.stack
    });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

// PATCH /api/auth/password { password }
router.patch('/password', authRequired, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
    const password_hash = await bcrypt.hash(String(password), 10);
    await db.query('UPDATE users SET password_hash = :password_hash WHERE id = :id', { password_hash, id: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    console.error('PASSWORD_ERROR:', err.stack || err);
    res.status(500).json({ error: 'Password update failed' });
  }
});
module.exports = router;


