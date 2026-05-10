// What:     Integration tests for the extract -> AC -> match
//           pipeline. Exercises the actual soundness invariant the
//           UTF-8 walker bug broke: a regex rule's leading literal,
//           after extraction, must round-trip through Aho-Corasick
//           byte-matching against file content containing the same
//           bytes.
// Why:      A unit test on `walk_literal_bytes` alone can pass while
//           the end-to-end pipeline still has a different soundness
//           gap. This file plugs that hole.
// TS map:   `import { extractGatingSubstrings } from "./extract";
//           import AhoCorasick from "ahocorasick"; describe(...)`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { extractGatingSubstrings } from "./extract";
// import AhoCorasick from "ahocorasick";
// describe("extract -> AC", () => { ... });
// ```

// What:     `use super::extract::extract_gating_substrings;` -- the
//           function under test, exposed `pub` from `extract.rs`.
// Why:      Avoid full-path noise.
// TS map:   `import { extractGatingSubstrings } from "./extract";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { extractGatingSubstrings } from "./extract";
// ```
use super::extract::extract_gating_substrings;
// What:     `use aho_corasick::AhoCorasick;` -- the multi-pattern
//           literal-matcher type from the `aho-corasick` crate
//           (already a project dependency).
// Why:      Build an AC from the extracted substrings and search
//           content; this is exactly what `rules.rs` does in the
//           real loader.
// TS map:   `import AhoCorasick from "ahocorasick";`.
//
// In TS you'd write (pseudocode):
// ```ts
// import AhoCorasick from "ahocorasick";
// ```
use aho_corasick::AhoCorasick;

// What:     `#[test] fn em_dash_prefix_extracts_correctly()`. Marks
//           a unit test discoverable by `cargo test`.
// Why:      Headline regression check: pre-fix, `extract_gating_substrings("—password")`
//           returned `Some(vec)` containing a 6-byte mojibake
//           string. Post-fix it must contain the original 3 bytes
//           of the em-dash followed by `password`.
// TS map:   `test("em-dash prefix extracts correctly", () => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("em-dash prefix extracts correctly", () => { ... });
// ```
#[test]
fn em_dash_prefix_extracts_correctly() {
    // What:     `let result = extract_gating_substrings("—password");`
    //           returns `Option<Vec<(String, bool)>>`. `Option`
    //           wraps "maybe a value" -- `Some(vec)` if extraction
    //           succeeded, `None` if the regex couldn't be soundly
    //           gated.
    // Why:      We expect `Some` here -- the pattern is a plain
    //           literal, no alternation or short-prefix issues.
    // TS map:   `const result = extractGatingSubstrings("—password");`
    //           returning `Array<{ sub: string; ci: boolean }> | null`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const result = extractGatingSubstrings("—password");
    // ```
    let result = extract_gating_substrings("—password");
    // What:     `let subs = result.expect("...");` extracts the inner
    //           `Vec` from `Some(vec)`; panics with the message if
    //           `result` is `None`. `.expect()` is the documented
    //           variant of `.unwrap()` that lets the reader see the
    //           rationale.
    // Why:      Convert the `Option` into a hard assertion so the
    //           remaining checks don't have to nest inside an
    //           `if let Some(...)`.
    // TS map:   `const subs = result!;` (non-null assertion) plus
    //           `if (subs === null) throw new Error(...)`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // if (result === null) throw new Error("expected Some for plain literal");
    // const subs = result;
    // ```
    let subs = result.expect("expected Some for plain literal");
    // What:     `assert_eq!(subs.len(), 1, "...")`. `subs.len()`
    //           returns the number of `(String, bool)` tuples in
    //           the vec. We expect exactly one (no top-level
    //           alternation in this pattern).
    // Why:      Establishes the shape before indexing into `subs[0]`.
    // TS map:   `expect(subs.length).toBe(1);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(subs.length).toBe(1);
    // ```
    assert_eq!(subs.len(), 1, "expected exactly one substring");
    // What:     `let (substring, ci) = &subs[0];` is a destructuring
    //           pattern bind: `subs[0]` is a `(String, bool)` tuple,
    //           and `&` takes a shared reference so we don't move
    //           it out of the `Vec`. `substring` is `&String`, `ci`
    //           is `&bool`.
    // Why:      Pull both fields out by name for the asserts below.
    // TS map:   `const { sub: substring, ci } = subs[0];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const [substring, ci] = subs[0];
    // ```
    let (substring, ci) = &subs[0];
    // What:     `assert_eq!(substring.as_bytes(), b"\xe2\x80\x94password", "...")`.
    //           `.as_bytes()` returns a `&[u8]` view of the string's
    //           underlying bytes; `b"..."` is a byte-string literal.
    // Why:      Byte-level assertion is the whole point: this check
    //           would fail loudly if the walker mojibake'd the
    //           em-dash into 6 wrong bytes.
    // TS map:   `expect([...new TextEncoder().encode(substring)]).toEqual([...]);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect([...new TextEncoder().encode(substring)]).toEqual(
    //   [0xe2, 0x80, 0x94, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64],
    // );
    // ```
    assert_eq!(
        substring.as_bytes(),
        b"\xe2\x80\x94password",
        "extracted substring should be the original UTF-8 bytes"
    );
    // What:     `assert!(!*ci, "...");` derefs `ci` (which was a
    //           `&bool`) and negates it; macro panics if false.
    // Why:      Pattern had no `(?i)` prefix, so the ci flag must
    //           be false.
    // TS map:   `expect(ci).toBe(false);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(ci).toBe(false);
    // ```
    assert!(!*ci, "ci flag should be false (no (?i) prefix)");
}

