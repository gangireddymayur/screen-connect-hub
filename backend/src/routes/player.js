const router = require('express').Router();
const db = require('../lib/db');

const parseJson = (value, fallback = null) => {
  if (!value) return fallback;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return fallback; }
};

const normalizeLayout = (row) => row ? ({
  id: row.id,
  company_id: row.company_id,
  name: row.name,
  description: row.description,
  resolution_width: row.resolution_width,
  resolution_height: row.resolution_height,
  background_color: row.background_color,
  layout_data: parseJson(row.layout_data, null),
  updated_at: row.updated_at,
}) : null;

router.get('/:deviceId', async (req, res) => {
  try {
    const [devices] = await db.query(
      'SELECT * FROM devices WHERE id = :id AND is_paired = 1 LIMIT 1',
      { id: req.params.deviceId }
    );
    const device = devices[0];
    if (!device) return res.status(404).json({ error: 'Device not found or not paired' });

    await db.query(
      'UPDATE devices SET last_seen_at = NOW(), status = :status WHERE id = :id',
      { status: 'online', id: device.id }
    );

    const now = new Date();
    const day = now.getDay();
    const time = now.toTimeString().slice(0, 8);

    const schedulesEnabled = device.schedules_enabled ?? 1;
    let scheduledLayouts = [];

    if (schedulesEnabled) {
      const [rows] = await db.query(
        `SELECT l.*
         FROM schedules s
         JOIN layouts l ON l.id = s.layout_id
         WHERE s.device_id = :device_id
           AND s.company_id = :company_id
           AND s.is_active = 1
           AND FIND_IN_SET(:day, s.days_of_week)
           AND s.start_time <= :time
           AND s.end_time >= :time
         ORDER BY s.start_time DESC
         LIMIT 1`,
        { device_id: device.id, company_id: device.company_id, day, time }
      );
      scheduledLayouts = rows;
    }

    let layout = normalizeLayout(scheduledLayouts[0]);
    let source = 'schedule';

    if (!layout && device.layout_id) {
      const [layouts] = await db.query(
        'SELECT * FROM layouts WHERE id = :id AND company_id = :company_id LIMIT 1',
        { id: device.layout_id, company_id: device.company_id }
      );
      layout = normalizeLayout(layouts[0]);
      source = 'device';
    }

    res.json({
      device: {
        id: device.id,
        name: device.name,
        location: device.location,
        orientation: device.orientation,
        resolution: device.resolution,
        company_id: device.company_id,
      },
      source,
      layout,
    });
  } catch (err) {
    console.error('PLAYER_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'Player feed failed' });
  }
});

module.exports = router;
