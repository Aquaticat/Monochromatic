# Translation repair handover snapshot: 2026-09-06

Part of the [current translation repair handover](translation-repair.md).
The previous snapshot is
[`translation-repair-handover-2026-09-04.md`](translation-repair-handover-2026-09-04.md).

The owner returned with Synthetic refilled to a third and Hyper wet,
OpenRouter still uncharged,
and the instruction not to wait on it.
Before the first page,
two defaults that had never shipped a page became the configuration every shipped page had run,
the owner wrote one operating rule,
and the first pass on the plain invocation found the fifth defect class in 28.6 minutes.
Five pages of `yulianNyanner` shipped after it and each was read;
the first four found a class each,
the eighth made by the seventh's fix,
and the fifth found none.
`TLL1122` then shipped clean with the first footnote,
and `Huasheng` found the ninth class before its first page,
the slice floor refusing half a container.
The pipeline is still not production ready,
and the reason is recorded in
[`translation-repair-readiness-signal.md`](../planning/translation-repair-readiness-signal.md).

## Where the work stands

Three pages of `yulianNyanner` shipped on the plain invocation today and each was read:
21:03 on the class-five build (44.9 minutes,
found the sixth class),
22:10 on the class-six build (39.4 minutes,
headings held,
found the seventh),
23:11 on the class-seven build (44.1 minutes,
apostrophes held,
found the eighth),
and 00:12 UTC on 2026-09-07 on the class-eight build (51.2 minutes,
component line held,
no class found,
one ellipsis restored after it in `e3471dc0b`),
each at zero USD with an unstarved consolidation and `verify-published` matched.
`TLL1122` then shipped on the ellipsis build at 01:41 UTC on 2026-09-07 (30.1 minutes,
the first read page with a footnote,
no class found).
`Huasheng` was launched at 01:44 UTC and killed at 02:56 under the rule after the slice floor refused
its two container halves (the ninth class,
fixed in `ed7f82de9`).
`Huasheng` ran again on the class-nine build from 03:09 UTC:
the container halves passed,
the Synthetic week ran dry at 04:36,
and slice 21 stopped the entry at 05:21 because every producer followed the source's two poem
paragraphs where the archive has five and the block floor requires the archive's.
That was the tenth class and a design question;
the owner chose either rendering at 08:38 UTC and it is landed bounded to split-only pages
(`b46dd9210`,
`doc/decision/translation-repair-block-floor.md`).
The third `Huasheng` pass then ran 150 minutes on Hyper alone,
passed the containers and the poem,
and was refused at the publisher by `directory-id-name`,
because the pinyin of 椛笙 is the directory id:
the eleventh class,
a second design question,
answered by the owner at 11:30 UTC with the pinyin check and the alias exemption and landed in
`912dbe2dc`.
Hyper has 1275 credits,
about one pass of this size.
When a pass runs next it is read by the seven steps in the 2026-09-04 snapshot,
"How a pass is launched and read",
which gained the apostrophe and ellipsis counts and two refusal greps today.
If a pass is running when this is read and the tree has moved past its tip,
the kill-and-relaunch rule applies.

The full unit suite emitted 936 `PASS` lines and zero `FAIL` lines on the class-eight build,
oxlint 0 warnings and 0 errors,
types clean,
markdown lint clean on every line written today.

## Repository state

- Worktree:
  `/var/home/user/worktrees/translation-repair`.
- Branch:
  `translation-repair-rebased`,
  auto-push on.
- Tip:
  `912dbe2dc` for the code;
  the documents move after it.
