# Dockerfile
# Debian bookworm (Chromium runs normally here) + the shared libs Chromium needs,
# incl. libnss3 — the exact library that was missing on Vercel's serverless runtime.
# Uses full `puppeteer`, which downloads its own matching Chromium during npm install.
FROM node:22-bookworm-slim

# Chromium runtime dependencies (Puppeteer's Debian list).
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates fonts-liberation fonts-freefont-ttf fonts-noto-color-emoji \
      libasound2 libatk-bridge2.0-0 libatk1.0-0 libatspi2.0-0 libcairo2 libcups2 \
      libdbus-1-3 libdrm2 libexpat1 libfontconfig1 libgbm1 libgcc-s1 libglib2.0-0 \
      libgtk-3-0 libnspr4 libnss3 libpango-1.0-0 libpangocairo-1.0-0 libstdc++6 \
      libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 libxdamage1 libxext6 \
      libxfixes3 libxi6 libxkbcommon0 libxrandr2 libxrender1 libxshmfence1 libxss1 \
      libxtst6 lsb-release wget xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# Puppeteer caches its browser here; set before install so postinstall downloads it.
ENV PUPPETEER_CACHE_DIR=/app/.cache/puppeteer
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev
# Belt-and-suspenders: ensure the Chromium build is present even if postinstall was skipped.
RUN npx puppeteer browsers install chrome

COPY server.js ./

ENV NODE_ENV=production
# Railway sets PORT; default for local runs.
ENV PORT=3000
EXPOSE 3000
CMD ["node", "server.js"]
