---
name: dum-dum-non-ts
description: >
  Write and edit code in non-TypeScript general-purpose programming languages
  using the simplest possible constructs, with a labelled comment block (What
  / Why / TS map / optional Gotcha) and a TypeScript pseudocode equivalent
  above every concept-introducing line. Use when writing or editing source
  files in C, C++, Rust, Go, Python, Java, Kotlin, Swift, Ruby, PHP, Lua,
  Zig, Nim, Haskell, OCaml, Elixir, Clojure, Scala, F# — or any other
  non-TypeScript general-purpose programming language. Do NOT use for
  TypeScript / JavaScript, declarative or data formats (HTML, CSS, JSON,
  YAML, TOML, SQL, Dockerfile, mise.toml), generated code, vendored
  third-party code, or single-character mechanical edits in an existing
  non-TS file.
---

# Dum-dum non-TS

## Audience

The human reader knows **only TypeScript**. Optimise comments and code shape
for them, not for an experienced practitioner of the target language. The
compiler does not read the comments; the user does.

## Two rules

### Rule 1 — Simplest possible constructs

Write boring, beginner-level code. Forbidden by default:

- macros, metaprogramming, reflection, code generation
- operator overloading, custom conversion operators
- template / generic gymnastics beyond a single type parameter
- point-free chains, monad stacks, `do`-notation
- decorators, mixins, multiple inheritance
- comprehensions / generators when their syntax differs from TS
- pattern matching used for control flow that an `if`/`else` chain handles
- "clever" one-liners, ternaries longer than `cond ? a : b`

Prefer: plain named functions, named local variables, explicit type
annotations where the language allows them, `if`/`else`, `for` loops, early
`return`s, one statement per line. **If two ways exist, pick the one whose
translation to TS is mechanical.**

If the task genuinely needs a construct with no clean TS analogue (manual
memory management, lifetimes, async runtimes, FFI, channels), stop and ask
the user whether to (a) proceed with a verbose comment that admits the
analogy is loose, (b) wrap the gnarly bit in a tiny helper and only use the
helper from then on, or (c) pick a different language for this piece.

### Rule 2 — Comments on every concept-introducing line

A line is **concept-introducing** if it is any of:

- an import / `#include` / `use` / `require`
- a function, method, type, struct, class, trait, interface, or enum
  declaration
- a **wrapper or variant constructor**: `Some(...)`, `None`, `Ok(...)`,
  `Err(...)`, `Box::new(...)`, `Rc::new(...)`, `Arc::new(...)`,
  `Cell::new(...)`, `RefCell::new(...)`, `Vec::new()`, `String::new()`,
  Haskell's `Just x` / `Nothing`, Python's `Optional[X]` annotation, etc.
  These exist precisely because the language lacks `null` / `throw`. Every
  appearance is concept-introducing for a TS reader — **including bare
  one-token tails like `Ok(rules)` or `None`**.
- a **type-conversion or wrapper-unwrap method call**: `.to_string()`,
  `.to_owned()`, `.into()`, `.from(...)`, `.clone()`, `.as_str()`,
  `.as_bytes()`, `.unwrap()`, `.unwrap_or(...)`, `.unwrap_or_else(...)`,
  `.unwrap_or_default()`, `.expect(...)`, `.ok()`, `.ok_or(...)`,
  `.collect()`, `.into_iter()`, the `?` propagation operator. (Same idea
  in other languages: Python's `dict.get(k, default)`, Go's `, ok` comma-ok
  pattern, Kotlin's `?:` Elvis, Swift's `as!` / `as?`.)
- a **borrow / reference / deref expression**: `&x`, `&mut x`, `*x`,
  Rust lifetimes `'a`, C/C++ pointer arithmetic, Go's `&v` / `*v`. Even
  if the line looks like a plain function call, **every `&` / `&mut`
  argument is concept-introducing** because it states ownership intent
  ("I am only lending this to you").
- a **closure / lambda** with non-TS-arrow syntax: Rust `|x| ...` /
  `|&x| ...`, Ruby `do |x| ... end`, Haskell `\x -> ...`, etc.
