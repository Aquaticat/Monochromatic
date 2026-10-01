# Status

Part of [the package README](../README.md).

## Where the whole-package audit stands on 2026-09-27

The owner asked on 2026-09-27 for every mistake ever made in this package to be found,
fixed and recorded,
with no finding too small;
the findings,
their fixes and the process mistakes (M entries) are in
[the audit ledger](audit-ledger.md),
and the owner's rulings in [the design commitments](design-commitments.md).
No corpus run has been launched since the audit began:
the next is TianqiChen666,
started only once no fix is still owed before it.

Landed late on 2026-09-27,
each with a guard shown red first and the full suite green after:

- A slice with no valid wording keeps the archive and the page ships,
  reported on the `DEFECTS` line
    (owner,
  "Keep archive,
  ship";
  ledger E4).
- A page that disagrees with its artifact ships with the defect reported (owner,
  "Ship with defect reported").
- The windowed stages and the naturalness review size their quorum on the seats that could answer,
    a confirmation's unaskable seats counted out of reach (owner,
  "Count as out of reach";
  ledger E3 and X8).
- Every floor refusal,
  repair-turn outcome and panel decision reaches the run log,
    and each panel verdict gives its reason before its vote (owner,
  "Reason before vote";
  ledger E5).
- A Han signer left in Han or romanized with no literal meaning is refused (ledger A17).
- E6 was a documentation error:
  integrity is relative to the archive,
  now said and pinned.

Cache versions:
translate 15,
consolidation 20,
repair 33.
All three moved on 2026-09-27 past changes that had not moved them (ledger M25);
nothing had been cached under the versions they replace,
so nothing was discarded,
and every slice the next run buys is bought under today's rules.

The reason-before-vote change is measured at TianqiChen666:
its panel support rate (supported votes over all panel votes) against TianqiChen66620's,
one run per arm as `doc/audit/the-damage-no-instrument-was-catching.md` at the repo root compared the last sheet change,
with the direction,
not the size,
as the evidence.
The baseline,
read from TianqiChen66620's slice cache (it settled no artifact):
270 of 464 panel ballots supported,
58.2%,
over 110 issues in 36 of its 110 cached slices.
A drop of the size that change caused (72% to 65% on one entry) is reported to the owner with the reasons it cites.

