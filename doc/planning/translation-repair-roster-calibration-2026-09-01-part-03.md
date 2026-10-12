# Roster calibration under the owner blocklist, 2026-09-01, part 03

Part 03 of [Roster calibration under the owner blocklist, 2026-09-01](translation-repair-roster-calibration-2026-09-01.md),
whose index lists every part in order.

## The Toka_ls relaunch was killed at 77 minutes, in consolidation

At 04:02:54 UTC both background tasks of this session,
the Toka_ls launcher and the queued chain,
were
reported killed at the same moment.
I did not stop them;
the pass process died with the launcher's process
group (`sh exited with non-zero status: no exit status`,
`Finished in 4623.56s`).
No TALLY,
no artifact,
no
page.
The chain never reached the meter gate,
so Carena0442 did not launch.
The cause is outside this
session's tool calls and I cannot name it from here.

Where it was:
repair,
refine and translate lanes settled (14,
15 and 16 cache records),
lane contest 15 of
16 slices (15 differ),
consolidation 2 of 16,
killed inside `settleConsolidation` with 0 holds and 0 429s.
The cache is keyed by a digest over `dist/final/node` (`corpus-run/pipeline-digest.ts`),
and the guard
commits changed those bytes,
so a rerun on the current build starts from zero:
about 77 minutes at
overlap 2 to the same point,
longer to a page.
Synthetic's weekly read 2.0% at 04:02,
draining at 2.7
points an hour,
so a rerun launched now runs Hyper-only inside the hour,
the #474 shape.
Not relaunched.

What the run measured before it died,
all off `~/temp/agent/pin-relaunch-Toka_ls-20260902.log`:

- Writer rounds under the 180 s writer dial were full:
  editor 36/36 over 12 rounds,
  refiner 15/15 over 5,
  translate 110/112 over 16,
  consolidation refiner 6/6.
  One writer cut in the whole run (GLM-5.3-Flash at
  180 s).
  The dial did what it was added for.
- The 60 s round window cut GLM-5.3-Flash in 12 of 13 panel rounds,
  12 of 21 translate select rounds,
  11 of
  29 repair select rounds,
  11 of 15 critic rounds and 5 of 15 contest rounds:
  51 of the run's 78 cuts,
  every
  one at 60 s.
  Qwen3.8-27B took 15,
  Kimi-K3 6,
  minimax-m3 4.
  Every round reached quorum (0 quorum-unmet
  lines).
  Four rounds declined in the whole run:
  a repair select tie at weight 4 with all 8 heard and a
  contest "neither" with 9 of 9 usable,
  neither caused by a cut;
  and two translate select rounds that were
  cut-starved,
  a 6-of-8 tie at weight 2 and a 5-of-8 leader at 1.5 with one abstention,
  each decided in the
  challenge round that followed (8 of 8 heard,
  Kimi-K3 at 5.5;
  5 of 8 heard with three cuts,
  gemma at 4).
  One more round decided at weight 2.5 with GLM-5.3-Flash and minimax-m3 cut.
  So the cuts cost two
  challenge rounds and thinner margins,
  never a final decision.
  Whether GLM's ballot is worth two extra
  minutes per judge round (about 100 such rounds an entry) is the owner's speed-versus-completeness call,
  listed under decisions.
