require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { authRequired } = require('./lib/auth');
const authRoutes = require('./routes/auth');
const crud = require('./routes/crud');

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use('/api/auth', authRoutes);

// Protected resources — generic CRUD
app.use('/api/companies', authRequired, crud('companies', { tenantScoped: false }));
app.use('/api/devices',   authRequired, crud('devices'));
app.use('/api/layouts',   authRequired, crud('layouts'));
app.use('/api/content',   authRequired, crud('content'));
app.use('/api/schedules', authRequired, crud('schedules'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'server error' });
});

// Plesk/IIS can provide PORT as a named pipe, so do not coerce it with Number().
const port = process.env.PORT || process.env.HTTP_PLATFORM_PORT || 8080;
app.listen(port, () => console.log(`API listening on ${port}`));