Still open in the ledger on 2026-09-30 (UTC),
read off each entry's status line:
T8 (code no unit test runs,
measured by block coverage mapped to source lines,
which the next launch waits for;
B30,
B31 and B32 closed on its way,
so `src/dead-code.unit.test.ts` now fails on any function,
class or value production does not reach,
and `src/unused-imports.unit.test.ts` on any import nothing reads.
Every census is taken on an unminified build,
since compressed code folds unreached guards into expressions coverage gives no range (ledger M79).
The first batch tests the census's own placement (`5e27208c7`),
and the census names a claimed source its baseline holds no stretch in (`297c72fd5`);
the second to fifth batches took the naturalness review,
polish,
and contest,
lane,
comparison and consolidation readers,
then the comparison,
coherence,
digest and identity modules (`a564eccc7`,
`09b76e1b4`,
`74387b886`,
`fc9e80ca8`).
The sixth batch took the translate modules,
73 stretches in 28 files,
and closed every one
(`62ad2c084` to `0fcb75c7b`;
the ledger's T8 entry accounts for each commit),
finding and fixing B35 to B42 on the way.
Each batch takes one cluster of the triage and ends with a whole-suite census at its committed head,
which becomes the next batch's baseline.
B43 and B45 landed after that batch,
and the seventh batch took the repair modules,
46 stretches in 17 files,
and closed every one
(`da99d5b69` to `06f231981`),
leaving none of its own making.
The eighth batch took the consolidation modules,
55 stretches in 17 files,
and closed every one
(`62a745069` to `0fba3dea4`),
finding and fixing B46 to B52 on the way:
a ballot's findings read the same way in every contest,
so their shape never costs a voice (B46),
two dead variants gone with their guards (B47 and B52),
a polish round that no longer buys refiners for a slice nothing can check (B48),
a withheld slate's absence exit replaced by a named code-fault error (B51),
standing flags that no longer default to shipping (B49),
and a test named for an exit its input stopped reaching (B50).
The ninth batch took the corpus-run passes,
31 stretches in 16 files,
and closed every one
(`b7cab3bbb` to `51b888ac2`),
finding and fixing B53 to B55 on the way:
the schema guard no longer advises deleting a non-artifact as another schema generation (B53),
the preparation's own findings reach the artifact (B54),
and definitions already in order draw no reorder note (B55).
The tenth batch took the corpus-run title modules,
26 stretches in 4 files,
and closed every one
(`7e3772ba8` to `95ca288cd`),
finding and fixing B57 to B60 on the way:
a page link that lost its opening bracket no longer takes a footnote line or another link into its text (B57),
a glossed title keeps the words leading into it and a longer glossed run is reported (B58),
the link search reads the page link at the title link's place and every gloss is read (B59),
and a title two headings render alike is unified with that rendering (B60).
The eleventh batch took the alignment modules,
26 stretches in 5 files,
and closed every one
(`c5fd0b03e` to `791bc45fe`):
the alignment tables read their cells without falling back,
and an empty block's length fit is cased.
Its census found B61 and B62,
both fixed since
(`48c580d16` to `4304d167d`):
the census reading now names each stretch cold since its baseline,
including one in a source added since,
and asks git about every file of the work tree,
read NUL-separated,
since it reads other packages' sources too.
The twelfth batch took the corpus-run artifact modules,
26 stretches in 8 files,
and closed every one
(`21d3654d5` to `99eed862e`),
finding and fixing B63 and B64 on the way:
a draw's sample manifest names the pool's build again,
where every real draw had recorded none (B63),
and every reader of an artifacts directory lists regular files named `*.json` through one module,
where four took a directory or a symlink named like an artifact as a settled entry (B64).
B65 followed from B64's open question and is fixed
(`e987110a1` to `6583c32c4`):
every reader of a run directory lists through `directory-listing.ts` and takes only the kind of entry its writer makes,
so the ledger report no longer reads the atomic writer's temporary files as contests
and a stray file in the published tree no longer stops the verifier,
and a source scan refuses any other listing.
The thirteenth batch took the lane modules,
21 stretches in 7 files,
and closed every one
(`da74173a1` to `de9ced3f0`),
finding and fixing B66 on the way:
the lane's coverage refusals and the contest log give each count the word it takes,
where a repeat read "under 1 distinct indices";
the rest of that family is queued as one change.
The fourteenth batch took the insertion modules of `corpus-run`,
21 stretches in 7 files,
and closed every one
(`1af921d31` to `bc15e9a28`),
finding and fixing B67 on the way:
the block deficit cuts a container's half at the container's own tag,
where a search for the tag's text could land on a whole element of the same name beside it.
Its census (`census-o4RZ7w`,
1,466 passes,
taken from a tree with nothing uncommitted)
leaves library source at 805 stretches over 1,636 lines in 293 files,
with 17 functions never called.
B68,
found in the same file,
is fixed too
(`8ec62ce62` and `19eb118ab`):
the deficit counts a container's blocks off the parse rather than by blank-line split,
and a passage costs what the container counted for its slice.
The fifteenth batch read against the whole suite at `19eb118ab` (`census-VmhQQH`,
1,467 passes)
and took the prompt modules,
20 stretches in 2 files,
closing every one
(`2d3b02c45` to `f7838ffb3`)
and finding and fixing B69 on the way:
each refusal of the prompt payload store now names what refused,
where one sentence served every check and a tally line could not tell a corrupted record from a format change.
The prompt digest's keys now sort by code unit rather than by the host's locale,
with every digest the scratch comparison tried unchanged.
Its census (`census-OGAQiJ`,
1,468 passes,
taken from a tree with nothing uncommitted)
leaves library source at 785 stretches over 1,593 lines in 291 files,
with 17 functions never called.
The sixteenth batch took the pairing modules,
19 stretches in 9 files,
and closed every one
(`b0924bd4d` and `c2974bea9`):
arms no input reaches went,
a definition's label is no longer dropped from the relabel unsaid,
both pairing readers narrow their catches through a `require<Class>Refusal` helper,
and the reachable rows,
among them a short bench on each pairing stage,
have cases.
Its census (`census-PgyHZ8`,
1,470 passes,
taken from a tree with nothing uncommitted)
leaves library source at 766 stretches over 1,554 lines in 282 files,
with 16 functions never called.
A fold in `pair-sections-steps.ts` copied its answers so far at every step,
a shape no scan read,
and reading the package's folds for it found B70
(`42d7a0f08` to `66b77b040`):
seven folds and loops copied a list that grows with the input,
four splices wrote text one edit at a time,
and one of those,
the italic-title pass,
cut a title quoted inside a quoted title one unit late,
taking the mark after it.
The lists now grow by appending,
the splices write in one pass (`spliceDisjointEdits`),
and `fold-copies.unit.test.ts` fails on a new fold that copies.
One finding from reading that pass,
a quoted title inside an emphasis span rewritten into italics nested in italics,
is closed by B72.
Its census (`census-DapwaX`,
1,472 passes,
taken from a tree with nothing uncommitted)
leaves library source at 765 stretches over 1,547 lines in 282 files,
with 15 functions never called,
and by the first construct
(`t8-triage-dapwax.txt`)
three clusters still tie at 18 stretches,
so the seventeenth batch took the one with the most cold lines,
the slice modules
(`slice`,
18 stretches over 112 lines in 7 files),
and closed every one
(`774710cb0` to `3bc823c13`):
arms no input reaches went,
among them a one-slice fallback no aligned pair reaches and a helper re-reading a decision the delivery had already proved,
the reachable refusals and a textless picture have cases,
and the refusal cases in both slice test files now assert each refusal's structured fault rather than its class or a fragment.
B71 closed on the way:
the slice-cost reader read an empty count as 0 and hexadecimal,
exponent and signed spellings as numbers its writer never writes,
and no stored pass log carries one.
Two families were found beside it:
elapsed times measured on the wall clock where a monotonic one is meant,
closed by B78,
and the package's other number reads from text,
closed by B73.
Its census (`census-vi1FHB`,
1,472 passes,
taken from a tree with nothing uncommitted)
leaves library source at 747 stretches over 1,435 lines in 275 files,
with 15 functions never called,
and by the first construct
(`t8-triage-vi1fhb.txt`)
two clusters tie at 18 stretches,
so the eighteenth batch takes the one with the most cold lines,
the archive modules
(`archive`,
18 stretches over 36 lines in 9 files);
the runner entry files and unloaded bundles come after the library.
B72 closed before that batch
(`db01484f7` to `3429c8229`):
the italic-title pass read the archive's italics by splitting each line at its stars,
and wrote a quoted title in italics inside an italic span;
it now reads both off the parse,
with comments masked,
and leaves a title inside italics quoted.
Measured over the pinned corpus first,
the change alters no current output.
Its census (`census-apleN5`,
1,475 passes,
taken from a tree with nothing uncommitted)
leaves library source at 746 stretches over 1,432 lines in 274 files,
with 15 functions never called,
and leaves the archive modules as they were.
Readers moved into modules of their own now get unit tests of their own in the same change,
and a scan for the 167 shared modules without one is open (ledger M88).
B73 closed before the eighteenth batch too
(`51dc87e82` to `93a0d06b1`):
the package's number reads from text took spellings no writer here writes,
an empty count as 0,
a hexadecimal or exponent spelling,
a sign,
a digit run past the exact range,
and a log stamp without its zone as local time.
Each now reads through a rule held to its writer's spelling
(`whole-number-text.ts`,
`iso-stamp-text.ts`,
or a round trip through the writer),
an operator's dials and flags through the same rules,
and `number-reads.unit.test.ts` fails on a new read until it names its rule.
Measured first,
no stored log record reads differently,
and of the stored provider listings only OpenRouter's `-1`,
a price it does not quote,
now reads as not listed rather than as a negative price.
B74 closed on the way:
five loops that grouped or queued by key,
the cap census's queue among them,
set a map entry to a copy of what it held at every repeat,
and they append in place now,
with `fold-copies.unit.test.ts` reading the shape.
B75 closed before the eighteenth batch too
(`6035e9b03` to `5a3e38037`):
every runner found its own flags as exact tokens,
so `--cap=0`,
a mistyped flag,
a second `--only` or an argument to a runner that reads none
read as not written.
Each runner now declares its line in `corpus-run/command-lines.ts`,
and `reportingRefusals` reads the whole line against that before the runner starts,
refusing every problem at once with a usage line;
the table,
the task descriptions and the living docs' invocations are held to each other,
and `command-line-reads.unit.test.ts` fails on a read of the line anywhere else.
B76 followed
(`28cbadd6a` to `4f9b79155`):
an `--only` naming an entry a runner cannot reach,
alone or beside real ones,
was dropped without a word,
so the runner ran over nothing or over the rest;
`askedAmong` now refuses the line,
naming every stray,
and `sentinel-probe` holds its ids to the corpus too.
B77 followed
(`f0322ce6f` to `2293b0ded`):
plain-object tables looked up by text from outside the package answered the names every object inherits,
so a stream delta,
an asset name,
a stored status or disposition,
or an entry id spelled `constructor` or `__proto__` read as a prototype value,
and a `__proto__` count was never written.
Every table looked up by text is now a map,
every record filled by a key a map until it is handed on,
and `text-keyed-tables.unit.test.ts` fails on a new one.
B78 closed the last family open before the eighteenth batch
(`a3f1f2c55` to `e2b0962fd`):
durations,
holds,
paces and budgets were differences of system-clock readings,
which setting the clock moved by the hour it was set.
Every difference inside one process now reads `monotonicMs`,
the system clock is read only as a stamp,
and `wall-clock-reads.unit.test.ts` fails on a new read of it as a number.
On the way,
the stub its red cases used replaced `Date.now` for the whole test process
while module-test ran other cases beside it,
and a guard-off hung a file rather than failing it;
the stub now holds the clock for its own case only (ledger M100).
The package's 29 other test files that replace process globals were open as a family then;
they change tests only,
so the census taken next is the eighteenth batch's baseline,
recorded under each entry it closes.
B79 closed that family after the census
(`b9edc1542` to `cf17f1dd0`):
13 of those files wrote an environment variable,
a `console` method or the working directory in suites that ran their cases at once,
where a restore finishing out of order could leave a sibling's value set;
each such suite now runs one case at a time,
and `global-writes-sequenced.unit.test.ts` fails on a write outside one.
That census (`census-dKGOhZ` at `36e3f36cc`,
1,500 passes,
taken clean)
leaves library source at 730 stretches over 1,404 lines in 274 files,
with 15 functions never called;
of the 36 sources edited since the last baseline,
only `corpus-run/command-line.ts` gained cold code,
two usage-line arms no case prints,
which join the eighteenth batch on the archive modules.
Each throw and fallback is read for reachability first,
and an unreachable one is removed rather than tested.
B33 and B34 closed on the way as well:
every artifact refusal reason the B33 census read now reads as what the reader expected,
and a marked refusal carries a caught error's text only from a catch narrowed to marked classes,
which `message-names-only.unit.test.ts` now checks at every construction.
The census reading leaves sources edited since its baseline out of its counts,
since it matches stretches by line (`d27a89dd0`).
Holding the launch for T8 is a quality call recorded for the owner to veto,
and these counts are the size of what it holds the launch for),
T9 (every test run writes a log into `node_modules`,
owned by `module-logger`,
issue #576),
and L6 (the lane contest on insertion slices,
designed and deferred past the next launch);
M1,
M6,
M51,
M57 and M59 recur.
Every other finding the ledger names is fixed,
measured and decided,
or ruled on by the owner.
The mistakes are grouped by family,
with the checklist before a run launches,
in [Preventing this package's mistakes](mistake-prevention.md).

## Where it stood on 2026-09-24

The sections `Milestone and generation history`,
`Superseded consolidation cache generation 14 operation history`
and `Terminal quality-refusal audit, 2026-08-29 (superseded)`
are history and stay as evidence.
The current operating state is kept in the handover
(`doc/handover/translation-repair-handover-2026-09-06.md`,
"2026-09-24,
04:30 UTC" and "What to do next")
and every read page in the pass log
(`doc/planning/translation-repair-openrouter-2026-09-03.md`).
In one paragraph:
the corpus pass runs one entry at a time from a frozen copy of the built `dist`
on whichever providers are wet (Bedrock and OpenRouter on 2026-09-24,
Synthetic dry for the week,
Hyper dry),
with eight roster seats after the 2026-09-24 cull,
overlap 8,
and the seven-hour entry ceiling;
each shipped page is read by the seven steps and the three checks before the next entry is launched;
one hundred ten defect classes have been found on read pages and fixed with guards shown red first;
the pipeline is not production ready by the rule in `doc/planning/translation-repair-readiness-signal.md`
(a class is still found on roughly every other read).

## Milestone and generation history

Milestone one (detection) is complete:
the seven-critic ensemble reached 0.981 recall on seeded errors over the reference corpus,
gated by the seeded-error benchmark harness
(`runCriticBenchmark`,
which no runner called by 2026-09-29 and which was removed then,
ledger B30;
the recall benchmark measures detection now).
Read that figure with its date attached.
It was measured on 2026-07-17 over 54 seeds against a roster of seven models,
and that roster no longer exists:
the provider has since withdrawn two of them and offered one replacement,
so six critics run today.

A re-measure on 2026-08-10 detected 24 of 27 planted omissions,
a rate of 0.889,
over nine entries balanced across the three size bands,
with zero policy declines,
so all three misses are critics failing to see a seeded omission
rather than the panel correctly ruling one a source defect.

That figure is **not** the configured roster's recall,
and the run says so itself.
One model returned schema-invalid output 312 times across five roles during it,
and the critic stage never once reached its full roster:
72 chunks ran at five voices of six,
eight at three,
and one at none at all.
So 0.889 describes what the pipeline delivered while one of six critics was effectively absent.
Read it as a measurement of a degraded ensemble,
which is a real and current operating condition rather than a spoiled run,
and not as evidence about the roster as configured.

Do not read it against the milestone-one figure as a regression either.
The two runs differ in roster,
entry set,
seed count,
and several stages,
so no delta is attributable to any one of them,
and 24 of 27 against 53 of 54 is not a statistically established difference (two-proportion z of about 1.8).
All three misses also fall in a single entry,
which went 0 for 3 while the other eight went 24 for 24,
so the sample is one entry failing rather than a uniform detection rate.

Milestone two (repair) is complete:
the full loop (critics,
claim aggregation,
adjudication panel,
editable envelopes,
editor through a deterministic apply gate,
resolution checkers,
lexicographic candidate selection)
reached a probe-adjusted effective restoration rate of 0.98 over 100 seeded omissions across 21 budgeted live runs,
graded by a source-anchored bilingual restoration judge (three judge models,
conservative lower-median verdict).
Misses are attributed,
never averaged away:
a derivability probe rules whether each missed seed's information was fully derivable from the source at all,
so embellishment-capped partials and correct refusals of underivable content are excused,
and only genuine editor shortfalls count against the editor.
The one reproducible shortfall class
(long omissions restored compressed) drove a rule now promoted into the baseline editor prompt:
enumerate the omitted source sentences clause by clause.

Milestone three (detection precision) is **not** met.
Its gate is human-graded precision of at least 0.9 over a stratified sample of accepted issues.
Round three was graded on 2026-08-12 and returned 0.791 strict,
0.810 excluded,
and 0.814 lenient over 43 gradeable items drawn from a pool of 740 across 18 settled entries.
All three readings improved on round two's 0.740,
0.787 and 0.800,
and none reaches the bar.

Round three also found a defect in the sampling instrument itself.
Seven of the 50 drawn items repeat a defect already drawn at an earlier position,
which the grader marked `Duplicate` and the blind pre-grades had independently annotated the same way.
A duplicate is now its own verdict,
excluded from every denominator,
because the pipeline reporting one defect several times is a different failure
from reporting a defect that is not there,
and only the second is what precision measures.
Counting them as false positives had dragged strict to 0.680 while every other reading rose,
which described the instrument rather than the detector.
Read the milestone-two figures as recall claims only:
they say the ensemble finds seeded defects,
not that what it reports is right.
Nothing here should be taken as evidence that an accepted issue is a real one until this gate is measured and passes.

The **repair** half is not fit to be measured yet,
and that is a finding rather than a gap in the schedule.
Round three's repair sheet was deliberately left ungraded:
reading it showed repairs that fix their claim while deleting nearby source-supported content,
including a contributor credit removed by an edit asked only to change a colon,
and 21 of 50 edits replacing a span more than 1.35 times the quoted defect.
The introduced-defect probe,
which exists to catch exactly that,
reported no finding from any prober on every one of those repairs.
So a shadow-mode probe reading clean is currently false assurance,
not evidence,
and repair quality claims should be read as unestablished until that instrument is fixed.

Every milestone figure in this section comes from a graded measurement rather than a self-report.
Where a stage grades itself the figure is named as telemetry and excluded:
`runIntroducedDefectProbe` ships in shadow mode for exactly that reason,
and the checker stage's resolution rate is a stage self-report,
which is why repair quality is graded on its own human sheet instead.

Status on 2026-08-26.
The whole-package audit closed on a measured tally and every major and minor finding it filed landed with a guard shown
to fail when its fix is removed.
The production readiness signal was then put to the owner and rejected,
because the published pages had not been read by anyone:
"Not yet.
You didn't even look at its actual output."
The pipeline is not production-ready.
Reading is now gate,
and one page passing that gate validates only artifact from that run,
not package or pipeline.

Fixed-build `Toka_ls` under overlap 4 and 300-second grace produced page with no blocker or major,
but same run still exposed systemic unresolved path:
contest can decline archive and settle on neither lane,
consolidation then records `no-standing-text` and buys no third rendering,
while final assembly revives archive.
One slice reached that path after 9 of 10 contest voices called archive flawed.
A favourable page does not close mechanism that can recur on next entry.

Fixed-build overlap-4 `Zha_Ke` exposed a separate readiness blocker.
Source Markdown carries central letter only as image asset,
while archive carries English transcription inside unmatched block.
Artifact and image share pinned corpus commit `a41fc607ea5a70d8a7625cc67d5ed8c444f53379`.
Preparation paired four source Markdown blocks,
one being image placeholder,
and explicitly reported two target blocks,
3,672 characters,
as unclaimed.
No quality lane processed those blocks as source-aligned content.
Final page's 3,673-character details block is byte-identical to archive.
Direct image comparison found source will has seven numbered provisions while published transcription has six;
one provision is absent and two others materially change source meaning.
Those differences concern wishes and responsibility,
not protected suicide method or drug detail.
Published central letter also retains repeated grammatical defects.
Mechanical page verification still passed all four promised wordings and destination,
so current completeness gate is blind to visual-source content and unmatched archive text
even when alignment names unclaimed target blocks.
Page is not publishable and pipeline cannot be production-ready until that path is handled.
Static pinned-corpus inventory found 50 source entries with visual references.
Three have English-only details blocks absent from source Markdown:
`Chinatsu_Suzuki`,
`Zha_Ke` and `shihai4h`.
This proves bypass pattern is not entry-unique;
it does not establish which remaining visual assets contain source text.

Same-digest `Zha_Ke` overlap pair at built-in grace confirms performance mechanism,
not readiness.
Both providers were wet throughout both arms.
Overlap `1` took 129.95 minutes over 4.862 call-hours,
normalized `0.445`,
with 68 voices unheard and 25.27 metered credits.
Overlap `4` took 36.49 minutes over 2.947 call-hours,
normalized `0.206`,
with 6 voices unheard and 44.55 metered credits.
Overlap `4` reduced wall time 71.9 percent and normalized wall 53.7 percent;
metered spend rose 76.3 percent.
Both pages retained byte-identical blocked details transcript,
while surrounding wording differed stochastically.
Both are mechanically complete and neither is acceptable production output.

Fixed-build matched `Weideriche_` pair exposed a liveness blocker.
In both fresh roots pairing roster heard all 10 voices,
contested same source block,
and committed same pairing without it.
Preparation therefore made source-only insertion,
although archive carries passage in neighbouring target slice.
Coverage refused duplicate insertion,
translation left slice unfilled,
and publication guard correctly wrote no artifact or page.

Overlap `1` first attempt took 54.04 minutes over 2.293 call-hours,
normalized `0.393`,
with 15 voices unheard and 13.02 metered credits.
Overlap `4` first attempt took 31.51 minutes over 2.502 call-hours,
normalized `0.210`,
with 10 voices unheard and 30.92 metered credits.
Both providers were wet throughout.
Overlap `4` reduced wall time 41.7 percent and normalized wall 46.6 percent;
call sum rose 9.1 percent and metered spend rose 137.5 percent.
Automatic retries reused cached pairing and reached same refusal.
Safe refusal is correct;
persisting contested alignment with no path to re-pair means entry cannot settle under this generation.
This is settlement-progress failure,
not process nontermination.
Repair must preserve contested source block and candidate targets as unresolved relation,
then run bounded targeted re-pairing while retaining attempt evidence.
It must not relax coverage or publication guard;
adjacency alone does not prove two target blocks may be merged.

Current nine-model validation on 2026-08-28 settled `Weideriche_` under production overlap `1`.
Its block record carries eight source blocks and nine target blocks across nine monotone relations,
including one source block paired to two adjacent target blocks.
No archive block remained unclaimed,
three slices settled,
and publication wrote artifact and page instead of repeating prior unfilled-passage refusal.
Mechanical verification matched one artifact to one page,
with all three promised wordings,
expected 919 characters,
and source destination retained.
Both providers were wet on all 25 meter readings and no seat stayed dark.
Body reading found the published wording restores source's non-binary older-sister wording,
care for injured people,
positive period of life,
memorial facts,
and contributor destination without reintroducing archive pronoun claim.
It still has body-level naturalness defects,
including strained emotional-deprivation wording and calqued descriptions of facing life and suicidal ideation.
More importantly,
whole-page reading failed publication:
target front matter still names entry id instead of source person's declared name,
and build script uses that `name` as visible localized list metadata.
This is inherited archive defect on the front-matter path,
not settlement regression.
Affected-entry evidence validates progress on that liveness blocker through settlement and publication only;
general pipeline closure still requires seeded recontest evidence and current-build front-matter rerun.
Unit guard now proves contested pairing is not cached,
second attempt is actually bought,
and recovered one-to-many split becomes cacheable.

The front-matter path is implemented after that reading and remains under live validation.
Visible YAML metadata is explicit syntax-bearing slice zero in artifact generation 5;
repair and naturalness lanes emit deliberate no-op rows,
while translate ensemble,
contest,
consolidation,
and final gate receive source-authoritative metadata rules.
Candidate and final-page guards require parseable target-compatible YAML shape,
exact metadata slice placement,
and non-incumbent result when source and archive metadata differ.
Preparation identity generation 2 distinguishes current metadata-aware slicing,
while generations 2 through 4 rebuild under legacy body-only identity generation 1.
A full synthetic pass crosses translation,
contest,
consolidation gate,
artifact parser,
and page persistence.

Fresh `b716eb99e` validation reached four slices and all nine active seats,
but correctly published no artifact or page.
The translate lane produced changed metadata whose visible name followed source identity,
then lane contest selected the unchanged repair metadata.
Consolidation produced another changed candidate,
but its final gate restored exact incumbent metadata.
The final guard refused that output as `incumbent-fallback` on three attempts;
subsequent attempt stalled because invalid contest and consolidation decisions had become cache-terminal.
This confirms final refusal but not live closure of the front-matter path.
Candidate validation now preserves source `name` and `info.alias` identity equality,
contest winners that fail publication invariants remain retryable,
and consolidation standing text must pass same syntax guard before unchanged result becomes resumable.
Final-page validation applies same source identity relation even when page differs bytewise from archive.
Since `cbedea357` (2026-09-16) the package again holds only what a pass or a probe reaches.
The sessions of 2026-09-10 to 2026-09-15 added a provider-free layer of 143 modules (archive naming,
a container runner for a "producer input" comparison,
preparation attempt,
receipt,
root and selection records,
a persisted-input DTO reader,
request capture) that no build entry reached and no pass used;
it is removed with its tests,
its three build entries and its bootstrap and sealed rolldown configs.
The pass-path additions of those sessions stay and are described in the paragraphs that follow.

Since `34e5c7ecd` (2026-09-02,
owner's decision in `doc/decision/translation-repair-front-matter-guard.md`) the final guard is structural only:
the metadata slice sits at slice zero over both sides' front-matter bytes,
the page parses,
the identity and attribution rules hold,
and the page's visible name is not the directory id where the source names the person differently (`directory-id-name`,
checked on the assembled page whether or not it equals the archive;
since `6d85b619a` a handle that is the name in both languages,
as for 8 of the pinned corpus's 92 entries,
passes).
The owner delegated the verse remedy after rejecting the guard-first approach.
Since `1a6ebbf62`,
writers receive parsed explicit-break facts before generation,
and selectors receive the same rendered-line contract with counts matched to their actual anonymous slate.
Author repair inherits that contract;
lane comparison and consolidation use it too.
It distinguishes visible breaks from soft newlines and recommends unambiguous `<br/>` spelling.
Canonical source,
archive-backed layouts and ordinary-passage prompts are unchanged.
Since `b3113164a`,
initial source-only writers also see actual Markdown break syntax displayed as `<br/>`.
Only parser-confirmed break spans change in that view;
canonical text and offsets remain untouched.
The caller must explicitly establish an absent incumbent,
and metadata and nonempty archive wording are excluded.
The measured source-spelling treatment gave both probed writers five breaks without a trailing break,
where Mercury had still flattened its initial output under instructions alone.
The deterministic floor remains a backstop,
not proof that the model behavior is repaired.
The bounded writer/selection comparison is recorded in
[the verse-remedy review](../../../../doc/planning/translation-repair-verse-remedy-review-2026-09-10.md).
Since `7c0ce152f` (2026-09-10,
the twenty-ninth class) a source-only passage must preserve a minimum count of explicit line breaks
within each top-level block.
Mio10's missing-archive poem kept its words but lost all five Markdown hard breaks,
which the blank-separated-block verse heuristic and physical-line count did not detect.
The skeleton now counts parsed Markdown breaks and intrinsic lowercase `br` elements,
not soft newlines,
code or custom components.
Nonempty archive text stays outside this check;
expansion and archive-backed formatting choices are unchanged.
The guard failed before the fix,
and the publisher test preserves accepted breaks through wrapping and insertion into a disposable output tree.
Since `dc51b02d9` (2026-09-10,
the twenty-eighth class) archive revision proposals may carry a nonempty `sourceQuote` as supporting evidence,
matching the declared JSON schema.
The handwritten guard had rejected those otherwise readable MiniMax and Gemma revisions on the ninth `Mio`,
leaving archive review below quorum and stopping the pass before lanes.
A revision still faces independent selection;
only `source-supported` retention requires a nonempty anchored quote.
The real-stage guard failed `provider-unavailable` before the fix and passes after it.
Since `ad6d506a6` (2026-09-09,
the twenty-seventh class) an assembly with an unattributed structural regression tries each single replacement
withdrawal before withdrawing the whole lane.
Each trial splices and parses the whole document,
including slice joins,
and must leave no introduced structural or footnote defect against the archive.
The first successful trial preserves every other replacement;
when none succeeds,
the existing blanket fallback remains.
The eighth `Mio` had selected malformed JSX at slice 16,
then withdrawn all 15 translations,
including a valid linked poem at slice 17,
and stopped at the publisher for its missing destination.
The author-defense policy is unchanged;
the added proof is deterministic and buys no model calls.
The reproduction failed first,
then passed with guards for unrepaired multi-slice damage,
container joins and a counterfactual that still breaks footnotes.
Since `f6cd6e5e7` and `07a99e23a` (2026-09-09,
the twenty-fifth class) archive block review sees corroborated transcriptions of pictures referenced by its
aligned source section,
under `CORROBORATED PICTURE SOURCE SUPPORT` with each reader's wording labelled.
The optional `preparePassEntry.readPictures` seam runs before a review can remove an archive translation of
picture text;
`pass-entry.ts` binds one entry-scoped reader for preparation and the final picture phase.
Completed readings are retained in memory within that pinned entry,
not merely persisted to the disk cache whose open `resumed` map is a snapshot.
Changed slice boundaries or later reader reseating do not purchase completed pictures again;
newly exposed references still get read.
Target-only sections and unrelated,
textless or unavailable readings add no source support.
The preservation,
section-scope and no-repurchase guards were shown failing on the pre-fix build before passing.
Since `40aba2fdb` (2026-09-09) every stage gather sizes its quorum on the seats a wet provider serves,
not on the seats the phase seated:
`reachableQuorum` keeps the bench quorum while the reachable seats can meet it and otherwise needs half of
them rounded up,
never fewer than two (`MIN_STAGE_VOICES`),
a seat the router refused is dropped from the pending list rather than re-asked,
and a short gather carries `stage-short-bench (<stage> reachable r of n, quorum q)` into the artifact
(`stage-reachable-quorum.ts`;
the 2026-09-09 addendum of `doc/decision/translation-repair-short-bench-share.md`).
Since `a5e0efc7f` (2026-09-09) `deepseek-v4-pro-0813` writes no translate-lane candidate:
two 40-round producer calibrations read it below the pooled null,
the second across the Bonferroni threshold (z -2.31 on 2026-09-08,
z -3.18 on 2026-09-09),
so it joins `TRANSLATOR_DROPPED` and keeps every judge seat,
the consolidation seat and its place as the price anchor.
Since `028432713` (2026-09-09) `inception/mercury-2.5` writes in both lanes:
the 40-round calibration of that day read it at 18 of 101 disinterested ballots,
z -0.43 against a 19.5 percent pooled null,
not separated from it,
so `WRITER_UNMEASURED` is empty again and its completion cap is the pooled 90th percentile,
measured off its own 136 calls.
Since `19b6043a3` (2026-09-09) the owner's 2026-09-03 cost decision on Kimi-K3 is a fact of the reach,
not only of the seat reader:
`OPENROUTER_WITHHELD` lives in `openrouter-catalog.ts`,
`reachOf` and the picture reach say OpenRouter does not serve a withheld model,
and a seated Kimi-K3 whose provider dries mid-phase is an unreachable seat rather than 22 calls at 3 and 15 USD
per million (1.14 USD on the third `noname` pass,
61 percent of its OpenRouter spend);
the seat reader withholds the seat whose only wet provider would have been OpenRouter,
so the substitute checker sits as before.
Since `db5927630` (2026-09-09,
the owner's answer to the thin-bench question) a select round whose bench is short of quorum,
because the router refused seats for want of a wet provider,
seats a winner by a share of the reachable weight:
the minimum scales as `MIN_SELECTION_WEIGHT` times reachable over quorum,
two ballots naming the winner is the floor (`MIN_SELECTION_BALLOTS`),
a bench at or above quorum keeps the absolute 2,
and the round's findings carry `select-short-bench (reachable r of n, minimum m)`
(`candidate-select-minimum.ts`;
`doc/decision/translation-repair-short-bench-share.md`).
Since `1463cd359` (2026-09-09,
the owner's answer to the incumbent question) a consolidation whose standing failed the deterministic gate runs
against the incumbent where the incumbent passes it,
with `ineligible-standing-replaced-by-incumbent` recorded and no contest endorsement,
and the artifact's shipped kind `incumbent` has the page write the incumbent's text;
the entry stops only where the incumbent fails too,
or is the standing (the 2026-09-09 addendum of `doc/decision/translation-repair-ineligible-standing.md`).
Since `b7a0b4f5f` (2026-09-09,
the owner's answer to the glossary question) `community-glossary.ts` beside the corpus pin lists the community's
terms (自切 as "self-surgery",
超天酱 as "KAngel" of the game Needy Streamer Overload,
the archive's renderings),
the terms an entry's source carries ride in its identity context as `COMMUNITY TERMS`,
and the select,
lane-contest and consolidation-gate sheets name each candidate lacking every accepted rendering in a
`COMMUNITY RENDERINGS` block,
evidence to weigh rather than a bar;
the owner curates the file (`doc/decision/translation-repair-community-glossary.md`).
Since `3224ff347` and `fcc8ca197` (2026-09-09,
the owner's "Mercury 2.5 is out and approved") `inception/mercury-2.5` is the twelfth roster model and the one
only OpenRouter serves (its roster id is OpenRouter's spelling;
0.04 and 0.15 USD per million,
text only,
one endpoint),
seated in critic,
panel and judge in both lanes,
the late bench and the slate on the fidelity probe of that day
(14 of 14 distinct questions chose the complete text,
no damaged pick,
no decline;
recorded on its card in `src/model-cards.ts`),
and held out of every writing seat by `WRITER_UNMEASURED` until the 40-round producer calibration is read;
a model one provider alone serves holds no seat until a measurement seats it,
whichever provider it is.
Since `78ea8c8c7` (2026-09-09,
the owner's "do everything in our power to NOT bleed") every call on every provider carries `max_tokens`
at a measured ceiling per roster model (`completion-cap.ts`:
the highest 99th percentile of completion tokens any provider with at least 100 calls of the model recorded over
142,437 completed calls,
floored at the pooled 90th of 3,831;
each cap cuts under one percent of that model's completed calls),
a caller's own ceiling only ever lowers it,
Hyper takes the lower of the cap and its own per-model ceiling,
and a reply that meets the cap ends `finish_reason=length` and is read as a truncated voice;
the reasoning controls stay off the wire as the owner's 2026-08-25 instruction requires.
Since `b71a55385` and `33a023445` (2026-09-09) every round asks quorum plus one seat,
from a bench rotated deterministically by the prompt (`stage-fanout-window.ts`),
and the rest only when a voice is lost:
the sixteen `gatherStageVoices` stages through their retry rounds,
and the six stages that read their own round (`stage-windowed-rounds.ts`;
the lane contest,
section and block pairing,
the consolidation gate,
the naturalness review and the polish gate) through retry rounds they never had before,
each returning one outcome per seat asked in roster order;
quorum is unchanged and still computed over the whole bench.
With it:
the coverage verdict takes its majority over the seats the gather asked (`gather.asked`),
a judge bench whose window could not carry a unanimous self-written slate on self-votes alone asks the whole bench
(`candidate-select-fanout.ts`;
four seats),
the naturalness confirmation challenges exactly the seats the discovery asked at the discovery's quorum,
a fixture scripting every seat passes `fanOut: 'whole-bench'`,
and a fixture counting calls counts `firstRoundWindow({ benchSize, })`.

Generation fourteen (`725a31b12`,
completed through `b5da9866b` on 2026-09-10) records each naturalness round's effective `quorumOver`.
Mio12 exposed why the asked-seat list is not that basis:
four acceptable voices among six asked seats failed the runtime's wider nine-seat quorum,
but the artifact reader recomputed a three-voice threshold and refused the correct runtime verdict.
The new reader derives from the stored wider basis,
checks confirmation uses that same basis,
and preserves the seat-count interpretation only for older generations.
Runtime rejects invalid bases before asking reviewers.
No missing reviewer identities are invented and the intended quorum is not reduced.

Since `514db9b1f`,
name authority distinguishes references to people from literal words,
characters or spellings under discussion.
Writers,
critics and deciding criteria preserve that discussed form instead of normalizing it to the declared name.
Ordinary surrounding prose still becomes English.
`8a59469f2` also separates established translation-side names from generic terms needing a first-use gloss;
ordinary terminology and explicit source definitions remain covered by the existing rule.
The real bounded translation stage on verified `85f7bac01` produced and selected a fresh wording retaining
Mio's character/name distinction,
with all four responding judges choosing it.
The measured group-name votes no longer authorize the false gloss correction under the existing tally rule.
These are preventive instructions,
not new output-rejection gates or a new glossary entry.

Archive review since `bfcb5b568` separates retention-anchor sufficiency from revision selection.
An actual revision may reach independent selection after the initial review quorum,
without enough anchored retention opinions.
The selector receives the unchanged original,
archive context and anonymous typed opinions linked to the actual candidates;
unanchored retention claims stay audit-only.
Neither initial nor selector quorum is reduced.
`ba01babda` clarifies the first review's complete minimal English correction responsibility.
The compiled-stage Mio chat probe selected a corrected full block while preserving its useful `Translation:` label.
Retained-label naturalness audits still produce inaccurate findings;
context trials have not established a remedy and further work is deferred.
The corpus wrapper discards their detailed findings and does not let their verdicts change text,
so this audit-quality issue is not a page-readiness blocker.
The awaited calls still consume resources and can propagate operational failures.
These stage results do not establish whole-page readiness.

Since `e086402a6`,
a following heading-only source slice brings its next body into the neighboring-context window.
This is a single forward extension,
not a search through distant sections;
metadata,
empty content or another heading stop it.
Source and archive views use the same positions.
The `134a2e20c` trial reproduced the measured Mio context but still removed the list and changed a group name.
Subsequent measurements led to clustered panel packets and source-evidence handoffs,
verified locally through `8adb77fb9`.
`runPanelStage` now preplans one packet per existing cluster,
uses bounded sequential packet execution and keeps every claim's configured electorate separate.
Complete same-entry source evidence participates in repair cache/twin identity and reaches the panel and both selectors.
Whole-chunk selection also receives the known existing English before repair,
so an already-carried detail is not mistaken for a new addition.
The compiled full-path check still removed the disclosure item,
and group-name authority remains unresolved.
`029c0a886` adds measured guidance distinguishing a distorted source-grounded event from independent added content,
and asks adjudicators to check the claimed category as well as the existence of an error.
Genuine addition and omission controls remain actionable.
It does not change the category enum or automatically filter claims.
`b9d3b2ea0` preserves each member's effective decision through issue merging:
accepted issues no longer carry rejected diagnoses as confirmed editor instructions.
Source-defect protection still blocks a whole panel-merged cluster.
Emission deduplication preserves known claim evidence.
The compiled repair path now generates and selects the correct friend-to-Mio disclosure,
retaining the list and avoiding the childhood-time attachment.
The group-name mutation remains open;
these checks do not establish whole-page readiness.
Initial translation writers remain unchanged because their separate context experiment did not correct the bullet.

Since `037d1f650`,
`4f87555fc` and `1fe7ca2fe` (2026-09-09) the OpenRouter client sends `provider.sort: 'price'` with the
zero-data-retention and `require_parameters` preferences,
prints `cached=N` on the `SPEND` line off `usage.prompt_tokens_details.cached_tokens`,
writes a `SPEND ... estimated=abandoned` line reckoned from the delivered characters for every stream a round
abandoned,
and no longer serves `hf:Qwen/Qwen3.8-27B` or `glm-5.3` (`OPENROUTER_DROPPED_SEATS`),
after the reckoning of 2026-09-09 found 58 USD of a 200 USD day in abandoned streams the endpoints billed to the end
and the anchor judge routed to endpoints at twice the listing price.
Since `efc9a4f3c` (2026-09-09,
the twenty-third class) pair agreement decides a target two sources claim without a corroborated merge by votes,
the way it already decides one source named against two targets:
the better-voted claim keeps the target and the other source is left unpaired,
a tie keeps neither,
and the finding reads `contested target (target N: source A outvotes source B, X to Y)`;
the first `noname` pass had paired the original's `## 简介` heading with the archive's opening paragraph by
source order and shipped the page without the heading.
Since `7bcea2dc4` (2026-09-09,
the twenty-second class) the archive-original recognizer reads a whole-page note written in English:
`(Original Language: English)`,
and the pinned corpus's own `(Original Language: Engish)` on `gqt`,
matched on the lowercased note,
decline the entry the way the Chinese wordings do;
four `gqt` passes had repaired an English original from its Chinese back-translation.
Since `3620004db` (2026-09-09,
the twenty-first class's fourth face) the composed page runs through the same footnote assembly guard each lane
runs,
and the artifact records the outcome as `pageAssembly` (generation thirteen):
the slices the guard trimmed with the text the page carries,
the slices it took back,
and its findings;
`wouldShipTextFor` applies the section ahead of the polish,
the consolidation and the contest,
so every reader composes the page the guard settled,
and an older artifact reads with an empty section.
The twenty-second `hakureico` pass had trimmed the orphan in the translate lane and shipped the consolidation's
fresh rendering of both notes at the same slice,
which the page guard refused.
Since `379122379` (2026-09-09,
the twenty-first class's third face) the orphan trim reads blocks the way GFM ends definitions:
a definition line opens a block whether or not a blank line precedes it,
a definition's indented continuation stays in its block,
and the gaps between blocks survive a cut as written;
the twenty-first `hakureico` pass had rendered its two notes one line apart,
the trim saw one block,
and the assembly guard withdrew both notes and the reference,
which the page guard then refused to ship.
Both assemblers log every assembly guard finding after the withdraw warning.
Since `9abcbee50` (2026-09-09,
the twenty-first class's second face) a delivery ledger's shipped row carries the text the document carries,
which the assembly guard may have trimmed:
`guardFootnoteAssembly` reports `trimmed`,
both lane results carry `trimmedReplacements`,
`buildSliceDelivery` reads a shipped row's text from them before the decision,
and `assertDeliveryCoherent` accepts a shipped row whose text is its decision with definition blocks cut and
nothing else (`isDefinitionTrim`);
the twentieth `hakureico` pass had stopped at the reassembly invariant with the trim on the page and the judges'
text in the row.
Since `aedee7414` (2026-09-09,
the twenty-first class) an orphan footnote definition takes only its own block,
and the composed page's footnote graph is read before the tally:
`guardFootnoteAssembly` had withdrawn a two-definition insertion whole for the one orphan among them
(the nineteenth `hakureico` page shipped `“Mayday”[^1]` with no note,
since the sealed letter carries no `[^2]`),
so `trimOrphanDefinitions` now cuts the orphan's block out of a definitions-only replacement first
(`assembly-footnote-trimmed`),
and `assertPageFootnotesIntact` reads the would-ship page against the archive and stops the entry as
`page-footnote-integrity`,
run beside the carried guard by `assertPageGuards`.
Since `d6db46519` (2026-09-09,
the twentieth class's second face) a carried insertion's evidence is the full coverage votes' regions alone:
`judgeCoverage` had recorded every anchored quote whatever its degree,
and a partial voter's quote of an unrelated sentence,
rewritten by a lane,
stopped the sixth `yuki418330012` pass at the guard;
an interrupted entry's findings now reach the log as `INTERRUPTED <id>: <finding>` lines before its tally.
Since `11143f681` (2026-09-09,
the twentieth class) the carried-insertion guard reads the page the way the evidence was anchored:
`assertCarriedInsertionsRemain` folds soft line breaks and normalizes punctuation on both sides before it looks
for a carried region,
since the semantic wrap breaks a changed slice at its clauses and the fifth `yuki418330012` pass had stopped as
`carried-evidence-lost` with every word of the credits line on the page
(`Contributors for this entry:\nZhenli,\nSansan,\nSuona` against the anchored one-line quote),
and its findings name each lost region.
Since `1ba94c27a`,
corrected by `ea07a1512`,
completed by `e5ff6c4f8` and closed by `2da6e7f22` (2026-09-08,
the nineteenth class) the archive's footnotes follow the original's before any lane reads a slice:
the block pairing treats footnote definitions as order-free blocks
(`readBlockPairing` takes their indices as `freeOrder` and reads its never-backwards rule over body pairs alone;
the third `yuki418330012` launch had lost six of eight voices for pairing two definitions by content where the
archive had renumbered them),
a crossing definition pair is kept out of the slicing and read for the relabel (`splitDefinitionPairs`),
`footnoteRelabelOfDefinitions` reads the label map off the definitions the roster paired
(the `yuki418330012` archive had renumbered `洲洲[^2]` and `真理[^1]` by first appearance,
and the page shipped the original's markers above the archive's definitions,
each pointing at the other's note),
the positional reading off the paired slices stays as the fallback
(a slice whose sides carry different counts of notes is left out,
named;
the `hakureico` archive carries no `[^2]` at all),
`applyFootnoteRelabel` rewrites references and definition openers in one pass,
`reorderFootnoteDefinitions` moves the archive's definitions into the original's order,
and the pass prepares again over the rewritten archive,
logging `FOOTNOTES entry=<id> relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired` and
`FOOTNOTES entry=<id> definitions moved into the original's order: [^1], [^2]`.
The footnote extension of 2026-09-11 keeps supplied correspondence,
existing forced elimination and collision-avoidance displacement separate.
An unmatched archive note may receive a fresh positive-decimal label only after every source label is accounted for;
that move establishes no source correspondence.
Identity relations remain evidence even when they change no bytes.
`footnoteRelabelOf` now takes the complete preparation's source text,
archive text and slices,
projecting positioned document references into checked ranges rather than reparsing container halves.
`applyFootnoteRelabel` matches normalized identities but replaces exact raw spans,
refuses missing changing map domains and merging destinations,
and reparses the resulting marker graph.
Definition movement preserves each separator once and withholds changes across non-blank gaps or split containers.
Any rename or reorder touching declared English-original text or its owning note withholds the entire operation.
The pass records a structured `withheld` reason,
keeps the original preparation when withheld,
and prepares changed text again through its existing caches.
Cache eligibility is unchanged:
an incomplete crossed agreement can require fresh acquisition on replay,
while independently cached original and relabelled questions are reused under their distinct keys.
See `doc/planning/translation-repair-archive-footnote-collisions-2026-09-11.md` for verification status.
Since `439667ec3` (2026-09-08,
the owner's decision in `doc/decision/translation-repair-archive-original.md`) an archive note saying the English
is the original is authority:
a span note (`以下` with `原文` and `英文`) seals the archive from the note's end to the next heading or the end
of the page,
the sealed blocks and the originals paired with them reach no slice
(an original behind the seal becomes an insertion at its end),
the preparation records `archiveOriginalSpans` (artifact generation twelve),
`assertArchiveOriginalComplete` refuses a page that does not carry every sealed span byte for byte,
and the pass logs `ARCHIVE ORIGINAL entry=<id> span=<k> [start, end)`;
a whole-page note (`原文即英文` or `不要动本篇`) declines the entry before any purchase,
`declined/<id>.json` beside the artifacts,
`TALLY <id> status=DECLINED reason=archive-original`,
counted as done by every later pass and reported by `verify-published` as `declined=N`
(`cheonwoomaeng`,
the one such entry in the pinned corpus,
declines in 41 ms).
Since `bb04656ef` (2026-09-08,
the eighteenth class) a whole stream whose choice stopped on `finish_reason: "error"` with no error object
beside it
(the shape OpenRouter's Together and CoreWeave routes delivered seven times since 2026-09-03,
each after reasoning and with no content)
is read as the provider failure it is (`openrouter-error-finish.ts`,
asked by `openrouter-stream-error.ts` when no chunk carried an error object),
rides the retry ladder as `InStreamProviderError` with `code unnamed` and the upstream's own reason as its kind,
and no longer reaches the reply ladder as an empty answer that lost the voice as `schema-mismatch`.
Since `8bf9deec0` (2026-09-08,
the seventeenth class) a reply whose JSON opening was written twice,
an abandoned fragment and then the whole object
(`{"best": 1{"best": 1, ...}`,
the shape reasoning streams from Bedrock's `openai.gpt-oss-120b` and OpenRouter's Makora route deliver),
is read past the fragment (`json-false-start.ts`,
each brace inside the first 256 characters tried as the start until one parses),
the caller's guard still judges what was read,
and the log carries `json false start: read the object past an abandoned opening of N chars`
where before the voice was lost as `schema-mismatch`.
Since `20e5135a6`,
merged as `d11f36799` (2026-09-08,
the owner's rule "publish the archive's front matter as is;
render it only where the archive never translated it",
addendum in the same decision) the archive's front matter stands unless the archive shows the directory id as the
visible name while the source names the person and no clause of 2026-09-07 makes the id stand:
where it stands the preparation makes no metadata slice (`frontMatterAuthority: 'archive'`,
logged as `FRONT MATTER entry=<id> authority=archive`),
the page carries the archive's bytes,
and the final guard refuses any other front matter or any rendered slice as `archive-front-matter`;
artifact generation eleven records the authority in its preparation and the rebuild reads it off the file.
Measured over the pinned corpus,
all 92 archives stand.
Since `169a86173` (2026-09-08) `google.gemma-4-e2b` also writes,
as translator (eight,
quorum 4) and consolidation writer (ten),
seated by the 40-round producer calibration of the same day
(30 of 298 disinterested ballots,
z -1.40 against the pooled null of 12.8 percent,
94 of 94 asks usable;
the seating decision's addendum of 2026-09-08).
Since `6bfe6da56` (2026-09-04,
two owner decisions after the luxuanwen3 pass lost a full run to its front matter) the identity rule reads containment:
where the source declares `name` and `info.alias` the same,
the translated name must appear among the comma-separated renderings of the translated alias,
which may carry the original script beside it (7 of the 14 such archives at the pinned corpus do),
and consolidation withholds a standing text the deterministic gate refused from its slate,
failing the slice under `ConsolidationStandingIneligibleError` when nothing valid ships
rather than letting the page guard refuse the entry after the run has been paid for
(`doc/decision/translation-repair-ineligible-standing.md`),
until the owner ruled on 2026-09-27 that such a slice keeps the archive's wording
and the page ships with it reported (that record's eighteenth addendum).
Since `82888d43b` (2026-09-04,
owner's decision after the re-run stopped at its first paragraph)
a reference the archive rendered another way is owed once,
not twice:
per atom kind,
the atoms only the original carries and the atoms only the page carries form one pool
and a candidate owes the larger side's count from it,
drawn from either side (luxuanwen3 links `x.com` where its original links `twitter.com`;
8 of the 93 entries carry such a rewrite),
while a one-way divergence stays an addition or a drop owed as before
(`doc/decision/translation-repair-rewritten-destination.md`).
The run log names which verdict refused a standing (`fails the deterministic publication rule`,
with the findings,
or `lacks contest endorsement`) and a contest winner's findings (`558b46e11`),
and an ineligible standing stops the entry instead of queueing a reattempt of the same refusal (`ae1d2b55f`).
Whether the lanes kept the archive's metadata is not the guard's question:
Chinese and English metadata always differ,
so the 2026-08-28 byte comparison fired on every kept incumbent and discarded the Carena0442 pass,
and the night's reading of which panel chose the keep (`daaf0ffa0`,
`6f70a2085`,
`1160ebb4c`) was removed with it.

Fresh `1974ad999` validation then settled all four slices under preparation identity generation 2.
Artifact generation 5 and its 897-character page matched exactly under `verify-published`;
source destination survived,
all nine seats answered,
and both providers were wet on all 30 meter readings.
Visible `name` and `info.alias` now identify same source person,
so primary front-matter defect is closed at publication boundary.
Strict complete-page reading still rejected output for two systemic reasons.
The `info.location` contributor comment restored source-script attribution over established target form,
and body consolidation reintroduced several literal collocations after repair lane's naturalness pass had finished.
Mechanical agreement therefore remains necessary and insufficient.

Metadata validation now compares contributor attribution at same YAML path
and preserves established target spelling after
`, by `;
translate,
contest,
consolidation,
and final-page checks share that policy,
with translate,
contest,
and consolidation cache generations advanced.
Artifact generation 6 adds auditable body-only naturalness polish after consolidation fidelity gate.
Measured refiner roles propose rewrites,
existing selection chooses candidate,
then separate fidelity-first naturalness gate lets polished wording replace approved base
only when meaning and structure remain intact.
Front matter never enters polish.
Artifact records base,
proposal,
final text,
writers,
selection round count,
gate ballots,
and findings;
publication reads polish before every earlier decider.
Full package suite passes 854 groups with no failures,
and mutation proofs show polish shipping and read precedence guards are effective.

Fresh `2981e8cad` generation-6 `Weideriche_` validation reached all four slices and all nine active seats,
but correctly published no artifact or page.
Translate produced source-valid metadata;
repair deliberately retained archive metadata whose visible name and alias violate source identity.
On retry the lane contest selected repair,
recorded winner as unpublishable,
and did not cache it.
Consolidation produced source-valid metadata,
but final consolidation gate kept invalid standing repair text.
Complete-page guard refused both attempts as `invalid-page`;
second attempt added no cache record and queue stopped rather than repeating same work.

Missing trailing newline on generated metadata was investigated and rejected as root cause.
Positive control parsed exact generated candidate plus actual archive body successfully
because body begins with line break.
Temporary boundary restoration and cache bumps were reverted in `03b698e40`.

Artifact generation 7 records source text and deterministic archive,
repair,
and translate eligibility on syntax-bearing contests while retaining raw ballots unchanged.
Verdict derivation excludes votes for ineligible candidates without redirecting them,
requires ordinary direct-vote quorum for eligible lane,
and suppresses archive endorsement when archive itself is ineligible.
When either lane is excluded,
contest still starts straggler grace at exact-half quorum rather than requiring every provider seat.
Fast inadmissible votes may therefore leave no eligible winner;
that outcome fails closed as retryable and uncached.
Contest prompt names deterministic exclusions,
artifact reader recomputes eligibility from stored source and lane texts,
and final page guard remains independent.
Fresh `09c3919bc` generation-7 `Weideriche_` validation settled all four slices in isolated root,
used both providers,
wrote one artifact and one page,
and passed `verify-published` with exact wording and expected length.
Artifact carries schema 7,
preparation identity v2,
and source-backed metadata eligibility at slice zero.
Archive and repair metadata are ineligible,
translate metadata is eligible,
and all eight retained raw ballots remain unchanged.
Seven judges declined to redirect an inadmissible choice and one chose translate,
so eligible lane lacked direct quorum;
consolidation then produced valid metadata and its gate approved it.
Complete-page reading confirmed visible name and alias agree,
location contributor uses established target spelling,
and source-script contributor did not leak into published metadata.

That page is not accepted yet.
Body meaning is materially faithful,
but several phrases remain literal or stiff.
Both body slices record polish as `not-run/not-configured` even though production run roles configure measured refiners.
The actual reachability defect is in `settleConsolidation`:
when consolidation slate keeps an already-endorsed standing lane,
function returns before `polishConsolidation`.
Artifact conversion then reports missing polish as not configured.
Final polish now runs over every endorsed surviving body baseline,
including slate-declined and structurally empty consolidation slates,
while unendorsed baseline remains `unsafe-baseline` and cannot buy or ship polish.

Fresh `bd70fa261` generation-7 `Weideriche_` validation confirmed that reachability fix:
all body slices carry settled polish rather than `not-configured`,
one body slice heard all measured refiners and reached nine-voice fidelity gate,
and `verify-published` matched one artifact and page at expected length.
Gate kept approved base,
so no changed polish shipped.
Complete-page reading still refused output.
Three short body passages,
including redundant and literal constructions,
were skipped because repair-lane 120-character eligibility floor was reused by final polish.
Final polish now disables that length floor while retaining paragraph-kind,
hard-break,
markup,
parse-integrity,
structural,
name-survival,
and final fidelity guards.

Same page also translated established English contributor handles literally from source attribution.
Existing English archive has 38 canonical contributor-label lines at pinned corpus checkout,
and target labels can be chosen public identities unrelated to source-script transliteration.
Preparation now extracts plain and linked contributor forms from those lines,
adds them to deterministic declared-name survival and prompt context,
and publication independently rejects any final attribution that drops or respells them.
Exact current generation-7 page is positive control:
new boundary rejects it with `ContributorCompletenessError`.

Fresh `1d4472e31` generation-7 `Weideriche_` validation then settled in an isolated root with schema 7,
preparation identity v2,
and both providers wet.
`verify-published` matched one artifact and page at expected length.
Metadata kept source identity equality and exact established target contributor forms.
Every structurally eligible body slice reached final polish;
one retained its approved base after all three refiners proposed nothing,
and another shipped a changed proposal after nine approving gate ballots with final text equal to proposed text.
Complete-page reading still refused publication quality.
The selected polish improved local repetition and verb form,
but left source-order adverb stacking and literal verb-object phrasing;
the untouched body slice also retained repeated generic referents.
The generic rewriter question permitted partial local cleanup while preserving Chinese grammar too literally.
Rewriter policy now says to preserve meaning rather than source grammar,
names the observed calque classes,
and requires every clear issue in a changed paragraph to be fixed before reply.
Refinement and consolidation cache generations advance because earlier replies answered weaker question.

Prompt pressure alone is not publication proof.
Artifact generation 8 adds independent absolute naturalness review over exact would-ship body text
after comparative fidelity gate,
including unchanged text when refiners propose nothing.
Every requested roster seat remains accounted as usable or unavailable,
but exact-half usable quorum starts bounded straggler grace and is also minimum for approval.
Any usable rejection heard before settlement blocks.
Findings identify one-based structurally correctable paragraph and actionable defect.
One bounded corrective generation receives those findings as fenced data,
then existing structure and fidelity gates run before independent review rechecks exact selected text.
No-op correction,
thin review,
rejected correction,
or second-review defect yields `NaturalnessCompletenessError` before page or artifact persistence.
Such settlements are neither cached nor twin-reused.
Schema 8 stores every seat status,
review verdict,
correction count,
and candidate digest;
reader recomputes counts,
unique seats,
findings,
verdict,
and final-text digest.
Generations 6 and 7 remain readable but cannot satisfy schema-8 publication boundary.
Full package suite passes 858 groups with no failures,
and OXLint and TypeScript checks are clean.

The first fresh schema-8 run correctly rejected body text
after every absolute reviewer found material naturalness defects.
It wrote no page,
artifact,
or consolidation cache.
That run also exposed a correction-routing defect:
correction refiners saw the findings,
but candidate selectors still received the generic comparative-polish question
and a tie restored wording already known to be unpublishable.
Consolidation cache generation 8 makes required correction a distinct non-fallback mode.
Correction rewriters and selectors now receive structured paragraph findings as fenced evidence;
selectors are told unchanged text cannot ship,
and decline or tie records `no-correction` rather than fallback.
That mode is gone:
its loop went on 2026-09-01,
and ledger B47 (2026-09-30) removed the mode and its outcome,
which only tests still built.
Comparative refinement retains its accepted-input fallback.
Structural validation,
fidelity gate,
and exact-text second absolute review remain mandatory after any selected correction.

The next fresh schema-8 run proved required-correction routing converged,
but one correction remained an insufficient bound.
On its first attempt,
a selected correction passed fidelity review and exact-text absolute review exposed further material defects.
On its retry,
a broader correction was selected but fidelity review retained the rejected input.
Both attempts wrote no page,
artifact,
or consolidation cache;
`verify-published` correctly refused to call the empty run clean.
Artifact schema 9 and consolidation cache generation 9 permit one further correction
only after exact first corrected text receives a new material rejection.
Artifact schema 10 (2026-09-02) shows the absolute reviewer every body block of the candidate
and records the paragraph count and digests of those blocks;
schemas 8 and 9 recorded the refinable paragraphs alone,
which left a blockquote candidate with nothing a reviewer could cite,
and the reader recomputes the set the writing generation used.
Each transition records rejected-text digest,
canonical structured-findings digest,
gated-text digest,
and reviewed paragraph digests.
The reader recomputes every exact reviewed candidate,
its paragraph identities,
and every adjacent transition.
No candidate,
tie,
no-op,
fidelity retention,
thin review,
or rejection after correction two remains terminal and retryable.
Generations 6 through 8 remain readable but cannot satisfy schema-9 correction-chain boundary.
Another fresh affected rerun remains required before accepting output.

Two fresh schema-9 `Weideriche_` validations after the GLM-5.3-Flash roster replacement each attempted the entry twice,
failed absolute naturalness on body slice 1,
and wrote no page or artifact.
The first exposed reviewers treating Markdown soft breaks as visible sentence breaks
even though target MDX renders them as spaces.
Absolute-review instructions now require flow findings to survive rendered soft-break normalization;
a replay over same rejected candidate text and reconstructed context then received nine usable approvals.
The second fresh run still rejected genuinely awkward body wording after both corrections.
It also exposed required-correction fidelity gate calling rejected base already approved and unanimously restoring it.
Required-correction gate now receives rejected status and canonical findings;
base remains fidelity evidence but cannot win merely because improvement is unclear.
Correction generation and selection now treat findings as minimum defects rather than edit whitelist.
Replays over exact candidate texts with reconstructed source and identity context moved gate from base to polished
and selection from partial to broader idiomatic correction.
Those replays are directional prompt evidence,
not publication evidence:
the best replayed correction still received one usable rejection among nine and therefore fails strict floor.
GLM-5.3-Flash returned usable structured answers and approved reviewed candidates in these diagnostics,
but this does not grant specialized role standing or production readiness.
Consolidation cache generation 10 prevents warm reuse of settlements bought under earlier review,
correction-generation,
selection,
or fidelity-gate questions.
The next eight-seat validation proved relative correction selection
still allowed every judge to choose best available text before exact absolute review rejected it.
Consolidation cache generation 11 makes required correction absolute eligibility explicit:
rewriters are instructed to perform separate finding-led and sentence-level native-English passes,
inherited wording gets no presumption from omission in finding list,
and selectors must assess each candidate independently
and decline every candidate when each remains materially unnatural.

Prompt strengthening alone was insufficient.
A newly generated correction fixed demonstrated phrase but introduced another idiomatic defect;
selector still chose it and exact review rejected it.
More importantly,
same exact failed candidate was rejected by original run and first replay,
then accepted by all eight seats in later replay.
One absolute-review draw is therefore not stable enough for publication approval.
Consolidation cache generation 11 now requires one sequential exact-half-quorum confirmation after first acceptance.
Any rejection heard before either bounded settlement remains immediately decisive and feeds bounded correction;
an acceptance ships only after second quorum acceptance of exact candidate.
Consolidation cache generation 12 applies exact-half required participation to every direct roster round;
no stage waits on every provider seat as requirement.
Participation quorum is distinct from existing two-vote corroboration thresholds for pairing and comparative gates.
Sequential naturalness approvals may contain different responding halves;
requiring identity overlap would restore provider-seat dependency the cap removes.
Schema-9 `confirmations` retains earlier acceptable draw with candidate and paragraph digests,
while decisive `rounds` preserves one-review-per-candidate correction-chain invariant.
Runtime settlement produces confirmation evidence by construction;
artifact reader independently checks final-candidate identity,
paragraph digests,
roster order,
and confirmation order.
Final-naturalness completeness guard checks settled runtime state
and does not duplicate artifact reader's digest validation.
Legacy schema-9 records without field remain readable.
Consolidation cache generation 13 landed in `1d16d89c4` and removes two-correction ceiling.
Consolidation cache generation 14 landed in `cf14b379b`
and threads every reviewed rejection into failed-strategy evidence
while durably storing first raw model payload by canonical prompt under run root.
Commit `6369228d5` detects exact repeated correction task before dispatch and pauses it as `INCOMPLETE`.
Interrupted invocation reconstructs exact correction state from payloads without provider resends,
then continues at first unseen prompt.
Payload cache carries corpus and model wording;
it stays inside disposable run root and is never committed or quoted.
Every rejection feeds latest exact text and findings into next correction.
No-change,
selection decline,
structural refusal,
and fidelity retention become prior failed-strategy evidence for materially different next prompt.
Schema-9 reader accepts any count of complete digest-bound transitions and still requires final acceptance.
First acceptance uses defect-discovery responsibility;
confirmation uses prior-acceptance challenge responsibility rather than repeated prompt.
No further validation may reuse generation-12 consolidation cache.

Status on 2026-09-04.
Three entries were run on OpenRouter alone and read line by line:
`luxuanwen3` (60 minutes,
4.65 USD),
`SS3B_0016` (56 minutes,
5.12 USD) and `Uekawakuyuurei` (53 minutes,
3.84 USD).
All three verify mechanically and all three pages are publishable.
That is the first time any page passed the reading gate the owner set on 2026-08-26,
and it does not make the pipeline production ready.

The reading found four defect classes,
all four in this package rather than in the corpus.
The publisher compared the assembled page to the source alone and refused a page its own slice rule had accepted.
The corpus's neutral pronoun,
written `TA`,
`Ta` or `ta`,
reached a page untranslated because the
counter read one spelling of three and the house rule never said what English makes of it.
A picture whose canvas noise clears the deterministic presence gate was reported textless by every model,
each report was screened as a refusal,
and three entries were unshippable on any roster for it.
The site's own name was settled by a gate arguing from the archive rather than from a rule.
Each is fixed with a guard shown to fail with its rule neutralised.

Read that rate as the finding.
Two entries read on one afternoon produced two new classes,
and the third produced none,
so the class-per-entry rate is falling but has not reached zero,
and no run has yet completed consolidation unstarved on the current build.
Production readiness needs the passes named in `doc/planning/translation-repair-readiness-signal.md`,
not another green suite.

Status on 2026-09-06.
Synthetic and Hyper are wet again and the passes run on the plain invocation:
the pass keeps four slices in flight and the writer rounds wait 180000 ms by default,
both moved this day from launch dials that every shipped page had needed
(`doc/decision/translation-repair-pass-overlap.md`,
`doc/decision/translation-repair-straggler-grace.md`).
The owner's rule of the day is always kill and relaunch,
written under "A source change while a pass is in flight means kill and relaunch".

The first pass on that invocation,
`yulianNyanner`,
found the fifth class in 28.6 minutes and shipped nothing:
the slice floor handed the strict MDX grammar the raw slice while the document reader masks HTML comments first,
so every slice whose original carried a translator note was an original that could not be read,
and the entry stopped at consolidation.
17 of 92 sources carry a comment,
14 of the 34 comment lines in that one entry;
no page that shipped had one.
Fixed with a guard shown to fail on the unfixed build (`translate-skeleton.ts`).
The class-per-entry rate has not reached zero:
the first entry read on a new shape of source found a new class.
Four pages of that entry then shipped and were read the same day,
and each found a class:
a positional translator note carried into every slice without its position,
one apostrophe convention on the page against another in the archive,
and a JSX string literal curled by the fix for the one before,
after which the publisher reads the whole would-ship page under the MDX grammar and refuses one it cannot
parse (`corpus-run/page-grammar.ts`).

## Superseded consolidation cache generation 14 operation history

This section records behavior of consolidation cache generation 14
(`CONSOLIDATE_CACHE_VERSION` 14 in the version notes of `src/consolidate-key.ts`,
introduced by `cf14b379b` on 2026-08-29),
not of artifact schema generation 14,
and is not standing guidance.
The finite producer constraints in `Standing redesign constraints`
replace its unbounded correction and suspension rules.

A quality rejection is repair work,
not final `do not publish` answer.
Pipeline must continue stage-local correction from latest exact rejected text and latest structured findings
until strict publication gates accept or operational interruption pauses work.
No finite correction ceiling is authorized.
It must not restart whole entry merely because quality work remains.
Cancellation,
dark provider,
quota exhaustion,
transport outage,
and insufficient live seats leave resumable incomplete work.
They must not become quality judgement,
terminal refusal,
unsuccessful quality tally,
or `do not publish` result.
Operational interruption may pause or retry repair,
but may not publish or weaken publication gate.

One model plus one substantive prompt may contribute at most one provider payload per invocation.
Identity is exact model identity plus canonical ordered messages,
including roles and exact content bytes.
Run client memoizes first in-flight or completed payload and reuses it for exact duplicates;
it never sends second provider call.
Pipeline must never resend that task to same model to manufacture independence,
non-bias,
confirmation,
or extra sample.
Changing temperature,
response schema,
round number,
nonce,
whitespace,
or request metadata does not create independent sample.
Providers may silently enable deterministic prompt caching;
duplicate response would then be same computation,
not independent evidence.
Follow-up work must give model substantively distinct task grounded in prior result,
latest rejection,
or different review responsibility.

Same-model same-prompt transport retry is permitted only after connection failure,
reset,
or timeout before completed provider payload exists.
Once any payload exists,
including malformed,
truncated,
schema-invalid,
or semantically rejected payload,
that model and prompt may not be resent as another evidence draw.
Operational recovery and discarded payload together still produce at most one recorded response.
Malformed completed payload keeps memoized failed claim and cannot be resent.
Claims are invocation-local;
a later invocation replacing interrupted work may repeat provider request,
but its result is never independent or non-bias evidence against earlier payload.
Concurrent duplicate waits on first caller's exchange and signal;
it does not start or cancel separate provider call.
Corpus pass persists raw payload memo beneath `prompt-payloads/` in run root.
Corrupted record refuses before provider call.

`TALLY status=INCOMPLETE` means stage-local or operational work remains.
It is neither success,
quality verdict,
nor publication evidence.
Scheduler retains caches but does not queue fresh whole-entry attempt in same invocation.
Ordinary hard-cap or transport error remains `status=ERROR` and may resume measured cache progress.

Pipeline must function normally when only one provider is wet.
No provider family,
provider-specific seat,
or cross-provider response is mandatory.
Exact-half participation may come entirely from one provider;
strict quality,
corroboration,
and publication gates remain unchanged.
One wet provider is valid normal operating mode with reduced provider diversity to report,
not reason to stop repair or lower quality.
Too few live seats for stage participation pauses or retries work as operational state;
it is not quality rejection.

Ordinary operation permits either provider alone.
Validation and performance arms requiring both must pass `--require-providers synthetic,hyper`.
Harness verifies both keys and live non-dry meters before any model call,
then logs `REQUIRED-PROVIDERS synthetic,hyper status=wet`.

The live artifact also exposed misleading diagnostic wording:
it reported nine pair relations as though nine of eight source blocks had been paired.
`countPairedBlocks` now reports unique source and target reach separately from relation count,
with one-to-many and many-to-one guards.

Two fresh validations launched from `68c37da59` at 2026-08-29 12:14 UTC.
`Weideriche_` used `~/temp/agent/validation-Weideriche-schema9-half-quorum-v12-20260829`.
Its first attempt refused slice 1 absolute naturalness at 4,840,305 milliseconds,
wrote no artifact or page,
and incorrectly queued whole-entry cache-warm reattempt.
Process was stopped after that behavior was rejected.

Pull request 386 `Carena0442` used exact pull-request files in isolated fixture at
`~/temp/agent/validation-pr386-Carena0442-schema9-half-quorum-v12-20260829`.
Process was stopped after same-model same-prompt repetition was rejected as independence mechanism.
It wrote no artifact or page.
Neither stopped run is publication or readiness evidence.
Artifact and log paths,
fixture method,
and failed startup non-evidence are recorded in
`~/temp/agent/pr386-Carena0442-run-provenance-20260829.md` and `doc/handover/translation-repair.md`.

The stopped runs are not completion-time samples.
Before another `Carena0442` launch,
completion-path work must target fresh-run median below two hours without weakening quality.
`doc/planning/translation-repair-entry-time-to-complete.md` defines phase attribution,
comparison controls,
completion evidence,
and objective.
Concurrent runs share provider capacity and are not matched runtime arms.

## Terminal quality-refusal audit, 2026-08-29 (superseded)

This is the audit as recorded on 2026-08-29 and is not standing guidance.
Its continuous-correction design was superseded:
`1ba8f713a` (2026-09-01) made consolidation a single attempt
and turned the final-selection gate into the reporter `finalSelectionFindings`,
and the finite producer constraints in `Standing redesign constraints` in the package README
replace its unbounded correction.
Present tense in this section describes the pipeline of that day.

Naturalness rejection no longer ends with `do not publish`:
consolidation cache generation 14 continuously corrects,
checkpoints payloads,
and pauses only on operational interruption or exact deterministic task cycle.
Publication gates remain strict.

Audited terminal and bypass findings are integrated as follows:

- Archive-only block repair landed in `ccaad1f53`,
  with contributor-floor test in `78ab244a2`.
  Preparation now scopes each unclaimed target block to expected aligned source section,
  requires exact anchored source support or deterministically shaped editorial apparatus,
  and lets any revise voice block retention.
  Retained wording receives defect-discovery naturalness review plus distinct acceptance challenge.
  Corrections preserve target-authoritative contributors,
  undergo independent whole-roster selection,
  splice in reverse offset order,
  and re-enter preparation before lanes.
  Exact correction and archive-state cycles pause as `INCOMPLETE`.
  A sibling revision intentionally causes remaining unclaimed blocks to be reviewed again;
  this costs calls but avoids carrying a license across changed parser locations and source context.
  The old `assertArchiveReviewed` terminal and `UnreviewedArchiveError` are removed.
- Unfilled-passage continuation landed in `ed756993b`,
  with cycle guard test in `1649c480d`.
  Translate version 11 produces from latest exact rejected slate and findings without finite correction count.
  Insertion placement rechecks latest semantic,
  destination,
  and shortfall evidence until admitted,
  proven carried elsewhere,
  operationally interrupted,
  or exact task cycle repeats.
  Carried passages map to `not-applicable` at insertion anchor;
  final would-ship page must retain every exact anchored region that proved full coverage.
  This exact-region rule can conservatively pause semantically equivalent rewrites as `INCOMPLETE`.
  `assertPublishableTranslation` is now defensive invariant and cannot trigger fresh whole-entry retry.
- Source-destination recovery landed in `0dc6e510c`.
  Translate version 12 excludes archive fallback that misses source atoms and continues as absent-mode translation.
  Ordinary repair-lane or archive standing is validated before consolidation eligibility,
  so a contest-endorsed linkless candidate enters version-16 recovery instead of becoming final.
  Final destination comparison runs before any page write and pauses as names-only `INCOMPLETE` invariant.
- Continuous final-selection recovery landed in `a84bb3a7a`,
  with role-alias guard in `f858ab538`.
  Consolidation version 16 treats every unendorsed or publication-ineligible standing baseline as unfinished.
  It threads prior selection slate,
  anonymized producer and judge roles,
  selection ballots,
  gate ballots,
  terminal,
  and findings into substantively distinct producer recovery.
  Recovery continues until a fresh consolidation wins selection and fidelity gate,
  provider operation stops,
  caller aborts,
  or exact evidence cycle repeats.
  Identical unsafe twins share one recovery chain;
  only final safe settlement persists.
  `assertFinalSelectionSettled` was then a defensive invariant,
  classified as `INCOMPLETE` rather than whole-entry quality retry;
  `1ba8f713a` (2026-09-01) removed it,
  and `finalSelectionFindings` reports the same condition beside the tally
  (`src/corpus-run/final-selection-completeness.ts`).
- One-sided front-matter support landed in `56a47cb81` and creates insertion slice for source-only metadata,
  deterministically admits it,
  and validates candidate against source YAML shape when archive has none.
  Target-only metadata remains exact archive content outside localized slices.
  Missing/misplaced slice and contradictory assembled-page structure pause as `INCOMPLETE` invariants;
  incumbent fallback and candidate YAML/schema invalidity remain handled before publication.
- `assertContributorNamesComplete` throws when final attribution drops target-authoritative public form.
  Consolidation cache generation 15 landed in `5211c54dd` and floors translation candidates,
  excludes unrepairable violator voices without fabricated authorship,
  rejects unsafe ordinary lane winners,
  and floors consolidation and polish candidates.
  Repair/refine text that differs reaches lane winner floor;
  uncontested identical text matches translate lane already floored.
  Invalid slate deterministically retains target-authoritative incumbent.
  Body-slice floor does not replace front-matter comment authority,
  which remains in metadata validator.
  Final completeness guard remains defensive.
  Cache generations move to translate 12,
  refine 4,
  lane contest 5,
  and consolidation 16.

- Visual-evidence guard landed in `d14e641e6` and gives each image retry substantively distinct responsibility:
  complete transcription,
  small text,
  layout,
  then identifier verification.
  Corroborated and reviewed no-text outcomes proceed.
  Missing or unavailable image-dependent evidence pauses as `INCOMPLETE` before lanes,
  so visual content cannot bypass publication review.

On a fresh corpus path under consolidation cache generation 14,
`assertFinalNaturalnessComplete` is runtime persistence invariant after continuous naturalness,
not ordinary quality outcome.
Existing artifact readers do not invoke it.
Parser,
ledger,
assembly,
filesystem,
provider,
and cancellation failures are operational errors rather than quality verdicts.
The code-level terminal-quality register is closed.
Continuous-repair verification is recorded in `doc/audit/translation-repair-continuous-repair-invariant.md`.
Fresh validation remains gated by Carena completion-path analysis.
Exact deterministic cycles deliberately pause as `INCOMPLETE` until strategy or evidence changes;
they never authorize fallback publication.

Corpus-readiness work is defect-driven:
once output proves reproducible systemic blocker,
stop unrelated corpus arms,
fix and verify blocker,
then rerun affected entry before resuming measurement.
More samples do not compensate for known mechanism.

Remaining corpus arms,
hard-case output reading,
live calibration checks,
site-grammar gaps,
package reading CLI,
Hyper catalog drift check,
and declined-archive seam remain open.
Read milestone figures as history:
they were measured under earlier pipeline shapes and none is readiness claim.
The evidence and traces of that period are in `doc/audit/translation-repair-output-reading-20260826.md`
and `doc/planning/translation-repair-corpus-overlap-measurement.md`.
