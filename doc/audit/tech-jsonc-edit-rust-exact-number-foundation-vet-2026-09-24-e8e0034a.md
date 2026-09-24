# Vet exact JSON number storage for the Rust jsonc-edit port

## Status and fingerprint

- Status:
   Discovery,
   incomplete.
   No candidate is recommended or adopted.
- Subject:
   jsonc-edit Rust exact-number foundation.
- Scope:
   Choose exact JSON numeric value representation for the native published `monochromatic-jsonc-edit` crate.
- Started and last updated:
   2026-09-24.
- Owner:
   current coding-agent session.
- Governing skill:
   `.agents/skills/choosing-technology/SKILL.md` at `a05818ad7`,
   SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Fingerprint,
   RFC 8785 canonicalized schema version 1:
   `e8e0034aeb9c0f9b86aa17cd701ca3a0886ff81b49bc2c552004a2ec33138876`.
- No prior compatible report was found under `doc/audit/` by a `rg --files` search for JSONC,
   Rust parser,
   or structured edits.
- Base category:
   inspectable open-source local technology,
   including repository-owned implementation as the baseline.
- Overlays:
   native Rust library,
   multi-platform.
   No credential or CI execution in the candidate library;
   untrusted JSONC text crosses the parser boundary.
   No replacement of the TypeScript library,
   which stays maintained.
- Hard constraints:
   exact equality over admitted JSON numbers,
   original spelling for unedited literals,
   no silent rounding,
   LGPL-3.0-or-later compatible licensing,
   inspectable source and reproducible validation,
   and no regex-backed production number parsing in required dependencies.
- Deployment:
   native Rust on Linux,
   macOS and Windows,
   published to crates.io.
   Browser and Wasm not required.
- Preference weights:
   none beyond the confirmed requirements in `doc/planning/jsonc-edit-rust-port.md`.

## Frozen criteria before candidate rating

Every validated candidate receives the same weight of 1 for each relevant soft concern:
 API clarity for exact values,
 source auditability,
 release/maintenance evidence,
 dependency and build surface,
 and measured performance on the library's input corpus.
 The maximum for each is 4;
 no candidate has been scored.
 Hard constraints are not scored.
 Sensitivity must rerun each weight from 1 through 5 and each uncertain rating endpoint before any recommendation.

## Query ledger and saturation

The literal numeric query schedule was frozen in `doc/planning/jsonc-edit-rust-port.md` before these calls.
 Required source classes are registry,
 repository host,
 broader web,
 and in-repo precedent.

- Registry:
   `cargo search 'exact decimal' --limit 100` returned a truncated result with 1139 additional hits.
   `cargo search bigint --limit 100` returned 932 more.
   `cargo search 'arbitrary precision json' --limit 100` returned 406 more.
   No negative filter,
   no sort control,
   first result page only;
   registry saturation is **blocked until a paginable enumeration route is proven**.
- Repository host:
   `gh search repos 'rust arbitrary precision decimal json' --limit 100 --json fullName,url,description,updatedAt` returned no matches;
   `gh search repos 'rust bigint' --limit 100 --json fullName,url,description,updatedAt` returned five.
   No negative filter or explicit sort.
   These queries are not proof that comparable projects are absent.
- Web:
   searches for `Rust exact JSON number decimal exponent arbitrary precision source crate` and `Rust JSON number lexeme exact comparison library` returned primary project documentation for `json-number`,
   `bigdecimal`,
   `serde_json`,
   and `jstrict`.
   No negative filter.
- In-repo:
   `package/module/jsonc-edit/src/value.ts`,
   `src/scan.ts`,
   and `doc/planning/monorepo-manager-route-research/rust-structured-edits.md` document JS-number decoding,
   raw literals on the structured path,
   and integer-equality pitfalls.
   The clean fast path loses `1e0` spelling;
   the reproducible bundle probe is in `doc/planning/jsonc-edit-rust-port.md`.
- One de-duplicated taxonomy expansion round may follow the initial schedule;
   record it before running.
   Registry and repository-host pagination remain open.

## Candidate ledger

### Repository-owned validated token and exact decimal equality

- Discovery:
   existing raw-token model and Rust native port requirements in `doc/planning/jsonc-edit-rust-port.md`.
- Category:
   inspectable repository-owned local implementation;
   same native and multi-platform overlays.
