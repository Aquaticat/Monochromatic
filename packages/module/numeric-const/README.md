# module-numeric-const

Universal numeric constants for the Monochromatic monorepo.
This package is the canonical home for numeric values that express mathematical or physical relationships,
and for codes defined by external specifications.
App-specific defaults (timeouts, ports, z-index tiers) are deliberately excluded
so unrelated apps stay decoupled.

## Exports

The package is source-only.
The `.` entry point resolves to `./src/index.ts`,
which re-exports every constant from per-category sibling files.

| Constant                     | Value         | Source               | Description                                       |
| ---------------------------- | ------------- | -------------------- | ------------------------------------------------- |
| `MS_PER_SECOND`              | `1_000`       | `src/time.ts`        | Milliseconds in one second                        |
| `SECONDS_PER_MINUTE`         | `60`          | `src/time.ts`        | Seconds in one minute                             |
| `MINUTES_PER_HOUR`           | `60`          | `src/time.ts`        | Minutes in one hour                               |
| `HOURS_PER_DAY`              | `24`          | `src/time.ts`        | Hours in one day                                  |
| `DAYS_PER_WEEK`              | `7`           | `src/time.ts`        | Days in one week                                  |
| `DAYS_PER_YEAR`              | `365`         | `src/time.ts`        | Days in a non-leap calendar year                  |
| `MONTHS_PER_YEAR`            | `12`          | `src/time.ts`        | Months in one year                                |
| `MS_PER_MINUTE`              | `60_000`      | `src/time.ts`        | Composed: `MS_PER_SECOND * SECONDS_PER_MINUTE`    |
| `MS_PER_HOUR`                | `3_600_000`   | `src/time.ts`        | Composed: `MS_PER_MINUTE * MINUTES_PER_HOUR`      |
| `MS_PER_DAY`                 | `86_400_000`  | `src/time.ts`        | Composed: `MS_PER_HOUR * HOURS_PER_DAY`           |
| `MS_PER_WEEK`                | `604_800_000` | `src/time.ts`        | Composed: `MS_PER_DAY * DAYS_PER_WEEK`            |
| `SECONDS_PER_HOUR`           | `3_600`       | `src/time.ts`        | Composed: `SECONDS_PER_MINUTE * MINUTES_PER_HOUR` |
| `SECONDS_PER_DAY`            | `86_400`      | `src/time.ts`        | Composed: `SECONDS_PER_HOUR * HOURS_PER_DAY`      |
| `BITS_PER_BYTE`              | `8`           | `src/byte.ts`        | Bits in one byte                                  |
| `BYTES_PER_KIB`              | `1_024`       | `src/byte.ts`        | IEC binary kibibyte (2^10)                        |
| `BYTES_PER_MIB`              | `2^20`        | `src/byte.ts`        | IEC binary mebibyte                               |
| `BYTES_PER_GIB`              | `2^30`        | `src/byte.ts`        | IEC binary gibibyte                               |
| `BYTES_PER_TIB`              | `2^40`        | `src/byte.ts`        | IEC binary tebibyte                               |
| `BYTES_PER_KB`               | `1_000`       | `src/byte.ts`        | SI decimal kilobyte (10^3)                        |
| `BYTES_PER_MB`               | `10^6`        | `src/byte.ts`        | SI decimal megabyte                               |
| `BYTES_PER_GB`               | `10^9`        | `src/byte.ts`        | SI decimal gigabyte                               |
| `BYTES_PER_TB`               | `10^12`       | `src/byte.ts`        | SI decimal terabyte                               |
| `HTTP_OK`                    | `200`         | `src/http-status.ts` | RFC 9110 success                                  |
| `HTTP_CREATED`               | `201`         | `src/http-status.ts` | RFC 9110 resource created                         |
| `HTTP_NO_CONTENT`            | `204`         | `src/http-status.ts` | RFC 9110 success with empty body                  |
| `HTTP_BAD_REQUEST`           | `400`         | `src/http-status.ts` | RFC 9110 client malformed request                 |
| `HTTP_UNAUTHORIZED`          | `401`         | `src/http-status.ts` | RFC 9110 missing authentication                   |
| `HTTP_NOT_FOUND`             | `404`         | `src/http-status.ts` | RFC 9110 resource missing                         |
| `HTTP_CONFLICT`              | `409`         | `src/http-status.ts` | RFC 9110 state conflict                           |
| `HTTP_INTERNAL_SERVER_ERROR` | `500`         | `src/http-status.ts` | RFC 9110 unexpected server failure                |
| `HALF`                       | `0.5`         | `src/fraction.ts`    | `1 / 2`                                           |
| `QUARTER`                    | `0.25`        | `src/fraction.ts`    | Composed: `HALF / 2`                              |
| `THREE_QUARTERS`             | `0.75`        | `src/fraction.ts`    | Composed: `HALF + QUARTER`                        |
| `THIRD`                      | `~0.333`      | `src/fraction.ts`    | `1 / 3`                                           |
| `TWO_THIRDS`                 | `~0.666`      | `src/fraction.ts`    | Composed: `THIRD + THIRD`                         |

## Usage

```ts
import {
  BYTES_PER_KIB,
  HALF,
  HTTP_NOT_FOUND,
  MS_PER_SECOND,
} from '@monochromatic-dev/module-numeric-const';

const ttlMs = 30 * MS_PER_SECOND;
const bufferBytes = 64 * BYTES_PER_KIB;
const midpoint = (start + end) * HALF;
return new Response(null, { status: HTTP_NOT_FOUND, },);
```

## Scope

In scope:

- Mathematical and physical relationships (time-unit ratios, byte-unit ratios, fractions)
- Codes defined by external specifications (RFC 9110 HTTP status codes)

Out of scope:

- App-specific defaults (timeouts, ports, retry counts, z-index tiers).
  Centralising these would couple unrelated apps into lockstep
  when one wants to tune a default.
  Define such constants in the package that owns the policy.
- Domain-specific magic numbers (ZIP format signatures, file-format thresholds).
  Define these in their own package's `constants.ts`,
  next to the code that interprets them.

## KB vs KiB

The IEC and SI byte units differ by approximately 7% per order of magnitude.
This package exports both with their spec-correct values:

- `BYTES_PER_KIB = 1_024` (binary, IEC 80000-13)
- `BYTES_PER_KB = 1_000` (decimal, SI)

Earlier callers used `BYTES_PER_KB = 1_024`, which conflated the two.
When migrating an inline `BYTES_PER_KB = 1_024` definition,
rename to `BYTES_PER_KIB`.

## Design decisions

- **Source-only.** The package has no build step; consumers import directly from `src/index.ts`.
  Constants do not benefit from bundling, and skipping the build keeps the workspace install fast.
- **Composed values use named primitives, not literals.** `MS_PER_HOUR` is `MS_PER_MINUTE * MINUTES_PER_HOUR`,
  not `3_600_000`. This makes any future correction propagate automatically and documents the relationship.
- **Per-category sibling files.** `time.ts`, `byte.ts`, `http-status.ts`, `fraction.ts` each own their domain;
  `index.ts` is pure re-exports. New categories arrive as new sibling files, not as additions to one growing file.
- **Conservative inclusion.** A constant is added when a second use site materialises in the workspace.
  Speculative additions belong in the consuming package until a second user appears.
