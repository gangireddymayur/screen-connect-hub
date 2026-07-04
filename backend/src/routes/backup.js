const express = require('express');
const router = express.Router();
const db = require('../lib/db');
const { v4: uuid } = require('uuid');

async function download(req, res) {
  const companyId = req.user.company_id;

  try {
    const [company] = await db.query(
      "SELECT name, timezone, logo_url, show_brand_header FROM companies WHERE id = ? LIMIT 1",
      [companyId]
    );

    const [layouts] = await db.query(
      "SELECT id, name, layout_data, background_color FROM layouts WHERE company_id = ?",
      [companyId]
    );

    const [content] = await db.query(
      "SELECT id, name, file_url AS url, type, file_size AS size_bytes, duration AS duration_seconds FROM content WHERE company_id = ?",
      [companyId]
    );

    const [devices] = await db.query(
      "SELECT id, name, location, status, layout_id, schedules_enabled FROM devices WHERE company_id = ?",
      [companyId]
    );

    const [schedules] = await db.query(
      "SELECT id, device_id, layout_id, start_time, end_time, start_date FROM schedules WHERE company_id = ?",
      [companyId]
    );

    const scheduleIds = schedules.map(s => s.id);
    let recurrences = [];
    let instances = [];
    
    if (scheduleIds.length > 0) {
      const [recRows] = await db.query(
        "SELECT schedule_id, repeat_mode, repeat_interval, days_count FROM schedule_recurrences WHERE schedule_id IN (?)",
        [scheduleIds]
      );
      recurrences = recRows;

      const [instRows] = await db.query(
        "SELECT schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime FROM schedule_instances WHERE schedule_id IN (?)",
        [scheduleIds]
      );
      instances = instRows;
    }

    res.json({
      version: 1,
      company: company[0] || null,
      layouts,
      content,
      devices,
      schedules,
      recurrences,
      instances
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function restore(req, res) {
  const companyId = req.user.company_id;
  const {
    company,
    layouts = [],
    content = [],
    devices = [],
    schedules = [],
    recurrences = [],
    instances = []
  } = req.body || {};

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Restore Company Settings
    if (company) {
      await conn.query(
        `UPDATE companies SET name = ?, timezone = ?, logo_url = ?, show_brand_header = ? WHERE id = ?`,
        [company.name, company.timezone || "UTC", company.logo_url, company.show_brand_header || 0, companyId]
      );
    }

    // 2. Restore Layouts (Templates) and map UUIDs
    const layoutIdMap = {}; // oldLayoutId -> newLayoutId
    for (const l of layouts) {
      const newLayoutId = uuid();
      await conn.query(
        "INSERT INTO layouts (id, name, layout_data, background_color, company_id) VALUES (?, ?, ?, ?, ?)",
        [
          newLayoutId,
          l.name,
          typeof l.layout_data === 'object' ? JSON.stringify(l.layout_data) : l.layout_data,
          l.background_color || "#1a1a2e",
          companyId
        ]
      );
      layoutIdMap[l.id] = newLayoutId;
    }

    // 3. Restore Content and map UUIDs
    const contentIdMap = {}; // oldContentId -> newContentId
    for (const c of content) {
      const newContentId = uuid();
      await conn.query(
        "INSERT INTO content (id, name, file_url, type, file_size, duration, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [newContentId, c.name, c.url, c.type, c.size_bytes || 0, c.duration_seconds || 10, companyId]
      );
      contentIdMap[c.id] = newContentId;
    }

    // 4. Restore Devices and map UUIDs
    const deviceIdMap = {}; // oldDeviceId -> newDeviceId
    for (const d of devices) {
      const newDeviceId = uuid();
      const mappedLayoutId = d.layout_id ? (layoutIdMap[d.layout_id] || null) : null;
      await conn.query(
        "INSERT INTO devices (id, name, location, status, layout_id, schedules_enabled, company_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          newDeviceId,
          d.name,
          d.location || null,
          d.status || "offline",
          mappedLayoutId,
          d.schedules_enabled !== undefined ? (d.schedules_enabled ? 1 : 0) : 1,
          companyId
        ]
      );
      deviceIdMap[d.id] = newDeviceId;
    }

    // 5. Restore Schedules and map Auto-Increment IDs
    const scheduleIdMap = {}; // oldScheduleId -> newScheduleId
    for (const s of schedules) {
      const newDevId = deviceIdMap[s.device_id];
      const newLayoutId = layoutIdMap[s.layout_id];
      if (!newDevId || !newLayoutId) continue;

      const [r] = await conn.query(
        "INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date) VALUES (?, ?, ?, ?, ?, ?)",
        [newDevId, newLayoutId, companyId, s.start_time, s.end_time, s.start_date]
      );
      scheduleIdMap[s.id] = r.insertId;
    }

    // 6. Restore Recurrences
    for (const rec of recurrences) {
      const newSchId = scheduleIdMap[rec.schedule_id];
      if (!newSchId) continue;
      await conn.query(
        "INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count) VALUES (?, ?, ?, ?)",
        [newSchId, rec.repeat_mode || "none", rec.repeat_interval || 1, rec.days_count || 1]
      );
    }

    // 7. Restore Instances
    for (const inst of instances) {
      const newSchId = scheduleIdMap[inst.schedule_id];
      const newDevId = deviceIdMap[inst.device_id];
      const newLayoutId = layoutIdMap[inst.layout_id];
      if (!newSchId || !newDevId || !newLayoutId) continue;

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newSchId, newDevId, newLayoutId, inst.date, inst.start_time, inst.end_time, inst.start_datetime, inst.end_datetime]
      );
    }

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
}

module.exports = {
  download,
  restore
};