- Screening:
   pending proof of full JSON-number grammar,
   exact equality across arbitrary exponents,
   complexity bounds,
   and consumer API.
   It is not automatically eligible merely because external alternatives require vetting.

### `json-number` 0.4.10

- Discovery:
   broader search at [docs.rs Number](https://docs.rs/json-number/latest/json_number/struct.Number.html);
   `cargo info json-number` reports [repository](https://github.com/timothee-haudebourg/json-number),
   MIT/Apache-2.0,
   and optional canonical and serde features.
- Category:
   inspectable open-source local crate,
   native and multi-platform overlays.
- Screening:
   pending source proof of numeric equality semantics and JSON grammar.
   Not recommended.

### `bigdecimal` 0.4.10

- Discovery:
   [docs.rs package](https://docs.rs/crate/bigdecimal/latest);
   `cargo info bigdecimal` reports [repository](https://github.com/akubera/bigdecimal-rs),
   MIT/Apache-2.0,
   and `num-bigint` dependency.
- Category:
   inspectable open-source local crate,
   native and multi-platform overlays.
- Screening:
   pending source proof for exponent range,
   formatting,
   exact equality,
   and consumer boundary.
   Not recommended.

### `serde_json` 1.0.151 with `arbitrary_precision`

- Discovery:
   `cargo info serde_json` reports the [upstream repository](https://github.com/serde-rs/json),
   MIT OR Apache-2.0,
   and `arbitrary_precision` feature.
   Previous repository research identifies false equality assumptions in its surrounding wrapper,
   not a verified limitation of this feature.
- Category:
   inspectable open-source local crate,
   native and multi-platform overlays.
- Screening:
   pending proof of number equality,
   raw-token preservation,
   and surrogate handling at the parser boundary.
   Not recommended.

### `jstrict` 0.15.0

- Discovery:
   [number API](https://docs.rs/jstrict/latest/jstrict/number/struct.Number.html) and `cargo info jstrict`,
   reporting [upstream repository](https://github.com/mskvarc/jstrict/),
   MIT OR Apache-2.0,
   and default `simdutf8` dependency.
- Category:
   inspectable open-source local crate,
   native and multi-platform overlays.
- Screening:
   pending source proof that number storage composes with JSONC token parsing.
   Not recommended.

### `rust_decimal` 1.43.0

- Discovery:
   `cargo search 'arbitrary precision json' --limit 100` and [upstream docs](https://docs.rs/rust_decimal/latest/rust_decimal/).
- Category:
   inspectable open-source local crate,
   native and multi-platform overlays.
- Screening:
   pending proof of full JSON-number exponent and coefficient domain.
   Not recommended.

## Targeted source screening, still incomplete

All clones sit under private `~/temp/agent/`;
 these reads did not execute upstream command trees.
A dependency plus repository-owned adapter remains distinct from the dependency used alone.
None has yet passed the full vet gates.

- `json-number` 0.4.10 at `283af83`,
   `src/lib.rs:110-120` describes lexical comparison and derives `PartialEq` and `Eq` on the raw bytes:

  ```rust
  /// All the comparison operations are done on this *lexical* representation,
  /// meaning that `1` is actually greater than `0.1e+80` for instance.
  #[derive(PartialEq, Eq, PartialOrd, Ord, Hash)]
  pub struct Number {
      data: [u8],
  }
  ```

  As a complete value model this fails `1 = 1.0 = 1e0`.
  As a grammar validator and token holder combined with our exact comparator it remains eligible for targeted validation.
  Its `src/lib.rs:178-210` uses a checked scan followed by an unsafe cast;
   audit this boundary if used.
- `serde_json` 1.0.151 at `afdf6fc`,
   `src/number.rs:20-25,72-73` derives equality on `Number` and sets its arbitrary-precision inner type to `String`:

  ```rust
  #[derive(Clone, PartialEq, Eq, Hash)]
  pub struct Number {
      n: N,
  }
  #[cfg(feature = "arbitrary_precision")]
  type N = String;
  ```

  That built-in equality is lexical,
   so the feature alone is not an exact semantic value model.
  A custom equality adapter remains a possible composition,
   not yet validated.
- `jstrict` 0.15.0 at `18700a1`,
   `src/number/mod.rs:105-119` explicitly documents lexical ordering and derives `PartialEq` on bytes.
  It is a strict JSON parser,
   not an attached-comment JSONC implementation.
- `reliakit-json` 1.0.0 at `7a7f574`,
   `crates/reliakit-json/src/number.rs:7-20` says equality is structural and `1`,
   `1.0`,
   `1e0` differ;
   it preserves raw spelling but fails exact numeric identity alone.
- `bigdecimal` 0.4.10 at tag `v0.4.10`,
   commit `ea0803e`,
   `src/impl_num.rs:47-55,92-104` parses exponents into `i128` then checks resulting scale fits `i64`:

  ```rust
  (base, i128::from_str(&e_exp[1..])?)
  // ...
  .and_then(|scale| scale.to_i64())
  .ok_or_else(|| ParseBigDecimalError::Other(format!("Exponent overflow when parsing '{}'", s)))?
  ```

  This cannot serve as the only representation for the full JSON number grammar,
   whose exponent has no specified digit cap.
- `scientific` 0.6.0 at `6e75628`,
   `scientific/src/types/scientific.rs:83` stores `exponent: isize`;
   `b10` 1.0.0 at `c039e3f`,
   `src/lib.rs:59-69` declares a base exponent constrained by an `i8` generic.
   Neither covers arbitrary exponent tokens as the only value representation.
- `ordecimal` 0.3.1 at `916c565`,
   `src/decimal.rs:113-130` parses `exp_str` into `i64`,
   so its advertised decimalInfinite encoding does not imply an unbounded input exponent.
  Its parser also accepts a leading plus and trims input (`src/decimal.rs:66-98`),
   so it would require a strict JSON grammar wrapper.
- `decimal-bytes` 0.6.0 at `677a792`,
   `src/encoding.rs:86-90,350-416` bounds the exponent to `MIN_EXPONENT` through `MAX_EXPONENT`,
   with `MAX_EXPONENT = 131_072`.
   It does not cover the admitted JSON-number grammar alone.

The grammar-valid raw-token representation with custom exact normalization remains a serious **candidate**,
 not an adoption.
Compare it with `json-number` plus that normalization after inspecting the latter's license,
 transitive dependencies,
 CI,
 issue history,
 and full test path.

## Registry pagination progress

The first pages of the registry searches returned 100 entries each and advertised more hits.
The crates.io API was read via `web_fetch` for pages 2 and 3 of the original three queries;
 each returned 100 entries.
The full metadata and a transparent keyword filter are saved in `~/temp/agent/jsonc-registry-pages.json`.
The keyword filter can hide numerically relevant crates whose name and description omit its keywords,
 so the full page data is retained.
Notable new leads include `fpdec`,
 `fraction`,
 `dashu-int`,
 `arbi`,
 `b10`,
 `scientific`,
 `ordecimal`,
 and `decimal-bytes`.
No saturation conclusion follows until each page's candidates are screened and the two-page condition holds.

## Repository-owned equality prototype and limits

A disposable JavaScript reference prototype at `~/temp/agent/jsonc-number-probe.mjs` validates a JSON number token,
 separates sign and significand digits,
 collapses zero,
 strips leading and trailing coefficient zeros,
 and compares the adjusted decimal exponent without materializing exponent-sized zero padding.
It retains the raw spelling separately in its call site.
 This is an algorithm probe,
 **not** a Rust library implementation or consumer validation.

- `cd -- ~/temp/agent && mise run test:number` passed,
   reporting `validated 1120 generated literals against a bounded BigInt oracle, plus edge cases`.
   The oracle cross-multiplies exact rational values only for bounded exponents;
   generated literals include signed coefficients,
   fractions and exponents.
   Targeted cases cover `1 = 1.0 = 1e0`,
   `100 = 1e2`,
   `0.00100 = 1e-3`,
   all zero spellings,
   adjacent integers beyond 2^53,
   distinct huge exponents and a compensating huge-exponent equality.
   Invalid forms include missing exponent digits,
   leading zero,
   invalid sign and Unicode digit.
- Positive control:
   `mise run test:number:control` deliberately dropped the exponent from identity and failed on huge positive versus negative exponents (`true !== false`,
   exit 1).
   The unmodified task passed again afterward.
   Thus an unchanged test result from the prototype is not an unproven null.
- Remaining failure risks:
   the prototype uses JavaScript `BigInt` to adjust exponents,
   while the Rust implementation needs a bounded-by-input,
   sign-aware decimal-exponent representation without machine-integer overflow.
   Exact equality and hashing must share normalized identity;
   `-0` equals `0` while retaining original spelling.
   The scratch probe cannot establish Rust ergonomics,
   linear time,
   parser integration,
   or published crate behavior.

Further source screening:
 `fpdec` 0.14.1,
 `~/temp/agent/fpdec-2026-09-24` at `b9ac6e5`,
 `src/lib.rs:98-131` stores `coeff: i128` and restricts fractional digits to `MAX_N_FRAC_DIGITS`;
 it cannot be the only representation for arbitrary JSON numbers.
 Its `LICENSE.TXT:1-3` identifies BSD 3-Clause despite registry `cargo info` reporting `license: unknown` (manifest uses `license-file`,
 not a license identifier).
 `fraction` 0.17.0 at `~/temp/agent/fraction-2026-09-24` uses `BigInt`-backed rationals but does not by itself preserve a raw JSON number token or provide unbounded exponents without magnitude-sized denominator/numerator expansion;
 a custom exponent layer would still be needed.
 The latter is an architectural inference,
 not a verified execution result.

## Regex screening, 2026-09-24

The user requested early regex culling.
 Our operational screening interprets this as production parsing or lexing and required normal/build dependencies,
 not upstream dev-only usage.
 The inspected direct source and manifest for `json-number` 0.4.10 at `~/temp/agent/json-number-2026-09-24` contains no `regex::`,
 `Regex::`,
 `#[regex]`,
 `logos`,
 or direct regex dependency;
 `src/lib.rs:117-195` validates number grammar with a state machine.
 Its exact-version normal/build Cargo dependency graph contains no regex-named package,
 while full transitive source screening remains pending.
 The repository-owned token/normalization prototype uses direct scans;
 it remains an incomplete JavaScript proof,
 not Rust validation.

### Resolved production dependency graph

`~/temp/agent/jsonc-regex-audit/json-number/tree.txt` records `mise run audit:regex-deps`,
 using Cargo `tree --edges normal,build --target all --format {p}` for `json-number = "=0.4.10"`.
 Neither `lexical` nor its selected `lexical-core` family brought a package named `regex`,
 `logos`,
 `pest`,
 `regex-automata`,
 `regex-syntax`,
 `onig`,
 or `fancy-regex`.
 The same script's `edikt-jsonc` positive control found all of `logos`,
 `regex`,
 `regex-automata` and `regex-syntax`;
 an empty result is meaningful for package-name screening.
 Source-level checks of transitive production code remain open,
 and the graph does not establish numeric correctness.

## Discovery expansion progress

The frozen expansion in `doc/planning/jsonc-edit-rust-port.md` ran `cargo search 'json number' --limit 100`,
 `cargo search 'decimal arbitrary exponent' --limit 100`,
 `gh search repos 'rust json number' --limit 100 --json fullName,url,description,updatedAt`,
 and a web query for `Rust lexical JSON number numeric equality arbitrary exponent crate`.
 The repository-host query returned no matches;
 its narrower wording cannot prove comparable projects absent.
 The web query returned source/docs leads for `json-number`,
 `json-syntax`,
 `reliakit-json`,
 and lexical parsing tools.

The crates.io API was paged through `web_fetch` for pages 2 and 3 of `json number` (100 records each),
 and page 2 of `decimal arbitrary exponent` (empty,
 with `next_page: null`).
 A name/description filter over the `json number` pages surfaced `rust_decimal` and `dashu` on page 2,
 neither newly discovered;
 page 3 surfaced none under that filter.
 `rust_decimal` is described by its [docs](https://docs.rs/rust_decimal/latest/rust_decimal/) as fixed precision;
 `dashu`'s [crate metadata](https://crates.io/crates/dashu) is an arithmetic family,
 not a lossless JSON number token and exact decimal-exponent identity on its own.
 These are category readings,
 not execution results.
 The full page records must be inspected before two-page saturation is claimed because filtering could hide a less obvious candidate.

Page 2 and page 3 of the initial `exact decimal`,
 `bigint`,
 and `arbitrary precision json` registry searches were also retrieved earlier.
 Their obvious leads include `fpdec`,
 `fraction`,
 `bigdecimal`,
 `ordecimal`,
 `decimal-bytes`,
 `arbi` and `dashu`;
 source screening recorded limitations for several.
 The three initial Cargo searches each advertised more results after their first 100,
 so their initial response alone was not saturation.
 No candidate is recommended from these partial pages.

## Rust owned-number prototype, not an adopted foundation

A disposable,
 dependency-free Rust library at `~/temp/agent/jsonc-exact-number-probe/` validates JSON number grammar and computes numeric identity from sign,
 normalized nonzero coefficient digits,
 and a signed decimal exponent stored as text.
 It uses direct byte scans and decimal column addition/subtraction,
 with no regex or recursion.
 The original token remains the caller's responsibility;
 this prototype has no JSONC parser,
 comment model,
 or serializer.
 It is evaluation code outside the main worktree.

- `cd -- ~/temp/agent/jsonc-exact-number-probe && mise run test` passed the Rust unit suite,
   including mathematical equality across `1`,
   `1.0`,
   `1e0`,
   signed zero,
   compensated exponents longer than machine integers,
   adjacent large integers,
   invalid grammar,
   and a generated bounded-domain comparison with an independently computed `i128` rational oracle.
- Positive control:
   replacing only the adjusted-exponent calculation with `String::from("0")` caused `unequal_values` and `generated_against_rational_oracle` to fail.
   The original expression was restored,
   a SHA-256 comparison to the saved pre-mutation source matched,
   and `mise run test` passed again.
   Later additional equivalent/unequal cases passed.
- `mise run lint:clippy` passed with warnings denied after changing the scratch source's digit check to `is_ascii_digit` and its nonzero-start branch to a named local.
   The scratch manifest mirrors the repository Rust convention allowing `needless_return` while denying implicit returns.
   This is not a claim that the final crate passes its own linter.
- A separate disposable consumer at `~/temp/agent/jsonc-exact-number-consumer/` imported the library by a local path and ran `mise run test`,
   printing `consumer exact-number equality passed`.
   Its first run failed because the hand-written fixture compared exponents with different digit counts;
   that test input was measured and corrected before the passing run.
   No product code was touched.

The core operates on ASCII tokens of finite in-memory length,
 scans each character through grammar and coefficient normalization,
 and adds or subtracts exponent digit strings without expanding `10^E`.
 This suggests work bounded by input length,
 but the full crate's complexity and error contracts have not been measured.
 Candidate validation remains incomplete until its public value type retains raw spellings,
 edited inputs preserve exactness,
 and the port runs through the JSONC comment and serializer surfaces.

## Prototype review correction and expanded verification

An independent review found that the first Rust prototype exposed mutable-invariant `Identity` fields and compared `Result` values directly,
 so some purportedly valid fixtures could have passed through matching parse errors.
 The scratch `Identity` fields are now private.
 Equality and inequality tests unwrap each valid input before comparing,
 and every generated source is validated before sampled pair comparisons.
 A `HashSet` test checks equal spellings hash and compare consistently,
 including signed zero.
 The bounded rational oracle remains independently computed rather than using the normalizer.

Additional targeted cases exercise an uppercase exponent marker and leading zeros,
 malformed number tokens,
 multi-digit fraction and trailing-zero adjustments,
 and signed carry/borrow over 256 exponent digits.
 `mise run lint:clippy` passed with warnings denied;
 `mise run test` passed the expanded Rust unit suite.
 The disposable consuming crate's `mise run test` also passed again after those changes.
 The earlier exponent-omission mutation demonstrated test sensitivity but was run before these additions;
 do not claim it killed every arithmetic fault.
 Public raw-token storage,
 serialization,
 full parser integration,
 runtime scaling measurements,
 and release consumer tests remain open.

## Pending evidence and validation

- Finish required discovery saturation or report a blocked terminal outcome;
   record exact expansion queries and pagination attempts.
- Clone every serious candidate under private `~/temp/agent/` using `gh repo clone`,
   disable clone push targets before any prototype commit,
   and record revisions.
- Inspect licenses,
   manifests,
   source parsing and equality paths,
   test/CI and maintenance;
   complete applicable hard gates and overlays.
   Do not run third-party build/test commands before inspecting execution trees and sandboxing.
- Validate every hard-gate survivor at equal depth,
   including original spelling,
   `1 = 1.0 = 1e0`,
   `-0`,
   integers past 2^53,
   large exponents,
   invalid grammar,
   and consumer use in a throwaway Rust crate.
- Freeze evidence-backed ratings,
   run scoring and sensitivity,
   state complete ranking with pros,
   cons and adjacent reasons,
   then present recommendation to the user for adoption.
   No dependency change or decision record before adoption.
