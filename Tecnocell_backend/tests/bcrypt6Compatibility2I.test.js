'use strict';

const assert = require('assert');
const bcrypt = require('bcrypt');
const bcryptPackage = require('bcrypt/package.json');

const password = 'release-candidate-password';
const legacyPassword = 'legacy-compatible-password';
const legacyBcrypt5Hash = '$2b$10$RjKBtbu3yowPgz5FletpoeEEGtAe44nEYx3j.mJjo8osON6PIzFGO';

(async () => {
  assert.strictEqual(bcryptPackage.version, '6.0.0');

  const hash = await bcrypt.hash(password, 10);
  assert.match(hash, /^\$2[aby]\$10\$/);
  assert.strictEqual(await bcrypt.compare(password, hash), true);
  assert.strictEqual(await bcrypt.compare('incorrect-password', hash), false);

  assert.strictEqual(await bcrypt.compare(legacyPassword, legacyBcrypt5Hash), true);
  assert.strictEqual(await bcrypt.compare('incorrect-password', legacyBcrypt5Hash), false);

  console.log('bcrypt 6 compatibility 2I: OK');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
