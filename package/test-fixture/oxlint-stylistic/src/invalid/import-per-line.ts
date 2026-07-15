// Fixture: multiple named imports on the same line.
// Expected violations: stylistic(import-per-line)

import { resolve, join } from 'node:path';

void resolve;
void join;

export {};
