# Are the dismissed clusters really non-actionable?

Written to answer one question about the four dismissal issues (#656,
 #657,
 #658,
 #659):
are the matched clusters really non-actionable,
or does dismissing them normalise duplication and miss shared utilities that are small but real?

Maintainer decision recorded while this investigation ran:
`body_node_count_threshold: 13` in `slopo.conf.yaml` is hand-tuned and is the floor.
Lowering it is rejected,
so every option below works at 13.

The answer has three parts.
The per-pair dismissals mostly survive a re-read.
The floor is not what hides the interesting families;
one large family is entirely above it and was still dismissed pair by pair.
And the cause is that the review judged clusters while the duplication lives in families.

## The floor is deliberate and mostly right

`slopo.conf.yaml` sets `body_node_count_threshold: 13`,
and `slopo/indexing/scanner.py:50` keeps a unit only when `body_node_count >= threshold`,
so bodies below 13 AST nodes are never indexed.
Measured on 2026-10-09 with a throwaway probe index at threshold 4
(`~/temp/agent/review-659/work/probe3/`,
`slopo index` only,
no embedding step and no API cost,
154 seconds):

- the current index at 13 holds 18440 units from 3136 files and 690 duplicated body hashes;
- the probe at 4 holds 23671 units from 3939 files and 1274 duplicated body hashes;
- so the floor excludes 5231 units,
   28% of the corpus,
   and 584 exact-duplicate body groups,
   46% of those that exist.

A sample of what the floor excludes argues for keeping it.
`module/hyperscript/src/css/values.constructors.ts` has 33 exported constructors.
At threshold 13 the index holds 8 of them;
the other 25 are 8-node one-liners such as `cssRem`,
 `cssEm`,
 `cssPercent`,
 `cssFr`,
 `cssLh`,
 `cssCh`,
 `cssVi`,
 `cssVb`,
 `cssCqi` and `cssCqb`.
Those are a named API surface where each function is the documentation of one CSS unit,
not waste.
A generic `cssUnit('rem', n)` would shorten the file and destroy the interface.

The genuine cases below the floor are smaller than they look.
`{ return line !== ''; }` appears at 16 sites across 7 packages and
`{ return line.length > 0; }` at 12 sites across 6,
so one predicate exists in two spellings at 28 sites.
`{ chunks.push(chunk,); }` appears at 16 sites across 4 packages as the callbacks
`collect`,
 `collectChunk`,
 `collectStdout`,
 `collectStderr` and `onData`.
Extracting either would not shorten any call site:
`isNonEmptyLine(line)` is longer than `line !== ''`.
What they cost is consistency,
not lines,
and the two spellings of one predicate are the only part worth acting on.

One configuration note,
not a change made here:
`slopo.conf.yaml` justifies the value with
"We're writing strict TypeScript,
 increased from default 10 until no bad reports remain",
but slopo `0.8.0` defaults `body_node_count_threshold` to 20
(`slopo/config.py:151-152`).
The comment describes a `0.4.0` default,
so the hand-tuned 13 is now more permissive than upstream's default rather than less.

## The family the floor does not hide

The error-class idiom is entirely above the floor,
which makes it the cleanest test of the question.

- 212 indexed units contain `this.name = `,
   across 147 distinct files,
   with a minimum `body_node_count` of exactly 13.
   Nothing about the threshold hides any of them.
- The idiom is
   `public constructor(message: string,) { super(message,); this.name = 'XError'; }`,
   concentrated in `git-policy/cli` (42 files),
   `module/deepmerge-ts.fuzz` (12),
   `cli/open-code-review-issue` (11) and `cli/mvm` (9).
- No base class sets the name automatically;
   `new.target.name` appears nowhere in the repository.
- All 209 assignments found by `rg` match their enclosing class name.
   The comparison was proven able to fail against a fixture carrying one planted mismatch
   before its zero-mismatch result was trusted,
   so the idiom has not drifted.
- `package/config/rolldown/src/index.ts:61-65` sets `mangle: false` with the comment
   "Mangle breaks func.name and makes output difficult for users to audit",
   so class names survive bundling and a base class assigning `this.name = new.target.name`
   would be safe in published artifacts.

What the review saw of it:
17 of the 1008 clusters contain an error-name constructor,
and they were split across four issues and four verdicts.

- 12 dismissed by #656 as `BOILERPLATE-TRIVIAL`
   (C139,
   C298,
   C311,
   C317,
   C341,
   C346,
   C432,
   C573,
   C907,
   C914,
   C922,
   C947),
   under the concepts `error-subclass-constructor` and `fork-error-classes`.
- 3 recorded `GENERATED-MIRROR` and owned by #612 (C26,
   C121,
   C127),
   which is correct:
   those are generated copies,
   not a design question.
