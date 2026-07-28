# `nano-spawn` 2.1.0 strips one final newline from captured output

## Symptom

A built CLI wrote this exact stdout payload:

```text
10.128.0.0/9, 2001:db8::2/127\n
```

A test using `nano-spawn` 2.1.0 received:

```text
10.128.0.0/9, 2001:db8::2/127
```

The command was correct,
but the capture API made an exact final-newline assertion fail.
This matters for CLIs whose contract includes newline presence or absence.

## Root cause

The behavior is documented in the installed public type definition.
`node_modules/.pnpm/nano-spawn@2.1.0/node_modules/nano-spawn/source/index.d.ts:123-126` says a final newline is
automatically stripped from `result.stdout`.
The same contract applies to `result.stderr`.

The implementation is
`node_modules/.pnpm/nano-spawn@2.1.0/node_modules/nano-spawn/source/result.js:72-75`:

```javascript
const getOutput = output => output.at(-1) === '\n'
  ? output.slice(0, output.at(-2) === '\r' ? -2 : -1)
  : output;
```

It removes one final LF,
or a final CRLF pair,
before constructing the returned result.
The 2.1.0 `Options` type has no setting that preserves it.

## Verification

The behavior was observed on 2026-07-28 with `nano-spawn` 2.1.0 and Node 26.5.0 on Linux x86-64.
The `wg-allowedips` built-CLI test expected a newline-terminated value and received the same value without its final
newline through `result.stdout`.

Replacing the capture boundary with Node's `node:child_process` `spawn`,
`node:stream/consumers` `text`,
and `node:events` `once` preserved the raw stream text and let the test assert the exact newline.
The child stdout,
child stderr,
and close event are awaited concurrently without promise-constructor or callback wrappers.

## Verified workarounds

### Capture child streams directly

```ts
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { text } from 'node:stream/consumers';

const child = spawn('node', ['cli.mjs'], { stdio: 'pipe' });
const [stdout, stderr] = await Promise.all([
  text(child.stdout),
  text(child.stderr),
  once(child, 'close'),
]);
```

Tradeoff:
 the caller owns nonzero-exit handling and the rare signal-without-exit-code case.
This is the correct boundary when exact output bytes decoded as text are part of the assertion.

### Keep `nano-spawn` when terminal newlines are irrelevant

Use `result.stdout` and `result.stderr` when one final line terminator is intentionally insignificant.

Tradeoff:
 the result cannot distinguish output ending with no newline from output ending with one newline.
Do not use that result for a final-newline contract.

## What does not work

- Comparing `nano-spawn`'s `result.stdout` with a newline-terminated expectation does not work because normalization
  has already happened.
- Passing another 2.1.0 option does not work because its public `Options` type exposes no preserve-final-newline or
  strip-final-newline control.
- Trimming the expected value makes the test green but stops testing the CLI contract.

## Upstream filing decision

No upstream issue or pull-request draft is warranted.
The behavior is explicitly documented and implemented as designed,
so it is not an upstream defect.
The local fix is to choose direct stream capture for this exact-output test.
