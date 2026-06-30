# DRY audit: oxlint plugins

Generated 2026-06-30 from a focused sweep of three code-checking tools in this project.
This version is written to be readable without a programming background. Every finding has a
plain-language explanation first, then the precise technical detail underneath for whoever does the
work.

## Read this first: what this document is about

### What the code in question actually does

This project builds, among other things, three small tools that automatically check the team's own
program code, a bit like the spelling and grammar checker in a word processor. As someone types
code, these tools underline problems and, in some cases, fix them automatically.

- `no-restricted-syntax` bans risky ways of writing code (the equivalent of "do not start a
  sentence with a number").
- `stylistic` enforces layout and formatting (the equivalent of "put one item on each line so it is
  easy to read").
- `tsdoc` checks the little explanatory notes that programmers attach to their code (the equivalent
  of "every chapter must have a title and a summary").

A single check is called a **rule**. A bundle of related rules, shipped together, is called a
**plugin** or a **package**. These three plugins together contain roughly sixty rules.

### What "DRY" means and why duplication is a problem

DRY stands for "don't repeat yourself." Picture the same phone number written on twenty sticky notes
around the house. The day that number changes, you have to find and correct all twenty. Miss one,
and sooner or later someone dials the wrong number. The tidy alternative is to write the number once
in a single address book that everyone checks.

Program code has the same trap. When the same small piece of logic is copied into many files instead
of written once and shared, the project carries hidden risk. The danger has a name: **drift**. Drift
is what happens when copies that started out identical slowly stop matching, because someone updated
one copy and forgot the others. The code keeps working until the day a forgotten copy quietly does
the wrong thing.

This document finds those copies in the three plugins and, for each one, says where it is, why it is
worth fixing, and what fixing it would look like.

### A few words you will see repeatedly

- **Helper** (also "function"): a small, named piece of logic that other code can call on, the way
  you might call a phone number from your address book instead of memorizing it.
- **Factory**: a helper whose job is to build other things from a short description, so nobody has to
  write each one by hand. Think of a cookie cutter: hand it the shape, it stamps out the cookie. The
  team already uses this idea in a couple of places, which is part of why the gaps below stand out.
- **Test file**: code that checks the checkers, to make sure each rule actually works. Test files run
  only on the team's own machines. They are never sent to the people who install the tools.
- **Shipped** (also "published", "runtime"): code that becomes part of the finished product that
  other people install and run. The opposite is **dev-only**: code used only by the team while
  building, which never gets shipped.
- **Severity**: how much a finding is worth. **High** means the biggest payoff or the biggest risk.
  **Low** means a nice-to-have tidy-up. **Medium** sits in between.

### How this was checked

Four reviews ran in parallel, one for each plugin plus one comparing all three against each other.
Then the most important claims were re-checked by hand against the actual code. Every file-and-line
reference below was confirmed to exist; the counts come from searching the code, not from guessing.
Nothing in the code was changed. This document is the only deliverable.

## What is already done well

Listed so that nobody spends effort redoing work that is already finished.

- The team already built two cookie cutters (factories) in `no-restricted-syntax`, and they are used
  everywhere they should be, with no stragglers writing the logic out by hand. One stamps out the
  "do not let people switch off this rule" checks; the other stamps out the "ban calling this
  method" checks.
- The `tsdoc` plugin already has a shared core that reads a code comment once and hands the pieces to
  every rule, so the rules do not each re-read the comment from scratch. This is the single biggest
  piece of duplication the team has already avoided.
- The build and configuration files for the three plugins already share common bases instead of being
  copied. Their remaining differences are genuine (different names, different needs), not copy-paste.

The findings below are the duplication that remains after all of that good work.

## High severity

### H1. The three plugins each rebuilt the same testing rig

Plain terms: every plugin needs a small rig in its test files that launches the checker, feeds it a
sample, and reads back the result. All three plugins wrote this rig separately, and the three copies
are almost word for word the same. One line is identical right down to the punctuation:

```ts
// the same line appears in all three test files
// no-restricted-syntax/src/oxlint-no-restricted-syntax.unit.test.ts:109
// stylistic/src/oxlint-stylistic.unit.test.ts:155
// tsdoc/src/oxlint-tsdoc.unit.test.ts:150
return (error as { stdout: string; }).stdout;
```

Why it matters: this is the clearest example of drift already happening. The piece of the rig that
works out where the project folder lives has already fallen out of step. The `tsdoc` copy does it one
way; the other two do it a different way:

```ts
// tsdoc figures out the project root by asking a helper
// tsdoc/src/oxlint-tsdoc.unit.test.ts:64
const ROOT = await findMiseMonorepoRoot({ cwd: import.meta.dirname, },);

// the other two count folder levels by hand instead
// no-restricted-syntax/...unit.test.ts:45 and stylistic/...unit.test.ts:74
const ROOT = resolve(import.meta.dirname, '..', '..', /* ... */);
```

A second helper that lists the rules has drifted the same way. When pieces that should be identical
are not, it is a sign the copies are already diverging.

Where: the three `*.unit.test.ts` files named above, roughly the first two hundred lines of each.

The fix, in plain terms: pull the shared rig out into one small toolbox that all three test files
borrow from, so there is one copy to maintain instead of three. Because this rig is only used while
testing, the toolbox is **dev-only**: it stays on the team's machines and is never shipped to people
who install the tools. (This is the "dev-only test kit" mentioned in the earlier version, now spelled
out.)

Technical detail: the duplicated pieces are the `OxlintDiagnostic` and `OxlintOutput` types, the
`TempFixtureFile` types (byte-identical between stylistic and tsdoc), `createTempFixtureFile`
(identical apart from a prefix string), and the capture-stdout-from-thrown-error body. The would-be
parameters are the plugin-code prefix, the temp-folder prefix, the config flag spelling (`-c` versus
`--config`), and the `ROOT` resolver. Estimated reduction: on the order of two hundred fifty lines,
plus the end of the `ROOT` and rule-list drift.

### H2 and H3. One stylistic plugin built the same machine twice, then a rule rebuilt it a third time

Plain terms: this plugin has a general-purpose engine for the job "take a list of things crammed onto
one line and spread them out, one per line." There is a perfectly good shared engine for this. But
the part that handles a function's parameters was written as a separate, nearly identical engine in
its own file, and then the rule that uses it was hand-wired a third time instead of simply plugging
into the shared engine like every other rule does.

Why it matters: this is the largest single block of copied logic in the three plugins. The file that
forks the engine is about two hundred forty lines long, and roughly three quarters of it is a restated
version of logic that already exists elsewhere. Three copies of the same delicate spacing logic means
three places to fix when anything about that logic changes, and three chances to miss one.

Where:

- `packages/oxlint-plugins/stylistic/src/utility/param-fix.ts` (the forked engine), versus
  `utility/needs-fix.ts` and `utility/item-per-line-fix.ts` (the original engine).
- `packages/oxlint-plugins/stylistic/src/rules/param-per-line.ts:101-176` (the rule that hand-wires
  it), versus `utility/item-per-line.ts:95-136` (the shared wiring every other rule uses).

The fix, in plain terms: teach the original engine to also accept the one extra detail the parameter
case needs, then delete the forked copy and let the rule plug into the shared engine like its
siblings. The two go together; they are really one change. Estimated reduction: roughly two hundred
seventy lines across the two.

Technical detail: `paramsNeedFix`/`buildParamFix` restate `needsPerLineFix`/`buildPerLineFix`; the
adjacent-pair line-share loop is byte-identical apart from a variable name. The only true blocker is
that the needs-check reads the container span, whereas the fix builder already locates brackets by
scanning, so the boundary just needs to be acceptable as either a span or an explicit
open/close offset pair.

### H4. The documentation plugin re-wrote a text scanner it already owns

Plain terms: the `tsdoc` plugin needs to walk along a line of text and pick out a word, then skip the
blanks after it. It already has well-made, shared tools for exactly this. Yet three of its rules each
wrote their own private copy of that same walk-along-the-text logic instead of borrowing the shared
one.

Why it matters: text-scanning logic is fiddly and easy to get subtly wrong. Keeping one trusted copy,
rather than four, means a fix or a correction lands in one place and protects every rule at once.

Where: the shared tools live in `packages/oxlint-plugins/tsdoc/src/comment-text.ts`. The private
re-implementations are in `rules/structural-tags.ts:65-95`, `rules/empty-tags.ts:96-159`, and
`rules/type-annotations.ts:68-164`. The inner word-scanning loop is the same in all three:

```ts
// the same scan-a-word loop, copied into three rule files
// empty-tags.ts:106 (and mirrored in structural-tags.ts:75 and type-annotations.ts:76)
function scanTag(idx: number,): number {
  let cursor = idx;
  while ((cursor < s.length) && isWordChar(s.charAt(cursor,),)) cursor += 1;
  return cursor;
}
```

The fix, in plain terms: have those three rules borrow the existing shared scanners and delete their
private copies, keeping only the small part that is genuinely unique to each rule. Estimated
reduction: roughly forty lines, plus simpler tests.

Technical detail: `comment-text.ts` already exports `wordRunEnd`, `tokenEnd`, `leadingTag`, and
`collectTags`. Only the outer capture intent differs (leading tag; tag-plus-rest split;
tag-plus-type extraction). The inner cursors are duplicates of `wordRunEnd` and its whitespace
sibling.

## Medium severity

### M1. The tiniest possible helper, "is this character a blank space?", is copied five times

Plain terms: deep down, several rules need to answer a yes-or-no question about a single character:
"is this a space, tab, or line break?" That answer is a six-line helper. It has been copied into five
different files, including across two of the plugins, even though one copy is already shared and ready
to borrow. A near-twin helper, "is this character part of a word?", is copied four times in the
documentation plugin.

Why it matters: these are the smallest building blocks in the whole system. When even the smallest
block is copied rather than shared, it is a sign that the habit of borrowing has not fully taken hold,
and the same will keep happening with the next small block.

Where: `isWhitespaceChar` appears in `tsdoc/src/comment-text.ts:80` (already shared and exported),
and is copied in `tsdoc/src/rules/empty-tags.ts:56`, `tsdoc/src/rules/type-annotations.ts:41`,
`tsdoc/src/rules/tag-validation.ts:25`, and across in `stylistic/src/utility/indent.ts:9`. The body
is identical everywhere:

```ts
// the same six-line answer, copied into five files
function isWhitespaceChar(c: string,): boolean {
  return (c === ' ') || (c === '\t') || (c === '\n')
    || (c === '\r') || (c === '\f') || (c === '\v');
}
```

The fix, in plain terms: keep one copy in a shared place and have the others borrow it. Within the
documentation plugin that shared place already exists. For the copy that lives in the other plugin,
the natural home is a small shared toolbox the plugins both draw from. Because these helpers run as
part of the finished checkers, that toolbox is **shipped** alongside the tools, not dev-only. (This
is the "published runtime kit for the leaf primitives" from the earlier version; "leaf primitives"
just means these smallest, bottom-of-the-pile helpers.) Estimated reduction: roughly forty-five
lines.

### M2. Two rule families keep their own copies of the same code-reading helpers

Plain terms: two groups of rules each need to read the same kinds of detail out of a piece of code,
for example "what is the name being called here?" or "where was this thing imported from?" Each group
wrote its own version of these helpers. The versions are the same logic with a different label on the
"I found nothing" answer.

Why it matters: these helpers have to stay in step with how the underlying code is structured. Right
now that knowledge lives in two places, so a future change has to be made twice, correctly, or the two
families quietly disagree. The two files already share other helpers, so merging these would be
low-effort.

Where: `no-restricted-syntax/src/rules/no-sync.syntax.ts` and
`no-restricted-syntax/src/rules/prefer-error-is-error.syntax.ts`. The clearest example is the
"pull out the single argument" helper, whose opening checks are identical:

```ts
// the same three opening checks in both files
// no-sync.syntax.ts:100 and prefer-error-is-error.syntax.ts:324
if (call.arguments.length !== 1) return /* nothing-found marker */;
const [argument,] = call.arguments;
if (argument === undefined) return /* nothing-found marker */;
if (argument.type === 'SpreadElement') return /* nothing-found marker */;
// then each file does its own final step
```

The fix, in plain terms: write the shared core once, returning a plain "found it" or "found nothing",
and let each family put its own label on the "nothing" case. Estimated reduction: roughly fifty lines,
and the end of a real risk that the two copies drift apart.

### M3. A family of simple "ban this" rules is missing its cookie cutter

Plain terms: several rules do the simplest possible job: "if you see this exact kind of code, flag
it." Three of them (ban old-style enumerations, ban one looping style, ban switch statements) are
written out longhand, and each one is the same shell with a single word changed. The team already
built cookie cutters for two other rule families; this family never got one.

Why it matters: on its own each file is short, so the line savings are modest. The real value is
uniformity and having one place to update if the way a rule reports a problem ever changes. It also
matches a pattern the team has clearly already endorsed elsewhere.

Where: `no-restricted-syntax/src/rules/no-enum.ts:24-45`, `no-for-in.ts:28-51`, and
`no-switch.ts:34-57`. The shells are the same apart from the kind of code each watches for:

```ts
// the same shell; only the watched-for kind of code changes
// no-switch.ts:47 (mirrored in no-enum.ts:35 and no-for-in.ts:41)
createOnce(context: Context,): VisitorWithHooks {
  return {
    SwitchStatement(node: ESTree.SwitchStatement,): void {
      context.report({ node, messageId: 'forbidden', },);
    },
  };
},
```

A handful of close cousins add one extra yes-or-no check before flagging (`no-try-finally.ts`,
`catch-binding.ts`, `no-nullish-union.ts`, `require-destructured-params.ts`); a cookie cutter with an
optional "only flag when this is true" setting would cover them too.

The fix, in plain terms: build one more cookie cutter for this family, matching the two that already
exist, and let each rule become a short description instead of a longhand shell. Estimated reduction:
roughly seventy to ninety lines of shell.

### M4. Every rule restates the same outer wrapper

Plain terms: each of the roughly sixty rules opens with the same boilerplate frame before getting to
its actual content. There is no shared frame, so the frame is retyped about sixty times.

Why it matters: this is real repetition, but it is shallow. The savings are spread thinly and are
mostly about convenience and consistency rather than removing risky logic. Lower priority than M3,
which removes whole chunks of content for its subset of rules.

Where: all three plugins; counts are roughly twenty-four rules in `no-restricted-syntax`, seventeen
in `stylistic`, twenty-one in `tsdoc`. The repeated part is the wrapper and its standard signature;
the actual content of each rule genuinely differs.

The fix, in plain terms: offer one shared wrapper that rules can pass their content into. Worth doing
only if it reads more clearly, since the wrapper itself is not where the risk lives. Estimated
reduction: spread thin, on the order of a couple hundred lines but mostly cosmetic.

### M5. Several documentation rules build the same "where to point the underline" detail by hand

Plain terms: when a documentation rule flags a problem, it has to say which line to underline. Around
seven rules each compute this the same way, inline, instead of using a shared helper. A couple of
them compute it with a small off-by-one twist, which is exactly the kind of detail that goes wrong
when it is spread across many copies.

Why it matters: getting the underline one line off is a classic small bug. Centralizing the
arithmetic removes that whole category of mistake.

Where: `tsdoc/src/rules/tag-names.ts:146-172`, `empty-tags.ts:234-242`, `tag-escaping.ts:113-120`,
`type-annotations.ts:208-215`, `asterisk-validation.ts:65-73`, `structural.ts:264-273`, and
`structural-tags.ts:194-206`. A shared helper already exists for the whole-comment case
(`rules/tsdoc-visitors.ts:49-71`); this is its missing per-line sibling.

The fix, in plain terms: add the per-line sibling helper and route these rules through it. Estimated
reduction: roughly fifty lines, plus the removal of the off-by-one risk.

### M6. One documentation rule copied a shared visitor instead of borrowing it

Plain terms: there is a shared piece that walks over every function in the code and hands it to a
rule. The "check the yields documentation" rule made its own near-identical copy, for one genuine
reason: it wants to skip a kind of function that can never apply to it.

Where: the shared piece is `tsdoc/src/rules/tsdoc-visitors.ts:192-237`; the copy is
`tsdoc/src/rules/yields.ts:25-91`.

The fix, in plain terms: give the shared piece a simple on/off setting for that one difference, then
delete the copy. Keep the skip as a setting, because it is a real correctness nicety. Estimated
reduction: roughly fifty-five lines.

### M7. One rule re-lists every kind of code it should look at

Plain terms: there is a shared list of "every kind of code item that can carry documentation." One
rule re-typed that entire list by hand, because it needed a slightly different finishing step than the
shared list provides.

Where: the hand-written list is `tsdoc/src/rules/tag-types.ts:66-89`; the shared one is
`rules/tsdoc-visitors.ts:131-154`.

The fix, in plain terms: add a shared variant that covers the same list but does the finishing step
this rule needs, so the list is maintained in one place. Estimated reduction: roughly twenty lines,
and the list stops being kept in two places.

### M8. The formatting plugin copies a small "is this only filler?" test and a small reporting loop

Plain terms: two rules in the formatting plugin each carry their own copy of a small test for "is
this stretch of text nothing but blank space and a separator?" and their own copy of a small loop
that inserts a line break between two items. The copies differ only in trivia: a comma versus a
semicolon, and the exact wording reported.

Where: `stylistic/src/utility/indent.ts:9-16`, `rules/one-var-declaration-per-line.ts:35-51` and
`:143-210`, and `rules/max-statements-per-line.ts:76-92` and `:225-289`.

The fix, in plain terms: share the small test and the small reporting loop, letting each rule pass in
its own separator and wording. Estimated reduction: roughly forty-five to fifty-five lines.

### M9. A two-line "is this a documentation comment?" test exists twice

Plain terms: the exact same two-line yes-or-no test sits in two files under two different names.

Where: `tsdoc/src/tsdoc-comments.ts:48-52` and `tsdoc/src/rules/structural.ts:68-72`.

The fix, in plain terms: keep one and have the other borrow it. Estimated reduction: roughly ten
lines.

## Low severity

These are real but small; treat them as opportunistic tidy-ups.

### L1. A one-line "is this a record?" test is rebuilt in all three plugins

Plain terms: the same one-line test appears under three names in the three plugins. Sharing one
general version would cover all three. Roughly six to ten lines. Location:
`tsdoc/src/ast-access.ts:30`, `stylistic/src/utility/comma-dangle.ts:166`, and
`no-restricted-syntax/src/rules/no-immediate-mutation.syntax.ts:177`.

### L2. Two documentation helpers share the same "unwrap the layers" walk

Plain terms: two helpers both peel back the same three kinds of wrapping around a value. Their final
step is deliberately opposite, so only the peeling part should be shared. Roughly twenty lines.
Location: `tsdoc/src/tsdoc-params.ts:55-94` and `tsdoc/src/tsdoc-destructured.ts:54-140`.

### L3. A "what method is being called here?" guard is repeated

Plain terms: a short guard that recognizes a method call, then reads its name, is copied across a few
rules. Only the guard-plus-name part is shareable; each rule does something different afterward.
Roughly twelve lines. Best done alongside M2, since it lands in the same shared file. Location:
`no-restricted-syntax/src/rules/_method-call-ban-rule.ts:58-72`, `no-trim-left-right.ts:46-58`,
`require-queryselector-generic.ts:67-80`, and
`no-low-information-symbol-description/ast.ts:47-49`.

### L4. A finished helper was built to remove a duplication, then never used

Plain terms: someone wrote a helper (`findDelimiter`) precisely to avoid a copied bracket-finding
step, but nothing ever calls it, while the copied step still lives by hand in two other places. So
the cure exists, unused, next to the disease. Either connect the helper to those two places or delete
it. Roughly sixty-four lines. Location: `stylistic/src/utility/delimiter.ts:45-64`.

### L5. The formatting plugin's "one per line" rules share a thin, repeated skeleton

Plain terms: most of the "one item per line" rules are nearly the same short skeleton with only the
target swapped. The hard work is already shared; only this thin outer skeleton repeats. A cookie
cutter could collapse it, but because each rule already reads clearly, this is a judgment call
between brevity and clarity, not a fix for a risk. Around two hundred lines of volume, low risk.
Location: the `*-per-line.ts` family in `stylistic/src/rules/`.

### L6. One rule has nine almost-identical inner checks

Plain terms: inside a single file, about nine little checks differ only by which field they look at.
A small lookup table would collapse them. Cosmetic, and contained to one file. Location:
`stylistic/src/rules/comma-dangle.ts:53-233`.

### L7. A small "skip this file?" preamble and a repeated cast appear across documentation rules

Plain terms: several documentation rules repeat a three-line "should I skip this file?" preamble, and
separately repeat the same technical cast about seven times. Each could be a one-line shared helper.
Low value: the real win is consolidating the technical casts in one place, not the line count.
Location: across the standalone-visitor rules in `tsdoc/src/rules/` and `tsdoc/src/ast-access.ts`.

## Things that look like duplication but should be left alone

Recorded so nobody re-raises them as problems.

- The three plugins each have a short startup file that lists their own rules. The list is different
  for each plugin, so the resemblance is only the one-line wrapper around it. Not worth changing.
- The same short list of imported names appears at the top of many rule files. The programming
  language has no way to share an import line, so this cannot be removed.
- The formatting plugin's position-and-spacing math is genuinely its own; the other two plugins do
  not do that kind of math. Only the tiny blank-space helper (M1) crosses over.
- A couple of helpers in different files look like twins but do genuinely different work. Merging
  them would be wrong.
- The per-plugin build and configuration files differ for real reasons or already share a common
  base.

## Where shared code should live, and in what order to tackle this

There is no shared toolbox for these plugins today. The one related package sits downstream of all
three (it bundles them together for use), so it cannot hold shared code without creating a loop. Two
new small toolboxes fit cleanly, and they differ in one important way:

- A **dev-only** toolbox, used only while testing and never shipped to people who install the tools.
  This is the natural home for the shared testing rig in H1.
- A **shipped** toolbox, installed alongside the finished checkers because the checkers use it while
  they run. This is the natural home for the tiny shared helpers in M1 (and, if wanted, the shared
  wrapper from M4 and the small tests in L1 and L7). There is already precedent for the plugins
  depending on a shared package this way.

Suggested order, by payoff:

1. H1, the shared testing rig. Highest value, cleanly separable, and it never ships, so there is no
   risk to the finished product.
2. H2 with H3 together, the forked formatting engine. One change, and it removes the most code.
3. H4 and M1, the documentation plugin's copied text scanners and the tiny blank-space helper. The
   trusted originals already exist.
4. M2 and M3, the drift-prone code-reading helpers and the missing cookie cutter for simple bans.
5. M5 through M9, modest shared helpers that also remove small bug risks like the off-by-one
   underline.
6. L1 through L7, opportunistic tidy-ups. L4 is the easiest of all: it is simply unused code to
   connect or delete.

M4 and L5 are large in volume but mostly about neatness rather than risk; weigh the clarity cost
before taking them on.
