# Momoa 3.2.6: an unpaired `\u` surrogate in Rust JSONC parsing reaches undefined behavior

Status: **incomplete investigation**. The source-level unsafe path is established, but no
Momoa parse was run. An attempted fresh prototype setup was blocked before cloning,
container execution, or a scoped commit. Do not file the upstream draft as-is.

## Symptom

A Rust caller supplying JSONC such as `r#"{"s":"\uD800"}"#` to
`momoa::jsonc::parse` can reach `char::from_u32_unchecked(0xD800)`.
The input contains **one** JSON-source backslash before `u`.
This is undefined behavior under [Rust's `char::from_u32_unchecked` safety contract][rust-char];
it is not a normal parser error whose precise message can be quoted.
There is no observed crash, diagnostic, or successful parse to report.
A high surrogate in a purported pair, such as `\uD83D\uDE00`, also reaches
the unchecked conversion of its first code unit before pairing can occur.
This document does not claim a particular runtime manifestation.

## Root cause

The source inspected was a private upstream clone at
`/var/home/user/temp/agent/momoa-2026-09-24` (commit `8dfb563`).
The clone's Rust manifest says `version = "3.2.6"` at `rust/Cargo.toml:3`:

```toml
name = "momoa"
version = "3.2.6"
```

The primary agent measured SHA-256 on the clone and the downloaded published 3.2.6 source:
`rust/src/parse.rs` matched at `1f63390201ea871c4f7d6e5ddc69d71394a2b459d0f032f3c327507f41cbfea3`;
`rust/src/readers.rs` matched at `4b15e59cb354a65ecd2fa9e8bfb99260a6638183e7a7e34d70abed69ee763b6d`.
This pins the unsafe call chain to the published source, not just a branch with the same manifest version.

1. `rust/src/readers.rs:79-113` validates the escape's next four characters as
   ASCII hexadecimal digits, but does not reject the surrogate range:

   ```rust
   Some('u') => {
       len += 1;
       it.next();
       // next four digits must be hexadecimals
       for _i in 0..4 {
           match it.next() {
               Some(nc) if nc.is_ascii_hexdigit() => len += 1,
               Some(nc) => {
                   let new_cursor = cursor.advance(len);
                   return Err(MomoaError::UnexpectedCharacter {
                       c: nc,
                       line: new_cursor.line,
                       column: new_cursor.column,
                   });
               }
   ```

2. `rust/src/tokens.rs:119-140` delegates quoted strings to that reader and
   returns a string token when it succeeds:

   ```rust
   '"' => {
       let read_result = read_string(it, &cursor);
       if read_result.is_err() {
           return Some(Err(read_result.err().unwrap()));
       }
       let new_cursor = read_result.unwrap();
       self.cursor = new_cursor;
       return Some(Ok(Token {
           kind: TokenKind::String,
   ```

3. `rust/src/parse.rs:295-365` processes a `String` token, reads four digits,
   converts them to `u32`, and invokes unchecked scalar construction. Hexadecimal
   syntax alone does not establish that the integer is a Unicode scalar:

   ```rust
   'u' => {
       let mut hex_sequence = String::with_capacity(4);
       for _ in 0..4 {
           match &it.next() {
               Some(hex_digit) => hex_sequence.push(*hex_digit),
               _ => panic!("Should never reach here."),
           }
       }
       let char_code =
           u32::from_str_radix(hex_sequence.as_str(), 16).unwrap();
       // actually safe because we can't have an invalid hex sequence at this point
       let unicode_char = unsafe { char::from_u32_unchecked(char_code) };
       value.push_str(format!("{}", unicode_char).as_str());
   }
   ```

   The source comment equates valid hex with a valid scalar; the safe standard
   library constructor returns `None` for surrogates. The parser does not
   combine a high and low escape before this conversion.

4. `rust/src/parse.rs:498-500` constructs and runs this parser; the public JSONC
   wrapper in `rust/src/lib.rs:33-44` passes `Mode::Jsonc` to it:

   ```rust
   pub fn parse(text: &str, mode: Mode, options: Option<ParserOptions>) -> Result<Node, MomoaError> {
       let mut parser = Parser::new(text, mode, options);
       parser.parse()
   }
   ```

   ```rust
   pub fn parse(text: &str) -> Result<ast::Node, MomoaError> {
       parse::parse(text, Mode::Jsonc, None)
   }
   ```

   The analogous `json::parse` wrapper at `rust/src/lib.rs:22-24` uses the
   same `parse::parse` function with `Mode::Json`, so the boundary is not
   exclusive to JSONC.

[Rust's `char` documentation][rust-char] and [the Rust Reference][rust-reference-char]
exclude surrogates `0xD800..=0xDFFF` from valid `char` values; the Reference
calls construction of an invalid `char` immediate undefined behavior. This is a source-level safety finding, not an observed execution result.

## Verification

- Scope: momoa Rust crate 3.2.6 from clone commit `8dfb563`.
  The primary agent measured matching SHA-256 values for published `parse.rs` and `readers.rs`.
- The primary agent ran the std-only safe control via
  `mise run test:momoa-surrogate:control` under `~/temp/agent`.
  Its output was `checked char conversion: surrogate rejected, scalar accepted`.
  It asserts `char::from_u32(0xD800) == None` and
  `char::from_u32(0x41) == Some('A')`. The corresponding safe assertions are:

  ```rust
  // std-only; does not import or execute Momoa
  fn main() {
      assert_eq!(char::from_u32(0xD800), None);
      assert_eq!(char::from_u32(0x41), Some('A'));
  }
  ```

- The safe control was expanded to compile and exercise a source-wide `\u`
  guard. `mise run test:momoa-surrogate:control` now prints
  `checked scalar and conservative escape guard: pass`.
  The guard rejects actual JSON Unicode escapes (`\uD800`, `\u0041`),
  a harmless escaped backslash, and a comment containing `\u`;
  it accepts plain text and raw Unicode. This checks the guard predicate,
  not an end-to-end Momoa parse.
- **Do not run** a Momoa parse of the surrogate samples on the real host.
  A pre-patch failure and post-patch success must be established only in
  a private, credential-free container bounded to 2 GiB and 2 CPUs, after
  inspecting the invoked command tree. No such run occurred here.

### Patterns that avoid the unsafe conversion (source-derived, not Momoa-run)

- `r#"{"s":"plain"}"#`: no Unicode escape enters the `u` arm of
  `rust/src/parse.rs:326-348`.
- `r#"{"s":"\u0041"}"#`: the escape represents scalar `A`; the
  std-only control checked its scalar value, not Momoa's behavior.
- `r#"{"s":"\\uD800"}"#`: two JSON-source backslashes encode a literal
  backslash before `uD800`; the escaped-backslash arm is distinct from the
  Unicode arm in `rust/src/parse.rs:324-351`.

### Patterns unsafe to pass to the unpatched parser (source-derived, not run)

- `r#"{"s":"\uD800"}"#`: isolated high surrogate in a value.
- `r#"{"s":"\uDFFF"}"#`: isolated low surrogate in a value.
- `r#"{"\uD800":0}"#`: property name reaches `parse_string` through
  `rust/src/parse.rs:455-470`:

  ```rust
  Ok(_) => {
      // name: value
      let name = self.parse_string()?;
  ```
- `r#"{"s":"\uD83D\uDE00"}"#`: the first of an otherwise paired set
  is converted alone in `rust/src/parse.rs:326-348`.

These are **not** a catalog of observed error variants: undefined behavior
has no reliable diagnostic. No unsafe reproducer was executed on the host.

## Verified workarounds

The following conservative guard was compiled and exercised in the std-only
`~/temp/agent/momoa-surrogate-control.rs` harness. Call it at every consumer
entry point **before** any Momoa parse call; no other path may bypass it.
No end-to-end Momoa parse was run, so integration of this guard with Momoa
remains unverified.

```rust
// Consumer-side guard; does not import or execute Momoa.
fn guard_unicode_escapes(source: &str) -> Result<(), &'static str> {
    if source.contains(r"\u") {
        return Err("Unicode escapes refused at this boundary");
    }
    Ok(())
}
```

The harness verified that this predicate rejects every input containing
`\u`, including `\uD800`, and accepts examples without that sequence.
Source inspection of `rust/src/parse.rs:326-348` shows the guard removes all
syntactically valid Unicode escape paths to unchecked scalar construction
when it is applied before parsing. It also rejects harmless `\u0041`,
literal escaped backslashes, comments containing `\u`, and invalid text that
would already fail parsing. This over-rejection is deliberate.
Callers needing Unicode escape support or exact acceptance semantics must
choose a different parser or implement and validate a full JSONC-aware guard.

## What does not work

These alternatives were rejected by source inspection, not runtime trials:

- Replacing `r#"{"s":"\uD800"}"#` with `r#"{"s":"\\uD800"}"#` is
  not a reproduction of the same input: the latter has a literal backslash
  value, per `rust/src/parse.rs:324-351`. It avoids the problematic path
  by changing the parsed data, not by fixing the parser.
- Trusting `jsonc::tokenize` to accept a string before calling
  `jsonc::parse` is not a surrogate guard: `rust/src/tokens.rs:119-140`
  only invokes `read_string`, whose `rust/src/readers.rs:79-113` check
  establishes hexadecimal syntax, not scalar validity.
- Substituting safe `char::from_u32` alone without handling surrogate pairs
  would avoid unchecked construction but would reject valid JSON pairs.
  The corresponding design must define pairing and isolated-surrogate errors.
- Running an unpatched surrogate parse on the host is unsafe, not an
  acceptable verification method.

## Upstream filing decision

The `.out-of-scope/` directory was listed. Its entries include
`cargo-workspace.md` and `typescript-project-references.md`, but no Momoa
or unpaired-surrogate exemption; there is no listed exemption to cite.
No external issue, PR, or comment was posted.

Repository-scoped GitHub web searches covered open and closed issues and PRs
for [surrogate][issue-surrogate], [from_u32_unchecked][issue-unsafe],
[unicode][issue-unicode], and [unpaired][issue-unpaired], with corresponding
PR searches ([surrogate][pr-surrogate], [from_u32_unchecked][pr-unsafe],
[unicode][pr-unicode], and [unpaired][pr-unpaired]). No matching report was identified.
The [Unicode offsets PR #204][pr-offsets] concerns byte offsets of
multi-byte characters, not escaped surrogate scalar construction. Its
maintainer response asks that Rust and JS behavior stay aligned, which
matters to a future fix but is not a rejection of this safety report.
The primary agent also ran repository-scoped `gh search issues` for `surrogate`,
`from_u32_unchecked`, `unicode`, and `unpaired`; each returned no matching issue.
It ran `gh search prs` for `surrogate`, `from_u32_unchecked`, `unicode`, and `unpaired`.
Those returned only unrelated dependency updates and Unicode-offset work,
including [PR #204][pr-offsets], not this unchecked surrogate construction.
No duplicate was found in the inspected queries; source and tracker state can change.

1. **Upstream fault: yes.** The unchecked conversion follows source-level
   acceptance of surrogate hex digits, not a caller's unsafe block;
   see `rust/src/readers.rs:79-113` and `rust/src/parse.rs:326-351` excerpts.
2. **Upstream can fix it: yes.** The `parse_string` boundary in
   `rust/src/parse.rs:295-365` can replace unchecked construction and
   handle pairs and errors; no architectural impossibility was found.
3. **Supported use case: yes.** `rust/README.md` at the reported commit
   documents `jsonc::parse` and JSONC comment handling; `rust/src/lib.rs:33-44`
   exposes that API. The README gives a `jsonc::parse(code)` example.
4. **External contributions welcome: soft yes.** The root README invites
   development; `.github/ISSUE_TEMPLATE/BUG_REPORT.md` requests a
   reproduction and expects `bug, needs repro` labels. No root
   `CONTRIBUTING.md` was found at this commit and `.github/` listed
   `ISSUE_TEMPLATE/` and `workflows/`, with no PR template in that
   listing. [PR #204][pr-offsets] includes a substantive maintainer
   response to an external contributor. No AI-assisted filing ban was
   found in the checked materials; that is not proof no other policy exists.
5. **Likely fix: soft yes.** No comparable won't-fix signal was found.
   [Parser history][parse-history] and [reader history][reader-history]
   show work in these paths, but neither a release-delta check nor a
   successful `gh` tracker query was performed in this session.
6. **Minimal architecture-compatible prototype: pending.** A background
   agent's private scratch setup and Git commands were blocked; its trust
   request could not open an approval UI. The primary agent can run those
   commands but has not yet created a fresh prototype clone or executed
   Momoa code. The minimal complete fix must decode a paired high and low
   `\u` escape as one scalar and return a normal error for isolated
   surrogates. A diff and isolated pre/post test output remain absent.

Because constraint 6 is unmet, the audit and this document remain
**incomplete**. Reopen only when a fresh, private, origin-checked clone
and a credential-free container with a 2 GiB memory and 2 CPU cap can run
a targeted pre-patch and post-patch harness (with the unsafe pre-patch
execution isolated to that container). Inspect its command tree first;
record the output and inline diff or adjacent patch before filing.

### New-issue draft (do not file as-is)

~~~md
# Rust 3.2.6 JSON/JSONC parser constructs a surrogate `char` with unchecked conversion

Labels: bug, needs repro

In momoa Rust 3.2.6, `jsonc::parse` of `r#"{"s":"\uD800"}"#` (one
JSON-source backslash) reaches undefined behavior by source inspection.
Do not run this on an unsandboxed host. A std-only control confirms
`char::from_u32(0xD800) == None`. No Momoa execution is claimed.

Source trace: `rust/src/readers.rs:91-113` accepts the four ASCII hex
digits following `\u` with `Some(nc) if nc.is_ascii_hexdigit() => len += 1`.
`rust/src/tokens.rs:119-140` invokes `read_string(it, &cursor)` to
produce `TokenKind::String`. `rust/src/parse.rs:326-351` then does:

```rust
let char_code = u32::from_str_radix(hex_sequence.as_str(), 16).unwrap();
let unicode_char = unsafe { char::from_u32_unchecked(char_code) };
```

`rust/src/parse.rs:498-500` calls `parser.parse()`, and
`rust/src/lib.rs:33-44` exposes `parse::parse(text, Mode::Jsonc, None)`
through `jsonc::parse`. A paired high surrogate reaches the unsafe call
before the low half can be combined. Rust documents surrogate construction
through this API as undefined behavior.

Suggested fix: at `rust/src/parse.rs:326-348`, decode valid pairs to
one Unicode scalar and report isolated high/low surrogate errors instead
of constructing an invalid `char`. Add tests for ASCII escapes, valid
pairs, isolated high/low halves, escaped backslashes, and object keys.
Maintain documented Rust/JS behavior parity where possible.

A container-isolated pre/post prototype and complete duplicate search
are still required before this draft is fileable.
~~~

[rust-char]: https://doc.rust-lang.org/std/primitive.char.html#method.from_u32_unchecked
[rust-reference-char]: https://doc.rust-lang.org/reference/types/char.html
[issue-surrogate]: https://github.com/humanwhocodes/momoa/issues?q=is%3Aissue+surrogate
[issue-unsafe]: https://github.com/humanwhocodes/momoa/issues?q=is%3Aissue+from_u32_unchecked
[issue-unicode]: https://github.com/humanwhocodes/momoa/issues?q=is%3Aissue+unicode
[issue-unpaired]: https://github.com/humanwhocodes/momoa/issues?q=is%3Aissue+unpaired
[pr-surrogate]: https://github.com/humanwhocodes/momoa/pulls?q=is%3Apr+surrogate
[pr-unsafe]: https://github.com/humanwhocodes/momoa/pulls?q=is%3Apr+from_u32_unchecked
[pr-unicode]: https://github.com/humanwhocodes/momoa/pulls?q=is%3Apr+unicode
[pr-unpaired]: https://github.com/humanwhocodes/momoa/pulls?q=is%3Apr+unpaired
[pr-offsets]: https://github.com/humanwhocodes/momoa/pull/204
[parse-history]: https://github.com/humanwhocodes/momoa/commits/main/rust/src/parse.rs/
[reader-history]: https://github.com/humanwhocodes/momoa/commits/main/rust/src/readers.rs/
