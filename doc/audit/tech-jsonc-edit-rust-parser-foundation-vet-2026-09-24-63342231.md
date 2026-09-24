# Vet the parser foundation for a native Rust jsonc-edit

## Status and fingerprint

- Status: Discovery and targeted source screening, incomplete. No candidate is recommended or adopted.
- Subject: jsonc-edit Rust parser foundation.
- Scope: Choose a parser and token source for the published native Rust comment-as-data JSONC editor.
- Started and last updated: 2026-09-24.
- Owner: current coding-agent session.
- Governing skill: `.agents/skills/choosing-technology/SKILL.md` at `a05818ad7`, SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Fingerprint, RFC 8785 canonicalized schema version 1: `63342231cc8d34fcdb2effc92f9c276181ddde482f704a397f3eb0b25fe8cf26`.
- No compatible prior parser-foundation report was found by a `rg --files doc/audit` search for JSONC or Rust parser.
- Category: inspectable open-source local technology, including a repository-owned translation as baseline. Overlays: native, multi-platform and untrusted parsing input. No browser, credential, or CI-execution overlay for the library itself. The maintained TypeScript library is a behavior reference, not removed.
- Hard constraints: strict JSONC-only container roots, original numeric and quoted-string lexemes, escaped unpaired UTF-16 surrogate support, separately queryable normalized comments on keys and values after adaptation, inspectable source and reproducible validation, compatible licensing, and no regex-backed production parsing or lexing in required dependencies.
- Deployment: native Rust crate on Linux, macOS and Windows, crates.io release.
- Criteria, frozen before candidate rating with default weight 1 each: source auditability, API clarity for the comment model, dependency and build surface, maintenance evidence, and measured parse performance. Ratings and sensitivity remain pending.

## Discovery schedule and limits

The delegated research froze its literal initial queries before discovery:

- In-repo: `rg --files doc package | rg 'rust-structured-edits|jsonc|json-five|biome_json|edikt'` and `rg --line-number 'jsonc-parser|edikt-jsonc|json-five|biome_json_parser|attached.comment|surrogate' doc package`.
- Registry/web: `site:crates.io/crates/ jsonc-parser edikt-jsonc json-five biome_json_parser latest version repository` and `Rust JSONC parser lossless comments tokens raw string escapes exact numeric literals crates source` via Exa fast/Linkup fallback.
- Repository host: targeted official source linked from crates and repository decision records; broad GitHub query and registry pagination remain to be run. One de-duplicated expansion round must be frozen and recorded from taxonomy terms before further discovery.

Both local delegated `rg` queries were blocked by its security guardrail, so targeted reads were used instead. No class is saturated; counts and page cursors are still needed. The browser/page source findings here are leads, not hard-gate confirmations until pinned repository source is read and behavior probed.

## Candidate ledger

### Repository-owned parser translation

- Discovery: `package/module/jsonc-edit/src/parse.ts`, `src/scan.ts`, `src/parse-trivia.ts` and accepted `doc/decision/jsonc-edit-parser-foundation.md`.
- Category: inspectable repository-owned implementation, native and multi-platform overlays.
- Screening: plausible semantic fit. Rust UTF-16 values and exact numeric model differ from TypeScript, so direct translation needs design and verification; not automatically recommended.

### `jsonc-parser` 0.33.2

