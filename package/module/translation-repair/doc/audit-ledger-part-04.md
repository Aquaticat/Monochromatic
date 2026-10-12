# Audit ledger, part 04

Part 04 of [Audit ledger](audit-ledger.md),
whose index lists every part in order.

## History, classes 1 to 92 and before numbering

Notes:
`~/temp/agent/audit-history-1-92/`
(`notes-classes-01-44.md`,
`notes-classes-45-76.md`,
`verify-hashes.out`:
213 cited hashes,
none missing).
Families found there:
narrow fix leaving siblings,
a gate or tie stopping the entry over a valid proposal,
two readers of one text applying different rules,
sheet text contradicting another rule or the code,
a rule's sample wording steering output,
a check placed after the last decision (publish-only),
a decision made without evidence the pipeline holds,
silence counted as a vote,
an enumerated list where a general rule was needed,
a fallback hiding a failure,
missing log context,
slice-by-slice judging blind to page consistency,
a fix introducing a regression,
provider replies misclassified.

### E1: destination loss is caught only at publish, and the refusal names neither destination nor slice

Status:
fixed.
The diagnostic half in `7668c6ce7`;
the remedy in `cc6762f46` (red guard `d8009bfb1`),
following the owner's ruling of 2026-09-27 that a settled page ships with its defects reported.
Every publish-time content check (front matter,
archive original,
contributor names,
destinations,
headings)
now runs through `corpus-run/publish-defects.ts`:
its own refusal becomes a defect that is logged and printed as a `DEFECTS` line beside the tally,
anything else it throws still stops the entry,
and the page ships.
A page that does not parse still refuses.
A page that disagrees with its artifact refused too until the owner ruled the same day that it ships reported
(`page-agreement`,
fixed in `e5bd9a95b`,
red guard `87aa58047`).

Found as:
`corpus-run/publish-fixed.ts` threw after all spending;
no page-assembly pass names a destination;
`corpus-run/destinations-line.ts` and `corpus-run/pass-entry.ts` claim the addresses are in the run log,
false on the refusal path.
XingZ6011 lost 96.3 min to it on 2026-09-26.
The refusal now logs each dropped address with the slices whose original,
archive span and shipped text carry it,
and its message names the source slices.

Measured on 2026-09-27 over the 246 stored artifacts whose carve reproduces,
461 source destinations inside a slice:
302 carried by both the archive span and the shipped text,
151 missing from the archive span and restored by the shipped text,
5 missing from both and dropped by the page,
all from August runs before the either-rendering rule of 2026-09-04
(wangzihao980 slices 3 and 4 written by a lane,
Toka_ls slice 13 left to the archive),
3 missing from both and carried elsewhere on the page,
and none carried by the archive and lost by the shipped text.
So the live failure is an archive sentence without the link shipping,
and a take-back to the archive would never have helped.
Refused entries leave no artifact,
so they are counted from run logs:
seven real entries were refused at publish for one dropped destination each
(luxuanwen3,
Mio,
shi_Yumiaoya twice,
XingZ60 three times),
after 53 to 136 minutes each,
about 10.3 hours in all.

### E2: the reader-protection bullet prescribes "she ended her life" for deaths and attempts alike

Status:
fixed in `e8f0b0369`.
The bullet opens on "a death or an attempt" and its sample says "the page says that she ended her life",
the class seventy-nine shape;
class one hundred twenty-four's later sentence contradicts it.

### E3: stages running their own rounds count unreachable seats in their quorum

Status:
fixed with X8 in `29baade8f` (prep `a107c7486`,
red guards `a6cbd8fc5`,
legacy fixture `78d6540f8`),
recorded as the second 2026-09-27 addendum of `doc/decision/translation-repair-short-bench-share.md` at the repo root.
The review now decides on the reachable share and records `unreachable` in its round;
the reader recomputes the verdict from it and reads a round without it as none out of reach.
The agreement census over the 214 stored pages was unchanged by the reader change (137 agree,
77 disagree,
0 refused).

