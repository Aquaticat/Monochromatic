# Translation repair: OpenRouter as the paid fallback provider, part 29

Part 29 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## XingZ619 read, 2026-09-19, 20:40 UTC: XingZ60 SETTLED with classes sixty-seven to sixty-nine live

`TALLY XingZ60 status=SETTLED slices=120`,
20:17 UTC,
2h57m from the 17:20 UTC launch
(admission 17:39 UTC,
translate lane 18:35 to 19:10 UTC,
contest to 19:14 UTC,
consolidation to 20:17 UTC),
frozen `bb4bb7556`,
one attempt.
Page 50,156 chars at `~/temp/agent/XingZ619/fixed/people/XingZ60/page.en.md`.
10.95 USD by the meters
(Bedrock 134.21 to 129.82,
OpenRouter 198.47 to 191.91;
10.89 by the OpenRouter spend lines,
33 streams abandoned for 0.17),
8,356 seats,
284 retry rounds.
Jev 240 asked,
240 usable.
V4.1 Flash 1,246 calls
(Morph 1,024 at 15.9 s mean,
Makora 210 at 28.2 s,
DigitalOcean 11 at 88.4 s,
a slug the ignore list does not name yet),
Mercury 847 calls at 6.6 s.

Classes sixty-seven and sixty-eight,
read first.
The page assembly wrote nine overrides over eight slices and the tally names all fourteen distinct headings:

