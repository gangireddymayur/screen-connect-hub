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
    local_mode TEXT NOT NULL DEFAULT 'none',
    max_devices INTEGER NOT NULL DEFAULT 5,
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
    FOREIGN KEY(layout_id) REFERENCES layouts(id) ON DELETE CASCADE,
    FOREIGN KEY(company_id) REFERENCES companies(id) ON DELETE CASCADE
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

function translateSqlQuery(sql) {
  let s = sql;
  
  // Handle NOW() -> datetime('now', 'localtime')
  s = s.replace(/NOW\(\)/g, "datetime('now', 'localtime')");

  // Handle DATE_SUB(datetime('now', 'localtime'), INTERVAL X MINUTE) -> datetime('now', 'localtime', '-X minutes')
  s = s.replace(/DATE_SUB\(\s*datetime\('now',\s*'localtime'\)\s*,\s*INTERVAL\s+(\d+)\s+MINUTE\)/gi, "datetime('now', 'localtime', '-$1 minutes')");
  s = s.replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+MINUTE\)/gi, "datetime('now', 'localtime', '-$1 minutes')");
  s = s.replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+(\d+)\s+DAY\)/gi, "datetime('now', 'localtime', '-$1 days')");

  // Translate MySQL DATE_SUB(NOW(), INTERVAL 15 MINUTE)
  s = s.replace(/DATE_SUB\(\s*datetime\('now',\s*'localtime'\)\s*,\s*INTERVAL\s+15\s+MINUTE\)/gi, "datetime('now', 'localtime', '-15 minutes')");
  s = s.replace(/DATE_SUB\(\s*NOW\(\)\s*,\s*INTERVAL\s+15\s+MINUTE\)/gi, "datetime('now', 'localtime', '-15 minutes')");

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

class SqlitePool {
  constructor(dbPath) {
    this.dbPath = dbPath;
    this.SQL = null;
    this.db = null;
    this.isSqlite = true;
    this.initPromise = this.init();
  }