#[test]
fn em_dash_prefix_round_trips_through_aho_corasick() {
    // What:     Same `extract_gating_substrings` call as before;
    //           same `.expect()` unwrap.
    // Why:      Reproduce the same fixture state for the AC test.
    // TS map:   same as above.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("—password")!;
    // ```
    let subs = extract_gating_substrings("—password")
        .expect("expected Some for plain literal");
    // What:     `let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();`
    //           is an iterator pipeline:
    //           - `subs.iter()` -- borrows each tuple, yielding
    //             `&(String, bool)`.
    //           - `.map(|(s, _)| s.as_str())` -- closure that
    //             destructures the tuple ref, ignores the bool with
    //             `_`, and converts the `&String` to `&str` via
    //             `.as_str()`. The `|...| ...` syntax is Rust's
    //             closure syntax (TS arrow `(...) => ...`).
    //           - `.collect()` -- terminal operation that builds a
    //             `Vec<&str>`. The target type is annotated on the
    //             `let` binding so `collect` knows what to produce.
    // Why:      `AhoCorasick::new` wants something iterable of
    //           string-like items; we materialise into a `Vec<&str>`
    //           for clarity.
    // TS map:   `const patterns: string[] = subs.map(([s, _]) => s);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const patterns: string[] = subs.map(([s, _]) => s);
    // ```
    let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();
    // What:     `let ac = AhoCorasick::new(&patterns).expect("...");`.
    //           `AhoCorasick::new` returns `Result<AhoCorasick, BuildError>`.
    //           `.expect()` extracts the `AhoCorasick` if `Ok`, panics
    //           with the message if `Err`.
    // Why:      Build the same AC the production loader builds, so we
    //           test the actual matching behaviour the gate uses.
    // TS map:   `const ac = new AhoCorasick(patterns);` (TS lib usually
    //           throws synchronously on bad input).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const ac = new AhoCorasick(patterns);
    // ```
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    // What:     `let content = "prefix —password suffix";` -- the
    //           file-content fixture. The em-dash here is the
    //           original 3 UTF-8 bytes `\xe2\x80\x94`, since Rust
    //           string literals preserve source bytes.
    // Why:      Simulate a file containing the forbidden phrase.
    // TS map:   `const content = "prefix —password suffix";`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const content = "prefix —password suffix";
    // ```
    let content = "prefix —password suffix";
    // What:     `let matches: Vec<_> = ac.find_iter(content).collect();`.
    //           - `ac.find_iter(content)` -- iterator yielding one
    //             `Match` per non-overlapping hit.
    //           - `.collect()` into a `Vec<_>` -- the `_` lets Rust
    //             infer the element type (`aho_corasick::Match`).
    // Why:      We want to know that AT LEAST ONE match was
    //           reported, AND its byte offset is what we expect.
    // TS map:   `const matches = [...ac.search(content)];`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const matches = [...ac.search(content)];
    // ```
    let matches: Vec<_> = ac.find_iter(content).collect();
    // What:     `assert!(!matches.is_empty(), "...");` -- macro
    //           that panics if its first argument evaluates to
    //           false. `matches.is_empty()` is `true` iff the vec
    //           has zero elements.
    // Why:      THIS is the core soundness invariant the bug
    //           broke: pre-fix, AC had a 6-byte mojibake pattern
    //           and never matched the file's 3-byte em-dash, so
    //           `matches` was empty and the rule was silently
    //           disabled.
    // TS map:   `expect(matches.length).toBeGreaterThan(0);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(matches.length).toBeGreaterThan(0);
    // ```
    assert!(
        !matches.is_empty(),
        "AC should find at least one match -- this is the soundness invariant the UTF-8 bug broke"
    );
    // What:     `let m = &matches[0];` takes a shared reference to
    //           the first match. `m.start()` returns the byte
    //           offset (a `usize`) where the match begins.
    // Why:      Verify the match landed at the expected position
    //           (byte 7: after `"prefix "` = 7 ASCII bytes).
    // TS map:   `expect(matches[0].start).toBe(7);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(matches[0].start).toBe(7);
    // ```
    let m = &matches[0];
    assert_eq!(
        m.start(),
        7,
        "match should start right after 'prefix ' (7 ASCII bytes)"
    );
}