- The metadata slice (slice 0) is a live instance of the contest-keep case the reshaped guard leaves open.
  Source `name: 左橋瞳華 / alias: 瞳華 / location: 上海`;
  archive `name: Toka Sakyo / alias: Nonamev /
  location: Shanghai`.
  The translate lane's seven translators agreed on `alias: Toka` and the judges chose it
  6 of 8 ballots at weight 3.5 (`decision=judged origin=fresh changed=true`),
  the lane contest then ran,
  and
  the consolidation gate settled 9 of 9 on the standing text,
  which is the archive's `alias: Nonamev`
  (`terminal: gate-kept-standing`).
  Consolidation itself had chosen `alias: Toka` at weight 4.5;
  the
  fidelity gate reversed it 6 ballots to 2,
  every standing ballot reasoning that the declared names attest
  the alias as `Nonamev` and `Toka` is an unattested rendering,
  the two consolidated ballots reasoning that
  the source's alias is the given-name part of the name and `Toka` is that part of `Toka Sakyo`.
  That is a
  review of the incumbent by a full panel,
  with the house rule on both sides.
  The contest verdict for the
  slice,
  read off the record whose ballots argue about the alias (`contest.513b69ae`):
  the repair lane won
  with 9 of 9 usable ballots,
  "'translate' gives the alias as 'Toka' where the declared facts attest
  'Nonamev',
  so 'repair' matching all attested renderings is the faithful choice",
  which is the
  `lane-won repair` the contest-first walk needs and not an unendorsed `neither`.
  The final page would carry the archive's metadata byte for byte with a
  translate selection reading judged,
  fresh,
  shipped:
  the reshaped guard refuses that as
  `incumbent-fallback: replacement-not-carried`,
  the 2026-08-28 rule refused it too,
  and 503ec902c would
  have published it.
  An eight-ballot gate keeping the archive six to two is a review of it,
  so the
  standing now reads the stage that shipped the text,
  the way `wouldShipTextFor` walks consolidation,
  contest and lanes (commit `6f70a2085`,
  `corpus-run/front-matter-standing.ts`).
  On the record,
  both runs against the real Toka_ls
  cache records (translate selection,
  gate ballots `csscssss`,
  terminal `gate-kept-standing`):
  before,
  standing `replaced` and the guard refused `incumbent-fallback: replacement-not-carried`;
  after,
  standing
  `gate-keep` with 8 usable ballots and the guard accepted.
  The gate's ballots are re-settled with the
  stage's own `settleGateBallots`,
  so a gate that settled `neither` under the same terminal stays a
  fallback (`gate-neither`);
  a contest that chose the lane carrying the archive's bytes,
  or endorsed the
  archive when it chose neither,
  is `contest-keep`;
  a consolidation slate that endorsed the standing text is
  `slate-keep`;
  every other terminal or verdict is a fallback named after it.
  Recorded for veto as
  restoring the 2026-08-28 intent:
  reviewed metadata publishes,
  unreviewed refuses.
  The sol review of that commit (`~/temp/agent/sol-front-matter-standing-review-20260902.txt`) named two
  real gaps,
  fixed by commit `1160ebb4c`:
  the walk read consolidation first,
  so a contest that settled
  neither without endorsing the archive could be promoted to a reviewed keep by a slate endorsement or a
  quorum-backed gate,
  which contradicts `contestStandingMayShip` (the standing baseline may ship unchanged
  only when the contest chose a lane or endorsed the archive);
  and a contest's review of the archive was
  erased by consolidation terminals that merely left the standing text alone (`incumbent-only`,
  `slate-unjudged-standing`,
  `slate-declined-standing`,
  `wrap-erased-difference`,
  a gate that settled
  neither).
  The walk now reads the contest first,
  passes an unreviewed baseline through untouched,
  keeps a
  reviewed one through every transparent terminal,
  and adds a review only where the slate endorsed the
  standing text,
  the gate kept it with its quorum (two ballots,
  the stage's own),
  or the gate accepted a
  consolidated candidate carrying the archive's bytes;
  gate ballots that re-settle against their terminal
  are named `gate-ballots-contradict-terminal`.
  The Toka_ls records still read `gate-keep` with 8 usable
  ballots and the guard still accepts.
  Two review points stand as recorded rather than acted on:
  the
  classifier tests hand-assemble records (a lane-won verdict with no ballots) rather than driving the real
  settlers,
  and the equality relation is raw bytes at every step,
  which is also what the guard compares.
- Slice 15 is the first live matched-keep:
  `decision=sole-candidate origin=incumbent`,
  incumbent producer
  matched by all seven translators.
  The `matched` list is filled in practice.

## The Toka_ls rerun ended INCOMPLETE at 117 minutes, on a guard the no-loop design had superseded

The rerun of 08:39 to 10:37 UTC on `8e3171b34` exited 0 with `TALLY Toka_ls status=INCOMPLETE ms=7063121
error=slice 10 did not meet absolute naturalness floor`:
no page,
no artifact,
the real clone clean,
0
refusals and 0 holds in 7,063 seconds.
Seats:
GLM-5.3-Flash threw 78 of 211 (the 60 s window,
as
before),
Qwen3.8-27B 24 of 212,
every other seat 3 or fewer.

What happened to slice 10 (the 29-line letter in blockquote that follows the 《奇妙漂流》 sentence),
read
off the log and the source:

- The lane contest settled on neither lane without endorsing the archive,
  so the standing text lacked
  contest endorsement (`standingMayShip` false).
- Consolidation's single attempt kept the standing text (`slate-declined-standing`,
  judges tied at
  weight 3),
  and the no-loop rule shipped it "with the finding recorded"
  (`consolidation-standing-unendorsed`,
  `consolidate-slice-buy.ts`,
  design of 2026-09-01).
