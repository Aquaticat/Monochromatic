# Em-dash enforcement via forbidden-strings

Date: 2026-05-10

Investigation into using `forbidden-strings`
(the resharp-based deny-list scanner at `packages/dev-script/forbidden-strings/`)
to enforce the AGENTS.md ban on em-dashes (`—`), en-dashes (`–`),
and their ASCII substitutes (`-`, `--`) when used as em-dashes in prose.

## Status

Feasibility confirmed for both unicode characters and the ASCII `--` shape.
Open work: exclusion-list expansion against the resharp algebra ceiling,
self-match handling for the unicode case, single-dash (` - `) handling.

## What works

### Unicode literals

Bare literal lines for `—` and `–` in the rule file work directly:

```
—
–
```

The 7-byte boundary check does not fire on multibyte non-word characters,
so the literal substring-matches anywhere.
Verified by reading `packages/dev-script/forbidden-strings/src/rules/atom.rs:21`
and the README's "non-ASCII characters ... gate correctly" note.

Empirical test against `/tmp/em-dash-fixture.md` (constructed during investigation):
two em-dashes and one en-dash matched at the expected byte offsets;
hyphens, `--watch`, `user-facing`, and ASCII `--` separators passed through cleanly.

### ASCII regex rules

Two regex rules verified to match em-dash shapes
while skipping high-confidence legitimate uses:

```
/[a-z]--[a-z]/
/^.*[a-z] -- [a-z].*$&~(.*npm.*)&~(.*git.*)/
```

Rule 1 catches `word--word` (no surrounding spaces),
routed to the rust `regex` crate (no set-algebra operators present).
Consuming the boundary letters in the match span is fine
since the goal is detection, not precise span isolation.

Rule 2 catches ` -- ` between alphabetic words
on lines that do not contain `npm` or `git`.
The `&` and `~()` operators route this rule through resharp
(`packages/dev-script/forbidden-strings/src/rules/engine.rs:193` `uses_set_algebra`),
which supports the set-algebra needed for the line-level complements.

### Self-match safety for ASCII

The regex rule sources (`[a-z]--[a-z]` etc.)
do not contain ` -- ` or `--` between literal letters;
the bracket characters break the pattern.
Confirmed: scanning these rules against themselves produces no hits.
This is an advantage over literal form for the ASCII case.

### Empirical scan results

Run on 2026-05-10 against the full tree (`forbidden-strings --all`):

- Rule 1: 36 matches.
  Mix of true positives ("permission is not necessary for any reason--for" in LICENSE files)
  and false positives (markdown URL fragments such as `#monitoring--metrics`).
- Rule 2: 2,117 matches.
  533 in `AUDIT.em-dash.md` (intentional examples cataloging violations),
  117 in `TODO.claude-code-words.md` (genuine em-dash style violations of shape "word -- description"),
  the rest scattered across markdown docs, comments, mise.toml task descriptions.

Top hit files:

- `AUDIT.em-dash.md` (533) — intentional self-violations
- `TODO.claude-code-words.md` (117) — true positives
- `.agents/skills/code-review/SKILL.md` (79)
- `packages/audit/oph-common-look-and-feel/src/index.html` (33)
- `packages/module/es/src/types/.../simplifiedSchema.behaviorTest.ts` (25)
- `packages/webapp-productivity/done/PLAN.md` (19)
- `packages/dev-script/forbidden-strings/src/rules.rs` (12)
- `mise.toml` (9)

## What does not work

### Lookarounds in plain rules

The rust `regex` crate does not support lookarounds.
Rules using `(?<=...)`, `(?=...)`, etc. without any `&` or `~(`
fail at compile time with
`look-around, including look-ahead and look-behind, is not supported`.

The em-dash patterns documented above do not need lookarounds:
consuming the boundary letters via `[a-z] -- [a-z]` is sufficient
because the goal is to flag the violation, not to bracket the precise dash bytes.
If a future rule does need lookarounds (for example,
to disambiguate based on surrounding context without consuming it),
include `&_*` to route the rule through resharp,
which supports lookarounds compiled directly into the automaton
(`/tmp/resharp/docs/syntax.md:193-209`).

### Resharp algebra ceiling

Chained complements with multi-element alternations
or seven or more chained `~()` complements
trigger `Algebra(UnsupportedPattern)` at compile time.
Examples that failed during investigation:

```
/(?<=[a-z]) -- (?=[a-z])&_*&~(.*\b(npm|bun|pnpm|yarn|deno|node|mise|hk|gh|cargo|git|jq|sed|grep|rg|cp|mv|rm|cat|echo|exec|sudo|find|ls|cd|chmod|chown|tar|zip|curl|wget|rsync|ssh|scp|test|forbidden-strings)\b.*)/
/^.*[a-z] -- [a-z].*$&~(.*[`].*)&~(.*npm.*)&~(.*bun.*)&~(.*git.*)&~(.*mise.*)&~(.*cargo.*)&~(.*gh\b.*)/
```

The exact threshold is unmeasured.
See "Exclusion list expansion" below for working approaches.

### Sub-span exclusion vs anchored matching

`A&~(B)` applies the complement to the match span only, not surrounding context.
Without anchors, the engine finds a sub-span that satisfies both conditions
even when the whole line contains an excluded token.
Verified empirically: an unanchored rule
matched at column 7 within line `Git: git log -- file.txt is legitimate.`
because the sub-span starting at column 7 ("it log -- file.txt is leg")
does not contain "git".
Anchors (`^...$`) force the match to span an entire line.

### Code-block awareness

Regex cannot track ` ``` ` fence state across lines without backreferences
(resharp does not support backreferences either).
Em-dashes inside fenced code blocks are flagged
unless the line happens to contain a command name in the exclusion list.
No clean regex workaround.