  async init() {
    const initSqlJs = require("sql.js");
    const fs = require("node:fs");
    const path = require("node:path");
    
    // Load WebAssembly binary candidate paths
    const wasmCandidates = [
      path.join(__dirname, "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(__dirname, "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(__dirname, "..", "..", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
      path.join(process.cwd(), "backend", "node_modules", "sql.js", "dist", "sql-wasm.wasm"),
    ];
    const wasmPath = wasmCandidates.find((candidate) => fs.existsSync(candidate));
    if (!wasmPath) {
      throw new Error(`sql.js WebAssembly asset was not found. Checked: ${wasmCandidates.join(", ")}`);
    }
    const wasmBinary = fs.readFileSync(wasmPath);

    this.SQL = await initSqlJs({ wasmBinary: wasmBinary });
    
    if (fs.existsSync(this.dbPath)) {
      const filebuffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(filebuffer);
    } else {
      const dbDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
      this.db = new this.SQL.Database();
      this.saveToDisk();
    }
    
    // Enable PRAGMAs & Setup schema
    try {
      this.db.run("PRAGMA foreign_keys=ON;");
      for (const statement of SQLITE_SCHEMA) {
        this.db.run(statement);
      }

      // Check/alter local_mode and max_devices columns in SQLite if they don't exist
      try {
        this.db.run("ALTER TABLE users ADD COLUMN local_mode TEXT NOT NULL DEFAULT 'none';");
      } catch (e) {}

      try {
        this.db.run("ALTER TABLE users ADD COLUMN max_devices INTEGER NOT NULL DEFAULT 5;");
      } catch (e) {}

      // Seed default user and company if database is empty
      const userCheck = this.db.prepare("SELECT id FROM users LIMIT 1");
      let hasUsers = false;
      if (userCheck.step()) {
        hasUsers = true;
      }
      userCheck.free();

      if (!hasUsers) {
        console.log("[sqlite-init] Database is empty. Seeding default company and admin user...");
        const companyId = "00000000-0000-0000-0000-000000000000";
        const userId = "1";
        
        // Insert company
        this.db.run(
          "INSERT INTO companies (id, name, contact_email, plan, max_screens, status) VALUES (?, ?, ?, ?, ?, ?)",
          [companyId, "SignageHub Local Company", "admin@signagehub.local", "pro", 20, "active"]
        );
        
        // Insert user (admin@signagehub.local / admin123)
        // bcrypt hash: $2b$10$alt8uoHymwrSMN4fPJFw0uUFGeKLIpAm9L3B8PCOn1Li8YXj2Dzeu
        this.db.run(
          "INSERT INTO users (id, email, password_hash, full_name, company_id, is_active) VALUES (?, ?, ?, ?, ?, 1)",
          [userId, "admin@signagehub.local", "$2b$10$alt8uoHymwrSMN4fPJFw0uUFGeKLIpAm9L3B8PCOn1Li8YXj2Dzeu", "Local Admin", companyId]
        );

        // Insert role
        this.db.run(
          "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
          ["role-1", userId, "super_admin"]
        );
      }

      this.saveToDisk();
    } catch (e) {
      console.error("[sqlite-init] Schema seeding error:", e.message);
    }
  }

  saveToDisk() {
    const fs = require("node:fs");
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  async execute(sql, params = []) {
    return this.query(sql, params);
  }

  async query(sql, params = []) {
    await this.initPromise;
    const originalSql = sql.trim();
    
    // Intercept "SHOW COLUMNS FROM <table> LIKE '<col>'"
    const showColumnsMatch = originalSql.match(/SHOW COLUMNS FROM\s+(\w+)\s+LIKE\s+'(\w+)'/i);
    if (showColumnsMatch) {
      const table = showColumnsMatch[1];
      const col = showColumnsMatch[2];
      try {
        const stmt = this.db.prepare(`PRAGMA table_info(${table})`);
        const rows = [];
        while (stmt.step()) {
          const rowVal = stmt.get();
          rows.push({ name: rowVal[1] });
        }
        stmt.free();
        const found = rows.some(r => r.name.toLowerCase() === col.toLowerCase());
        return [found ? [{ Field: col }] : [], null];
      } catch (err) {
        throw err;
      }
    }

    // Intercept "SHOW TABLES LIKE '<name>'"
    const showTablesMatch = originalSql.match(/SHOW TABLES LIKE\s+'(\w+)'/i);
    if (showTablesMatch) {
      const table = showTablesMatch[1];
      try {
        const stmt = this.db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`);
        stmt.bind([table]);
        const rows = [];
        while (stmt.step()) {
          const rowVal = stmt.get();
          rows.push({ name: rowVal[0] });
        }
        stmt.free();
        return [rows.length > 0 ? [{ [`Tables_in_${table}`]: table }] : [], null];
      } catch (err) {
        throw err;
      }
    }

    const translatedSql = translateSqlQuery(sql);

    // Handle MySQL-style bulk INSERT: "INSERT INTO t (...) VALUES ?" with params=[[[row1],[row2],...]]
    if (
      Array.isArray(params) &&
      params.length === 1 &&
      Array.isArray(params[0]) &&
      params[0].length > 0 &&
      Array.isArray(params[0][0])
    ) {
      const rows = params[0];
      const colCount = rows[0].length;
      const placeholder = `(${Array(colCount).fill("?").join(",")})`;
      const singleRowSql = translatedSql.replace(/VALUES\s+\?/i, `VALUES ${placeholder}`);
      
      let lastId = 0;
      let changes = 0;
      
      for (const row of rows) {
        try {
          const stmt = this.db.prepare(singleRowSql);
          stmt.run(row);
          stmt.free();
          
          const res = this.db.exec("SELECT last_insert_rowid(), changes()");
          if (res && res.length > 0) {
            lastId = res[0].values[0][0];
            changes += res[0].values[0][1];
          }
        } catch (err) {
          throw err;
        }
      }
      
      this.saveToDisk();
      return [{ insertId: lastId, affectedRows: changes }, null];
    }

    // Regular query
    try {
      let rows = [];
      const stmt = this.db.prepare(translatedSql);
      stmt.bind(params);
      
      const columns = stmt.getColumnNames();
      while (stmt.step()) {
        const rowVal = stmt.get();
        const rowObj = {};
        columns.forEach((col, idx) => {
          rowObj[col] = rowVal[idx];
        });
        rows.push(rowObj);
      }
      stmt.free();
      
      const isWrite = /^\s*(insert|update|delete|create|drop|alter|replace)/i.test(translatedSql);
      if (isWrite) {
        let lastId = 0;
        let changes = 0;
        const res = this.db.exec("SELECT last_insert_rowid(), changes()");
        if (res && res.length > 0) {
          lastId = res[0].values[0][0];
          changes = res[0].values[0][1];
        }
        this.saveToDisk();
        return [{ insertId: lastId, affectedRows: changes }, null];
      }
      
      return [rows, null];
    } catch (err) {
      throw err;
    }
  }

  async getConnection() {
    return {
      query: (sql, params) => this.query(sql, params),
      execute: (sql, params) => this.execute(sql, params),
      beginTransaction: async () => this.query("BEGIN TRANSACTION"),
      commit: async () => this.query("COMMIT"),
      rollback: async () => this.query("ROLLBACK"),
      release: () => {},
      isSqlite: true
    };
  }
}

module.exports = {
  SqlitePool,
  SQLITE_SCHEMA
};
