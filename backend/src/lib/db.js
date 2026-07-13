const path = require('path');

const isOffline = process.env.IS_OFFLINE === 'true';

if (isOffline) {
  const { SqlitePool } = require('./sqlite-adapter');
  const dbPath = process.env.SQLITE_DB_PATH || path.join(__dirname, '../../App_Data/db.sqlite3');
  console.log(`[db] Running in OFFLINE mode. Using SQLite database at: ${dbPath}`);
  module.exports = new SqlitePool(dbPath);
} else {
  const mysql = require('mysql2/promise');
  const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true,
  });
  module.exports = pool;
}
