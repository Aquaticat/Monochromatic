# Translation repair: OpenRouter as the paid fallback provider, part 07

Part 07 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The ninth hakureico launch, four providers wet, 2026-09-08, 11:27 UTC

The owner topped OpenRouter up
(`openrouterUsd=200.01`)
and answered the single-provider question:
a pass whose writing bench has no reachable seat stops INCOMPLETE
([`translation-repair-writing-bench-floor.md`](../decision/translation-repair-writing-bench-floor.md)).
`budget-sample` at 11:26 UTC read every provider wet:
`syntheticWeekly=5.8%`,
Bedrock 198.71 USD,
Hyper 250,
OpenRouter 200.01 USD.
`hakureico` launched at 11:27:26 UTC on `061b46c0b`
(code `f7f9c9136`,
pipeline `e069d942`,
the eighth pass's build),
plain invocation,
runs dir `~/temp/agent/hakureico9-20260908`,
log beside it,
pid 4118147.
`JUDGE SEATS phase=preparation` read every provider wet and every bench whole:
`wide=8 select=8 late=9 slate=9 checkers=3 translators=7 readers=6 writers=9 roster=10 withheld=none waited=0ms`,
the first reading with six readers.
Launched before the writing-bench floor is built,
since a whole bench never meets it;
the floor is built in a throwaway worktree
(`~/temp/agent/tr-class15-20260908`,
branch `translation-repair-class15`)
and merged after the pass settles,
so the running worktree's source does not move under it.
The reading this page owes:
the consolidation by a whole bench,
which the sixth pass ran short of quorum from slice 3,
then the footnotes,
then every seats line and any shortfall line.

### The writing-bench floor, built in the throwaway while the ninth pass runs, 11:50 UTC

Built on branch `translation-repair-class15` in `~/temp/agent/tr-class15-20260908`
(commit `5ac7b6f49` on `1ddbcc75a`),
so the running worktree's source does not move under the ninth pass;
merged into `translation-repair-rebased` after that pass settles.

THE SHAPE:

-   `run-seats-floor.ts` (new):
    `WRITING_BENCHES` (editors,
    refiners,
    translators),
    `WRITING_BENCH_FLOOR = 2`
    (the pair a slate needs,
    the same number the readers are held to),
    `WritingBenchUnreachableError` (`messageNamesOnly`,
    as the visual-evidence stop),
    `benchesOf({ seats })` naming every bench the readings look at,
    and `unreachableWritingBenches({ benches, names, dry })` returning clauses like
    `editors 0 of 3 reachable, floor 2`.
-   `run-seats-wait.ts`:
    `BenchName` gains `editors` and `refiners`,
    and the lanes phase leans on wide,
    editors,
    refiners and translators.
    The quorum clauses keep their majority threshold,
    so the thirteenth class's wait is unchanged:
    a bench short of its majority under a named hold still waits.
-   `run-seats-read.ts`:
    every phase reading computes both the quorum shortfall and the floor shortfall.
    With no hold,
    a judge bench short of quorum runs and says so (as since `c4a9682fe`),
    and a writing bench below the floor throws the error,
    which the entry queue records as INCOMPLETE
    (`stage-local work remains; whole entry will not restart in this invocation`).
    Under a hold the reading waits once,
    reads again,
    and throws if a writing bench is still below the floor.
    The per-chunk reading still costs nothing while nothing is held,
    so a bench lost inside a phase with no hold finishes the phase,
    as the sixth pass did;
    that case is recorded as unsettled in the decision.
-   Tests:
    `run-seats-floor.unit.test.ts` (new,
    the eighth pass's view at the lanes and the translate lane,
    nothing at consolidation or the pictures,
    the error's message),
    two cases in `run-seats-read.unit.test.ts`
    (stop with nothing to wait for;
    wait once then stop,
    or seat when the wait brought the bench back),
    and the lanes clauses in `run-seats-wait.unit.test.ts` now name editors and refiners.
    Guards neutralised 2,
    2,
    2 and 3 `FAIL`;
    restored 0.

WHAT THE EIGHTH PASS WOULD HAVE DONE ON THIS BUILD:
stopped at 02:21:13 UTC at the lanes reading with
`writing bench unreachable at lanes: editors 0 of 3 reachable, floor 2; refiners 0 of 3 reachable, floor 2;`
`translators 1 of 7 reachable, floor 2`,
after its pictures and for the Bedrock cost of the pairing and the pictures alone.

### The ninth pass settles in 83 minutes on a whole bench; the name two rules render differently, 12:50 UTC

`TALLY hakureico status=SETTLED slices=18 repairStatus=repaired repairIssues=134 repairAccepted=90 repairResolved=85`,
`repairFindings=226 repairChanged=13 translateStatus=complete translateChanged=17 documentsDiffer=16`,
`pageChanged=16 pageSilent=0 alignmentFindings=4 selection=contested ms=4998984`:
83.3 minutes,
zero `[error]` lines,
`publish: wrote 18 slices into a page of 4878 characters` at 12:50:44 UTC.
Six `JUDGE SEATS` lines,
every provider wet on each,
`wide=8 select=8 late=9 slate=9 checkers=3 translators=7 readers=6 writers=9 roster=10 withheld=none waited=0ms`,
no shortfall line,
no `quorum-not-met`,
no `chunk resumes`,
no hold named.
The phases:
pictures at 11:28:41 UTC,
lanes at 11:35:04 UTC,
translate lane at 12:01:28 UTC,
lane contest at 12:16:47 UTC,
consolidation at 12:21:04 UTC.

WHAT A WHOLE BENCH BOUGHT,
the reading this page owed:
`photo1.webp` corroborated by 5 readers at overlap 0.878
(`hf:zai-org/GLM-5.3-Flash` failed outright on it,
its stream cut),
`photo2.webp` by 6 at 0.949.
The repair lane changed 13 slices
(134 issues,
90 accepted,
85 resolved),
the translate lane 17,
and 16 of 18 differed between the lanes.
The contest,
9 ballots on every slice but one (8),
gave 12 to translate,
2 to repair,
2 to neither;
the closest splits 4/4/1 on slice 5,
4/3/1 on slice 12 and 3/2/4 on slice 13.
The consolidation ran all 16 contested slices on 9 of 9
(two rounds on 8 of 9):
7 consolidated,
3 `slate-endorsed-standing`,
5 `gate-kept-standing`,
1 `slate-unjudged-standing`;
18 naturalness-review rounds,
every one 9 of 9 heard;
2 slices recorded `standing text lacks contest endorsement and remains retryable`.
The sixth pass's consolidation had run short of quorum from slice 3;
this one never did.

WHAT IT COST.
Synthetic's week went from 5.83 percent to 0 at 12:25 UTC
(615 calls);
at 12:26:22 UTC Synthetic answered HTTP 429 with its meter reading dry,
was held out 300 s and the call routed on.
Hyper's balance went from 250 to 0 at 12:45 UTC
(898 calls).
Bedrock 198.71 to 198.39 USD
(463 calls).
OpenRouter 200.01 to 199.56 USD:
33 calls,
every one after 12:45:53 UTC when Hyper's meter read dry,
the first paid OpenRouter calls that were not 402s.
Both went dry inside the consolidation;
the per-chunk reading costs nothing while nothing is held,
no provider named its return,
and the phase finished on Bedrock and OpenRouter.
The floor merged afterwards would not have stopped it,
and Bedrock with OpenRouter reaches every bench at every phase
(measured on the merged build:
no shortfall clause and no floor clause under `synthetic=dry hyper=dry`).
One entry of 18 slices consumed the remainder of a Synthetic week and a Hyper day.

WHAT THE WARNINGS SAID:
30 `abandoned after quorum, voice lost`
(`hf:Qwen/Qwen3.8-27B` 15 across select,
panel,
consolidate-gate,
produceConsolidations,
critic and polish-gate;
`hf:zai-org/GLM-5.3-Flash` 6;
`hf:moonshotai/Kimi-K3` 3;
`glm-5.3` 3;
`minimax-m3` 1),
8 `hf:openai/gpt-oss-120b` schema-mismatch,
1 select recovery round,
2 stream cuts retried,
1 `translate-refused-declared-name`.

THE MECHANICAL READING (`read-page.mjs`,
calibrated on the eighth pass's recorded page first):
196 lines against the archive's 158 and the sixth pass's 195;
176 lines differ from the archive,
122 from the sixth pass's page;
headings 3 of 3,
comments 3,
`PhotoScroll` kept,
0 straight apostrophes in words (5 curly against the archive's 8),
0 straight double quotes (14 curly against 18),
2 three-dot ellipses and 0 unicode
(archive 0 and 0;
the source's one `……` rendered twice around `Though... many of those journeys were ones she took alone...`),
both footnote markers and both definitions,
every refusal grep 0,
CJK punctuation and runs equal to the archive's (the comments and the Japanese quote).
The details block carries the Japanese and English lines as the archive does,
where the sixth pass's page had kept the source's Chinese lines beside the English.
One em-dash on the page,
none on the archive page;
38 of 92 archive pages carry 228 of them,
so it is within the archive's conventions.
A run of three blank lines between the letter's blockquote and the closing sentence,
where source,
archive and sixth pass have one:
a seam artefact that renders the same.
No defect class on this page.

THE NAME,
the sixteenth thing found,
a question and not a defect.
The archive's front matter reads `name: Hanasaka`,
alias `Kagurazaka Hanasaka, Hakureico`;
the source's,
`name: 神楽坂千歌`,
alias `千歌, Hanasaka, Hakureico`.
The translate lane wrote `name: Kagurazaka Chika`,
alias `Kagurazaka Chika, Chika, Hanasaka, Hakureico`;
the repair lane kept the archive (`incumbent-fallback`);
the contest gave the slice to translate 6 ballots to 3,
the three reasoning that the declared names settle the visible name as Hanasaka,
the six that 千歌 is Chika and the alias should carry the given name;
the consolidation slate endorsed it 9 of 9.
In the body the repair lane's judges chose Chika for the IKEA sentence 8 of 8 at 11:41 UTC,
the consolidation's refine stage chose it again,
and the guard refused it at 12:28 UTC:
`translate-refused-declared-name (slice 4: archive text carries "Hanasaka" and the replacement does not;`
`keeping the archive text)`;
the letter's signature stays `Kagurazaka Hanasaka`.
Both are the rules as written:
`document-preparation.ts` takes the declared forms from the target's front matter
("target-authoritative identity forms guards preserve wherever archive body already carries them"),
and `translate-slice.ts` exempts the front-matter slice from that guard
("front matter is where declarations themselves are corrected from source,
so protecting target values there would make metadata unrepairable").
So the page names her Kagurazaka Chika at the top and Kagurazaka Hanasaka at the letter's foot,
and no rule reads both.
Recorded in the readiness signal for the owner.

THE FLOOR MERGED.
After the tally,
`translation-repair-class15` was rebased onto `aa133492d` and fast-forwarded:
`d74ef4a43` (the floor) and `977c242c1` (the names-only inventory);
built in the main worktree,
954 `PASS` and 0 `FAIL`;
the throwaway worktree,
its local branch and its remote branch removed.

### The front-matter rule, the sixteenth thing decided and built in a throwaway, 13:45 UTC

The owner answered the name question with a question:
"We're not supposed to change front matter though?"
Measured before answering:
the front matter is slice zero,
written by the translate lane from the source
(the repair lane has always kept the archive's,
`frontMatterRepairOutcome`),
judged at the contest and endorsed or consolidated like every other slice,
and the guard checks structure only (the 2026-09-02 decision,
on the owner's "why are we caring about metadata being different vs Chinese source at all?");
13 of the 127 pages shipped under `~/temp/agent` changed the archive's front matter,
9 of the last 10 read pages among them,
and the read-page checks never diffed it,
so TLL1122's `desc` "Lulu loves you!",
yulianNyanner's "In the end,
we heard her voice."
and Hangmster's "They had brought us laughter."
were rewritten on pages read as "no class found".
The owner chose,
of three,
"publish the archive's front matter as is;
render it only where the archive never translated it"
(`doc/decision/translation-repair-front-matter-guard.md`,
addendum 2026-09-08).

BUILT ON `translation-repair-front-matter` in `~/temp/agent/tr-frontmatter-20260908` (`20e5135a6` on `5462257b4`),
since the E2B calibration runs on the main worktree's build and the kill-and-relaunch rule holds for it too;
merged after the calibration's standing is printed.
The shape:
`corpus-run/archive-front-matter.ts` decides `archiveFrontMatterStands` from the two documents
(the archive stands unless it shows the directory id while the source names the person and no 2026-09-07 clause makes
the id stand),
`pass-prepare.ts` decides it once per entry and logs `FRONT MATTER entry=<id> authority=<archive|rendered>`,
`prepareDocumentPair` makes no metadata slice under `frontMatterAuthority: 'archive'` and marks the preparation,
`assertFrontMatterComplete` recomputes the answer and refuses `archive-front-matter` for a changed page or a rendered slice,
and artifact generation eleven records `frontMatterAuthority` in its preparation,
which the rebuild reads off the file.
`namesDirectoryId` moved beside `directoryIdNameStands`,
and the artifact reader's two field helpers moved to `artifact-two-lane-read-fields.ts` to stay under the file budget.
Types and oxlint clean;
955 `PASS` and 0 `FAIL`;
guards shown to fail first (predicate 4,
7 and 2;
preparation 2,
2 and 2;
guard branch 7 and 2),
restored 0.

THE CENSUS,
measured on the merged build's predicate over the 92 pinned archives:
every one stands.
23 name their directory,
8 because the source does too,
and the other 15 all stand by the clauses of 2026-09-07.
So the lanes will render no front matter on this corpus,
every page from here carries the archive's metadata byte for byte,
and the mechanical reading gains a check for exactly that.
The ninth pass's page,
re-read under the rule,
would carry `name: Hanasaka` and the archive's alias,
and the body would agree with it.

## The E2B calibration prints its standing; the translator seat, 2026-09-08, 16:07 UTC

`producer-calibrate 40 --candidates google.gemma-4-e2b` (pid 87207,
launched 13:07:14 UTC on `5462257b4`,
log `~/temp/agent/producer-calibrate-e2b-20260908.log`,
runs dir beside it holding only the candidate ledger)
printed `STANDING over 40 rounds` at 16:07:09 UTC,
10795 s wall clock,
about four and a half minutes a slice.
Read by the scratch `read-standing.mjs`,
proven first on the 2026-09-01 log
(pooled null 13.0 percent,
z -4.53 and -4.55 for the two writers dropped that day,
threshold 2.77 for nine comparisons,
all as the seating decision records).

Standing as printed,
best first,
with the availability-adjusted share where it differs and the z against the pooled null of 12.8 percent
(308 disinterested wins over 2413 ballots,
Bonferroni two-sided threshold for ten comparisons z 2.81):

-   `hf:Qwen/Qwen3.8-27B`:
    24.4 percent (55 of 225 disinterested ballots,
    over 35 candidates),
    adjusted 21.4,
    z +5.25
-   `gemma-4-26b-a4b-it`:
    21.3 (56 of 263,
    over 40),
    adjusted 21.3,
    z +4.14
-   `hf:moonshotai/Kimi-K3`:
    16.2 (42 of 260,
    over 40),
    z +1.64
-   `minimax-m3`:
    11.6 (30 of 258,
    over 40),
    z -0.55
-   `hf:zai-org/GLM-5.3-Flash`:
    11.1 (24 of 217,
    over 35),
    adjusted 9.7,
    z -0.75
-   `glm-5.3`:
    10.7 (17 of 159,
    over 25),
    adjusted 6.7,
    z -0.78
-   `google.gemma-4-e2b`:
    10.1 (30 of 298,
    over 39),
    adjusted 9.8,
    z -1.40
-   `deepseek-v4-pro-0813`:
    7.8 (19 of 243,
    over 39),
    adjusted 7.6,
    z -2.31
-   `deepseek-v4-flash-0731`:
    7.6 (18 of 236,
    over 40),
    z -2.36
-   `hf:openai/gpt-oss-120b`:
    6.7 (17 of 254,
    over 40),
    z -2.90

Slice-clustered (37 winner-bearing rounds over 37 slices,
top-three inclusion over 4000 resamples of whole slices):
Qwen3.8-27B 91.7 percent,
gemma-4-26b-a4b-it 83.8,
Kimi-K3 83.0,
E2B 12.9,
GLM-5.3-Flash 12.2,
minimax-m3 7.1,
glm-5.3 7.0,
the deepseeks under 2.

`SEAT` lines,
asked and usable:
minimax-m3 87 and 87;
glm-5.3 87 and 46 (41 thrown);
deepseek-v4-flash-0731 88 and 88;
google.gemma-4-e2b 94 and 94;
deepseek-v4-pro-0813 88 and 85;
gemma-4-26b-a4b-it 86 and 86;
gpt-oss-120b 89 and 89;
Qwen3.8-27B 84 and 71;
Kimi-K3 88 and 84;
GLM-5.3-Flash 87 and 73.
E2B's 94 completed streams:
p50 1.6 s,
p90 2.5 s,
max 5.1 s;
no warning names it.
The warnings the run did carry:
the cut-mid-reply abandonments the thrown counts sum,
one Qwen3.8-27B and one GLM-5.3-Flash `StreamCutShortError` retried,
eight `InStreamProviderError` 504s on OpenRouter streams (Together six,
Reka one,
Wafer one) between 15:25 and 15:59 UTC,
each retried at attempt 1 and answered,
and one gpt-oss-120b schema mismatch in the last slice's repair round.

THE SEAT,
by the rule as applied on 2026-09-01
(a writer leaves the seat when its z crosses the Bonferroni threshold below the pooled null;
the two dropped that day sat at -4.5):
E2B at -1.40 is not separated from the null,
so it takes the translator seat,
and with it the consolidation seat every measured writer holds.
Landed as `169a86173`:
`WRITER_UNMEASURED` empty,
`RUN_WRITERS` filtered off `RUN_ROSTER`,
translators eight (quorum 4),
consolidation writers ten;
the guard in `run-seats.unit.test.ts` shown to fail first on the old build
(`expected false to equal true` at the translators check);
oxlint,
types,
954 `PASS` and 0 `FAIL`.
Two fixtures moved with the fact:
on Bedrock alone the translators bench now reaches the pair
(`gemma-4-26b-a4b-it` and E2B),
so the class-fifteen cases stop at the editors instead,
and the one-translator shape of the eighth pass is kept on the roster of that day.
Decision:
the addendum of 2026-09-08 in `translation-repair-roster-seating-2026-09-01.md`.
Not acted on:
gpt-oss-120b below the null again (z -2.90),
deepseek-v4-flash-0731 not this time (-2.36),
deepseek-v4-pro-0813 at -2.31;
the 2026-09-01 drops stand on their own measurement.

## The front-matter branch merges; the tenth hakureico launch, 2026-09-08, 16:18 UTC

With the standing printed,
the throwaway branch was rebased onto `ab0e9f0e9` as `d11f36799`
(built,
types and oxlint clean,
954 `PASS` and 0 `FAIL` in the throwaway;
the 955 written earlier was a miscount of the same set),
fast-forwarded into `translation-repair-rebased` and pushed,
then built and proven again in the main worktree (954 and 0);
the worktree `~/temp/agent/tr-frontmatter-20260908` and both branches are gone.
The seat landed on top as `169a86173`.
`hakureico` launched at 16:18:30 UTC on `169a86173`
(pipeline `697d9d67`),
plain invocation,
runs dir `~/temp/agent/hakureico10-20260908`,
log beside it,
pid 276432.
The first lines the rule and the seat owe:
`FRONT MATTER entry=hakureico authority=archive: the archive translated it, so it ships as it stands and no lane
writes it`,
and `JUDGE SEATS phase=preparation synthetic=dry bedrock=wet hyper=dry openrouter=wet wide=7 select=7 late=8
slate=8 checkers=3 translators=7 readers=5 writers=9 roster=9 withheld=hf:moonshotai/Kimi-K3 waited=0ms`:
Synthetic's window at zero after the calibration and Hyper at zero credits,
so Bedrock and OpenRouter serve the pass,
Kimi-K3 withheld as the OpenRouter-cost seat,
and every count is the seated roster less that one
(translators 8 less one,
writers 10 less one,
roster 10 less one).
What the page must show when it settles:
front matter equal to the archive's byte for byte
(`read-page.mjs` prints `frontMatterEqualsArchive`),
`artifactSchemaVersion: 11` with `frontMatterAuthority: 'archive'` in the preparation,
and E2B's candidates and ballots in the translate lane.

## The tenth pass is killed at 37 minutes; the seventeenth class, 2026-09-08, 16:55 UTC

The tenth pass lost five deepseek-v4-flash-0731 voices between 16:37 and 16:49 UTC,
one critic and four select ballots,
every one a `schema-mismatch` whose raw opening doubled:
`{   "issues":{     "issues": [`,
`{"best": 1{"best": 1, "reason": ...`,
`{"{"best": 1, "reason": ...`,
`{"{"best": 1, ...`,
`{"best": 2{"best": 2, ...`.
Each stream was served by OpenRouter's Makora endpoint and carried reasoning
(391189 raw characters and 11635 reasoning characters on the critic,
153070 and 4214 on the first select),
where the model's clean replies that same quarter hour came from Together with no reasoning and 2000 raw characters.
Read back through the ninth pass (all four providers wet):
of its eight mismatches,
six were gpt-oss-120b through Bedrock with the same doubled opening
(`{ {   "choice`,
`{  {"choice"`,
`{"{"resolution`,
`{"{ "resolut`),
every one on a stream with reasoning characters;
the sixth pass,
on Synthetic and Hyper with no reasoning streams,
had none of that shape.
THE SEVENTEENTH CLASS:
a reasoning stream opens its answer,
abandons the opening,
and writes the whole object after it,
and the reply ladder refused the whole as unparseable.
The object after the fragment is the answer,
and the fragment's whitespace differs from the object's
(`{   "issues":` against `{     "issues": [`),
so this is the model writing twice,
not a client appending a retry to a partial buffer:
the retries the log carries are minutes away from the mismatches and name other models.

Landed as `8bf9deec0`:
`json-false-start.ts` reads the object past the opening
(`readJsonPastFalseStart` tries each brace inside the first 256 characters as the start until one parses to the end;
`parseAnswerJson` parses the whole first and reads past only when the whole fails),
the reply ladder in `chat-json-outcome.ts` calls it where it called `parseModelJson`
and warns `json false start: read the object past an abandoned opening of N chars`,
and the caller's guard still judges what was read.
Guards:
the five observed shapes read with their abandoned lengths (10,
2,
2,
3,
13),
a cut reply,
a reply that opens no object and an opening past the window read nothing,
and the ladder case (`READS PAST an abandoned opening ahead of the object`) failed first on the old build
(`expected 'schema-mismatch' to equal 'ok'`).
Types and oxlint clean;
956 `PASS` and 0 `FAIL`.

The tenth pass was killed at 16:55:44 UTC (pid 276432,
37 minutes,
in the repair lane at its sixteenth chunk) under the kill-and-relaunch rule.
What it had shown before the kill:
`FRONT MATTER entry=hakureico authority=archive` on its first reading;
Synthetic's rolling window returned at 16:27:29 UTC,
nine minutes into the pass,
and served 186 calls after it;
Bedrock 191 calls for 0.09 USD;
OpenRouter 275 calls for 0.57 USD;
one minimax-m3 select reply ended at its content bound (32003 characters against 32000,
`StreamOverrunError`,
voice lost),
one gpt-oss-120b `StreamCutShortError` retried,
one in-stream 504 retried.

## The eleventh hakureico launch on the false-start build, 2026-09-08, 16:56 UTC

`hakureico` launched at 16:56:22 UTC on `8bf9deec0`
(pipeline `f39a482e`),
plain invocation,
runs dir `~/temp/agent/hakureico11-20260908`,
log beside it,
pid 297691.
`JUDGE SEATS phase=preparation synthetic=wet bedrock=wet hyper=dry openrouter=wet wide=8 select=8 late=9 slate=9
checkers=3 translators=8 readers=6 writers=10 roster=10 withheld=none waited=0ms`:
the first seat line with eight translators and ten writers,
every bench whole on three providers,
Hyper at zero credits.
`FRONT MATTER entry=hakureico authority=archive` on the same reading.
What the page must show when it settles:
the front-matter and artifact checks of the tenth launch,
E2B's candidates and ballots in the translate lane,
and every `json false start` line a voice kept where the tenth pass lost one.

## The eleventh pass is killed at 85 minutes; the eighteenth class; the twelfth launch, 2026-09-08, 18:21 UTC

What the eleventh pass showed before it was killed.
`FRONT MATTER entry=hakureico authority=archive` at 16:56:23 UTC.
The pictures phase lost one GLM-5.3-Flash reading of `photo1.webp` to the 360000 ms deadline after
3.5 M characters (17:04:29 UTC);
five readers remained.
Synthetic's rolling week ran dry at 17:21:15 UTC inside the lanes phase
(`markRefused synthetic: refused us while its meter reads dry ... held out for 300000ms`,
six calls in ten seconds,
each routed to the next provider),
and the translate lane opened at 17:51:13 UTC on
`synthetic=dry bedrock=wet hyper=dry openrouter=wet wide=7 select=7 late=8 slate=8 checkers=3 translators=7
readers=5 writers=9 roster=9 withheld=hf:moonshotai/Kimi-K3`.
E2B wrote and voted in that lane:
`candidate 1 from google.gemma-4-e2b won weight 3 across 7 ballots` at 18:03:02 UTC,
the lane's other winners Qwen3.8-27B (twice),
a GLM-5.3-Flash and glm-5.3 composite,
GLM-5.3-Flash,
minimax-m3 and gemma-4-26b-a4b-it (twice).
Four `json false start` lines,
every one Bedrock's gpt-oss-120b (`served=openai.gpt-oss-120b`,
2291 reasoning characters on the first),
abandoned openings of 2,
3,
2 and 3 characters,
and no `schema-mismatch` beside any of them:
the seventeenth class's fix read live.
Two transport failures retried on the first attempt (a 503 from Together at 17:31:59 UTC,
a 502 from NextBit at 17:39:42 UTC).

The one lost voice,
18:08:45 UTC in the lane contest:
`lane-contest deepseek-v4-pro-0813: schema-mismatch (content is not valid JSON: SyntaxError: Unexpected end of
JSON input (model stopped with finish_reason=error)) raw="", voice lost`,
on a stream served by CoreWeave that completed after 24291 ms with 315414 raw characters,
8284 reasoning characters,
0 content characters and a cost of 0.
The provider had marked the generation failed and the ladder counted the failure as the model's answer.
Read back across the logs since 2026-09-03 with `finish_reason=error`:
seven replies in four passes
(`openrouter-live3-20260903` two GLM-5.3-Flash translations on Together,
`mtf_0615-shapes-20260904` one GLM-5.3-Flash refiner on Together,
`Uekawakuyuurei-pictures-20260904` one gpt-oss-120b probe and one GLM-5.3-Flash consolidation on Together,
and this one),
every one through OpenRouter,
every one with no content,
every one a lost voice.
OpenRouter's API reference (read 18:10 UTC) normalizes `finish_reason` to `stop`,
`length`,
`tool_calls`,
`content_filter` and `error`;
its errors page draws the mid-stream failure as a chunk with a top-level `error` object,
`finish_reason: "error"` and the stream terminated,
which `requireNoStreamError` has read since 2026-09-04.
These seven passed that check (no error object) and the terminator check (`[DONE]` present),
so the wire shape is one the reference does not draw:
the choice closed on the error finish and the stream terminated normally.
THE EIGHTEENTH CLASS.

Fixed as `bb04656ef` (18:21 UTC):
`openrouter-error-finish.ts` reads any choice whose `finish_reason` is `error`,
carrying `native_finish_reason` when the gateway forwarded one;
`openRouterStreamErrorOf` asks it when no chunk carried an error object and reports `code unnamed`,
the native reason or `error-finish` as the kind,
and the endpoint;
`requireNoStreamError` throws the same `InStreamProviderError`,
so the call rides the retry ladder (five attempts) under its own name.
The guard was shown to fail first against the old build
(`expected { found: false } to deeply equal { found: true, code: 'unnamed', ... }`,
and the new module's suite could not import its export);
oxlint 0 and 0,
types clean,
957 `PASS` and 0 `FAIL`.

The eleventh pass was killed at 18:21 UTC under the rule,
85 minutes in,
inside its consolidation
(the translate stage of a slice had just settled on the incumbent;
three select judges abandoned 120000 ms after quorum).
`hakureico` relaunched at 18:21 UTC on `bb04656ef` (pipeline `920ee70b`) into `~/temp/agent/hakureico12-20260908`,
log beside it,
pid 369919;
`JUDGE SEATS phase=preparation synthetic=dry bedrock=wet hyper=dry openrouter=wet wide=7 select=7 late=8 slate=8
checkers=3 translators=7 readers=5 writers=9 roster=9 withheld=hf:moonshotai/Kimi-K3 waited=0ms`
and `FRONT MATTER entry=hakureico authority=archive` at 18:21:58 UTC.
What the page must show when it settles:
the eleventh's checks,
and no `schema-mismatch` line naming `finish_reason=error`;
an `InStreamProviderError` line with `code unnamed` is the class caught.