- Corpus pinned at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` in `~/one-among-us/data`.
- Meters at 11:14 UTC on 2026-09-07:
  `synthetic=dry hyper=wet openrouter=wet syntheticWeekly=0%`,
  Hyper 1275 credits,
  OpenRouter 0.32 USD.
  Synthetic trickled back to 2 percent between 05:31 and 08:43 and was spent again within the hour;
  a Huasheng pass on Hyper alone costs about 800 credits.
  Each settled `yulianNyanner` pass today cost 3.9 to 4.6 points of the Synthetic week and 60 to 82 Hyper
  credits at zero USD.
  One stopped 28-minute attempt cost about 0.8 percent of the Synthetic week and 36 Hyper credits;
  no call reached OpenRouter,
  since routing spends Synthetic and Hyper first.

## What landed today

Newest first.

-   `b0b48d6f4` (2026-09-07,
    23:50 UTC):
    `google.gemma-4-e2b` seated as a judge on the fidelity probe
    (11 of 12 against a seated median of 9.5),
    in no writing seat;
    `google.gemma-4-31b` stays out (6 of 12).
    Decision addendum in `doc/decision/translation-repair-roster-seating-2026-09-01.md`;
    numbers in the planning log under "Measuring the two Bedrock-only sizes".
    The roster is ten;
    Bedrock serves three judges while Hyper is held out.
-   `c9cd537e6` (2026-09-07,
    23:35 UTC):
    the fourteenth class.
    OpenRouter at 0.01 USD read wet and answered every call 402,
    was held 60 s as a rate limit,
    and the fifth hakureico pass waited on its short hold instead of Hyper's and stopped in 67 seconds.
    A payment refusal now reads the provider dry until its meter moves
    (`markRefused({ paymentRequired })`,
    `isPaymentRefusal`).
    Planning log:
    "The fifth pass stops in 67 seconds".
-   `e17d0c487` (2026-09-07,
    23:20 UTC),
    guarded at `8e64a6ef7`:
    the thirteenth class's second face.
    The fourth hakureico pass met Hyper's daily limit two minutes into consolidation,
    after the phase had seated,
    and stopped INCOMPLETE when slice 5's slate declined under the hold.
    Every chunk of every lane now waits out a named hold that keeps its bench from quorum
    (`awaitBenchQuorum` in `run-seats-read.ts`,
    `beforeSlice` on the three drivers,
    free while nothing is held).
    Planning log:
    "The fourth hakureico pass stops INCOMPLETE".
-   `752bf9a9b` (2026-09-07,
    22:17 UTC):
    the thirteenth class.
    A phase whose benches cannot reach quorum among the seats a wet provider serves
    waits out the shortest named hold once (`run-seats-wait.ts`,
    `RunClient.providerHolds`,
    `JUDGE SEATS ... waited=`),
    and the translate lane re-reads its seats when it is about to start
    (`runDocumentLanes` `reseatTranslate`,
    `pass-reseat.ts`).
    Found by the third hakureico pass,
    which settled in 13.3 minutes with Bedrock on its two shared seats,
    class twelve holding Hyper out for the 538 s it named,
    and the translate lane and consolidation running on nobody under that hold;
    read in the planning log under "The first hakureico page".
    The fourth launch at 22:21 (runs dir `~/temp/agent/hakureico4-20260907`,
    pid 3814733) is on it.
-   `a317f4e03` (2026-09-07,
    21:45 UTC):
    Bedrock sits ahead of Hyper,
    the owner's decision of 21:41 ("Yes Bedrock sit ahead"),
    recorded as the addendum in `doc/decision/translation-repair-openrouter-fallback.md`;
    with it the probe flags `--candidates` and `--candidates-alone` (`8f47f117b`,
    `7de4e7b64`),
    rebased from `translation-repair-class12`.
    The second hakureico pass was killed under the rule at 21:41 and the third launched at 21:47
    (runs dir `~/temp/agent/hakureico3-20260907`,
    pid 3764858),
    the first in which Bedrock takes the seats it shares with Hyper.
-   `645c8787b` (2026-09-07,
    21:04 UTC):
    the two Bedrock-only Gemma sizes leave every run role.
    `RUN_ROSTER` had been the whole of `ROSTER_MODEL_IDS`,
    eleven since the fourth provider,
    so the first `hakureico` launch judged and translated with two unmeasured models;
    killed under the rule after eight Bedrock calls,
    relaunched at 21:08 on the fix.
    Beside it,
    unmerged on `translation-repair-class12` until that pass settles:
    `abdb06c1b` and `35e0b1fad`,
    `--candidates` and `--candidates-alone` on `judge-fidelity-probe` and `producer-calibrate`,
    so a seatable model can be measured without first taking a role.
    The numbers are in the planning log under "Measuring the two Bedrock-only sizes".
-   `263b7ca73`,
    `7b532ae31` and `31e67a100`,
    fast-forwarded from `translation-repair-class12` on 2026-09-07 at 20:55 UTC:
    Amazon Bedrock as the fourth provider (order Synthetic,
    Hyper,
    Bedrock,
    OpenRouter;
    the three Gemma 4 sizes and gpt-oss-120b on mantle's two routes;
    a durable USD ledger against the owner's 200 USD),
    and the twelfth class,
    a refusal that names its return held out for that wait.
    Both built and proven in a throwaway worktree while the fourth Huasheng pass ran.
-   `912dbe2dc` lets a directory id stand as the visible name where it is a pinyin reading of the
    source name,
    the source's own alias,
    or beside a Latin-script alias,
    the owner's decision (`doc/decision/translation-repair-front-matter-guard.md`,
    addendum 2026-09-07);
    `pinyin-pro` joins the catalog.
-   `b46dd9210` accepts a candidate shaped as the original where the page only splits its blocks,
    the owner's either-rendering decision bounded to splits
    (`doc/decision/translation-repair-block-floor.md`).
-   `ed7f82de9` reads a slice that owns one half of a container by masking the lone tag before the
    strict parse and carrying it as a `container-tag` atom (`mask-container-tags.ts`),
    guard shown to fail first.
-   `e3471dc0b` restores the ellipsis form the document uses beside its quote style,
    through the same prose mask,
    silent where a document shows both forms.
-   `ba91c5587` keeps the typography restoration out of tags and code through `typography-prose-mask.ts`
    and curls a trailing possessive apostrophe;
    `2079c8c99` refuses a would-ship page the MDX grammar cannot parse (`UnparseablePageError`),
    read as every document is read;
    three guards shown to fail on the neutralised build and to pass restored.
-   `bc42fe330`,
    `b669363b6`,
    `ec91a14f5` ship every stage's wording in the archive's quote convention at the would-ship reading,
    with guard `fd7701f49` shown to fail first,
    and add the 贴贴 example to the house policy;
    `c421c2e31` and `6b842dcdf` record the 22:10 page and add the apostrophe count to the reading steps.
-   `e5bd6bf0f` inventories `CollapsedHeadingError` for the names-only message check,
    after the full suite on the class-six build showed 2 `FAIL`;
    the 22:06 launch was killed for it under the rule.
-   `7effa1b73` records the first page and the sixth class;
    `7f0d84169` and `7a01c9048` close the oxlint findings in the new code.
-   `459b2007f` names the heading a source comment sits under on its identity-context line,
    says in the critic sheet and house policy what that anchor means,
    and refuses a page that renders two distinct source headings as one
    (`CollapsedHeadingError`),
    with guards `01b896ea7` shown to fail first and the floor proven by inversion.
-   `30ce3994f` writes this snapshot and points the hub and map at it.
-   `cf1450162`,
    `3ab2d318a`:
    the fifth class recorded in the planning log,
    the readiness signal and the README status.
-   `259708e79` reads a slice under the grammar the document was read in,
    HTML comments masked to same-length whitespace,
    with guards `ebf6524de` shown to fail on the unfixed build.
-   `304e3ed98`,
    `bd83628b8`:
    the day's planning-log and readiness sections.
-   `7a2bdbedf` builds the writer rounds' 180000 ms window in,
    never shorter than the round window,
    by the owner's decision;
    guard neutralised 4 `FAIL`,
    restored 0.
-   `56c2ab488`,
    `0d2203abd`:
    the always-kill-and-relaunch rule in the package README,
    the runbook's launch and restore steps,
    the handover hub,
    the 2026-09-04 snapshot,
    and the run-continuity and overlap-dial handovers.
-   `e50be2299` keeps four slices in flight in the corpus pass by default,
    on the four matched pairs `#261` asked for,
    with guard `bb5e97e0e` shown to fail first;
    record `doc/decision/translation-repair-pass-overlap.md`,
    flagged for the owner's veto.

