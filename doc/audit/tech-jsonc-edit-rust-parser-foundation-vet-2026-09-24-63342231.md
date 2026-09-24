# Vet the parser foundation for a native Rust jsonc-edit

## Status and fingerprint

- Status:
   Discovery and targeted source screening,
   incomplete.
   No candidate is recommended or adopted.
- Subject:
   jsonc-edit Rust parser foundation.
- Scope:
   Choose a parser and token source for the published native Rust comment-as-data JSONC editor.
- Started and last updated:
   2026-09-24.
- Owner:
   current coding-agent session.
- Governing skill:
   `.agents/skills/choosing-technology/SKILL.md` at `a05818ad7`,
   SHA-256 `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.
- Fingerprint,
   RFC 8785 canonicalized schema version 1:
   `63342231cc8d34fcdb2effc92f9c276181ddde482f704a397f3eb0b25fe8cf26`.
- No compatible prior parser-foundation report was found by a `rg --files doc/audit` search for JSONC or Rust parser.
- Category:
   inspectable open-source local technology,
   including a repository-owned translation as baseline.
   Overlays:
   native,
   multi-platform and untrusted parsing input.
   No browser,
   credential,
   or CI-execution overlay for the library itself.
   The maintained TypeScript library is a behavior reference,
   not removed.
- Hard constraints:
   strict JSONC-only container roots,
   original numeric and quoted-string lexemes,
   escaped unpaired UTF-16 surrogate support,
   separately queryable normalized comments on keys and values after adaptation,
   inspectable source and reproducible validation,
   compatible licensing,
   and no regex-backed production parsing or lexing in required dependencies.
- Deployment:
   native Rust crate on Linux,
   macOS and Windows,
   crates.io release.
- Criteria,
   frozen before candidate rating with default weight 1 each:
   source auditability,
   API clarity for the comment model,
   dependency and build surface,
   maintenance evidence,
   and measured parse performance.
   Ratings and sensitivity remain pending.

## Discovery schedule and limits

The delegated research froze its literal initial queries before discovery:

- In-repo:
   `rg --files doc package | rg 'rust-structured-edits|jsonc|json-five|biome_json|edikt'` and `rg --line-number 'jsonc-parser|edikt-jsonc|json-five|biome_json_parser|attached.comment|surrogate' doc package`.
- Registry/web:
   `site:crates.io/crates/ jsonc-parser edikt-jsonc json-five biome_json_parser latest version repository` and `Rust JSONC parser lossless comments tokens raw string escapes exact numeric literals crates source` via Exa fast/Linkup fallback.
- Repository host:
   targeted official source linked from crates and repository decision records;
   broad GitHub query and registry pagination remain to be run.
   One de-duplicated expansion round must be frozen and recorded from taxonomy terms before further discovery.

Both local delegated `rg` queries were blocked by its security guardrail,
 so targeted reads were used instead.
 No class is saturated;
 counts and page cursors are still needed.
 The browser/page source findings here are leads,
 not hard-gate confirmations until pinned repository source is read and behavior probed.

## Candidate ledger

### Repository-owned parser translation

- Discovery:
   `package/module/jsonc-edit/src/parse.ts`,
   `src/scan.ts`,
   `src/parse-trivia.ts` and accepted `doc/decision/jsonc-edit-parser-foundation.md`.
- Category:
   inspectable repository-owned implementation,
   native and multi-platform overlays.
- Screening:
   plausible semantic fit.
   Rust UTF-16 values and exact numeric model differ from TypeScript,
   so direct translation needs design and verification;
   not automatically recommended.

### `jsonc-parser` 0.33.2

- Discovery:
   [versioned source and API](https://docs.rs/jsonc-parser/0.33.2/jsonc_parser/) and prior in-repo [Rust edit survey](../planning/monorepo-manager-route-research/rust-structured-edits.md).
- Category:
   inspectable open-source Rust parser with native and multi-platform overlays.
- Screening:
   source at private clone `~/temp/agent/jsonc-parser-2026-09-16`,
   revision `e6e3837`,
   `src/scanner.rs:175-201` decodes escaped strings during scanning;
   `src/string.rs:214-261` rejects unpaired high and low surrogates.
   It cannot parse the required accepted string domain as-is.
   An upstream fork modifying its string scanner would be a distinct custom candidate.
   It exposes comments and raw number tokens,
   but normalized key/value attachment and canonical emission would still be repository code.
- Adapter boundary:
   `src/scanner.rs:175-201` produces `Token::String(Cow<str>)` through the escape-decoding path;
   `src/tokens.rs:8-22` has no raw-string token variant,
   and `src/cst/mod.rs:1146-1160` calls `parse_to_ast` before CST construction.
   Thus the public AST and CST paths cannot merely bypass the rejecting decoder for a surrogate escape.
   A source-preserving surrogate prepass plus an owned UTF-16 decoder is a separate **unvalidated** adapter hypothesis,
   not a property of the upstream crate.
   `src/parse_to_ast.rs:285-309` recursively enters array and object parsing,
   and `src/cst/mod.rs:2541-2576` recursively builds CST containers;
   any adapter would also need a bounded accepted-depth lifecycle probe.

### `edikt-jsonc` 0.4.0

- Discovery:
   [crates.io entry](https://crates.io/crates/edikt-jsonc) and [lexer source](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/lexer.rs).
- Category:
   inspectable open-source Rust lexer/CST with native and multi-platform overlays.
- Screening:
   raw comments,
   strings,
   and numbers are available.
   [Comment projection](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/comments.rs) puts key-side and value-side comments together on the value,
   so an attachment layer is still needed.
   [Value projection](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/project.rs) uses `f64` for some numbers and Rust `String`;
   bypassing it may allow a compliant projection from raw tokens.
   JSON5 and malformed-input acceptance requires strict validation.
   Excluded at the regex hard gate:
   `lexer.rs:47-69` uses Logos `#[regex(...)]` patterns in production.
   Stop candidate validation.

