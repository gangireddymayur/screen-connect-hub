require('dotenv').config();
const express = require('express');
const cors = require('cors');

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT_EXCEPTION:', err && err.stack ? err.stack : err);
});

process.on('unhandledRejection', (err) => {
  console.error('UNHANDLED_REJECTION:', err && err.stack ? err.stack : err);
});

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

try {
  const { authRequired } = require('./lib/auth');
  const authRoutes = require('./routes/auth');
  const crud = require('./routes/crud');

  app.use('/api/auth', authRoutes);

  // Protected resources — generic CRUD
  app.use('/api/companies', authRequired, crud('companies', { tenantScoped: false }));
  app.use('/api/devices',   authRequired, crud('devices'));
  app.use('/api/layouts',   authRequired, crud('layouts'));
  app.use('/api/content',   authRequired, crud('content'));
  app.use('/api/schedules', authRequired, crud('schedules'));
} catch (err) {
  console.error('ROUTE_LOAD_ERROR:', err && err.stack ? err.stack : err);
  app.use('/api', (_req, res) => {
    res.status(500).json({ error: 'API routes failed to load. Check Plesk logs/node.log.' });
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

// Plesk/IIS can provide PORT as a named pipe, so do not coerce it with Number().
const port = process.env.PORT || process.env.HTTP_PLATFORM_PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
