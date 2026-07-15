// Fixture: constructs with a single item should not trigger rules.
// Expected: zero stylistic rule violations.

function identity(x: number,): number {
  return x;
}

const items = [1,];

const config = { host: 'localhost', };

const { host, } = config;

type Options = { verbose: boolean; };

type Single = [string,];

export { identity, };

export {};
