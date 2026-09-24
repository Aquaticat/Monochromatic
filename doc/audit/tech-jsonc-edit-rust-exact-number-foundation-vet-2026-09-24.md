# Vet exact JSON number storage for the Rust jsonc-edit port

## Status and fingerprint

- Status: Discovery, incomplete. No candidate is recommended or adopted.
- Subject: jsonc-edit Rust exact-number foundation.
- Scope: Choose exact JSON numeric value representation for the native published `monochromatic-jsonc-edit` crate.
- Started and last updated: 2026-09-24.
- Owner: current coding-agent session.
- Governing skill: `.agents/skills/choosing-technology/SKILL.md` at `a05818ad7`, SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Fingerprint, RFC 8785 canonicalized schema version 1: `1fd8b19bb0a656cca8a01b1360a4e7225c8cc529f0888dcd46e530655c6570a4`.
- No prior compatible report was found under `doc/audit/` by a `rg --files` search for JSONC, Rust parser, or structured edits.
- Base category: inspectable open-source local technology, including repository-owned implementation as the baseline.
- Overlays: native Rust library, multi-platform. No credential or CI execution in the candidate library; untrusted JSONC text crosses the parser boundary. No replacement of the TypeScript library, which stays maintained.
- Hard constraints: exact equality over admitted JSON numbers, original spelling for unedited literals, no silent rounding, LGPL-3.0-or-later compatible licensing, inspectable source and reproducible validation.
- Deployment: native Rust on Linux, macOS and Windows, published to crates.io. Browser and Wasm not required.
- Preference weights: none beyond the confirmed requirements in `doc/planning/jsonc-edit-rust-port.md`.

## Frozen criteria before candidate rating

Every validated candidate receives the same weight of 1 for each relevant soft concern: API clarity for exact values, source auditability, release/maintenance evidence, dependency and build surface, and measured performance on the library's input corpus. The maximum for each is 4; no candidate has been scored. Hard constraints are not scored. Sensitivity must rerun each weight from 1 through 5 and each uncertain rating endpoint before any recommendation.

## Query ledger and saturation

The literal numeric query schedule was frozen in `doc/planning/jsonc-edit-rust-port.md` before these calls. Required source classes are registry, repository host, broader web, and in-repo precedent.

- Registry: `cargo search 'exact decimal' --limit 100` returned a truncated result with 1139 additional hits. `cargo search bigint --limit 100` returned 932 more. `cargo search 'arbitrary precision json' --limit 100` returned 406 more. No negative filter, no sort control, first result page only; registry saturation is **blocked until a paginable enumeration route is proven**.
- Repository host: `gh search repos 'rust arbitrary precision decimal json' --limit 100 --json fullName,url,description,updatedAt` returned no matches; `gh search repos 'rust bigint' --limit 100 --json fullName,url,description,updatedAt` returned five. No negative filter or explicit sort. These queries are not proof that comparable projects are absent.
- Web: searches for `Rust exact JSON number decimal exponent arbitrary precision source crate` and `Rust JSON number lexeme exact comparison library` returned primary project documentation for `json-number`, `bigdecimal`, `serde_json`, and `jstrict`. No negative filter.
- In-repo: `package/module/jsonc-edit/src/value.ts`, `src/scan.ts`, and `doc/planning/monorepo-manager-route-research/rust-structured-edits.md` document JS-number decoding, raw literals on the structured path, and integer-equality pitfalls. The clean fast path loses `1e0` spelling; the reproducible bundle probe is in `doc/planning/jsonc-edit-rust-port.md`.
- One de-duplicated taxonomy expansion round may follow the initial schedule; record it before running. Registry and repository-host pagination remain open.

## Candidate ledger

### Repository-owned validated token and exact decimal equality

- Discovery: existing raw-token model and Rust native port requirements in `doc/planning/jsonc-edit-rust-port.md`.
- Category: inspectable repository-owned local implementation; same native and multi-platform overlays.
- Screening: pending proof of full JSON-number grammar, exact equality across arbitrary exponents, complexity bounds, and consumer API. It is not automatically eligible merely because external alternatives require vetting.

### `json-number` 0.4.10

- Discovery: broader search at [docs.rs Number](https://docs.rs/json-number/latest/json_number/struct.Number.html); `cargo info json-number` reports [repository](https://github.com/timothee-haudebourg/json-number), MIT/Apache-2.0, and optional canonical and serde features.
- Category: inspectable open-source local crate, native and multi-platform overlays.
- Screening: pending source proof of numeric equality semantics and JSON grammar. Not recommended.

### `bigdecimal` 0.4.10

- Discovery: [docs.rs package](https://docs.rs/crate/bigdecimal/latest); `cargo info bigdecimal` reports [repository](https://github.com/akubera/bigdecimal-rs), MIT/Apache-2.0, and `num-bigint` dependency.
- Category: inspectable open-source local crate, native and multi-platform overlays.
- Screening: pending source proof for exponent range, formatting, exact equality, and consumer boundary. Not recommended.

### `serde_json` 1.0.151 with `arbitrary_precision`

- Discovery: `cargo info serde_json` reports the [upstream repository](https://github.com/serde-rs/json), MIT OR Apache-2.0, and `arbitrary_precision` feature. Previous repository research identifies false equality assumptions in its surrounding wrapper, not a verified limitation of this feature.
- Category: inspectable open-source local crate, native and multi-platform overlays.
- Screening: pending proof of number equality, raw-token preservation, and surrogate handling at the parser boundary. Not recommended.

### `jstrict` 0.15.0

- Discovery: [number API](https://docs.rs/jstrict/latest/jstrict/number/struct.Number.html) and `cargo info jstrict`, reporting [upstream repository](https://github.com/mskvarc/jstrict/), MIT OR Apache-2.0, and default `simdutf8` dependency.
- Category: inspectable open-source local crate, native and multi-platform overlays.
- Screening: pending source proof that number storage composes with JSONC token parsing. Not recommended.

### `rust_decimal` 1.43.0

- Discovery: `cargo search 'arbitrary precision json' --limit 100` and [upstream docs](https://docs.rs/rust_decimal/latest/rust_decimal/).
- Category: inspectable open-source local crate, native and multi-platform overlays.
- Screening: pending proof of full JSON-number exponent and coefficient domain. Not recommended.

## Pending evidence and validation

- Finish required discovery saturation or report a blocked terminal outcome; record exact expansion queries and pagination attempts.
- Clone every serious candidate under private `~/temp/agent/` using `gh repo clone`, disable clone push targets before any prototype commit, and record revisions.
- Inspect licenses, manifests, source parsing and equality paths, test/CI and maintenance; complete applicable hard gates and overlays. Do not run third-party build/test commands before inspecting execution trees and sandboxing.
- Validate every hard-gate survivor at equal depth, including original spelling, `1 = 1.0 = 1e0`, `-0`, integers past 2^53, large exponents, invalid grammar, and consumer use in a throwaway Rust crate.
- Freeze evidence-backed ratings, run scoring and sensitivity, state complete ranking with pros, cons and adjacent reasons, then present recommendation to the user for adoption. No dependency change or decision record before adoption.