- Polish is not run over a baseline the fidelity gates never admitted (`not-run`,
  `unsafe-baseline`).
- At artifact time `assertFinalNaturalnessComplete` (commit `6fadd3be0`,
  2026-08-28,
  "require absolute
  naturalness") refused any body slice whose polish is not settled,
  and the whole entry was dropped.
  The same guard refused the `Weideriche_` first attempt after 4,840,305 ms on 2026-08-29 (recorded in
  the multi-provider decision doc).

Fixed by `321b12673`:
the guard accepts the no-loop record (`not-run` with reason `unsafe-baseline`)
and still refuses every other body slice without a settled polish;
the artifact carries the reason and
the reading catches it.
The test fails with the acceptance removed (2 FAIL lines) and passes restored.
Recorded for veto as the later stated policy winning over the earlier guard;
the alternative,
refusing
the entry,
is what fast iteration cannot afford at two hours an attempt.

A second defect,
found on the way:
the absolute reviewer was shown only the "refinable" paragraphs
(`paragraph` blocks),
and a finding naming any other paragraph number was refused with the whole
ballot.
Slice 10's candidate has zero refinable paragraphs (it is one blockquote),
so in its 10:35 review
six of nine reviewers who located findings by stanza were refused as schema-mismatch and only the three
"acceptable" ballots survived.
Across the run,
38 of 1,582 recorded replies are unacceptable verdicts
with located findings.
Fixed by `8384166e9` as artifact generation ten:
the reviewer is shown every body
block and the recorded paragraph count and digests are of those blocks;
the reader recomputes them by
generation,
so generations eight and nine keep the refinable set.
The blockquote test fails with the
writer's paragraphs emptied and passes restored.

The chain that was to follow Toka_ls never fired on its own:
its wait loop matched its own command line
(`pgrep -f 'corpus-pass.mjs --only Toka_ls'` sees the bash that carries that text).
Carena0442 was
launched by hand at 10:38:50 on `3852e4d86`,
before `321b12673`,
so it can still die on the same guard
if any of its body slices ends unendorsed;
keyword233 follows on the fixed tree,
and Toka_ls is queued
after the chain at overlap 3 (about 117 minutes at overlap 2 is the measurement;
overlap 3 is the
choice,
veto invited) into `~/temp/agent/toka-rerun2-20260902`.

## Carena0442 landed at 13:48 UTC, and the two waiters were killed at the same moment

`TALLY Carena0442 status=SETTLED slices=22 ms=11375156` on `3852e4d86`:
190 minutes,
page and artifact
written under `~/temp/agent/carena-rerun-20260902`,
`verify-published` clean (1 of 1 pages carry every
wording,
20,751 characters as implied),
0 refusals and 0 holds.
The reading is
`doc/planning/translation-repair-carena-reading-2026-09-02.md`:
one defect (JSON-escaped quotes leaked
into the text;
the slice validator now refuses the sequence,
`e29dbce4f`,
test shown to fail without
it),
one regression ("She should have known"),
many recoveries of what the archive had dropped,
and the
semantic-wrap reshaping a reader must know about first.
The leak entered at consolidation slice 6:
the
producer's text carried it,
all eight structural verdicts were `valid`,
and the polish kept it.

At 13:48:31 the chain waiter launched keyword233 on `a5c69a305` and,
within seconds,
both background
waiters (the chain and the Toka_ls follow-up) were reported killed,
exactly as at 04:02;
the keyword233
pass died with its parent ("sh exited with non-zero status:
no exit status" three seconds in).
The cause
is outside this session's tool calls.
keyword233 was relaunched at 13:50:54 detached from the harness
task (`setsid nohup`) so a task kill cannot take the pass,
and a detached script
(`~/temp/agent/toka-after-keyword233.sh`,
output `.out`) launches Toka_ls at overlap 3 after keyword233's
TALLY.
Both run on the tree with `321b12673` and `8384166e9`.

## keyword233 landed at 14:13 UTC in 22 minutes, on the fixed tree

`TALLY keyword233 status=SETTLED slices=3 ms=1340649` on `a5c69a305`:
the first artifact of generation
ten,
page and artifact under `~/temp/agent/pin-rerun-20260902`,
`verify-published` clean (826
characters as implied),
0 refusals,
0 holds,
no unendorsed standing,
no escaped quote.
Seats:
Kimi-K3
threw 8 of 37 and Qwen3.8-27B 12 of 37 at the window;
every other seat 1 or fewer.

The reading,
all three slices against the source:
the metadata slice stands (its name is the
directory,
as the source's is,
which the narrowed guard of `6d85b619a` accepts);
both body slices went
to the repair lane at 7 and 6 ballots.
Every change recovers something the archive had paraphrased away:
"She started her own channel on Telegram,
where she shared little moments from her daily life and her
heartfelt reflections with everyone" for 开设了自己的频道，与大家分享她的生活点滴和心灵感悟 (the archive
had "shared laughters and tears");
"which I thought was wonderful" for 这在我看来很棒,
which the archive
had dropped;
"Her wisdom and passion added a touch of brightness to this world" for
用她的智慧和热情，为这个世界增添了一抹亮色;
"It is heartbreaking that she passed away" for 令人悲痛的是;
"we
will always remember her" for 我们会永远铭记她的 (the archive:
"She will always be in our heart").
No
defect,
no regression.
The detached Toka_ls script launched Toka_ls at 14:13:20 on `aeb4181b9` at
overlap 3 (`~/temp/agent/toka-rerun2-20260902.log`).

