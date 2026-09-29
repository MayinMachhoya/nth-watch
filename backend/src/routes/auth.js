const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const { query } = require('../db/neon');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

const signToken = (user) =>
  jwt.sign(
    { user_id: user.user_id, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );

const sanitiseUser = (row) => {
  const { password_hash, ...user } = row;
  return user;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── POST /register ──────────────────────────────────────────────────────────

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'username, email, and password are required' });
    }
    if (!EMAIL_RE.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const checkEmail = await query('SELECT 1 FROM users WHERE email = $1', [email]);
    if (checkEmail.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const password_hash = await bcrypt.hash(password, 12);

    const result = await query(
      `INSERT INTO users (username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [username, email, password_hash]
    );

    const user = sanitiseUser(result.rows[0]);
    const token = signToken(user);

    return res.status(201).json({ data: { token, user } });
  } catch (err) {
    if (err.code === '23505') {
      // unique_violation
      return res.status(409).json({ error: 'Username or email already exists' });
    }
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /login ──────────────────────────────────────────────────────────────

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // is_deleted check removed

    if (!user.password_hash) {
      return res.status(401).json({ error: 'This account uses Google sign-in' });
    }

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = signToken(user);
    return res.json({ data: { token, user: sanitiseUser(user) } });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── GET /google ──────────────────────────────────────────────────────────────

router.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false })
);

// ─── GET /google/callback ────────────────────────────────────────────────────

router.get(
  '/google/callback',
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user, info) => {
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();
      if (err || !user) {
        return res.redirect(`${frontendUrl}/login?error=oauth`);
      }
      req.user = user;
      const token = signToken(req.user);
      res.redirect(`${frontendUrl}?token=${token}`);
    })(req, res, next);
  }
);

// POST /recover removed

// ─── GET /me ──────────────────────────────────────────────────────────────────

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await query('SELECT * FROM users WHERE user_id = $1', [req.user.user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json({ data: sanitiseUser(result.rows[0]) });
  } catch (err) {
    console.error('Get me error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── POST /logout ─────────────────────────────────────────────────────────────

router.post('/logout', (_req, res) => {
  return res.json({ message: 'logged out' });
});

module.exports = router;
