// Generic CRUD factory — used for companies/devices/layouts/content/schedules.
// Scopes by company_id automatically when the user is an "admin".
const { v4: uuid } = require('uuid');

function crud(table, { tenantScoped = true } = {}) {
  const router = require('express').Router();

  const scope = (req) => {
    if (!tenantScoped) return { where: '', params: {} };
    if (req.user.role === 'super_admin') return { where: '', params: {} };
    return { where: ' WHERE company_id = :cid ', params: { cid: req.user.company_id } };
  };

  router.get('/', async (req, res) => {
    const { where, params } = scope(req);
    const db = require('../lib/db');
    const [rows] = await db.query(`SELECT * FROM \`${table}\` ${where} ORDER BY created_at DESC`, params);
    res.json(rows);
  });

  router.get('/:id', async (req, res) => {
    const db = require('../lib/db');
    const [rows] = await db.query(`SELECT * FROM \`${table}\` WHERE id = :id LIMIT 1`, { id: req.params.id });
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  });

  router.post('/', async (req, res) => {
    const db = require('../lib/db');
    const id = req.body.id || uuid();
    const payload = { ...req.body, id };
    if (tenantScoped && req.user.role !== 'super_admin') payload.company_id = req.user.company_id;
    const cols = Object.keys(payload);
    const placeholders = cols.map((c) => `:${c}`).join(',');
    await db.query(
      `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(',')}) VALUES (${placeholders})`,
      payload
    );
    res.json({ id });
  });

  router.patch('/:id', async (req, res) => {
    const db = require('../lib/db');
    const cols = Object.keys(req.body);
    if (!cols.length) return res.json({ ok: true });
    const sets = cols.map((c) => `\`${c}\` = :${c}`).join(',');
    await db.query(`UPDATE \`${table}\` SET ${sets} WHERE id = :id`, { ...req.body, id: req.params.id });
    res.json({ ok: true });
  });

  router.delete('/:id', async (req, res) => {
    const db = require('../lib/db');
    await db.query(`DELETE FROM \`${table}\` WHERE id = :id`, { id: req.params.id });
    res.json({ ok: true });
  });

  return router;
}

module.exports = crud;
