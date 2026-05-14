## module-async-time

Ready to publish.

Async timing primitives.

### Helpers

| Function      | Behavior                                                                  |
| ------------- | ------------------------------------------------------------------------- |
| `wait`        | Resolves after a delay in milliseconds; thin `setTimeout` wrapper         |
| `withTimeout` | Races a promise against a deadline; rejects with a labeled `Error` if the deadline wins |

### Usage

```ts
import { wait, withTimeout, } from '@monochromatic-dev/module-async-time';

await wait(500,);

const data = await withTimeout({
  promise: fetch('/api/data',),
  ms: 5000,
  label: 'fetch user data',
},);
```

### Design decisions

- **Source-only.** No build step; consumers import directly from `src/index.ts`.
- **Direct named exports.** No `$` aliasing.
- **One file per helper.** `wait.ts`, `with-timeout.ts`; `index.ts` re-exports.
- **Family scope.** This package owns deadline- and delay-based async primitives.
  Future additions (`debounce`, `throttle`, `retry-with-backoff`, `cancelable-after`)
  belong here as long as their core abstraction is "operate against a duration."
- **Extracted from `module-es`.** Previously lived at
  `t object/t promise/f/{t number/wait, t object/withTimeout}/r a/p p/index.ts`
  and was exposed via the `./wait` and `./with-timeout` subpath exports.
  Promoting to its own package makes the dep edge honest at the `package.json`
  level: consumers that only need an async timer no longer advertise a
  `module-es` dependency.
