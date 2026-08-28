# Journaly — Deployment (Docker + CI/CD)

Self-hosted on an **Oracle Cloud Always Free** VM — genuinely free forever
(no time limit, no card charges as long as you stay within the Always Free
shape/resource limits), and it's a real VM so it never sleeps like PaaS free
tiers (Render, Railway, Fly) do.

## Architecture

```
                      ┌──────────────────────────────────────┐
  Internet  ──:80/443─│  web  (caddy — TLS termination)       │
                      │   ├─ FRONTEND_DOMAIN → SPA (Vite build)│
                      │   ├─ API_DOMAIN → backend               │
                      │   └─ /media       → media volume       │
                      │                                        │
                      │  backend (Django + Daphne :8000)       │
                      │   └─ migrate on start, single process  │
                      │                                        │
                      │  db  (postgres:16, volume pgdata)      │
                      │   └─ internal only, never published    │
                      └──────────────────────────────────────┘
```

* **Live URLs:** frontend `https://<FRONTEND_DOMAIN>`, backend
  `https://<API_DOMAIN>`. No custom domain is required — the VM's public IP
  is exposed via [sslip.io](https://sslip.io) (a free wildcard DNS service:
  `129-225-91-43.sslip.io` resolves to `129.225.91.43`), so both hostnames
  are real, publicly resolvable names that Caddy can get Let's Encrypt certs
  for. If you buy a real domain later, just point it at the VM's IP and
  update `FRONTEND_DOMAIN`/`API_DOMAIN` in `.env`.
* **Caddy terminates TLS itself** (automatic HTTPS, auto-renewing) — there's
  no host nginx layer, `web` binds ports 80/443 directly.
* **Media** is served directly by Caddy from the shared `media` volume.
* **Static** (Django admin / DRF) is collected at image build and served by
  whitenoise via the backend.
* The VM has **1 vCPU / 1GB RAM** (Oracle's `VM.Standard.A1.Flex` free shape
  was out of capacity at signup time in this region — revisit later if you
  want more headroom). A 2GB swap file is provisioned so builds and Postgres
  don't OOM; each service has a `mem_limit` in `docker-compose.yml` so one
  container can't starve the others.
* **Oracle-specific gotcha:** the Ubuntu image ships with `iptables` rules
  that allow only SSH (22) by default — the cloud console's Security List
  is not enough on its own. Ports 80/443 were opened at both layers during
  setup; if you ever re-image the VM, redo both.

## Files

| File | Purpose |
|------|---------|
| `docker-compose.yml` | the 3-service stack (db / backend / web) |
| `deploy/backend.Dockerfile` | Django image (collectstatic at build, migrate on start) |
| `deploy/web.Dockerfile` | Vite build → Caddy image |
| `deploy/Caddyfile` | reverse proxy + SPA + media + automatic HTTPS |
| `deploy/entrypoint.sh` | wait-for-db, migrate, run daphne |
| `deploy/deploy.sh` | server-side deploy (git reset + rebuild), used by CI |
| `.env` | **secrets, not committed** — lives only on the server |
| `.env.example` | template for `.env` |
| `.github/workflows/deploy.yml` | test → deploy-over-SSH |

## Manual operations (on the server)

```bash
cd /home/ubuntu/Journal
docker compose up -d --build      # build & start
docker compose ps                 # status
docker compose logs -f backend    # logs
docker compose exec backend python manage.py createsuperuser
bash deploy/deploy.sh             # full redeploy (what CI runs)
```

## CI/CD (GitHub Actions)

On every push to `main`: run tests, then SSH into the server and run
`deploy/deploy.sh`. Required repository **secrets**
(Settings → Secrets and variables → Actions):

| Secret | Value |
|--------|-------|
| `SSH_HOST` | the VM's public IP |
| `SSH_USER` | `ubuntu` |
| `SSH_KEY`  | the **private** SSH key generated when creating the instance (whole file, incl. BEGIN/END lines) |

## Domains & HTTPS

* No DNS purchase needed — `sslip.io` gives free hostnames that resolve to
  the VM's public IP (see Architecture above).
* Caddy requests and renews Let's Encrypt certificates automatically for
  both `FRONTEND_DOMAIN` and `API_DOMAIN` the first time it starts, as long
  as ports 80/443 are reachable from the internet (needed for the ACME
  HTTP-01 challenge).

## Oracle Cloud specifics

* **Always Free** means these resources are $0 forever as long as you don't
  upgrade to Paid tier and stay within the free shape's limits — no
  surprise charges.
* If the VM ever needs to be recreated, remember to reopen ports 80/443 in
  **both** the VCN Security List (console) and the instance's local
  `iptables` (`sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT`, same for
  443, then `sudo netfilter-persistent save`) — the console rule alone is
  not sufficient.

## Still optional (Telegram bot / Web Push)

Set `TELEGRAM_BOT_TOKEN` (+ a `TELEGRAM_WEBHOOK_SECRET`) and generate VAPID
keys in `.env`, `docker compose up -d`, then
`docker compose exec backend python manage.py set_telegram_webhook`
(webhook host = `https://<API_DOMAIN>`).
