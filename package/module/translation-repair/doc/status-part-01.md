# Status, part 01

Part 01 of [Status](status.md),
whose index lists every part in order.

## Where the whole-package audit stands on 2026-09-27

The owner asked on 2026-09-27 for every mistake ever made in this package to be found,
fixed and recorded,
with no finding too small;
the findings,
their fixes and the process mistakes (M entries) are in
[the audit ledger](audit-ledger.md),
and the owner's rulings in [the design commitments](design-commitments.md).
Three passes have run since the audit began,
all of TianqiChen666:
TianqiChen66621 on 2026-09-28,
TianqiChen66622 on 2026-10-11 and TianqiChen66623 on 2026-10-12
(the repository's pass log,
`doc/planning/translation-repair-openrouter-2026-09-03.md`,
reads each).
The next waits for the rebuild of how the page-level consistency pass reads agreement and carries the bench's
choice (ledger B449,
B450).
The two Bedrock Gemma seats answer with an expired token and are withheld after their first failed calls;
no launch waits on them.

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
Measured on 2026-10-11 from each run log's ballot lines
(one line per ballot,
every line matched,
1,115 and 1,025):
TianqiChen66621 791 of 1,115 supported,
70.9%,
and TianqiChen66622 789 of 1,025,
77.0%.
Support rose rather than fell.
The baseline was read from a slice cache and these from logs,
over different slices of one entry,
so only the direction is evidence,
and it is not the drop the measurement was set to catch.

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
That batch (`9a362ba09` to `f9babaec4`) found four defects behind its cold lines:
the footnote relabel's ambiguity detail named a label by its folded key without its side,
the revision footnote floor passed a block the archive did not carry,
a definition move that would change the parse kept a sound rename back with it,
and the revision shape refusals listed shapes where a count belongs.
Its census (`census-JXU9Js` at `67f85061a`,
1,505 passes)
leaves library source at 711 stretches over 1,367 lines in 265 files,
with 14 functions never called.
It left two findings open,
and both are closed.
B80:
archive revisions were checked one at a time though they compose,
and each block is now reviewed in the page the revisions already applied leave.
B81:
the editorial-apparatus check vouched for a block on one of its lines,
and now every line a reader sees must be apparatus;
over the pinned archives it accepts the same 40 blocks as before.
The nineteenth batch took `corpus-run/run`
against the census taken after them (`census-EJl6yz`)
and closed B82:
the run timing readers read less than their writers write.
A round whose quorum never stood was left out of the report,
a round line short of its fields was refused for a missing unit,
a completion line without its outcome read as an empty one,
and calls spanning no time were divided by a zero span;
each is now read or refused by name
(`71f7720a9` to `37f637675`).
Its census (`census-IqLEk4` at `8175dc866`)
leaves library source at 693 stretches in 263 files,
and the twentieth batch took `corpus-run/heading`
(17 stretches over 25 lines in 3 files) against it.
It closed B83:
the heading collision restore paired headings by position across the page,
and where one replaced slice dropped a heading and another gained one,
it shipped a section the page never replaced as empty text
(`66927af39` and `339ce9118`).
It closed B84 on the same family inside one slice:
the heading series pass gave a section the wrong number,
and the contributor name pass wrote a signer's name over another section's title,
wherever a page slice dropped a heading
(`26e24853e` to `5f059feff`).
Every page pass now reads a slice's page text through one reader that refuses a slice it was not built from.
Its census (`census-STKkse` at `4c0039a57`)
leaves library source at 666 stretches in 260 files,
and the twenty-first batch took `assembly`
(16 stretches over 27 lines in 8 files) against the census taken after its docs (`census-zkJwfY`).
It closed B85:
the assembly guard's advancing withdrawal compared refusal offsets on two different pages,
so a whole replacement that only changed the length of the text before a break read as moving it
and was withdrawn in place of the broken one
(`9c007f857` and `a70c074a3`).
It closed B86 on the reader of those offsets:
a refusal was placed at the start of the span the parser named,
and one naming no span at the start of the body,
so withdrawing the break the parser named first read as moving the refusal back to the page's start
(`3086d2ffe` and `0e7353948`).
Its census (`census-dnr81C` at `9244d67d3`)
leaves library source at 650 stretches in 251 files,
and the twenty-second batch took `anthropic`
(16 stretches over 22 lines in 2 files) against the census taken after its docs (`census-lxT62v`).
It closed B87 to B91 against the Anthropic streaming and prompt-caching documentation:
the retry ladder took a body cut inside its last frame as whole and read an error event as a cut stream,
the prompt count left out the cache,
a missing answer fragment was dropped without a word,
a refused Anthropic body named the OpenAI-compatible contract,
and a delta type the scanner does not read was filed as reasoning inside a thinking block
(`57ffcf2dd` to `ef4cebc7e`).
Writing cases for the arms left lenient found two more:
B93,
the scanner passed delta frames and block starts it could not read without counting them,
and B94,
the reader reported a count the stream never sent as 0
(`ac4980b81` to `a41e6218b`).
B92,
`isJsonRecord` passing arrays,
is queued as a family of its own.
Its census (`census-Hq0z31` at `a41e6218b`)
leaves library source at 633 stretches in 249 files,
and the twenty-third batch takes `front`
(15 stretches over 20 lines in 3 files) against the census taken after this batch's docs.
That batch is done (ledger T8);
the twenty-fourth takes `page`
(13 stretches in 4 files)
against `census-3G9C58` at `d0cca211d`,
since B106 and B107 had cased the `corpus-run/attribution` arms queued before it,
and library source stood at 590 stretches in 242 files.
That batch is done too (`dc9f0449b`),
and six clusters of the same census went to agents at once
(`corpus-run/archive`,
`stream`,
`critic`,
`absolute`,
`corpus-run/runs`
and `reference`),
all merged after review (ledger T8).
The census's other 509 stretches,
with 14 functions never called,
are cut into 19 file-disjoint bundles;
the agents given the first five stopped part way at a usage limit.
Bundles 1 and 2 landed after review (`23090a91d`,
`ba6da4640`);
of bundles 3 to 5,
only two test files reached the branch (`98e94e584`),
and the cut itself was never committed,
so the next batch reads against a fresh whole-suite census.
B118 (test declarations nothing read,
and fixture exports nothing imported)
and B119 (16,856 lines ending in whitespace,
which `.editorconfig` forbids and nothing checked;
issue 585 asks for the repository-wide rule)
closed with a scan each,
B120 lets the global-writes scan follow a writer into the test files importing it,
B121 (one İ on a page switched off the archive-name casing veto) is fixed,
and B122 orders text by code point at every sort in production source,
with canonical JSON's key order the one named exemption.
Reviewing bundle 2 found B124
(a wet refuser held for no time ended a call as every provider dry)
and B125
(a decision seat's distribution recorded as an objection),
both fixed.
B33 and B34 closed on the way as well:
every artifact refusal reason the B33 census read now reads as what the reader expected,
and a marked refusal carries a caught error's text only from a catch narrowed to marked classes,
which `message-names-only.unit.test.ts` now checks at every construction.
The census reading leaves sources edited since its baseline out of its counts,
since it matches stretches by line (`d27a89dd0`).
On 2026-10-06 (UTC),
at `f8e99b84d`,
T8 has gone past the library:
the cold stretches a whole-suite census listed at `65bd3a645` were cased or made loud in three clusters,
and 34 runner commands in nine clusters hold their wiring and one call,
with their procedures in modules a test loads and a suite that runs each as built in a child holding no key.
Seven commands in three clusters were not merged at that commit,
and a final whole-suite census is still owed (ledger T8,
and B232 to B308 for everything found in that stretch).
Open:
T8 (code no unit test runs;
holding the launch for it is a quality call recorded for the owner to veto,
and these counts are the size of what it holds the launch for),
B123 (a link literal the parser leaves without a position makes the footnote relabel refuse the page,
reproduced on 2026-10-03),
B126 (an empty-label contributor link read as a contributor name,
the one case `98e94e584` fails),
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

From 2026-10-03 the owner is away for about 48 hours,
and a trial model,
MiMo 2.6 Pro,
works the package on the branch `translation-repair-mimo-trial`,
starting with B126;
its start point and log is `doc/handover/translation-repair-mimo-trial-2026-10-03.md` at the repository root.

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