## The fifth class

Found by the first pass on the plain invocation,
not by a test.
`parse-document.ts` masks HTML comments before its strict MDX parse;
`readSliceSkeleton` in `translate-skeleton.ts` did not,
so every slice whose original carried a translator note was "an original that could not be read",
the deterministic floor answered `unknown`,
and both gates that consume the floor treat `unknown` as inadmissible.
The entry stopped at consolidation with nothing to ship after 742 calls.
17 of 92 sources carry a comment,
34 comment lines in all,
14 of them in `yulianNyanner`;
none of the three pages that shipped on 2026-09-04 had one.
The archive renders that entry's fourteen comment lines as twelve English comments,
so comment parity is not a rule the archive itself would pass,
and whether a candidate carries a note rendered is left to the judges as wording.

The pattern of 2026-09-04 held:
a class per new source shape,
none on a repeat.

## The sixth class

Found by reading the first page the plain invocation shipped.
The page carries `## Dysphoria` twice,
for two different source headings,
because the source comment "the English word for this title is dysphoria",
which sits under the third heading,
reached every slice as an identity-context line with no position,
and seven of eight consolidation judges bound "this title" to the second heading
(ledger contest 000031 in the run dir).
A positional note carried without its position.
Each comment line now names "under heading X" or "before the first heading",
the sheets say a note about "this title" or "here" speaks of that heading and no other,
and the publisher refuses a would-ship page on which two headings that differ in the source read the same;
measured at pin `a41fc607`,
no source repeats a heading and no archive collapses two,
so the floor refuses nothing the archives would ship.

