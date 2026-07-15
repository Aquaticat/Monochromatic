// What:     Integration tests for the extract -> AC -> match
//           pipeline. Exercises the actual soundness invariant the
//           UTF-8 walker bug broke: a regex rule's leading literal,
//           after extraction, must round-trip through Aho-Corasick
//           byte-matching against file content containing the same
//           bytes.
// Why:      A unit test on `walk_literal_bytes` alone can pass while
//           the end-to-end pipeline still has a different soundness
//           gap. This file plugs that hole.
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
//           content; this is exactly what `rule.rs` does in the
//           real loader.
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

// What:     `#[test] fn inline_flag_propagates_ci_to_subsequent_literal()`.
//           BUG 1 regression test. Inline `(?i)` mid-rule must update the
//           ci context for all subsequent literals at the same scope.
// Why:      Pre-fix, `skip_atom_with_extract`'s inline-flag arm returned
//           `Some((rest, None))` without telling `extract_branch` that ci
//           had changed. The caller kept tagging subsequent literals with
//           the original ci. So `/literalA(?i)keyword-suffix/` extracted
//           `keyword-suffix` tagged ci=false, registering it in the case-
//           sensitive AC bucket; the regex itself matched `KEYWORD-SUFFIX`
//           case-insensitively but the AC gate did not, and the rule
//           silently missed. Post-fix the inline-flag arm bubbles the
//           updated ci to the caller, and `keyword-suffix` is tagged ci=true.
//
// In TS you'd write (pseudocode):
// ```ts
// test("inline (?i) propagates ci to subsequent literal", () => {
//   const subs = extractGatingSubstrings("literalA(?i)keyword-suffix")!;
//   expect(subs[0].sub).toBe("keyword-suffix");
//   expect(subs[0].ci).toBe(true);
// });
// ```
#[test]
fn inline_flag_propagates_ci_to_subsequent_literal() {
    // What:     `literalA(?i)keyword-suffix` -- ASCII literal `literalA`
    //           (8 bytes), then an inline-flag group `(?i)` that turns on
    //           case-insensitive mode for everything that follows, then
    //           literal `keyword-suffix` (14 bytes).
    // Why:      `keyword-suffix` is the longer of the two literals so the
    //           walker picks it as the best candidate. The bug shape: its
    //           ci tag must reflect the (?i) flag set by the inline group
    //           BEFORE it appeared in source order.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("literalA(?i)keyword-suffix")!;
    // ```
    let subs = extract_gating_substrings("literalA(?i)keyword-suffix")
        .expect("expected Some for literal + inline-flag + literal pattern");
    assert_eq!(subs.len(), 1, "walker should pick a single best literal");
    let (substring, ci) = &subs[0];
    assert_eq!(
        substring.as_bytes(),
        b"keyword-suffix",
        "longer literal `keyword-suffix` (14 bytes) wins over `literalA` (8 bytes)"
    );
    assert!(
        *ci,
        "BUG 1: ci must be true after the inline (?i) flag; pre-fix this was false"
    );
}

