// Fixture: non-Node Sync-named APIs should not be banned by the project no-sync rule.
// Expected: zero no-restricted-syntax(no-sync) violations.

import { parseSync, } from '@optique/core/parser';

const parser = {};
const args: readonly string[] = [];

function require(source: string,): { readonly readFileSync: (path: string,) => string; } {
  return {
    readFileSync(path: string,): string {
      return `${source}:${path}`;
    },
  };
}

const process = {
  getBuiltinModule(source: string,): { readonly readFileSync: (path: string,) => string; } {
    return {
      readFileSync(path: string,): string {
        return `${source}:${path}`;
      },
    };
  },
};

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
void require('node:fs',)
  .readFileSync('/tmp/input',);
void process.getBuiltinModule('node:fs',)
  .readFileSync('/tmp/input',);

export {};