The same page repaired the archive in four places the reading could name
(the front matter `desc`,
a lyric syllable,
a school year,
a dropped attribution),
carried both `PhotoScroll` shapes and all fourteen comments,
and completed consolidation unstarved,
which closes the last open item of the 2026-09-04 snapshot.

## The seventh class

Found on the 22:10 page,
where the headings held.
Five contractions carry a straight apostrophe against thirty curly ones on a page whose archive is curly
throughout,
and the `Uekawakuyuurei` page of 2026-09-04 carries the same mix unread.
`restore-typography.ts` runs on every editor and refiner replacement and on nothing else,
so a translate-lane wording,
a consolidation proposal or a polish rewrite reached the page in whatever quote style its model wrote.
The would-ship reading,
which every publisher and checker derives the page from,
now puts each non-archive wording through the restoration against the row's incumbent and the stored archive
text;
the artifact keeps what the stages wrote.
The reading steps gain the apostrophe count,
since this is a property four shipped pages carried unmeasured.

Two wording findings are recorded for the judges rather than fixed:
贴贴 kept in Chinese with a gloss where an everyday English word exists
(the house policy now says so with this example),
and 自慰 read by its blunt literal sense in a quoted despairing thought.

## The eighth class

Found on the 23:11 page,
where the apostrophes held.
The blockquoted component line shipped as `{[“…”]}`,
a JSX string literal in typographic quotes,
because the seventh class's fix sent every non-archive wording through a restoration that protected
backtick spans and nothing else.
Every slice floor had passed the slice;
the would-ship reading runs after them,
and nothing between it and the disk read the page as a document,
though the destination check had logged `destinations-mdx-downgraded (page)` as a warning.
19 of 92 sources carry a tag with a double-quoted attribute.
The publisher now refuses a page whose strict parse falls back to plain markdown,
the restoration reads one prose mask that excludes tags and code,
and a trailing possessive apostrophe (`girls'`) converts when nothing in the replacement could pair with it.
The reading steps gain `mdx-downgraded` and `would ship a page`,
and the apostrophe count widens to any straight quote after a letter.

