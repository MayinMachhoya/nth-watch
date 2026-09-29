const jwt = require('jsonwebtoken');
const { query } = require('../db/neon');

/**
 * Express middleware – verifies the JWT from the Authorization header.
 * On success attaches { user_id, email } to req.user.
 */
const authMiddleware = async (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const token = header.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const result = await query('SELECT 1 FROM users WHERE user_id = $1', [decoded.user_id]);
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'User not found' });
    }

    req.user = { user_id: decoded.user_id, email: decoded.email };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = authMiddleware;
