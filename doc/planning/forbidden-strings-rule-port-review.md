# Forbidden-strings rule port review

Date:
 2026-07-16.

Companion to `doc/planning/forbidden-strings-engine-migration.md`,
 covering step 4 of its rollout sequence
 (port the committed rule files, review the semantic diff).

This document classifies every change the one-time port made when rewriting the two
committed forbidden-strings rule files into the `forbidden-regex` dialect.
The ported files are staged beside the originals, not yet loaded by the scanner:

- `package/cli/forbidden-strings/data/builtin-rules.ported.txt`
  (from `forbidden_strings::BUILTIN_RULES`, embedded from `data/builtin-rules.txt`).
- `forbidden-strings.append.ported.txt`
  (from the repo-root `forbidden-strings.append.txt`).

The gitignored local rule files (`forbidden-strings.local.txt`,
 `forbidden-strings.append.local.txt`) are out of scope;
 they are covered by the cutover runbook and are never read here.

## How to reproduce

The port is scripted by a temporary bin in the benchmark sidecar:

```sh
# from the repo root
mise run //package/rust-module/forbidden-regex.bench:build
cargo run --release --manifest-path package/rust-module/forbidden-regex.bench/Cargo.toml --bin dialectport
```

The bin reads the two committed sources, rewrites each `/PATTERN/FLAGS` line, writes the two
`.ported.txt` files, prints a per-rule change report, then strict-compiles every ported rule
through `forbidden_regex::RegexSet::new` (never `compile_lenient`) and exits nonzero listing
the source line of any rule that fails.
It is removed after the migration cutover.

## Summary of the diff

The builtin file has 861 lines,
 of which 259 are regex rules;
 the committed append file has 18 lines,
 of which 2 are regex rules.
Literal, comment, and blank lines pass through byte-identically,
 and every rule keeps its original 1-based line number
 (load-bearing for the later differential validation).

Counts, measured by the port bin:

- 235 of the 259 builtin regex rules had their pattern text rewritten;
  the remaining 24 differ only by structural regrouping or a dropped flag.
- 182 builtin rules changed match semantics
  (a line that matched before may no longer match, or the reverse).
- The 2 append rules changed only by dropping the `m` flag,
  which is a no-op under the always-multiline engine.

The 182 semantic changes fall into three groups
 (rules can belong to more than one):

- 172 rules lost inline case-insensitivity.
- 16 rules had an unbounded quantifier bounded to the cap of 512.
- 1 rule (the curl rule) was reshaped.

Everything else the port did preserves the matched-input set;
 those adaptations are listed under "Semantics-preserving adaptations".

## Semantic changes

For any listed line number,
 the exact before and after are the line-aligned pair
 `sed -n 'Np' data/builtin-rules.txt` and `sed -n 'Np' data/builtin-rules.ported.txt`;
 representative and high-value pairs are shown inline below.

### Inline case-flag stripping (172 rules)

The engine has no case-insensitivity:
 inline `(?i)`, `(?i:...)`, and `(?-i:...)` are rejected at compile time,
 and there is no flags slot to carry `i`.
The port removes them,
 following the `normalize.rs` precedent:
 `(?i)` is deleted,
 `(?i:...)` and `(?-i:...)` become `(?:...)`.
The resulting rule is case-sensitive where it was case-insensitive,
 so a match on an upper-case or mixed-case variant of a keyword is lost.

This is the dominant semantic change and it warrants explicit human sign-off before cutover.
The migration plan recorded case-insensitivity as
 "a non-issue for the current corpus"
 on the basis that no rule carries the `/i` flag,
 which is true of the trailing flags slot but overlooks the 172 rules that turn
 case-insensitivity on inline with `(?i)`.
The betterleaks generic detectors use `(?i)` on the keyword-plus-secret shape,
 so stripping it narrows each of them to the exact case written in the rule.

Example, line 47 (`adafruit`):

