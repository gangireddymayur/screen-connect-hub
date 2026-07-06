const path = require('path');
const fs = require('fs');

if (fs.existsSync(path.resolve(process.cwd(), '.env'))) {
  require('dotenv').config();
} else if (fs.existsSync(path.resolve(__dirname, '../.env'))) {
  require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
} else {
  require('dotenv').config();
}
const express = require('express');
const cors = require('cors');

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err.stack || err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err.stack || err));

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '100mb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));
// Run startup database migrations to ensure devices table column exists
(async () => {
  try {
    const db = require('./src/lib/db');
    const [cols] = await db.query("SHOW COLUMNS FROM devices LIKE 'schedules_enabled'");
    if (cols.length === 0) {
      await db.query("ALTER TABLE devices ADD COLUMN schedules_enabled TINYINT(1) DEFAULT 1");
      console.log("[db] Added schedules_enabled column to devices table.");
    }

    const [compCols] = await db.query("SHOW COLUMNS FROM companies LIKE 'show_brand_header'");
    if (compCols.length === 0) {
      await db.query("ALTER TABLE companies ADD COLUMN show_brand_header TINYINT(1) DEFAULT 0");
      console.log("[db] Added show_brand_header column to companies table.");
    }

    const [placementCols] = await db.query("SHOW COLUMNS FROM companies LIKE 'brand_header_placement'");
    if (placementCols.length === 0) {
      await db.query("ALTER TABLE companies ADD COLUMN brand_header_placement VARCHAR(10) DEFAULT 'top'");
      console.log("[db] Added brand_header_placement column to companies table.");
    }

    const [pausedCols] = await db.query("SHOW COLUMNS FROM devices LIKE 'is_paused'");
    if (pausedCols.length === 0) {
      await db.query("ALTER TABLE devices ADD COLUMN is_paused TINYINT(1) DEFAULT 0");
      console.log("[db] Added is_paused column to devices table.");
    }

    const [tableExist] = await db.query("SHOW TABLES LIKE 'schedule_instances'");
    if (tableExist.length === 0) {
      console.log("[db] Initializing advanced schedules database tables...");
      
      // Drop legacy schedules table if it exists
      await db.query("DROP TABLE IF EXISTS schedules");
      
      // Create schedules parent table
      await db.query(`
        CREATE TABLE IF NOT EXISTS schedules (
          id          INT AUTO_INCREMENT PRIMARY KEY,
          device_id   CHAR(36) NOT NULL,
          layout_id   CHAR(36) NOT NULL,
          company_id  CHAR(36) NOT NULL,
          start_time  TIME NOT NULL,
          end_time    TIME NOT NULL,
          start_date  DATE NOT NULL,
          created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          CONSTRAINT fk_schedules_device FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE,
          CONSTRAINT fk_schedules_layout FOREIGN KEY (layout_id) REFERENCES layouts(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create schedule_recurrences table
      await db.query(`
        CREATE TABLE IF NOT EXISTS schedule_recurrences (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id     INT NOT NULL UNIQUE,
          repeat_mode     ENUM('none', 'daily', 'custom') NOT NULL DEFAULT 'none',
          repeat_interval INT DEFAULT 1,
          days_count      INT DEFAULT 1,
          CONSTRAINT fk_recurrences_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create schedule_instances table
      await db.query(`
        CREATE TABLE IF NOT EXISTS schedule_instances (
          id              INT AUTO_INCREMENT PRIMARY KEY,
          schedule_id     INT NOT NULL,
          device_id       CHAR(36) NOT NULL,
          layout_id       CHAR(36) NOT NULL,
          date            DATE NOT NULL,
          start_time      TIME NOT NULL,
          end_time        TIME NOT NULL,
          start_datetime  DATETIME NOT NULL,
          end_datetime    DATETIME NOT NULL,
          CONSTRAINT fk_instances_schedule FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE,
          CONSTRAINT fk_instances_device   FOREIGN KEY (device_id)   REFERENCES devices(id)   ON DELETE CASCADE,
          CONSTRAINT fk_instances_layout   FOREIGN KEY (layout_id)   REFERENCES layouts(id)   ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `);

      // Create index for fast device query
      await db.query(`
        CREATE INDEX idx_instances_device_time ON schedule_instances (device_id, start_datetime, end_datetime);
      `);
      console.log("[db] Advanced schedules database tables initialized successfully.");
    }
  } catch (err) {
    console.error("[db] Startup migration failed:", err);
  }
})();

try {
  const { authRequired } = require('./src/lib/auth');
  const authRoutes = require('./src/routes/auth');
  const crud = require('./src/routes/crud');
  const functionRoutes = require('./src/routes/functions');
  const storageRoutes = require('./src/routes/storage');
  const playerRoutes = require('./src/routes/player');
  const tvRoutes = require('./src/routes/tv');

  app.use('/uploads', express.static(storageRoutes.uploadRoot));
  app.use('/api/player', playerRoutes);
  app.use('/api/tv', tvRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/functions', authRequired, functionRoutes);
  app.use('/api/storage', authRequired, storageRoutes.router);
  app.use('/api/companies',  authRequired, crud('companies'));
  app.use('/api/users',      authRequired, crud('users',      { tenantScoped: false, superAdminOnly: true }));
  app.use('/api/profiles',   authRequired, crud('users')); // alias; admins see users in their own company
  app.use('/api/user_roles', authRequired, crud('user_roles', { tenantScoped: false }));
  app.use('/api/devices',    authRequired, crud('devices'));
  app.use('/api/layouts',    authRequired, crud('layouts'));
  app.use('/api/content',    authRequired, crud('content'));
  app.use('/api/schedules',  authRequired, require('./src/routes/schedules'));
  
  const backupRoutes = require('./src/routes/backup');
  app.use('/api/backup', authRequired, backupRoutes.download);
  app.use('/api/restore', authRequired, backupRoutes.restore);
} catch (err) {
  console.error('ROUTE_LOAD_ERROR:', err.stack || err);
  app.use('/api', (_req, res) =>
    res.status(500).json({ error: 'Routes failed to load. Check logs/node.log.' })
  );
}

// Serve frontend static files from root dist/
// path is declared at top
const distDir = process.env.IS_OFFLINE === 'true'
  ? path.join(__dirname, 'public')
  : path.join(__dirname, '../dist');
app.use(express.static(distDir, { maxAge: '1h', index: false }));
app.get(/^(?!\/api|\/uploads).*/, (_req, res) => {
  res.sendFile(path.join(distDir, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

const port = process.env.PORT || process.env.HTTP_PLATFORM_PORT || 8080;
app.listen(port, () => console.log('RUNNING ON PORT:', port));







