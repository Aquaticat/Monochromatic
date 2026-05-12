# module-numeric-format

Numeric formatters for the gaps left by `Intl.DurationFormat` and `Intl.NumberFormat`.
This package mirrors `@monochromatic-dev/module-numeric-const`:
one file per category, re-exported from `index.ts`,
consuming the matching constants file (`numeric-const/src/time.ts` etc.) instead of redefining ratios.

The charter is narrow.
Only formatters that the platform `Intl` APIs explicitly do not cover go here.
Anything `Intl` already handles should be called directly at the consumer.

## Exports

| Function         | Source            | Description                                                                  |
| ---------------- | ----------------- | ---------------------------------------------------------------------------- |
| `formatBytes`    | `src/byte.ts`     | IEC binary byte formatter (`KiB` / `MiB` / `GiB`).                           |
| `formatDuration` | `src/duration.ts` | Magnitude-adaptive sub-ms / ms / s formatter for `performance.now()` deltas. |

## Why not `Intl.DurationFormat`

`Intl.DurationFormat` shipped in Baseline 2025 (Firefox 136+, well within the project's Firefox ESR 140 baseline).
It does not cover developer-facing perf output for two reasons grounded in TC39 design decisions, not oversights.

### 1. Sub-millisecond precision is not representable

The Duration Record holds `[[Milliseconds]]`, `[[Microseconds]]`, `[[Nanoseconds]]` as three separate integer slots,
sync'd with `Temporal.Duration` ([proposal-intl-duration-format#157][i157], [#199][i199]).
Fractional milliseconds (e.g. `0.34ms` from `performance.now()`) cannot be expressed.

A `"fractional"` style exists for seconds, milliseconds, microseconds ([#205][i205])
but fractional minutes / hours / days were deferred ([proposal-intl-duration-format#65][i65] -> [ecma402#980][e980], still open).
@ryzokuken's reason in ecma402#980:

> In the case of days, it's hard to say how many hours constitute 0.5 days, since not all days are equally long.
> In the case of smaller units, Temporal assumes all units are of fixed size for now but this might not hold in the future
> when (and if at all) we decide to add support for alternate time-keeping systems
> like we currently support alternate calendars.

### 2. Magnitude-driven unit selection is out of scope

The auto-select-best-unit feature (`"0.3ms" -> "51ms" -> "1.2s"` depending on input magnitude) was redirected to a hypothetical
`Intl.RelativeTimeFormat` v2 ([ecma402#498][e498], still open).
The proposal team's framing in [proposal-intl-duration-format#174][i174], @sffc:

> I believe the thinking is that relative time format has generally been considered to be an approximation of time,
> so a single unit is sufficient ... I believe the thinking was that if you need more precision then you should just
> format the timestamp directly.

And @FrankYFTang on the charter:

> Intl.DurationFormat is chartered to format the "amount" of time, not a "particular time in the timeline" ...
> A duration itself is a "amount of time", without any reference point of start or end.

[#32][i32] is the longest thread on adaptive unit-set selection.
The options debated (`smallestUnit` / `largestUnit` / `hideZeroValued` / `requiredFields`) all let the caller fix the field set;
none picks the field set from input magnitude.
No `bestFit`-style option was added.

### Implication

`formatDuration` (sub-ms fractional, magnitude-adaptive) is blocked by both points and is not on a TC39 roadmap.
The custom implementation here is justified.
Use `Intl.DurationFormat` directly for any integer-seconds multi-unit case (e.g. `1h30min` clocks); they are not in scope for this package.

### `formatTrackedTime` (in `webapp-productivity/done`) was migrated to `Intl.DurationFormat`

The natural migration candidate was `formatTrackedTime` (integer seconds, multi-unit output).
Three blockers were considered, all resolved by picking `style: 'digital'`:

- **Empty-string regression at `0s`** for non-digital styles
  (`new Intl.DurationFormat('en', { style: 'long' | 'short' | 'narrow' }).format({hours:0,minutes:0,seconds:0})` returns `""`).
  Resolved: `style: 'digital'` returns `'0:00:00'` and never goes empty.
- **Output shape change.**
  Old `'1h30min0s'` -> new `'1:30:00'`.
  Picked for stopwatch / timer convention; consistent `H:MM:SS` shape regardless of magnitude
  (a 73-hour task is `73:00:00`, not `3 days, 1:00:00`).
- **Locale choice.**
  Left undefined so numerals follow the host's `Intl` default
  (Arabic / Farsi locales render localized digits; Latin-numeral locales are unaffected).

The thin wrapper lives in the consuming webapp, not this package;
`Intl.DurationFormat` is already on the platform and the only app-specific glue is the
seconds -> `{hours, minutes, seconds}` decomposition.

## Why not `Intl.NumberFormat` for bytes

`Intl.NumberFormat` with `style: "unit"` supports the SI byte units (`byte`, `kilobyte`, `megabyte`, `gigabyte`, `terabyte`, `petabyte`),
sourced from CLDR's unit list.
It has no entries for the IEC binary units (`kibibyte`, `mebibyte`, `gibibyte`),
so any consumer that needs `KiB` / `MiB` / `GiB` display must hand-roll the format.
That formatter (`formatBytes`) belongs in this package alongside `formatDuration` once it lands;
SI byte display should go directly through `Intl.NumberFormat`.

[i32]: https://github.com/tc39/proposal-intl-duration-format/issues/32
[i65]: https://github.com/tc39/proposal-intl-duration-format/issues/65
[i157]: https://github.com/tc39/proposal-intl-duration-format/issues/157
[i174]: https://github.com/tc39/proposal-intl-duration-format/issues/174
[i199]: https://github.com/tc39/proposal-intl-duration-format/issues/199
[i205]: https://github.com/tc39/proposal-intl-duration-format/issues/205
[e498]: https://github.com/tc39/ecma402/issues/498
[e980]: https://github.com/tc39/ecma402/issues/980
