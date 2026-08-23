const router = require('express').Router();
const bcrypt = require('bcryptjs');
const db = require('../lib/db');
const { sign, authRequired } = require('../lib/auth');
const { rememberLocalLoginPassword } = require('../lib/cloud-session-cache');

function parseExpirationDate(val) {
  if (!val) return null;
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? null : val;
  }
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    let s = val.trim();
    if (!s) return null;
    // If no timezone offset (Z or +/-HH:MM) is present, treat as UTC
    const hasTimezone = /Z$/i.test(s) || /[+-]\d{2}(:?\d{2})?$/.test(s);
    if (!hasTimezone) {
      s = s.replace(' ', 'T') + 'Z';
    }
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

// POST /api/auth/signup { email, password, company_name, full_name }
router.post('/signup', async (req, res) => {
  try {
    const { email, password, company_name, full_name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const cName = company_name ? String(company_name).trim() : `${normalizedEmail.split('@')[0]} Org`;
    const fName = full_name ? String(full_name).trim() : `${cName} Admin`;

    // Check if user already exists
    const [existing] = await db.query('SELECT id FROM users WHERE email = :email LIMIT 1', { email: normalizedEmail });
    if (existing && existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please log in.' });
    }

    const { v4: uuid } = require('uuid');
    const companyId = uuid();
    const userId = uuid();
    const roleId = uuid();
    const passwordHash = await bcrypt.hash(password, 10);

    // 7-day free trial for Cloud (compatible with both SQLite & MariaDB):
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    const nowStr = new Date().toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      `INSERT INTO companies 
       (id, name, contact_email, plan, max_screens, status, timezone, show_brand_header, brand_header_placement, local_mode, max_devices, subscription_status, trial_ends_at, created_at, updated_at) 
       VALUES 
       (:id, :name, :contact_email, 'starter', 1, 'active', 'UTC', 0, 'top', 'none', 1, 'trial', :trial_ends_at, :now_str, :now_str)`,
      {
        id: companyId,
        name: cName,
        contact_email: normalizedEmail,
        trial_ends_at: trialEndsAt,
        now_str: nowStr
      }
    );

    await db.query(
      `INSERT INTO users 
       (id, email, password_hash, full_name, company_id, is_active, local_mode, max_devices, created_at, updated_at) 
       VALUES 
       (:id, :email, :password_hash, :full_name, :company_id, 1, 'none', 1, :now_str, :now_str)`,
      {
        id: userId,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: fName,
        company_id: companyId,
        now_str: nowStr
      }
    );

    await db.query(
      `INSERT INTO user_roles (id, user_id, role) VALUES (:id, :user_id, 'admin')`,
      { id: roleId, user_id: userId }
    );

    const token = sign({
      id: userId,
      email: normalizedEmail,
      role: 'admin',
      company_id: companyId
    });

    res.json({
      token,
      user: {
        id: userId,
        email: normalizedEmail,
        full_name: fName,
        role: 'admin',
        company_id: companyId,
        local_mode: 'none',
        max_devices: 1
      }
    });
  } catch (err) {
    console.error('SIGNUP_ERROR:', err);
    res.status(500).json({ error: err.message || 'Sign up failed' });
  }
});