-   `contributor-name-restored`:
    slice 49 `### Part Four: Impermanence` to `### Part Four: Ann`;
    slice 65 the signature `——Wuchang` to `——Ann`;
    slice 79 `### The Eighth: Baimao suki` to `### The Eighth: Baimao Suki`
    (the archive's own signature spelling);
    slice 104 `### Part Ten: Brocade Heart` to `### Part Ten: Jinxin`
    (the page's signature,
    the archive never carried the tenth section).
    The lanes rendered `HiYku` themselves this run,
    heading and signature,
    so the third section needed no restoration.
-   `heading-series-unified`:
    five of ten rewritten into the majority style `part cardinal`
    (slices 9,
    72,
    77,
    79,
    85),
    so the page reads `### Part One: Irako` to `### Part Ten: Jinxin`.

Class sixty-nine:
slice 70 admitted on the block deficit at the admission
(the heading dated 17:20 UTC);
on the page the memorial disclosure block carries four paragraphs against the archive's three,
and every other details container carries the original's block count
(the BlurBlock one reads 16 against the original's 17 only because its closing tag shares the last block,
the same on XingZ616).

The seven steps and the three checks:
front matter equal to the archive's;
fourteen headings against the original's fourteen;
18 footnote markers as on XingZ616;
both links
(the bilibili video and the profile);
no `TA`;
no error finish;
`attempts.json` reads 1;
no shortfall refusal,
no hold,
no payment refusal,
no quorum miss.
Five standings shipped without contest endorsement as findings
(slices 17,
53,
67,
71,
74;
`slate-declined-standing` 5,
XingZ616 3);
no gate kept an ineligible standing.
`inception/mercury-2.5` appears in the translate lane as a select judge only
(81 lines,
all `judgeTranslateSlate] select`);
it wrote in the consolidation
(7 slate wins there).
`deepseek-v4.1-flash` won 23 translate-lane rounds and 10 consolidation slates
(GLM-5.3-Flash 47,
gemma-26b 27,
minimax 20).

Quality observations,
open:

-   The attribution under the Bird in a Cage poem reads
    `——from [笼中之鸟](https://www.bilibili.com/video/BV17Q4y1s7j1)[^9], author 洁澄天奏Official`
    where XingZ616 and the archive render
    `——From "[Bird in a Cage](...)"[^9], by Jiecheng TianzouOfficial`;
    the heading above it is rendered (`Caged Bird`),
    the link text and the author's handle are not.
    The untranslated floor compares whole slices,
    and the slice is mostly English,
    so the judges' choice stands.
    One line;
    the page's other CJK runs are the archive's own
    (the Japanese lyric,
    a `DottedNumber n="七"`).
-   Slower than XingZ616 (2h57m against 2h04m):
    refiner rounds 92 s mean against 51,
    translate rounds 54 against 40,
    editor rounds 54 against 49.
    GLM-5.3-Flash streams ran 68.6 s mean against 39.6 on XingZ616 (Parasail),
    and V4.1 Flash at 18.6 s now sits where Mercury's 6.6 s streams sat in the translator seat.
    Still 4 hours under the deadline;
    a trend to watch,
    not a class.

## Class sixty-nine, 2026-09-19, 17:20 UTC: the block deficit decides a split; XingZ618 killed, XingZ619 launched

XingZ618's admission (17:13 UTC) left one slice unresolved:
`slice 70: coverage=split` then `placement unresolved after the single round (verdict split); not admitted`.
Slice 70 is the memorial disclosure block's third paragraph,
the one XingZ611 read absent and refused on a zero interior budget (class sixty-one)
and XingZ612 admitted on the block deficit (5 blocks against 4).
This run the coverage round split on it
(one voice anchoring a claim of coverage,
the rest absent;
the row's tallies are not on the log line,
a gap the new finding closes),
and `admitContainerDeficit` spent the deficit on absent verdicts and unanchored splits alone,
so the paragraph would have shipped as a recorded gap on a page whose archive is measurably one block short there.
The class sixty shape (a split inside the admitted tail decided by the bound) inside a container.

Fixed in `bb4bb7556`,
guard red first at `280b99696`:
inside a container the archive carries short of blocks,
every row no majority found carried (absent or split) is admitted while the deficit lasts,
in document order,
a split with an anchored claim named by
`insertion-split-in-container-deficit (slice N, full F, partial P, absent A of K asked; no majority, the block deficit decides)`
beside `insertion-container-deficit-admitted`;
a majority carried verdict stays out.
The absence-verdict decision's seventh addendum dated 2026-09-19;
slice-context updated.
The whole unit suite passes;
oxlint and tsc clean.

XingZ618 (frozen `9f8dcccd2`) was killed at 17:20 UTC,
26 minutes in and 7 minutes into its repair lane,
under always-kill-and-relaunch
(1,519 seats,
1.49 USD by the OpenRouter spend lines;
meters Bedrock 134.29,
OpenRouter 198.54).
Its admission otherwise:
the tail admitted on the bound (31 slices,
expected 15,318 against the last pair's 173),
no other placement unresolved,
`translators=7 writers=9` with Synthetic and Hyper dry
(V4.1 Flash in on OpenRouter,
Mercury out).
XingZ619 launched at 17:20 UTC:
frozen `bb4bb7556`
(classes sixty-seven to sixty-nine plus the seating),
pid 1120922,
runs `~/temp/agent/XingZ619`,
log `~/temp/agent/XingZ619.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`.
Its admission at 17:39 UTC:
slice 70 split again at the coverage round
(`coverage=split`,
this time with no anchored claim,
so the deficit finding stands alone)
and was admitted,
`insertion-container-deficit-admitted (slice 70 inside details of slices 67 to 71: the original writes 5 blocks there, the archive 4)`;
the tail admitted on the bound
(31 slices,
expected 15,455 against the last pair's 173);
no placement unresolved.
Class sixty-nine's path ran with the class forty-eight shape;
the anchored-split shape XingZ618 showed waits for another run.
Then the page assembly findings and the translate slates as the XingZ618 heading says.

## The V4.1 Flash calibration is read, V4.1 Flash writes, Mercury leaves the translator seat, 2026-09-19, 16:55 UTC

`producer-calibrate 40 --candidates deepseek-v4.1-flash` (frozen `6eada935a`,
pid 1031770,
14:53 to 16:45 UTC,
about 0.24 USD by the OpenRouter spend lines)
printed `STANDING over 40 rounds`:
170 disinterested wins over 808 ballots,
pooled null 21.0 percent,
Bonferroni threshold z 2.77 over nine comparisons.
`deepseek-v4.1-flash` 29 of 121 disinterested ballots over 27 candidates,
adjusted 23.1 percent,
z +0.79,
not separated from the null,
55 of 55 asks usable,
the most round wins of the bench (8.3 of 35) and 90.7 percent top-three inclusion over 4,000 resamples.
`inception/mercury-2.5` 10 of 108 over 28,
adjusted 9.3 percent,
z -3.00,
below the null across the threshold.
`gemma-4-26b-a4b-it` above the null again (z +3.46).
`glm-5.3` threw 54 of 54 (Hyper balance 0),
so the table covers nine of ten seats.

By the seating rule of 2026-09-01
(a writer leaves the translator seat when its z crosses the threshold below the null;
a candidate not separated from the null takes it):
V4.1 Flash takes the translator and consolidation seats
(`writer-unmeasured` off its card,
`reader-unmeasured` stays),
Mercury leaves the translator seat and keeps the consolidation seat
(`translator-dropped` on its card,
the shape of `deepseek-v4-pro-0813`'s exit).
Translators stay eight,
consolidation writers eleven,
stage quorum 4.
Landed as `9f8dcccd2`,
tests red first at `abcc4368c`;
the seating decision's addendum dated 2026-09-19.

XingZ617 (frozen `c26648e2a`,
launched at 16:45 UTC by the waiter the moment the calibration exited)
was killed at 16:54 UTC nine minutes in,
in its pictures phase
(318 seats,
0.22 USD by the OpenRouter spend lines),
under always-kill-and-relaunch.
XingZ618 launched at 16:54 UTC:
frozen `9f8dcccd2`
(classes sixty-seven and sixty-eight plus the seating),
pid 1101029,
runs `~/temp/agent/XingZ618`,
log `~/temp/agent/XingZ618.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry.
Meters at the calibration's end:
Bedrock 135.12 USD,
OpenRouter 199.35 USD,
Hyper 0.
To read first:
the page assembly findings `contributor-name-restored` and `heading-series-unified`
(HiYku in the third heading and its signature,
Ann in the fourth,
Jinxin in the tenth,
the ten headings in one style,
fourteen distinct headings),
then V4.1 Flash's candidates on the translate slates and Mercury absent from them.

## Classes sixty-seven and sixty-eight, 2026-09-19, 15:35 UTC: one name one way, one series one style

Owner,
on the two quality observations of the XingZ616 read:
"Fix these quality observations.
If already fixed,
tell me."
Neither was fixed;
both are classes of the same shape as class forty-five:
each slice's judges see one heading or one signature,
and nothing on any sheet says that two slices name one person or one series.
So the page decides once,
at page assembly,
where every heading and signature is in view.
Fixed in `c26648e2a`,
guards red first at `034d52b42`
(`contributor-name-restore.unit.test.ts`,
`heading-series-unify.unit.test.ts`;
cat-themed invention).

Class sixty-seven,
`restoreContributorNames` (`corpus-run/contributor-name-restore.ts`):
a name the original both heads a section with
(`其三：绘都`,
the title equal to the name or ending with a colon and the name)
and signs
(a line opening with em dashes,
the name,
then a comma:
`——绘都, 2024 年 12 月 17 日`)
is a person.
The authority for that person's rendering is the archive's signature at the same position
when the archive signs as often as the original in that slice,
else the page's own signature rendering,
else the name stays as rendered.
Every heading and signature naming that person in a slice a lane replaced is rewritten to the authority;
the archive's own text is never rewritten.
Findings `contributor-name-restored (slice N: "old" to "new" in a heading|a signature; the archive's|the page's signature rendering)`.

Class sixty-eight,
`unifyHeadingSeries` (`corpus-run/heading-series-unify.ts`):
the original's headings whose title opens with `其`,
a Han numeral and a colon are one series.
Each page heading at the same position is read for the style its number took
(`corpus-run/ordinal-style.ts`:
cardinal,
ordinal,
roman or arabic,
with or without a leader word such as `Part` or `The`,
or no number).
The series takes the style most headings took,
the earliest on a tie,
and every heading is rendered in it;
where most headings carry no number,
the archive's convention on this page,
the ordinals are dropped.
A slice the archive alone carried gains a replacement when its heading changes.
Findings `heading-series-unified (slice N: "old" to "new"; K numbered headings in the style of "cardinal")`.

Both run in `page-assembly-guard.ts` after the class forty-five restore and before the footnote guard;
their rewritten rows ride the same override a restored heading does.
The shared readers are `corpus-run/assembly-page-text.ts`
(page text per slice with the archive as fallback,
replacements folded in)
and `corpus-run/attribution-line.ts`
(the signature line).

Replayed offline over XingZ616's settled page split at its level-3 headings
(`~/temp/agent/replay-c67.mjs`,
eleven sections against the original and the archive):
the names pass rewrote `### Three: Painted Capital` to `### Three: HiYku`,
`—Huidu` to `—HiYku`,
`### IV: Impermanence` to `### IV: Ann`,
`### Ten: Brocade Heart` to `### Ten: Jinxin`
(the page's own signature,
since the archive never carried the tenth section),
and `### Baimao suki` to `### Baimao Suki`
(the archive's own signature spells the handle so);
the series pass then read three cardinal renderings against three with no number,
took the earliest
(`One:`),
and rendered all ten `One:` to `Ten:`.
The fourteen distinct headings stay fourteen.
The whole unit suite passes on `c26648e2a`;
the four package checks are clean.
XingZ617 launches on a frozen `c26648e2a` once the V4.1 Flash calibration exits
(no pass runs beside a calibration).

## XingZ616 read, 2026-09-19, 14:55 UTC: XingZ60 SETTLED

The first settled XingZ60 page.
`TALLY XingZ60 status=SETTLED slices=119`,
published at 14:50 UTC,
2h04m from launch
(admission 13:04 UTC,
repair lane to 13:40 UTC at 82 s a slice,
translate lane to 14:03 UTC,
lane contest 113 of 119 differ to 14:07 UTC,
consolidation to 14:50 UTC),
against XingZ608's 2h16m to an INCOMPLETE publish.
9.19 USD by the meters
(Bedrock 139.52 to 135.20,
OpenRouter 204.39 to 199.52),
8,216 seats,
225 retry rounds;
Mercury 1,018 of 1,018,
Jev 262 of 262.
The page `~/temp/agent/XingZ616/fixed/people/XingZ60/page.en.md`,
48,853 characters.

The seven steps and the three checks:

- Front matter equal to the archive's.
- The closing poem
  (slice 91 on XingZ615's roster)
  with all five verses quoted and the attribution inside the quote;
  classes sixty-five and sixty-six live:
  183 `translate-candidate-refused` findings in the artifact
  (gemma-4-e2b most,
  for untranslated pronouns,
  parse failures and merged blocks),
  no `slate-declined-standing` stop.
- The memorial disclosure block with all four of the original's paragraphs
  (the fourth,
  "May her soul find peace in another world",
  at line 636).
- The bilibili link and the profile link,
  the two links the original carries.
- Nine definitions under the original's labels,
  each marker used once in the body.
- Three `TextRing` components as the original;
  fourteen headings as the original.
- The pronoun paragraphs:
  the parents' quoted `"him"` kept as the original's 『他』,
  the poem's `his sorrow` beside `her solitude` as the original contrasts them,
  no `TA` on the page.
- `### IX: Blank` with the greeting line and the centred h3 as three lines.
- No `finish_reason=error` schema mismatch;
  22 `InStreamProviderError` retries;
  108 JSON false starts read past.
- Three slices shipped a standing without contest endorsement
  (10,
  24,
  70),
  recorded findings,
  not stops.

Two quality observations,
open,
neither a stop:

- The ten section headings `其一` to `其十` are rendered in seven ordinal styles
  (`One:`,
  none,
  `Three:`,
  `IV:`,
  `The Fifth:`,
  `Part Six:`,
  none,
  none,
  `IX:`,
  `Ten:`);
  the archive drops the ordinals throughout.
  Slices are judged one at a time,
  so a parallel series has no one style.
- `其三：绘都` and `其四：无常` are rendered `Painted Capital` and `Impermanence`
  where the archive has `HiYku` and `Ann`,
  the handles the human translator knew;
  the archive's rendering was on the slate and lost.
  The same shape as class forty-five's heading on hulicaijia.

Between passes,
as the handover's step 3 asks,
`producer-calibrate 40 --candidates deepseek-v4.1-flash` was launched detached at 14:53 UTC
(pid 1031770,
frozen `6eada935a`,
runs `~/temp/agent/calibrate-v41flash-20260919`,
log `~/temp/agent/producer-calibrate-v41flash-20260919.log`),
to be read with `read-standing.mjs` against the pooled null.

## XingZ616 launches on classes sixty-five and sixty-six, 2026-09-19, 12:46 UTC

Frozen `6eada935a` (classes forty-one to sixty-six and the tail budget),
pid 1017938,
runs `~/temp/agent/XingZ616`,
log `~/temp/agent/XingZ616.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the translate lane's `translate-candidate-refused` findings in the artifact
(the withheld shapes)
and the closing poem's slice
(91 on XingZ615's roster,
the `> 热情的仿佛炽热的骄阳` quote with its attribution and the `</details>`):
its contest winner passing the invariants,
no `slate-declined-standing`,
the poem on the page with the attribution inside the quote;
then the admission,
the translate assembly,
the memorial disclosure block with its four paragraphs,
the bilibili link,
the nine definitions,
the run time against XingZ608's 2h16m,
then the seven steps and the three checks.

## Classes sixty-five and sixty-six, 2026-09-19, 12:40 UTC: a respaced copy of the original, and a refused candidate on the translate slate

Found by XingZ615's consolidation.
The pass stopped INCOMPLETE at 12:24 UTC,
2h41m in,
at the consolidation of slice 91,
the closing poem of the `七句破题` block
(five quoted verses,
the attribution `<p>` inside the quote,
then `</details>`;
two blocks by the rule).
Two defects,
one behind the other.

Class sixty-six is why the standing was ineligible:
the translate lane's slate carried a candidate that moved the attribution line out of the quote
(three blocks,
`blockquote, paragraph, paragraph`,
against the original's two),
which the deterministic rule had refused and its author's repair turn had not resolved;
the lane keeps such a candidate on the slate
(the repair turn of 2026-08-15),
the judges do not apply the rule,
and they chose it over two renderings that kept the attribution inside the quote.
The lane contest chose translate 6 of 8 and its guard wrote
`contest winner fails publication invariants and remains retryable`
and moved on;
the consolidation withheld the standing.

Class sixty-five is why the slate then had nothing:
the repair lane ships nothing for an insertion slice,
the translate text was the withheld standing,
and of the consolidation proposals the floor accepted exactly one,
the Chinese original returned with a space after each bare `>` line
(payload `c0ed84346b`,
12:21:27 UTC).
`untranslatedFindings` compared the candidate to the original character for character after trimming the ends,
so the respaced copy passed.
Three of four judges abstained
(`not a translation; a verbatim copy of the Chinese original`),
gemma-4-e2b chose it twice,
weight 1 against the minimum of 2,
`slate-declined-standing`.
(The judges' abstention reasons are not logged;
they were read from the payload cache.)

Fixed in `6eada935a`
(guards red first at `636d56a8c`,
`translate-untranslated.unit.test.ts` and `translate-floor.unit.test.ts`):
the untranslated check compares in all but whitespace
(`translate-untranslated.ts`,
the finding now reads "in all but whitespace"),
and `translate-floor.ts` withholds from the translate slate every candidate the rule still refuses after its repair turn,
recorded as `translate-candidate-refused (model): reasons`;
a rule that cannot say keeps the candidate,
and the repair turn and the model's own defence are unchanged.
The 2026-08-15 decision that an invalid candidate goes back to its author once is kept;
what changes is that after that turn a text the page cannot carry no longer reaches the judges.
The owner may veto this reading.

XingZ615 otherwise:
class sixty-four not exercised
(Inception served Mercury 952 of 952,
no pass-on,
no hold);
the repair lane 41 minutes at a mean of 91 s a slice
(XingZ613 295 s,
XingZ608 62 s),
the translate lane 45 minutes at 137 s,
the lane contest 113 of 120 differ,
consolidation from 11:40 UTC;
the `其九：空白` slice settled on its first slate round
(gpt-oss's proposal,
weight 2 of 4),
so class sixty-three was not exercised either;
the admission at 10:05 UTC with the tail on the bound and nothing unresolved;
no footnote revert or withdrawal at the translate assembly;
Jev 252 asked,
252 usable;
10.34 USD by the meters
(Bedrock 143.81 to 139.53,
OpenRouter 210.46 to 204.40),
8,070 seats,
246 retry rounds.

## XingZ615 launches on class sixty-four, 2026-09-19, 09:50 UTC

Frozen `fc428eaee` (classes forty-one to sixty-four and the tail budget),
pid 985599,
runs `~/temp/agent/XingZ615`,
log `~/temp/agent/XingZ615.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
XingZ614 was killed at 09:50 UTC,
12 minutes in,
still in preparation
(no admission,
no Mercury pass-on yet),
0.04 USD by the meters.
Admission read at 10:05 UTC,
15 minutes in:
the tail admitted on the bound
(31 slices of 120,
5,144 source code points at expansion 2.93,
expected 15,083),
no `placement unresolved`,
no Mercury pass-on and no hold yet
(Inception's limit had lifted by launch).
Read next the repair lane's pace against XingZ613's
(`SLICE-COST lane=repair` mean 295 s there,
62 s on XingZ608)
and the `held out for another` refusals where Inception limits Mercury
(a `passed on` line,
then held refusals for 60 s,
then one more ask);
then the consolidation of the `其九：空白` slice
(`translate-runoff (finalists 2 of N)` where the first round splits,
no `slate-declined-standing`);
then the admission,
the translate assembly,
the memorial disclosure block with its four paragraphs,
the bilibili link,
the nine definitions,
the run time against XingZ608's 2h16m,
then the seven steps and the three checks.

## Class sixty-four, 2026-09-19, 09:45 UTC: the rate-limited seat is asked again on every round

Measured on XingZ613's lanes
(the subsection under the class sixty-three heading).
Fixed in `fc428eaee`
(guard red first at `17084ca5e`,
`provider-router-model-hold.unit.test.ts`):
`upstream-model-hold.ts` keeps a hold per model,
the router starts it on an upstream-model refusal
(class sixty-two's passed-on 429)
for `UPSTREAM_MODEL_HOLD_MS`,
60 s,
the provider hold's own backoff,
and refuses the model at call time as `NoProviderForModelError`
(`its upstream endpoint rate-limited this model; held out for another Nms`)
until it ends,
so a round counts the seat unreachable and neither asks nor waits for it;
the provider and its other models are untouched,
and the hold restarts on the next refusal.
The router's pass-on line now names the hold.

## XingZ614 launches on class sixty-three, 2026-09-19, 09:38 UTC

Frozen `4193495fa` (classes forty-one to sixty-three and the tail budget),
pid 966877,
runs `~/temp/agent/XingZ614`,
log `~/temp/agent/XingZ614.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Read first the consolidation of the `其九：空白` slice
(84 on XingZ613's roster):
`translate-runoff (finalists 2 of N)` where the first round splits,
a run-off that decides,
no `slate-declined-standing`;
then the admission,
the lanes,
the translate assembly,
the memorial disclosure block with its four paragraphs,
the bilibili link,
the nine definitions,
the run time against XingZ608's 2h16m,
then the seven steps and the three checks.

## Class sixty-three, 2026-09-19, 09:30 UTC: the run-off over every backed candidate is the same question

Found by XingZ613's consolidation.
Slice 84 is the `### 其九：空白` heading with the greeting line and the centred h3,
three content lines the archive renders as `### __` and the h3 alone,
so the standing failed the line rule
("2 lines of content where the ORIGINAL has 3")
and was withheld from the slate
(the third ineligible-standing addendum).
Four valid proposals went to a bench at quorum
(4 of 5 reachable,
glm-5.3 dry;
gemma-26b at half weight):
gemma-26b and Mercury for candidate 4,
deepseek for 1,
gemma-e2b for 3,
the leader at 1.5 against the absolute minimum of 2.
The class fifty-three challenge narrowed the run-off to the candidates that drew a ballot,
which was three of the four,
and the same panel split the same way
(1.5,
1,
1,
one abstention),
so the slate settled `slate-declined-standing` and the entry stopped INCOMPLETE at 3h02m over a heading whose every rendering was valid
("Part Nine",
"The Ninth",
the heading kept in Han).
Fixed in `4193495fa`
(guard red first at `9176c9819`,
`translate-runoff-leaders.unit.test.ts`):
`runoffFinalists` offers the leaders alone,
the candidates tied at the top on a tie,
the leader and its runner-up on a plurality under the minimum
(runner-up by weight,
then ballots,
then slate position),
so the challenge is a two-candidate question a bench of whole and half ballots settles unless it abstains.
The class fifty-three shape
(two candidates named once each of three)
narrows as before;
every candidate tied at the top,
a rejection,
or fewer than two backed still offer the whole slate.
XingZ613 otherwise:
class sixty-two live
(54 pass-on lines against Mercury 2.5,
no provider hold,
no bench stop),
Mercury asked 935 and threw 147;
Jev 276 asked,
276 usable;
no footnote revert or withdrawal on the translate assembly;
lane contest 112 of 119 slices differ;
7.81 USD by the meters
(Bedrock 148.02 to 143.85,
OpenRouter 214.16 to 210.52),
8,025 seats,
262 retry rounds.

### The rate-limited seat slows every round (class sixty-four, open)

XingZ613's repair lane took 1h39m against XingZ608's 35m
(119 slices at a mean of 295 s against 120 at 62 s).
Measured over the round lines,
the stages Mercury sits on waited in grace for its rate-limited ladder after quorum:
select 14.1 s mean grace against 5.8,
panel 22.5 against 1.0,
critic 25.0 against 4.1,
editor 32.2 against 0.0,
introduced-defect-probe 30.0 against 0.3,
checker 17.8;
the stages without it
(lane contest,
naturalness review,
coverage)
ran as before.
Class sixty-two lets the seat go dark for the round,
but the next round asks it again and waits its five-attempt ladder out.
The remedy is the class sixty-two hold scoped to the model:
a model whose upstream endpoint rate-limited it is held out for the rate-limit backoff and refused at call time as unreachable,
so rounds neither ask nor wait for it until the hold ends.

## XingZ613 launches on class sixty-two, 2026-09-19, 06:22 UTC

Frozen `c340b496b` (classes forty-one to sixty-two and the tail budget),
pid 919708,
runs `~/temp/agent/XingZ613`,
log `~/temp/agent/XingZ613.log`,
`TRANSLATION_REPAIR_SLICE_OVERLAP=8`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch,
no cron job,
the background waiter alone reports the exit.
Admission read at 06:51 UTC,
29 minutes in:
class sixty-two live,
54 "passed on its upstream endpoint's rate limit" lines against Mercury 2.5,
no `markRefused] openrouter`,
no `writing bench unreachable`;
the tail admitted on the bound
(31 slices,
88 to 118 of 119,
5,175 source code points at expansion 2.94,
expected 15,215);
no `placement unresolved` on any slice.
No container deficit this run:
the roster paired the memorial block's third and fourth paragraphs together with the archive's one
(section 8,
"paired 7 of 7 original and 6 of 6 translation blocks across 7 relations",
relation `4>3`),
so the block has no source-only slice and the repair lane carries both paragraphs as one content slice;
read the block on the page for all four paragraphs.
Read next the lanes:
`passed on its upstream endpoint's rate limit` lines against Mercury 2.5 with no `markRefused] openrouter` beside them,
no `writing bench unreachable`,
then the translate assembly,
the memorial disclosure block with its four paragraphs,
the bilibili link,
the nine definitions,
the run time against XingZ608's 2h16m,
then the seven steps and the three checks.