## Toka_ls landed at 15:52 UTC in 100 minutes at overlap 3

`TALLY Toka_ls status=SETTLED slices=16 ms=5972259` on `aeb4181b9`,
generation ten,
page and artifact
under `~/temp/agent/toka-rerun2-20260902`,
`verify-published` clean,
0 refusals,
0 holds,
no unendorsed
standing.
The reading is `doc/planning/translation-repair-toka-ls-rerun-reading-2026-09-02.md`:
slice
9's pronoun is fixed ("she leaves behind verse in a neat meter"),
the whitespace churn is gone,
the
heading is right,
and slice 10's title moved the wrong way:
"Life of Aiden" survives as the alternate
but the work is now called "Flow",
the English title of 喵的奇幻漂流,
one of the five neighbour results
the web lookup returned.
Fixed unasked:
a result that never names the work now says so on its line and
sorts last.
One item for the owner:
the page now carries the source's death paragraph,
"after
resuscitation failed to reverse hemorrhagic shock",
which the archive had omitted;
the
reader-protection rule names suicide method and medication,
and this sits at its edge.

Three of the four entries are now published from this build:
Carena0442 (190 min),
keyword233 (22 min),
Toka_ls (100 min).

DECIDED 2026-09-02 (after the Toka_ls reading):
the reader-protection rule covers a medical cause of
death that implies the method;
the paragraph stays,
the cause goes
(`doc/decision/translation-repair-reader-protection-cause-of-death.md`).
DECIDED at the same time:
XIEPT2
runs now at overlap 4,
the owner's choice over the measured overlap 3;
it is the first run at that
overlap and the first entry with the cause-of-death rule (`f5e172067`).

The first XIEPT2 launch at 22:55 UTC was refused in two seconds by the runs-directory schema guard:
`assertResumableSchemaGeneration` defaulted to generation seven,
unchanged through generations eight,
nine and ten because every launch of those days went into an empty directory,
and
`~/temp/agent/pin-rerun-20260902` now holds keyword233's generation-ten artifact.
Fixed by the commit
`6e5e909d9` (the default is the writer's generation;
the guard's fixtures carry it;
its tests fail with
the old default).
The relaunch into the same directory at 23:00 was refused by the next guard,
`assertBuildGenerationResumable`,
which is by design:
the directory's artifact was stamped by another
build's pipeline digest,
and a pool of several builds would corrupt every rate computed over it.
XIEPT2
launched at 23:01 into its own directory,
`~/temp/agent/xiept2-rerun-20260902`,
which is what the
`ONLY` banner asks for anyway.

