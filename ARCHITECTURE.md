# Nth Watch — System Architecture

> **Who this is for:** an assistant (or engineer) who needs to understand how this project is put together — its services, how they talk to each other, what each one needs at runtime, and where state lives. It describes the system **as it currently exists**, including its target deployment environments.

---

## 1. What the product is

**Nth Watch** is a personalised movie-recommendation web app. Users sign up (email/password or Google), pick favourite genres/languages/mood during onboarding, then get recommendations from a hybrid ML model (collaborative filtering + content-based + a reinforcement-learning re-ranker). They can thumbs-up/down films, keep a Watchlist and Favourites, search films and people, and view film/person detail pages. Film artwork and metadata come from TMDB.

---

## 2. The three services at a glance

The project is **three separately-deployed services** plus managed third-party services.

| # | Service | Folder | Deployment Target | Tech Stack | Who calls it |
|---|---------|--------|-------------------|------------|--------------|
| 1 | **Frontend** (SPA) | `frontend/` | Vercel (static) | React 19 + Vite 8 + Tailwind 4 | The user's browser |
| 2 | **Backend API** | `backend/` | Vercel (Serverless Functions) | Node.js + Express 4 | The frontend (browser) |
| 3 | **ML microservice** | `flask/` | Render (Free Web Service) | Python 3.13 + Flask 3 | **Only the backend** |

```text
                               ┌──────────────────────── Browser ─────────────────────────┐
                               │  Frontend SPA (static JS/CSS/HTML built by Vite)          │
                               └───┬─────────────────────┬──────────────────────┬─────────┘
                                   │ REST + JWT          │ direct, API key      │ direct, unsigned
                                   │ (VITE_API_URL)      │ in bundle            │ upload preset
                                   ▼                     ▼                      ▼
┌──────────────────────────────────────────┐   ┌───────────────┐      ┌────────────────┐
│ Backend API  (Vercel Functions)          │   │ TMDB API +    │      │ Cloudinary     │
│  • auth (Stateless JWT, Google OAuth)    │   │ image CDN     │      │ (avatar images)│
│  • users / ratings / watchlist / favs    │   └───────────────┘      └───────▲────────┘
│  • proxies ML calls to Flask             │                                   │ admin API
│  • immediate hard-deletion of users      │───────────────────────────────────┘ (cleanup)
│  • sends email (nodemailer)              │──────► SMTP (Gmail by default)
└───────┬───────────────────────┬──────────┘
        │ SQL over TLS          │ HTTP, server-to-server (FLASK_URL), 15 s timeout
        ▼                       ▼
┌────────────────────┐   ┌──────────────────────────────────────────────┐
│ Neon PostgreSQL    │   │ Flask ML service (Render)                    │
│ (managed, remote)  │   │  • loads ~111 MB of joblib model files       │
│  movies (87,585)   │   │    into RAM at startup (~310 MB process)     │
│  users, ratings,   │◄──│  • stateless per request (RL bandit state    │
│  watchlist, favs,  │   │    is synced to Neon Postgres)               │
│  user_prefs,       │   │  • connects to Neon for bandit state;        │
│  bandit_state      │   │    requires X-Internal-Key                   │
└────────────────────┘   └──────────────────────────────────────────────┘
```

**Key facts about the topology**

- The **browser never calls Flask directly.** Every ML request goes browser → backend → Flask. Flask requires a shared secret in the `X-Internal-Key` header on every route except `/health` (returns 401 otherwise), and sends no CORS headers.
- **Flask connects to Neon Postgres** solely to persist its reinforcement learning (bandit) state. The core movie catalogue and features are read from static `.joblib` files on disk.
- The **backend** is completely stateless and serverless-ready.
- The **frontend also calls two third-party services directly from the browser**: TMDB (metadata and images) and Cloudinary (avatar upload).

---

## 3. Service 1 — Frontend (`frontend/`)

| Item | Value |
|------|-------|
| Framework | React 19, Vite 8 (`@vitejs/plugin-react`), Tailwind CSS 4 via `@tailwindcss/vite` |
| Scripts | `npm run dev`, `npm run build` |
| Output | A purely static bundle (HTML + JS + CSS + `public/` assets). No server-side rendering. |
| Routing | **Client-side routing** (SPA). Vercel is configured (`vercel.json`) to rewrite all paths to `index.html`. |
| Auth storage | JWT kept in `localStorage` (`token`), sent as `Authorization: Bearer <jwt>` to the backend. |

### Build-time environment variables

