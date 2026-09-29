require('dotenv').config();

const express = require('express');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');

// Serverless constraint: no top-level process.exit, lazy check variables on request
const REQUIRED_ENV_VARS = [
  'DATABASE_URL', 'JWT_SECRET', 'INTERNAL_API_KEY', 'FRONTEND_URL',
  'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_CALLBACK_URL'
];

const checkEnvMiddleware = (req, res, next) => {
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (process.env.FLASK_URL && !process.env.FLASK_URL.includes('localhost') && missing.indexOf('FLASK_URL') === -1) {
    // If not localhost, FLASK_URL shouldn't be considered missing but we can add validation here if needed
  }
  if (!process.env.FLASK_URL || process.env.FLASK_URL.includes('localhost')) {
      // In prod, FLASK_URL shouldn't be localhost
      if (process.env.NODE_ENV === 'production' && process.env.FLASK_URL && process.env.FLASK_URL.includes('localhost')) {
          missing.push('FLASK_URL (must not be localhost in production)');
      }
  }

  if (missing.length > 0) {
    console.error(`Missing required env vars: ${missing.join(', ')}`);
    return res.status(500).json({ error: 'Internal server error: configuration missing' });
  }
  next();
};

const app = express();
app.set("trust proxy", 1);

// ─── CORS Middleware (must be first) ─────────────────────────────────────────
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(url => url.trim().replace(/\/$/, '').toLowerCase());

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    
    const normalizedOrigin = origin.trim().replace(/\/$/, '').toLowerCase();
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }
    
    // Check Vercel Preview URLs if enabled
    if (process.env.ALLOW_VERCEL_PREVIEWS === 'true' && process.env.VERCEL_PROJECT_SLUG) {
      const regex = new RegExp(`^https://${process.env.VERCEL_PROJECT_SLUG}.*\\.vercel\\.app$`);
      if (regex.test(normalizedOrigin)) {
        return callback(null, true);
      }
    }
    
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type']
};
app.use(cors(corsOptions));

// ─── Middleware ──────────────────────────────────────────────────────────────
app.use(checkEnvMiddleware);
app.use(express.json());

// ─── Rate Limiting ───────────────────────────────────────────────────────────
const limiterMovies = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MOVIES || '60', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const limiterAuth = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_AUTH || '10', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

const limiterGlobal = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_GLOBAL || '300', 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/movies', limiterMovies);
app.use('/api/auth/login', limiterAuth);
app.use('/api/auth/register', limiterAuth);
app.use('/api/auth/google', limiterAuth);
app.use(limiterGlobal);

// ─── Passport: Stateless Google OAuth Strategy ───────────────────────────────
const StatelessStore = {
  store: (req, callback) => {
    try {
      const token = jwt.sign({ purpose: 'oauth_state' }, process.env.JWT_SECRET, { expiresIn: '5m' });
      callback(null, token);
    } catch (err) {
      callback(err);
    }
  },
  verify: (req, state, callback) => {
    try {
      const decoded = jwt.verify(state, process.env.JWT_SECRET);
      if (decoded.purpose !== 'oauth_state') return callback(new Error('Invalid state purpose'), false);
      callback(null, true);
    } catch (err) {
      callback(err, false);
    }
  }
};

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
      callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
      store: StatelessStore
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const { getPool } = require('./db/neon');
        const googleId = profile.id;
        const email = profile.emails?.[0]?.value;
        const displayName = profile.displayName || email?.split('@')[0];
        const avatarUrl = profile.photos?.[0]?.value || null;

        const result = await getPool().query('SELECT * FROM users WHERE google_id = $1', [googleId]);
        if (result.rows.length > 0) {
          const { password_hash, ...user } = result.rows[0];
          return done(null, user);
        }

        const emailResult = await getPool().query('SELECT * FROM users WHERE email = $1', [email]);
        if (emailResult.rows.length > 0) {
          await getPool().query(
            'UPDATE users SET google_id = $1, avatar_url = COALESCE(avatar_url, $2) WHERE email = $3',
            [googleId, avatarUrl, email]
          );
          const { password_hash, ...user } = emailResult.rows[0];
          user.google_id = googleId;
          return done(null, user);
        }

        const insertResult = await getPool().query(
          `INSERT INTO users (username, email, google_id, avatar_url)
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [displayName, email, googleId, avatarUrl]
        );

        const { password_hash, ...user } = insertResult.rows[0];
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  )
);
app.use(passport.initialize());

// ─── Mount routes ────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/movies', require('./routes/movies'));
app.use('/api/users', require('./routes/users'));
app.use('/api/recommendations', require('./routes/recommendations'));

// ─── Health check ────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ─── Global error handler ────────────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS error' });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀  Backend running on http://localhost:${PORT}`);
  });
}