DECIDED 2026-09-02 23:0x UTC:
「安乐死」 stays as the original states it ("it implies it's done legally
... it's very inaccessible");
the reader rule's addendum is in the decision doc and the house policy.
CORRECTED 23:2x UTC:
"the immediate cause of death 'shock' is actually fine,
because it doesn't give
enough information for replication".
The rule now states the test as replicability:
method,
substance,
dose and where to obtain them stay vague;
an immediate medical cause,
the date,
the place and the age
stay as the original states them.
The Toka_ls page of 15:52 is right as published;
no rerun needed for
it.
The 23:01 XIEPT2 run had already ended by itself at 23:03:
`TALLY XIEPT2 status=INCOMPLETE ms=114473
error=translation repair interrupted: provider-unavailable`,
with every seat asked 10 and answering
10.
The thrower was `runArchiveBlockReviewStage`:
XIEPT2's archive is a placeholder page ("(To-Do)" and
translation hints under empty headings),
the block pairing left its blocks unclaimed,
nine reviewers
were heard about the block and fewer than the exact half anchored their support in the original,
and
the stage threw that as a provider outage.
Fixed by `ae39bf22e` (test shown to fail without it):
an
unheard roster still interrupts;
a heard roster that cannot anchor retains the block with an unresolved
finding,
as the no-loop design says ("reviewer indecision cannot withhold the entry").
XIEPT2 relaunched
at 23:11 into `~/temp/agent/xiept2-rerun2-20260902` on the tree carrying that fix and the euthanasia
sentence.

## XIEPT2 ran 35 minutes at overlap 4 and was refused whole over one unfilled passage