- Discovery: [versioned source and API](https://docs.rs/jsonc-parser/0.33.2/jsonc_parser/) and prior in-repo [Rust edit survey](../planning/monorepo-manager-route-research/rust-structured-edits.md).
- Category: inspectable open-source Rust parser with native and multi-platform overlays.
- Screening: source at private clone `~/temp/agent/jsonc-parser-2026-09-16`, revision `e6e3837`, `src/scanner.rs:175-201` decodes escaped strings during scanning; `src/string.rs:214-261` rejects unpaired high and low surrogates. It cannot parse the required accepted string domain as-is. An upstream fork modifying its string scanner would be a distinct custom candidate. It exposes comments and raw number tokens, but normalized key/value attachment and canonical emission would still be repository code.

### `edikt-jsonc` 0.4.0

- Discovery: [crates.io entry](https://crates.io/crates/edikt-jsonc) and [lexer source](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/lexer.rs).
- Category: inspectable open-source Rust lexer/CST with native and multi-platform overlays.
- Screening: raw comments, strings, and numbers are available. [Comment projection](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/comments.rs) puts key-side and value-side comments together on the value, so an attachment layer is still needed. [Value projection](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/project.rs) uses `f64` for some numbers and Rust `String`; bypassing it may allow a compliant projection from raw tokens. JSON5 and malformed-input acceptance requires strict validation. Excluded at the regex hard gate: `lexer.rs:47-69` uses Logos `#[regex(...)]` patterns in production. Stop candidate validation.

### `json-five` 0.3.1

- Discovery: [round-trip token source](https://docs.rs/crate/json-five/0.3.1/source/src/rt/tokenize.rs) and [parser source](https://docs.rs/crate/json-five/0.3.1/source/src/rt/parser.rs).
- Category: inspectable open-source Rust parser with native and multi-platform overlays.
- Screening: raw scalar text and comment-bearing whitespace contexts may support an adapter, but JSON5 grammar and scalar roots need strict validation. The prior in-repo survey records a malformed block-comment emission; the canonical emitter in this port may avoid that path. UTF-16 behavior not yet verified.

### `biome_json_parser` 0.5.7

- Discovery: [lexer source](https://docs.rs/crate/biome_json_parser/0.5.7/source/src/lexer/mod.rs) and [parser source](https://docs.rs/crate/biome_json_parser/0.5.7/source/src/lib.rs).
- Category: inspectable open-source Rust parser with native and multi-platform overlays.
- Screening: lossless trivia and raw scalar ranges may support an adapter. [Prior repository research](../planning/monorepo-manager-route-research/rust-structured-edits.md) corrected its build pin count to three exact companion crates. Strict container-root validation and the attached-comment layer remain repository work. Token support for unpaired escapes must be probed.

### `jwc` 0.1.0

- Discovery: [AST source](https://docs.rs/crate/jwc/0.1.0/source/src/ast.rs) and [parser source](https://docs.rs/crate/jwc/0.1.0/source/src/single_pass_parser.rs).
- Category: inspectable open-source Rust parser with native and multi-platform overlays.
- Screening: key and value trivia are distinguished, but its parser rejects unpaired surrogate escapes according to source in the delegated research. It cannot parse the required domain as-is. Numeric values use approximate `f64` beyond bounded integers, so an exact adapter would also be needed.

## Current source checks, not a recommendation

- `jsonc-parser` 0.33.2, private clone `~/temp/agent/jsonc-parser-2026-09-24` at `e6e3837` (`Cargo.toml:3` names the version): `src/scanner.rs:175-201` calls the string decoder for escaped tokens, and `src/string.rs:214-261` explicitly returns `InvalidUnicodeEscapeSequence` for an unpaired high or low surrogate. The existing crate cannot parse `{"s":"\uD800"}` in its required JSONC grammar. Using its scanner would require an upstream fork, which is a distinct custom candidate.

  ```rust
  // src/scanner.rs:199-201
  crate::string::parse_string_with_char_provider(self)
    .map(Token::String)
    .map_err(|err| self.create_error_for_start(err.byte_index, ParseErrorKind::String(err.kind)))
  ```

- `edikt-jsonc` 0.4.0, private clone `~/temp/agent/edikt-2026-09-24` at `c87295c` (`crates/edikt-jsonc/Cargo.toml:3`): its `project.rs:122-131` converts a large integer to `f64`, and its `project.rs:140-185` unescapes `\u` via `char::from_u32`. An unpaired surrogate has no Rust `char` and falls through without appending a code unit. A compliant adapter must bypass that projection, read raw lexer tokens, decode to UTF-16, and implement the library's own comment attachment. `crates/edikt-jsonc/Cargo.toml:9-15` lists `edikt-core`, `edikt-syntax`, `logos`, `rowan` and `thiserror` as direct dependencies. License, CI, tests and full transitive tree remain to be checked.

  ```rust
  // crates/edikt-jsonc/src/project.rs:172-175
  let hex: String = chars.by_ref().take(4).collect();
  if let Some(ch) = u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) {
      out.push(ch);
  }
  ```

- `json-five` 0.3.1, private clone `~/temp/agent/json-five-rs-2026-09-24` at `650be6a` (`Cargo.toml:3`): `src/rt/parser.rs:94-145` stores number and quoted-string lexemes verbatim; `src/rt/parser.rs:21` calls whitespace/comment context `Wsc = String`. It needs strict JSONC validation and a separate attached-comment parser and canonical emitter. Its `Cargo.toml:14-24` lists `unicode-general-category` and optional `serde` as production dependencies. Unpaired-surrogate acceptance in the round-trip parser remains to be probed.

`json-five` remains a serious composed candidate, not a validated finalist; `edikt-jsonc` is excluded by the regex hard gate. The repository-owned parser translation remains a baseline. `biome_json_parser` and other discovered candidates remain unscreened against the exact surrogate and comment boundary; no elimination or ranking is justified yet.

## Parser expansion findings and registry pages

The frozen expansion searched crates.io using `jsonc comments` and `lossless json parser`.
For the first query, page 1 and page 2 each returned 100 records, and page 3 was empty (page 2 metadata reported total 200).
For the second, pages 1 and 2 each returned 100, and page 3 returned 86 with no next page (total 286).
These registry queries are exhausted, not evidence that every library is viable or that the broader discovery is complete.
The two frozen `gh search repos` queries returned no records; broaden to comparable linked upstream repositories before calling the repository-host class saturated.
Web searches discovered `jwc`, `hifijson`, `fjson`, `tokora`, and lexer-only `any-lexer` as leads; most lack evidence of the attached JSONC comment model.

### `fjson` 0.3.1

- Discovery: crates.io `jsonc comments` page 1, [registry](https://crates.io/crates/fjson/0.3.1), private clone `~/temp/agent/fjson-2026-09-24` at `fe5a04a`, `Cargo.toml:3` confirms 0.3.1 and `:13-15` names `arrayvec` and `unicode-width` as runtime dependencies.
- Screening: `src/scanner.rs:142-181,186-215,223-271` returns raw JSON numbers, quoted strings (without outer quotes) and C-style comments. Its `src/ast.rs:12-60` holds same-line value comments but keeps most comments as separate `Metadata` objects, not distinct key/value comment fields. An attachment and merge layer, UTF-16 decoder and canonical writer are still needed. `src/ast.rs:64,83` caps parser recursion at 128 levels, while the TypeScript structured parser allows 512 (`package/module/jsonc-edit/src/parse.ts:21,54`). Its scanner also skips Unicode whitespace outside strings (`src/scanner.rs:335-339`), whereas strict JSONC uses JSON whitespace. These are source observations, not a completed upstream-behavior diagnosis or a validated workaround.

  ```rust
  // src/scanner.rs:335-339
  fn skip_whitespace(&mut self) {
      while let Some(c) = self.peek_char() {
          if c.1.is_whitespace() && c.1 != '\n' {
              self.skip_char();
  ```

- Source quality lead: `src/lib.rs:151` forbids unsafe code. `.github/workflows/test.yml` runs Cargo fmt, build, clippy and test, with no build script in this crate's manifest; transitive command trees are not yet audited. This is a serious lexer/AST candidate, not a finalist.

### Other registry leads

- `jsonc` 0.1.0 has no repository URL in registry metadata; the published source in the local Cargo cache (`jsonc_document.rs:2-4,62-73,107-119`) wraps `jsonc-parser` and projects through `serde_json::Value`. It inherits the upstream scanner's surrogate constraint and cannot provide the full contract as-is.
- `jsonc_tools` 0.0.1 published source (`src/lib.rs:1-18`, `src/parser/parser.rs:1-13`) is a scaffold with no JSONC parser implementation. Category mismatch.
- `jsontape`, `hifijson`, `tokora`, `purrdf-json`, and `momoa` remain discovery leads requiring category screening; none is yet recommended or rejected on registry description alone.

## Regex screening, 2026-09-24

The user requested early regex culling. Our operational screening interprets this as production parsing or lexing and required normal/build dependencies, not upstream dev-only usage. The original TypeScript scanner in `package/module/jsonc-edit/src/scan.ts` uses direct character scans. `edikt-jsonc` 0.4.0 is now **excluded**: `crates/edikt-jsonc/src/lexer.rs:47-69` uses repeated `#[regex(...)]` patterns through `logos::Logos` (`:23`), not merely a dev-only regex dependency. See [versioned lexer source](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/lexer.rs). Stop its audit at this hard gate. The `tokora` 0.11.0 [JSON CST example](https://docs.rs/crate/tokora/0.11.0/source/examples/json_cst.rs) likewise uses `logos` with `#[regex(...)]` for whitespace, number and string tokens; exclude that example as a proposed foundation, not the combinator crate in every possible configuration.

`json-five` 0.3.1 lists `regex = "1"` only under `[dev-dependencies]` in `Cargo.toml:30-32`; its inspected production `src/` has no `regex::`, `Regex::`, `#[regex]`, or `logos` use. Do not cull on test-only dependencies. Direct source/manifests for `fjson`, `jsonc-parser`, `biome_json_parser`, `jwc`, and `hifijson` yielded no matching regex calls or macros under the same targeted search, and the resolved dependency graph was then checked for their selected configurations. Their broader behavior and source audits remain pending; this is not a claim of universal regex absence.

### Resolved production dependency graphs

A disposable set of exact-version manifests under `~/temp/agent/jsonc-regex-audit/` ran `mise run audit:regex-deps`, which invokes Cargo `tree --edges normal,build --target all --format {p}` without compiling upstream code. The individual graphs are saved as `tree.txt` in each case directory. `fjson` 0.3.1, `json-five` 0.3.1 with and without default features, `biome_json_parser` 0.5.7 with the exact companion pins, `hifijson` 0.5.0, `jsonc-parser` 0.33.2 with `cst`, and `jwc` 0.1.0 showed no package named `regex`, `logos`, `pest`, `regex-automata`, `regex-syntax`, `onig`, or `fancy-regex` in normal/build dependency graphs. Positive control `edikt-jsonc` 0.4.0 showed `logos`, `logos-codegen`, `regex`, `regex-automata`, and `regex-syntax`; the probe can reveal the unwanted dependencies. This verifies package names under the selected versions/features, not every line of transitive source or a future resolution. Keep source-level regex clearance pending where required.

## Existing-parser contract exits

These are outcomes for published implementations **as-is**, not proof that every possible fork, token adapter, or new parser implementation is impossible.

- `jsonc-parser` 0.33.2: `src/scanner.rs:175-201` calls `parse_string_with_char_provider` for escapes and `src/string.rs:214-261` rejects an unpaired high or low surrogate. This is a hard failure for the required accepted string domain. It also does not supply the normalized, attached-comment model as-is.
- `jwc` 0.1.0: the published `src/single_pass_parser.rs:201-222` explicitly errors on a low surrogate or a high surrogate not followed by a low one. It fails the string-domain hard gate as-is, regardless of its regex-free production dependency graph.
- `fjson` 0.3.1: `src/ast.rs:64,83` limits container nesting to 128. The TypeScript structured parser permits depth through 512 (`package/module/jsonc-edit/src/parse.ts:21,55`), and its comment-free fast path delegates to `JSON.parse`; the published `fjson` parser cannot preserve the supported depth domain as-is. `src/scanner.rs:335-339` also skips non-JSON Unicode whitespace. A scanner-only use paired with our own grammar/parser is a distinct composition, not an as-is editor.
- `json-five` 0.3.1: [prior corpus probes](../planning/monorepo-manager-route-research/rust-structured-edits.md) show JSON5-only syntax and scalar roots accepted, where the TypeScript JSONC conformance tests reject them; it is not a strict JSONC parser as-is. Its round-trip printer's block-comment closing-slash defect is recorded in `doc/troubleshooting/json-five-unterminated-block-comment.md`. An independently strict validator and canonical emitter would be repository code.
- `hifijson` 0.5.0: [official crate documentation](https://docs.rs/hifijson/0.5.0/hifijson/) describes JSON token and value lexers, not JSONC comment tokens or separately attached key/value comments. It is not a ready-to-use implementation of this editor; coupling its scalar lexer to an owned comment scanner is a distinct composition.

The documented hard exits make the owned-parser translation eligible for serious evaluation under the existing-tools-first rule; they do not establish it as a validated winner. `biome_json_parser` 0.5.7, `fjson` scanner-only, `json-five` raw-token adapter, and a repository-owned parser remain different unvalidated compositions. Regex-free dependency screening does not imply semantic parity.

## Evidence and validation still required

- Finish the scheduled registry, repository-host and broader-web discovery with pagination saturation and an expansion round. Log every query, filters, result counts and newly discovered survivor.
- Clone every serious alternative under private `~/temp/agent/`, pin release revision, inspect licenses, manifests, source, tests/CI and maintenance. The delegated research read remote sources and did not execute code; its findings are not final validation.
- Audit relevant parser and serializer paths for original scalar tokens, comments, escaped unpaired surrogates, strict JSONC, resource bounds and errors. Compare a repository-owned parser with any third-party raw-token adapter at equal depth.
- Inspect every third-party execution tree and isolate any build/test/probe before running it. Exercise the TypeScript conformance corpus, comment queries, malformed cases, exact numbers and surrogates from a disposable Rust consumer.
- Rate validated finalists with the frozen rubric, run sensitivity and publish a full ranking with pros, cons and adjacent reasons. Present the result for separate adoption. No product dependency, decision record, or release change before adoption.