## The ninth class

Found by the Huasheng pass before its first page,
at the lane contest,
70 minutes in.
`container-extents.ts` gives a container's opening tag to the first block inside it and its closing tag to
the last,
so a container whose blocks fall in different slices puts `<details>` alone at the head of one slice and
`</details>` alone at the foot of another,
and the strict grammar the slice floor reads under refuses either half alone
(end-tag mismatch,
unexpected closing slash).
The floor answered that the original could not be read,
which both gates treat as inadmissible,
so the entry would have stopped at consolidation as yulianNyanner did for a comment on 2026-09-06.
A lone tag is now masked to same-length whitespace before the strict parse,
as comments are,
and carried as a `container-tag` atom,
so a candidate that drops the tag fails the floor deterministically.
30 of the pinned pages carry a disclosure element.

## The tenth class

Found by the Huasheng relaunch at its poem slice,
which the source writes as two `<br/>` paragraphs and the archive as five paragraphs.
The block floor required the archive's five and every producer followed the source,
so nothing was valid and the entry stopped.
34 of 92 archives carry more top-level blocks than their source.
A design question,
put to the owner with four options;
the owner chose either rendering,
landed bounded to pages whose surplus is only more blocks of the original's own kinds
(22 of the 34),
so that the sixth consolidation bed's dropped passage and the archive's meaningful blockquote stay
refused.

## The eleventh class

Found at the publisher by the third Huasheng pass.
`directory-id-name` refuses a page whose visible name is the directory id while the source's is not,
the owner's rule of 2026-09-02 for archives that never translated their metadata.
The source names the person 椛笙,
whose pinyin is Huasheng,
which is the directory id;
the judges chose it by the identity rule and the floor refused it.
7 of the 22 archives naming the directory do so because the id is a rendering of the name.
The owner chose the pinyin check and the alias exemption,
read on both front matters;
landed in `912dbe2dc`,
and under it every directory-named archive at the pin stands while a bare folder name still falls.

## The twelfth class

Found in the meters by the fourth Huasheng pass,
not at the publisher.
From 17:00 to 19:54 UTC Hyper answered every call
`You've hit your daily rate limit. Please try again in 2h25m18s`
(84 bodies,
each counting down to the same instant)
while its balance read wet at 909 and the hourly pacer kept the window exactly full.
The retry ladder read digits followed by `s` only,
so a wait in hours and minutes parsed as no wait;
the router held Hyper out 60 s at a time as a concurrency limit:
2,693 refused attempts,
831 holds,
four consolidation chunks of 75 min settling on nobody.
Landed in `31e67a100`:
the wait parses as hours,
minutes and seconds;
a wait past the ladder's own widest backoff window ends the ladder at once;
`markRefused` holds the provider out for at least the wait its refusal named,
whatever the meter reads.

## The fourth provider

