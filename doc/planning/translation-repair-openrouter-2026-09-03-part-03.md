# Translation repair: OpenRouter as the paid fallback provider, part 03

Part 03 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The two runs on the publisher fix, 2026-09-04, 13:51 UTC onward: both ship, and what the reading found

luxuanwen3 and SS3B_0016 ran concurrently on `e66da50ef`,
OpenRouter alone,
from 13:51:31 UTC,
into `~/temp/agent/<id>-shapes4-20260904` (logs of the same name).
Balance 18.49 USD at launch,
5.41 USD at the last meter reading.

luxuanwen3:
`TALLY luxuanwen3 status=SETTLED slices=9 ... pageChanged=7 pageSilent=0 selection=contested ms=3596918` (60 minutes,
764 calls,
4.65 USD by the `cost=` fields),
`DESTINATIONS luxuanwen3 source=2 page=2 dropped=0` with no finding:
the page carries the original's `twitter.com` for Deaver1229 and for the contributor,
so the pool was met from the original's side.
verify-published:
`wordings=9 silent=0 chars=2467=expected missing=0`.
The front matter's `alias` reads `鲵鲵, Nini`;
the `PhotoScroll` line is intact;
the Camus quotation and its right-aligned attribution are intact.
Slice 3 logged `consolidation
standing text lacks contest endorsement and remains retryable` and shipped on the single attempt.
No `must carry exactly`,
no `fails the deterministic publication rule`,
no `REATTEMPT`.
Seats:
minimax-m3 117 of 117 usable,
gpt-oss-120b 115 of 115,
GLM-5.3-Flash 38 of 39,
glm-5.3 53 of 61 (8 threw),
deepseek-v4-flash 89 of 93,
deepseek-v4-pro 120 of 123,
gemma 123 of 124,
Qwen3.8-27B 109 of 125 (16 threw).
Read in full:
the page is publishable as it stands.
One wrap nit,
not a page defect:
the per-slice wrap broke `August 4,
2024` after the date's comma,
which Markdown rejoins on render.

SS3B_0016:
`TALLY SS3B_0016 status=SETTLED slices=9 ... pageChanged=8 pageSilent=0 selection=contested ms=3365773` (56 minutes,
887 calls,
5.12 USD),
`DESTINATIONS SS3B_0016 source=3 page=3 dropped=0 destinations-archive-rendering`:
the page carries the archive's English Wikipedia `Railfan` where the source links the Chinese article,
and keeps the `mailto:` and GitHub destinations.
verify-published:
`wordings=9 silent=0 chars=2291=expected missing=0`.
Slice 2 lacked contest endorsement and shipped on the single attempt.
Seats:
gpt-oss-120b 141 of 141,
minimax-m3 132 of 132,
gemma 147 of 147,
glm-5.3 62 of 69 (7 threw),
deepseek-v4-pro 138 of 140,
Qwen3.8-27B 121 of 148 (27 threw),
GLM-5.3-Flash 39 of 40,
deepseek-v4-flash 107 of 111.
The page restores what the archive's rewrite had changed (the source's "community",
not "transgender community";
the source's "the day before Yantian's birthday",
not the archive's added date and stations) and reads well,
with two findings from the reading.

WHAT THE READING FOUND,
ONE DEFECT AND ONE RISK.

The defect:
slice 5 ships `we have temporarily set up a small room for Ta, to give Ta's memorial a little warmth`,
a bare `Ta` twice,
on a page that says "they" and "them" for Yantian everywhere else.
The
translate lane won that slice with three of five contest ballots reasoning that it "keeps the original's neutral Ta",
and the consolidation gate kept it.
The cause is in the pipeline,
not the judges:
the source writes its neutral pronoun as `Ta`,
and `countNeutralPronoun` in `identity-context.ts` counts only `TA`,
so the declared-identity pronoun line said nothing for this page;
and the house rule names TA as a pronoun the original uses without saying how English renders it.
Measured over the pinned corpus:
sources write the neutral pronoun as `TA` in 2 entries,
`Ta` in 7 and `ta` in 8 (every occurrence a pronoun,
`TA 们` the plural in 6);
of the archives of those entries,
one (XingZ60,
a rewrite) keeps a bare `TA`,
and the rest render it "they" (Uekawakuyuurei 22 "they" to 0 "she",
Hangmster 18 to 0).
Fixed in the next commit:
the counter reads all three spellings,
the house rule states the English rendering,
and the deterministic floor refuses a translation carrying the pronoun untranslated.