- 1 recorded `UNCERTAIN` and owned by #642 (C302).
- 1 recorded `EXTRACT-SHARED` and owned by #624 (C373).

So 212 units presenting as 17 clusters in 4 issues were never counted as a family,
and the 12 dismissed clusters carry the reasoning
"two-line `super(message)` plus `this.name = '...'` bodies.
`PP4` requires a custom error class per failure mode,
so the repetition is the intended pattern."
`PP4` does require a class per failure mode.
It does not require each class to hand-assign a name that a base class can derive,
and at 212 sites the repetition is 212 chances for the name to stop matching the class.

A second family sits above the floor too:
11 indexed units contain `attachShadow(`,
all at 20 nodes or more,
and `rg` finds 22 sites in total.
The other 11 are in `webapp-productivity/done-postcss`,
which the `done-*` pattern in `slopo.conf.yaml` excludes from indexing,
verified with `pathspec`'s gitignore matcher.
That exclusion is deliberate:
`done-postcss/package.json` calls it a PostCSS variant
"kept for side-by-side CSS framework comparison",
and #69 tracks consolidating the fork.
What nothing owns is a shared base class or `defineComponent` helper for the 11 components
inside each tree.

## Why clustering cannot see families

slopo clusters by embedding similarity above `analyze_similarity_threshold: 0.93`
and `analyze_rerank_threshold: 0.95`,
then drops overlapping units.
Two error constructors whose bodies differ only in a class-name literal are near-duplicates,
not exact ones,
so they form a cluster only when the similarity is high enough,
and a 212-member idiom surfaces as 17 clusters or fewer.
Exact-body grouping sees only identical bodies,
which is why the 690 and 1274 figures above undercount idiom families and overcount
copy-pasted one-liners.

The consequence for the review is structural rather than a tuning complaint:
the unit of judgement was the cluster,
and every verdict in the ledger is recorded as `full-read` of the reported bodies,
with no caller,
ownership,
or existing-utility check.
"Extraction costs more than it saves" was asserted per pair and never tested against the size of
the family the pair belongs to.

## What survives a re-read of the judgement-heavy clusters

The 11 clusters in #659 that sit in one file or one package and carry a
`COINCIDENTAL-SHAPE` or `BOILERPLATE-TRIVIAL` verdict,
 read against their source.

Eight stand,
because the shared part is already extracted or the two sides answer different questions:

- C588 and C599:
   only one shell single-quote escaper and one git-config double-quote escaper exist
   in the repository,
   so there is no family and no shared home.
- C706:
   three distinct git wire formats (mktree `-z` record,
   packed-refs line,
   batch-ref-update create line).
   A shared builder would take the format as a parameter and restate the difference.
- C811:
   `toSummary` and `toMinimal` are two inline `map` callbacks in one function projecting
   different field sets for different payloads.
- C837:
   two CLIs with two output contracts.
- C909:
   the shared part,
   `IDENTITY_SEPARATOR`,
   is already a constant both key builders use.
- C937:
   two guards for two payload conventions,
   `{ html }` and `{ __html: string }`.
- C974:
   three resolvers already layered by delegation.

Three have a small real extraction available:

- C833:
   the split-and-filter tail of the two `pathSegments` functions in `module/fs-path` is
   identical and only the resolve step differs.
   `splitSegments(path)` is the issue's own caveat 1 proposal,
   and #619 is already consolidating that package,
   so it belongs there rather than in a new issue.
- C866 and C989:
   `cssOklch`,
   `cssOklchFrom`,
   `cssMin`,
   `cssMax`,
   `cssClamp` and `cssCubicBezier`
   are the 6 constructors above the floor in that file,
   and `cssMin` and `cssMax` differ only in the function name they emit.
   An internal helper for that shape is cheap and stays inside one file,
   with no new package and no new dependency.
   The 25 below the floor should stay as they are.
- C878:
   a third license reader already exists.
   `dev-script/deps-cube/src/probe-field-parsers.ts` normalises a license field and unwraps the
   object form `{ type: '...' }`,
   while root `file-enforcer.config.ts`'s `packageJsonLicenseExpression` accepts only a string.
   No tracked `package.json` in the repository uses the object form,
   so the behavioural gap is theoretical here,
   but the reuse is real and #633 already owns that file.

## Options, all at threshold 13

1. Count families with a direct query against the existing index instead of reading clusters.
   `code_units.body` and `body_node_count` are already in `.slopo.local.dir/index.db`,
   so an idiom can be sized with one `like` query and no re-index,
   no embedding and no threshold change.
   That is how the 212-unit figure was produced.
   Pros:
    free,
   repeatable,
   and it measures the thing the review never measured.
   Cons:
    it needs a pattern per idiom,
   so it finds families someone thought to ask about.
2. Give the error-name family its own proposal:
   a base class assigning `this.name = new.target.name`,
   which deletes 212 hand-written constructors and one drift risk,
   with `mangle: false` already guaranteeing the names survive bundling.
   Pros:
    the largest measured family above the floor,
   mechanical,
   and verifiable by the same comparison used here.
   Cons:
    it touches 147 files,
   published `module/*` packages would gain a dependency,
   and `PP4`'s class-per-failure-mode requirement still means one class per error.
3. Hand the measured site lists to the issues that own the families:
   the coverage-report groups to #613,
   the guard groups to #618,
   the text predicates to #617,
   the harness callbacks to #621,
   the transport collectors to #653,
   and the license readers to #633.
   Pros:
    no new issues,
   and each family gets the members the report never showed it.
   Cons:
    five or six issue edits,
   and their cluster counts and titles change.
4. Standardise the two spellings of the non-empty-line predicate (28 sites) without extracting it.
   Pros:
    removes the inconsistency,
   which is the only real cost,
   and changes no interface.
   Cons:
    a 28-site edit for a spelling preference.

Ranking:
 1 over 3 over 2 over 4.
1 beats 3 because measurement is what was missing and it is free,
while 3 spends editorial effort on lists that the next re-index will shift.
3 beats 2 because most invisible families already have an owner,
whereas the error-name family would need a new proposal,
a new dependency edge in published packages,
and a 147-file change whose benefit is drift prevention that has not yet drifted.
2 beats 4 because a 212-site idiom with a one-line fix is a larger prize than a spelling
convention,
and 4 is the kind of change that is only worth riding along with something else.

## Verification limits

- The probe index used a throwaway database and did not touch `.slopo.local.dir/`.
   It indexed only;
   it did not embed,
   so no similarity or clustering ran on the new units.
   The duplicate counts here are exact-body-hash groups,
   not slopo clusters.
- Site counts are `rg` and index queries over tracked TypeScript and Rust at HEAD on 2026-10-09.
   The repository's blanket `*.js` ignore excludes transpiled output from `rg`,
   but slopo indexes it,
   which is why build output appears in some duplicate groups and is named where it matters.
- The error-name comparison was proven able to detect a mismatch against a planted fixture before
   its zero-mismatch result was trusted.
- The `done-*` exclusion was verified with `pathspec`,
   the same gitignore matcher slopo's scanner uses.
- Whether a base error class is worth 147 files of churn is a values judgement about depth versus
   governance,
   not a measurement,
   so option 2 is presented rather than adopted.