The owner's Amazon Bedrock account,
2026-09-07:
200 USD of credits expiring early next year,
never to be topped up,
to be used as much as the pipeline likes;
raw fetch,
no SDK;
under zero data retention the served models are Gemma 4 E2B,
31B,
26B-A4B and gpt-oss-120b (Claude Sonnet 5 was named and retracted).
Landed in `7b532ae31`,
recorded in the planning log under "The owner adds Amazon Bedrock":
the key in this worktree's `.env.local.json`,
`bedrock` third in `PROVIDER_ORDER`,
the Gemma sizes under `/openai/v1` ending on `[DONE]` and gpt-oss under `/v1` ending on its usage chunk,
cost computed from usage and the catalog's prices,
an append-only ledger under `~/.local/state/translation-repair/bedrock-spend.jsonl` read as the meter
(`bedrockUsd=` on the `METERS` line),
the two Bedrock-only Gemma sizes in the roster as seatable,
and the router's refusal loop bounded by the providers that serve a call.
The README names the three variables.
Seatable was not unseated until `645c8787b`:
every role derives from `RUN_ROSTER`,
which took the whole roster,
and the first hakureico launch ran the two sizes as judges and translators.
Through the probe flags of `translation-repair-class12` they were then measured alone,
at Bedrock only,
on the eight distinct fidelity questions the three settled artifacts yield:
`google.gemma-4-e2b` chose the complete text on 7 of 8 with one damaged pick,
level with the seated median;
`google.gemma-4-31b` on 4 of 8,
declining the rest as the seated `gemma-4-26b-a4b-it` did on the same questions.
The wide-seat rule is pre-registered in the planning log;
no seat moves until the probe has run over the fourth artifact.
Where the two seats both Hyper and Bedrock serve go is Hyper's first:
when Synthetic dried at 21:24 the pass sent `gemma-4-26b-a4b-it` and `gpt-oss-120b` to Hyper
and Bedrock had answered nothing by 21:35.

## The thirteenth class

Found by the third hakureico pass of 2026-09-07 at the first phase boundary after a named hold.
Hyper's daily limit answered 429 naming its return in 538 s at 21:57;
the twelfth class ended the ladder at once and held Hyper out for exactly that.
Bedrock stayed wet,
so nothing waited:
the translate lane started at 21:58 with every Hyper-only writer refused in the same millisecond
(the footnote passage the archive lacks stayed unfilled),
the lane contest and consolidation at 22:00 ran on the two Bedrock seats,
and every consolidation round read `quorum-not-met` at 0 ms,
five and a half minutes before Hyper came back.
Landed in `752bf9a9b`:
`readJudgeSeats` names the benches each phase leans on,
counts the seats a wet provider would serve against each bench's quorum,
and when a bench is short and a provider has named its return,
waits out the shortest running hold once and reads again;
the lanes driver re-seats the translate lane when it is about to start.
Per phase rather than per call,
since a call's deadline is shorter than a daily-limit hold.
Per chunk as well since `e17d0c487`,
after the fourth pass met the hold two minutes into consolidation and stopped INCOMPLETE:
each driver awaits `beforeSlice` before a chunk,
which costs one synchronous read of the holds while nothing is held.

## The fourteenth class

Found by the fifth hakureico pass of 2026-09-07 in its first second.
OpenRouter's balance stood at 0.01 USD,
which the meter reads as wet;
every call answered 402 naming what it could afford;
the budget layer held it out for the 60 s rate-limit backoff and walked back into the same wall each minute,
and the thirteenth class's wait,
choosing the shortest hold,
chose that one over Hyper's.
Landed in `c9cd537e6`:
a 402 marks the provider with the meter level it read and it reads dry while that level stands,
with no timed hold,
so the seat wait targets a hold whose end brings a bench back.
A top-up moves the meter and clears the mark on the next reading.
Seen in production on the sixth hakureico pass at 00:36:13 UTC on 2026-09-08:
Hyper's balance reached 0 and OpenRouter answered 402 on the same seven concurrent calls,
fourteen marks in one instant,
neither provider asked again,
and the pass finished its consolidation on Bedrock's seats.

## The two defaults and the rule

-   The corpus pass ran at overlap 1 by default while every page that shipped ran at 4 through a dial.
    The four matched pairs of 2026-08-27 and 2026-08-28 had already measured the effect
    (normalized wall down 0.09 to 0.27 against a 0.03 band,
    voices never worse);
    the 2026-09-01 hold had frozen the reading before it became a default.
    Moved to 4.
-   The writer rounds ran at 180000 ms through a dial while the built-in round window was 120000 ms.
    The straggler-grace record had reserved the question for the owner;
    asked with the four shipped logs' cut counts
    (writer-round cuts 4,
    6,
    11 and 20 against 28,
    35,
    26 and 135 reader-round cuts),
    the owner chose to build it in.
