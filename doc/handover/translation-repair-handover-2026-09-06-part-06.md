# Translation repair handover snapshot: 2026-09-06, part 06

Part 06 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## What landed today, continued

-   `40aba2fdb` (20:45 UTC):
    every stage gather sizes its quorum on the reachable bench with a two-voice floor and never re-asks a
    seat the router refused (`stage-reachable-quorum.ts`,
    the `stage-short-bench` finding);
    class twenty-six.
-   `a5e0efc7f` (20:30 UTC):
    `deepseek-v4-pro-0813` leaves the translator seat on its second calibration below the pooled null,
    keeping every judge seat (`TRANSLATOR_DROPPED`,
    now exported so the seat test's count follows it).
-   `028432713` (20:20 UTC):
    `inception/mercury-2.5` takes the translator and consolidation seats on its calibration
    (`WRITER_UNMEASURED` empty again),
    and its completion cap drops to the pooled 90th from its own 136 calls.
-   `19b6043a3` (18:15 UTC):
    the reach honours the Kimi-K3 OpenRouter withholding
    (`OPENROUTER_WITHHELD` in the catalog,
    `reachOf` and the picture reach,
    the seat reader withholding the seat whose only wet provider would have been OpenRouter).
-   `b7a0b4f5f` and `d7d24f483` (18:00 UTC):
    the community glossary (`community-glossary.ts`) in the identity context and the
    `COMMUNITY RENDERINGS` block on the select,
    lane-contest and consolidation-gate sheets;
    `editor-selection-sheet.ts` split out.
-   `1463cd359` (17:55 UTC):
    a valid incumbent stands in for an ineligible consolidation standing,
    the artifact's shipped kind `incumbent` writes it to the page.
-   `db5927630` (17:45 UTC):
    the select minimum scales by reachable over quorum on a bench the router left short,
    two ballots the floor;
    `candidate-select-minimum.ts`,
    `candidate-select-count.ts`,
    the gather's `unreachable` seats.
-   `fcc8ca197` and `3224ff347` (17:00 UTC):
    Mercury 2.5 named as the OpenRouter-only roster id and seated as a judge on 14 of 14.
-   `33a023445` (16:35 UTC):
    the six stages that read their own round windowed with retry rounds (`stage-windowed-rounds.ts`).
-   `78ea8c8c7` (16:20 UTC):
    a measured `max_tokens` on every call of every provider (`completion-cap.ts`).
-   `b71a55385` (16:05 UTC):
    every round asks quorum plus one seat from a bench rotated by the prompt (`stage-fanout-window.ts`).
-   `1fe7ca2fe` (15:40 UTC):
    OpenRouter calls price-sorted across ZDR endpoints,
    `cached=` on the SPEND line.
-   `4f87555fc` (15:20 UTC):
    a reckoned `SPEND ... estimated=abandoned` line for every abandoned OpenRouter stream.
-   `037d1f650` (15:00 UTC):
    every OpenRouter call capped at a measured ceiling,
    Qwen3.8-27B and glm-5.3 off the OpenRouter catalog.
-   `efc9a4f3c` (11:55 UTC):
    the twenty-third class,
    a contested pairing target decided by votes.
-   `7bcea2dc4` (09:50 UTC):
    the twenty-second class,
    an English whole-page note declines the entry.
-   `3620004db`,
    `e945b1b5f` and `dc3946757` (08:00 to 09:00 UTC):
    the twenty-first class's fourth face,
    the assembly guard over the composed page recorded in the artifact (schema 13).
-   `379122379` (06:20 UTC):
    the twenty-first class's third face,
    a definition line its own block in the orphan trim.

The 2026-09-08 commits:

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
    The fourth launch at 22:21 UTC (runs dir `~/temp/agent/hakureico4-20260907`,
    pid 3814733) is on it.
-   `a317f4e03` (2026-09-07,
    21:45 UTC):
    Bedrock sits ahead of Hyper,
    the owner's decision of 21:41 UTC ("Yes Bedrock sit ahead"),
    recorded as the addendum in `doc/decision/translation-repair-openrouter-fallback.md`;
    with it the probe flags `--candidates` and `--candidates-alone` (`8f47f117b`,
    `7de4e7b64`),
    rebased from `translation-repair-class12`.
    The second hakureico pass was killed under the rule at 21:41 UTC and the third launched at 21:47 UTC
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
    relaunched at 21:08 UTC on the fix.
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
    `c421c2e31` and `6b842dcdf` record the 22:10 UTC page and add the apostrophe count to the reading steps.
-   `e5bd6bf0f` inventories `CollapsedHeadingError` for the names-only message check,
    after the full suite on the class-six build showed 2 `FAIL`;
    the 22:06 UTC launch was killed for it under the rule.
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
    on the four matched pairs the overlap-dial work asked for,
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

Found on the 22:10 UTC page,
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

Found on the 23:11 UTC page,
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
when Synthetic dried at 21:24 UTC the pass sent `gemma-4-26b-a4b-it` and `gpt-oss-120b` to Hyper
and Bedrock had answered nothing by 21:35 UTC.

## The thirteenth class

Found by the third hakureico pass of 2026-09-07 at the first phase boundary after a named hold.
Hyper's daily limit answered 429 naming its return in 538 s at 21:57 UTC;
the twelfth class ended the ladder at once and held Hyper out for exactly that.
Bedrock stayed wet,
so nothing waited:
the translate lane started at 21:58 UTC with every Hyper-only writer refused in the same millisecond
(the footnote passage the archive lacks stayed unfilled),
the lane contest and consolidation at 22:00 UTC ran on the two Bedrock seats,
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
