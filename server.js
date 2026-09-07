// server.js
// Private, self-hosted Chromium HTML→PDF service (runs on our own Railway infra).
// Only the CM-dashboard Vercel function calls it, authenticated with a shared secret
// (RENDER_SERVICE_SECRET). Report data never leaves infrastructure we control.
//
// One real Chromium (full `puppeteer`, browser bundled in the Docker image) is
// launched once and reused across requests. PDF options are IDENTICAL to the old
// in-function puppeteer settings, so the locked Hotel Weekly layout is pixel-for-pixel.

import express from 'express';
import puppeteer from 'puppeteer';

const SECRET = process.env.RENDER_SERVICE_SECRET || '';
const PORT = process.env.PORT || 3000;

// Launch Chromium once; reuse. If a launch fails, clear the promise so the next
// request retries instead of being stuck on a rejected singleton.
let browserPromise = null;
function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      })
      .catch((e) => { browserPromise = null; throw e; });
  }
  return browserPromise;
}

const app = express();
// The report HTML inlines its fonts as base64 data: URIs, so bodies can be large.
app.use(express.json({ limit: '25mb' }));

app.get('/healthz', (_req, res) => res.status(200).json({ ok: true }));

app.post('/render', async (req, res) => {
  if (!SECRET || req.get('x-render-secret') !== SECRET) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const html = req.body && req.body.html;
  if (typeof html !== 'string' || html.length === 0) {
    res.status(400).json({ error: 'html (string) is required' });
    return;
  }

  let page = null;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    // The HTML is fully self-contained (fonts inlined, no scripts). Disable JS and
    // abort ANY external request, so rendering is offline, deterministic, and the
    // service never reaches out to the network on behalf of a page.
    await page.setJavaScriptEnabled(false);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (u.startsWith('data:') || u.startsWith('about:') || u.startsWith('file:')) r.continue();
      else r.abort();
    });
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30000 });
    const pdf = await page.pdf({
      format: 'Letter',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
      preferCSSPageSize: true,
    });
    res.setHeader('Content-Type', 'application/pdf');
    res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    res.status(500).json({ error: String((e && e.message) || e) });
  } finally {
    if (page) { try { await page.close(); } catch { /* ignore */ } }
  }
});

app.listen(PORT, () => console.log(`render-service listening on :${PORT}`));