// What:     `#[test] fn unicode_flag_disables_extraction()`. BUG 2
//           regression test. The `u` flag in the leading flag group
//           must route the rule to residual scanning instead of the AC
//           gate path.
// Why:      Pre-fix, `(?iu)cafésecret` had its literal extracted into
//           the AC-CI bucket. aho-corasick's ASCII case-fold leaves
//           `É` and `é` mismatched, so a file containing `CAFÉSECRET`
//           never fired the gate, the regex's find_all never ran, and
//           the rule silently missed. Post-fix `extract_gating_substrings`
//           returns None when the leading flag set contains `u`, and the
//           rule falls back to the residual resharp scan which handles
//           Unicode case-folding correctly.
//
// In TS you'd write (pseudocode):
// ```ts
// test("(?u) leading flag disables extraction", () => {
//   expect(extractGatingSubstrings("(?iu)cafésecret")).toBeNull();
// });
// ```
#[test]
fn unicode_flag_disables_extraction() {
    // What:     Both leading-flag forms that combine Unicode mode with
    //           case-insensitive matching must return None so the rule
    //           goes to the residual scanner.
    // Why:      The AC-CI gate uses aho-corasick's ascii_case_insensitive
    //           which only folds ASCII letters; non-ASCII case-folded
    //           variants (É <-> é, Á <-> á, etc.) would be missed,
    //           making the gate unsound for the (?iu)/(?ui)/(?u) rules.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(extractGatingSubstrings("(?iu)cafésecret")).toBeNull();
    // expect(extractGatingSubstrings("(?ui)cafésecret")).toBeNull();
    // expect(extractGatingSubstrings("(?u)cafésecret")).toBeNull();
    // ```
    assert!(
        extract_gating_substrings("(?iu)cafésecret").is_none(),
        "BUG 2: (?iu) leading flag must disable extraction"
    );
    assert!(
        extract_gating_substrings("(?ui)cafésecret").is_none(),
        "BUG 2: (?ui) leading flag must disable extraction"
    );
    assert!(
        extract_gating_substrings("(?u)cafésecret").is_none(),
        "BUG 2: (?u) leading flag must disable extraction (conservative)"
    );

    // What:     Plain `(?i)` (no `u`) MUST still extract -- this is the
    //           common case-insensitive shape that drains hundreds of
    //           betterleaks rules onto the AC-CI fast path. The fix
    //           must not regress it.
    // Why:      Regression guard. Without this assertion a future
    //           change that disabled extraction on ANY `i` flag would
    //           pass the negative tests but blow up perf on the corpus.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(extractGatingSubstrings("(?i)keyword-suffix")).not.toBeNull();
    // ```
    let subs = extract_gating_substrings("(?i)keyword-suffix")
        .expect("plain (?i) without u flag must still extract");
    assert_eq!(subs.len(), 1);
    assert_eq!(subs[0].0.as_bytes(), b"keyword-suffix");
    assert!(subs[0].1, "ci should be true for plain (?i)");
}

#[test]
fn inline_negated_flag_clears_ci_for_subsequent_literal() {
    // What:     `(?i)shorty(?-i)keyword-suffix` -- outer (?i) sets ci=true
    //           for the rest of the rule. Then `shorty` (6 bytes) is
    //           walked tagged ci=true. Then `(?-i)` inline group CLEARS
    //           ci for subsequent atoms. Then `keyword-suffix` (14 bytes)
    //           wins as the longer literal; it should be tagged ci=false.
    // Why:      Symmetric coverage for the (?-i) variant of the inline
    //           flag. Same bubble-up requirement, opposite direction.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const subs = extractGatingSubstrings("(?i)shorty(?-i)keyword-suffix")!;
    // expect(subs[0].ci).toBe(false);
    // ```
    let subs = extract_gating_substrings("(?i)shorty(?-i)keyword-suffix")
        .expect("expected Some for outer (?i) + inline (?-i) + literal");
    assert_eq!(subs.len(), 1);
    let (substring, ci) = &subs[0];
    assert_eq!(substring.as_bytes(), b"keyword-suffix");
    assert!(
        !*ci,
        "BUG 1 (symmetric): inline (?-i) must clear the outer (?i) for subsequent literals"
    );
}

// What:     `#[test] fn scoped_extended_flag_disables_body_extraction()`.
//           BUG 9 regression test. A scoped flag group `(?x:body)`
//           enables free-spacing mode for `body`: whitespace inside
//           the body is treated as comment/ignore, NOT as literal
//           text. Pre-fix the scoped-flag arm of `skip_atom_with_extract`
//           passed the body verbatim to `extract_scope`, which read
//           the spaces as literal bytes and registered the substring
//           `foo bar` (with the space) in the AC bucket. AC then
//           looked for the literal `foo bar` in file content, but
//           the rule actually matches `foobar` (no space). The gate
//           never fires; the regex's `find_all` never runs; the
//           rule is silently disabled while appearing to take the
//           AC fast path.
// Why:      Soundness contract from the `extract_gating_substrings`
//           docstring: registered substrings must byte-for-byte
//           match what the regex would consume. `(?x:...)` makes
//           that mapping non-trivial without a full `x`-aware
//           rewrite of the extractor, so the safe thing is to
//           extract NOTHING from such a body and let the rule
//           fall through to residual scanning.
//
// In TS you'd write (pseudocode):
// ```ts
// test("(?x:body) disables body extraction", () => {
//   const subs = extractGatingSubstrings("required_(?x:foo bar)");
//   expect(subs?.[0]?.sub).toBe("required_");
//   const onlyX = extractGatingSubstrings("(?x:foo bar)");
//   expect(onlyX).toBeNull();
// });
// ```
#[test]
fn scoped_extended_flag_disables_body_extraction() {
    // What:     A scoped `(?x:foo bar)` as the entire pattern has no
    //           surrounding literal to anchor on. With `x` set, the
    //           spaces inside are ignored by the regex engine -- the
    //           body matches `foobar` -- and the only candidates the
    //           extractor could safely register are `foo` and `bar`
    //           individually. Rather than open that complexity, we
    //           skip extraction on any `x`-scoped body and return
    //           None so the rule routes to residual.
    // Why:      Forces residual fall-through; AC gate cannot soundly
    //           represent the body.
    assert!(
        extract_gating_substrings("(?x:foo bar)").is_none(),
        "BUG 9: scoped (?x:body) must not extract any substring"
    );

    // What:     `required\_(?x:foo bar)` has a literal-underscore
    //           prefix outside the `(?x:...)` scope. The `\_` keeps
    //           the underscore as a literal byte (BUG 10's escape
    //           handling), so the gate is `required_` (9 bytes).
    //           If the rule used bare `_` instead, the walker would
    //           stop at the wildcard and the gate would become
    //           `required` (8 bytes) -- still long enough but a
    //           different shape; this test specifically exercises
    //           the "outer literal + scoped x body" interaction
    //           with the escape form so the assertion stays stable
    //           across BUG 10's wildcard change.
    // Why:      Regression guard: a future fix that bailed the whole
    //           rule on seeing `(?x:` would lose the outer-prefix
    //           extraction. We want the outer literal to keep its
    //           AC slot, only the body to be suppressed.
    let subs = extract_gating_substrings(r"required\_(?x:foo bar)")
        .expect("outer literal must still extract even with (?x:body) after");
    assert_eq!(subs.len(), 1, "expected exactly one substring (outer literal)");
    assert_eq!(subs[0].0.as_bytes(), b"required_");
}