The risk:
slice 5 also renders 「那些秋叶」 as `「One Among Us」`.
The name is right (the archives of all five entries naming 那些秋叶 render it "One Among Us",
one as "One Among Us Transgender Support") but the
gate kept it 4 to 3 over a consolidated candidate reading "Those Autumn Leaves",
the judges arguing the rendering from the archive alone.
The corner brackets around an English name are the source's punctuation carried across;
72 sources use them and 3 archives keep any,
all in quoted Chinese or a design element.
FIXED THE SAME AFTERNOON in `d5e4d1ea0`,
since both halves are house rules rather than judgement calls:
the community-vocabulary rule now names 那些秋叶 and its renderings (members,
the maintenance group),
and the punctuation rule says what corner brackets become,
quotation marks around a quotation and nothing around a name or a term.
Guarded by two cases in `house-policy-reaches-the-judges.unit.test.ts`,
shown to fail with the sentences removed.

WHAT LANDED FOR THE PRONOUN:
`d98e656cb` (counter,
house rule,
`translate-neutral-pronoun.ts` wired into `validateTranslatedSlice`,
tests;
each guard shown to fail with its rule neutralised),
`cd5288fa9` (lint shapes),
`dd132bc76` (README).
Measured over the pinned corpus with the built finding:
one archive flagged (XingZ60,
`TA` 3 times) and 15 sources.
The next pass launched at 15:03:34 UTC on `cd5288fa9` (pipeline `sha256-tree-v1:946ab54f`),
OpenRouter alone:
Uekawakuyuurei,
whose subject is `ta` throughout (12 `ta` and 1 `Ta`,
archive 22 "they" to 0 "she"),
into `~/temp/agent/Uekawakuyuurei-pronoun-20260904`.
Balance 5.32 USD at launch,
which is about one pass.

## The Uekawakuyuurei run on the pronoun build, 2026-09-04, 15:03 UTC: stopped by its own pictures

`TALLY Uekawakuyuurei status=INCOMPLETE ms=111956 aborted=false error=visual evidence incomplete for 3
referenced assets` at 15:05 UTC,
33 calls,
0.08 USD.
The entry shows eight pictures;
five carry nothing past the deterministic reader and were never sent.
The other three are an oil painting of ships (`IMG_1308.webp`,
24 characters of canvas noise from tesseract),
an ink drawing of two cats (`img197.webp`,
18) and an ink drawing of a destroyer whose only text is the hull number (`img370.webp`,
24).
Three readers each asked four times;
every reply either reported that the picture carries no text or transcribed `DE581`,
and the screen called the first a refusal and the second too short,
so all three pictures ended `no-reader-available`,
transient,
and the entry stopped at the completeness gate.
Across every run log this session,
56 entry-and-picture pairs corroborated and 8 failed,
on 5 pictures:
these three on both rosters,
`dogesir_/photo2.webp` on both,
`gqt/photo3.webp` at one reader of two.

