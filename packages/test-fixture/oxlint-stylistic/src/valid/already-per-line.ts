// Fixture: constructs already formatted with one item per line.
// Expected: zero stylistic rule violations.

function greet(
  name: string,
  age: number,
): string {
  return `${name} is ${String(age)}`;
}

const items = [
  'alpha',
  'beta',
  'gamma',
];

const config = {
  host: 'localhost',
  port: 3000,
};

const [
  first,
  second,
] = items;

const {
  host,
  port,
} = config;

type Options = {
  verbose: boolean;
  timeout: number;
};

type Pair = [
  string,
  number,
];

export {
  config,
  greet,
  items,
};

export {};
