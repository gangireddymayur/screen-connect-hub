const router = require('express').Router();
const db = require('../lib/db');

// Helper to generate instances for a schedule
function generateInstances(scheduleId, deviceId, layoutId, startTime, endTime, startDate, repeatMode, repeatInterval = 1, daysCount = 1) {
  const instances = [];
  
  let dateStrInput = "";
  if (startDate instanceof Date) {
    const y = startDate.getFullYear();
    const m = String(startDate.getMonth() + 1).padStart(2, "0");
    const day = String(startDate.getDate()).padStart(2, "0");
    dateStrInput = `${y}-${m}-${day}`;
  } else if (typeof startDate === "string") {
    dateStrInput = startDate.slice(0, 10);
  } else {
    dateStrInput = String(startDate || "").slice(0, 10);
  }

  const baseDate = new Date(dateStrInput + "T00:00:00");
  
  let count = 1;
  if (repeatMode === "daily" || repeatMode === "custom") {
    count = daysCount || 1;
  }

  const interval = repeatMode === "custom" ? (repeatInterval || 1) : 1;

  for (let i = 0; i < count; i++) {
    const curDate = new Date(baseDate.getTime());
    curDate.setDate(baseDate.getDate() + i * interval);
    
    const y = curDate.getFullYear();
    const m = String(curDate.getMonth() + 1).padStart(2, "0");
    const d = String(curDate.getDate()).padStart(2, "0");
    const dateStr = `${y}-${m}-${d}`;
    const startDatetimeStr = `${dateStr} ${startTime}`;
    const endDatetimeStr = `${dateStr} ${endTime}`;

    instances.push({
      schedule_id: scheduleId,
      device_id: deviceId,
      layout_id: layoutId,
      date: dateStr,
      start_time: startTime,
      end_time: endTime,
      start_datetime: startDatetimeStr,
      end_datetime: endDatetimeStr
    });
  }
  return instances;
}

// Helper to check overlaps in schedule_instances
async function checkOverlap(connection, deviceId, instances, ignoreScheduleId = null) {
  for (const inst of instances) {
    const query = ignoreScheduleId
      ? `SELECT i.id, l.name AS layout_name, DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
                TIME_FORMAT(i.start_time,'%H:%i') AS start_time, TIME_FORMAT(i.end_time,'%H:%i') AS end_time
         FROM schedule_instances i
         LEFT JOIN layouts l ON l.id = i.layout_id
         WHERE i.device_id = ? AND i.date = ? 
           AND i.start_time < ? AND i.end_time > ?
           AND i.schedule_id != ?
         LIMIT 1`
      : `SELECT i.id, l.name AS layout_name, DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
                TIME_FORMAT(i.start_time,'%H:%i') AS start_time, TIME_FORMAT(i.end_time,'%H:%i') AS end_time
         FROM schedule_instances i
         LEFT JOIN layouts l ON l.id = i.layout_id
         WHERE i.device_id = ? AND i.date = ? 
           AND i.start_time < ? AND i.end_time > ?
         LIMIT 1`;
    const params = ignoreScheduleId
      ? [deviceId, inst.date, inst.end_time, inst.start_time, ignoreScheduleId]
      : [deviceId, inst.date, inst.end_time, inst.start_time];
    const [rows] = await connection.query(query, params);
    if (rows.length > 0) {
      return {
        overlapping: true,
        date: inst.date,
        start_time: rows[0].start_time,
        end_time: rows[0].end_time,
        layout_name: rows[0].layout_name
      };
    }
  }
  return { overlapping: false };
}

