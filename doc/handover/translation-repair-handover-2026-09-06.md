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
That is the tenth class and a design question the owner decides;
the options and a ranking are in the planning log under "The Huasheng relaunch stops at slice 21".
No run is in flight and none is launched until the owner answers and a provider week refills.
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
  `ed7f82de9` for the code;
  the documents move after it.
- Corpus pinned at `a41fc607ea5a70d8a7625cc67d5ed8c444f53379` in `~/one-among-us/data`.
- Meters at 02:56 UTC on 2026-09-07:
  `synthetic=wet hyper=wet openrouter=wet syntheticWeekly=6.64%`,
  Hyper 2273 credits,
  OpenRouter 0.32 USD.
  The Synthetic week is nearly spent;
  when it runs dry Hyper serves alone,
  which the owner has said is normal.
  Each settled `yulianNyanner` pass today cost 3.9 to 4.6 points of the Synthetic week and 60 to 82 Hyper
  credits at zero USD.
  One stopped 28-minute attempt cost about 0.8 percent of the Synthetic week and 36 Hyper credits;
  no call reached OpenRouter,
  since routing spends Synthetic and Hyper first.

## What landed today

Newest first.

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
all three provider keys present.
The log opens with `OVERLAP <entry> value=4 source=fallback` and `WRITER GRACE built in`.
Every dial still works for a measured arm.
The seven reading steps are in the 2026-09-04 snapshot and are unchanged.

## What to do next

1.  Put the block-floor question to the owner
    (planning log,
    "The Huasheng relaunch stops at slice 21";
    ranking A over C over B over D),
    land the answer guard-first,
    and run `Huasheng` again once Synthetic refills or OpenRouter is charged.
    The order is the census's,
    recorded in the planning log under "The run order after TLL1122",
    and open to veto.
2.  Then a math pair (`yuki418330012`) or a second footnote entry (`hakureico`),
    then `Arita`,
    then the seven components no read page has met.
4.  The OpenRouter top-up is the owner's and expected within days;
    nothing waits on it while Synthetic and Hyper are wet.
    One settled entry costs about 3.9 points of the Synthetic week and 64 Hyper credits at zero USD.

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