Found as:
`absolute-naturalness-review-stage.ts` sizes on `modelIds.length`,
so a false "quorum not met" skips the confirmation;
`pair-blocks-stage.ts` and `pair-sections-stage.ts` time their grace the same way.
`reachableQuorum` exists (`stage-reachable-quorum.ts`).
Measured on 2026-09-27 over the 265 stored artifacts:
59 of 4567 naturalness reviews closed `quorum-not-met`,
every one with 2 to 4 usable seats,
an upper bound on the harm,
since a review record cannot tell a seat the router refused from one lost in transport.
XingZ624 shows the shape live:
a review of 5 seats taken over a bench of 8 (a confirmation asks only the discovery's seats)
closed 3 of 5 usable against a quorum of 4,
with `glm-5.3` and Qwen3.8-27B refused as out of budget during it.
The lane contest and both gates decide on two ballots,
so there the bench quorum only drives how long rounds chase seats;
the review alone decides on it,
and its reader recomputes the verdict from `quorumOver`,
so a fix changes the record and the reader together.

### E4: an empty standing with no valid lane text fails at publish, not at once

Status:
fixed,
in two steps.
First in `d9cb910e4` (red guard `d2f0e07ef`),
which made the slice fail at once under the owner's rule of 2026-09-04;
then the owner ruled the same day that such a slice keeps the archive and the page ships
("Keep archive,
ship",
`doc/design-commitments.md`),
fixed in `7f79ada48`,
`002f21f43` and `e7d409fdd` (red guards `4acd8bd40`),
recorded as the eighteenth addendum of `doc/decision/translation-repair-ineligible-standing.md` at the repo root.

Found as:
the `no-standing-text` exit in `consolidate-settle.ts` was the one exit keeping the standing
that skipped `requireShippableTerminal`,
so a slice with no valid proposal anywhere settled with no polish,
and `assertFinalNaturalnessComplete` stopped the entry at persist
after every later slice had been bought.
XingZ60 lost about 3.0 hours that way on 2026-09-22 (slice 89),
on the variant with a lane text on offer that class eighty-seven fixed.
An empty standing passes the rule only over a blank original,
which the pinned corpus never carves (0 of 1259 deterministic slices,
2026-09-27),
and such a slice still keeps nothing.
Since the naturalness check of 2026-08-28,
no stored artifact carries a `no-standing-text` slice;
all 15 that do are from August.

The first step also fixed a vacuous check beside it:
the `incumbent-only` case read its served counter off a return a throw never delivers,
so its "no judge bought" assertion held whatever was bought.

### E5: floor refusals and panel votes the log cannot explain

Status:
fixed.
The reason per panel verdict in `f2cd70ece` (red guard `413a441a0`),
after the owner chose "Reason before vote":
the sheet asks for the reason first and shows it first in the reply shape,
the schema requires it and declares it before the vote,
a missing or blank reason is the finding `missing-reason (n)` while the vote still counts,
every stored panel ballot keeps it,
and the log has one line per ballot beside the issue's decision.
Repair slice cache version 33,
since the sheet is not in the run shape;
no slice had been cached under 32.
Floors and the repair turn in `d69a456de` (red guard `58b993f81`):
the translate floor warns per withheld candidate with the rule's reason,
the consolidation floor names proposals withheld beside survivors (it logged only the all-refused case),
and `repairOneCandidate` logs every branch that changes a candidate's fate,
where it had logged only a taken revision.
The panel in `b8aea8ecf` (red guard `f12a29a3d`,
lint repair `f83c4a6b6`,
see M23):
one line per issue with its status,
severity and every member claim's weights,
where the stage logged only its packet count;
a claim with no tally says so rather than reading as zeros.
Who voted what was already in the artifact (`AdjudicatedIssue.readings`).

Found as:
`translate-produce.ts` returns floor refusals as findings with no log line;
a panel verdict carries no reason.
The second half is a wire change (`PanelVerdictWire` has claim,
vote and severity only),
measured on 2026-09-27 over the 265 stored artifacts:
about 783 panel verdicts per entry (207,394 ballots),
and the reasons other stages' ballots carry average 167 characters.
A reason placed before the vote can move votes,
and no panel bench exists to measure that:
the last panel-sheet change was judged by paired entry runs,
one run per arm
(`doc/audit/the-damage-no-instrument-was-catching.md` at the repo root).

### E6: a malformed archive competes in repair selection as though it parsed

Status:
not a defect in behaviour;
the docs that claimed one are corrected,
and the equality is pinned in `c62aa9ac8`.
`repair-chunk-verdict.ts` passes `UNCHANGED_MEASUREMENTS` with `integrityOk` true,
and that is the honest measurement:
`measurePatchedCandidate` asks whether a candidate is no worse than the archive on grammar downgrades and broken footnotes,
and the repair lane's baseline is the archive itself (`repair-chunk-evidence.ts`),
so the archive against itself is intact however it parses.
The claim came from `selectRepairCandidate`'s TSDoc (`2e2694680`),
which read `integrityOk` as absolute,
as its own field doc did ("still parses",
"front matter intact",
which nothing measures).
The guard in `chunk-measure.unit.test.ts` fails when integrity is made absolute (mutation checked).
A patch that repairs an archive's structure gains no integrity rank for it;
it gains rank only through an accepted issue the checkers find resolved,
which is the lexicographic order as settled.
See M22.

### E7: the sheet-leak label list has fallen behind the sheets

Status:
fixed with F-8;
a fenced block no longer depends on the list.
`translate-sheet-leak.ts` lists seven labels;
`REJECTED CANDIDATE N`,
`WHAT THE JUDGES FOUND`
and `PRIOR FAILED CONSOLIDATION STRATEGY` are fenced but not listed.

### E8: more fixtures paraphrase corpus content

Status:
fixed in `98054d72b` (every file this entry lists rewritten with invention).
`archive-footnote-relabel.unit.test.ts`,
`pair-definition-order.unit.test.ts`,
`coverage-verdict.unit.test.ts` (names from the corpus).

### E9: tests pin roster sizes to literals

Status:
fixed in `87f95d62f` (no provider spelling for two roster models;
the contract's checker floor).
`roster-reach.unit.test.ts`,
`corpus-run/owner-cull.unit.test.ts`.

### E10: the page-name glossary reads raw documents

Status:
fixed in `7a434cb1b` (guard `5640c50e7`).
`page-name-glossary.ts` does no front-matter split and no comment or code-fence masking.
Measured over the 92 pinned entries before the fix:
5 read differently.
Four gained a pair only from an editor's comment or the front matter (two contributor links,
two note lines read as headings),
and windward0032 lost three real heading pairs because a heading-like line inside a comment broke the count alignment.
The glossary now reads `visibleText` (`src/page-visible-text.ts`):
the body with HTML comments,
JSX comments and fenced code blanked.
After it,
raw and masked readings agree on all 92.
Page-name lines are identity context,
which every stage that shows them hashes,
so only those entries re-key.
A mutant reading the raw text fails the guard.

### E11: the retry-wait parser is case-sensitive and knows only h, m and s

Status:
fixed in `7a285b2f2` (guard `041e0a0d4`);
latent.
Every provider refusal in the run logs is Hyper's lower-case h/m/s form.
The parser read the first letter after a number as the unit,
so a glued "500ms" would have read as 500 minutes,
and an existing case pinned "12 minutes" as no wait.
Units are now whole letter runs (ms,
s,
m,
h and their words),
with decimals and joined parts,
in `src/retry-stated-wait.ts`.
A mutant dropping case folding fails the guard.

### E12: the English-original recognizer is a list of exact wordings

Status:
fixed in `f91f561b9` (guard `3d028c76b`);
latent.
The module comment promised that every note read is logged with its reading;
no code logged one (the M20 family).
A note naming an original and English in a wording no mark knows now reads `unmarked-original-claim`,
seals nothing,
since a guessed seal could decline a whole page,
and is warned about by the pass
(`entryArchiveOriginalOf`,
which logs every note's reading).
Over the 92 pinned entries every decision is unchanged,
61 notes are logged,
and the one unmarked claim is hakureico's quotes note,
which names no span and still seals nothing.
A mutant that never reads the claim fails the guard.

### Process mistakes, classes 1 to 92 and before

- A suite called green when red (`e7307d304` for `d70087757`) and a miscounted `[PASS]` total.
- Runs launched on red builds (CuspariaKLSY3 on a real defect;
  others red on fixtures),
    on stale builds (two green runs that never executed the new code),
    or with the wrong roster or entry id.
- Results claimed without reading the output (the owner:
  "You didn't even look at its actual output.")
    and reads that declared no defect where one stood.
- Early fixes committed their tests inside the fix;
    red-first commits start with class five.
- A test file in the wrong shape registered nothing and exited 0.
- A mechanical lint autofix changed behaviour (`92c5192ee`).
- A question put to the owner whose example contradicted its label (class eighty-three).
- Observations recorded and not fixed that later became classes
    (84,
  85,
  75 and 76,
  79,
  67 and 68,
  71,
  106).

## Floor replay over archives and settled pages

Probes:
`~/temp/agent/audit-floor-replay/`
(`replay.mjs`,
`fires.json`,
`classification.json`,
`controls.json`,
`page-checks.json`,
`han-residue.json`).
Archive against itself:
1277 slices,
75 refused;
every settled would-ship slice:
5520 slices,
233 refused,
every true fire from a run built before its floor.

### F-1: the address floor refuses correct English whenever any third-person pronoun appears anywhere in the slice

Status:
fixed;
the floor reads block by block and refuses only a surplus third-person pronoun.
Replayed old against new over 1,264 archive slices and 3,975 would-ship slices
(`~/temp/agent/audit-floor-replay/address-replay.mjs`):
refusals 25 to 13,
none added.
Cleared:
every false refusal named here but lintong s1,
plus Huasheng s3 (an address rendered by name,
no pronoun in its place),
MTF_0615 s8,
Rentable_A s4 and windward0032 s4,
s15 and s18 (omissions the judges read).
Kept:
the person switches (Huasheng s7,
Mizuki_Yuuki s5,
yingying s2 twice,
XingZ60 s110 and s112),
the indirect-speech conversions this finding counted as switches (Xu_Yushu s12,
shihai4h s15),
Xu_Yushu s28 (an omitted quote whose refusal asks for it back),
lintong s1 (the count's limit:
a generic 你 beside a subject-dropped description),
and mikaela_khara s17,
whose would-ship text belongs to another slice (the F-6 carving).
The `thirdPerson` filter in `droppedAddressFindings` scans the whole slice;
the header names 干干你的 as left to the judges and the built floor refuses it.
Also counted as addresses:
迷你,
你们好,
你追我赶,
你我,
generic 你.
False archive refusals:
BI4PBV s3,
Zha_Ke s3 (a vocative),
Y1Ran s18,
Xu_Yushu s15,
lintong s1;
hulicaijia8 and hulicaijia13 had "“Sis!
What's wrong!”
I kept calling out to her" refused.
Fix:
refuse only a surplus of third-person pronouns over the original's own,
and drop the non-address patterns.

### F-2: publication checks cannot re-verify pages an earlier build published

Status:
closed by A16b and A16c,
by the owner's choice rather than by the fix first proposed.
`inArchiveTypography` re-applies today's typography to old artifacts,
so 77 of 209 pages built before class one hundred eighty-one no longer reproduce by splice.
Fix first proposed:
record the per-slice text shipped at publish and verify against it.
Re-measured on 2026-09-27 as 77 of 214 (A16c),
and put to the owner,
who chose that a pass rewrites such pages to the running build's reading.
`verify-published` now names such a disagreement `READ BY ANOTHER BUILD` with both digests,
and a pass resumed in the directory republishes the page,
after which it verifies;
a record proving an old page equals what its own build shipped would serve no reader,
since the page is rewritten rather than kept.

### F-3: no floor refuses a Han name or line left in English prose

Status:
fixed;
the floor in `translate-han-residue.ts`,
the identity flag in `identity-han-items.ts`.
shihai4h2 shipped "Wrong,\n小柿子."
(the archive has "Wrong.");
the identity context shows the archive's untranslated Han alias as the English declaration.
Fix:
a Han-residue floor outside comments,
code,
destinations and attributes,
excusing a parenthesized gloss;
mark a Han-only TRANSLATION value as untranslated.

The floor refuses a run of Han (with any kana and 々 inside it) in the candidate's prose,
read outside `protectedRanges` with comments and title-floor-accepted titles cut.
It excuses a parenthesized gloss,
a kana line with no Latin letter (a Japanese quotation kept beside its English),
and a run the original and the page both carry.
**The floor is relative to the page**,
chosen so the archive's deliberate keeps (the 澪 a name is written with,
Japanese lyric lines,
a hidden line inside an element) do not fail their own slices;
it refuses Han a candidate adds,
not Han the archive already carries from the original.
It runs with the untranslated floor in both the readable and unparseable branches (the F-5 lesson),
and a copied original is named once,
by the untranslated floor.

Measured with a prototype over the census (`~/temp/agent/audit-floor-replay/han-residue-census.mjs`,
`han-residue-prototype.mjs`),
then with the built floor (`han-residue-port.mjs`),
no per-slice delta:
of 1,264 archive slices 14 carry Han in prose and 4 are refused;
of 3,975 would-ship slices 98 carry Han and 68 are refused.
The four archive refusals are one entry's quotations the archive left untranslated
and respelt in traditional characters where the original writes simplified (一抹陽光 against 一抹阳光),
so on those slices the incumbent cannot stand in and a lane must translate them:
chosen,
not overlooked.
Every would-ship refusal matches a house rule:
handles left in Han (小柿子,
锦心,
雨狸,
洁澄天奏 and others),
terms (大证,
贴贴,
药娘),
titles,
a corner-bracketed word,
and the Chinese half of a pair the original gives in both languages.

Two mistakes surfaced on the way,
both fixed.
A bracketed title carrying both Han and Latin letters (《舞萌DX》) fell between the Han title floor,
which reads Han-only titles,
and the Latin title floor,
which reads Latin-only ones,
each header naming the other;
a pin asserted a bare 《Nyan物语》 in English prose valid.
`withoutGlossedTitles` now cuts every glossed title carrying Han,
so a glossed mixed title passes as a glossed Han-only title does and a bare one is refused by the residue floor.
And the first port of the floor iterated a line by code point against flags indexed by UTF-16 unit,
which would have shifted every flag after a character outside the basic plane;
lint caught the spread,
and a guard now pins the alignment.

The identity line now names each TRANSLATION item written in Han alone as still in Han and no English rendering,
item by item,
since the shihai4h value mixes Han items with a Latin one (`小柿子, 猫小泪, u3`).

### F-4: the suicide floor refuses ordinary English and its census counted entries, not slices

Status:
fixed;
an attempt on a life,
a death by one's own hand after a death word,
and an attributed quotation of a published work pass,
and the finding no longer says "she".
Replayed old against new over the same 5,239 slices
(`~/temp/agent/audit-floor-replay/floor-replay.mjs droppedSuicideFindings`):
refusals 11 to 8,
none added;
the three cleared are the correct English this finding names (one phrasing,
one quotation in two builds),
and each of the eight kept drops or blurs the word.
The header's entry census is corrected by the slice replay.
"Died by her own hand" had no replay case;
it is guarded by an invented one.
Refuses "attempts on her own life",
"died by her own hand",
and a canonical English quotation whose Chinese added 自杀;
the message hardcodes "she".

### F-5: a source the strict grammar refuses turns off floors that need no grammar

Status:
fixed for the floors;
the disagreement over `unknown` moves to X10.
The untranslated,
line-count and neutral-pronoun floors run before `unknown` is returned.
`validateTranslatedSlice` returns `unknown` before the untranslated,
line-count and neutral-pronoun checks;
stages disagree on what `unknown` means.

### F-6: `carveSettled` does not carve as the pipeline did

Status:
fixed in `c7f534353` (red guard `83f35d955`),
with A18.
It omits `includeFrontMatter`,
`frontMatterAuthority` and `sealArchiveOriginal`,
shifting slice indices by one on archive-authority entries.
`carveSettled` now carves through `rebuildPreparation`,
which reads every flag off the artifact,
so the probes,
the rendering audit and republishing share one carve,
and it reports whether the carve reproduces the run's rows (the displacement probe warns when it does not).
`includeFrontMatter` defaults to true,
so only the authority and the seal moved a carve;
the guard carves an archive-authority entry,
which the old code sliced with an extra metadata slice.

### F-7: the line-structure floor counts HTML comment lines

Status:
fixed;
content lines are read outside comments and one line reads "1 line".
Replayed (`floor-replay.mjs compareLineCounts`):
refusals 23 to 21,
the two cleared being these slices,
none added.
yulianNyanner s8 and s12 archives refused;
the message prints "1 lines".

### F-8: the sheet-leak floor misses six labels its own sheets print

Status:
fixed with E7;
every fenced header line is refused whatever its label,
and the list gains the missing heads for unfenced copies.
The guard calls the floor directly:
through the composed verdict the added block is refused by the block comparison first,
which hid the gap.
Replayed (`floor-replay.mjs sheetLeakFindings`):
no refusal before or after,
so the fence rule refuses no page text.

### F-9: the neutral-pronoun floor never reads the original

Status:
fixed;
the floor takes the original and asks only where it writes TA,
Ta or ta.
Replayed (`floor-replay.mjs neutralPronounFindings`):
the same four refusals before and after,
each on an original that writes the pronoun;
the false ones were constructed controls,
now guarded.
"The TA graded the cat's homework."
(助教) and "Ta!"
are refused.

### F-10: `assertHeadingsStayDistinct` goes silent when heading counts differ

Status:
fixed;
a page heading repeated more often than the original repeats any heading refuses whatever the counts.
Measured (`~/temp/agent/audit-floor-replay/heading-replay.mjs`) over 92 archive pages and 213 fixed run pages:
only yuliannyanner3 refused,
as before.
A first version counted one heading as a repeat and would have refused yingying's archive and 12 runs
(an added heading on an original with none);
caught by the measurement before commit.

### F-11: the glossary floors refuse a glossed Han title the title floor allows

Status:
fixed;
the glossary floors read the candidate with the accepted title occurrences cut.
Latent:
no replayed slice carries such a title,
and the community floor adds no refusal.

### F-12: low items

Status:
the first two fixed;
the plausible pair measured and closed,
no gap in the current build.
`ArchiveOriginalCompletenessError` stores neither entry nor span;
the declared-link floor refuses Zhihu @-mentions the archive rendered as the user's slug;
owner,
2026-09-27,
"Account handle":
an @-mention of a declared person may carry the account handle the page writes under the same link.

The error now carries `entryId`,
`spanIndex`,
`startOffset` and `endOffset` as fields,
and its message the offsets (guard shown red with one field unset).
The declared-link floor passes a rendering whose link text,
under the href of an original @-mention of the declared person,
carries an @-handle the page writes under that href,
and its finding offers the handle;
a link naming the person without a mention still owes the declared form.
Measured through the composed verdict:
the GLaDOSister s8 and Kotori s8 archives went from refused to passing;
zhangyubaka s18 is refused first by the suicide floor,
one of its eight kept refusals.

The plausible pair,
read from the code:
a lanes-agreed text is the translate lane's delivered text,
which is a candidate `translate-floor.ts` passed
through `validateTranslatedSlice` with `lineStructured`,
`declared` and `disputedWordings`,
and then only the semantic wrap,
which splits prose lines,
never joins them,
and skips governed slices;
a repair-lane text ships otherwise only through the contest verdict (line structure read since H2)
or the consolidation's `readStandingVerdict`,
both of which call the floor.
So the repair lane not calling `validateTranslatedSlice` leaves no unfloored path to the page.
Re-flooring every would-ship wording of the settled artifacts with today's floors
(`~/temp/agent/audit-floor-replay/refloor-by-decider.mjs`) refuses 163 of 1,961 contest winners,
51 of 853 consolidations,
11 of 269 lanes-agreed texts,
82 of 909 polishes and 7 of 163 page-assembly rows;
those artifacts were written by builds before the floors this audit added or tightened,
so the numbers measure how far the floors moved,
not a live gap.
Plausible,
unproven:
nothing re-floors a lanes-agreed would-ship text,
and the repair lane never calls `validateTranslatedSlice`.

## Test suite

Probes:
`~/temp/agent/audit-tests/`
(a runtime harness logging every `expect` that runs,
`scan-corpus.mjs` and `classify-hits.mjs` for corpus text,
`run-container.mjs` for load runs,
`magic-*.tsv`,
`untested-dist-functions.tsv`,
`coverage-holes.txt`).

### T1: an assertion that never runs

Status:
fixed in `9603ff7a8`;
shown to fail with chunk inheritance disabled (3 of 4 slices governed).
`document-preparation.unit.test.ts` "inherits the line-structure verdict from the enclosing CHUNK":
its loop runs zero times,
because the verse fixture is too short to subdivide.

### T2: vacuous checks and catch-only asserts

Status:
fixed in `75900e601` (oxlint does not flag an unused `using` binding),
`5955c9d8e` and `38f59b737`.
32 `expect(<using binding>).not.toBe(undefined)` on disposables that are always objects
(`writer-grace-override`,
`corpus-run/slice-overlap`,
`grace-override`,
`corpus-run/pass-entry`,
`corpus-run/artifact-pool-names`);
`assembly-content-survival.unit.test.ts` has no boundary case for its six-letter floor or its two-use cap;
`prompt-uniqueness-client.unit.test.ts` asserts only inside `catch`.

### T3: tests pinning wrong or retired behaviour

Status:
fixed in `36c3576e0` and `07b88949e`,
with S6 (`e7e3f9c17`) for the silent-original test;
checked on 2026-09-27:
no test named here still claims a stopped entry or the owner's whole handle rule,
and the behaviour gap the restore test pinned is A17,
fixed at the floors in `7ec9669bd`.
The two standing tests are renamed to what they assert;
the restore test no longer claims the owner's whole rule,
and the behaviour gap it pinned is A17;
`dropped-covers-the-page.unit.test.ts` moves with S6.
`dropped-covers-the-page.unit.test.ts` pins the silent-original wording of S6;
`corpus-run/contributor-name-restore.unit.test.ts` pins handle restorations
that drop the literal gloss the house rule requires,
under a name citing the owner's "with the literal translation in parentheses";
`consolidate-gate-wire.unit.test.ts`'s class fifty-six name still says a kept standing would stop the entry;
`consolidate-standing-verdict.unit.test.ts` names "still stops the entry" and never asserts it.

### T4: corpus text and real personal data in about 45 test files

Status:
fixtures fixed in `98054d72b` (58 test files).
A rescan on 2026-09-27 (`~/temp/agent/audit-tests/scan-corpus.mjs`,
previous hits kept as `*-before.json`)
left shared markup,
public facts,
glossary entries that are dictionary terms by design,
and corpus quotes in comments and test names that cite an incident
(for example `name-gloss-restore.unit.test.ts:3`,
`owner-cull.unit.test.ts:4`);
those wait for the owner's sanitization pass after the project.
A real birth date and hometown,
a suicide-site sentence,
method sentences,
self-harm scars,
real names,
handles and entry ids,
and verbatim or near-verbatim corpus lines,
many under a header claiming "no corpus content appears here".
`package.json` `files` includes `src`,
so the tests would ship with the package.
The owner said sanitization of the repository comes after the project;
the fixture rule (cat-themed invention) stands,
so these are fixed as fixtures.
