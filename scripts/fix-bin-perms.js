// npm does not preserve the executable bit through `tsc`, and a bin entry that
// is not executable fails with a bare "permission denied" that tells the user
// nothing about why.
const fs = require('fs');
const path = require('path');
const bin = path.join(__dirname, '..', 'dist', 'cli.js');
try {
  fs.chmodSync(bin, 0o755);
  console.log('fix-bin-perms: dist/cli.js is executable');
} catch (e) {
  console.error('fix-bin-perms: could not chmod dist/cli.js —', e.message);
  process.exit(1);
}