A probe of the three OpenRouter readers over those five pictures (15 calls) put the wording on record:
14 refused replies name text ("There is no visible text in this image",
"I cannot read any text in this image.
There are no visible words",
"I can read the image,
but there is no visible text to transcribe"),
one declines without naming it ("I cannot read the image."),
and the destroyer draws `DE581`,
`DE581` and `D650`.

WHAT LANDED:
`20ea56cd0` logs the opening of a refused reply;
`d6ffc4812` splits absence from inability (`refusalReportsAbsence` in `reading-refusal.ts`:
names text,
no quality or access marker),
gives the screen three verdicts (usable,
short,
refused with clause `too-short`,
`reads-as-refusal` or `reports-no-text`),
stops re-asking an absence report,
and lets two readers reporting absence or answering short confirm a
picture textless in `readImagePair` (`no-text` with `confirmedBy`,
resumed).
Each guard shown to fail with its rule neutralised (refusal 2,
sense 3,
stage 3,
pair 5,
re-ask 2 failures),
then pass.
Rule recorded in `doc/planning/when-an-image-reading-makes-no-sense.md` (clause six) and the README.

Relaunched at 15:25 UTC on `d6ffc4812` into `~/temp/agent/Uekawakuyuurei-pictures-20260904`,
OpenRouter alone,
to read both today's fixes on one entry:
the pronoun rule on a `ta` subject and the textless confirmation on three pictures.
Balance about 5.3 USD at launch,
which is one pass.

## Uekawakuyuurei on the picture-fix build, 2026-09-04, 15:25 UTC: ships, and the balance runs out under it

`TALLY Uekawakuyuurei status=SETTLED slices=7 ... pageChanged=5 pageSilent=0 selection=contested ms=3190452`
(53 minutes,
524 calls,
3.84 USD by the `cost=` fields),
`DESTINATIONS Uekawakuyuurei source=4 page=4 dropped=0`;
verify-published `wordings=7 silent=0 chars=2774=expected missing=0`.
Tip `d6ffc4812`,
pipeline `sha256-tree-v1:646ad738`.

BOTH FIXES READ CLEAN ON THE PAGE.
Pictures:
`IMG_1308.webp` confirmed textless by 3 of 3 readers on the first ask,
`img197.webp` by 2 of 3,
`img370.webp` by 3 of 3 (all three short readings of the hull number),
no re-asks,
no visual-evidence stop;
the `PhotoScroll` and `ChannelBackupButton` lines ship as written.
Pronouns:
the page says they,
them or their 21 times for Ying,
he or she never,
and carries no bare `ta`;
the source writes `ta` 12 times and `Ta` once.
No `untranslated as` finding was raised in any lane,
so the house rule alone carried it.

THE FRONT MATTER went as the guard decision of 2026-09-02 provides.
The translate lane rendered `name: Hotaru`,
`alias: Ah Hotaru, Hotaru-chan, Akigumo`,
`location: China`;
the archive has no `location`,
so the shape rule excluded that candidate from the contest (`lane-contest-eligibility-floor`),
the standing lacked endorsement,
and the single consolidation attempt kept the archive's `name: uekawakuyuurei`,
`alias: Ying (Hotaru), Qiu Yun (Akigumo)`.
The contest's log line named the floor and not the finding,
which a later change corrected:
the line now names each excluded lane and its finding (`lane-contest-eligibility.ts`).

THE BALANCE RAN OUT UNDER CONSOLIDATION.
The lanes finished at 16:06 UTC with 1.98 USD left;
consolidation began at 16:11 UTC;
from 16:15:00 UTC OpenRouter refused calls while the meter still read 1.12 USD (the last reading before the refusal),
and `EveryProviderDryError` was raised 166 times through the gate and refiner rounds,
205 voices lost,
with the meter reading `openrouter=wet` and falling to 0.36 USD as smaller calls kept buying.
Every consolidation slice shipped its standing,
the lane-contest winner,
unpolished.
Seats:
minimax-m3 82 of 117 usable,
GLM-5.3-Flash 26 of 50,
gemma 93 of 106,
glm-5.3 27 of 45,
gpt-oss-120b 85 of 99,
deepseek-v4-flash 59 of 83,
Qwen3.8-27B 69 of 106,
deepseek-v4-pro 84 of 122,
the shortfall being the refusals.
This is the first live exercise of the every-provider-dry path:
the run did not hold and did not error;
it settled on what it had.

THE READING OF THE PAGE:
publishable.
Two notes,
neither a class.
The diagnosis carries italics the source does not (`*signet ring cell carcinoma of the ascending colon*`);
51 of 92 archives use italics,
for work titles,
so emphasis is not a marker the floor can refuse.
The quotation "just an unhealthy-looking boy in real life.",
carries the archive's own period-inside-quotes shape,
which the archive ends with a second period.
"Here's a selected few" is the archive's wording kept.

## The picture gather's wait, re-read on three-reader pictures, 2026-09-04

The open item since 2026-08-29 was to re-read the gather's straggler wait once passes had run pictures
with three readers rather than two.
Today's runs did,
so this is that reading.
It is a measurement and a recommendation,
not a change.

THE GATHER HAS NO STRAGGLER WINDOW.
`readImagePair` calls every reader through one `Promise.allSettled` and waits for all of them,
bounded only by each call's own timeout.
`STRAGGLER_GRACE_MS`,
120 seconds after quorum,
governs the judging rounds in `stage-round.ts` and never reaches the picture gather.

WHAT THE SPREAD COSTS NORMALLY.
Over every asset in today's logs that drew two or more reader replies,
20 of them,
the gap between the first reply and the last runs a median of 11.6 seconds,
a ninetieth percentile of 45 seconds,
and a maximum of 66 seconds.
The two clean three-reader assets of the picture-fix build spread 9.2 and 38.4 seconds.
A whole picture stage costs 66 seconds for the eight assets of Uekawakuyuurei and 95 seconds for the three of Toka_ls.
At those numbers a window would save nothing worth having.

WHAT IT COSTS WHEN A READER HANGS.
The BI4PBV pass of 04:43 UTC spent 367 seconds on four pictures,
almost all of it on `image1.webp`:
two readers answered and corroborated at 0.614 overlap,
and the gather then waited about six minutes for `hf:zai-org/GLM-5.3-Flash`,
which ended in `StreamCutShortError` and contributed nothing.
Corroboration needs two readings,
so those six minutes bought a verdict that was already settled.
The apparent 2707-second stage in the luxuanwen3 pass of 09:23 UTC is not a second case:
that log holds two picture stages,
a 13-second gather and a resume from cache 45 minutes later.

THE OPTION,
for the owner rather than for me.
A straggler cut in the gather,
once two readings are in hand,
would bound that case at the cut and change nothing else,
since the median spread is a tenth of any sensible window.
It costs the third reading on a slow-but-alive reader,
which is evidence the corroboration rule does not use.
Against it:
the gather is the one stage whose output nothing requires,
so its wall time is only ever a delay,
and one six-minute delay per corpus pass may not be worth another dial.
Recorded as measured;
no dial added.

## The providers come back, 2026-09-06: two defaults move and a rule is written

The owner returned with Synthetic refilled to a third
(`METERS synthetic=wet hyper=wet openrouter=wet syntheticWeekly=33.18% syntheticFiveHour=2750/2750
hyperBalance=2734 openrouterUsd=0.32` at 19:51 UTC),
OpenRouter still uncharged and expected within days,
and the instruction not to wait on it.

- **`yulianNyanner` launched at 19:53 UTC** on tip `14231350f` with all three providers configured and the
  2026-09-04 dials set (overlap 4,
    writer grace 180000),
    runs dir `~/temp/agent/yuliannyanner-20260906`.
    Asked whether the launch was necessary,
    the honest split:
    the double-quoted-path shape it was picked for had already been read on `MTF_0615` and `BI4PBV`;
    what it does test is the first run on this build with all three providers configured,
    the first chance at a consolidation that completes unstarved,
    and a fresh page to read.
- **The production default had never shipped a page.**
  `PASS_OVERLAP` in `corpus-run/pass-overlap.ts` was 1 until the overlap dial was decided;
    every page that shipped ran at 4 through `TRANSLATION_REPAIR_SLICE_OVERLAP`.
    The overlap dial had been measured on four matched pairs on 2026-08-27 and 2026-08-28
    (`keyword233`,
    `Toka_ls`,
    `Zha_Ke`,
    `Weideriche_`;
    normalized wall down 0.091,
    0.273,
    0.239 and 0.183 against a 0.03 band,
    voices never worse)
    and never read into a default because the 2026-09-01 hold froze the pipeline.
    Guard `bb5e97e0e` shown to fail on the old build (`value=1 source=fallback` at
    `pass-entry.unit.test.ts:1927`);
    fallback moved in `e50be2299`;
    record `doc/decision/translation-repair-pass-overlap.md`,
    flagged for veto.
- **The owner's rule is always kill and relaunch.**
  A source change while a pass runs means kill the pass by pid,
    build,
    and relaunch the same entry into a fresh runs dir on the new build;
    a page finished on a superseded build is not readiness evidence;
    a known fix lands before the launch.
    Written into the package README,
    the runbook's launch and restore steps,
    the handover hub,
    the 2026-09-04 snapshot,
    the run-continuity and overlap-dial handovers (`0d2203abd`),
    and deliberately not into the root `AGENTS.md`.
    The 19:53 UTC run was killed at 20:01:44 UTC under it,
    264 calls in (148 Hyper,
    116 Synthetic),
    still in the lanes phase.
- **The writer window was the same defect.**
  The straggler-grace record reserved it for the owner.
    Every shipped page ran its writers at 180000 ms through `TRANSLATION_REPAIR_WRITER_GRACE_MS` while the
    round window was the owner's 120000 ms.
    Measured off the four shipped logs of 2026-09-04:
    writer-round cuts at 180 s were 4,
    6,
    11 and 20 (almost all `produceConsolidations`) against 28,
    35,
    26 and 135 reader-round cuts at 120 s;
    writers at 120 s has no matched arm.
    Offered build it in,
    keep the dial,
    or writers at the round window,
    the owner chose build it in.
    `7a2bdbedf`:
    `WRITER_GRACE_MS = 180_000`,
    never shorter than the round window so the calibration keeps its 300000 ms;
    guard shown to fail neutralised (4 `FAIL`) and pass restored (0);
    oxlint 0 and 0,
    types clean.
- **`yulianNyanner` relaunched at 20:21 UTC** on `7a2bdbedf`,
  pipeline `cb326421`,
    the plain invocation with no dial set,
    runs dir `~/temp/agent/yuliannyanner2-20260906`,
    log beside it.
    The log opens `OVERLAP yulianNyanner value=4 source=fallback` and `WRITER GRACE built in`,
    all three providers wet,
    weekly 32.19 percent after the killed run,
    Hyper 2722,
    roster 9,
    `withheld=none`.
    The reading follows.

## The first plain-invocation run, 2026-09-06, 20:21 UTC: the fifth class, and no page

`yulianNyanner` ended `INCOMPLETE` at 20:50:19 UTC,
1,715,943 ms (28.6 minutes) and 742 calls in
(Hyper 55 percent,
Synthetic 45 percent,
no OpenRouter call),
with `slice 1: the standing text failed the deterministic publication rule and the consolidation left nothing
valid to ship (incumbent-only)`.
Weekly Synthetic went from 32.19 to 31.40 percent and Hyper from 2722 to 2686 credits,
which prices one stopped attempt at about 0.8 percent of the week and 36 credits.

- **What the log said.**
  Eleven `MdxParseError` lines,
    eight at `3:2`,
    two at `5:2`,
    one at `9:2`,
    every one `micromark-extension-mdx-jsx/unexpected-character`,
    every one on the ORIGINAL:
    `contest winner fails publication invariants and remains retryable: no comparison was possible: original
    could not be read` on slices 1,
    2,
    4,
    8,
    11 and 12 at the contest,
    then `consolidation standing text fails the deterministic publication rule and is withheld from the slate`
    on slice 1,
    then `ConsolidationStandingIneligibleError`.
    Translation itself had finished:
    `translated 17 slices (0 resumed): 13 changed, 0 refused by a guard`.
- **What the source carries.**
  Fourteen HTML comment lines,
    translator notes between paragraphs
    (a glossary and section-voice markers),
    and the column the grammar names is the `!` of `<!--`.
    Measured at pin `a41fc607`:
    17 of 92 sources carry a comment,
    34 comment lines in all,
    14 of them here;
    22 of 92 archives carry one,
    and this archive renders the fourteen as twelve English comments.
    The three pages that shipped on 2026-09-04 carry none,
    and the one comment `keyword233` and `Toka_ls` each carry is the contributor credit,
    which preparation handles apart.
- **The class.**
  `parse-document.ts` masks HTML comments to same-length whitespace before its strict MDX parse,
    because the grammar refuses `<!--` outright.
    `readSliceSkeleton` in `translate-skeleton.ts` handed the strict grammar the raw slice.
    So an original with a note was `unparseable`,
    `validateTranslatedSlice` answered `unknown`
    (its own comment says an unreadable original "is not a candidate's fault"),
    and both consumers of the floor,
    `lane-contest-eligibility.ts` and `consolidate-ineligible-standing.ts`,
    treat `unknown` as inadmissible.
    Every commented slice was therefore unshippable on any roster,
    and the entry could never settle.
    The candidates were fine:
    142 slice-cache files carry a rendered comment.
- **The fix,
  `259708e79`.**
  The slice reader masks comments the way the document reader does,
    on both sides of the comparison;
    the mask keeps offsets,
    so atoms after a comment still index the unmasked text.
    Whether a candidate carries the note rendered is left to the judges as wording,
    since the archive itself does not keep parity (fourteen to twelve).
    Guards `ebf6524de` in `translate-skeleton.unit.test.ts` and `translate-validate.unit.test.ts`,
    shown to fail on the unfixed build (2 `FAIL` lines in each suite) and pass on the fixed one;
    `translate-skeleton-page.unit.test.ts` 0 `FAIL` as well;
    oxlint 0 and 0,
    types clean.
    `inspect-paragraph.ts` parses strictly too but is handed paragraphs the document reader already produced,
    which never contain a comment,
    so it is not a sibling.
- **`yulianNyanner` relaunched at 21:03:43 UTC** on `3ab2d318a`,
  pipeline `597fa3e0`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner3-20260906`,
    log beside it,
    under the kill-and-relaunch rule (the 20:21 UTC run had already exited on its own).
    The reading follows.

## The third launch, 2026-09-06, 21:03 UTC: the first page on the plain invocation, and the sixth class

`yulianNyanner` SETTLED at 21:48 UTC in 2,694,071 ms (44.9 minutes),
17 slices,
1,180 calls (Hyper 673,
Synthetic 507,
OpenRouter none),
14 straggler cuts (7 at the 120 s reader window,
7 at the 180 s writer window),
6 schema mismatches,
8 transport retries,
3 recovery rounds,
every meter wet throughout,
and the consolidation completed unstarved,
which no run had done since 2026-09-02.
Weekly Synthetic went from 31.37 to 27.48 percent and Hyper from 2686 to 2622 credits,
so one settled entry costs about 3.9 points of the week and 64 credits at zero USD.
`verify-published`:
matched 1,
wordings 17,
silent 0,
`chars=6020=expected`.
`DESTINATIONS source=0 page=0 dropped=0`,
since the source links nowhere.
Three pictures gathered,
all three textless by the deterministic reader,
no model asked.

- **What the page got right,
  read beside the source and the archive.**
  The front matter `desc` is the source's sentence again,
    where the archive had replaced it with the page's closing line;
    the alias carries the source's 涟 beside the archive's romanizations;
    the Japanese lyric line reads as the source writes it where the archive had altered a syllable;
    高二 is "second year of high school" where the archive said "until high school";
    both `PhotoScroll` lines are intact,
    the two-line single-quoted array and the double-quoted one inside a blockquote;
    every one of the fourteen source comments is an English comment in its place,
    including the lyrics attribution the archive dropped;
    no bare pronoun,
    no corner bracket,
    the site's name absent from this source.
- **The defect.**
  The page carries `## Dysphoria` twice:
    for 烦躁,
    whose source comment says the English word for this title is dysphoria,
    and for 桎梏,
    which the archive renders "Shackles".
    Ledger contest 000031 over the 桎梏 slice:
    six candidates,
    three headed Shackles and three Dysphoria,
    the judges chose Dysphoria,
    and seven of eight ballots give the same reason,
    that "the declared editor comment fixes the heading as Dysphoria";
    the one dissent read 桎梏 literally.
    Every one of the twelve prompts carrying that slice carried the note,
    as an identity-context line with no position:
    `- ORIGINAL editor comment: 这里标题对应的英文词是 dysphoria`.
    The note sits under the third heading and speaks of "this title";
    carried into every slice,
    "this" pointed at every heading at once.
- **Smaller readings.**
  "My mind always drifts" in the Introduction,
    a section whose own comment says it is objective narration,
    where the archive has "her mind";
    the translator-instruction comment rendered into English as a comment,
    harmless and pointless;
    the alias listing the name itself.
    Wording,
    for the judges,
    and recorded.
- **The class,
  six.**
  A positional note carried without its position.
    Fixed in `459b2007f` and `7a01c9048`:
    each comment line names "under heading X" or "before the first heading";
    the critic sheet and the house policy say that a note about "this title" or "here" speaks of that heading
    and no other;
    and the publisher refuses a would-ship page on which two headings that differ in the source read the same
    (`CollapsedHeadingError`,
    `corpus-run/heading-distinctness.ts`),
    measured at pin `a41fc607` to refuse nothing:
    no source repeats a heading and no archive collapses two.
    Guards `01b896ea7` shown to fail on the unfixed build (entry-notes 3 `FAIL` lines;
    the floor did not exist),
    0 `FAIL` on the fixed one,
    the publisher,
    critic and preparation suites 0 as well;
    oxlint 0 and 0 after `147c417b6`,
    types clean.
    The floor's own fail-first proof:
    refusal inverted,
    5 `FAIL`;
    restored,
    0.
- **`yulianNyanner` relaunched at 22:06:22 UTC** on `147c417b6`,
  pipeline `30cd442b`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner4-20260906`,
    and killed at 22:07:59 UTC,
    26 calls in,
    when the full suite on that build (934 `PASS`,
    2 `FAIL`) showed the names-only message inventory did not know `CollapsedHeadingError`;
    the inventory is a test file,
    fixed in `e5bd6bf0f` with no rebuild,
    and the rule was applied as written.
- **`yulianNyanner` relaunched at 22:10:19 UTC** on `e5bd6bf0f`,
  the same pipeline `30cd442b`,
    fresh runs dir `~/temp/agent/yuliannyanner5-20260906`,
    log beside it.
    The reading follows,
    with the five headings first.

## The fifth launch, 2026-09-06, 22:10 UTC: the headings hold, and the seventh class

`yulianNyanner` SETTLED at 22:50 UTC in 2,362,951 ms (39.4 minutes),
17 slices,
1,150 calls (Hyper 651,
Synthetic 499,
OpenRouter none),
6 straggler cuts,
no refusal of any kind,
no collapse,
every meter wet,
consolidation unstarved.
Weekly Synthetic 27.41 to 23.54 percent,
Hyper 2622 to 2559.
`verify-published` matched,
`chars=6068=expected`.
`DESTINATIONS source=0 page=0 dropped=0`,
three pictures textless,
all fourteen comments rendered in place,
both `PhotoScroll` shapes intact,
"her mind" in the objective section where the 21:03 UTC page had slipped to "my".

- **The headings hold.**
  Introduction,
    Shackles,
    Dysphoria,
    Wishes,
    Final Chapter.
    The translate contest over the 桎梏 slice offered three candidates and all three were headed Shackles;
    the consolidation ballots now reason from the anchor
    ("the passage sits under the heading 烦躁,
    which the editor comment marks as first-person"),
    which is the line the fix added doing what it was for.
- **By design,
  not a defect.**
  The alias reads `Lyna, 涟, Yulian, Nyanner` because the translate sheet's identity rule requires the
    translated name among the alias renderings when the original declares name and alias as one identity,
    which this source does;
    a ballot cites the rule by number.
- **The seventh class.**
  Five contractions on the page carry a straight apostrophe
    (I'd,
    can't,
    What's,
    wouldn't,
    Let's)
    against thirty curly ones and an archive that is curly throughout;
    the 21:03 UTC page had none,
    and measured on the pages that shipped on 2026-09-04,
    `Uekawakuyuurei` carries five straight against two curly and nobody read it.
    `restore-typography.ts` exists for exactly this and runs on every editor and refiner replacement;
    a translate-lane wording,
    a consolidation proposal and a polish rewrite never passed through it.
    Fixed in `bc42fe330` and `b669363b6`:
    the would-ship reading,
    which every publisher and checker derives the page from,
    puts each non-archive wording through the restoration against the row's incumbent and the stored archive
    text,
    so the artifact keeps what the stages wrote and the page and its checks agree.
    Guard `fd7701f49` shown to fail on the unfixed build (2 `FAIL` lines),
    0 on the fixed one with the page-check,
    publish,
    final-selection and critic suites;
    types clean.
- **Wording,
  for the judges,
  recorded.**
  贴贴 kept in Chinese with a gloss where the archive had "get close to someone online":
    the community-vocabulary rule was applied to a term that has an everyday English equivalent,
    and the house policy now says so with this example (`bc42fe330`).
    自慰 rendered by its blunt literal sense in a quoted despairing thought where the archive and the 21:03 UTC page
    read it as self-consolation;
    a polysemous word,
    the judges' call,
    and a stochastic one across two runs of the same slice.
- **`yulianNyanner` relaunched at 23:11:16 UTC** on `c69a256bd`,
  pipeline `7ec38326`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner6-20260906`,
    log beside it,
    after the full suite on that build read 935 `PASS` and 0 `FAIL`,
    oxlint 0 and 0,
    types clean.
    Weekly Synthetic 23.53 percent at launch.
    The reading follows,
    with the apostrophe count first.

## The sixth launch, 2026-09-06, 23:11 UTC: the apostrophes hold, and the eighth class

`yulianNyanner` SETTLED at 23:56 UTC in 2,647,492 ms (44.1 minutes),
17 slices,
1,228 calls (Hyper 702,
Synthetic 526,
OpenRouter none),
no refusal of any kind,
every meter wet,
consolidation unstarved.
Weekly Synthetic 23.53 to 19.13 percent,
Hyper 2559 to 2491,
zero USD.
`verify-published` matched,
1 of 1 at the length the artifact implies.
Five distinct headings,
all fourteen comments rendered in place,
three pictures textless,
`DESTINATIONS source=0 page=0 dropped=0`.

- **The apostrophes hold.**
  Zero straight apostrophes inside words against forty curly ones,
    where the 22:10 UTC page had five against twenty-nine and the archive has none against thirty-six.
    The one straight quote left after a letter is `girls'`,
    a plural possessive,
    which the restoration's apostrophe rule skipped because a quote with a space on one side may be
    closing a quotation.
- **The eighth class.**
  The blockquoted component line reads
    `> <PhotoScroll photos={[“${path}/photos/photo3.webp”]} />`:
    the class-seven fix put every non-archive wording through the restoration,
    the restoration protected backtick spans and nothing else,
    and a JSX string literal in typographic quotes compiles nowhere.
    Every slice floor had passed the straight-quoted slice,
    since the would-ship reading runs after them,
    and nothing between that reading and the disk read the page as a document.
    The log had said it and nobody refused:
    `publish: destinations-mdx-downgraded (page)`,
    a warning from the destination check,
    which parses the page and names the fall to plain markdown as a finding.
    Measured at the pin,
    19 of 92 sources carry a tag with a double-quoted attribute
    (`<p style="text-align: end;">` in `XingZ60` and `luxuanwen3` among them),
    so the class was waiting on every one of those.
- **Fixed guard first.**
  `2079c8c99`:
    the publisher reads the assembled page the way every document is read,
    `parseDocument`,
    and refuses one whose strict parse fell back (`UnparseablePageError`,
    names only,
    entry id and the parser's refusal site).
    `ba91c5587`:
    `typography-prose-mask.ts` marks backtick spans and tags,
    `<` followed by a letter or `/` through the `>` that is not a blockquote marker,
    as not prose,
    and every rule of the restoration reads that one mask;
    a trailing apostrophe converts when the replacement holds no straight single quote shaped like an
    opening one,
    which is `girls'`.
    Guards shown to fail on the neutralised build:
    the floor inverted,
    5 and 7 `FAIL` lines in the page-grammar and publisher suites;
    the mask never entering a tag,
    4;
    the trailing rule removed,
    2;
    0 on each restore.
    Full suite 936 `PASS`,
    0 `FAIL`;
    oxlint 0 and 0;
    types clean.
- **The reading gains two greps.**
    `mdx-downgraded` and `would ship a page` join the refusal vocabulary,
    and the apostrophe count now reads any straight quote after a letter,
    not only one inside a word.
- **A page from a superseded build no longer verifies.**
  `verify-published` against the 22:10 UTC runs dir on the class-seven build reads 0 of 1,
    because the would-ship reading moved under it;
    the tool now says what the rule says.
- **Recorded,
  not fixed.**
  The blank line after the front matter is dropped on every `yulianNyanner` page and on `Hangmster`,
    a splice property of the front-matter slice,
    not a rendering defect,
    since the site strips the front matter before the body is compiled.
    贴贴 now reads "cuddle online" under the house rule;
    自慰 reads "masturbation fantasies" again,
    the same literal sense as the 22:10 UTC page,
    the judges' call.
    The alias and the `desc` are as before,
    the one by the identity rule and the other from the source.
- **`yulianNyanner` relaunched at 00:12:39 UTC on 2026-09-07** on `ba91c5587`,
  pipeline `4d000da8`,
    plain invocation,
    fresh runs dir `~/temp/agent/yuliannyanner7-20260907`,
    log beside it,
    weekly Synthetic 21.05 percent at launch.
    The reading follows,
    with the component line and the apostrophe count first.
