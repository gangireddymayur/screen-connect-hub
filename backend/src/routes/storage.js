const fs = require('fs/promises');
const path = require('path');
const router = require('express').Router();

const uploadRoot = path.resolve(__dirname, '../../App_Data/uploads');

const safePath = (value) => {
  const cleaned = String(value || '')
    .replace(/\\/g, '/')
    .split('/')
    .filter((part) => part && part !== '..' && !part.includes(':'))
    .join('/');
  if (!cleaned) throw new Error('Invalid upload path');
  return cleaned;
};

router.post('/upload', async (req, res) => {
  try {
    const { path: requestedPath, data, contentType } = req.body || {};
    if (!requestedPath || !data) return res.status(400).json({ error: 'path and data are required' });
    const rel = safePath(requestedPath);
    const full = path.join(uploadRoot, rel);
    if (!full.startsWith(uploadRoot)) return res.status(400).json({ error: 'Invalid upload path' });
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, Buffer.from(data, 'base64'));
    const base = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
    res.json({ path: rel, publicUrl: `${base}/uploads/${rel}`, contentType: contentType || null });
  } catch (err) {
    console.error('UPLOAD_ERROR:', err.stack || err);
    res.status(500).json({ error: err.message || 'Upload failed' });
  }
});

router.post('/remove', async (req, res) => {
  const paths = Array.isArray(req.body?.paths) ? req.body.paths : [];
  for (const p of paths) {
    try {
      const rel = safePath(p);
      const full = path.join(uploadRoot, rel);
      if (full.startsWith(uploadRoot)) await fs.rm(full, { force: true });
    } catch { }
  }
  res.json({ success: true });
});

module.exports = { router, uploadRoot };