-   The owner's rule:
    ALWAYS KILL AND RELAUNCH.
    When source changes while a pass is running,
    kill the pass by pid,
    build,
    and relaunch the same entry into a fresh runs dir on the new build;
    a page finished on a superseded build is not readiness evidence;
    a known fix lands before the launch.
    The 19:53 launch was killed under it after 264 calls.
    The rule is deliberately not in the root `AGENTS.md`.

## How a pass is launched now

The plain invocation in
[`translation-repair-corpus-pass.md`](../runbook/translation-repair-corpus-pass.md) is the production launch:
a fresh `TRANSLATION_REPAIR_RUNS_DIR`,
no dial,
whichever provider keys are present (four since 2026-09-07;
any number dry or absent is normal operation,
the owner's words).
The log opens with `OVERLAP <entry> value=4 source=fallback` and `WRITER GRACE built in`.
Every dial still works for a measured arm.
The seven reading steps are in the 2026-09-04 snapshot and are unchanged.

## What to do next

1.  The `hakureico` page from the 23:38 launch on `49aca5770` settled at 00:38 UTC on 2026-09-08
    (60.2 minutes,
    runs dir `~/temp/agent/hakureico6-20260907`,
    log beside it)
    and is read in the planning log under "The sixth pass settles":
    both footnotes and both definitions on the page,
    six `JUDGE SEATS` lines all `waited=0ms`,
    no `short of quorum` or `chunk resumes` line,
    Bedrock 199.34 to 198.99 USD against 511 `SPEND` lines summing 0.40 USD,
    Hyper 277 to 0 at 00:36:13,
    every read-page check held,
    no class found.
    What the page still owes is a consolidation by a whole bench:
    from slice 3 of 18 the pass ran on Bedrock's seats under `quorum-not-met`,
    which the settlement records as evidence.
    When a meter besides Bedrock's moves,
    relaunch `hakureico` into a fresh runs dir and read that consolidation first.
    A seventh launch on Bedrock alone at 01:49 UTC
    (the owner's words:
    one wet provider is normal operation)
    stopped INCOMPLETE at the pictures in 20 seconds at no cost,
    read in the planning log under "The seventh hakureico launch on Bedrock alone":
    no reader on the readers bench is served by Bedrock,
    Bedrock's cards carry `readsImages: false` until a transcription is measured,
    and the `phase=pictures` seats line printed `readers=4 roster=10 withheld=none` with three providers dry,
    saying nothing about reach.
    Two pieces of work follow,
    neither a design decision:
    the seats line names the reachable seats of a short bench with or without a hold,
    and Gemma 4 on Bedrock is measured as a picture reader.
2.  Run `producer-calibrate` with `--candidates google.gemma-4-e2b` for the translator seat when the meters allow;
    the judge seat is decided (`b0b48d6f4`).
3.  Then `yuki418330012` (a math pair),
    then `Arita`,
    then the seven components no read page has met.
4.  Synthetic's week is at 0 percent as of 21:24 UTC and stays dry until the week turns,
    while its five-hour window refills on its own
    (2750 of 2750 at the sixth pass's tally,
    wet at one reading of six);
    Hyper's daily quota is unpublished and closed once today after about a thousand requests of one pass,
    and a pass that meets it holds Hyper out until the instant the refusal names.
    At 00:38 UTC on 2026-09-08:
    OpenRouter 0.01 USD,
    Bedrock 198.99 USD,
    Hyper 0 since 00:36 and never to be recharged (the owner's words).
    Bedrock is the one wet provider and the only one whose meter moves without the owner.

## Standing constraints

Unchanged from the 2026-09-04 snapshot:
never echo an API key value or read `/proc/<pid>/environ`;
never set `thinking`,
`budget_tokens` or `reasoning_effort`;
never write `Closes #N`;
spent Candidate A through M prompts are never redispatched;
credentials,
API keys,
image bytes and raw provider requests and responses stay private,
and the owner has relaxed everything else until the project is finished.
