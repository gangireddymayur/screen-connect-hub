require('dotenv').config();
const express = require('express');
const cors = require('cors');

process.on('uncaughtException', (err) => console.error('UNCAUGHT:', err.stack || err));
process.on('unhandledRejection', (err) => console.error('UNHANDLED:', err.stack || err));

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/', (_req, res) => res.send('SERVER WORKING'));
app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

try {
  const { authRequired } = require('./src/lib/auth');
  const authRoutes = require('./src/routes/auth');
  const crud = require('./src/routes/crud');

  app.use('/api/auth', authRoutes);
  app.use('/api/companies', authRequired, crud('companies', { tenantScoped: false }));
  app.use('/api/devices',   authRequired, crud('devices'));
  app.use('/api/layouts',   authRequired, crud('layouts'));
  app.use('/api/content',   authRequired, crud('content'));
  app.use('/api/schedules', authRequired, crud('schedules'));
} catch (err) {
  console.error('ROUTE_LOAD_ERROR:', err.stack || err);
  app.use('/api', (_req, res) =>
    res.status(500).json({ error: 'Routes failed to load. Check logs/node.log.' })
  );
}

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

const port = process.env.PORT || process.env.HTTP_PLATFORM_PORT || 8080;
app.listen(port, () => console.log('RUNNING ON PORT:', port));
