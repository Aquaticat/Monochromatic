# @monochromatic-dev/module-test-diagnostic

Test-failure formatting,
assertion-source inspection,
and shared harness-frame classification.
The [module-test runner](../test/README.md#output-format) still re-exports the existing diagnostic functions.

## Responsibilities

- `formatErrorDeep` renders error chains and aggregate members while filtering harness frames.
- `formatFailure` combines a verdict summary with the formatted error.
- `readAssertionSites` enriches failures with readable assertion source when available.
- `extractAssertionExpression`,
  `extractLocationSubstring`,
  and `isIntegerString` support source extraction.

This is test-oriented formatting,
not a generic replacement for `module-caught-value`.
Workspace-prefix discovery and source reads stay behind the existing Node runtime checks.
The neutral artifact can be imported without Node filesystem access.

## Use

```ts
// consumer.ts
import { formatFailure, } from '@monochromatic-dev/module-test-diagnostic/ts';

const diagnostic = await formatFailure({
  summary: 'test failed',
  value: new Error('unexpected value',),
},);
```

Workspace consumers use `/ts`.
The root entry resolves to the built neutral artifact.

## Verification

```bash
# From the repository root.
mise run //package/module/test-diagnostic:buildAndTest
mise run //package/module/test-diagnostic:lint
```

Example and property tests exercise the built diagnostic artifact.
Frame tests cover runner and extracted-package source paths,
built paths,
and preservation of actual test frames.
`fast-check` is a development dependency only.
