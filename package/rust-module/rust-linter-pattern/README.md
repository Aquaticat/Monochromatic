# monochromatic-rust-linter-pattern

Structural pattern matching over Rust syntax trees.
It is what makes `[[pattern]]` rules in `rust-linter.toml` work,
 so a repository can add a lint rule without writing Rust or rebuilding the binary.

## Patterns are written in Rust

A pattern is a Rust snippet.
Holes are spelled as ordinary identifiers prefixed `META_`:

```toml
[[pattern]]
id      = "no-unwrap"
match   = "META_X.unwrap()"
fix     = 'META_X.expect("explain the invariant")'
message = "unwrap() panics; name the invariant instead"
```

Writing the pattern in the destination language rather than in a notation
describing it is the direct answer to `AGENTS.md` SYB.
There is no grammar to learn beyond Rust,
 and no second syntax to keep in step with the language.

### Why not `$X`

ast-grep and semgrep spell metavariables `$X`.
That does not work here,
 and the decision was measured rather than assumed.
Against `ra_ap_syntax` 0.0.335,
 `$X.unwrap()` produces one error through the expression entry point and six
 through the file one,
 because `$` is only a token inside a macro definition.
An ordinary identifier parses cleanly wherever an identifier is legal,
 so the prefix carries the meaning instead of a sigil.

## The fragment cascade

Rust has no single "parse anything" entry point,
 and which one accepts a snippet depends on what kind of fragment it is.
Measured against `ra_ap_syntax` 0.0.335:

- `META_X.unwrap()` through `SourceFile::parse` gives five errors and an `ERROR`
  root,
   but through `ast::Expr::parse` gives zero errors and a
  `METHOD_CALL_EXPR`.
- `#[test] fn META_F() {}` is the exact reverse.
- `let META_A = 1;` fails **both**,
   because a statement is neither an item nor an
  expression.
   It only parses inside a function body.

So `fragment::parse` tries each entry point in order and keeps the first that
reports no errors:
 item,
 then expression,
 then statement wrapped in a synthetic function body.
The wrapper is stripped before matching,
 so a pattern never matches against a function nobody wrote.
The author does not have to declare which kind they wrote.

## Matching

Matching is structural,
 over the syntax tree,
 not textual.
That is what makes these hold:

- `META_X.unwrap()` matches `thing.unwrap()` and `map.get(&k).unwrap()` alike.
- It does **not** match `"thing.unwrap()"` inside a string literal,
   nor the same text inside a comment.
- Formatting does not matter:
   `thing . unwrap ( )` matches too.
- A metavariable used twice must bind to the same text both times,
   so `META_X == META_X` matches `a == a` and not `a == b`.

## Rewrites

A `fix` snippet is rendered by substituting each bound metavariable.
Names are substituted longest first,
 because `META_A` is a prefix of `META_AB` and the other order would strand a
 character.
A rewrite naming a hole the pattern never bound is reported by
`unbound_metavariables` so the caller can drop the fix,
 rather than writing the literal text `META_Y` into someone's source.

Pattern fixes are registered at the `Suggestion` trust level,
 not `Safe`:
 a rewrite written by hand in a config file has nothing checking that it means
 the same thing as what it replaces,
 so `--fix` alone will not apply one.
`--fix-suggestions` will.

## Mise tasks

```sh
mise run //package/rust-module/rust-linter-pattern:build
mise run //package/rust-module/rust-linter-pattern:test
mise run //package/rust-module/rust-linter-pattern:lint:clippy
mise run //package/rust-module/rust-linter-pattern:lint:rust
```