| Variable | Purpose |
|----------|---------|
| `VITE_API_URL` | Base URL of the backend API (also used for the Google sign-in redirect) |
| `VITE_TMDB_API_KEY` | TMDB v3 API key |
| `VITE_CLOUDINARY_CLOUD_NAME` | Cloudinary account for avatar uploads |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | **Unsigned** upload preset used from the browser |

### Google sign-in flow
1. Full-page navigation to `${VITE_API_URL}/api/auth/google`.
2. Backend redirects to `${FRONTEND_URL}?token=<jwt>`.
3. `AuthContext` reads `?token=`, stores it in `localStorage`, and strips it from the URL.

---

## 4. Service 2 — Backend API (`backend/`)

| Item | Value |
|------|-------|
| Target | Vercel (Serverless Functions), Fluid compute, Hobby plan (Singapore `sin1`) |
| Entry | `api/index.js` (exported for Vercel) |
| Process model | **Short-lived, stateless HTTP functions**. No in-memory sessions, no cron jobs. |

### Stateful / long-running behaviour
- **None**. The backend is completely stateless.
- **DB Migrations:** DDL is executed manually via `npm run migrate` (using `scripts/migrate.js`). It no longer runs automatically on boot.
- **User Deletion:** Hard-deletes users immediately using a Postgres transaction, followed by best-effort cleanup of Cloudinary avatars and a fire-and-forget notification email.

### Environment variables (runtime)

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL_UNPOOLED` | Neon Postgres connection string for migrations |
| `DATABASE_URL` | Neon Postgres connection string (pooled) |
| `JWT_SECRET` | Signs and verifies auth JWTs |
| `INTERNAL_API_KEY` | Shared secret sent to Flask as `X-Internal-Key` |
| `GOOGLE_CLIENT_ID` / `SECRET` | Google OAuth app credentials |
| `GOOGLE_CALLBACK_URL` | `<backend public URL>/api/auth/google/callback` |
| `FLASK_URL` | Base URL of the Flask ML service |
| `FRONTEND_URL` | The allowed CORS origin and target for OAuth redirects |
| `MAIL_USER` / `MAIL_PASS` / `MAIL_SERVICE` | SMTP credentials |
| `CLOUDINARY_CLOUD_NAME` / `KEY` / `SECRET` | Admin credentials to delete avatars |

### HTTP API
- **`/api/auth`**: Stateless JWT auth. Google OAuth callback redirects directly to the SPA.
- **`/api/movies`**: Proxies `/search`, `/popular`, and `/similar` to Flask. Connects to Postgres for `/tmdb/:id` and local IDs.
- **`/api/users`**: Profile management, ratings, watchlist, preferences. `DELETE /profile` immediately drops the user.
- **`/api/recommendations`**: Proxies `POST /` (recommendations) and `POST /feedback` (thumbs up/down) to Flask.

---

## 5. Service 3 — ML microservice (`flask/`)

| Item | Value |
|------|-------|
| Target | Render Free web service (Python 3.13, 512 MB RAM, 0.1 CPU, Singapore) |
| Entry | `app.py` |
| Process model | Ephemeral filesystem (wiped on restart). Model loaded into RAM at startup. |
| Env vars | `PORT`, `INTERNAL_API_KEY`, `DATABASE_URL` |

### Persistence and Concurrency
Because Render Free web services wipe their disks on restart, the Thompson-sampling bandit state (`rl_bandit.joblib`) can no longer rely on the local filesystem. 
- **Flask reads and writes the bandit state directly to Neon Postgres** using `DATABASE_URL`.
- The bandit state is pushed to the database asynchronously.

### Model artifacts (`flask/models/`)
~111 MB total of `.joblib` files (SVD model, TF-IDF vectorizer, movie maps). These are static and committed to the repository.

---

## 6. Data layer — Neon PostgreSQL

- A managed Postgres (Neon).
- Contains the static `movies` table (87,585 rows) and user-generated data (`users`, `user_ratings`, `watchlist`, `favourites`, `user_preferences`).
- Contains a `bandit_state` table managed by Flask to persist ML learning.

---

## 7. Cross-service URL coupling

| Setting | Lives in | Must point at / match |
|---------|----------|------------------------|
| `VITE_API_URL` | frontend | backend URL |
| `FRONTEND_URL` | backend | frontend URL |
| `GOOGLE_CALLBACK_URL` | backend | `<backend URL>/api/auth/google/callback` |
| `FLASK_URL` | backend | Flask URL |
| `INTERNAL_API_KEY` | backend + flask | matching shared secret |
