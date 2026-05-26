// Fixture: semicolon-terminated constructs should not trigger stylistic/semi.
// Expected: zero stylistic/semi violations.

const value = 1;

function readValue(): number {
  return value;
}

function exportedValue(): number {
  return value;
}

class Example {
  field = value;
}

interface Shape {
  value: number;
}

enum Choice {
  Value,
}

type Alias = number;

declare function ambient(): void;

for (let index = 0; index < 1; index += 1) {
  readValue();
}

for (const item of [value,]) {
  readValue();
  item.toString();
}

for (const key in { value, }) {
  readValue();
  key.toString();
}

export type {
  Alias,
  Shape,
};
export {
  ambient,
  Choice,
  Example,
  exportedValue,
  readValue,
  value,
};
export default function defaultValue(): number {
  return value;
}
