// Fixture: constructs already formatted with one item per line.
// Expected: zero stylistic rule violations.

function greet(
  name: string,
  age: number,
): string {
  return `${name} is ${String(age,)}`;
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

// TypeScript function-like nodes already formatted one-param-per-line.

type FnType = (
  a: string,
  b: number,
) => void;

declare function ambient(
  a: string,
  b: number,
): void;

type WithMethod = {
  run(
    a: string,
    b: number,
  ): void;
};

type Callable = {
  (
    a: string,
    b: number,
  ): void;
};

type Constructible = {
  new(
    a: string,
    b: number,
  ): void;
};

type CtorType = new(
  a: string,
  b: number,
) => void;

declare class WithMember {
  m(
    a: string,
    b: number,
  ): void;
}

export type {
  Callable,
  Constructible,
  CtorType,
  FnType,
  WithMethod,
};
export {
  ambient,
  WithMember,
};

export {};