- a **`match` / pattern-match expression** used to extract from
  `Option` / `Result` / sum types (`match x { Some(v) => ..., None => ... }`,
  `match r { Ok(v) => ..., Err(e) => ... }`). Even one-arm `if let
  Some(v) = x` counts.
- an **implicit-return tail expression**: a line at the end of a function
  body whose value becomes the return because there's no trailing `;`.
  Examples: `Ok(rules)`, `Some(escape_literal(trimmed))`, `(line, col)`,
  `if cond { a } else { b }`. The reader has to know **both** that this is
  a return AND understand the value being constructed. Mark it with the
  same comment block as any other concept-introducing line.
- a **statement inside a function body** that uses any language feature
  without a 1:1 TS analogue (pointers, lifetimes, channels, `defer`,
  `with`, list comprehensions, destructors, ownership moves, `await` on a
  non-Promise type, range-indexing like `s[1..n]`, byte literals `b'/'`,
  type-annotated `let` bindings like `let x: Vec<T> = ...`, `let _ = ...`
  discard, etc.)
- a line containing punctuation a TS dev would not recognise: `<<`, `::`,
  `&`, `*`, `?`, `!`, `<...>` template args, `mut`, `'a` lifetimes,
  `->` return type arrows in non-TS positions, etc.

Lines that **do not** need a comment: closing braces, blank lines, plain
arithmetic whose TS equivalent is character-identical (`x + 1`), and
re-assignments to an already-commented variable using only TS-native
operators.

**Comment every recurrence.** Do not drop the comment block on the second,
third, or tenth appearance of the same pattern (`?`, `Some(...)`,
`.to_string()`, `&` arguments, `match r { Ok(_) => ..., Err(_) => ... }`,
…) unless the user has explicitly said "you can stop commenting X in this
file". Repetition is the cost; clarity is the deliverable. If a file
becomes unreadable from the comment density, **make the file smaller**, do
not thin out the comments.

## Comment template

Every concept-introducing line gets a comment block above it, using the
language's line-comment syntax (`//` in C / C++ / Rust / Go / Java / Swift /
Kotlin, `#` in Python / Ruby / Elixir, `--` in Haskell / Lua / SQL, `;` in
Lisp / Clojure):

- **What:** name the construct in plain English. No jargon. If jargon is
  unavoidable (e.g. "preprocessor", "namespace"), define it in the same
  sentence. Two or three lines is fine — exhaustively name every symbol on
  the line and what each one means.
  - **When the line introduces a type from a family of siblings,** the
    What field must explicitly **list the siblings the reader might have
    expected**. Examples: `usize` → name `u32` / `u64` / `i32` / `i64` as
    siblings; `String` → name `&str` as the sibling; `Vec<T>` → name
    `&[T]` and `[T; N]`; `Box<T>` → name `Rc<T>` and `Arc<T>`; `i32` →
    name `u32` / `i64`. Just naming the type is not enough; the dum-dum
    reader has no way to know what alternatives even exist.
- **Why:** one sentence on what the **program** gains from this line. Not
  "declares X" — "we need this so the next line can do Y".
  - **When the line introduces a type from a family of siblings,** the Why
    field must explicitly **justify this type over the siblings named in
    What**. "Why `usize` and not `u64`?" "Why `String` and not `&str`?"
    "Why `Box<T>` and not `Rc<T>`?" One sentence each is enough; silence
    is not.
