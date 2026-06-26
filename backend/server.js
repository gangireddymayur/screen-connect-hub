require('dotenv').config();
const express = require('express');
const cors = require('cors');

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err.stack || err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err.stack || err));

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '25mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

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
  app.use('/api/schedules',  authRequired, crud('schedules'));
} catch (err) {
  console.error('ROUTE_LOAD_ERROR:', err.stack || err);
  app.use('/api', (_req, res) =>
    res.status(500).json({ error: 'Routes failed to load. Check logs/node.log.' })
  );
}

// Serve frontend static files from root dist/
const path = require('path');
const distDir = path.join(__dirname, '../dist');
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







