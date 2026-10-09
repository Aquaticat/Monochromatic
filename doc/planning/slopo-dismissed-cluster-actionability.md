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

## Judgements adopted

These are calls,
 not options,
 and each is recorded here so it can be vetoed rather than rediscovered.

1. Hold back the 9 identical-body clusters from acceptance and accept the other 138.
   For the 138 the two sides demonstrably differ,
   and 50 of them were read at body level with no counterexample.
   The remaining 88 rest on the ledger's `full-read` verdicts plus the mechanical fact that their
   bodies are not identical.
2. Re-verdict the five whose reasoning contradicts their evidence:
   C13 and C15 become one proposal for a Rust error-display macro;
   C617 becomes a code change,
    one handler registered for both events;
   C665 moves out of `STRUCTURAL-IDIOM`,
    because its bodies are identical;
   C639 keeps its dismissal with the reason restated as being about signatures,
    not bodies.
3. Do not propose the error-name base class now.
   The family is large and the change is mechanical,
   but nothing has drifted in 209 sites,
   the change touches 147 files,
   and it adds a dependency edge to published packages.
   The measurement is recorded here so the next reviewer does not re-derive it.
4. Record the family-count query as a recipe in
   `doc/troubleshooting/slopo-threshold-tuning.md` rather than adding a `mise` task or a package.
   A task would need a README,
    tasks and tests under the repository's completeness rules for
   something used a few times a year.
5. Comment the sub-floor coverage-report members on #613 and the third license reader on #633,
   because those two owners lack the information.
   Skip #617,
    #618,
    #621 and #653,
    which already enumerated their families.
6. Give the three held-back `UNCERTAIN` clusters a home:
   C562 joins #660 as an eighth judgement call,
   and C622 and C721 get one focused issue,
   since both are in the quick-lru fork family and neither is tracked anywhere.
7. Copy the review ledger into `doc/artifact/` as a dated record and leave the builders in scratch.
   The ledger is the only per-cluster rationale for 147 proposed suppressions and it currently lives
   outside the repository.
8. Leave `slopo.conf.yaml` and `mise.toml` alone.
   The threshold is hand-tuned and stays at 13.
   The `latest` pin and the stale "increased from default 10" comment are proposed as wording,
   not applied,
   because `mise.toml` carries uncommitted local modifications that are not this work's to touch.

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
- The skeleton comparison normalises identifiers and literals but not operator or keyword choice,
   so it reports sync/async twins as structurally different.
   Those 99 clusters were classified further by hand for the families named in "What I read",
   and the rest were not read at all.
- Site counts are `rg` and index queries over tracked TypeScript and Rust at HEAD on 2026-10-09.
   slopo indexes transpiled `.js` that the repository's blanket `*.js` ignore hides from `rg`,
   which is why build output appears in some duplicate groups.
- Whether a 147-file mechanical change is worth making to prevent drift that has not happened is a
   values judgement about depth against governance,
   so judgement 3 is a recommendation and not a fact.