### `json-five` 0.3.1

- Discovery:
   [round-trip token source](https://docs.rs/crate/json-five/0.3.1/source/src/rt/tokenize.rs) and [parser source](https://docs.rs/crate/json-five/0.3.1/source/src/rt/parser.rs).
- Category:
   inspectable open-source Rust parser with native and multi-platform overlays.
- Screening:
   raw scalar text and comment-bearing whitespace contexts may support an adapter,
   but JSON5 grammar and scalar roots need strict validation.
   The prior in-repo survey records a malformed block-comment emission;
   the canonical emitter in this port may avoid that path.
   UTF-16 behavior not yet verified.

### `biome_json_parser` 0.5.7

- Discovery:
   [lexer source](https://docs.rs/crate/biome_json_parser/0.5.7/source/src/lexer/mod.rs) and [parser source](https://docs.rs/crate/biome_json_parser/0.5.7/source/src/lib.rs).
- Category:
   inspectable open-source Rust parser with native and multi-platform overlays.
- Screening:
   lossless trivia and raw scalar ranges may support an adapter.
   [Prior repository research](../planning/monorepo-manager-route-research/rust-structured-edits.md) corrected its build pin count to three exact companion crates.
   Strict container-root validation and the attached-comment layer remain repository work.
   The published `src/lexer/mod.rs:494-607,635-683` scans an escaped `\uXXXX` as four hex digits without decoding it into a Rust `char`;
   `src/syntax.rs:151-230` parses nested sequences with an explicit `Vec` stack.
   `src/parser.rs:16-29` exposes comment and trailing-comma options.
   This source shape is a promising raw-syntax adapter,
   but runtime acceptance of lone surrogates,
   raw-node projection,
   deep tree lifecycle and full validation remain unproven.

### `jwc` 0.1.0

- Discovery:
   [AST source](https://docs.rs/crate/jwc/0.1.0/source/src/ast.rs) and [parser source](https://docs.rs/crate/jwc/0.1.0/source/src/single_pass_parser.rs).
- Category:
   inspectable open-source Rust parser with native and multi-platform overlays.
- Screening:
   key and value trivia are distinguished,
   but its parser rejects unpaired surrogate escapes according to source in the delegated research.
   It cannot parse the required domain as-is.
   Numeric values use approximate `f64` beyond bounded integers,
   so an exact adapter would also be needed.

## Current source checks, not a recommendation

- `jsonc-parser` 0.33.2,
   private clone `~/temp/agent/jsonc-parser-2026-09-24` at `e6e3837` (`Cargo.toml:3` names the version):
   `src/scanner.rs:175-201` calls the string decoder for escaped tokens,
   and `src/string.rs:214-261` explicitly returns `InvalidUnicodeEscapeSequence` for an unpaired high or low surrogate.
   The existing crate cannot parse `{"s":"\uD800"}` in its required JSONC grammar.
   Using its scanner would require an upstream fork,
   which is a distinct custom candidate.

  ```rust
  // src/scanner.rs:199-201
  crate::string::parse_string_with_char_provider(self)
    .map(Token::String)
    .map_err(|err| self.create_error_for_start(err.byte_index, ParseErrorKind::String(err.kind)))
  ```

- `edikt-jsonc` 0.4.0,
   private clone `~/temp/agent/edikt-2026-09-24` at `c87295c` (`crates/edikt-jsonc/Cargo.toml:3`):
   its `project.rs:122-131` converts a large integer to `f64`,
   and its `project.rs:140-185` unescapes `\u` via `char::from_u32`.
   An unpaired surrogate has no Rust `char` and falls through without appending a code unit.
   A compliant adapter must bypass that projection,
   read raw lexer tokens,
   decode to UTF-16,
   and implement the library's own comment attachment.
   `crates/edikt-jsonc/Cargo.toml:9-15` lists `edikt-core`,
   `edikt-syntax`,
   `logos`,
   `rowan` and `thiserror` as direct dependencies.
   License,
   CI,
   tests and full transitive tree remain to be checked.

  ```rust
  // crates/edikt-jsonc/src/project.rs:172-175
  let hex: String = chars.by_ref().take(4).collect();
  if let Some(ch) = u32::from_str_radix(&hex, 16).ok().and_then(char::from_u32) {
      out.push(ch);
  }
  ```

- `json-five` 0.3.1,
   private clone `~/temp/agent/json-five-rs-2026-09-24` at `650be6a` (`Cargo.toml:3`):
   `src/rt/parser.rs:94-145` stores number and quoted-string lexemes verbatim;
   `src/rt/parser.rs:21` calls whitespace/comment context `Wsc = String`.
   It needs strict JSONC validation and a separate attached-comment parser and canonical emitter.
   Its `Cargo.toml:14-24` lists `unicode-general-category` and optional `serde` as production dependencies.
   Unpaired-surrogate acceptance in the round-trip parser remains to be probed.

`json-five` remains a serious composed candidate,
 not a validated finalist;
 `edikt-jsonc` is excluded by the regex hard gate.
 The repository-owned parser translation remains a baseline.
 `biome_json_parser` has source-level lexical and grammar evidence but still lacks a runtime surrogate and comment-boundary probe;
 other discovered candidates remain unscreened against those requirements;
 no elimination or ranking is justified yet.

## Parser expansion findings and registry pages

The frozen expansion searched crates.io using `jsonc comments` and `lossless json parser`.
For the first query,
 page 1 and page 2 each returned 100 records,
 and page 3 was empty (page 2 metadata reported total 200).
For the second,
 pages 1 and 2 each returned 100,
 and page 3 returned 86 with no next page (total 286).
These registry queries are exhausted,
 not evidence that every library is viable or that the broader discovery is complete.
The two frozen `gh search repos` queries returned no records;
 broaden to comparable linked upstream repositories before calling the repository-host class saturated.
Web searches discovered `jwc`,
 `hifijson`,
 `fjson`,
 `tokora`,
 and lexer-only `any-lexer` as leads;
 most lack evidence of the attached JSONC comment model.

### `fjson` 0.3.1

**Source correction:**
 the shallow clone initially pointed at `fe5a04a` despite its `Cargo.toml` still saying 0.3.1.
 Its scanner and AST SHA-256 hashes differed from the published 0.3.1 Cargo archive.
 After fetching `v0.3.1` (`e658f8a`),
 `src/scanner.rs` and `src/ast.rs` hashes match the published archive (`e44b66674c937f76909afb404b20c739ec16438772137b9c61b32e53c4c740be` and `d225e656d8b040a4eeac93661b86659980e7fc82cd18a37fbf2b94a5cf6ed62a`).
 All current source citations in this section target the tag.
 The newer checkout added a leading-zero check to the scanner;
 do not attribute that check to published 0.3.1.
 The published parser depth and whitespace observations were re-read at the release tag and still hold.

- Discovery:
   crates.io `jsonc comments` page 1,
   [registry](https://crates.io/crates/fjson/0.3.1),
   private clone `~/temp/agent/fjson-2026-09-24` at release tag `v0.3.1` (`e658f8a`),
   `Cargo.toml:3` confirms 0.3.1 and `:13-15` names `arrayvec` and `unicode-width` as runtime dependencies.
- Screening:
   `src/scanner.rs:143-173,175-213,214-264` returns raw JSON numbers,
   quoted strings (without outer quotes) and C-style comments.
   Its `src/ast.rs:12-60` holds same-line value comments but keeps most comments as separate `Metadata` objects,
   not distinct key/value comment fields.
   An attachment and merge layer,
   UTF-16 decoder and canonical writer are still needed.
   `src/ast.rs:64,83` caps parser recursion at 128 levels,
   while the TypeScript structured parser allows 512 (`package/module/jsonc-edit/src/parse.ts:21,54`).
   Its scanner also skips Unicode whitespace outside strings (`src/scanner.rs:326-330`),
   whereas strict JSONC uses JSON whitespace.
   These are source observations,
   not a completed upstream-behavior diagnosis or a validated workaround.

  ```rust
  // src/scanner.rs:326-330
  fn skip_whitespace(&mut self) {
      while let Some(c) = self.peek_char() {
          if c.1.is_whitespace() && c.1 != '\n' {
              self.skip_char();
  ```

- Source quality lead:
   `src/lib.rs:151` forbids unsafe code.
   `.github/workflows/test.yml` runs Cargo fmt,
   build,
   clippy and test,
   with no build script in this crate's manifest;
   transitive command trees are not yet audited.
   This is a serious lexer/AST candidate,
   not a finalist.

### Other registry leads

- `jsonc` 0.1.0 has no repository URL in registry metadata;
   the published source in the local Cargo cache (`jsonc_document.rs:2-4,62-73,107-119`) wraps `jsonc-parser` and projects through `serde_json::Value`.
   It inherits the upstream scanner's surrogate constraint and cannot provide the full contract as-is.
- `jsonc_tools` 0.0.1 published source (`src/lib.rs:1-18`,
   `src/parser/parser.rs:1-13`) is a scaffold with no JSONC parser implementation.
   Category mismatch.
- `jsontape`,
   `hifijson`,
   `tokora`,
   and `purrdf-json` remain discovery leads requiring category screening;
   `momoa` has a separate source-proven safety hard-gate failure recorded next.

### `momoa` 3.2.6 safety exit

The published Rust parser is excluded as-is on a safety hard gate,
 not on regex.
 In `rust/src/readers.rs:79-113`,
 four hex digits after `\u` are accepted without excluding surrogates;
 `rust/src/tokens.rs:119-140` produces a string token;
 and `rust/src/parse.rs:326-351` feeds the decoded `0xD800` to `unsafe { char::from_u32_unchecked(char_code) }`.
 The source in private clone `~/temp/agent/momoa-2026-09-24` at `8dfb563` matched the published 3.2.6 `parse.rs` and `readers.rs` SHA-256 hashes.
 [Rust documentation](https://doc.rust-lang.org/std/primitive.char.html#method.from_u32_unchecked) says a surrogate is not a valid `char`,
 and constructing it is undefined behavior.
 Full source trace,
 safe checked pre-fix control,
 bounded patched prototype,
 targeted public-entry checks,
 upstream Rust suite output,
 and reproducible patch are in [`momoa-rust-unpaired-surrogate.md`](../troubleshooting/momoa-rust-unpaired-surrogate.md).
 The original unsafe parser was never run on this input.
 The patched prototype rejects isolated surrogates,
 while this port explicitly requires retaining them as UTF-16 values;
 it is a safety workaround,
 not a semantic foundation for the port.

## Regex screening, 2026-09-24

The user requested early regex culling.
 Our operational screening interprets this as production parsing or lexing and required normal/build dependencies,
 not upstream dev-only usage.
 The original TypeScript scanner in `package/module/jsonc-edit/src/scan.ts` uses direct character scans.
 `edikt-jsonc` 0.4.0 is now **excluded**:
 `crates/edikt-jsonc/src/lexer.rs:47-69` uses repeated `#[regex(...)]` patterns through `logos::Logos` (`:23`),
 not merely a dev-only regex dependency.
 See [versioned lexer source](https://docs.rs/crate/edikt-jsonc/0.4.0/source/src/lexer.rs).
 Stop its audit at this hard gate.
 The `tokora` 0.11.0 [JSON CST example](https://docs.rs/crate/tokora/0.11.0/source/examples/json_cst.rs) likewise uses `logos` with `#[regex(...)]` for whitespace,
 number and string tokens;
 exclude that example as a proposed foundation,
 not the combinator crate in every possible configuration.

`json-five` 0.3.1 lists `regex = "1"` only under `[dev-dependencies]` in `Cargo.toml:30-32`;
 its inspected production `src/` has no `regex::`,
 `Regex::`,
 `#[regex]`,
 or `logos` use.
 Do not cull on test-only dependencies.
 Direct source/manifests for `fjson`,
 `jsonc-parser`,
 `biome_json_parser`,
 `jwc`,
 and `hifijson` yielded no matching regex calls or macros under the same targeted search,
 and the resolved dependency graph was then checked for their selected configurations.
 Their broader behavior and source audits remain pending;
 this is not a claim of universal regex absence.

### Resolved production dependency graphs

A disposable set of exact-version manifests under `~/temp/agent/jsonc-regex-audit/` ran `mise run audit:regex-deps`,
 which invokes Cargo `tree --edges normal,build --target all --format {p}` without compiling upstream code.
 The individual graphs are saved as `tree.txt` in each case directory.
 `fjson` 0.3.1,
 `json-five` 0.3.1 with and without default features,
 `biome_json_parser` 0.5.7 with the exact companion pins,
 `hifijson` 0.5.0,
 `jsonc-parser` 0.33.2 with `cst`,
 and `jwc` 0.1.0 showed no package named `regex`,
 `logos`,
 `pest`,
 `regex-automata`,
 `regex-syntax`,
 `onig`,
 or `fancy-regex` in normal/build dependency graphs.
 Positive control `edikt-jsonc` 0.4.0 showed `logos`,
 `logos-codegen`,
 `regex`,
 `regex-automata`,
 and `regex-syntax`;
 the probe can reveal the unwanted dependencies.
 This verifies package names under the selected versions/features,
 not every line of transitive source or a future resolution.
 Keep source-level regex clearance pending where required.

### Biome bounded execution preparation

The published `biome_json_parser` 0.5.7 archive SHA-256
 `9c6d23fb9b683e6356c094b4a0cb38f8aa0acee60ce9c3ef24628d21a204de4d` matches its generated scratch Cargo.lock entry.
 `~/temp/agent/biome-execution-manifest.md` records the intended offline container command,
 source and checksum,
 build-script and proc-macro inventory,
 expected compiler and `emcc` probes,
 allowed read/write paths,
 resource ceilings,
 and stop conditions **before candidate execution**.
 The resolved graph inventory under `~/temp/agent/biome-execution-inventory.mjs` found 82 unique dependency names,
 16 build scripts and 9 procedural-macro packages across all target configurations;
 these are audit-surface measurements,
 not timing or proof of candidate behavior.
 The scratch test will probe surrogate and raw token acceptance,
 JSON5 rejection,
 and 512-level parse/syntax/drop only;
 the bounded first run completed 512-level array parsing,
 syntax-text access and destruction,
 and rejected JSON5-only forms.
 Its token-only comment assertion failed because comments are trivia attached to syntax tokens,
 not independent grammar tokens;
 the source-backed diagnosis and verified consumer correction are in
 [`biome-json-parser-token-trivia.md`](../troubleshooting/biome-json-parser-token-trivia.md).
 After reading trivia pieces,
 the same offline container passed all focused tests,
 including the escaped `\uD800` string and preserved `1e0` token.
 This validates a raw-syntax candidate,
 not key/value attachment,
 exact-value projection,
 canonical emission,
 immutable edits,
 or a consuming published crate.

## Existing-parser contract exits

These are outcomes for published implementations **as-is**,
 not proof that every possible fork,
 token adapter,
 or new parser implementation is impossible.

- `jsonc-parser` 0.33.2:
   `src/scanner.rs:175-201` calls `parse_string_with_char_provider` for escapes and `src/string.rs:214-261` rejects an unpaired high or low surrogate.
   This is a hard failure for the required accepted string domain.
   It also does not supply the normalized,
   attached-comment model as-is.
- `jwc` 0.1.0:
   the published `src/single_pass_parser.rs:201-222` explicitly errors on a low surrogate or a high surrogate not followed by a low one.
   It fails the string-domain hard gate as-is,
   regardless of its regex-free production dependency graph.
- `fjson` 0.3.1:
   `src/ast.rs:64,83` limits container nesting to 128.
   The TypeScript structured parser permits depth through 512 (`package/module/jsonc-edit/src/parse.ts:21,55`),
   and its comment-free fast path delegates to `JSON.parse`;
   the published `fjson` parser cannot preserve the supported depth domain as-is.
   `src/scanner.rs:326-330` also skips non-JSON Unicode whitespace.
   A scanner-only use paired with our own grammar/parser is a distinct composition,
   not an as-is editor.
- `json-five` 0.3.1:
   [prior corpus probes](../planning/monorepo-manager-route-research/rust-structured-edits.md) show JSON5-only syntax and scalar roots accepted,
   where the TypeScript JSONC conformance tests reject them;
   it is not a strict JSONC parser as-is.
   Its round-trip printer's block-comment closing-slash defect is recorded in `doc/troubleshooting/json-five-unterminated-block-comment.md`.
   An independently strict validator and canonical emitter would be repository code.
- `hifijson` 0.5.0:
   [official crate documentation](https://docs.rs/hifijson/0.5.0/hifijson/) describes JSON token and value lexers,
   not JSONC comment tokens or separately attached key/value comments.
   It is not a ready-to-use implementation of this editor;
   coupling its scalar lexer to an owned comment scanner is a distinct composition.

The documented hard exits make the owned-parser translation eligible for serious evaluation under the existing-tools-first rule;
 they do not establish it as a validated winner.
 `biome_json_parser` 0.5.7,
 `fjson` scanner-only,
 `json-five` raw-token adapter,
 and a repository-owned parser remain different unvalidated compositions.
 Regex-free dependency screening does not imply semantic parity.

## Repository-owned parser and emitter prototype

A disposable Rust crate was written under `~/temp/agent/jsonc-parser-probe-2026-09-24/`,
 with a separate consumer under `~/temp/agent/jsonc-parser-consumer-2026-09-24/`.
 This code is outside the product repository and is **not** an adopted implementation.
 Its `src/scan.rs` uses direct byte/index scans,
 decodes escaped `\uXXXX` into owned UTF-16 units (including lone surrogates),
 and delegates JSON number identity to the local dependency-free scratch prototype.
 `src/parse.rs` attaches comments separately to object keys and values and rejects scalar roots/JSON5.
 `src/emit.rs` emits a canonical two-space tree with trailing commas and retains raw scalar spellings,
 including clean `1e0` input.
 No regex,
 generated lexer,
 external crate,
 or unsafe code was introduced by this prototype.

- `cd -- ~/temp/agent/jsonc-parser-probe-2026-09-24 && mise run test` passed the initial bounded parser suite over valid/invalid syntax,
   key and value comments,
   line-comment merging,
   unpaired/paired UTF-16 values,
   raw exact number text,
   and reparsable canonical output.
   `mise run lint:clippy` also passed with warnings denied after structural lint fixes.
- `cd -- ~/temp/agent/jsonc-parser-consumer-2026-09-24 && mise run test` imported the library by path and printed `JSONC consumer parse and emit passed`,
   checking attached key/value comments,
   unchanged `1e0`,
   decoded lone surrogate,
   and reparsed output.
- Positive controls in scratch:
   removing the root-container check made `invalid_documents_fail` fail on input `42`;
   suppressing key comment attachment made `comments_are_addressable` fail.
   Each source edit was restored,
   matching a saved pre-mutation SHA-256,
   and unit/Clippy tasks passed again.
   These controls cover only those guards,
   not all parser branches.
- A new nested-array test invalidated the initial pass:
   `mise run test:isolated` ran the added suite in an offline,
   read-only Podman container capped at 2 GiB memory,
   2 CPUs,
   128 PIDs and 600 seconds.
   The 513-level case aborted the test process with `thread 'tests::excessive_nesting_is_rejected' has overflowed its stack` (SIGABRT,
   exit 101) before returning the intended depth error.
   The other test names printed `ok`,
   but the suite failed and the owned parser candidate is **not validated**.
   Structural recursion needs an explicit work stack or another measured stack-safe shape before this depth contract can be claimed.
   Never reproduce this case outside a bounded container.

This is a partial parser/emitter probe with a demonstrated stack-safety failure,
 not full parity.
 No immutable edit/navigation/comment-set operations,
 full TypeScript conformance corpus,
 fuzzing,
 mutation campaign,
 cross-platform native check,
 release packaging,
 or performance comparison is provided.
 The comment attachment rule for blank-line-separated comments still needs the agreed correction and tests in both maintained implementations.
 Do not use this prototype as publication evidence.

### Accepted-depth positive control also failed

A separate filtered probe `mise run test:depth-512` generated a valid array document with 512 nested containers and a scalar leaf.
 It ran solely inside the same 2 GiB/2 CPU,
 network-free container with a 600-second ceiling.
 The test process aborted with `thread 'tests::depth_512_is_accepted' has overflowed its stack` (SIGABRT,
 exit 101),
 before it could assert a successful parse.
 Thus a pre-scan that merely rejects nesting beyond 512 would not remediate the supported-depth case.
 The parser's recursive container-to-child calls must be replaced by an explicit work stack;
 once parsing succeeds,
 dropping and emitting a deeply nested tree must be measured separately because they can also recurse.
 Do not run these inputs on the host until the stack-safe design has passed the isolated positive control.

### Localized parse-stage stack overflow

The accepted-depth test was instrumented with unbuffered markers before parse,
 after parse,
 and before/after drop.
 `mise run test:depth-512` was rerun inside the 2 GiB/2 CPU bounded container with Cargo test output uncaptured.
 It printed `depth control: before parse` and then aborted with `thread 'tests::depth_512_is_accepted' has overflowed its stack` (SIGABRT,
 exit 101).
 Neither the after-parse nor drop markers appeared.
 This localizes the observed failure to parser execution,
 not successful tree destruction.
 Emission and destruction remain unverified separate boundaries.
 Replace recursive parsing with explicit container frames before any candidate recommendation.

### Separate TypeScript JSONC comma discrepancy

A direct call through the current TypeScript neutral bundle (`package/module/jsonc-edit/dist/final/neutral/index.mjs`) measured the `JSON.parse` fast path and structured parser separately.
 Clean `[1\n,2]` parsed as a positive control.
 `[1\n,2,]` forced the structured path and threw `JsoncParseError: expected , or ] in array (at offset 3)`;
 `[1 /* c */\n,2]` also threw at offset 11.
 `{"a":1\n,"b":2,}` threw `JsoncParseError: expected , or } in object (at offset 7)`.
 The visible boundary differs by whether a comment or trailing comma requires the structured path.
 `package/module/jsonc-edit/src/parse-trivia.ts` ends same-line trailing capture at LF,
 and `src/parse.ts` demands a close when it saw no comma.
 This is independent of the Rust prototype's stack overflow.
 The accepted shared-behavior fixtures need an explicit comma-after-trivia case;
 TypeScript and Rust require a fix once the foundation is adopted.
 Do not treat a clean-only fast-path probe as evidence for the structured path.

### Iterative parser after-state, lifecycle checks still open

The scratch Rust `parse.rs` was rewritten to use an explicit `Vec<Frame>` with separate item-or-close,
 awaiting-child,
 and separator-or-close phases.
 The parser now rejects an opener when 512 containers are already open,
 rather than recursing between `parse_value` and container functions.
 `mise run lint:clippy` passed with warnings denied.
 `mise run test:isolated` then ran the full scratch unit suite in the same offline,
 read-only Podman image under 2 GiB memory,
 2 CPUs,
 128 PIDs and a 600-second cap.
 It exited 0:
 the valid 512-level array case,
 the rejected 513-level array case,
 and the other parser tests passed.
 The 512-level test explicitly drops the returned node,
 so this measured case no longer aborts during parse or basic drop.
 This is after-state evidence,
 not a prediction from the rewrite.

The result does **not** yet prove stack-safe emission,
 reparse,
 clone/equality,
 nested records,
 error cleanup after a deep completed subtree,
 or all comment ownership after canonical output.
 The parser remains a disposable incomplete candidate,
 not a selected foundation or product crate.
 The earlier isolated stack-overflow logs are retained as before-state evidence,
 not erased by the new pass.

### Separate multi-line value-comment ownership failure

The isolated scratch test `multiline_value_comment_stays_on_value` failed under the same bounded container while the other parser tests passed.
 Source `{"k":/*value\ncomment*/1}` parsed with its block comment on the value;
 the scratch emitter wrote `/*value\ncomment*/` before the key,
 and reparse attached it to the key.
 The assertion at scratch `src/tests.rs:124` reported `value comment migrated to key` (exit 101).
 This is not the earlier stack overflow:
 both 512-level and 513-level depth tests completed under the explicit-frame parser in this run.

A separate direct probe of the built TypeScript library in `package/module/jsonc-edit/dist/final/neutral/index.mjs` reproduced the same user-visible change.
 Before emission,
 `jsoncGetKeyComment({ path: ['k'] })` returned `COMMENT_ABSENT` and `jsoncGetComment` returned `{ type: 'block', text: 'value\ncomment' }`;
 `jsoncStringify` placed that block before `"k"`;
 after reparse the key carried that comment and the value returned `COMMENT_ABSENT`.
 The source `package/module/jsonc-edit/src/stringify.ts` emits `valLead` before the key.
 This is a confirmed ownership bug in both implementations,
 not a whitespace-only difference.
 The accepted shared-behavior contract requires the same regression fixture and a fix in both maintained packages after foundation adoption.
 The Rust prototype needs to emit multi-line value comments after the key's colon so the parser attaches them to the value;
 that remedy has not yet been applied or measured.

### After-state: Rust scratch value-comment owner retained

The scratch emitter was changed to write a multi-line value comment **after the object key's colon**,
 so the parser's between-colon-and-value trivia channel owns it.
 In the same 2 GiB/2 CPU offline container,
 `mise run test:isolated` exited 0 with the `multiline_value_comment_stays_on_value` regression passing alongside the rest of the bounded parser suite.
 `mise run lint:clippy` passed with warnings denied before the isolated run.
 This measures the Rust scratch fix at parse/emit/reparse,
 not merely a predicted effect from source.
 The maintained TypeScript bundle still demonstrates the original migration and needs the corresponding fix and shared fixture after foundation adoption.
 The scratch parser remains incomplete until deep emission,
 lifecycle and other required branches pass.

### Accepted-depth lifecycle after-state

The scratch parser's explicit frame stack passed the full `mise run test:isolated` suite in a pinned offline Rust container with 2 GiB memory,
 2 CPUs,
 128 PIDs,
 and a 600-second ceiling.
 The run reported 17 passing unit tests and no failures.
 Explicit stage markers in separate tests confirmed a 512-container array and record parsed,
 emitted,
 reparsed,
 and dropped;
 a 512-array clone and equality check returned and both values dropped;
 malformed input after a deep completed child and after a deep root returned errors without an abort.
 A 513th opener was rejected with `JSONC nesting too deep` for scalar- and empty-container cases,
 while many shallow sibling containers remained accepted.
 These checks used the debug build;
 release and non-Linux targets remain unmeasured.

The same bounded suite covered valid comma-after-newline JSONC,
 key/value comment queries,
 empty-container comment order,
 exact raw numbers,
 and UTF-16 lone surrogate strings.
 A previous failing `multiline_value_comment_stays_on_value` test became passing only after the scratch emitter moved the multi-line value comment after its key's colon.
 The TypeScript production package remains unfixed on the independently measured comma and comment-owner incidents.
 This is still a feasibility prototype,
 not an immutable edit API,
 full conformance campaign,
 or publication-ready crate.

### Bounded optimized-build after-state

The disposable parser and exact-number crates were rebuilt in the same pinned,
 offline 2 GiB/2 CPU container using `mise run test:isolated:release` (`cargo test --release --locked --offline`).
 The optimized suite reported 17 passing unit tests and no failures,
 including 512-level array/record parse,
 canonical emission,
 reparse,
 clone/equality,
 success and error cleanup,
 and 513th-opener rejection.
 Stage markers printed after each deep operation.
 This complements the earlier debug run;
 it is not a timing comparison,
 a macOS/Windows result,
 or a consumer test of a published crate.
 After the iterative rewrite and value-comment correction,
 `mise run test` in the separate scratch consumer `~/temp/agent/jsonc-parser-consumer-2026-09-24/` rebuilt the library,
 called parse and emit,
 and printed `JSONC consumer parse and emit passed`.
 This is a local path dependency,
 not published-crate validation.

A later bounded debug run and optimized release run each reported 18 passing unit tests after adding
 the maintained TypeScript corpus's inline-comment-after-comma syntax,
 direct value-comment ownership checks,
 more escaped JSON string forms,
 and malformed-string cases.
 These are selected syntax and attachment checks,
 not a full semantic comparison of the TypeScript conformance or property corpus.
 A subsequent bounded debug run also passed adversarial edited comment bodies on both key and value owners,
 including block terminators,
 quotes,
 escapes,
 control characters,
 blank lines,
 carriage returns and non-ASCII text.
 It checked reparsability,
 retained text on the same owner,
 and a second-to-third emission fixpoint;
 it does not replace the generated TypeScript property corpus.

Remaining validation includes full TypeScript conformance and property cases,
 wider comment-placement and syntax-boundary coverage,
 mandatory package style lint,
 native target matrix,
 full immutable edit/navigation interface,
 and performance on stable-band measurements.
 The chosen foundation is still an unadopted scratch prototype.

## Evidence and validation still required

- Finish the scheduled registry,
   repository-host and broader-web discovery with pagination saturation and an expansion round.
   Log every query,
   filters,
   result counts and newly discovered survivor.
- Clone every serious alternative under private `~/temp/agent/`,
   pin release revision,
   inspect licenses,
   manifests,
   source,
   tests/CI and maintenance.
   The delegated research read remote sources and did not execute code;
   its findings are not final validation.
- Audit relevant parser and serializer paths for original scalar tokens,
   comments,
   escaped unpaired surrogates,
   strict JSONC,
   resource bounds and errors.
   Compare a repository-owned parser with any third-party raw-token adapter at equal depth.
- Inspect every third-party execution tree and isolate any build/test/probe before running it.
   Exercise the TypeScript conformance corpus,
   comment queries,
   malformed cases,
   exact numbers and surrogates from a disposable Rust consumer.
- Rate validated finalists with the frozen rubric,
   run sensitivity and publish a full ranking with pros,
   cons and adjacent reasons.
   Present the result for separate adoption.
   No product dependency,
   decision record,
   or release change before adoption.
