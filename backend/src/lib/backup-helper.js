const crypto = require('crypto');

const BACKUP_ENCRYPTION_KEY = crypto.createHash('sha256').update('signagehub-secure-backup-key-7x8y9z').digest();
const IV_LENGTH = 16;

function encryptBackup(payload) {
  const text = JSON.stringify(payload);
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', BACKUP_ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptBackup(encryptedData) {
  const parts = encryptedData.split(':');
  const iv = Buffer.from(parts.shift(), 'hex');
  const encryptedText = Buffer.from(parts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', BACKUP_ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function restoreBackupPayload(payload, dbPool) {
  const conn = await dbPool.getConnection();
  try {
    await conn.beginTransaction();

    const isSqlite = conn.isSqlite || process.env.IS_OFFLINE === 'true';

    // 1. Clear layout-related tables
    // In SQLite local mode, we preserve 'devices' and 'users' so they don't lose local pairings or other local sub-admins!
    const tablesToClear = isSqlite
      ? ['layouts', 'content', 'schedules', 'schedule_recurrences', 'schedule_instances']
      : ['companies', 'users', 'user_roles', 'layouts', 'content', 'devices', 'schedules', 'schedule_recurrences', 'schedule_instances'];

    for (const table of tablesToClear) {
      try {
        await conn.query(`DELETE FROM ${table}`);
      } catch (e) {
        console.error(`[backup-restore] Failed to clear table ${table}:`, e.message);
      }
    }

    // 2. Restore Companies (Seeding/Upserting)
    const company = payload.company;
    if (company) {
      // In SQLite, we do INSERT OR REPLACE to keep it simple and clean
      const insertCompanySql = isSqlite
        ? `INSERT OR REPLACE INTO companies (id, name, contact_email, plan, max_screens, status, timezone, logo_url, show_brand_header, brand_header_placement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        : `INSERT INTO companies (id, name, contact_email, plan, max_screens, status, timezone, logo_url, show_brand_header, brand_header_placement) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE name=VALUES(name), max_screens=VALUES(max_screens)`;
      
      await conn.query(insertCompanySql, [
        company.id || payload.company_id,
        company.name,
        company.contact_email,
        company.plan || 'pro',
        company.max_screens || 10,
        company.status || 'active',
        company.timezone || 'UTC',
        company.logo_url || null,
        company.show_brand_header || 0,
        company.brand_header_placement || 'top'
      ]);
    }

    // 3. Restore Users & Roles (Seeding/Upserting)
    if (payload.users && Array.isArray(payload.users)) {
      for (const u of payload.users) {
        const insertUserSql = isSqlite
          ? `INSERT OR REPLACE INTO users (id, email, password_hash, full_name, company_id, is_active, local_mode, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
          : `INSERT INTO users (id, email, password_hash, full_name, company_id, is_active, local_mode, max_devices) VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), local_mode=VALUES(local_mode), max_devices=VALUES(max_devices)`;
        await conn.query(insertUserSql, [u.id, u.email, u.password_hash, u.full_name, u.company_id, u.is_active ?? 1, u.local_mode || 'none', u.max_devices || 5]);

        if (u.role) {
          const insertRoleSql = isSqlite
            ? `INSERT OR REPLACE INTO user_roles (id, user_id, role) VALUES (?, ?, ?)`
            : `INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE role=VALUES(role)`;
          await conn.query(insertRoleSql, [u.role_id || require('uuid').v4(), u.id, u.role]);
        }
      }
    }

    // 4. Restore Layouts
    if (payload.layouts && Array.isArray(payload.layouts)) {
      for (const l of payload.layouts) {
        await conn.query(
          `INSERT INTO layouts (id, company_id, name, description, resolution_width, resolution_height, background_color, layout_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            l.id,
            l.company_id || company.id,
            l.name,
            l.description || null,
            l.resolution_width || 1920,
            l.resolution_height || 1080,
            l.background_color || '#000000',
            typeof l.layout_data === 'object' ? JSON.stringify(l.layout_data) : l.layout_data
          ]
        );
      }
    }

    // 5. Restore Content
    if (payload.content && Array.isArray(payload.content)) {
      for (const c of payload.content) {
        await conn.query(
          `INSERT INTO content (id, company_id, name, type, file_url, file_size, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [
            c.id,
            c.company_id || company.id,
            c.name,
            c.type,
            c.url || c.file_url,
            c.size_bytes || c.file_size || 0,
            c.duration_seconds || c.duration || 10
          ]
        );
      }
    }

    // 6. Restore Devices (Only seed if they don't exist locally)
    if (payload.devices && Array.isArray(payload.devices)) {
      for (const d of payload.devices) {
        const [existing] = await conn.query(`SELECT id FROM devices WHERE id = ?`, [d.id]);
        if (existing.length === 0) {
          await conn.query(
            `INSERT INTO devices (id, company_id, name, location, status, layout_id, is_paired, is_paused, pairing_code, orientation, resolution, schedules_enabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              d.id,
              d.company_id || company.id,
              d.name,
              d.location || null,
              d.status || 'offline',
              d.layout_id || null,
              d.is_paired ?? 1,
              d.is_paused ?? 0,
              d.pairing_code || null,
              d.orientation || 'landscape',
              d.resolution || '1920x1080',
              d.schedules_enabled ?? 1
            ]
          );
        } else {
          // If device exists locally, update cloud configurations (like layout_id, schedules_enabled, orientation)
          await conn.query(
            `UPDATE devices SET layout_id = ?, schedules_enabled = ?, name = ?, location = ?, is_paused = ? WHERE id = ?`,
            [d.layout_id || null, d.schedules_enabled ?? 1, d.name, d.location || null, d.is_paused ?? 0, d.id]
          );
        }
      }
    }

    // 7. Restore Schedules
    if (payload.schedules && Array.isArray(payload.schedules)) {
      for (const s of payload.schedules) {
        await conn.query(
          `INSERT INTO schedules (id, device_id, layout_id, company_id, start_time, end_time, start_date) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [s.id, s.device_id, s.layout_id, s.company_id || company.id, s.start_time, s.end_time, s.start_date]
        );
      }
    }

    // 8. Restore Recurrences
    if (payload.recurrences && Array.isArray(payload.recurrences)) {
      for (const r of payload.recurrences) {
        await conn.query(
          `INSERT INTO schedule_recurrences (schedule_id, repeat_mode, repeat_interval, days_count) VALUES (?, ?, ?, ?)`,
          [r.schedule_id, r.repeat_mode, r.repeat_interval || 1, r.days_count || 1]
        );
      }
    }

    // 9. Restore Instances
    if (payload.instances && Array.isArray(payload.instances)) {
      for (const inst of payload.instances) {
        await conn.query(
          `INSERT INTO schedule_instances (schedule_id, device_id, layout_id, date, start_time, end_time, start_datetime, end_datetime) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            inst.schedule_id,
            inst.device_id,
            inst.layout_id,
            inst.date,
            inst.start_time,
            inst.end_time,
            inst.start_datetime,
            inst.end_datetime
          ]
        );
      }
    }

    await conn.commit();
    console.log('[backup-restore] Database payload restored successfully!');
  } catch (err) {
    await conn.rollback();
    console.error('[backup-restore] Error restoring database:', err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = {
  encryptBackup,
  decryptBackup,
  restoreBackupPayload
};
