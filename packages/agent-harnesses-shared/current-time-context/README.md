# module-current-time-context

Formatter for hidden current local wall-clock time context payloads.

The package exports `formatTimeContext()`,
 which turns a `Date` into:

```text
<time>HH:MM</time>
```

## Why this exists

Claude Code hooks and pi extensions both inject the same coarse local time context.
This package keeps the pure formatting rule in one neutral module,
 separate from either host runtime.

## Behavior

`formatTimeContext()` uses local 24-hour clock fields from the supplied `Date`.
It zero-pads hour and minute and omits seconds,
 date,
 and timezone.

## Usage

```ts
import {
  formatTimeContext,
} from '@monochromatic-dev/module-current-time-context';

formatTimeContext(new Date(2_026, 4, 1, 20, 48,),);
// '<time>20:48</time>'
```

## Validation

Run package validation from the repository root:

```sh
mise run //packages/module/current-time-context:test:unit
mise run //packages/module/current-time-context:lint
```
