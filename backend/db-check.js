const mysql = require('mysql2/promise');

async function main() {
  const connection = await mysql.createConnection({
    host: '103.69.196.157',
    port: 3306,
    database: 'mayur_',
    user: 'mayur_app',
    password: '8rT#YMw8@svk5ymo'
  });

  try {
    const [rows] = await connection.query(
      'SELECT id, email, password_hash, full_name, company_id, local_mode FROM users WHERE email = ?',
      ['super@demo.com']
    );
    console.log('Query result:', rows);
  } catch (err) {
    console.error('Query error:', err);
  } finally {
    await connection.end();
  }
}

main().catch(console.error);
