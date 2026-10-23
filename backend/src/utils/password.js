const { scrypt, randomBytes, timingSafeEqual } = require('crypto');
const { promisify } = require('util');

const scryptAsync = promisify(scrypt);
const KEY_LENGTH = 64;

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString('hex')}`;
}

async function verifyPassword(password, storedHash) {
  if (typeof storedHash !== 'string') return false;

  const parts = storedHash.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;

  const [, salt, hashHex] = parts;
  const expected = Buffer.from(hashHex, 'hex');
  if (expected.length === 0) return false;

  const actual = await scryptAsync(password, salt, expected.length);
  if (actual.length !== expected.length) return false;

  return timingSafeEqual(actual, expected);
}

module.exports = { hashPassword, verifyPassword };
