// Generic CRUD factory used for companies/devices/layouts/content/schedules.
// Scopes tenant tables by company_id automatically when the user is an admin.
const { v4: uuid } = require('uuid');

function normalizePayload(table, input = {}) {
  const payload = { ...input };

  if (table === 'layouts') {
    payload.layout_data ??= JSON.stringify({ id: 'root', split: 'none', splitRatio: 50, content: null, children: null });
    if (typeof payload.layout_data !== 'string') payload.layout_data = JSON.stringify(payload.layout_data);
    payload.background_color ??= '#1a1a2e';
  }

  if (table === 'schedules' && Array.isArray(payload.days_of_week)) {
    payload.days_of_week = payload.days_of_week.join(',');
  }

  if (table === 'devices') {
    if (typeof payload.is_paired === 'boolean') payload.is_paired = payload.is_paired ? 1 : 0;
    if (typeof payload.schedules_enabled === 'boolean') payload.schedules_enabled = payload.schedules_enabled ? 1 : 0;
    if (typeof payload.is_paused === 'boolean') payload.is_paused = payload.is_paused ? 1 : 0;
  }

  if (table === 'companies' && typeof payload.max_screens === 'string') {
    payload.max_screens = Number(payload.max_screens);
  }

  return payload;
}

function normalizeRow(table, row) {
  if (!row) return row;
  const out = { ...row };
  if (table === 'layouts' && typeof out.layout_data === 'string') {
    try { out.layout_data = JSON.parse(out.layout_data); } catch { }
  }
  if (table === 'schedules' && typeof out.days_of_week === 'string') {
    out.days_of_week = out.days_of_week.split(',').filter(Boolean).map(Number);
  }
  if (table === 'devices') {
    out.is_paired = !!out.is_paired;
    out.schedules_enabled = out.schedules_enabled !== 0 ? 1 : 0;
    out.is_paused = out.is_paused !== 0 ? 1 : 0;
  }
  if (table === 'schedules') {
    out.is_active = !!out.is_active;
  }
  if (table === 'users') {
    out.is_active = !!out.is_active;
    delete out.password_hash;
  }
  return out;
}

function crud(table, { tenantScoped = true, superAdminOnly = false } = {}) {
  const router = require('express').Router();

  const requireAllowed = (req, res) => {
    if (superAdminOnly && req.user.role !== 'super_admin') {
      res.status(403).json({ error: 'super_admin only' });
      return false;
    }
    return true;
  };

  const scope = (req, prefix = '') => {
    if (!tenantScoped) return { clause: '', params: {} };
    if (req.user.role === 'super_admin') return { clause: '', params: {} };
    const column = table === 'companies' ? 'id' : 'company_id';
    return { clause: ` ${prefix}${column} = :cid `, params: { cid: req.user.company_id } };
  };

  router.get('/', async (req, res) => {
    try {
      if (!requireAllowed(req, res)) return;
      const { clause, params } = scope(req, 'WHERE ');
      const db = require('../lib/db');
      const [rows] = await db.query(`SELECT * FROM \`${table}\`${clause} ORDER BY created_at DESC`, params);
      res.json(rows.map((r) => normalizeRow(table, r)));
    } catch (err) {
      console.error(`CRUD_GET_${table.toUpperCase()}_ERROR:`, err);
      res.status(500).json({ error: err.message || 'Failed to fetch items' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      if (!requireAllowed(req, res)) return;
      const db = require('../lib/db');
      const scoped = scope(req, 'AND ');
      const [rows] = await db.query(`SELECT * FROM \`${table}\` WHERE id = :id${scoped.clause} LIMIT 1`, { id: req.params.id, ...scoped.params });
      if (!rows[0]) return res.status(404).json({ error: 'not found' });
      res.json(normalizeRow(table, rows[0]));
    } catch (err) {
      console.error(`CRUD_GET_BY_ID_${table.toUpperCase()}_ERROR:`, err);
      res.status(500).json({ error: err.message || 'Failed to fetch item' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      if (!requireAllowed(req, res)) return;
      const db = require('../lib/db');
      const id = req.body.id || uuid();
      const payload = normalizePayload(table, { ...req.body, id });

      // Let MariaDB manage timestamp columns with DEFAULT / ON UPDATE.
      // Browser ISO strings can break MariaDB DATETIME inserts/updates.
      delete payload.created_at;
      delete payload.updated_at;

      if (tenantScoped && req.user.role !== 'super_admin') payload.company_id = req.user.company_id;
      const cols = Object.keys(payload);
      const placeholders = cols.map((c) => `:${c}`).join(',');
      await db.query(
        `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
        payload
      );
      const [rows] = await db.query(`SELECT * FROM \`${table}\` WHERE id = :id LIMIT 1`, { id });
      res.json(normalizeRow(table, rows[0] || { id }));
    } catch (err) {
      console.error(`CRUD_CREATE_${table.toUpperCase()}_ERROR:`, err);
      res.status(500).json({ error: err.message || 'Failed to create item' });
    }
  });

  router.patch('/:id', async (req, res) => {
    try {
      if (!requireAllowed(req, res)) return;
      const db = require('../lib/db');
      const payload = normalizePayload(table, req.body);

      // Do not allow frontend payloads to overwrite DB-managed timestamps.
      delete payload.created_at;
      delete payload.updated_at;

      const cols = Object.keys(payload);
      if (!cols.length) return res.json({ ok: true });
      const sets = cols.map((c) => `\`${c}\` = :${c}`).join(',');
      const scoped = scope(req, 'AND ');
      const [result] = await db.query(`UPDATE \`${table}\` SET ${sets} WHERE id = :id${scoped.clause}`, { ...payload, id: req.params.id, ...scoped.params });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'not found or not allowed' });
      res.json({ ok: true, affectedRows: result.affectedRows, changedRows: result.changedRows });
    } catch (err) {
      console.error(`CRUD_UPDATE_${table.toUpperCase()}_ERROR:`, err);
      res.status(500).json({ error: err.message || 'Failed to update item' });
    }
  });

  router.delete('/:id', async (req, res) => {
    try {
      if (!requireAllowed(req, res)) return;
      const db = require('../lib/db');
      const scoped = scope(req, 'AND ');
      await db.query(`DELETE FROM \`${table}\` WHERE id = :id${scoped.clause}`, { id: req.params.id, ...scoped.params });
      res.json({ ok: true });
    } catch (err) {
      console.error(`CRUD_DELETE_${table.toUpperCase()}_ERROR:`, err);
      res.status(500).json({ error: err.message || 'Failed to delete item' });
    }
  });

  return router;
}

module.exports = crud;

