# Bible Pointer

A web dashboard for finding and presenting Bible passages (KJV), with **gapless,
self-hosted offline voice search** powered by Vosk.

## Features

- **Voice search** — speak a reference like *"Matthew twelve verse two"* or
  *"John three sixteen"*. Two engines (see [Voice](#how-voice-works)).
- **Reference search** — type `Gen 1:1`, `Matt 12:2-5`, `Psalms 23`, etc.
- **Reverse (keyword) search** — find verses by words or phrases.
- **Quick Browse** — Book / Chapter / Verse dropdowns.
- **Presentation tab** — a clean full-screen display (`display.html`) that updates
  live via `BroadcastChannel` for projecting verses.
- **History & saved verses**, plus **Read Aloud** (text-to-speech).

## How voice works

Voice has two engines; the app picks the best one automatically:

1. **Vosk (preferred)** — when the Python backend (`server.py`) is running, the
   browser streams microphone audio over a `/asr` WebSocket to a local Vosk
   recognizer. This is **gapless** (one continuous stream, no restarts),
   **fully offline** (no cloud, no per-use cost), and works in **every browser**
   (including Firefox/Safari/mobile). Recognition is grammar-constrained to Bible
   vocabulary, so number homophones ("two" vs "to") resolve correctly.
2. **Web Speech API (fallback)** — if no Vosk backend is reachable (e.g. you opened
   the plain static files), it falls back to the browser's built-in engine
   (Chrome/Edge only, needs internet, brief restart gaps).

Browsing and typed search are always 100% offline regardless of engine.

### Speech model (and accents)

`get-model.py` defaults to **`en-us-0.22-lgraph`** (~128 MB) — a larger acoustic
model that handles non-US/African accents noticeably better than the tiny model,
while still supporting the Bible grammar + gapless streaming. To switch:

```bash
rm -rf model
python get-model.py small     # lightest (~40 MB), lower accuracy
python get-model.py lgraph    # default (~128 MB), better with accents
python get-model.py indian    # Indian English (~36 MB)
```

The model path is also configurable via the `VOSK_MODEL` env var, so you can keep
several models on disk and A/B test which transcribes your users best.

## Run it locally (with offline voice)

Requires **Python 3.9+**.

```bash
pip install -r requirements.txt
python get-model.py          # one-time: downloads the Vosk model into ./model
python server.py             # serves the app + voice backend on http://localhost:8080
```

Open **http://localhost:8080**, click the mic, allow it, and say a reference.

> The bundled `model/` folder already contains the model, so you can usually skip
> `get-model.py`. Run it only on a fresh machine that has no `model/`.

### Static-only (no offline voice)

```bash
npm run static     # npx serve .  -> http://localhost:3000
```

This serves only the static files, so voice uses the Web Speech fallback
(Chrome/Edge + internet). Good for a quick UI preview.

> Note: the microphone only works over **https://** or **http://localhost** — never
> from a `file://` page.

## Deploy to a VPS (public, with HTTPS)

The microphone requires HTTPS on a public domain, so put the app behind a TLS
reverse proxy. Example with **Caddy** (auto HTTPS) + **systemd**:

```bash
# On the server (Debian/Ubuntu):
sudo apt update && sudo apt install -y python3 python3-venv python3-pip git
sudo mkdir -p /opt/bible-pointer && sudo chown $USER:$USER /opt/bible-pointer

# Get the code (clone your repo, or scp the folder here):
git clone YOUR_REPO_URL /opt/bible-pointer
cd /opt/bible-pointer

# Python deps in a virtualenv (avoids PEP 668 "externally-managed" errors):
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
./venv/bin/python get-model.py            # downloads the Vosk model

# Run as a service (listens on 127.0.0.1:8080):
sudo cp deploy/bible-pointer.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now bible-pointer
systemctl status bible-pointer            # should be "active (running)"
```

Then put it behind HTTPS with **either** nginx **or** Caddy:

```bash
# Option A — nginx + Let's Encrypt (edit the domain in deploy/nginx.conf first):
sudo apt install -y nginx certbot python3-certbot-nginx
sudo cp deploy/nginx.conf /etc/nginx/sites-available/bible-pointer
sudo ln -s /etc/nginx/sites-available/bible-pointer /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d your-domain.com   # fetches cert, adds HTTPS + redirect, auto-renews

# Option B — Caddy (auto HTTPS; edit the domain in deploy/Caddyfile first):
sudo cp deploy/Caddyfile /etc/caddy/Caddyfile && sudo systemctl restart caddy
```

Then browse to `https://your-domain.com`. Point your domain's DNS at the VPS first,
and open ports 80/443 (e.g. `sudo ufw allow 'Nginx Full'`). The reverse proxy must
forward the `/asr` WebSocket upgrade headers — both `deploy/nginx.conf` and
`deploy/Caddyfile` already do.

## Updating the Bible data

`bible-data.js` (loaded by the page) is generated from a public KJV source:

```bash
npm run fetch-data   # node download.js -> regenerates bible-data.js
```

## Files

| File | Purpose |
|------|---------|
| `index.html` | Main dashboard UI |
| `app.js` | App logic: dual-engine voice, parsing, search, TTS, history, bookmarks |
| `styles.css` | Styling |
| `bible-data.js` | Offline KJV scripture data (`BIBLE_DATA`) |
| `display.html` | Standalone presentation/projection screen |
| `server.py` | Python backend: serves the app + `/asr` Vosk WebSocket |
| `get-model.py` | Downloads the Vosk model into `./model` |
| `requirements.txt` | Python deps (`vosk`, `aiohttp`) |
| `model/` | Vosk speech model (gitignored; fetched by `get-model.py`) |
| `deploy/Caddyfile` | Example HTTPS reverse-proxy config |
| `deploy/bible-pointer.service` | Example systemd unit |
| `download.js` | Dev utility to regenerate the Bible data |
