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

## What I read, and what it showed

Two kinds of evidence,
 because reading 147 clusters by hand is not what was missing.

Mechanical,
 over all 147 proposed entries.
The report grammar puts one body-hash group per `### ______ N ______` section,
so a single-section cluster means every unit has byte-identical body text.
Bodies were then tokenised with identifiers and literals normalised to placeholders,
so "same skeleton,
 different names" separates from "structurally different".

- 9 clusters have one body shared by every unit:
   8 with 2 units and 1 with 11 units.
- 39 clusters have the same token skeleton with different names or literals.
- 99 differ structurally,
   and 6 of those differ only by `async` and `await` plus names.

Hand reads,
 50 clusters,
 chosen as the largest and the highest-risk families.

- 24 deliberate-mirror clusters in #657 (`sync-async-twins`,
   `complementary-predicate-twins`,
   `differential-fuzz-adapters`,
   `or-throw-sibling-guards`,
   `perf-benchmark-arms`,
   `sync-async-test-twins`),
   diffed line by line.
   Every difference is on the intended axis:
   `await` and `Promise<T>` for the twins,
   `readFile` against `readFileSync`,
   `<=` against `<` for `isPrefix` and `isStrictPrefix`,
   swapped ternary branches and a De Morgan swap for the complements,
   `peek` against `get` and object-form against positional arguments for the fork adapters.
   No drift in any of them.
- 11 coverage-probe clusters in #658.
   Each unit is a distinct invalid input:
   `parseCss` on `.a {` against `.a` against `.a ; {}`,
   `pify` on `null` against `'nope'`,
   `config.set` on `__internal__` against `__internal__.x` against a nested value.
   Compressing them into a table would hide which branch each input reaches,
   which is the file's purpose.
- 4 of the 13 i18n clusters in #658.
   `en` and `ca` select a complement form through `nonFiniteSurface({ entry, form })`
   while `zh` reads `.surface`;
   `en` passes `{ sentence, deps }` to `renderWhSubject` while `zh` passes `sentence`;
   `ca` reads `entry.infinitive` where `en` reads the verb entry whole.
   The differences are grammatical,
   as claimed.
- The 11 judgement-heavy clusters in #659,
   read against their source.

Among the clusters whose bodies differ,
 the hand reads found no counterexample.
Every counterexample is in the identical-body group.

## Nine proposed dismissals are byte-identical copies

Bodies quoted exactly as indexed.

- C13,
   #656,
   `BOILERPLATE-TRIVIAL`,
   11 identical units:
   `{ return formatter.write_str(self.message.as_str()); }`.
   Eleven byte-identical Rust `Display` impls,
   out of 50 `Display` impls in the repository.
   The recorded reason is "idiomatic per-type Rust `Display` impls".
   Idiomatic and identical are different claims:
   11 copies of one line is what a `macro_rules!` in a `rust-module/*` crate removes,
   and `thiserror` would too,
   though it appears in no `Cargo.toml` in the repository and only in third-party audits
   (`doc/audit/turso-cargo-toml-0.6.1.md` and two vetting docs),
   so adopting it is a `choosing-technology` decision rather than a fix.
- C617,
   #657,
   `INTENTIONAL-VARIANT`,
   2 identical units:
   `{ if (getToolMode() === 'zoom') event.preventDefault(); }`.
   The recorded reason is "mirror keydown/keyup handlers,
   opposite cursor".
   The bodies are identical,
   so nothing about them is opposite;
   the difference lives in which event each is registered for.
   One handler function registered for both events would be behaviour-preserving.
- C665,
   #658,
   `STRUCTURAL-IDIOM`,
   2 identical units:
   `{ return dispatch({ model, context, ...(options === undefined ? {} : { options, }), },); }`.
   `STRUCTURAL-IDIOM` is defined in `slopo.ignore.txt` as
   "shared skeleton where each body's actual logic differs".
   Here the logic is byte-identical and the difference is in the parameter types,
   which is a real distinction but not that category's.
