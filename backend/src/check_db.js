const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: '103.69.196.157',
  port: 3306,
  user: 'mayur_app',
  password: '8rT#YMw8@svk5ymo',
  database: 'mayur_',
});

async function main() {
  try {
    const [cols] = await pool.query("DESCRIBE devices");
    console.log("Devices Columns:");
    console.log(cols.map(c => `${c.Field}: ${c.Type} (Default: ${c.Default})`));

    const [rows] = await pool.query("SELECT id, name, is_paired, is_paused, status FROM devices");
    console.log("\nDevices Rows:");
    console.log(rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
