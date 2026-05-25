const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const db = require('../lib/db');

const requireSuperAdmin = (req, res) => {
  if (req.user?.role !== 'super_admin') {
    res.status(403).json({ error: 'super_admin only' });
    return false;
  }
  return true;
};

const first = async (sql, params) => {
  const [rows] = await db.query(sql, params);
  return rows[0] || null;
};

async function createCompanyAdmin(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { name, contact_email, password, max_screens, plan = 'starter' } = req.body || {};
  if (!name || !contact_email || !password) {
    return res.status(400).json({ error: 'name, contact_email, and password are required' });
  }

  const existing = await first('SELECT id FROM users WHERE email = :email LIMIT 1', { email: contact_email });
  if (existing) return res.status(409).json({ error: 'A user with this email already exists' });

  const companyId = uuid();
  const userId = uuid();
  const roleId = uuid();
  const passwordHash = await bcrypt.hash(password, 10);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query(
      'INSERT INTO companies (id, name, contact_email, plan, max_screens, status, created_by) VALUES (:id, :name, :contact_email, :plan, :max_screens, :status, :created_by)',
      { id: companyId, name, contact_email, plan, max_screens: Number(max_screens || 10), status: 'active', created_by: req.user.id }
    );
    await conn.query(
      'INSERT INTO users (id, email, password_hash, full_name, company_id, is_active) VALUES (:id, :email, :password_hash, :full_name, :company_id, 1)',
      { id: userId, email: contact_email, password_hash: passwordHash, full_name: `${name} Admin`, company_id: companyId }
    );
    await conn.query(
      'INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, :role)',
      { id: roleId, user_id: userId, role: 'admin' }
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return res.json({
    company: { id: companyId, name, contact_email, plan, max_screens: Number(max_screens || 10), status: 'active' },
    admin_user_id: userId,
  });
}

async function deleteCompany(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { company_id } = req.body || {};
  if (!company_id) return res.status(400).json({ error: 'company_id is required' });

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [users] = await conn.query('SELECT id FROM users WHERE company_id = :company_id', { company_id });
    const userIds = users.map((u) => u.id);
    if (userIds.length) await conn.query('DELETE FROM user_roles WHERE user_id IN (:userIds)', { userIds });
    await conn.query('DELETE FROM schedules WHERE company_id = :company_id', { company_id });
    await conn.query('DELETE FROM content WHERE company_id = :company_id', { company_id });
    await conn.query('DELETE FROM layouts WHERE company_id = :company_id', { company_id });
    await conn.query('DELETE FROM devices WHERE company_id = :company_id', { company_id });
    await conn.query('DELETE FROM users WHERE company_id = :company_id', { company_id });
    await conn.query('DELETE FROM companies WHERE id = :company_id', { company_id });
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
  res.json({ success: true });
}

async function resetCompanyAdminPassword(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { company_id, new_password } = req.body || {};
  if (!company_id || !new_password) return res.status(400).json({ error: 'company_id and new_password are required' });
  const admin = await first(
    "SELECT u.id, u.email FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.company_id = :company_id AND r.role = 'admin' LIMIT 1",
    { company_id }
  );
  if (!admin) return res.status(404).json({ error: 'Company admin not found' });
  const passwordHash = await bcrypt.hash(new_password, 10);
  await db.query('UPDATE users SET password_hash = :password_hash WHERE id = :id', { password_hash: passwordHash, id: admin.id });
  res.json({ success: true, email: admin.email });
}

async function bulkCompanyAction(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { company_ids, action } = req.body || {};
  if (!Array.isArray(company_ids) || company_ids.length === 0) return res.status(400).json({ error: 'company_ids are required' });
  if (action === 'activate' || action === 'suspend') {
    const status = action === 'activate' ? 'active' : 'suspended';
    await db.query('UPDATE companies SET status = :status WHERE id IN (:company_ids)', { status, company_ids });
    return res.json({ success: true, updated: company_ids.length });
  }
  if (action === 'delete') {
    for (const company_id of company_ids) {
      req.body.company_id = company_id;
      await new Promise((resolve, reject) => {
        const fakeRes = { json: resolve, status: (code) => ({ json: (body) => reject(Object.assign(new Error(body.error), { status: code })) }) };
        deleteCompany(req, fakeRes).catch(reject);
      });
    }
    return res.json({ success: true, deleted: company_ids.length });
  }
  res.status(400).json({ error: 'Invalid action' });
}

async function toggleUserStatus(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { user_id, action } = req.body || {};
  if (!user_id || !['ban', 'unban'].includes(action)) return res.status(400).json({ error: 'user_id and valid action are required' });
  if (user_id === req.user.id) return res.status(400).json({ error: 'You cannot update your own status' });
  await db.query('UPDATE users SET is_active = :is_active WHERE id = :user_id', { is_active: action === 'ban' ? 0 : 1, user_id });
  res.json({ success: true });
}

async function getCompanyStats(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const { company_id } = req.body || {};
  if (!company_id) return res.status(400).json({ error: 'company_id is required' });
  const [[devices], [content], [layouts], [schedules], [admin], [activity]] = await Promise.all([
    db.query('SELECT COUNT(*) total, SUM(CASE WHEN is_paired = 1 THEN 1 ELSE 0 END) paired FROM devices WHERE company_id = :company_id', { company_id }),
    db.query('SELECT COUNT(*) total FROM content WHERE company_id = :company_id', { company_id }),
    db.query('SELECT COUNT(*) total FROM layouts WHERE company_id = :company_id', { company_id }),
    db.query('SELECT COUNT(*) total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) active FROM schedules WHERE company_id = :company_id', { company_id }),
    db.query("SELECT u.id, u.email FROM users u JOIN user_roles r ON r.user_id = u.id WHERE u.company_id = :company_id AND r.role = 'admin' LIMIT 1", { company_id }),
    db.query('SELECT MAX(last_seen_at) last_seen_at FROM devices WHERE company_id = :company_id', { company_id }),
  ]);
  res.json({
    devices_total: Number(devices[0]?.total || 0),
    devices_paired: Number(devices[0]?.paired || 0),
    content_total: Number(content[0]?.total || 0),
    layouts_total: Number(layouts[0]?.total || 0),
    schedules_total: Number(schedules[0]?.total || 0),
    schedules_active: Number(schedules[0]?.active || 0),
    last_device_activity: activity[0]?.last_seen_at || null,
    admin_last_sign_in: null,
    admin_email: admin[0]?.email || null,
    admin_id: admin[0]?.id || null,
  });
}

async function listAuthUsers(req, res) {
  if (!requireSuperAdmin(req, res)) return;
  const [rows] = await db.query('SELECT id, email, is_active, created_at FROM users ORDER BY created_at DESC');
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      banned_until: u.is_active ? null : '9999-12-31T00:00:00.000Z',
      created_at: u.created_at,
      last_sign_in_at: null,
      email_confirmed_at: u.created_at,
    })),
  });
}

