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

As of 20:20 UTC on 2026-09-08 the tree is `ba7ce85a9`,
docs on the code of `bb04656ef`:
the front-matter rule merged (`d11f36799`),
`google.gemma-4-e2b` seated as translator and consolidation writer on the day's producer calibration (`169a86173`),
the seventeenth class fixed (`8bf9deec0`,
a JSON object read past an abandoned opening),
the eighteenth class fixed (`bb04656ef`,
an error finish on a whole stream read as the provider failure it is),
the twelfth `hakureico` page settled on that build at 20:10 UTC and read
(front matter byte for byte the archive's,
eight false starts kept,
no error finish occurred,
`verify-published` matched at length;
see "The twelfth page and the letter"),
one design question open (the letter,
same section),
and `yuki418330012` running on that build into `~/temp/agent/yuki418330012-20260908` since 20:18 UTC;
see "What to do next".
The paragraphs that follow are the state of 2026-09-07 and stand as history.

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

The full unit suite emitted 957 `PASS` lines and zero `FAIL` lines on `bb04656ef`,
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
  `bb04656ef` for the code;
  the documents move after it.
- Corpus pinned at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` in `~/one-among-us/data`.
- Meters at 18:21 UTC on 2026-09-08,
  off the eleventh pass's last seat line:
  `synthetic=dry bedrock=wet hyper=dry openrouter=wet withheld=hf:moonshotai/Kimi-K3`;
  Synthetic's rolling week returned at 16:27 (nine minutes into the tenth pass),
  served the eleventh's preparation,
  pictures and the first lanes,
  and ran dry again at 17:21 inside its lanes phase
  (held out 300 s a time,
  every refused call routed onward),
  Hyper at zero credits and never to be recharged,
  Bedrock and OpenRouter in USD (198.39 and 199.56 at 12:52 UTC;
  the tenth pass spent 0.09 and 0.57 in 37 minutes,
  the calibration before it unmeasured).
  The tally at the end of the pass prints the meters.

## What landed today

Newest first.

-   `bb04656ef` (2026-09-08,
    18:21 UTC):
    the eighteenth class,
    a whole stream whose choice stopped on `finish_reason: "error"` with no error object beside it and a
    `[DONE]` terminator,
    read as the provider failure it is
    (`openrouter-error-finish.ts`,
    asked by `openrouter-stream-error.ts`),
    found by the eleventh hakureico pass on deepseek-v4-pro-0813 through CoreWeave and read back through
    four logs since 2026-09-03;
    guard shown to fail first;
    957 `PASS` and 0 `FAIL`.

-   `8bf9deec0` (2026-09-08,
    16:54 UTC):
    the seventeenth class,
    a JSON object read past an abandoned opening fragment
    (`json-false-start.ts`,
    the reply ladder),
    found by the tenth hakureico pass on reasoning streams from OpenRouter's Makora route and read back through the ninth on Bedrock's gpt-oss-120b;
    guard shown to fail first;
    956 `PASS` and 0 `FAIL`.

-   `169a86173` (2026-09-08,
    16:15 UTC):
    `google.gemma-4-e2b` seated as translator and consolidation writer on the 40-round producer calibration
    (30 of 298 disinterested ballots,
    z -1.40 against the 12.8 percent pooled null,
    94 of 94 asks usable);
    `RUN_WRITERS` filtered off `RUN_ROSTER`;
    the class-fifteen fixtures moved to the editors bench,
    since Bedrock alone now reaches a pair of translators;
    guard shown to fail first;
    954 `PASS` and 0 `FAIL`.

-   `d11f36799` (2026-09-08,
    16:08 UTC):
    the front-matter branch rebased onto `ab0e9f0e9` and fast-forwarded in,
    the throwaway worktree and both branches removed;
    954 `PASS` and 0 `FAIL` in the throwaway and again in the main worktree.

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
-   `c4a9682fe` (2026-09-08):
    every phase reading computes the shortfall clauses,
    and warns `JUDGE SEATS phase=<p> short of quorum: <bench> N of M reachable, quorum Q;`
    `no provider has named its return, so the phase runs on what is reachable`
    when nothing is held;
    the seventh hakureico launch had printed `readers=4 withheld=none` with no reader reachable.
    Guards neutralised 2 and 3 `FAIL`,
    restored 0.
-   `f7f9c9136` (2026-09-08):
    `google.gemma-4-26b-a4b` and `google.gemma-4-31b` read pictures through Bedrock
    (`readsImages: true` on their cards),
    by the reader-seat rule written in the planning log under
    "The three Gemma sizes against the seated readers on nine pictures":
    eight readings each,
    every one corroborated by every seated reader;
    E2B stays off the readers (two readings no seated reader corroborated).
    The readers bench is six and a Bedrock-only pass has two reachable readers.
    The readers' quorum in the shortfall reading is a pair,
    since `readImagePair` corroborates from two readings.
    Every cached picture reading is re-read once,
    since the cache key names the reader roster.

-   `d74ef4a43`,
    `977c242c1` (2026-09-08):
    the fifteenth class,
    the writing-bench floor;
    guards neutralised 2,
    2,
    2 and 3 `FAIL`,
    restored 0;
    954 `PASS` and 0 `FAIL` on the merged build.
-   `1ddbcc75a`,
    `aa133492d` and the commit carrying this line:
    the floor decision,
    the ninth hakureico launch and its reading,
    the readiness signal and this handover.

-   `20e5135a6` (2026-09-08,
    on the throwaway branch `translation-repair-front-matter`,
    merged as `d11f36799` after the E2B calibration):
    the front-matter rule,
    artifact generation eleven;
    guards neutralised 13,
    6 and 9 `FAIL` across the suites,
    restored 0;
    954 `PASS` and 0 `FAIL` (the 955 first written here was a miscount of the same set).

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

## The fifteenth class

Found by the eighth hakureico pass on Bedrock alone at 02:24 UTC on 2026-09-08:
a page with five slices by one translator and three judges,
zero repairs and no footnote,
shipped `SETTLED` for 0.22 USD,
with nothing but the findings to tell it from the sixth pass's whole-bench page.
The owner chose "Stop INCOMPLETE" (`doc/decision/translation-repair-writing-bench-floor.md`).
Built in a throwaway worktree while the ninth pass ran and merged after its tally,
`d74ef4a43` and `977c242c1`:
`run-seats-floor.ts` holds the editors,
refiners and translators to a reachable pair,
every phase reading throws `WritingBenchUnreachableError` when a writing bench is below it with no hold to wait for,
and the entry queue records the entry INCOMPLETE.
Under a hold the reading waits once and reads again.
A bench lost inside a phase with no hold still finishes the phase,
recorded as unsettled in the decision.
The ninth pass,
on four providers,
lost Synthetic and Hyper inside its consolidation and finished on Bedrock and OpenRouter,
which reach every bench.

## The front-matter rule

The sixteenth thing found,
by the ninth hakureico pass on 2026-09-08:
slice zero shipped `name: Kagurazaka Chika` while the body kept the archive's `Hanasaka`,
each by a rule doing what it says.
The owner's answer:
"We're not supposed to change front matter though?",
and then option 1 of three,
"publish the archive's front matter as is;
render it only where the archive never translated it"
(`doc/decision/translation-repair-front-matter-guard.md`,
addendum 2026-09-08).
The measurement behind it:
9 of the last 10 read pages had rewritten `desc`,
`alias` or `name` and no reading had diffed the front matter.
Built as `20e5135a6` on branch `translation-repair-front-matter` in a throwaway worktree
while the E2B calibration ran on the main worktree's build,
and merged as `d11f36799` at 16:08 UTC once its standing printed:
`archive-front-matter.ts` decides whether the archive stands,
the preparation makes no slice zero where it does,
the guard refuses `archive-front-matter` for any other page,
and artifact generation eleven records it.
All 92 pinned archives stand,
so no page changes its front matter from here.
The read-page check to add to every reading:
the page's front matter equals the archive's byte for byte
(`read-page.mjs` prints `frontMatterEqualsArchive`).

## The E2B translator seat

Measured by `producer-calibrate 40 --candidates google.gemma-4-e2b` on 2026-09-08
(13:07 to 16:07 UTC,
log `~/temp/agent/producer-calibrate-e2b-20260908.log`),
every one of the ten models writing and judging every slice.
E2B:
10.1 percent (30 of 298 disinterested ballots,
over 39 candidates),
z -1.40 against the pooled null of 12.8 percent,
threshold 2.81 for ten comparisons,
94 of 94 asks usable,
streams p50 1.6 s and p90 2.5 s.
Not separated from the null,
so by the 2026-09-01 rule it takes the translator seat and the consolidation seat (`169a86173`):
translators eight (quorum 4),
consolidation writers ten,
`WRITER_UNMEASURED` empty.
Standing verbatim,
z table,
`SEAT` lines and the warnings:
the planning log,
"The E2B calibration prints its standing";
the decision:
the seating decision's addendum of 2026-09-08.
What it changes for a Bedrock-only pass:
the translators bench reaches a pair
(`gemma-4-26b-a4b-it` and E2B),
the class-fifteen floor,
while editors and refiners stay at zero,
so such a pass still stops at the lanes.
Not acted on:
gpt-oss-120b below the null again (z -2.90),
the two deepseeks at -2.31 and -2.36.

## The seventeenth class

Found by the tenth hakureico pass on 2026-09-08 (16:37 to 16:49 UTC):
five deepseek-v4-flash-0731 voices lost to `schema-mismatch` whose raw opening was written twice,
`{"best": 1{"best": 1, "reason": ...}` and `{"{"best": ...}`,
every one a reasoning stream from OpenRouter's Makora endpoint.
Read back through the ninth pass:
six of its eight mismatches were gpt-oss-120b through Bedrock with the same shape
(`{ {   "choice`,
`{"{"resolution`),
every one with reasoning characters;
the sixth pass,
with no reasoning streams,
had none.
The fragment's whitespace differs from the object's,
so it is the model writing twice,
not a client appending a retry.
Fixed as `8bf9deec0`:
`json-false-start.ts` tries each brace inside the first 256 characters as the object's start until one parses to the end,
the reply ladder (`chat-json-outcome.ts`) parses the whole first and reads past only when the whole fails,
warns `json false start: read the object past an abandoned opening of N chars`,
and the caller's guard still judges what was read.
The read-page check to add:
every `json false start` line in a pass log is a voice kept;
a `schema-mismatch` whose raw opens `{` twice would mean the window or the shape has moved.

## The eighteenth class

Found by the eleventh hakureico pass on 2026-09-08 (18:08:45 UTC,
the lane contest):
deepseek-v4-pro-0813 through OpenRouter,
served by CoreWeave,
completed after 24 s with 8284 reasoning characters,
no content,
`finish_reason=error` and a cost of 0,
and the reply ladder reported
`schema-mismatch (content is not valid JSON: Unexpected end of JSON input (model stopped with finish_reason=error)) raw="", voice lost`.
Read back through the logs since 2026-09-03:
seven such replies across four passes,
every one through OpenRouter (GLM-5.3-Flash four times on Together,
gpt-oss-120b on Together,
deepseek-v4-pro-0813 on CoreWeave),
every one with no content,
every one a lost voice.
OpenRouter normalizes every upstream's stop reason to `stop`,
`length`,
`tool_calls`,
`content_filter` or `error` (its API reference,
read the same day);
the mid-stream failure it documents writes a top-level `error` object beside the error finish and closes
without `[DONE]`,
which `openrouter-stream-error.ts` had read since 2026-09-04.
These seven carried no error object and did send `[DONE]`,
so both checks passed and the empty reply reached the ladder as the model's answer.
Fixed as `bb04656ef`:
`openrouter-error-finish.ts` reads a choice whose `finish_reason` is `error`
(its `native_finish_reason` as the kind when the gateway forwarded one,
`error-finish` otherwise),
`openRouterStreamErrorOf` asks it when no chunk carried an error object,
and `requireNoStreamError` throws the same `InStreamProviderError`,
so the call rides the retry ladder under its own name
(`stream carried a provider failure instead of a completion: code unnamed, type <kind>, served by <endpoint>`)
instead of losing the voice on the first try.
The read-page check to add:
a `schema-mismatch` line naming `finish_reason=error` would mean the shape has moved;
an `InStreamProviderError` line with `code unnamed` is this class caught.

## The twelfth page and the letter

The twelfth `hakureico` pass (`bb04656ef`,
18:21 to 20:10 UTC on 2026-09-08,
108.4 minutes,
`~/temp/agent/hakureico12-20260908`) settled on Bedrock and OpenRouter with Synthetic's week returning at 19:48.
Its page passed the three checks it was launched for:
the front matter is the archive's seven lines byte for byte
(artifact `artifactSchemaVersion: 11`,
`frontMatterAuthority: "archive"`),
E2B cast 18 ballots and won once across the translate stages,
eight `json false start` reads kept their voices,
and no reply carried `finish_reason=error`
(none occurred and no retry ran,
so the eighteenth class's guard stands on its suite,
not on this pass).
`verify-published` matched 1 of 1 at length,
destinations 0 and 0,
quotes and ellipses on the archive's conventions,
the blank line after the front matter back,
the three-blank-line seam gone.
81 voices were lost at the straggler window against the ninth's 38,
on five readers and nine seats against six and ten,
quorum held in every round;
no seat moved.
The full reading is in the planning log under
"The twelfth pass settles in 108 minutes under the three checks and rewrites the letter".

What the prose read found is a design question.
The archive page carries a translator note above Hanasaka's letter:
`这段话以下全部，包括结尾的两句祝愿，原文都是英文，中文是反向翻译的，请仅修可能造成误解或明显的非刻意语法错误，不大修`
(everything from here,
the two closing wishes included,
was written in English;
the Chinese is a back-translation;
fix only what misleads or is plainly unintended grammar;
no heavy revision).
The note ships on the page and reaches the slices,
and the page still rewrote the English original in five places
(`I am never gone` to `I am never really gone`,
`see this` to `see this little poem`,
`And who’s by your side w` to `And no matter who’s by your side w`,
`I will always be with you` moved to the back-translation's position,
and the archive's two closing wishes replaced by one sentence rendered from the source,
which carries only the second).
The two short quotes under the page's other note (`本文的大部分引用原文都是英文`) ship verbatim.
Nothing in the pipeline makes the archive the authority for a span whose note says the archive is the original.
That is the front-matter rule's shape,
decided by the owner on 2026-09-08 (the archive translated it,
so it ships as it stands),
applied to a span.
Measured across the pinned corpus:
22 of the 93 archive pages carry a translator note,
2 of them one saying the English is the original:
this page's,
and `cheonwoomaeng`,
whose note says the whole page is the author's own English and must not be touched in translation.

The options,
each with what it buys and costs.
Span authority from the note:
where an archive note says the English is the original,
the archive's text from the note to the next heading (or the whole page,
where the note says so) ships as it stands,
as the front matter does,
touched by no lane;
it follows the decision already made,
removes the span from the models' reach,
and costs recognizing the note (a free-text Chinese comment,
two wordings in the corpus) and its extent,
and ships any real grammar slip the note would have allowed fixing.
Copy-edit lane:
the same recognition,
but the span goes to the writers as an English original with a copy-edit brief and is judged against the
archive's text under a change budget;
it keeps the note's own allowance and costs a new lane,
a new judge and a budget that is a magic number.
Leave it:
the models see the note and the twelfth's five changes are all defensible English;
it costs nothing to build and ships a dead person's own words reworded.
Ranking:
span authority,
then leave it,
then the copy-edit lane.
Span authority over leaving it because the letter is a quotation of the subject's own English and the owner has
already ruled that the archive is the authority where it is the original;
leaving it over the copy-edit lane because the lane builds a judge around a magic number for a problem the first
option dissolves.
Nothing is landed;
the owner decides.

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

1.  `yuki418330012`,
    a math pair,
    is running on `bb04656ef` (tree `ba7ce85a9` with docs only above it),
    launched 20:18 UTC on 2026-09-08,
    runs dir `~/temp/agent/yuki418330012-20260908`,
    log beside it,
    pid 393298,
    on Synthetic,
    Bedrock and OpenRouter
    (`JUDGE SEATS phase=preparation synthetic=wet bedrock=wet hyper=dry openrouter=wet wide=8 select=8 late=9
    slate=9 checkers=3 translators=8 readers=6 writers=10 roster=10 withheld=none waited=0ms`,
    `FRONT MATTER entry=yuki418330012 authority=archive`).
    Read it by the seven steps plus the three checks
    (front matter byte for byte the archive's,
    artifact `artifactSchemaVersion: 11` with `frontMatterAuthority: 'archive'`,
    E2B's candidates and ballots in the translate lane,
    every `json false start` a voice kept,
    no `schema-mismatch` naming `finish_reason=error`;
    an `InStreamProviderError` with `code unnamed` is the eighteenth class caught),
    and read its letter-shaped spans,
    if any,
    against their notes.
    The twelfth `hakureico` page (`bb04656ef`,
    18:21 to 20:10 UTC,
    108.4 minutes,
    `~/temp/agent/hakureico12-20260908`) is read in the planning log under
    "The twelfth pass settles in 108 minutes under the three checks and rewrites the letter":
    the three checks passed,
    `verify-published` matched at length,
    no error finish occurred (the guard stands on its suite),
    81 voices lost at the straggler window against the ninth's 38 on a bench one reader and one seat shorter with
    quorum held in every round,
    and the letter rewritten under a note that says it is the English original (the design question).
    If the tree moves past `bb04656ef` while `yuki418330012` runs,
    the kill-and-relaunch rule applies.
2.  The translator seat is decided (`169a86173`,
    see "The E2B translator seat");
    no calibration is owed.
3.  The letter is the open design question (see "The twelfth page and the letter");
    the owner's answer decides whether a span the archive's note calls the English original ships as the archive
    has it.
    Nothing to build until then.
4.  Then `Arita`,
    then the seven components no read page has met.
4.  Synthetic's weekly meter is a ROLLING WINDOW,
    not a calendar week (measured 2026-09-08:
    0 percent at 12:26 UTC after the ninth pass spent its 5.8 percent,
    2 percent at 13:07 with no top-up,
    then falling again as the calibration spent it),
    so it returns on its own as the oldest usage ages out and reads dry only while it stands at zero,
    while its five-hour window refills on its own
    (2750 of 2750 at the sixth pass's tally,
    wet at one reading of six);
    Hyper's daily quota is unpublished and closed once today after about a thousand requests of one pass,
    and a pass that meets it holds Hyper out until the instant the refusal names.
    At 20:10 UTC on 2026-09-08:
    OpenRouter 177.62 USD (topped up to 200.01 at 11:26;
    the twelfth hakureico pass spent 7.97),
    Bedrock 197.37 USD (0.48 on that pass),
    Synthetic's rolling week at 1.23 percent (returned 19:48),
    Hyper 0 since 12:45 and never to be recharged (the owner's words).
    Bedrock and OpenRouter are the two wet providers and together reach every bench at every phase,
    measured on the merged build;
    OpenRouter is the one whose spend is per token.

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