## Self-match issues for unicode rules

A bare `—` rule fires inside the forbidden-strings package itself:
roughly 40 occurrences in `src/rules/atom_tests.rs` (test inputs),
`atom.rs` and `extract.rs` (doc comments explaining em-dash handling),
and `README.md` line 169.
Plus `AGENTS.md` (states the rule), `AUDIT.em-dash.md` (lists violations),
`TROUBLESHOOTING.*.md` files quoting external output.

The scanner's only path-level exclusion is
`is_skipped_file` at `packages/dev-script/forbidden-strings/src/main.rs:171-193`,
a hardcoded `matches!` over five exact basenames.
No glob, no path prefix, no rule-scoped exclusion exists.

Three options for handling these self-matches:

1. Extend `is_skipped_file` with package paths or test-fixture basenames.
   Trade-off: those files become exempt from every rule,
   including the betterleaks-ported credential rules.
   Whether that gap is acceptable on those specific files is a policy call.
2. Add per-rule path-prefix exclusion to the rule grammar.
   Real scanner change touching `rules.rs` and the per-file scan loop.
3. Relocate test-fixture em-dashes into a `data/` file outside scan scope
   and rewrite docs to reference `U+2014` instead of literal characters.
   Costly across roughly 40 sites; partially defeats the purpose
   of testing the literal character.

## Improvement potentials

Notes for the next iteration session.
Not implemented.

### Exclusion list expansion

Rule 2's exclusion list currently has only `npm` and `git`
due to the algebra ceiling.
Splitting exclusions across multiple rules does not help:
multiple rules combine via union (any rule firing flags the line),
which makes detection more permissive, not more restrictive.

Two viable paths:

1. Hand-pick a smaller, high-impact exclusion set per rule
   that fits within the algebra ceiling.
   Iterate against the corpus, classify each false positive,
   keep only the exclusions that retire the most false positives.
2. Pre-process the corpus before scanning:
   strip fenced code blocks, strip markdown URL anchors,
   strip inline backtick spans.
   Requires scanner code changes
   (a pre-pass between file read and rule application).

Categories of false positive observed in the empirical scan:

- markdown anchor links (lines containing `](` or `#`)
- inline code (lines with backticks)
- toolchain commands (`mise`, `bun`, `pnpm`, `yarn`, `cargo`, `deno`, `node`, `hk`, `gh`, `jq`)
- shell builtins (`cp`, `mv`, `rm`, `cat`, `echo`, `exec`, `find`, `ls`, `cd`)

### Single-dash case (` - ` em-dash)

The audit reports 625 occurrences of ` - ` used as em-dash.
Higher false-positive rate due to subtraction (`a - b`),
negative numbers (`-5`),
date ranges (`2024 - 2026`).
Tractable with the same regex plus complement approach
but the exclusion list is broader and less reliable.

### Wider character classes

Current `[a-z]` misses uppercase em-dash usage such as "Word -- Another".
Widen to `[a-zA-Z]` or to a unicode word class.
Need to verify the resharp engine handles wider classes
without hitting the algebra ceiling earlier.

### Code-fence pre-stripping

A two-pass scanner that strips fenced regions before applying rules
would solve the code-block-awareness gap.
Requires scanner code changes (not pure rule-level fix).

### Inline backtick parity check

Inline backtick parity on a single line is expressible in regex
by counting pairs before the position.
Could be added as a complement: exclude positions
preceded on the same line by an odd number of backticks.
Pattern shape (untested): `~(.*`[^`\n]*` -- ` -- ...).
Worth prototyping; might trip the algebra ceiling.

### File-level exclusion via skip list

If the scanner gains path-glob skip support
(extension to `is_skipped_file`),
the rule grammar would not need code-block awareness
for files that are uniformly code (`.ts`, `.rs`, `.css`).
Em-dash bans in those files are noise anyway:
the meaningful target is markdown and prose.

A cheap proxy: skip the rule entirely on lines
that look like they are inside a code-only file
by reading the file extension at scan time.
The scanner currently does not branch on extension.

### Compose with file-enforcer for fix automation

Once the rule reliably flags violations,
file-enforcer could include an em-dash-fix transform
that rewrites flagged spans to the recommended punctuation
(paired commas, parentheses, colon, semicolon, period)
before re-running the lint.
Out of scope for the current investigation.

## Reference

- Resharp engine: `https://github.com/ieviev/resharp`
  (cloned to `/tmp/resharp` during investigation)
- Resharp syntax docs: `/tmp/resharp/docs/syntax.md`
- Forbidden-strings source: `packages/dev-script/forbidden-strings/`
- Existing audit data: `AUDIT.em-dash.md` (untracked at investigation time)
- AGENTS.md em-dash rule: under "Documentation standards"
- Test fixtures used for prototyping during investigation:
  `/tmp/em-dash-fixture.md`,
  `/tmp/em-dash-fixture-real.md`,
  `/tmp/em-dash-fixture-no-space.md`
- Rule iterations during investigation: `/tmp/em-dash-rules-v{1..8}.txt`,
  `/tmp/em-dash-rules-real.txt`