// GET /api/schedules
router.get('/', async (req, res) => {
  try {
    const deviceId = req.query.device_id;
    const where = deviceId ? "WHERE s.device_id = ? AND s.company_id = ?" : "WHERE s.company_id = ?";
    const params = deviceId ? [deviceId, req.user.company_id] : [req.user.company_id];
    const [rows] = await db.query(
      `SELECT s.id, s.device_id, s.layout_id, s.company_id, l.name AS layout_name,
              TIME_FORMAT(s.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(s.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(s.start_date,'%Y-%m-%d') AS start_date,
              r.repeat_mode, r.repeat_interval, r.days_count
       FROM schedules s
       LEFT JOIN layouts l ON l.id = s.layout_id
       LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
       ${where}
       ORDER BY s.start_date, s.start_time`,
      params
    );
    res.json({ schedules: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/schedules/device/:deviceId
router.get('/device/:deviceId', async (req, res) => {
  try {
    const deviceId = req.params.deviceId;
    
    // Get schedules
    const [schedules] = await db.query(
      `SELECT s.id, s.device_id, s.layout_id, l.name AS layout_name,
              TIME_FORMAT(s.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(s.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(s.start_date,'%Y-%m-%d') AS start_date,
              r.repeat_mode, r.repeat_interval, r.days_count
       FROM schedules s
       LEFT JOIN layouts l ON l.id = s.layout_id
       LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
       WHERE s.device_id = ? AND s.company_id = ?`,
      [deviceId, req.user.company_id]
    );

    // Get instances
    const [instances] = await db.query(
      `SELECT i.id, i.schedule_id, i.device_id, i.layout_id, l.name AS layout_name,
              DATE_FORMAT(i.date,'%Y-%m-%d') AS date,
              TIME_FORMAT(i.start_time,'%H:%i') AS start_time,
              TIME_FORMAT(i.end_time,'%H:%i')   AS end_time,
              DATE_FORMAT(i.start_datetime,'%Y-%m-%d %H:%i:%s') AS start_datetime,
              DATE_FORMAT(i.end_datetime,'%Y-%m-%d %H:%i:%s')   AS end_datetime
       FROM schedule_instances i
       LEFT JOIN layouts l ON l.id = i.layout_id
       WHERE i.device_id = ?`,
      [deviceId]
    );

    res.json({ schedules, instances });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules
router.post('/', async (req, res) => {
  const {
    device_id,
    layout_id,
    start_time,
    end_time,
    start_date,
    repeat_mode = "none",
    repeat_interval = 1,
    days_count = 1
  } = req.body || {};

  if (!device_id || !layout_id || !start_time || !end_time || !start_date) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
  const formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

  const todayStr = new Date().toISOString().slice(0, 10);
  if (start_date < todayStr) {
    return res.status(400).json({ error: "You cannot schedule on past dates" });
  }

  if (formattedStartTime >= formattedEndTime) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Proposed instances
    const proposedInstances = generateInstances(
      0,
      device_id,
      layout_id,
      formattedStartTime,
      formattedEndTime,
      start_date,
      repeat_mode,
      Number(repeat_interval),
      Number(days_count)
    );

    // Check overlap
    const overlapResult = await checkOverlap(conn, device_id, proposedInstances);
    if (overlapResult.overlapping) {
      await conn.rollback();
      return res.status(400).json({
        error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.layout_name})`
      });
    }

    // Insert parent schedule
    const [scheduleRes] = await conn.query(
      `INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [device_id, layout_id, req.user.company_id, formattedStartTime, formattedEndTime, start_date]
    );
    const scheduleId = scheduleRes.insertId;

    // Insert recurrence configuration
    await conn.query(
      `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
       VALUES (?, ?, ?, ?)`,
       [scheduleId, repeat_mode, Number(repeat_interval), Number(days_count)]
    );

    // Save instances
    const instanceValues = proposedInstances.map((inst) => [
      scheduleId,
      inst.device_id,
      inst.layout_id,
      inst.date,
      inst.start_time,
      inst.end_time,
      inst.start_datetime,
      inst.end_datetime
    ]);

    await conn.query(
      `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
       VALUES ?`,
      [instanceValues]
    );

    await conn.commit();
    res.json({ ok: true, id: scheduleId, created_instances: instanceValues.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// PUT /api/schedules/:id
router.put('/:id', async (req, res) => {
  const scheduleId = Number(req.params.id);
  const {
    layout_id,
    start_time,
    end_time,
    start_date,
    repeat_mode,
    repeat_interval,
    days_count
  } = req.body || {};

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND company_id = ? LIMIT 1", [scheduleId, req.user.company_id]);
    if (curr.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Schedule not found" });
    }
    const s = curr[0];

    const deviceId = s.device_id;
    const tid = layout_id !== undefined ? layout_id : s.layout_id;
    const st = start_time !== undefined ? start_time : s.start_time;
    const et = end_time !== undefined ? end_time : s.end_time;
    const sd = start_date !== undefined ? start_date : s.start_date;

    const formattedStartTime = st.length === 5 ? `${st}:00` : st;
    const formattedEndTime = et.length === 5 ? `${et}:00` : et;

    if (formattedStartTime >= formattedEndTime) {
      await conn.rollback();
      return res.status(400).json({ error: "End time must be after start time" });
    }

    // Validate date is not in the past
    let dateStrInput = "";
    if (sd instanceof Date) {
      const y = sd.getFullYear();
      const m = String(sd.getMonth() + 1).padStart(2, "0");
      const day = String(sd.getDate()).padStart(2, "0");
      dateStrInput = `${y}-${m}-${day}`;
    } else if (typeof sd === "string") {
      dateStrInput = sd.slice(0, 10);
    } else {
      dateStrInput = String(sd || "").slice(0, 10);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStrInput < todayStr) {
      await conn.rollback();
      return res.status(400).json({ error: "You cannot schedule on past dates" });
    }

    const [currRec] = await conn.query("SELECT * FROM schedule_recurrences WHERE schedule_id = ? LIMIT 1", [scheduleId]);
    const rec = currRec[0] || {};
    const rm = repeat_mode !== undefined ? repeat_mode : (rec.repeat_mode || "none");
    const ri = repeat_interval !== undefined ? Number(repeat_interval) : (rec.repeat_interval || 1);
    const dc = days_count !== undefined ? Number(days_count) : (rec.days_count || 1);

    // Generate proposed instances
    const proposedInstances = generateInstances(
      scheduleId,
      deviceId,
      tid,
      formattedStartTime,
      formattedEndTime,
      sd,
      rm,
      ri,
      dc
    );

    // Check overlap
    const overlapResult = await checkOverlap(conn, deviceId, proposedInstances, scheduleId);
    if (overlapResult.overlapping) {
      await conn.rollback();
      return res.status(400).json({
        error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.layout_name})`
      });
    }

    // Update schedule metadata
    await conn.query(
      `UPDATE schedules SET layout_id = ?, start_time = ?, end_time = ?, start_date = ?
       WHERE id = ?`,
      [tid, formattedStartTime, formattedEndTime, sd, scheduleId]
    );

    // Update recurrence config
    await conn.query(
      `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE repeat_mode = VALUES(repeat_mode), repeat_interval = VALUES(repeat_interval), days_count = VALUES(days_count)`,
      [scheduleId, rm, ri, dc]
    );

    // Clear and regenerate instances
    await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ?", [scheduleId]);

    const instanceValues = proposedInstances.map((inst) => [
      scheduleId,
      inst.device_id,
      inst.layout_id,
      inst.date,
      inst.start_time,
      inst.end_time,
      inst.start_datetime,
      inst.end_datetime
    ]);

    await conn.query(
      `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
       VALUES ?`,
      [instanceValues]
    );

    await conn.commit();
    res.json({ ok: true, created_instances: instanceValues.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/schedules/exception
router.post('/exception', async (req, res) => {
  const { schedule_id, date, start_time, end_time, layout_id } = req.body || {};
  if (!schedule_id || !date || !start_time || !end_time || !layout_id) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const formattedStartTime = start_time.length === 5 ? `${start_time}:00` : start_time;
  const formattedEndTime = end_time.length === 5 ? `${end_time}:00` : end_time;

  if (formattedStartTime >= formattedEndTime) {
    return res.status(400).json({ error: "End time must be after start time" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND company_id = ? LIMIT 1", [schedule_id, req.user.company_id]);
    if (curr.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Schedule not found" });
    }
    const s = curr[0];

    // Find all other recurring schedules on this date for this device
    const [otherInstances] = await conn.query(
      `SELECT i.id as instance_id, i.schedule_id, i.layout_id, i.start_time, i.end_time 
       FROM schedule_instances i
       JOIN schedules sch ON sch.id = i.schedule_id
       JOIN schedule_recurrences r ON r.schedule_id = sch.id
       WHERE i.device_id = ? AND i.date = ? AND i.schedule_id != ? AND r.repeat_mode != 'none'`,
      [s.device_id, date, s.id]
    );

    // Convert all other recurring schedule occurrences on this day to standalone schedules
    for (const inst of otherInstances) {
      await conn.query("DELETE FROM schedule_instances WHERE id = ?", [inst.instance_id]);

      const [newS] = await conn.query(
        `INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [s.device_id, inst.layout_id, req.user.company_id, inst.start_time, inst.end_time, date]
      );

      await conn.query(
        `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
         VALUES (?, 'none', 1, 1)`,
        [newS.insertId]
      );

      await conn.query(
        `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [newS.insertId, s.device_id, inst.layout_id, date, inst.start_time, inst.end_time, `${date} ${inst.start_time}`, `${date} ${inst.end_time}`]
      );
    }

    // Proposed instances
    const proposedInstances = [{
      schedule_id: 0,
      device_id: s.device_id,
      layout_id: layout_id,
      date: date,
      start_time: formattedStartTime,
      end_time: formattedEndTime,
      start_datetime: `${date} ${formattedStartTime}`,
      end_datetime: `${date} ${formattedEndTime}`
    }];

    // Temporarily delete old instance to avoid overlap check self-conflict
    await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ? AND date = ?", [s.id, date]);

    // Check overlap
    const overlapResult = await checkOverlap(conn, s.device_id, proposedInstances);
    if (overlapResult.overlapping) {
      await conn.rollback();
      return res.status(400).json({
        error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.layout_name})`
      });
    }

    // Create new standalone schedule
    const [newScheduleRes] = await conn.query(
      `INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [s.device_id, layout_id, req.user.company_id, formattedStartTime, formattedEndTime, date]
    );
    const newScheduleId = newScheduleRes.insertId;

    await conn.query(
      `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
       VALUES (?, 'none', 1, 1)`,
      [newScheduleId]
    );

    await conn.query(
      `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [newScheduleId, s.device_id, layout_id, date, formattedStartTime, formattedEndTime, `${date} ${formattedStartTime}`, `${date} ${formattedEndTime}`]
    );

    await conn.commit();
    res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// DELETE /api/schedules/:id
router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { date } = req.query || {};

    const [curr] = await db.query("SELECT id FROM schedules WHERE id = ? AND company_id = ? LIMIT 1", [id, req.user.company_id]);
    if (curr.length === 0) {
      return res.status(404).json({ error: "Schedule not found" });
    }

    if (date) {
      // Delete only the single date occurrence instance
      await db.query("DELETE FROM schedule_instances WHERE schedule_id = ? AND date = ?", [id, date]);
    } else {
      // Cascade delete the entire parent schedule
      await db.query("DELETE FROM schedules WHERE id = ?", [id]);
    }
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules/repeat
router.post('/repeat', async (req, res) => {
  const { schedule_id, repeat_mode, repeat_interval = 1, days_count = 1, start_time, end_time, overwrite = false } = req.body || {};
  if (!schedule_id || !repeat_mode) {
    return res.status(400).json({ error: "schedule_id and repeat_mode required" });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [curr] = await conn.query("SELECT * FROM schedules WHERE id = ? AND company_id = ? LIMIT 1", [schedule_id, req.user.company_id]);
    if (curr.length === 0) {
      await conn.rollback();
      return res.status(404).json({ error: "Schedule not found" });
    }
    const s = curr[0];

    let st = s.start_time;
    let et = s.end_time;

    if (start_time && end_time) {
      st = start_time.length === 5 ? `${start_time}:00` : start_time;
      et = end_time.length === 5 ? `${end_time}:00` : end_time;
      if (st >= et) {
        await conn.rollback();
        return res.status(400).json({ error: "End time must be after start time" });
      }
      await conn.query("UPDATE schedules SET start_time = ?, end_time = ? WHERE id = ?", [st, et, schedule_id]);
    }

    // Validate date is not in the past
    let dateStrInput = "";
    const sd = s.start_date;
    if (sd instanceof Date) {
      const y = sd.getFullYear();
      const m = String(sd.getMonth() + 1).padStart(2, "0");
      const day = String(sd.getDate()).padStart(2, "0");
      dateStrInput = `${y}-${m}-${day}`;
    } else if (typeof sd === "string") {
      dateStrInput = sd.slice(0, 10);
    } else {
      dateStrInput = String(sd || "").slice(0, 10);
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (dateStrInput < todayStr) {
      await conn.rollback();
      return res.status(400).json({ error: "You cannot schedule on past dates" });
    }

    // Proposed instances
    const proposedInstances = generateInstances(
      s.id,
      s.device_id,
      s.layout_id,
      st,
      et,
      dateStrInput,
      repeat_mode,
      Number(repeat_interval),
      Number(days_count)
    );

    if (overwrite) {
      for (const inst of proposedInstances) {
        await conn.query(
          `DELETE FROM schedule_instances 
           WHERE device_id = ? AND date = ? AND schedule_id != ? AND start_time < ? AND end_time > ?`,
          [s.device_id, inst.date, s.id, inst.end_time, inst.start_time]
        );
      }
      await conn.query(
        `DELETE s FROM schedules s
         LEFT JOIN schedule_instances i ON i.schedule_id = s.id
         WHERE s.device_id = ? AND i.id IS NULL`,
        [s.device_id]
      );
    }

    // Check overlap
    const overlapResult = await checkOverlap(conn, s.device_id, proposedInstances, s.id);
    if (overlapResult.overlapping) {
      await conn.rollback();
      return res.json({
        ok: false,
        error: `Overlap detected on ${overlapResult.date} with existing schedule ${overlapResult.start_time} - ${overlapResult.end_time} (${overlapResult.layout_name})`,
        has_overlap: true
      });
    }

    // Update recurrence config
    await conn.query(
      `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE repeat_mode = VALUES(repeat_mode), repeat_interval = VALUES(repeat_interval), days_count = VALUES(days_count)`,
      [s.id, repeat_mode, Number(repeat_interval), Number(days_count)]
    );

    // Clear and regenerate instances
    await conn.query("DELETE FROM schedule_instances WHERE schedule_id = ?", [s.id]);

    const instanceValues = proposedInstances.map((inst) => [
      s.id,
      inst.device_id,
      inst.layout_id,
      inst.date,
      inst.start_time,
      inst.end_time,
      inst.start_datetime,
      inst.end_datetime
    ]);

    await conn.query(
      `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
       VALUES ?`,
      [instanceValues]
    );

    await conn.commit();
    res.json({ ok: true, created_instances: instanceValues.length });
  } catch (err) {
    await conn.rollback();
    res.status(500).json({ error: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/schedules/copy-day
router.post('/copy-day', async (req, res) => {
  const { device_id, source_date, target_dates = [], overwrite = false } = req.body || {};
  if (!device_id || !source_date || !Array.isArray(target_dates) || target_dates.length === 0)
    return res.status(400).json({ error: "device_id, source_date, target_dates[] required" });

  try {
    // Find all instances running on the source date
    const [src] = await db.query(
      `SELECT layout_id, start_time, end_time FROM schedule_instances
       WHERE device_id = ? AND date = ?`,
      [device_id, source_date]
    );

    if (src.length === 0) return res.json({ ok: true, created: 0 });

    // Check for existing schedules on target dates if overwrite is not approved yet
    if (!overwrite) {
      const [existing] = await db.query(
        `SELECT DISTINCT date FROM schedule_instances 
         WHERE device_id = ? AND date IN (?)`,
        [device_id, target_dates]
      );
      if (existing.length > 0) {
        return res.json({
          ok: false,
          has_existing: true,
          existing_dates: existing.map(row => {
            const d = new Date(row.date);
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const da = String(d.getDate()).padStart(2, "0");
            return `${y}-${m}-${da}`;
          })
        });
      }
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      if (overwrite) {
        // Delete all instances on target dates for this device
        await conn.query(
          `DELETE FROM schedule_instances WHERE device_id = ? AND date IN (?)`,
          [device_id, target_dates]
        );
        // Clean up empty schedules
        await conn.query(
          `DELETE s FROM schedules s
           LEFT JOIN schedule_instances i ON i.schedule_id = s.id
           WHERE s.device_id = ? AND i.id IS NULL`,
          [device_id]
        );
      }

      let createdCount = 0;
      for (const targetDate of target_dates) {
        for (const row of src) {
          // Create a new parent schedule for this target day
          const [scheduleRes] = await conn.query(
            `INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [device_id, row.layout_id, req.user.company_id, row.start_time, row.end_time, targetDate]
          );
          const scheduleId = scheduleRes.insertId;

          // Insert recurrence configuration
          await conn.query(
            `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
             VALUES (?, 'none', 1, 1)`,
             [scheduleId]
          );

          // Save instance
          const startDatetime = `${targetDate} ${row.start_time}`;
          const endDatetime = `${targetDate} ${row.end_time}`;
          await conn.query(
            `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [scheduleId, device_id, row.layout_id, targetDate, row.start_time, row.end_time, startDatetime, endDatetime]
          );

          createdCount++;
        }
      }

      await conn.commit();
      res.json({ ok: true, created: createdCount });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/schedules/copy-device
router.post('/copy-device', async (req, res) => {
  const { target_device_id, source_device_id, overwrite = false } = req.body || {};
  if (!target_device_id || !source_device_id) {
    return res.status(400).json({ error: "target_device_id and source_device_id required" });
  }

  try {
    // 1. Scope / Security checks: Ensure both devices belong to the user's company
    const [targetDevices] = await db.query(
      'SELECT id, company_id FROM devices WHERE id = ? AND company_id = ? LIMIT 1',
      [target_device_id, req.user.company_id]
    );
    const [sourceDevices] = await db.query(
      'SELECT id, company_id FROM devices WHERE id = ? AND company_id = ? LIMIT 1',
      [source_device_id, req.user.company_id]
    );

    if (targetDevices.length === 0 || sourceDevices.length === 0) {
      return res.status(404).json({ error: "One or both devices not found or not allowed" });
    }

    // Force Indian timezone
    const now = new Date();
    const today = now.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // "YYYY-MM-DD"

    // 2. Overwrite check: If overwrite is false, check if target has future instances
    if (!overwrite) {
      const [existing] = await db.query(
        `SELECT id FROM schedule_instances 
         WHERE device_id = ? AND date >= ? 
         LIMIT 1`,
        [target_device_id, today]
      );
      if (existing.length > 0) {
        return res.json({ ok: false, has_existing: true });
      }
    }

    // 3. Perform copy in a database transaction
    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Delete only future schedule instances of target device
      await conn.query(
        `DELETE FROM schedule_instances WHERE device_id = ? AND date >= ?`,
        [target_device_id, today]
      );

      // Clean up target device parent schedules that no longer have any instances (completely in future)
      await conn.query(
        `DELETE FROM schedules 
         WHERE device_id = ? 
           AND id NOT IN (SELECT DISTINCT schedule_id FROM schedule_instances WHERE device_id = ?)`,
        [target_device_id, target_device_id]
      );

      // Fetch all schedules and recurrences of source device
      const [srcSchedules] = await conn.query(
        `SELECT s.id, s.layout_id, s.start_time, s.end_time, DATE_FORMAT(s.start_date,'%Y-%m-%d') as start_date, 
                r.repeat_mode, r.repeat_interval, r.days_count
         FROM schedules s
         LEFT JOIN schedule_recurrences r ON r.schedule_id = s.id
         WHERE s.device_id = ? AND s.company_id = ?`,
        [source_device_id, req.user.company_id]
      );

      let createdSchedules = 0;
      for (const row of srcSchedules) {
        // Generate instances for this source schedule
        const allInstances = generateInstances(
          row.id,
          target_device_id,
          row.layout_id,
          row.start_time,
          row.end_time,
          row.start_date,
          row.repeat_mode || 'none',
          row.repeat_interval || 1,
          row.days_count || 1
        );

        // Keep only future instances
        const futureInstances = allInstances.filter(inst => inst.date >= today);

        if (futureInstances.length > 0) {
          // Create parent schedule for target
          const [scheduleRes] = await conn.query(
            `INSERT INTO schedules (device_id, layout_id, company_id, start_time, end_time, start_date)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [target_device_id, row.layout_id, req.user.company_id, row.start_time, row.end_time, row.start_date]
          );
          const newScheduleId = scheduleRes.insertId;

          // Insert recurrence
          await conn.query(
            `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count)
             VALUES (?, ?, ?, ?)`,
            [newScheduleId, row.repeat_mode || 'none', row.repeat_interval || 1, row.days_count || 1]
          );

          // Update instances with new schedule ID and convert to nested array for bulk insert
          const instanceValues = futureInstances.map(inst => [
            newScheduleId,
            target_device_id,
            inst.layout_id,
            inst.date,
            inst.start_time,
            inst.end_time,
            inst.start_datetime,
            inst.end_datetime
          ]);

          await conn.query(
            `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime)
             VALUES ?`,
            [instanceValues]
          );

          createdSchedules++;
        }
      }

      await conn.commit();
      res.json({ ok: true, created: createdSchedules });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error('COPY_DEVICE_SCHEDULES_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'Copy schedules failed' });
  }
});

module.exports = router;
