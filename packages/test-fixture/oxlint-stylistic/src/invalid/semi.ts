// Fixture: statement-like constructs missing semicolons.
// Expected violations: stylistic(semi)

import { existsSync } from 'node:fs'

const value = 1

existsSync(String(value,))

function readValue(): number {
  return value
}

function fail(): never {
  throw new Error('semi fixture')
}

class Example {
  field = value
}

type Alias = number

declare function ambient(): void

do {
  readValue();
} while (false)

while (false) {
  break
}

for (let index = 0; index < 1; index += 1) {
  continue
}

export type {
  Alias,
}
export {
  ambient,
  Example,
  fail,
  readValue,
  value,
}
export * from './semi-target'
export default value