```text
before: /(?i)[\w.-]{0,50}(?:adafruit)(?:[ \t\w.-]{0,20}) ... ([a-z0-9_-]{32}) .../
after:  /[\w.-]{0,50} removed by leading strip; (?:adafruit) ... (?:[a-z0-9_-]{32}) .../
```

Example, line 249 (`etsy`),
 where an inner `(?-i:ETSY|[Ee]tsy)` case-sensitive island collapses into the surrounding
 now-case-sensitive text:

```text
before: /(?i)[\w.-]{0,50}(?:(?-i:ETSY|[Ee]tsy)) ... ([a-z0-9]{24}) .../
after:  /(?:(?:(?:ETSY)|(?:[Ee]tsy))) ... (?:[a-z0-9]{24}) .../
```

Example, line 142 (a bare keyword rule):

```text
before: /(?i)CLOJARS\_[a-z0-9]{60}/
after:  /CLOJARS_[a-z0-9]{60}/
```

The 172 affected source lines are:

47, 50, 53, 59, 65, 68, 71, 86, 89, 92, 99, 118, 121, 124, 127, 130, 133, 136, 142, 145,
148, 154, 157, 160, 163, 166, 169, 175, 181, 184, 187, 190, 199, 202, 205, 208, 211, 214,
217, 220, 223, 226, 229, 233, 237, 240, 243, 246, 249, 252, 255, 258, 261, 264, 267, 270,
273, 276, 279, 282, 285, 288, 294, 299, 302, 308, 375, 378, 381, 384, 387, 390, 393, 399,
404, 407, 413, 416, 419, 425, 428, 431, 434, 443, 446, 449, 452, 455, 458, 461, 464, 467,
470, 473, 476, 479, 482, 485, 488, 491, 494, 500, 503, 509, 521, 524, 527, 530, 533, 539,
544, 547, 550, 556, 559, 566, 574, 581, 584, 587, 592, 598, 603, 606, 609, 612, 615, 621,
624, 633, 639, 648, 651, 654, 657, 660, 693, 696, 699, 705, 708, 732, 737, 741, 747, 750,
756, 759, 762, 765, 768, 774, 777, 780, 783, 786, 789, 792, 798, 801, 804, 807, 810, 813,
816, 819, 822, 825, 828, 831, 834, 837.

Six of these also bound an unbounded quantifier
 (255, 299, 544, 621, 699, 828),
 covered in the next section.

### Quantifier bounding to the cap of 512 (16 rules)

The engine rejects unbounded repetition.
Per the settled decision,
 `*` becomes `{0,512}`,
 `+` becomes `{1,512}`,
 and `{n,}` becomes `{n,512}`.
A secret longer than the cap no longer matches,
 which for these rules means an unusually long base64 blob,
 continuation gap, or value.

The 16 affected rules and their unbounded operator:

- 44: `[a-zA-Z0-9+/]{250,}` becomes `{250,512}`.
- 172: reshaped curl rule (next section); its kept value alternation bounds several `{3,}`.
- 255: `[a-z0-9]{100,}` becomes `{100,512}`.
- 291: `[A-Za-z0-9=_\-,/+]{100,}` becomes `{100,512}`.
- 299: two `\s*` become `\s{0,512}`.
- 437: `ey[...]{17,}` twice becomes `{17,512}`, and `[...]{10,}` becomes `{10,512}`.
- 440: `[...]{40,}` becomes `{40,512}`.
- 506: `[a-z0-9]+` becomes `{1,512}`.
- 518: several `+` and one `*` (host, port, and path repeats) become `{1,512}` and `{0,512}`.
- 544: two `\s*` become `\s{0,512}`, and `.{8,}` becomes `.{8,512}`.
- 621: `[\s\S-]{64,}` becomes `{64,512}`.
- 699: `[A-Z0-9]+`, `\d+`, and `[a-z0-9]+` become `{1,512}`.
- 702: `[a-zA-Z0-9-]*` becomes `{0,512}`.
- 714: three `\d+` and one `[a-fA-F\d]+` become `{1,512}`.
- 720: `[\w\/\\+-]{100,}` becomes `{100,512}`.
- 828: `[A-Z0-9a-z_-]+` becomes `{1,512}`.

