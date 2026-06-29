// Fixture: Node sync APIs should be banned.
// Expected violation: no-restricted-syntax(no-sync)

import childProcess from 'node:child_process';
import fs from 'node:fs';
import { readFileSync, } from 'node:fs';
import { readFileSync as read, } from 'fs';

const fsRequired = require('fs',);
const { writeFileSync, } = require('node:fs',);
const stat = fs.statSync;

fs.readFileSync('/tmp/input',);
childProcess.execFileSync('echo hello',);
readFileSync('/tmp/input',);
read('/tmp/input',);
fsRequired.existsSync('/tmp/input',);
writeFileSync(
  '/tmp/output',
  '',
);
stat('/tmp/input',);
process.getBuiltinModule('node:fs',)
  .readdirSync('/tmp',);

export {};
