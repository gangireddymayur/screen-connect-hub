const sqlite3 = require('sqlite3').verbose();

const SQLITE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    contact_email TEXT,
    plan TEXT NOT NULL DEFAULT 'starter',
    max_screens INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'active',
    timezone TEXT NOT NULL DEFAULT 'UTC',
    logo_url TEXT,
    notes TEXT,
    created_by TEXT,
    show_brand_header INTEGER DEFAULT 0,
    brand_header_placement TEXT DEFAULT 'top',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    full_name TEXT,
    company_id TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS user_roles (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, role),
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS layouts (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    resolution_width INTEGER NOT NULL DEFAULT 1920,
    resolution_height INTEGER NOT NULL DEFAULT 1080,
    background_color TEXT NOT NULL DEFAULT '#000000',
    layout_data TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS devices (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    layout_id TEXT,
    is_paired INTEGER NOT NULL DEFAULT 0,
    is_paused INTEGER DEFAULT 0,
    pairing_code TEXT,
    orientation TEXT NOT NULL DEFAULT 'landscape',
    resolution TEXT NOT NULL DEFAULT '1920x1080',
    schedules_enabled INTEGER DEFAULT 1,
    last_seen_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE,
    FOREIGN KEY(layout_id) REFERENCES layouts(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS content (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER DEFAULT 0,
    duration INTEGER DEFAULT 10,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_id TEXT NOT NULL,
    layout_id TEXT NOT NULL,
    company_id TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_date TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY(layout_id) REFERENCES layouts(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_recurrences (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL UNIQUE,
    repeat_mode TEXT NOT NULL DEFAULT 'none',
    repeat_interval INTEGER DEFAULT 1,
    days_count INTEGER DEFAULT 1,
    FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS schedule_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    device_id TEXT NOT NULL,
    layout_id TEXT NOT NULL,
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    end_time TEXT NOT NULL,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    FOREIGN KEY(schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
    FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE CASCADE,
    FOREIGN KEY(layout_id) REFERENCES layouts(id) ON DELETE CASCADE
  )`
];

function translateQuery(sql) {
  let s = sql;
  
  // 1. TIME_FORMAT(col, '%H:%i') -> strftime('%H:%M', col)
  s = s.replace(/TIME_FORMAT\(([^,]+)\s*,\s*'%H:%i'\)/gi, "strftime('%H:%M', $1)");
  
  // 2. DATE_FORMAT(col, '%Y-%m-%d %H:%i:%s') -> strftime('%Y-%m-%d %H:%M:%S', col)
  s = s.replace(/DATE_FORMAT\(([^,]+)\s*,\s*'%Y-%m-%d %H:%i:%s'\)/gi, "strftime('%Y-%m-%d %H:%M:%S', $1)");
  
  // 3. DATE_FORMAT(col, '%Y-%m-%d') -> strftime('%Y-%m-%d', col)
  s = s.replace(/DATE_FORMAT\(([^,]+)\s*,\s*'%Y-%m-%d'\)/gi, "strftime('%Y-%m-%d', $1)");
  
  // 4. ON DUPLICATE KEY UPDATE ...
  s = s.replace(/ON DUPLICATE KEY UPDATE\s+repeat_mode\s*=\s*VALUES\(repeat_mode\)\s*,\s*repeat_interval\s*=\s*VALUES\(repeat_interval\)\s*,\s*days_count\s*=\s*VALUES\(days_count\)/gi,
    "ON CONFLICT(schedule_id) DO UPDATE SET repeat_mode = excluded.repeat_mode, repeat_interval = excluded.repeat_interval, days_count = excluded.days_count");

  // 5. AUTO_INCREMENT -> AUTOINCREMENT
  s = s.replace(/AUTO_INCREMENT/gi, "AUTOINCREMENT");

  // 6. TINYINT(1) -> INTEGER
  s = s.replace(/TINYINT\(1\)/gi, "INTEGER");

  // 7. LONGTEXT -> TEXT
  s = s.replace(/LONGTEXT/gi, "TEXT");

  // 8. SHOW TABLES LIKE '...' -> SELECT name FROM sqlite_master WHERE type='table' AND name='...'
  s = s.replace(/SHOW TABLES LIKE '([^']+)'/gi, "SELECT name FROM sqlite_master WHERE type='table' AND name='$1'");
  
  return s;
}

let sharedDb = null;
function getSharedDb(dbPath) {
  if (!sharedDb) {
    sharedDb = new sqlite3.Database(dbPath);
    sharedDb.serialize(() => {
      sharedDb.run("PRAGMA journal_mode=WAL");
      sharedDb.run("PRAGMA foreign_keys=ON");

      // Auto-create missing schemas on load
      for (const statement of SQLITE_SCHEMA) {
        sharedDb.run(statement, (err) => {
          if (err) {
            console.error("[db] Error initializing SQLite table:", err);
          }
        });
      }
    });
  }
  return sharedDb;
}

class SqliteConnection {
  constructor(db) {
    this.db = db;
  }

  query(sql, params = []) {
    return new Promise((resolve, reject) => {
      let querySql = translateQuery(sql);
      let queryParams = params;

      // Handle MySQL SHOW COLUMNS FROM ... LIKE ...
      const showColumnsMatch = querySql.match(/SHOW COLUMNS FROM (\w+) LIKE '(\w+)'/i);
      if (showColumnsMatch) {
        const table = showColumnsMatch[1];
        const column = showColumnsMatch[2];
        this.db.all(`PRAGMA table_info(${table})`, [], (err, infoRows) => {
          if (err) return reject(err);
          const colInfo = infoRows.filter(r => r.name === column).map(r => ({ Field: r.name, Type: r.type }));
          resolve([colInfo, []]);
        });
        return;
      }

      // Handle MySQL-style bulk insert mapping: VALUES ?
      if (querySql.trim().toUpperCase().includes('VALUES ?') || querySql.trim().toUpperCase().includes('VALUES(?)')) {
        if (queryParams && queryParams.length === 1 && Array.isArray(queryParams[0])) {
          const rows = queryParams[0];
          if (rows.length > 0 && Array.isArray(rows[0])) {
            const placeholders = rows.map(row => `(${row.map(() => '?').join(', ')})`).join(', ');
            querySql = querySql.replace(/VALUES\s*\?\s*|VALUES\s*\(\s*\?\s*\)/i, `VALUES ${placeholders}`);
            queryParams = rows.flat();
          }
        }
      }

      // Handle named parameters
      if (queryParams && typeof queryParams === 'object' && !Array.isArray(queryParams)) {
        const namedParams = {};
        for (const [key, val] of Object.entries(queryParams)) {
          namedParams[`:${key}`] = val;
        }
        queryParams = namedParams;
      }

      const isSelect = querySql.trim().toUpperCase().startsWith('SELECT') ||
                       querySql.trim().toUpperCase().startsWith('PRAGMA') ||
                       querySql.trim().toUpperCase().startsWith('SHOW');

      if (isSelect) {
        this.db.all(querySql, queryParams, (err, rows) => {
          if (err) return reject(err);
          resolve([rows, []]);
        });
      } else {
        this.db.run(querySql, queryParams, function(err) {
          if (err) return reject(err);
          resolve([{ insertId: this.lastID, affectedRows: this.changes }, []]);
        });
      }
    });
  }

  beginTransaction() {
    return this.query('BEGIN TRANSACTION');
  }

  commit() {
    return this.query('COMMIT');
  }

  rollback() {
    return this.query('ROLLBACK');
  }

  release() {
    // Shared connection is not closed on release
  }
}

class SqlitePool {
  constructor(dbPath) {
    this.dbPath = dbPath;
  }

  async query(sql, params) {
    const conn = await this.getConnection();
    return await conn.query(sql, params);
  }

  async getConnection() {
    const db = getSharedDb(this.dbPath);
    return new SqliteConnection(db);
  }
}

module.exports = {
  SqlitePool,
  SQLITE_SCHEMA
};
