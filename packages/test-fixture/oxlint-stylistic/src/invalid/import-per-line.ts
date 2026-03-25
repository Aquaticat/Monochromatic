// Fixture: multiple named imports on the same line.
// Expected violations: stylistic(import-per-line)

import {
  join,
  resolve,
} from 'node:path';

void resolve;
void join;

export {};