#[test]
fn case_insensitive_em_dash_prefix_extracts_correctly() {
    // What:     `(?i)—Password` -- inline-flag group `(?i)` makes
    //           the pattern case-insensitive, then `—Password` is
    //           the literal prefix. `extract_gating_substrings`
    //           strips the `(?i)`, walks the remainder, and tags
    //           the resulting substring with `ci = true`.
    // Why:      Cover the case-insensitive code path: the (?i)
    //           strip happens BEFORE the walker runs, so a buggy
    //           walker would still produce mojibake here.
    // TS map:   `extractGatingSubstrings("(?i)—Password")`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?i)—Password")!;
    // ```
    let subs = extract_gating_substrings("(?i)—Password")
        .expect("expected Some for case-insensitive literal");
    assert_eq!(subs.len(), 1);
    let (substring, ci) = &subs[0];
    assert_eq!(
        substring.as_bytes(),
        b"\xe2\x80\x94Password",
        "extracted substring should preserve original UTF-8 bytes including the capital P"
    );
    // What:     `assert!(*ci, "...");` -- derefs `ci` and asserts
    //           it's true.
    // Why:      `(?i)` was present, so the per-substring ci flag
    //           must be true. The loader uses this to route the
    //           substring into the case-insensitive AC bucket.
    //
    //           NOTE on out-of-scope limitation: aho-corasick's
    //           `ascii_case_insensitive` setting only folds ASCII
    //           letters. For em-dash this doesn't matter (em-dash
    //           has no case), but for a rule like `(?i)Café`,
    //           registering `Café` ci would NOT match `CAFÉ` in
    //           file content because `é` vs `É` is not in the
    //           ASCII fold table. That's a separate design issue,
    //           tracked as a followup; not introduced or fixed by
    //           the UTF-8 walker fix.
    // TS map:   `expect(ci).toBe(true);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(ci).toBe(true);
    // ```
    assert!(*ci, "ci flag should be true after stripping (?i)");
}