async function claimTvCode(req, res) {
  const { code, name, location, orientation = 'landscape' } = req.body || {};
  const cleanCode = String(code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{6}$/.test(cleanCode)) return res.status(400).json({ error: 'Invalid code format' });
  if (!name) return res.status(400).json({ error: 'Device name is required' });
  if (!req.user.company_id) return res.status(403).json({ error: 'Your account is not linked to a company' });

  const device = await first('SELECT id, is_paired FROM devices WHERE pairing_code = :code LIMIT 1', { code: cleanCode });
  if (!device) return res.status(404).json({ error: 'Code not found. Make sure your TV is showing this code.' });
  if (device.is_paired) return res.status(409).json({ error: 'This code has already been used' });

  await db.query(
    'UPDATE devices SET company_id = :company_id, name = :name, location = :location, orientation = :orientation, is_paired = 1, pairing_code = NULL, status = :status, last_seen_at = NOW() WHERE id = :id',
    { company_id: req.user.company_id, name, location: location || null, orientation, status: 'online', id: device.id }
  );
  const updated = await first('SELECT * FROM devices WHERE id = :id', { id: device.id });
  res.json({ device: updated });
}

const handlers = {
  'create-company-admin': createCompanyAdmin,
  'delete-company': deleteCompany,
  'reset-company-admin-password': resetCompanyAdminPassword,
  'bulk-company-action': bulkCompanyAction,
  'toggle-user-status': toggleUserStatus,
  'get-company-stats': getCompanyStats,
  'list-auth-users': listAuthUsers,
  'claim-tv-code': claimTvCode,
};

router.post('/:name', async (req, res) => {
  try {
    const handler = handlers[req.params.name];
    if (!handler) return res.status(404).json({ error: `Function "${req.params.name}" is not available on this backend.` });
    await handler(req, res);
  } catch (err) {
    console.error('FUNCTION_ERROR:', req.params.name, err.stack || err);
    res.status(err.status || 500).json({ error: err.message || 'Function failed' });
  }
});

module.exports = router;