### Rule 172 reshape (the curl basic-auth rule)

Rule 172 is the only cross-line rule.
Per the settled decision it drops the leading `\bcurl\b` context and the up-to-five-line
continuation window entirely,
 keeping the `(?:-u|--user)` option,
 its separator,
 and the `user:pass` value alternation on a single line.
The credential pair is the payload;
 `curl` is context,
 and the continuation window cannot survive the line-at-a-time model.
Within the kept tail,
 the value alternation's `{3,}` bounds become `{3,512}`,
 the capturing groups become non-capturing,
 and the trailing `\z` becomes `$`.

```text
before: /\bcurl\b(?:.*|.*(?:[\r\n]{1,2}.*){1,5})[ \t\n\r](?:-u|--user)(?:=|[ \t]{0,5})("(: ... )|'( ... )'|( ... ))(?:\s|\z)/
after:  /(?:(?:-u)|(?:--user))(?:=|[ \t]{0,5})(?: ... {3,512} ... )(?:\s|$)/
```

The full ported form is line 172 of `builtin-rules.ported.txt`.
Compared with the original,
 the reshape broadens the rule
 (it now flags a `-u user:pass` credential on any single line, without requiring `curl`)
 and drops the continuation-line case;
 both directions are the settled trade against same-line-only and multi-line windowing.

## Semantics-preserving adaptations

These changes rewrite the pattern text but do not change which single scanned line matches.
They are recorded here for completeness;
 they are not counted among the 182 semantic changes,
 and the later differential validation should see no finding delta from them.

### Leading redundant class-repeat stripping (117 rules)

The betterleaks generic detectors prepend a nullable identifier context repeat,
 `[\w.-]{0,50}`,
 before the keyword.
Under the engine's unanchored line search a nullable leading repeat always matches the empty
string, so it never adds a constraint:
 a line matches `[\w.-]{0,50}(?:keyword)...` exactly when it matches `(?:keyword)...`.
The port strips it
 (including a second copy nested just inside a leading group, as in rules 136 and 157),
 leaving a leading `\b` or `^` anchor intact because those are real constraints.

This strip is required for the port to be usable:
 the strict compile surfaced a determinization blow-up on the un-stripped shape.
The whole-line matcher for `[\w.-]{0,50}(?:adafruit)...`,
 whose leading repeat overlaps the keyword's own character set,
 took roughly two minutes to compile for a single rule
 (measured 123 seconds for line 47, 55 seconds for line 50);
 after stripping the redundant repeat the same rule compiles in about 100 milliseconds.

The 117 affected source lines are:

47, 50, 59, 65, 71, 86, 89, 92, 118, 121, 124, 127, 130, 136, 145, 148, 154, 157, 160, 163,
166, 169, 175, 181, 184, 187, 190, 202, 205, 208, 214, 217, 220, 223, 240, 243, 246, 249,
258, 261, 264, 270, 273, 276, 279, 302, 308, 375, 378, 390, 404, 407, 413, 425, 431, 434,
443, 446, 449, 452, 458, 461, 464, 467, 470, 473, 476, 479, 482, 485, 488, 491, 494, 500,
503, 509, 521, 524, 527, 530, 533, 550, 556, 559, 574, 581, 584, 587, 603, 606, 624, 633,
648, 651, 660, 693, 732, 737, 747, 750, 756, 759, 762, 768, 774, 777, 780, 783, 786, 789,
792, 804, 819, 828, 831, 834, 837.

### Carriage-return and line-feed class members dropped (2 rules)

Rules 172 and 440 list `\r` and `\n` as members of a character class,
 for the multi-line base64 continuation case.
The engine rejects `\r`/`\n` escapes,
 and a single scanned line never contains a newline byte
 (the scanner splits on `\n` and strips a trailing `\r`),
 so the port drops those two members.
For rule 440 the surrounding class keeps its literal backslash and every other member;
 the drop leaves an inert character out of a class that a line can never exercise.

### `\z` rewritten to `$` (4 rules)