#[test]
fn emoji_prefix_round_trips_through_aho_corasick() {
    // What:     Same shape as `em_dash_prefix_round_trips_through_aho_corasick`
    //           but with a 4-byte UTF-8 leading character `🔑`
    //           (`\xf0\x9f\x94\x91`). Exercises the maximum-width
    //           UTF-8 case end-to-end.
    // Why:      The em-dash test covers 3-byte UTF-8; this covers
    //           4-byte. Pre-fix, a `🔑secret` rule would have
    //           registered 8 mojibake bytes and never matched the
    //           file's original 4 bytes. The advisor flagged this
    //           gap during review.
    // TS map:   end-to-end pipeline assertion in TS would be the
    //           same shape with `🔑` instead of `—`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("🔑secret")!;
    // const ac = new AhoCorasick(subs.map(([s, _]) => s));
    // const matches = [...ac.search("prefix 🔑secret suffix")];
    // expect(matches.length).toBeGreaterThan(0);
    // ```
    let subs = extract_gating_substrings("🔑secret")
        .expect("expected Some for plain literal");
    assert_eq!(subs.len(), 1);
    let (substring, _ci) = &subs[0];
    assert_eq!(
        substring.as_bytes(),
        b"\xf0\x9f\x94\x91secret",
        "extracted substring should preserve the original 4-byte emoji bytes"
    );
    let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    let content = "prefix 🔑secret suffix";
    let matches: Vec<_> = ac.find_iter(content).collect();
    assert!(
        !matches.is_empty(),
        "AC should find at least one match for the 4-byte emoji prefix"
    );
    assert_eq!(
        matches[0].start(),
        7,
        "match should start right after 'prefix ' (7 ASCII bytes)"
    );
}

#[test]
fn two_byte_utf8_prefix_round_trips_through_aho_corasick() {
    // What:     2-byte UTF-8 leading char `é` (`\xc3\xa9`)
    //           followed by `tudiant` to make a 9-byte literal
    //           prefix. Same end-to-end shape as the em-dash and
    //           emoji round-trip tests.
    // Why:      Cover the 2-byte UTF-8 path. `é` is the easiest
    //           way for a Latin-script writer to introduce a
    //           non-ASCII rule; broken extraction here would be a
    //           common foot-gun.
    // TS map:   same shape as above with `étudiant`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("étudiant")!;
    // // ... AC build + match ...
    // ```
    let subs = extract_gating_substrings("étudiant")
        .expect("expected Some for plain literal");
    assert_eq!(subs.len(), 1);
    let (substring, _ci) = &subs[0];
    assert_eq!(
        substring.as_bytes(),
        b"\xc3\xa9tudiant",
        "extracted substring should preserve the original 2-byte e-acute bytes"
    );
    let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    let content = "prefix étudiant suffix";
    let matches: Vec<_> = ac.find_iter(content).collect();
    assert!(
        !matches.is_empty(),
        "AC should find at least one match for the 2-byte e-acute prefix"
    );
    assert_eq!(
        matches[0].start(),
        7,
        "match should start right after 'prefix ' (7 ASCII bytes)"
    );
}

#[test]
fn anchor_prefix_extracts_after_strip() {
    // What:     `^—password` starts with the `^` line-anchor.
    //           `extract_gating_substrings` should strip `^` and
    //           extract `—password` from the remainder.
    // Why:      Cover the anchor-strip code path with a non-ASCII
    //           literal. Confirms the strip-then-walk pipeline
    //           preserves UTF-8 bytes through both stages.
    // TS map:   `const subs = extractGatingSubstrings("^—password")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("^—password")!;
    // expect(subs[0].sub).toBe("—password");
    // ```
    let subs = extract_gating_substrings("^—password")
        .expect("expected Some after anchor strip");
    assert_eq!(subs.len(), 1);
    let (substring, _ci) = &subs[0];
    assert_eq!(
        substring.as_bytes(),
        b"\xe2\x80\x94password",
        "extracted substring should preserve em-dash bytes after `^` strip"
    );
}