// POST /api/auth/login  { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: 'email & password required' });
    const normalizedEmail = String(email).trim().toLowerCase();

    const isCodeValidSql = db.isSqlite ? "(CASE WHEN u.login_code_expires_at > datetime('now') THEN 1 ELSE 0 END)" : "(CASE WHEN u.login_code_expires_at > NOW() THEN 1 ELSE 0 END)";
    const [rows] = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, u.local_mode, u.max_devices, u.login_code, u.login_code_expires_at, ${isCodeValidSql} AS is_code_valid, r.role ` +
      'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
      'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
      { email: normalizedEmail }
    );
    let user = rows[0];
    const isOffline = process.env.IS_OFFLINE === 'true';
    let passwordMatches = false;
    if (user?.password_hash) {
      try {
        passwordMatches = await bcrypt.compare(password, user.password_hash);
      } catch (e) {
        console.warn(`[local-auth] Invalid local password hash for ${normalizedEmail}; cloud verification will be attempted.`);
      }
    }

    // A correct local password never touches the cloud. A missing user or a
    // password mismatch gets one cloud verification attempt so a password
    // reset made in Plesk can repair the saved local credential.
    const needsBootstrap = !user;
    if ((!user || !passwordMatches) && isOffline) {
      console.log(
        needsBootstrap
          ? `[local-auth] User ${normalizedEmail} has not been bootstrapped. Attempting cloud authentication...`
          : `[local-auth] Local password mismatch for ${normalizedEmail}. Attempting one cloud verification...`
      );
      const cloudUrl = process.env.CLOUD_URL || 'https://agitated-satoshi.103-69-196-157.plesk.page';
      try {
        const loginRes = await fetch(`${cloudUrl}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password, is_local: true })
        });

        if (loginRes.status === 403 || loginRes.status === 401) {
          const errData = await loginRes.json().catch(() => ({}));
          if (errData.code_required || errData.error) {
            return res.status(loginRes.status).json(errData);
          }
        }

        if (loginRes.ok) {
          const loginData = await loginRes.json();
          if (loginData.require_code) {
            return res.json(loginData);
          }
          const cloudToken = loginData.token;
          const remoteUser = loginData.user || {};
          const remoteUserId = user?.id || remoteUser.id || require('uuid').v4();
          const remoteCompanyId = user?.company_id || remoteUser.company_id || '00000000-0000-0000-0000-000000000000';
          const localPasswordHash = await bcrypt.hash(password, 10);
          let localDeviceLimit = Number(remoteUser.max_devices || 5);

          if (needsBootstrap) {
            console.log(`[local-auth] Cloud login successful. Fetching initial cloud backup...`);
            const backupRes = await fetch(`${cloudUrl}/api/backup`, {
              headers: { 'Authorization': `Bearer ${cloudToken}` }
            });
            if (backupRes.ok) {
              const backupPayload = await backupRes.json();
              const { restoreBackupPayload } = require('../lib/backup-helper');
              backupPayload.company_id = remoteCompanyId;
              backupPayload.company = {
                ...(backupPayload.company || {}),
                id: remoteCompanyId,
                name: backupPayload.company?.name || remoteUser.company_name || 'SignageHub Local Company',
                contact_email: backupPayload.company?.contact_email || normalizedEmail
              };
              localDeviceLimit = Number(backupPayload.company.max_screens || localDeviceLimit);
              backupPayload.company.max_devices = localDeviceLimit;

              backupPayload.users = backupPayload.users || [];
              backupPayload.users.push({
                id: remoteUserId,
                email: normalizedEmail,
                full_name: remoteUser.full_name || remoteUser.name || '',
                password_hash: localPasswordHash,
                company_id: remoteCompanyId,
                role: remoteUser.role || 'admin',
                local_mode: remoteUser.local_mode || backupPayload.company?.local_mode || 'none',
                max_devices: localDeviceLimit,
                is_active: 1
              });

              console.log(`[local-auth] Restoring initial backup to local database...`);
              await restoreBackupPayload(backupPayload, db);
              const { syncCloudUploads } = require('./storage');
              await syncCloudUploads(backupPayload, cloudUrl);
            } else {
              console.warn(`[local-auth] Cloud backup download failed with status ${backupRes.status}; saving login identity only.`);
            }

            // Guarantee that the locally usable identity exists even when the
            // backup endpoint was unavailable.
            await db.query(
              'INSERT OR IGNORE INTO companies (id, name, contact_email, plan, max_screens, status, local_mode, max_devices) ' +
              'VALUES (:id, :name, :contact_email, :plan, :max_screens, :status, :local_mode, :max_devices)',
              {
                id: remoteCompanyId,
                name: remoteUser.company_name || 'SignageHub Local Company',
                contact_email: normalizedEmail,
                plan: 'pro',
                max_screens: localDeviceLimit,
                status: 'active',
                local_mode: remoteUser.local_mode || 'none',
                max_devices: localDeviceLimit
              }
            );
            await db.query(
              'INSERT OR REPLACE INTO users (id, email, password_hash, full_name, company_id, is_active, local_mode, max_devices) ' +
              'VALUES (:id, :email, :password_hash, :full_name, :company_id, 1, :local_mode, :max_devices)',
              {
                id: remoteUserId,
                email: normalizedEmail,
                password_hash: localPasswordHash,
                full_name: remoteUser.full_name || remoteUser.name || '',
                company_id: remoteCompanyId,
                local_mode: remoteUser.local_mode || 'none',
                max_devices: localDeviceLimit
              }
            );
            await db.query('DELETE FROM user_roles WHERE user_id = :user_id', { user_id: remoteUserId });
            await db.query(
              'INSERT OR REPLACE INTO user_roles (id, user_id, role) VALUES (:id, :user_id, :role)',
              { id: require('uuid').v4(), user_id: remoteUserId, role: remoteUser.role || 'admin' }
            );
          } else {
            // Password recovery is intentionally narrow: no backup, layouts,
            // devices, schedules, or assets are fetched here.
            await db.query(
              'UPDATE users SET password_hash = :password_hash WHERE id = :id',
              { password_hash: localPasswordHash, id: user.id }
            );
            console.log(`[local-auth] Cloud password verified; refreshed the saved local credential only.`);
          }

          const [retryRows] = await db.query(
            'SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, u.local_mode, u.max_devices, r.role ' +
            'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
            'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
            { email: normalizedEmail }
          );
          user = retryRows[0];
          passwordMatches = Boolean(user);
        } else {
          console.warn(`[local-auth] Cloud authentication rejected for ${normalizedEmail} with status ${loginRes.status}.`);
        }
      } catch (e) {
        console.error(`[local-auth] Cloud fallback auth error:`, e.message);
      }
    }

    if (!user) return res.status(401).json({ error: 'invalid credentials' });

    if (!passwordMatches) {
      try {
        passwordMatches = await bcrypt.compare(password, user.password_hash);
      } catch (e) {
        passwordMatches = false;
      }
    }
    if (!passwordMatches) return res.status(401).json({ error: 'invalid credentials' });

    // Enforce 2-step verification for local admin logins on cloud backend
    const isLocal = req.body?.is_local || req.headers['x-local-request'];
    if (user.role === 'admin' && isLocal && !isOffline) {
      const isCodeValid = Boolean(user.login_code && user.is_code_valid);
      
      if (!isCodeValid) {
        return res.status(403).json({
          error: "A verification code must be generated by the Super Admin to authorize this login.",
          code_required: true
        });
      }
      return res.json({ require_code: true, email: user.email });
    }

    // Local server login restrictions: Only local network admins (role === 'admin', local_mode === 'multi' or 'single') are permitted to log in.
    if (isOffline) {
      if (user.role !== 'admin' || (user.local_mode !== 'multi' && user.local_mode !== 'single')) {
        return res.status(403).json({ error: 'Only local network admins are permitted to log in on this local server.' });
      }
      // Keep the current sign-in password in process memory only so the
      // authenticated admin can explicitly refresh cloud entitlements without
      // being prompted a second time. It is never written to disk.
      rememberLocalLoginPassword(user.id, password);
    }

    const token = sign({ id: user.id, email: user.email, role: user.role, company_id: user.company_id });
    res.json({
      token,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role, company_id: user.company_id, local_mode: user.local_mode, max_devices: user.max_devices },
    });
  } catch (err) {
    console.error('LOGIN_ERROR:', err.stack || err);
    res.status(500).json({ 
      error: 'Login failed. Check backend database connection and logs.',
      details: err.message,
      stack: err.stack
    });
  }
});

