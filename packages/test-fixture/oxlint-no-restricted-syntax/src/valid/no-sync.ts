// Fixture: non-Node Sync-named APIs should not be banned by the project no-sync rule.
// Expected: zero no-restricted-syntax(no-sync) violations.

import { parseSync, } from '@optique/core/parser';

const parser = {};
const args: readonly string[] = [];
const localParser = {
  parseSync(): string {
    return 'parsed';
  },
};

void parseSync(
  parser,
  args,
);
void localParser.parseSync();

export {};
