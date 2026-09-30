# GCAM Scenario Tracker

A React research dashboard backed by a Flask JSON API, Google Sheets, and Google Drive.

## Architecture

```text
Browser → Caddy / React frontend → Flask / Gunicorn → Google Sheets + Drive
Zaratan → /ingest_logs + X-Ingest-Token ────────────→ Flask
```

Production runs **two containers on one Lightsail Linux instance**. Caddy serves the
React build, password-protects the website and `/api/*`, and manages HTTPS. The
backend's port is not published. Google credentials are mounted only into the backend.

- **Frontend:** React, Vite, React Router, TanStack Table, React Select, Radix Dialog, Sonner, Lucide icons.
- **Backend:** Flask, one synchronous Gunicorn worker, existing GCAM parsing and Google integrations.
- **Storage:** Sheets for records; Drive for configuration XML. Input uploads store metadata only.
- **Deploy:** Docker Compose; images can be transferred as a compressed archive without a registry.

**[Full Lightsail deployment instructions →](deploy/README.md)**

## Repository layout

| Path | Purpose |
| --- | --- |
| `backend/app.py` | JSON API, GCAM processing, and Google integration |
| `backend/Dockerfile` | Python production image |
| `frontend/src/` | React UI and shared components |
| `frontend/Caddyfile` | Production authentication, routing, HTTPS |
| `frontend/Dockerfile` | React build followed by a small Caddy runtime |
| `compose.yaml` | Image-only production deployment |
| `compose.local.yaml` | Local, offline container preview |
| `compose.google.yaml` | Optional local overlay for testing with Google credentials |
| `.env.example` | Deployment settings, with no real credentials |
| `scripts/build-images.sh` | Build and export both images |
| `migrate_configs_to_drive.py` | Optional migration of older Sheet-backed configurations to Drive |
| `tests/` | API regression tests with mocked Google clients |
| `frontend/tests/` | Playwright browser tests with fixture API responses |
| `zaratan_sender/` | Existing external log sender |

The backend entry point is `backend.app:app`. The old Flask templates/static assets,
Render launch files, and root compatibility entry point have been retired.
The Drive migration script imports the backend directly; support for reading older
Sheet-backed configurations remains available.

Local cleanup copies are kept in `.local-archive/`, ignored by Git and Docker.
Each archive includes restoration instructions and preserves uncommitted changes.
The earlier image export was also archived because it predates the current UI;
run `bash scripts/build-images.sh 1.0.0` to create a fresh deployment bundle.

## Local container preview — no Google credentials needed

Prerequisite: Docker Engine/Desktop with Compose v2, using Linux containers.

```bash
docker compose --env-file /dev/null -f compose.local.yaml up --build -d
```

Open **http://localhost:8080**. This offline preview deliberately displays an
actionable Google connection error rather than fabricated research data. It does
not load your existing `.env`, authenticate users, or contact Google. Published
ports bind only to `127.0.0.1`. On Windows, run these commands in WSL/Git Bash, or
substitute a separate empty file for `/dev/null` in PowerShell.

```bash
docker compose --env-file /dev/null -f compose.local.yaml logs -f
docker compose --env-file /dev/null -f compose.local.yaml down
```

This local configuration is **not** the production deployment. Use `compose.yaml`
and [the guide](deploy/README.md) for team authentication and HTTPS.

### Test real functionality locally with Docker

Keep your existing `.env`; do not overwrite it with `.env.example`. Set
`GOOGLE_SHEET_ID` and `DRIVE_CONFIGS_FOLDER_ID` to a **test copy** of your Sheet and
a test Drive folder. The local overlay accepts the existing
`GOOGLE_CREDENTIALS_BASE64` or `GOOGLE_APPLICATION_CREDENTIALS_JSON` credential format.
Neither value is passed to the frontend. If you use a standalone credential file
instead, use the Python development instructions below or the production secret mount.

```bash
docker compose --env-file .env -f compose.local.yaml -f compose.google.yaml up -d
```

Open **http://localhost:8080**. This configuration makes real Google writes when you
save/upload/delete. It stays bound to localhost and omits the production password
prompt. Use a test Sheet while Render is still writing to production.

```bash
docker compose --env-file .env -f compose.local.yaml -f compose.google.yaml logs -f backend
docker compose --env-file .env -f compose.local.yaml -f compose.google.yaml down
```

If you change source code, add `--build` to the `up` command. If you change `.env`,
run `up -d` again so Compose recreates the backend with the new configuration.

Suggested manual acceptance checks: compare a few existing records with Render;
search/filter/sort; edit and reload; upload a disposable configuration; inspect
linked inputs; download XML; export a multi-scenario comparison; upload input
metadata; delete the disposable scenario and verify shared inputs remain. Verify
Zaratan against a test Sheet with a separate token before switching its production URL.

## Local development with a test Sheet

Use a copy of the Sheet and a separate Drive folder. The API performs real writes
when you edit, upload, delete, or ingest logs. Never run concurrent writers against
the production Sheet while Render is active.

