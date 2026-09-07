# cm-render-service

A tiny, private **HTML → PDF** service (headless Chromium via Puppeteer) for the CM
dashboard report pipeline. It exists so report PDFs render on infrastructure we
control — report data is **never** sent to a third-party PDF vendor.

This is a standalone repo (no app code, no secrets) so it can be deployed on Railway
without granting access to any private repository.

## What it does

- `POST /render` with `{ "html": "<...>" }` → `application/pdf`.
  Prints with Letter size, `printBackground`, `preferCSSPageSize`, zero margins —
  matching the report template's original settings so the layout is pixel-identical.
  JavaScript is disabled and all external requests are aborted, so rendering is
  offline and deterministic (the incoming HTML already inlines its fonts).
- `GET /healthz` → `{ "ok": true }`.
- One Chromium is launched once and reused across requests.

## Security

Every `/render` request must send header `x-render-secret: <RENDER_SERVICE_SECRET>`.
Anything else gets `401`. Only the CM-dashboard Vercel function holds the secret.

## Deploy on Railway

1. New Railway project → **Deploy from GitHub repo** → this repo. Root directory `/`.
2. Railway detects the `Dockerfile` (see `railway.json`) and builds it.
3. Add a service variable: **`RENDER_SERVICE_SECRET`** = a long random string.
   (Railway injects `PORT` automatically; the server reads it.)
4. Deploy, then check `https://<service>.up.railway.app/healthz` → `{ "ok": true }`.

## Wire the Vercel app to it

In the `cm-dashboard` Vercel project set (Preview **and** Production):

- `RENDER_SERVICE_URL` = `https://<service>.up.railway.app` (base URL, no `/render`)
- `RENDER_SERVICE_SECRET` = the **same** secret set on Railway

## Local run

```bash
npm install
RENDER_SERVICE_SECRET=dev-secret npm start
curl -s -X POST http://localhost:3000/render \
  -H 'content-type: application/json' -H 'x-render-secret: dev-secret' \
  -d '{"html":"<h1>hi</h1>"}' -o out.pdf
```

## Docker

```bash
docker build -t cm-render-service .
docker run -p 3000:3000 -e RENDER_SERVICE_SECRET=dev-secret cm-render-service
```
