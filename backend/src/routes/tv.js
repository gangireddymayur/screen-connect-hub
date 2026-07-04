const router = require('express').Router();
const { v4: uuid } = require('uuid');
const db = require('../lib/db');

const UNPAIRED_COMPANY_ID = '00000000-0000-0000-0000-000000000000';
const PAIRING_EXPIRES_MINUTES = 15;

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const normalizeLayout = (row) => row ? ({
  id: row.id,
  company_id: row.company_id,
  name: row.name,
  resolution_width: row.resolution_width,
  resolution_height: row.resolution_height,
  background_color: row.background_color,
  layout_data: parseJson(row.layout_data, null),
  updated_at: row.updated_at,
}) : null;

function createCode() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i += 1) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

async function cleanupExpiredPendingDevices() {
  await db.query(
    `DELETE FROM devices
     WHERE is_paired = 0
       AND pairing_code IS NOT NULL
       AND created_at < DATE_SUB(NOW(), INTERVAL ${PAIRING_EXPIRES_MINUTES} MINUTE)`
  );
}

async function uniqueCode() {
  await cleanupExpiredPendingDevices();
  for (let i = 0; i < 10; i += 1) {
    const code = createCode();
    const [rows] = await db.query('SELECT id FROM devices WHERE pairing_code = :code LIMIT 1', { code });
    if (!rows[0]) return code;
  }
  throw new Error('Could not generate unique pairing code');
}

async function getActiveLayout(device) {
  const now = new Date();
  const y = now.getFullYear();
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  const da = String(now.getDate()).padStart(2, "0");
  const today = `${y}-${mo}-${da}`;
  const time = now.toTimeString().slice(0, 8);

  const schedulesEnabled = device.schedules_enabled ?? 1;
  let scheduledLayouts = [];

  if (schedulesEnabled) {
    const [rows] = await db.query(
      `SELECT l.*
       FROM schedule_instances i
       JOIN layouts l ON l.id = i.layout_id
       WHERE i.device_id = :device_id 
         AND i.date = :date 
         AND i.start_time <= :time 
         AND i.end_time > :time
       LIMIT 1`,
      { device_id: device.id, date: today, time }
    );
    scheduledLayouts = rows;
  }
  if (scheduledLayouts[0]) return normalizeLayout(scheduledLayouts[0]);

  if (!device.layout_id) return null;
  const [layouts] = await db.query(
    'SELECT * FROM layouts WHERE id = :id AND company_id = :company_id LIMIT 1',
    { id: device.layout_id, company_id: device.company_id }
  );
  return normalizeLayout(layouts[0]);
}

router.post('/generate-code', async (req, res) => {
  try {
    const id = uuid();
    const code = await uniqueCode();
    const resolution = req.body?.resolution || '1920x1080';
    const orientation = req.body?.orientation || 'landscape';
    await db.query(
      `INSERT INTO devices
       (id, company_id, name, status, layout_id, is_paired, pairing_code, orientation, resolution)
       VALUES
       (:id, :company_id, :name, :status, NULL, 0, :pairing_code, :orientation, :resolution)`,
      {
        id,
        company_id: UNPAIRED_COMPANY_ID,
        name: `Unpaired TV ${code}`,
        status: 'pending',
        pairing_code: code,
        orientation,
        resolution,
      }
    );
    res.json({
      device_id: id,
      pairing_code: code,
      code,
      expires_in_seconds: PAIRING_EXPIRES_MINUTES * 60,
    });
  } catch (err) {
    console.error('TV_GENERATE_CODE_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'Could not generate pairing code' });
  }
});

router.post('/poll-status', async (req, res) => {
  try {
    const { device_id } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });

    await cleanupExpiredPendingDevices();

    const [rows] = await db.query('SELECT * FROM devices WHERE id = :id LIMIT 1', { id: device_id });
    const device = rows[0];
    if (!device) return res.status(404).json({ error: 'Device not found or pairing expired', reset: true });

    if (!device.is_paired) {
      return res.json({
        device: {
          id: device.id,
          is_paired: false,
          name: device.name,
          layout_id: null,
          orientation: device.orientation,
          resolution: device.resolution,
          status: 'pending',
        },
        layout: null,
      });
    }

    await db.query(
      'UPDATE devices SET last_seen_at = NOW(), status = :status WHERE id = :id',
      { status: 'online', id: device.id }
    );
    const layout = device.is_paused === 1 ? null : await getActiveLayout(device);
    res.json({
      device: {
        id: device.id,
        is_paired: true,
        name: device.name,
        layout_id: device.layout_id,
        orientation: device.orientation,
        resolution: device.resolution,
        status: device.is_paused === 1 ? 'paused' : (layout ? 'playing' : 'waiting_for_layout'),
      },
      layout,
    });
  } catch (err) {
    console.error('TV_POLL_STATUS_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'Polling failed' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const { device_id } = req.body || {};
    if (!device_id) return res.status(400).json({ error: 'device_id is required' });
    const [devices] = await db.query('SELECT id FROM devices WHERE id = :id LIMIT 1', { id: device_id });
    if (!devices[0]) return res.json({ success: true, reset: true });
    await db.query('DELETE FROM schedules WHERE device_id = :device_id', { device_id });
    await db.query('DELETE FROM devices WHERE id = :id', { id: device_id });
    res.json({ success: true, reset: true });
  } catch (err) {
    console.error('TV_LOGOUT_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'TV logout failed' });
  }
});

module.exports = router;