Backend (Python 3.12):

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
export GOOGLE_SHEET_ID='your-test-sheet-id'
export DRIVE_CONFIGS_FOLDER_ID='your-test-folder-id'
export GOOGLE_APPLICATION_CREDENTIALS='/absolute/path/to/service-account.json'
export INGEST_TOKEN='your-development-ingestion-token'
gunicorn backend.app:app --bind 127.0.0.1:8000 --workers 1 --timeout 180
```

Alternatively, explicitly set `LOAD_DOTENV=1` to load the existing root `.env`.
Environment variables take precedence. The API also accepts the existing
`GOOGLE_CREDENTIALS_BASE64` and `GOOGLE_APPLICATION_CREDENTIALS_JSON` formats.
Imports alone never connect to Google; the first data request initializes Sheets.
Failed initialization is retried after 15 seconds.

Frontend (Node 22.12+):

```bash
cd frontend
npm ci
npm run dev
```

Open **http://localhost:5173**. Vite proxies `/api` to the backend on port 8000.
Set `API_PROXY_TARGET` when the backend runs elsewhere. Do not expose the Vite
development server to the internet; production access control lives in Caddy.
No Google keys, ingestion tokens, or passwords belong in frontend environment variables.

## Build deployable images

```bash
bash scripts/build-images.sh 1.0.0
```

Produces `gcam-tracker-frontend:1.0.0`, `gcam-tracker-backend:1.0.0`, and
`artifacts/gcam-tracker-1.0.0.tar.gz`. Default architecture is `linux/amd64`, matching
the standard Lightsail Linux instance. On Apple Silicon this uses Docker's
cross-platform build support. Change `PLATFORM` only if your destination supports it.

Exported images contain application code and repository mapping CSVs, **not** Google
credentials, your `.env`, the Git history, or live Sheet data. Keep image archives
private if your mapping CSVs contain internal information.

## Tests

API tests never contact Google and run with networking disabled:

```bash
docker build -f backend/Dockerfile -t gcam-tracker-backend:1.0.0 .
docker run --rm --network none \
  -v "$PWD/tests:/tests:ro" -e PYTHONPATH=/app \
  gcam-tracker-backend:1.0.0 python -m unittest discover -s /tests -v
```

Frontend tests:

```bash
cd frontend
npm ci
npm test
npx playwright install chromium
npm run test:e2e
npm run build
```

Or use the provided browser-test image (requires no host Node or browser):

```bash
docker build -f frontend/Dockerfile.test -t gcam-tracker-ui-tests:local frontend
docker run --rm --ipc=host gcam-tracker-ui-tests:local
```

End-to-end tests cover filters, sorting, pagination, selection, editing, failure
recovery, multipart uploads, deep links, comparison downloads, deletion confirmation,
and desktop/mobile layout. Their fixture records are not included in the production build.

After both production images are built, test the real Caddy-to-Gunicorn routing and
password boundary with temporary offline containers:

```bash
python3 scripts/smoke-containers.py
```

## API contract

All browser API responses are JSON except XML/XLSX downloads. Errors include
`{"status":"error","message":"..."}` with a non-2xx status. Browser writes require
`X-Requested-With: GCAM-Tracker`. There is no permissive CORS configuration.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/data` | Dashboard records, counts, projects |
| GET | `/api/data?refresh=1` | Invalidate the 60-second cache and reload |
| GET | `/api/health` | Google-backed readiness check using the data cache |
| GET | `/api/mappings` | Project/person mappings |
| GET / PATCH / DELETE | `/api/scenarios/<id>` | Read, edit, delete a scenario |
| GET / PATCH | `/api/inputs/<id>` | Read/edit input metadata |
| POST | `/api/uploads/configuration` | Multipart `config_file` XML |
| POST | `/api/uploads/input` | Multipart `input_file` XML; metadata only |
| GET | `/api/scenarios/<id>/configuration` | Download configuration XML |
| GET | `/api/comparisons?ids=a,b` | Scenario/input membership data |
| GET | `/api/comparisons/export?ids=a,b` | Excel summary and presence matrix |
| POST | `/ingest_logs` | Existing Zaratan JSON contract; `X-Ingest-Token` required |
| GET | `/health` | Container-internal Flask liveness, no Google call |

The old destructive maintenance GET endpoints are not registered. Their operations
are available as POST `/api/admin/migrate_folder_locations`,
`/api/admin/cleanup_orphaned_junctions`, and `/api/admin/add_zaratan_columns` **only**
when `ENABLE_MAINTENANCE_API=1`. Production Compose disables these by default.

## Operational limits

- Keep **one synchronous worker and one backend replica**. Sheet writes, ID generation,
  and the process-local cache are not designed for concurrent writers.
- Requests, including multipart overhead, are limited to **50 MiB**. Gunicorn allows
  180 seconds per request. Large uploads and exports temporarily delay other requests.
- Google Sheets and Drive operations are not a transaction. A failed multi-step
  operation can leave partial data; inspect/refresh before retrying.
- The existing ingestion contract can report `scenarios_error` or configuration
  errors in an HTTP 200 response after raw logs have been stored. The existing sender
  deletes files on HTTP 200. Preserve an upstream log archive and inspect response
  bodies during cutover; this migration does not redesign ingestion replay semantics.
- Deleting scenarios retains archived Drive files, while removing legacy Sheet-backed
  configuration content and orphaned input metadata as before.
- A server snapshot does not back up Google Sheets/Drive.