- **TS map:** how to translate the construct into TypeScript thinking. If
  there is no clean equivalent, say so explicitly ("no TS equivalent —
  mentally: …"). **Always include this field. It is the whole point.**
- **Gotcha** *(optional, only when warranted):* one line warning the reader
  when the construct **looks like** something familiar from TS but behaves
  differently (operator overloading, value-vs-reference, integer overflow,
  hoisting, GIL, ownership moves, …). Skip if there is no trap.
- A blank comment line.
- The literal lead-in `In TS you'd write (pseudocode):` — always TS,
  regardless of which language the surrounding file is in. The pseudocode
  block IS the TypeScript translation; that's the whole point.
- A fenced `` ```ts `` block (inside the language's comment syntax) holding
  the closest TS translation. Comments inside the block may further narrate.

Comments **never** describe the next line in the target language's own
jargon ("declares a `unique_ptr<T>`"). Translate to TS-thinking: "an owning
reference to a heap-allocated `T` — when this variable goes out of scope,
the `T` is freed automatically".

## Worked example — C++ "hello world"

````cpp
// What:     `#include <iostream>` is C++'s "paste this file in here at
//           compile time" directive. `<iostream>` is the standard library
//           header that defines input/output streams. The `<...>` form
//           tells the compiler to look for the file in the standard library
//           directories (vs `"..."` which means "in my project").
// Why:      We need it so the `std::cout` line below is defined. Without
//           this `#include`, the file does not compile.
// TS map:   Closest equivalent is an `import` — except `#include` is a
//           literal text paste, not a module system, and the names it
//           brings in land inside the `std::` namespace (see next block).
//
// In TS you'd write (pseudocode):
// ```ts
// // No 1:1 equivalent — TS gives you `console.log` for free.
// ```
#include <iostream>

// What:     `int main() { ... }` declares a function named `main` that
//           takes no arguments and returns an `int` (a 32-bit signed
//           integer). The `{ ... }` is the function body.
// Why:      Every C++ program must have exactly one `main`. The OS calls it
//           when the program starts; whatever it returns becomes the
//           program's exit code.
// TS map:   TS has no entry-point function — files just run top-to-bottom.
//           Mentally, picture wrapping this whole file in
//           `async function main(): Promise<number> { ... }` and the
//           runtime auto-calling it.
// Gotcha:   `int` is NOT TS's `number`. It is a fixed-width 32-bit signed
//           integer (range roughly ±2.1 billion). Overflow is undefined
//           behaviour — there is no auto-widening to `bigint`.
//
// In TS you'd write (pseudocode):
// ```ts
// async function main(): Promise<number> {
//   // ...body goes here...
//   return 0;
// }
// ```
int main() {
  // What:     `std::cout` is the standard "character output" stream — an
  //           object that represents the terminal's stdout. `<<` is the
  //           "stream insertion" operator: it pushes the right-hand value
  //           into the left-hand stream and returns the stream, which is
  //           why you can chain more `<<` after it. `"hello"` is a string
  //           literal. `std::endl` is a special value meaning "write a
  //           newline character AND flush the buffer to the terminal".
  // Why:      Print the word `hello` followed by a newline.
  // TS map:   Whole line collapses to `console.log("hello")` in TS.
  // Gotcha:   `<<` here is OPERATOR OVERLOADING — the same `<<` symbol is
  //           bitwise left-shift on integers. C++ lets a type redefine what
  //           an operator means. TS has no such mechanism, so do not expect
  //           to see `<<` used this way anywhere in TS.
  //
  // In TS you'd write (pseudocode):
  // ```ts
  // console.log("hello");
  // ```
  std::cout << "hello" << std::endl;

  // What:     `return 0;` ends the function and hands the value `0` back to
  //           whoever called it. For `main` specifically, the caller is the
  //           operating system, and `0` is the convention for "program
  //           succeeded".
  // Why:      Tell the OS the program finished without error.
  // TS map:   In a Node script the equivalent is `process.exit(0)` — or
  //           just letting the script reach its end without throwing.
  //
  // In TS you'd write (pseudocode):
  // ```ts
  // return 0;
  // ```
  return 0;
}
````

In this 4-line program the comments outweigh the code roughly 15:1. **That
is the intended ratio.** Other languages follow the same template by
analogy; only the comment-syntax prefix changes (`//` → `#` → `--` → `;`).
The lead-in stays `In TS you'd write (pseudocode):` regardless of source
language, because the pseudocode block always contains TypeScript.

If a real file feels too verbose, the answer is to make the file smaller
(split into more functions, more files), **not** to thin out the comments.

## Anti-patterns drawn from real failures

These four cases are taken from a real session where the skill was
followed loosely. Each shows the **bad** output the agent produced and the
**good** output the skill demands. Internalise the pattern, not just the
specific construct.

### Bare wrapper-constructor tail (the `Ok(rules)` case)

Bad — no comment on the function's tail expression because "it's just
wrapping a value":

```rust
fn load_rules(path: &str) -> Result<Vec<Rule>, String> {
    // ... body with comments ...
    Ok(rules)
}
```

Good:

````rust
fn load_rules(path: &str) -> Result<Vec<Rule>, String> {
    // ... body with comments ...
    // What:     `Ok(rules)` constructs the success variant of `Result`,
    //           wrapping our `Vec<Rule>`. No trailing `;` means this is
    //           the function's tail expression — Rust auto-returns it.
    // Why:      Hand the freshly loaded rules to the caller and signal
    //           "no error".
    // TS map:   In throwing-style TS, the equivalent is just
    //           `return rules;` — the success channel is implicit.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return rules;
    // ```
    Ok(rules)
}
````

### Type-conversion on a literal (the `.to_string()` case)

Bad — `.to_string()` slipped in unexplained on a string literal:

```rust
return Err("no rules loaded".to_string());
```

Good:

````rust
// What:     `Err("...".to_string())`. `Err` is the failure variant of
//           `Result`. The literal `"no rules loaded"` has type
//           `&'static str` — a borrowed slice of bytes baked into the
//           binary at compile time. `.to_string()` allocates a fresh,
//           OWNED `String` whose contents are copied from that slice.
// Why:      The function signature is `Result<_, String>`, so the error
//           channel must contain an owned `String`, not a borrowed
//           `&str` — the caller may keep the error past our stack frame.
// TS map:   `throw new Error("no rules loaded");` — TS strings are
//           always GC'd and owned, so the borrowed-vs-owned distinction
//           is invisible.
//
// In TS you'd write (pseudocode):
// ```ts
// throw new Error("no rules loaded");
// ```
return Err("no rules loaded".to_string());
````

### `Some(...)` at function tail (the `Some(escape_literal(trimmed))` case)

Bad — silent because "it's obviously the return":

```rust
fn parse_rule_source(line: &str) -> Option<String> {
    // ... body ...
    Some(escape_literal(trimmed))
}
```

Good:

````rust
fn parse_rule_source(line: &str) -> Option<String> {
    // ... body ...
    // What:     `Some(escape_literal(trimmed))` constructs the present
    //           variant of `Option`, wrapping the escaped string. Tail
    //           expression, so it's the return value.
    // Why:      The trimmed line is a plain literal; we escape it and
    //           hand it back as "yes, here is a rule source".
    // TS map:   `return escapeLiteral(trimmed);` — TS `string | null`
    //           returns the value directly; no wrapper.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return escapeLiteral(trimmed);
    // ```
    Some(escape_literal(trimmed))
}
````

### Unwrap-with-fallback (the `.unwrap_or(false)` case)

Bad — silently appended to a method chain:

```rust
if !combined.is_match(&content).unwrap_or(false) {
    return Ok(false);
}
```

Good:

````rust
// What:     `combined.is_match(&content)` returns `Result<bool, RegexError>`.
//           `.unwrap_or(false)` extracts the inner `bool` if the result
//           is `Ok`, otherwise substitutes `false` and DROPS the error.
//           `&content` borrows the bytes read-only — we are not
//           transferring ownership to the matcher.
// Why:      Treat any regex-engine failure as "no match" rather than
//           propagating it; a corrupt input shouldn't crash the scan.
// TS map:   `try { return combined.isMatch(content); } catch { return false; }`.
// Gotcha:   `.unwrap_or(value)` on `Result` SILENTLY discards the error
//           value. Use only when "no info, fall back" is genuinely
//           correct.
//
// In TS you'd write (pseudocode):
// ```ts
// let matched: boolean;
// try { matched = combined.isMatch(content); } catch { matched = false; }
// if (!matched) return false;
// ```
if !combined.is_match(&content).unwrap_or(false) {
    return Ok(false);
}
````

### Type-choice rationale (the `usize` / `String` case)

Bad — names `usize` and `String` without saying why these and not the
siblings:

```rust
// What:     `struct Rule { ... }` with `index` (usize), `src` (String),
//           `regex` (Regex).
// Why:      We keep one Rule per forbidden-string entry.
struct Rule { index: usize, src: String, regex: Regex }
```

Good:

```rust
// What:     `struct Rule { ... }` declares a record type with three OWNED
//           fields:
//           - `index: usize`. `usize` is the unsigned integer wide enough
//             to address any byte in memory on this platform (32 bits on
//             a 32-bit OS, 64 bits on a 64-bit OS). Siblings the reader
//             might expect: `u32`, `u64`, `i32`, `i64`.
//           - `src: String`. `String` is a heap-allocated growable UTF-8
//             buffer that THIS struct owns. Sibling: `&str`, a borrowed
//             view that doesn't own its bytes.
//           - `regex: Regex`. An owned compiled regex object.
// Why:      - `index` uses `usize` (not `u32`/`u64`) because every std
//             API that takes a "size" or "index" wants `usize`; mixing
//             widths forces casts everywhere.
//           - `src` uses `String` (not `&str`) because the struct
//             outlives the function that read the file; a borrowed slice
//             would dangle.
//           - `regex` is owned for the same outlive reason.
// TS map:   `type Rule = { index: number; src: string; regex: Regex };`
//           — TS has no owned/borrowed distinction (everything is GC'd),
//           so the type-choice question doesn't arise.
struct Rule { index: usize, src: String, regex: Regex }
```

## Anti-patterns

- Reaching for an idiomatic-but-opaque construct because it is "the way" in
  that language (Rust iterator chains, Python list comprehensions, Go
  interface satisfaction by name, Kotlin scope functions).
- Dropping the **TS map** field or the **pseudocode** block because "the
  code is obvious" — it is not, to this user. Both are mandatory on every
  block.
- Skipping **What** on a symbol-heavy line. If the line contains `<<`,
  `::`, `&`, `*`, `?`, `!`, `<...>`, `mut`, lifetimes, or any punctuation a
  TS dev would not recognise, name and explain each piece individually.
- Skipping a comment block on a **bare tail expression** (`Ok(rules)`,
  `Some(x)`, `(line, col)`, `if ... { a } else { b }` at end of fn). The
  tail IS the return; it always needs the full block.
- Skipping a comment block on a **wrapper constructor or unwrap chain**
  (`Some(...)`, `None`, `Ok(...)`, `Err(...)`, `.to_string()`,
  `.unwrap_or(...)`, `.ok()`, `.clone()`, `?`) because it appeared a few
  lines up. **Comment every recurrence** until the user explicitly says
  to stop.
- Naming a type without **naming its siblings and justifying the choice**.
  `usize` without "(not `u32`/`u64`/`i64`)"; `String` without "(not
  `&str`)"; `Box<T>` without "(not `Rc<T>`/`Arc<T>`)". The dum-dum reader
  has no way to know a sibling exists.
- Comments that describe the next line in the target language's own jargon
  ("declares a `unique_ptr<T>`"). Translate to TS-thinking instead.
- Combining several lines under one comment block. One concept-introducing
  line ↔ one comment block, even if it gets repetitive.
- Removing comments later to "tidy up". The comments **are** the
  deliverable.
- Padding **Why** with a restatement of **What**. If `Why:` does not say
  what the program gains, delete it and write a real one.

## Out of scope

This skill does not apply when:

- the file is `.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`
- the file is a declarative or data format: `.html`, `.css`, `.scss`,
  `.json`, `.yaml`, `.yml`, `.toml`, `.sql`, `Dockerfile`, `mise.toml`,
  `package.json`, etc.
- the file is generated (auto-produced by a tool, marked `DO NOT EDIT`,
  vendored from a third party)
- the change is a single-character or mechanical edit in an existing non-TS
  file (rename, typo fix) where adding the comment template would dwarf
  the change. In that case, match the surrounding comment density instead.