// GET /api/auth/me
router.get('/me', authRequired, (req, res) => res.json({ user: req.user }));

// PATCH /api/auth/password { password }
router.patch('/password', authRequired, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
    const password_hash = await bcrypt.hash(String(password), 10);
    await db.query('UPDATE users SET password_hash = :password_hash WHERE id = :id', { password_hash, id: req.user.id });
    res.json({ ok: true });
  } catch (err) {
    console.error('PASSWORD_ERROR:', err.stack || err);
    res.status(500).json({ error: 'Password update failed' });
  }
});
// POST /api/auth/verify-code
router.post('/verify-code', async (req, res) => {
  try {
    const { email, password, code } = req.body || {};
    if (!email || !password || !code) {
      return res.status(400).json({ error: 'email, password & code required' });
    }
    const normalizedEmail = String(email).trim().toLowerCase();
    const isOffline = process.env.IS_OFFLINE === 'true';

    // Local server proxying verify-code to cloud server
    if (isOffline) {
      console.log(`[local-auth] Proxying verify-code to cloud server...`);
      const cloudUrl = process.env.CLOUD_URL || 'https://agitated-satoshi.103-69-196-157.plesk.page';
      try {
        const cloudVerifyRes = await fetch(`${cloudUrl}/api/auth/verify-code`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: normalizedEmail, password, code })
        });

        if (cloudVerifyRes.ok) {
          const verifyData = await cloudVerifyRes.json();
          const remoteUser = verifyData.user || {};
          const remoteUserId = remoteUser.id || require('uuid').v4();
          const remoteCompanyId = remoteUser.company_id || '00000000-0000-0000-0000-000000000000';
          const localPasswordHash = await bcrypt.hash(password, 10);
          let localDeviceLimit = Number(remoteUser.max_devices || 5);

          // Fetch the cloud backup and restore locally
          console.log(`[local-auth] Code verified. Downloading backup payload...`);
          const backupRes = await fetch(`${cloudUrl}/api/backup`, {
            headers: { 'Authorization': `Bearer ${verifyData.token}` }
          });
          if (backupRes.ok) {
            const backupPayload = await backupRes.json();
            const { restoreBackupPayload } = require('../lib/backup-helper');
            backupPayload.company_id = remoteCompanyId;
            backupPayload.company = {
              ...(backupPayload.company || {}),
              id: remoteCompanyId,
              name: backupPayload.company?.name || remoteUser.company_name || 'SignageHub Local Company',
              contact_email: backupPayload.company?.contact_email || normalizedEmail
            };
            localDeviceLimit = Number(backupPayload.company.max_screens || localDeviceLimit);
            backupPayload.company.max_devices = localDeviceLimit;

            backupPayload.users = backupPayload.users || [];
            backupPayload.users.push({
              id: remoteUserId,
              email: normalizedEmail,
              full_name: remoteUser.full_name || remoteUser.name || '',
              password_hash: localPasswordHash,
              company_id: remoteCompanyId,
              role: remoteUser.role || 'admin',
              local_mode: remoteUser.local_mode || backupPayload.company?.local_mode || 'none',
              max_devices: localDeviceLimit,
              is_active: 1
            });

            console.log(`[local-auth] Restoring backup to local database...`);
            await restoreBackupPayload(backupPayload, db);
            const { syncCloudUploads } = require('./storage');
            await syncCloudUploads(backupPayload, cloudUrl);
          } else {
            console.warn(`[local-auth] Cloud backup failed; saving identity only.`);
            await db.query(
              'INSERT OR REPLACE INTO users (id, email, password_hash, full_name, company_id, is_active, local_mode, max_devices) ' +
              'VALUES (:id, :email, :password_hash, :full_name, :company_id, 1, :local_mode, :max_devices)',
              {
                id: remoteUserId,
                email: normalizedEmail,
                password_hash: localPasswordHash,
                full_name: remoteUser.full_name || remoteUser.name || '',
                company_id: remoteCompanyId,
                local_mode: remoteUser.local_mode || 'none',
                max_devices: localDeviceLimit
              }
            );
          }

          rememberLocalLoginPassword(remoteUserId, password);
          return res.json(verifyData);
        } else {
          const verifyErrText = await cloudVerifyRes.text().catch(() => "");
          return res.status(cloudVerifyRes.status).send(verifyErrText);
        }
      } catch (err) {
        console.error("[local-auth] Verify-code proxy error:", err);
        return res.status(500).json({ error: "Cloud server unreachable" });
      }
    }

    // Cloud Verification
    const isCodeValidSql = db.isSqlite ? "(CASE WHEN u.login_code_expires_at > datetime('now') THEN 1 ELSE 0 END)" : "(CASE WHEN u.login_code_expires_at > NOW() THEN 1 ELSE 0 END)";
    const [rows] = await db.query(
      `SELECT u.id, u.email, u.password_hash, u.full_name, u.company_id, u.local_mode, u.max_devices, u.login_code, u.login_code_expires_at, ${isCodeValidSql} AS is_code_valid, r.role ` +
      'FROM users u LEFT JOIN user_roles r ON r.user_id = u.id ' +
      'WHERE u.email = :email AND u.is_active = 1 LIMIT 1',
      { email: normalizedEmail }
    );
    const u = rows[0];
    if (!u) return res.status(401).json({ error: 'invalid credentials' });

    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });

    const isCodeValid = Boolean(u.login_code && u.login_code === String(code).trim() && u.is_code_valid);

    if (!isCodeValid) {
      return res.status(403).json({ error: "Invalid or expired verification code" });
    }

    // Clear code on success
    await db.query('UPDATE users SET login_code = NULL, login_code_expires_at = NULL WHERE id = :id', { id: u.id });

    const token = sign({ id: u.id, email: u.email, role: u.role, company_id: u.company_id });
    res.json({
      token,
      user: { id: u.id, email: u.email, full_name: u.full_name, role: u.role, company_id: u.company_id, local_mode: u.local_mode, max_devices: u.max_devices },
    });
  } catch (err) {
    console.error('VERIFY_CODE_ERROR:', err.stack || err);
    res.status(500).json({ error: 'Verification failed' });
  }
});

// POST /api/auth/users/:id/generate-code
router.post('/users/:id/generate-code', authRequired, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ error: 'Only Super Admins can generate verification codes.' });
    }

    const { id } = req.params;
    const { companyId, email } = req.body || {};
    const code = String(Math.floor(1000 + Math.random() * 9000)); // 4-digit code
    const expSql = db.isSqlite ? "datetime('now', '+15 minutes')" : "DATE_ADD(NOW(), INTERVAL 15 MINUTE)";
    const [updateResult] = await db.query(
      `UPDATE users SET login_code = :code, login_code_expires_at = ${expSql} ` +
      'WHERE id = :id OR company_id = :id OR email = :id ' +
      (companyId ? 'OR company_id = :companyId ' : '') +
      (email ? 'OR email = :email ' : ''),
      { 
        code, 
        id,
        ...(companyId ? { companyId } : {}),
        ...(email ? { email } : {})
      }
    );

    console.log(`[auth] Verification code ${code} generated for user/company ${id}. Result:`, updateResult);
    res.json({ code, expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString() });
  } catch (err) {
    console.error('GENERATE_CODE_ERROR:', err.stack || err);
    res.status(500).json({ error: 'Failed to generate verification code' });
  }
});

module.exports = router;
