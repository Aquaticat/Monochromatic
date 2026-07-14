# module-caught-value

Ready to publish.

Formats values caught from `catch` blocks without discarding diagnostic information.

`caughtValueText` returns `Error.message` for genuine Error values.
For every other value,
it follows JavaScript string conversion so objects can provide diagnostic text through `Symbol.toPrimitive`,
`toString`,
or `valueOf`.
Those hooks can execute caller-defined behavior,
so the function exposes that uncertainty through its `@mutates value` contract.

```ts
import { caughtValueText, } from '@monochromatic-dev/module-caught-value';

caughtValueText(new Error('offline')); // 'offline'
caughtValueText({ toString: () => 'provider details' }); // 'provider details'
```
