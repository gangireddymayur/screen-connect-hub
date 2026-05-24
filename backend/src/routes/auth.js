const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { sign, authRequired } = require('../lib/auth');

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email & password required' });

  const [rows] = await db.query(
    'SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, r.role ' +
    'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
    'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
    { email }
  );
  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'invalid credentials' });

  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'invalid credentials' });

  const token = sign({ id: user.id, email: user.email, role: user.role, company_id: user.company_id });
  res.json({
    token,
    user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, company_id: user.company_id },
  });
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

module.exports = router;
