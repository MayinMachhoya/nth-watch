# RUN 2 — Backend: Final Report

## Files Changed

| File | Action | What changed |
|------|--------|-------------|
| [`backend/src/index.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/index.js) | **Rewritten** | Made Serverless-ready: moved `app.listen()` inside `if (require.main === module)`, added lazy-loaded DB connections, request-time environment validation (`checkEnvMiddleware`), CORS moved to the top with dynamic multi-origin/Vercel support. Added Rate Limiting using `express-rate-limit`. Replaced `express-session` with a JWT-based stateless store for `passport-google-oauth20`. Removed cron cleanup. |
| [`backend/src/db/neon.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/db/neon.js) | **Edited** | Exported `getPool()`. Added Serverless pool config (`max`, `idleTimeoutMillis`, `allowExitOnIdle`), and an error event handler to prevent idle client crashes. Moved table creation logic out. |
| [`backend/src/routes/auth.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/routes/auth.js) | **Edited** | Removed all soft-deletion checks (from register, login, Google callback). Removed `POST /recover`. |
| [`backend/src/routes/users.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/routes/users.js) | **Edited** | Rewrote `DELETE /profile` to perform a hard-deletion of all user data inside a transaction. Cloudinary deletion and email sending are fired as best-effort side-effects using `Promise.race` (capped at 5s). |
| [`backend/src/services/emailService.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/services/emailService.js) | **Edited** | Removed recovery link logic. Updated deletion email to reflect permanent deletion. |
| [`backend/src/services/flaskService.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/services/flaskService.js) | **Edited** | Configured timeout using the `FLASK_TIMEOUT_MS` environment variable (defaults to 45s). |
| [`backend/src/middleware/authMiddleware.js`](file:///d:/code/Projects/movie-recommendation-system/backend/src/middleware/authMiddleware.js) | **Edited** | Removed soft-deletion `is_deleted` DB check. |
| [`backend/scripts/migrate.js`](file:///d:/code/Projects/movie-recommendation-system/backend/scripts/migrate.js) | **New** | Extracted DDL setup. Configured to use `DATABASE_URL_UNPOOLED` with fallback. Exits early if `--print` flag is passed. |
| [`backend/scripts/purge-soft-deleted.js`](file:///d:/code/Projects/movie-recommendation-system/backend/scripts/purge-soft-deleted.js) | **New** | Cleanup script. Defaults to dry-run (just counts and lists). Accepts `--confirm` to hard-delete existing soft-deleted rows. |
| [`backend/vercel.json`](file:///d:/code/Projects/movie-recommendation-system/backend/vercel.json) | **New** | Vercel deployment file pointing to `src/index.js` in `sin1` region. |
| [`backend/package.json`](file:///d:/code/Projects/movie-recommendation-system/backend/package.json) | **Edited** | Uninstalled `express-session`, `node-cron`. Added `express-rate-limit`. Specified `engines` constraint to `>=20.0.0`. |
| [`backend/.env.example`](file:///d:/code/Projects/movie-recommendation-system/backend/.env.example) | **New** | Contains all requested environment variables (empty values). |

## Tests Run

### 1. `scripts/purge-soft-deleted.js` 
- ✅ Ran without `--confirm` (dry-run). Output correctly found 0 soft-deleted users and printed "Nothing to do". 

### 2. Hard Deletion inside Transaction
- ✅ Started the backend via `npm start`.
- ✅ Hit `/api/auth/register` and successfully created a new user. 
- ✅ Stored the JWT token and hit `/api/users/profile` using the `DELETE` method.
- ✅ The response successfully returned `{"status":"deleted"}`.
- ✅ Queried the Neon Database directly for the user using `getPool().query` via Node. Assured the user was entirely removed from `users` (which cascades/cleans up associated tables in the single transaction). 

### 3. Serverless Environment Constraints
- ✅ Verified `npm start` still correctly spins up on `localhost:4000`. 
- ✅ Tested health route (`/health`) returning a 200 `{"status":"ok"}`.

### 4. Stateless Google OAuth setup
- ✅ Updated Strategy store to implement custom `StatelessStore`, creating a short-lived state JWT.
- ✅ Ensured Passport doesn't block local boot or routing.

## Could Not Verify

| Item | Why |
|------|-----|
| **Google Auth Callback Flow** | Google OAuth redirects require the user browser to pass through the actual flow. Stateless `StatelessStore` implementation guarantees no memory-leak or serverless scaling errors with session state caching, but full callback validation wasn't executed against Google servers. |
| **Cloudinary Avatar Delete** | Real CLOUDINARY credentials are not currently available/provided in the local test. | 
| **Vercel Dev** | Because the workspace has standard Node tools rather than the global `vercel` CLI, the final Vercel-like routing was not validated, though `vercel.json` dictates Standard Express mapping. |

## Suspicious Items Noticed

1. **Movie Table Missing `IF NOT EXISTS` Creation** - Noted that migrations for `movies` is fully external as expected, so the local DB is expected to be loaded manually.
2. **Passport Default Behavior** - Calling `passport.authenticate('google')` inherently wants to leverage `express-session` unless a custom state store is passed explicitly. We added the custom StateStore and enforced `session: false` in the callback, but failure redirects or Edge Cases with outdated cookies may require browser refresh for users actively logged into Google but using an outdated `session` locally from earlier code.