`TALLY XIEPT2 status=INCOMPLETE ms=2106786 error=entry XIEPT2 retains 1 unfilled source passage(s) at
slices 15` on `ae39bf22e`,
23:10 to 23:45 UTC,
0 refusals,
0 holds,
the archive-block review retained
its block,
no page,
no artifact.
Slice 15 (409 source characters,
no archive text) went through the
translate lane's judged round and its one follow-up;
both tied at weight 1 and 1.5 with three of eight
judges cut at the 60-second window each time,
so no candidate reached the minimum weight
(`no-candidate-backed`) and the passage stayed unfilled.
Then `assertPublishableTranslation`
(2026-08-27,
"refuse incomplete published pages") refused the entry.
The no-loop design of 2026-09-01
(`7e702e075`,
"Insertion placement,
single round") says the page ships without such a passage with the
gap recorded,
and the artifact already records it (`lanes.translate.unfilled`);
the publish test's own
comment records an earlier XIEPT2 attempt lost the same way after four hours forty-eight minutes.
Fixed
under `QDF` (the later stated policy winning over the earlier guard,
as with the naturalness floor):
the pass logs each unfilled passage as `source-passage-unfilled` and publishes;
the refusal stays
exported for callers that want to fail closed.
Recorded for veto.

The window cuts are runaway streams,
measured across today's runs:
398 replies abandoned at the
60-second window had delivered a median 177,741 characters (p90 1,429,821,
max 2,367,634) where a
ballot is a few thousand;
minimax-m3 exceeded 200,000 raw characters on 345 of its 539 completed
replies,
gpt-oss-120b on 77 of 353,
Kimi-K3 on 28 of 285,
Qwen3.8-27B on 23 of 232.
Task 31:
cut a
stream early once it passes a size the stage's reply cannot legitimately reach.

## XIEPT2's fourth launch ran Synthetic's week dry, and the 429 hold then stalled Hyper

Launched 23:52 UTC on `c1db6f729` at overlap 4 into `~/temp/agent/xiept2-rerun3-20260902`.
Synthetic's
weekly meter read 2.34% at launch and 0% by 00:49;
from then on every seat routed to Hyper (balance
4,847).
Hyper answered with 429 bursts of 80 to 131 hits lasting 14 to 21 seconds,
one burst about
every 80 seconds (00:46:22,
00:47:46,
00:49:08,
00:50:24),
and the pass stopped advancing:
72 slice
costs at 00:49 and at 00:51,
in consolidation.
The mechanism,
read off the log:
a 429 on a wet meter
holds the whole provider for the 60-second backoff (`RATE_LIMIT_BACKOFF_MS = BUDGET_FRESH_MS`),
95 calls
waited out a 60-second hold,
and when it ended every pending call fired at once into Hyper's
concurrency limit,
which produced the next burst;
44 calls hit a second both-dry reading inside a new
hold and were lost as `EveryProviderDryError` (then under its two-provider name) (the consolidation polish gate lost Kimi-K3 and
gpt-oss-120b that way at 00:47:33).
A provider-wide hold is the wrong answer to a concurrency limit
when the provider is the only one left:
it converts a per-call retry into a synchronised herd.

By 00:53 the count was 579 429 lines and 137 both-dry losses,
still 72 slice costs,
consolidation
slices settling at about 512 seconds each;
the pass was stopped at 00:54 rather than left to limp for
hours.
Fixed by `57745afcf` (test shown to fail without it):
a refusal on a wet meter holds the provider only when the
other provider is wet (the hold then moves traffic,
which is what it is for);
with the other provider
dry there is no hold,
and each call keeps its own jittered retry ladder in the transport layer.
The
refuser stays routable at once;
the test shows the hold at zero with the other provider dry and at the
backoff with both wet.
XIEPT2 relaunched on that tree,
Hyper alone from the start (Synthetic's week is
spent),
which is the shape `QPW` calls normal.

## XIEPT2's fifth attempt hit Hyper's request-rate limit with no hold at all, so calls are paced now

Launched 00:55 UTC on `57745afcf` at overlap 4 into `~/temp/agent/xiept2-rerun4-20260903`,
Hyper alone
from the start.
It ended at 01:39 (43 minutes) `INCOMPLETE ... provider-unavailable` with 8,632 HTTP
429 lines and no hold anywhere:
with the hold gone,
nothing stood between the seats and the limit.
The 429 bodies all read `You've hit your hourly rate limit. Please try again in 1s` (also 2s,
3s,
4s).
Calls in flight at the moment of a refusal had a median of 4 (max 28),
so it is not the concurrency
limit the earlier section named.
A first reading of the log counted "completed streams" and reached
9,628 successes in 43 minutes,
which made the owner's figure in `hyper-client.ts` ("limits this account
to 1,000 requests per hour") look wrong and led to a per-minute pacer at 600 (`50da3787a`);
the advisor
asked for a per-model clustering,
and the recount off the SPEND lines,
which record only successful
calls,
overturned it:
a refused exchange completes its stream too,
so the first count was successes
plus refusals.
The real numbers:
612 successful Hyper calls in the whole run;
every seat's first
five-times-refused call between 01:00:33 and 01:00:37 (27 successes each before it,
257 in this run,
the rest of the hour's thousand in the run before it,
whose calls from 00:00 were still in the window);
successes per ten minutes after that of 141,
134,
104 and 11,
the trickle at which requests from an hour
earlier left the window;
6,441 retry attempts and 1,487 calls refused five times over,
spread across the
nine seats in proportion to their traffic (218 minimax-m3 down to 73 glm-5.3),
which is one shared
window,
not a per-model one.
The owner's 1,000 requests per rolling hour holds (a full run at that rate
drew no refusal;
whether the ceiling sits higher is unmeasured).
Every seat lost
about half its calls because the transport ladder (four retries at 1,
2,
4,
8 s equal-jitter,
honouring
the body's 1 to 4 s) cannot outwait a window that frees a place every five seconds,
and a call whose
five attempts were all refused reached the router as a provider outage.

Fixed by `50da3787a` and its rework (tests shown to fail without each):
`request-pace.ts`,
a sliding-window
pacer in front of the Hyper transport that lets 1,000 request starts into any rolling hour,
retries and
credit reads included,
and queues the rest in arrival order,
with `TRANSLATION_REPAIR_HYPER_REQUESTS_PER_HOUR`
as the dial;
and the retry ladder now reads the refusal's own "try again in Ns" and waits at least that
long.
The pacer's window starts empty,
so a launch within an hour of a heavy run is refused until that
run's calls leave the window;
rerun4's last calls (01:10 to 01:39) leave it by 02:39.

What 1,000 an hour means for XIEPT2 on Hyper alone:
Carena0442's landed pass made 1,938 requests
(1,648 Hyper) and keyword233's 241;
XIEPT2 is about five times Toka_ls's source,
and rerun4 had made
612 successful calls plus 1,487 lost ones without leaving the translate stage.
A full XIEPT2 pass is
some thousands of requests,
so at the cap it runs several hours,
outside `FIT` (about an hour),
until
Synthetic's week resets or a smaller shape is chosen.
Not a design decision:
the owner's "Run it now at
overlap 4" and `QPW` cover a one-provider launch,
so rerun5 launches paced and the duration is reported
for the veto.

Rerun5 launched 02:04 UTC on `4b5c8b438` (the pacer at 1,000 per rolling hour,
its test rewritten so the
queued-abort guard is the one under test) at overlap 4 into `~/temp/agent/xiept2-rerun5-20260903`,
Hyper
alone;
17 successful calls and no refusal in the first 45 seconds.
Launched before rerun4's last calls
had left Hyper's window (they do by 02:39),
on the reasoning that the pacer's own thousand is spent
only after some ten minutes of the preparation stage,
by which time most of rerun4's calls have left,
and that a refusal in between costs one call's five short retries,
not the run.
A watcher reports
Hyper successes,
refusals,
cuts and slice costs every five minutes and ends on the tally.

The cut-stream cap (the runaway-reply item) is closed on measurement rather than built.
Rerun4's 41
cuts (qwen3.8-27b 20,
kimi-k3 17,
minimax-m3 3,
glm-5.3-flash 1) all had zero content characters,
15,000 to 45,000 reasoning characters and about 70 seconds elapsed:
the round's 60-second post-quorum
grace cutting slow reasoners,
not runaway output.
Raw stream bytes run seventeen times the text
(one SSE frame per few characters),
so the day's "1.43 MB at p90" measured framing.
Answer overrun
already has its own ending (`overrun`,
`maxAnswerChars` on the exchange).
A cap on reasoning would end
the same lost calls seconds earlier and save no requests,
and under a window of 1,000 an hour the
request is the scarce unit,
not the second.

What the cuts are,
read per seat and round kind (both lanes' select rounds log as `judgeTranslateSlate`;
the lane tag splits them):
rerun5 cut Qwen3.8-27B in 30 of 34 translate-lane select rounds and 21 of
24 consolidation-slate select rounds (in the first 25 minutes the only late seat in 7 of 16,
so those
rounds waited the whole 60 s window for nothing),
Kimi-K3 in 17 of 34 and 18 of 24,
minimax-m3 in 7
and 6;
Carena0442's landed pass (1,648 of 1,938 calls on Hyper) cut Qwen in 14 of 19 translate-lane
select,
11 of 19 consolidation-slate select,
21 of 59 repair-select,
13 of 25 critic,
15 of 19 panel,
17 of 19 lane-contest and 7 of 14 consolidation-gate rounds,
113 abandoned rounds against 106
successful calls;
Toka_ls on Synthetic cut it in 3 of 28 select rounds.
Under the owner's standing authorisation to drop
a model from a role on evidence,
and on the GLM-5.3-Flash precedent (12 of 21 translate-select rounds),
Qwen3.8-27B leaves every judge seat (`WIDE_SEAT_DROPPED`,
six seats,
quorum 3;
`LATE_JUDGE_DROPPED`,
seven) and keeps its writer seats;
the seating decision carries the 2026-09-03 addendum.
The seat is
lost to Hyper's serving speed for this model rather than to the model,
so a provider-aware seat is the
open design question.
Kimi-K3 (17 of 34 and 18 of 24 select on rerun5;
11 of 19,
10 of 19 select and
10 of 19 contest on Carena,
under half in critic and panel) is recorded as the next candidate,
not
dropped.
Rerun5 keeps the old seats;
the change reaches the next launch.

At 25 minutes rerun5 had 438 successes,
12 retried refusals and 3 lost calls:
rerun4's calls were
still inside Hyper's window (they leave by 02:39) while the pacer's own count stood well under 1,000,
which is the launch-timing cost named at launch.