- C15,
   #656,
   `BOILERPLATE-TRIVIAL`,
   2 identical units:
   `{ return ConfigError { message: String::from(message), }; }`.
   Same Rust error-boilerplate family as C13.
- C629,
   #656,
   2 identical units:
   `return w.toplevel().unwrap().wl_surface() == &root`.
- C636,
   #656,
   2 identical units:
   `{ send_and_wake(&self.tx, &self.worker, command); }`.
   Both already delegate to one shared function,
   so nothing is left to extract.
   This dismissal is correct.
- C639,
   #657,
   2 identical units:
   the `expiresIn` fork and upstream adapters.
   Defensible for differential fuzzing,
   where both sides are written out on purpose,
   but the recorded reason describes an API difference that the body does not contain.
- C669,
   #656,
   2 identical units:
   `{ self.playing.store(on, Ordering::Relaxed); }`.
- C688,
   #656,
   2 identical units:
   `{ return Rc::new(VecModel::from(Vec::new())); }`.

The last four are one-line bodies where extraction saves nothing and the dismissal stands.
C13,
 C15,
 C617,
 C639 and C665 are the ones whose recorded reasoning does not match their evidence,
and C13 is the one with a real remedy.

## Retractions from the first pass of this investigation

- The suggestion that C866 and C989 could share an in-file helper is withdrawn.
   `package/module/hyperscript/README.md` documents the family as the design:
   "Branded value constructors replace raw strings,
   preventing invalid units and disallowed color functions at the type level",
   and lists `cssRem`,
   `cssEm`,
   `cssCh`,
   `cssLh`,
   `cssVi`,
   `cssVb`,
   `cssCqi`,
   `cssCqb`,
   `cssDvi`
   as named exports.
   `cssMin` and `cssMax` returning a branded `CssValue` is the point,
   not the duplication.
- Handing measured site lists to #617 and #618 is redundant.
   #617 already enumerates roughly 70 call sites across 16 clusters and records real drift:
   the whole-string digit predicates disagree about the empty string and about leading zeros.
   #618 already enumerates its guard family,
   including `isStringArray` at six sites with two different narrowings,
   and proposes `isNonEmptyString`.
   Those two owners did family-level work;
   the dismissal issues did not.
- The "119 lower-risk against 28 judgement-heavy" split was a heuristic built from package
   placement and never tested.
   The identical-body test replaces it,
   because it is mechanical,
   covers all 147,
   and found the counterexamples the heuristic missed.

## The error-name family, measured properly

- 212 indexed units contain `this.name = `,
   across 147 files,
   minimum `body_node_count` 13.
- 154 are the pure two-statement idiom,
   `super(message,); this.name = 'XError';`.
- 58 do more:
   extra fields such as `this.status`,
   `this.url` and `this.reason`,
   a tagged logger built in the constructor,
   or a multi-line message.
   A base class removes the name line from those but keeps their constructors.
- 21 forward an `options` argument to `super`,
   so any base class must forward it too.
- 209 assign a string literal and 3 already assign `X.name`,
   as in `this.name = SkillMirrorManifestError.name` in root `file-enforcer.config.ts`.
   The pattern that makes the literal redundant already exists in the repository.
- All 209 literals found by `rg` match their enclosing class name,
   checked by a comparison proven able to fail against a planted mismatch.

So a base class assigning `this.name = new.target.name` would delete 154 constructors and one line
from 58 more,
with `mangle: false` in all three rolldown configs keeping the names intact in published artifacts.
It has not drifted yet,
it touches 147 files,
and published `module/*` packages would gain a dependency edge.

## What slopo cannot tell you

