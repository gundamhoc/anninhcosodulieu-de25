const jwt = require('jsonwebtoken');
const env = require('../config/env');

function signAccessToken(user) {
  return jwt.sign(
    {
      sub: String(user.user_id),
      email: user.email,
      role: user.role
    },
    env.jwt.secret,
    {
      expiresIn: env.jwt.expiresIn,
      issuer: env.jwt.issuer
    }
  );
}

function verifyAccessToken(token) {
  return jwt.verify(token, env.jwt.secret, {
    issuer: env.jwt.issuer
  });
}

module.exports = { signAccessToken, verifyAccessToken };