Rules 172, 569, 663, and 720 end an alternation with `\z` (absolute end of input).
The engine has no `\z`;
 the port rewrites it to `$`,
 which under the always-multiline engine matches at end of line.
For a single scanned line the two anchor positions coincide,
 so the match set is unchanged.

### `m` flag dropped (2 append rules)

The two committed append rules (source lines 17 and 18) carry the `m` flag.
Multiline is always on in the engine,
 so the flag is a no-op and the port drops it;
 the pattern text is otherwise byte-identical.

### Always-applied dialect normalizations

Every regex rule also passed through these text rewrites,
 none of which change the matched-input set:

- POSIX class spellings expand to byte classes
  (`[[:alnum:]]` to `[A-Za-z0-9]`; the one occurrence is line 518).
- Capturing groups `(...)` become non-capturing `(?:...)`;
  the scanner reports per-line rule indices, not captures.
- An unnecessary escape of a non-metacharacter loses its backslash
  (`\"` becomes `"`, four times on line 544),
  and `\_` and `\x60` become the literal `_` and backtick they already denoted.
- An unescaped space or tab outside a class is escaped (`\ ` or `\t`),
  because verbose mode swallows bare whitespace
  (lines 544 and 621 carry such spaces).
- Alternation and intersection operands are wrapped in `(?:...)` where the dialect requires a
  single atom;
  already-atomic operands are left unwrapped.
  The four set-algebra rules (105, 321, 849, 861) keep their `&` and `~(...)` operators,
  with each operand wrapped to a single atom.

## Compile-time finding

The strict compile answers the migration plan's open question about compile cost.
Even after the leading-repeat strip,
 the faithful full-context rules are individually expensive to determinize:
 line 440 (a base64 JWT rule) measured about 122 seconds,
 line 518 (a mongodb connection string) about 67 seconds,
 lines 603 and 606 about 60 seconds,
 line 663 (a sentry token) about 44 seconds,
 and line 621 (a private-key block) about 39 seconds,
 with 49 rules exceeding one second.
These costs come from large bounded repetitions over wide character sets
 (for example `{70,400}`, `{109,269}`, and the cap-inflated `{n,512}` forms).

Compiling the whole ruleset at scanner startup is therefore not viable against the README's
sub-second budgets.
The migration should embed a precompiled serialized `RegexSet`
 (`to_bytes`/`from_bytes`) built once at build time,
 rather than compiling `include_str!` text at each startup;
 this resolves the first open implementation question in the migration plan.

## Open failure: rule 518 exceeds the state cap

One rule does not compile.
Rule 518 (the mongodb connection-string detector) is rejected with
 `pattern exceeded the DFA state cap of 20000`
 after roughly 67 seconds of determinization.
Its shape is a nested alternation of host-or-IP forms with several wide-range repeats
 (`[!-9;-~]{3,50}` for the user, `[!-?A-~]{3,88}` for the password, IPv4 octets,
 optional ports, and a comma-separated replica-set list capped to `{0,512}`),
 whose product determinizes past the cap.

This is the state-cap rejection the migration plan anticipated the strict compile would
surface.
It is left unresolved here rather than rewritten,
 because the minimal fix is a semantic decision that wants a human call:
 the most direct reduction is to bound the comma-separated replica-set repeat to a small
 count (a mongodb URI rarely lists more than a few hosts),
 which would cap the number of replica-set members the rule can match.
Whichever bound is chosen is a semantic change to record here before cutover.
The ported line 518 is written to `builtin-rules.ported.txt` as staged,
 so the fix is a one-line edit plus a re-run of the port bin.

## Verification result

The port bin strict-compiles all 261 ported regex rules
 (259 builtin, 2 append)
 through `forbidden_regex::RegexSet::new`,
 fanned out across the available cores.
260 of the 261 rules compile;
 rule 518 fails with the state-cap rejection described above,
 so the bin exits nonzero and names that line,
 which is the intended fail-closed behavior.
No rule trips `EmptyMatchable`,
 and no rule is silently dropped.
