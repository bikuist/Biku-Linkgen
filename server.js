const express = require('express');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const TEMPLATES = path.join(__dirname, 'templates');
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const BUCKET = 'site-pages';

if (!/^https:\/\/[a-z0-9.-]+$/i.test(SUPABASE_URL) || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variable.');
  process.exit(1);
}
const storageBase = `${SUPABASE_URL}/storage/v1/object/${BUCKET}`;
const storageHeaders = {
  apikey: SUPABASE_SERVICE_ROLE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
};

app.disable('x-powered-by');
app.set('trust proxy', 1); // Koyeb terminates HTTPS at its proxy.
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use((req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny', index: 'index.html' }));
app.use('/api/generate', rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-7', legacyHeaders: false, message: { error: 'Generation limit reached. Try again later.' } }));
app.use('/api', express.json({ limit: '2kb', strict: true }));

function requireSameOrigin(req, res, next) {
  const origin = req.get('origin');
  if (origin) {
    try {
      if (new URL(origin).host !== req.get('host')) return res.status(403).json({ error: 'Cross-origin request blocked.' });
    } catch { return res.status(403).json({ error: 'Invalid request origin.' }); }
  }
  next();
}

app.get('/api/templates', async (_req, res) => {
  try {
    const entries = await fs.readdir(TEMPLATES, { withFileTypes: true });
    const templates = entries
      .filter(entry => entry.isFile() && /^[a-zA-Z0-9_-]+\.html$/.test(entry.name))
      .map(entry => entry.name.slice(0, -5));
    res.json({ templates });
  } catch (error) {
    console.error('List templates:', error);
    res.status(500).json({ error: 'Unable to list templates.' });
  }
});

app.post('/api/generate', requireSameOrigin, async (req, res) => {
  const template = req.body?.template;
  if (typeof template !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(template)) {
    return res.status(400).json({ error: 'Invalid template.' });
  }
  try {
    const html = await fs.readFile(path.join(TEMPLATES, `${template}.html`));
    const id = crypto.randomUUID();
    const upload = await fetch(`${storageBase}/${id}/index.html`, {
      method: 'POST',
      headers: { ...storageHeaders, 'Content-Type': 'text/html; charset=utf-8', 'x-upsert': 'false' },
      body: html,
      signal: AbortSignal.timeout(20000)
    });
    if (!upload.ok) {
      console.error('Supabase upload failed:', upload.status, await upload.text());
      return res.status(502).json({ error: 'Could not save the generated website. Check Supabase setup.' });
    }
    res.status(201).json({ id, url: `/sites/${id}/` });
  } catch (error) {
    if (error.code === 'ENOENT') return res.status(404).json({ error: 'That template was not found.' });
    console.error('Generate site:', error);
    res.status(500).json({ error: 'Could not generate website.' });
  }
});

app.get('/sites/:id/', async (req, res) => {
  if (!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(req.params.id)) return res.sendStatus(404);
  try {
    const response = await fetch(`${storageBase}/${req.params.id}/index.html`, {
      headers: storageHeaders,
      signal: AbortSignal.timeout(20000)
    });
    if (response.status === 404 || response.status === 400) return res.sendStatus(404);
    if (!response.ok) {
      console.error('Supabase read failed:', response.status);
      return res.sendStatus(502);
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('X-Content-Type-Options', 'nosniff');
    res.set('Referrer-Policy', 'no-referrer');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    console.error('Read generated site:', error);
    res.sendStatus(502);
  }
});

app.listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));
