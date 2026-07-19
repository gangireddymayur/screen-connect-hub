const fs = require('fs/promises');
const path = require('path');
const router = require('express').Router();

const uploadRoot = process.pkg
  ? path.join(path.dirname(process.execPath), 'uploads')
  : path.resolve(__dirname, '../../uploads');

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

async function fetchAndCacheCloudUpload(requestedPath, cloudUrl) {
  const rel = safePath(requestedPath);
  const full = path.join(uploadRoot, rel);
  if (!full.startsWith(uploadRoot)) throw new Error('Invalid upload path');

  const sourceUrl = `${String(cloudUrl).replace(/\/+$/, '')}/uploads/${rel
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const response = await fetch(sourceUrl);
  if (!response.ok) {
    const error = new Error(`Cloud upload returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, buffer);
  return {
    buffer,
    contentType: response.headers.get('content-type') || 'application/octet-stream',
    relativePath: rel,
  };
}

async function syncCloudUploads(payload, cloudUrl) {
  // Collect every upload reference in the one-time backup, including URLs
  // nested inside layout_data widgets. No cloud fetches happen after this
  // bootstrap function finishes.
  const urls = [];
  const collectUploadUrls = (value) => {
    if (typeof value === 'string') {
      if (value.includes('/uploads/')) urls.push(value);
      if ((value.startsWith('{') || value.startsWith('[')) && value.includes('/uploads/')) {
        try { collectUploadUrls(JSON.parse(value)); } catch { }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(collectUploadUrls);
      return;
    }
    if (value && typeof value === 'object') {
      Object.values(value).forEach(collectUploadUrls);
    }
  };
  collectUploadUrls(payload);

  const paths = [...new Set(urls.map((value) => {
    try {
      const parsed = new URL(String(value), cloudUrl);
      const marker = '/uploads/';
      const index = parsed.pathname.indexOf(marker);
      return index >= 0 ? decodeURIComponent(parsed.pathname.slice(index + marker.length)) : null;
    } catch {
      return null;
    }
  }).filter(Boolean))];

  let synced = 0;
  for (const rel of paths) {
    try {
      await fetchAndCacheCloudUpload(rel, cloudUrl);
      synced += 1;
    } catch (error) {
      console.warn(`[cloud-assets] Could not cache ${rel}: ${error.message}`);
    }
  }
  console.log(`[cloud-assets] Cached ${synced}/${paths.length} cloud uploads locally.`);
  return { synced, total: paths.length };
}

module.exports = {
  router,
  uploadRoot,
  safePath,
  fetchAndCacheCloudUpload,
  syncCloudUploads,
};