#[test]
fn short_non_ascii_prefix_rejected_by_min_prefix_len() {
    // What:     A pattern whose extracted prefix is the single
    //           em-dash `—` (3 UTF-8 bytes) followed by a
    //           metacharacter `*`. Walker extracts `—` only; the
    //           soundness filter `subs.iter().any(|(p, _)| p.len()
    //           < MIN_PREFIX_LEN)` checks BYTE length, and `—` is
    //           exactly 3 bytes (== MIN_PREFIX_LEN), so it passes.
    // Why:      Documents the byte-length semantic: `MIN_PREFIX_LEN`
    //           is bytes, not chars. A single 3-byte UTF-8 char
    //           passes; a single 2-byte UTF-8 char does NOT.
    //           Future maintainers might assume "chars"; this test
    //           pins the actual behaviour. (The bug we just fixed
    //           was upstream of this filter; once UTF-8 is correct,
    //           `MIN_PREFIX_LEN` operates on real bytes as
    //           intended.)
    // TS map:   `const subs = extractGatingSubstrings("—.*")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("—.*"); // 3-byte prefix passes
    // expect(subs).not.toBeNull();
    // expect(subs![0].sub).toBe("—");
    // ```
    let subs = extract_gating_substrings("—.*")
        .expect("3-byte em-dash prefix should pass MIN_PREFIX_LEN");
    assert_eq!(subs.len(), 1);
    let (substring, _ci) = &subs[0];
    assert_eq!(substring.as_bytes(), b"\xe2\x80\x94");

    // What:     Confirm the negative case: a single 2-byte char
    //           prefix (`é`, 2 bytes) is rejected because 2 <
    //           MIN_PREFIX_LEN (3). `assert!(result.is_none())`
    //           checks the `Option` is `None`.
    // Why:      Pin the byte-length semantic from the other side.
    // TS map:   `expect(extractGatingSubstrings("é.*")).toBeNull();`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(extractGatingSubstrings("é.*")).toBeNull();
    // ```
    let result = extract_gating_substrings("é.*");
    assert!(
        result.is_none(),
        "2-byte e-acute prefix is below MIN_PREFIX_LEN (bytes), should be None"
    );
}

#[test]
fn alternation_with_non_ascii_extracts_both_branches() {
    // What:     Pattern `(?:—password|—token)` -- a non-capturing
    //           group containing two branches separated by `|`.
    //           Each branch starts with em-dash. The walker
    //           recurses into the group via `skip_atom_with_extract`,
    //           splits the body on top-level `|`, and extracts one
    //           prefix per branch. Result should be a 2-element
    //           Vec, both with em-dash leading bytes.
    // Why:      Cover the multi-substring-per-rule path with
    //           non-ASCII literals. AC fires the rule if EITHER
    //           branch matches. Pre-fix, both branches would have
    //           mojibake'd, so AC would never fire.
    // TS map:   `const subs = extractGatingSubstrings("(?:—password|—token)")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?:—password|—token)")!;
    // expect(subs.length).toBe(2);
    // ```
    let subs = extract_gating_substrings("(?:—password|—token)")
        .expect("expected Some for alternation of literals");
    assert_eq!(
        subs.len(),
        2,
        "expected one substring per alternation branch"
    );
    assert_eq!(
        subs[0].0.as_bytes(),
        b"\xe2\x80\x94password",
        "first branch should be em-dash + password"
    );
    assert_eq!(
        subs[1].0.as_bytes(),
        b"\xe2\x80\x94token",
        "second branch should be em-dash + token"
    );

    // What:     Build AC from both substrings, search content
    //           containing only the second branch's literal.
    //           AC should fire on the `—token` pattern.
    // Why:      End-to-end soundness: registering BOTH branches
    //           means a file with only one of them still gates
    //           correctly.
    // TS map:   `const ac = new AhoCorasick(subs.map(([s, _]) => s));`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const ac = new AhoCorasick(subs.map(([s, _]) => s));
    // expect([...ac.search("here is —token")].length).toBeGreaterThan(0);
    // ```
    let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    let matches: Vec<_> = ac.find_iter("here is —token").collect();
    assert!(
        !matches.is_empty(),
        "AC should fire on the second-branch literal"
    );
}

