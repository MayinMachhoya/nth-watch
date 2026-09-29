# Deployment Guide: Nth Watch

This document explains how to deploy Nth Watch across Render, Vercel, and Neon, as well as how to manage secrets and execute initial migrations.

## 1. Prerequisites & Services

You will need accounts on:
- **Neon** (Postgres Database)
- **Render** (Flask ML microservice)
- **Vercel** (Frontend and Backend API)
- **Google Cloud Console** (OAuth)
- **Cloudinary** (Image Uploads/Avatars)
- **TMDB** (Movie Data API)

## 2. Environment Variables & Secrets Reference

Each service requires specific environment variables. **Do not commit these secrets to version control.**

### Backend API (Vercel)
| Variable | Secret? | Description |
|----------|---------|-------------|
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `DATABASE_URL_UNPOOLED` | Yes | Neon unpooled connection string (for migrations) |
| `JWT_SECRET` | Yes | Secret for signing JWTs |
| `INTERNAL_API_KEY` | Yes | Custom shared secret for backend-to-flask communication |
| `GOOGLE_CLIENT_ID` | No | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | Yes | Google OAuth Client Secret |
| `GOOGLE_CALLBACK_URL` | No | `https://<your-backend-domain>.vercel.app/api/auth/google/callback` |
| `FLASK_URL` | No | Render service URL (e.g., `https://<your-flask-app>.onrender.com`) |
| `FRONTEND_URL` | No | Vercel frontend URL (e.g., `https://<your-frontend-app>.vercel.app`) |
| `MAIL_USER` | Yes | SMTP user |
| `MAIL_PASS` | Yes | SMTP password |
| `MAIL_SERVICE` | No | SMTP service (e.g. `gmail`) |
| `CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Yes | Cloudinary API Key |
| `CLOUDINARY_API_SECRET` | Yes | Cloudinary API Secret |
| `DB_POOL_MAX` | No | e.g. `2` (Keep low for Vercel Hobby limits) |

### Frontend (Vercel)
| Variable | Secret? | Description |
|----------|---------|-------------|
| `VITE_API_URL` | No | Backend Vercel URL (e.g., `https://<your-backend-app>.vercel.app`) |
| `VITE_TMDB_API_KEY` | No* | TMDB API Key (*visible to browser, secure via referrer if possible) |
| `VITE_CLOUDINARY_CLOUD_NAME` | No | Cloudinary cloud name |
| `VITE_CLOUDINARY_UPLOAD_PRESET` | No | Unsigned upload preset string |

### ML Microservice (Render)
| Variable | Secret? | Description |
|----------|---------|-------------|
| `PYTHON_VERSION` | No | `3.13.0` |
| `DATABASE_URL` | Yes | Neon pooled connection string |
| `INTERNAL_API_KEY` | Yes | Same shared secret as the backend |

## 3. Deployment Order & Steps

### Step 1: Database (Neon)
1. Create a new Neon project (Singapore region).
2. Note your unpooled and pooled connection strings.

### Step 2: Flask ML Service (Render)
1. Create a new **Web Service** on Render.
2. Select the repository and set root directory to `flask`.
3. Set the region to Singapore.
4. Set the Build Command: `pip install -r requirements.txt`
5. Set the Start Command: `gunicorn -w 1 -b 0.0.0.0:$PORT app:app` (or just `python app.py`)
6. Add the environment variables (`DATABASE_URL`, `INTERNAL_API_KEY`, `PYTHON_VERSION`).
7. **External Pinger**: Render Free spins down after 15 minutes of inactivity. Set up an external service (e.g. UptimeRobot) to ping `https://<your-flask-app>.onrender.com/health` every 14 minutes.

### Step 3: Backend API (Vercel)
1. Import the repository in Vercel.
2. Set the **Root Directory** to `backend`.
3. Set the region to `sin1` (Singapore) in the Project Settings.
4. Add all Backend environment variables. Set `FLASK_URL` to the Render URL from Step 2.
5. Deploy.

### Step 4: Run Initial Migrations
Once the backend is deployed, you must initialize the tables in Neon. You can run this locally using the unpooled URL:
```bash
cd backend
DATABASE_URL_UNPOOLED="<your-unpooled-neon-url>" npm run migrate
```
*(Alternatively, you can run this command directly from the Vercel dashboard if configured.)*

### Step 5: Google Cloud Console
1. Go to your Google Cloud Console > APIs & Services > Credentials.
2. Update the Authorized Redirect URIs for your OAuth client to include the deployed backend URL:
   `https://<your-backend-app>.vercel.app/api/auth/google/callback`

### Step 6: Frontend (Vercel)
1. Import the repository in Vercel again as a new project.
2. Set the **Root Directory** to `frontend`.
3. Add the Frontend environment variables. Set `VITE_API_URL` to the Backend URL from Step 3.
4. Deploy.

### Step 7: Final Loop Closure
Update the `FRONTEND_URL` in your Backend Vercel project to exactly match the newly deployed Frontend URL (this ensures CORS and OAuth redirects work correctly). Redeploy the backend if necessary.

## 4. Smoke-Test Checklist

After everything is live, perform the following checks:
- [ ] **Sign up via Email**: Registers successfully and logs in.
- [ ] **Sign up via Google**: Redirects correctly to Google and back to the app without CORS errors.
- [ ] **Onboarding**: Successfully saves genre/mood preferences.
- [ ] **Recommendations (Flask Sync)**: The main feed loads properly (indicating backend successfully communicated with Render Flask, and Flask didn't time out).
- [ ] **Thumbs Up/Down**: Clicking a rating triggers a `/feedback` request to Flask, which succeeds without 500 errors (verifying Flask can write to Neon).
- [ ] **Avatar Upload**: Profile picture uploads successfully via Cloudinary.
- [ ] **Account Deletion**: Going to Settings > Delete Account successfully hard-deletes the user and logs you out immediately.