// What:     `#[test] fn bare_underscore_wildcard_does_not_appear_in_gate()`.
//           BUG 10 (extract side). Resharp treats unescaped `_` as a
//           universal wildcard. The engine-level fix routes rules
//           containing bare `_` to resharp, but the extract pipeline
//           also needs awareness: pre-fix the literal walker greedily
//           consumed `_` as a literal byte, so a rule like `pre_post`
//           registered the substring `pre_post` (with `_`) into AC.
//           AC then looked for that literal in file content, but the
//           rule actually matches `preXpost` (where `X` is any byte) --
//           silent gate-never-fires. Post-fix the walker breaks on
//           unescaped `_` and treats it as a zero-contribution
//           wildcard atom, allowing extraction to continue past it to
//           pick up surrounding literals.
// Why:      Without this, the engine-side fix is half-completed: the
//           rule routes correctly to resharp but never gets a chance
//           to run because the AC gate is registered against the
//           wrong literal.
//
// In TS you'd write (pseudocode):
// ```ts
// test("bare _ wildcard skipped by extractor", () => {
//   const subs = extractGatingSubstrings("pre_post");
//   for (const [sub] of subs ?? []) {
//     expect(sub).not.toContain("_");
//   }
// });
// ```
#[test]
fn bare_underscore_wildcard_does_not_appear_in_gate() {
    // What:     `pre_post` -- `pre` and `post` flank the wildcard. The
    //           walker should pick the longer side (`post`, 4 bytes)
    //           as the gating substring. `pre` is also valid (3 bytes,
    //           meets MIN_PREFIX_LEN) but the extractor picks one --
    //           the longest. Either way, the result MUST NOT contain
    //           the literal `_`.
    // Why:      The literal `_` is wildcard in resharp; including it
    //           in the AC pattern makes the gate look for a byte that
    //           the rule does not actually require.
    let subs = extract_gating_substrings("pre_post")
        .expect("expected Some -- some literal side of the wildcard must extract");
    for (sub, _ci) in &subs {
        assert!(
            !sub.contains('_'),
            "BUG 10: gating substring {:?} must not contain bare `_` (resharp wildcard)",
            sub
        );
    }

    // What:     `\_` (escaped) is a literal underscore. Walker pushes
    //           `_` as literal and the gate carries it through. This
    //           regression guard prevents a future change from
    //           dropping the escape-handling path.
    // Why:      Hundreds of betterleaks GitHub PAT rules use `ghp\_`
    //           shapes; they must keep extracting `ghp_` (with the
    //           literal underscore) as their gate.
    let subs = extract_gating_substrings(r"pre\_post")
        .expect("expected Some for escaped-underscore literal");
    assert_eq!(subs.len(), 1, "expected one substring (the full literal)");
    assert_eq!(
        subs[0].0.as_bytes(),
        b"pre_post",
        "BUG 10 regression: escaped \\_ must keep the underscore as literal"
    );
}