- No stale-entry reporting exists.
   Its nine commands are `init`,
   `show-config`,
   `index`,
   `embed`,
   `analyze`,
   `review`,
   `agent-configs`,
   `agent-review` and `agent-analyze`;
   none compares `slopo.ignore.txt` against the current report,
   and nothing in `slopo/result/analysis/` mentions unused,
   stale or orphaned entries.
- Clustering cannot size a family.
   Two error constructors differing only in a class-name literal are near-duplicates,
   not exact ones,
   so a 212-member idiom surfaces as 17 clusters or fewer,
   split across four issues and four verdicts.
- What can size one is already in the index.
   `code_units.body`,
   `body_node_count` and `body_hash` are populated at threshold 13,
   so one query counts a family with no re-index,
   no embedding and no API cost:
   that is how 212 was produced.

## The test that should have been used first

"Bodies differ" does not settle whether an extraction is demanded.
Two bodies can differ in their data while sharing one policy,
so the right instrument measures the shared part and asks what kind of thing varies.

For all 147 proposed entries,
the longest common token subsequence between each cluster's bodies was computed,
sized against `body_node_count_threshold: 13`
(the repository's own bar for "this is a function worth indexing"),
and the variant tokens were classified as names,
literals,
punctuation,
`async` and `await` markers,
or polarity operators.

- 9 clusters have byte-identical bodies,
   27 units.
- 34 clusters share a run of 50 tokens or more,
   roughly five lines,
   across 97 units.
- 104 clusters share less than 50 tokens,
   across 291 units.

The last group is where dismissal is safe on measurement alone:
the shared part is a few tokens,
so an extracted helper would be longer than what it replaces.
The first two groups are not,
and the 34 were read individually.

## Verdicts on the 34 clusters with a function-sized shared part

Held back,
 because the recorded reason does not survive the measurement:

- Seven i18n clusters in #658:
   C327 (168 of 169 tokens shared across 8 units),
   C353 (150 of 152),
   C348 (397 of 407),
   C321 (135 of 145),
   C582 (172 of 186 across 6 units),
   C328 (103 of 121) and C336 (60 of 75).
   The grammar difference is real and is expressed as which field to read:
   `en/render-sentence-core.ts` selects `entry.imperative ?? entry.base` where
   `ca/render-sentence-core.ts` selects `.imperative ?? .infinitive`,
   and the adverbial renderers differ in `locationPreposition(adv.relation)` against
   `locativeCoverb(adv.relation)` against a bare `${adv.relation}`.
   That is a handful of tokens inside 60 to 140-line functions that are otherwise identical.
   #639 already proposes the mechanism for this package,
   "the renderers and case invariants injected",
   and its criterion names `renderOptionalComplement`,
   `renderOptionalObject`,
   `renderPart`,
   `renderTimeOperand` and `capitalizeBody`.
   These seven are the same design question one level up,
   so they belong in #639's scope rather than in a dismissal.
   C353's three bodies also each open with a byte-identical `renderTimeOperand`,
   which #639 lists as its own cluster C331,
   so dismissing C353 hides code an open extraction issue already claims.
- C604 in #657,
   8 units sharing 67 of 68 tokens.
   These are `batch_sheng`,
   `batch_sheng2`,
   `is_match_batch_scalar`,
   `is_match_batch_interleaved`,
   `batch_inter_w::<N>` and `batch_tight_w::<N>`,
   and every body is the same three-step wrapper:
   allocate `vec![false; lines.len()]`,
   match on `self.engine.table_dfa()`,
   call one kernel or fall back to `self.engine.is_match_batch`.
   Only the kernel name varies.
   The recorded reason,
   "the `cfg` and feature-detection ladder has to be written per kernel because each calls its own
   intrinsics",
   describes the kernels in `dfa/sheng.rs` and `dfa/sheng2.rs`,
   not these dispatch wrappers,
   which contain no intrinsics and no `cfg`.
   A `macro_rules!` or one generic wrapper taking the kernel as a parameter removes all eight bodies.
- C963 and C906 in #657,
   `runPipe` against `runPipeAsync`,
   sharing 519 of 575 tokens and 361 of 415,
   with the only variance being 54 `async` and `await` markers.
   This is the largest duplication in the whole dismissal set.
   The recorded reason is that unrolling preserves the per-arity types,
   which is true of the signatures and says nothing about the bodies.
   The open question is whether one side can be generated from the other,
   or share a core,
   without losing those types.
- C896 in #657,
   `stream` against `streamSimple`,
   sharing 68 of 70 tokens with four name variants.
- C977 in #657,
   `embedAll` against `embedBatchAll`,
   sharing 87 of 93 tokens with eight name and four literal variants.
   The batch form can share a core with the single form even though their public contracts differ.

Kept dismissed,
 because the variance is the point of the code:

- C744,
   376 of 406 tokens shared,
   the fork and upstream adapters in `p-map-fork.fuzz`.
   Differential fuzzing needs both sides written out so that an observation difference means a
   behaviour difference.
   The duplication is the method.
- C771,
   C935 and C873,
   the SIMD kernels themselves,
   sharing 48%,
   78% and 42% with heavy operator and intrinsic variance.
   These are different machine code,
   unlike C604's wrappers.
- C853,
   C616,
   C784,
   C892,
   C900,
   C911 and C979,
   the coverage probes.
   Each body is one invalid input,
   and the input is the test.
   A table would hide which branch each reaches.
- C753,
   C758 and C910,
   sync and async twins sharing 95%,
   94% and 79%,
   where every variant is `async`,
   `await`,
   `Promise<T>` or `readFile` against `readFileSync`.
   The duplication is the deliberate cost of two typed entry points,
   and no drift was found in any of them.
- C700 (`prependComments` against `appendComments`,
   97% shared) and
   C764,
   C751 and C903 (complementary predicates).
   A shared version needs a polarity parameter that restates what the two names already carry.
   This is a values call the repository has already made in `slopo.ignore.txt`.
- C814,
   the `or-throw` sibling guards:
   the kind of iterable is the API.
- C1003,
   the two `p-map-fork` engines,
   29% shared and already verified against the package README.
- C976,
   the record and array branches of one recursive JSONC delete.
- C745,
   `get` against `peek` in quick-lru:
   recency updating is the difference.
- C973,
   the four `createOnce` rule factories,
   whose shared scaffolding the plugin already extracted.
- C993 and C808,
   coverage-fixture iterators whose yield schedules are the fixture.
- C865,
   two hidden subcommand branches.
   C770,
   six per-API mutation-differential cases.
   C804,
   mirror key handlers.
   C599,
   the shell against git-config quoting pair,
   where the shared 62 tokens are `Array.from(...).map(...).join(...)`
   and the escape tables are the whole content.

## Judgements adopted

These are calls,
 not options,
 and each is recorded here so it can be vetoed rather than rediscovered.

1. Hold back 21 of the 147 proposed entries and accept the other 126.
   The 21 are the 9 byte-identical clusters and the 12 named in "Verdicts on the 34 clusters with a
   function-sized shared part".
   For the 126 the shared run is either under 50 tokens,
   where a helper would be longer than what it replaces,
   or large with variance that is the point of the code.
2. Move the seven i18n clusters into #639's scope instead of dismissing them,
   and note in #658 that C353 contains the `renderTimeOperand` helper #639 already claims as C331.
3. Re-verdict the five identical-body clusters whose reasoning contradicts their evidence:
   C13 and C15 become one proposal for a Rust error-display macro,
   with `thiserror` named as an alternative needing `choosing-technology` vetting;
   C617 becomes a code change,
   one handler registered for both events;
   C665 moves out of `STRUCTURAL-IDIOM`,
   because its two bodies are identical and that category requires differing logic;
   C639 keeps its dismissal with the reason restated as being about signatures rather than bodies.
4. File C604's eight dispatch wrappers as a macro or generic-wrapper proposal against
   `rust-module/forbidden-regex`,
   and record that the current rationale describes the kernels rather than the wrappers.
5. Put C963 and C906 to the maintainer as one design question,
   because 519 shared tokens is the largest duplication in the set and the recorded reason is about
   signatures rather than bodies.
6. Do not propose the error-name base class now.
   The family is 212 units across 147 files,
   154 of them the pure two-statement idiom,
   3 sites already assign `X.name` instead of a literal,
   and `mangle: false` in all three rolldown configs would keep derived names intact in published
   artifacts.
   Nothing has drifted in 209 sites,
   the change touches 147 files,
   and published `module/*` packages would gain a dependency edge.
   The measurement is recorded so nobody re-derives it.
7. Record the shared-run measurement beside the family-count query as a recipe in
   `doc/troubleshooting/slopo-threshold-tuning.md` rather than adding a `mise` task or a package.
   Both are queries over data slopo already writes,
   and a task would need a README,
   tasks and tests under the repository's completeness rules for something used a few times a year.
8. Comment the measured sub-floor members on #613 and the third license reader on #633.
   Skip #617 and #618,
   which already enumerated their families and,
   in #617's case,
   found real drift in the digit predicates.
9. Give the three held-back `UNCERTAIN` clusters a home:
   C562 joins #660 as an eighth judgement call,
   and C622 and C721 get one focused issue,
   since both sit in the quick-lru fork family and no issue tracks either.
10. Copy the review ledger into `doc/artifact/` as a dated record and leave the builders in scratch.
11. Leave `slopo.conf.yaml` and `mise.toml` untouched.
   The threshold is hand-tuned and stays at 13.
   Two wording fixes are proposed rather than applied:
   the conf comment "increased from default 10 until no bad reports remain" describes a `0.4.0`
   default,
   since `0.8.0` defaults to 20 at `slopo/config.py:151-152`,
   which makes 13 more permissive than upstream rather than less;
   and `mise.toml:213` installs `pipx:slopo` at `latest` while the tuning doc is verified against two
   specific versions whose source paths already moved.
   `mise.toml` also carries uncommitted local modifications that are not this work's to touch.

## Verification limits

- The probe index at threshold 4 used a throwaway database and did not touch `.slopo.local.dir/`.
   It indexed only;
   it did not embed,
   so no clustering ran on the new units.
   The duplicate counts are exact-body-hash groups,
   not slopo clusters.
- The identical-body test relies on the report's section grammar,
   one body-hash group per section,
   which the triage handover validated against `index.md` for all 1008 clusters.
- The skeleton comparison that produced the first 99-cluster "structurally different" figure
   normalises identifiers and literals but not operator or keyword choice,
   so it reported sync/async twins as structurally different.
   It was replaced by the shared-run measurement in
   "The test that should have been used first",
   which sizes the common part and classifies the variance instead of asking whether the bodies
   match.
- The shared-run figure is a longest-common-token-subsequence length,
   not an AST node count,
   so "50 tokens" is an approximation of the 13-node floor rather than the same unit.
   It also measures the best pair in a cluster,
   so a cluster of eight units is summarised by its most similar two.
- The 34 clusters with a function-sized shared part were read individually.
   The 104 clusters sharing under 50 tokens were not read,
   and their acceptance rests on the measurement that a helper would be longer than what it
   replaces.
- Site counts are `rg` and index queries over tracked TypeScript and Rust at HEAD on 2026-10-09.
   slopo indexes transpiled `.js` that the repository's blanket `*.js` ignore hides from `rg`,
   which is why build output appears in some duplicate groups.
- Whether a 147-file mechanical change is worth making to prevent drift that has not happened is a
   values judgement about depth against governance,
   so judgement 6 is a recommendation and not a fact.
   The same applies to the polarity pairs in C700,
   C751,
   C764 and C903,
   where the repository has already chosen two names over one parameter.
