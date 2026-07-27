const mysql = require('mysql2/promise');
const dotenv = require('dotenv');
const path = require('path');

const envPath = path.join(__dirname, '.env');
dotenv.config({ path: envPath });

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  });

  try {
    const [users] = await connection.query(
      'SELECT u.id, u.email, u.full_name, u.company_id, u.local_mode, u.max_devices, r.role ' +
      'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
      'WHERE u.email = "test@gmail.com"'
    );
    console.log('User test@gmail.com details:', JSON.stringify(users, null, 2));

    if (users.length > 0) {
      const [companies] = await connection.query(
        'SELECT id, name, local_mode, max_devices, subscription_status, trial_ends_at FROM companies WHERE id = ?',
        [users[0].company_id]
      );
      console.log('Company details:', JSON.stringify(companies, null, 2));
    }
  } catch (err) {
    console.error('Error querying DB:', err);
  } finally {
    await connection.end();
  }
}

run();