// What:     `#[test] fn positive_lookahead_at_start_extracts_after_body()`.
//           Pattern `(?=foo)bar` -- positive lookahead at the head of
//           the rule, followed by literal `bar`. Walker should skip
//           the lookahead and extract `bar`.
// Why:      Pre-fix the walker bailed at `(?=` (because
//           `group_body_start` returned `None` for that opener),
//           leaving no extracted literal and dropping the rule into
//           the residual bucket. Post-fix the lookaround is treated
//           as a transparent zero-width atom and the walker
//           continues.
// TS map:   `test("positive lookahead at start extracts after body", () => { ... });`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("positive lookahead at start extracts after body", () => {
//   const subs = extractGatingSubstrings("(?=foo)bar")!;
//   expect(subs.length).toBe(1);
//   expect(subs[0].sub).toBe("bar");
// });
// ```
#[test]
fn positive_lookahead_at_start_extracts_after_body() {
    let subs = extract_gating_substrings("(?=foo)bar")
        .expect("expected Some after lookahead skip");
    assert_eq!(subs.len(), 1);
    let (substring, ci) = &subs[0];
    assert_eq!(substring.as_bytes(), b"bar");
    assert!(!*ci, "ci flag should be false (no (?i) prefix)");
}

#[test]
fn negative_lookahead_at_start_extracts_after_body() {
    // What:     `(?!foo)bar` -- negative lookahead at the head; the
    //           regex requires `bar` to NOT have `foo` immediately
    //           ahead, then match `bar`. AC gating only needs a byte
    //           sequence the regex requires somewhere in the file;
    //           `bar` is required, so it is the gate.
    // Why:      Confirms negative-flavour lookaround skipping does
    //           not accidentally try to register the lookaround body
    //           (`foo`) as a required AC literal -- that would be
    //           UNSOUND because a real match guarantees `foo` is
    //           NOT at that position.
    // TS map:   same shape as the positive case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?!foo)bar")!;
    // expect(subs[0].sub).toBe("bar");
    // ```
    let subs = extract_gating_substrings("(?!foo)bar")
        .expect("expected Some after negative-lookahead skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"bar");
}

#[test]
fn positive_lookbehind_at_start_extracts_after_body() {
    // What:     `(?<=foo)bar` -- positive lookbehind at the head.
    // Why:      Confirm the lookbehind shape (`(?<=`) is
    //           discriminated from `(?<name>` named-capture by the
    //           detector: bytes after `(?<` must be `=` or `!` to
    //           qualify as lookbehind.
    // TS map:   same shape as the positive lookahead case.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?<=foo)bar")!;
    // expect(subs[0].sub).toBe("bar");
    // ```
    let subs = extract_gating_substrings("(?<=foo)bar")
        .expect("expected Some after positive-lookbehind skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"bar");
}

#[test]
fn negative_lookbehind_at_start_extracts_after_body() {
    // What:     `(?<!foo)bar` -- negative lookbehind at the head.
    // Why:      Cover the fourth lookaround flavour. Same soundness
    //           note as negative lookahead: never extract the
    //           negative-lookaround body itself.
    // TS map:   `const subs = extractGatingSubstrings("(?<!foo)bar")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?<!foo)bar")!;
    // expect(subs[0].sub).toBe("bar");
    // ```
    let subs = extract_gating_substrings("(?<!foo)bar")
        .expect("expected Some after negative-lookbehind skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"bar");
}

#[test]
fn lookahead_at_end_extracts_before_body() {
    // What:     `foobar(?=baz)` -- lookahead at the END of the
    //           pattern. Walker consumes `foobar` first, then sees
    //           the lookahead and skips it; loop ends with `foobar`
    //           as the best candidate.
    // Why:      Even pre-fix, the walker probably extracted `foobar`
    //           here -- it consumed literals up to the `(`, then
    //           bailed when `skip_atom_with_extract` returned None,
    //           but `best` was already set. Post-fix the bail
    //           becomes a clean skip; behaviour shouldn't regress.
    // TS map:   `const subs = extractGatingSubstrings("foobar(?=baz)")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("foobar(?=baz)")!;
    // expect(subs[0].sub).toBe("foobar");
    // ```
    let subs = extract_gating_substrings("foobar(?=baz)")
        .expect("expected Some with literal-then-lookahead");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"foobar");
}

#[test]
fn lookahead_in_middle_extracts_best_literal() {
    // What:     `foofoo(?=x)bar` -- literal `foofoo` (6 bytes),
    //           lookahead, literal `bar` (3 bytes). `extract_branch`
    //           picks the BEST single candidate within a branch
    //           (longest score), so `foofoo` wins over `bar`.
    // Why:      Confirm the walker continues past the lookaround
    //           and considers the trailing literal too -- the
    //           soundness invariant is that one required substring
    //           per branch suffices, and longest wins for
    //           selectivity.
    // TS map:   `const subs = extractGatingSubstrings("foofoo(?=x)bar")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("foofoo(?=x)bar")!;
    // expect(subs[0].sub).toBe("foofoo");
    // ```
    let subs = extract_gating_substrings("foofoo(?=x)bar")
        .expect("expected Some with literal-lookahead-literal");
    assert_eq!(subs.len(), 1);
    assert_eq!(
        subs[0].0.as_bytes(),
        b"foofoo",
        "extract_branch should pick the longest of the two literals"
    );
}

#[test]
fn lookahead_in_middle_picks_longer_after_skip() {
    // What:     `foo(?=x)barbaz` -- 3-byte literal, lookahead,
    //           6-byte literal. Walker must continue past the
    //           lookahead and pick `barbaz` as the more-selective
    //           candidate (6 bytes > 3 bytes).
    // Why:      Pre-fix the walker bailed at `(?=`, leaving `foo`
    //           as the gate. Post-fix it skips the lookahead and
    //           replaces `foo` with the longer trailing literal --
    //           the whole point of the perf gap this commit closes.
    // TS map:   `const subs = extractGatingSubstrings("foo(?=x)barbaz")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("foo(?=x)barbaz")!;
    // expect(subs[0].sub).toBe("barbaz");
    // ```
    let subs = extract_gating_substrings("foo(?=x)barbaz")
        .expect("expected Some after lookahead skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(
        subs[0].0.as_bytes(),
        b"barbaz",
        "post-fix walker should continue past lookahead and pick the longer trailing literal"
    );
}

#[test]
fn prose_em_dash_pattern_extracts_middle_literal() {
    // What:     The user's exact pattern from the bug report:
    //           `(?<=[a-z]) -- (?=[a-z])`. Lookbehind asserts a
    //           lowercase letter just before; lookahead asserts a
    //           lowercase letter just after. The literal between
    //           the two zero-width assertions is ` -- ` (space,
    //           hyphen, hyphen, space -- 4 bytes).
    // Why:      Headline regression: pre-fix this rule had no AC
    //           gate and ran as a residual per-rule resharp scan.
    //           Post-fix it must extract ` -- ` and route to the
    //           AC prefix bucket.
    // TS map:   `const subs = extractGatingSubstrings("(?<=[a-z]) -- (?=[a-z])")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?<=[a-z]) -- (?=[a-z])")!;
    // expect(subs[0].sub).toBe(" -- ");
    // ```
    let subs = extract_gating_substrings("(?<=[a-z]) -- (?=[a-z])")
        .expect("expected Some after lookbehind+lookahead skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(
        subs[0].0.as_bytes(),
        b" -- ",
        "literal between the two zero-width lookarounds should be the AC gate"
    );
}

#[test]
fn nested_lookaround_extracts_after_outer() {
    // What:     `(?=(?:foo|bar))baz` -- positive lookahead whose
    //           body is itself a non-capturing group with an
    //           internal alternation. The walker only needs to
    //           skip the OUTER lookaround group (matching close
    //           paren), not understand the inner structure.
    //           `find_matching_close_paren` tracks paren depth so
    //           the inner `)` decreases depth from 2 to 1, and the
    //           outer `)` from 1 to 0 (returning that index).
    // Why:      Confirm depth tracking works through the nested
    //           group, so the walker resumes correctly at `baz`
    //           after the outer `)`.
    // TS map:   `const subs = extractGatingSubstrings("(?=(?:foo|bar))baz")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?=(?:foo|bar))baz")!;
    // expect(subs[0].sub).toBe("baz");
    // ```
    let subs = extract_gating_substrings("(?=(?:foo|bar))baz")
        .expect("expected Some after nested-lookaround skip");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"baz");
}

#[test]
fn lookahead_does_not_break_named_capture_path() {
    // What:     `(?<name>foo)bar` -- named capture group, NOT a
    //           lookbehind. The detector must discriminate them by
    //           the byte after `(?<`: only `=` or `!` is a
    //           lookbehind; anything else (a name character) is a
    //           named capture.
    // Why:      Regression guard: a sloppy detector that treats
    //           `(?<` as lookbehind unconditionally would break
    //           every named-capture rule by skipping its body
    //           instead of recursing into it. This test pins the
    //           discriminator.
    // TS map:   `const subs = extractGatingSubstrings("(?<name>foo)bar")!;`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?<name>foo)bar")!;
    // // Named-capture body is the required literal; recurse extracts
    // // "foo" or the longer concat -- pin the actual current behaviour.
    // ```
    let subs = extract_gating_substrings("(?<name>foo)bar")
        .expect("named-capture rule should still gate");
    // What:     `assert!(...)` macro panics if its arg evaluates to
    //           false. We accept either `foo` (group body) or
    //           `foobar` (concatenated) here; the discriminator
    //           only needs to ensure we did NOT accidentally skip
    //           the body and end up with `bar` alone.
    // Why:      The test isn't about which literal wins; it's
    //           about ensuring named captures are NOT misrouted to
    //           the lookaround skip path.
    // TS map:   `expect(["foo", "foobar"]).toContain(subs[0].sub);`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(["foo", "foobar"]).toContain(subs[0].sub);
    // ```
    let extracted_bytes = subs[0].0.as_bytes();
    assert!(
        extracted_bytes == b"foo" || extracted_bytes == b"foobar",
        "named-capture body should still gate; got {:?}",
        subs[0].0
    );
}

#[test]
fn prose_em_dash_pattern_round_trips_through_aho_corasick() {
    // What:     End-to-end pipeline check for the user's exact
    //           pattern. Build AC from the extracted gate ` -- `
    //           and search content matching the rule.
    // Why:      Soundness invariant: registered AC pattern must
    //           appear in any string the regex matches. ` -- ` is
    //           a strict subset of the regex's required bytes, so
    //           AC must fire on it.
    // TS map:   end-to-end pipeline test in TS would be the same
    //           shape with a JS AC port.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?<=[a-z]) -- (?=[a-z])")!;
    // const ac = new AhoCorasick(subs.map(([s, _]) => s));
    // const matches = [...ac.search("hello -- world")];
    // expect(matches.length).toBeGreaterThan(0);
    // ```
    let subs = extract_gating_substrings("(?<=[a-z]) -- (?=[a-z])")
        .expect("expected Some after both lookaround skips");
    let patterns: Vec<&str> = subs.iter().map(|(s, _)| s.as_str()).collect();
    let ac = AhoCorasick::new(&patterns).expect("AC build should succeed");
    let content = "hello -- world";
    let matches: Vec<_> = ac.find_iter(content).collect();
    assert!(
        !matches.is_empty(),
        "AC should fire on ` -- ` for prose em-dash content"
    );
    assert_eq!(
        matches[0].start(),
        5,
        "match should start at byte offset 5 (after `hello`)"
    );
}
