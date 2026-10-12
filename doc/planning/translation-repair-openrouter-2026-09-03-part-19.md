# Translation repair: OpenRouter as the paid fallback provider, part 19

Part 19 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## mikaela14 read, 2026-09-24, 05:15 UTC: class one hundred eleven live at the admission, its chain arm found and built in caac222a6; killed at 05:05 UTC; mikaela15 launched

`mikaela14` (entry `mikaela_khara`,
frozen `0ab0abdd8`,
pid 691210) was launched at 04:53 UTC 2026-09-24 and killed at 05:05 UTC
under always-kill-and-relaunch once the chain arm (`caac222a6`) landed,
12 min in,
in the consolidation at chunk 26 of 34,
no tally,
1,471 calls,
50 retry rounds,
0.57 USD by the meters (Bedrock 47.60 to 47.37,
OpenRouter 94.19 to 93.85),
on Bedrock and OpenRouter alone;
the lanes disagreed on 25 of 34 slices,
class one hundred seven live on slices 13,
14,
18 and 24,
all 15 checker rounds heard 2 of 3,
48 abstention lines.

Class one hundred eleven live at the admission,
and its second arm.
This run's pairing carried two slices in a row,
11 (原本只是…) and 12 (很正常的一件事情),
and paired slice 13 (当晚…) with the archive's "That was originally just a typical thing."
and "That night…" paragraphs together.
The log now reads:
`insertion-carried-folded (slice 12 into slice 13)` (the fold on the first arm),
`slice 11 stays carried: evidence sits in slice at position 13, not a neighbour` (the new warn line),
and `slice 11 carried on 3 region(s): …` (the new evidence line,
the ballots' regions running from the HRT sentences through "That night…").
Slice 11's evidence sat in slice 10's paragraph and in slice 13's span,
and slice 13 was two positions away because the carried slice 12 stood between:
the fold's neighbour rule counted positions,
not paired slices.
The run was doomed to the same publish stop (slice 13's stand-in,
written from 很正常 and 当晚,
carries nothing of slice 11),
so it was killed.

Chain arm (caac222a6,
guard red first 9bb99bf9f with the chained fixture,
replayed over the real corpus texts of slices 10 to 13 with the ballots' regions:
`slice 12 into slice 13`,
`slice 11 into slice 10`,
no aside):
a carried passage's neighbours are the nearest paired slices on each side,
looking past insertions (`pairedNeighbours` in `corpus-run/insertion-carried-decide.ts`);
the abutting check still refuses a fold across a source the carrier has not absorbed;
and the passes repeat,
at most one per carried passage,
so a passage refused for a carried neighbour in the way folds once that neighbour has folded (`foldPass` in `corpus-run/insertion-carried-fold.ts`).
Lint 0/0,
types clean,
the fold suite green,
full suite `suite-class111b.log`.
Frozen `.frozen-dist-caac222a6`.

`mikaela15` launched on it.

## mikaela13 read, 2026-09-24, 04:50 UTC: INCOMPLETE carried-evidence-lost in 15 min again, class one hundred eleven (the carried passage rendered across both neighbours), fixed in 0ab0abdd8; mikaela14 launched

`mikaela13` (entry `mikaela_khara`,
frozen `457765221`,
pid 344865) stopped INCOMPLETE at 04:33 UTC 2026-09-24,
15 min after its 04:18 UTC start (TALLY `ms=903894`,
`error=translation repair interrupted: carried-evidence-lost`),
one attempt,
2,093 seats,
63 retry rounds,
1,678 calls,
0.75 USD by the meters (Bedrock 47.86 to 47.60,
OpenRouter 94.68 to 94.19),
on Bedrock and OpenRouter alone (Synthetic dry for the week,
Hyper dry),
roster 8 (`wide=6 select=7 late=7 slate=7 checkers=3 translators=7 readers=5 writers=8`).
Stages:
admission at 04:19:34 UTC,
repair lane from 04:19:34 UTC,
translate lane to 04:25 UTC,
contest 24 of 34 slices differ,
consolidation from 04:28 to 04:33 UTC;
Jev 68 of 68;
56 abstention lines with reasons;
all 16 checker rounds heard 2 of 3,
no hold inside the lane (class one hundred nine not exercised).
Class one hundred seven live on five slices (2,
10,
12,
22,
24).
No page,
no artifact:
the entry stopped at the publish guard,
`INTERRUPTED mikaela_khara: carried-insertion-evidence-lost slice 11`.

Class one hundred ten was not exercised in mikaela12's shape.
This run's pairing (12 of 12 original and 9 of 9 translation blocks in the section,
against mikaela12's) carried slice 11 alone,
the fold printed nothing,
and the same guard stopped the entry on a different passage.

Class one hundred eleven,
the stop.
The original writes three paragraphs:
"8 月下旬的某天，Mika 炸柜了。" (slice 10,
18 code points),
"原本只是非常正常的一件事情：家庭矛盾，家长不想让孩子 HRT，然后 Mika 离家出走结果被报警抓回来，最后在派出所协商调解矛盾。" (slice 11),
"很正常的一件事情。" (slice 12).
The archive renders them as two:
"In late August,
she tried coming out but ended up facing serious opposition.
What started as a typical situation—family conflict,
her parents not wanting her to undergo hormone replacement therapy (HRT).
So Mika ran away from home only to be brought back by the police—ended in conflict resolution at the local police station."
and "That was originally just a typical thing."
The pairing gave the first paragraph to slice 10 and the second to slice 12,
so slice 11 was source-only and the coverage round found it carried:
its one ballot quoted the HRT sentences out of slice 10's span and the "originally just a typical thing" line out of slice 12's,
one region across both neighbours (the archive's second paragraph renders 原本只是 from slice 11 and 很正常的一件事情 from slice 12 in one line).
The class one hundred ten fold asked for a single holder of the whole region,
found two,
and stood aside without a word in the log.
Then class one hundred seven disputed both neighbours:
slice 10's archive paragraph against its 18-code-point source ("keeping the archive text,
326 code points against a source of 18" on the translate lane;
the repair lane's text stood in),
slice 12's line for adding "originally" and "just" (two critics,
"importing the nearby context's 原本只是非常正常的一件事情 framing"),
and the stand-ins,
written from each slice's own source,
carried nothing of slice 11.
The guard at publish was right again.

Fix (0ab0abdd8,
guard red first 2925802e1 with the flanked fixture,
replayed over the real corpus texts of slices 10 to 12 with the ballot's region:
`insertion-carried-folded (slice 11 into slice 10)`,
the carrier's source both paragraphs,
slice 12's source untouched):
the fold places the evidence block by block (`corpus-run/insertion-carried-anchor.ts`,
`anchorRegion`:
one holder per block the quote touches,
with its share in code points);
every block must sit in a paired slice next to the carried one,
the carrier is the neighbour holding the larger share (the earlier on a tie),
and the sources must abut across blank space alone (`corpus-run/insertion-carried-decide.ts`,
`decideFold`,
split out for the line budget).
The other neighbour keeps its own source:
the words of the passage it rendered are the carrier's to write now,
and its class one hundred seven dispute over "originally" is answered by the carrier rendering 原本只是.
Every stand-aside names its reason (`foldCarriedInsertions` returns `asides`),
and `pass-entry.ts` logs them at warn beside one line per still-carried passage with its evidence regions,
so the next carried-evidence-lost stop can be read against the admission without the artifact.
Lint 0/0,
types clean,
the fold suite green,
full suite `suite-class111.log`.
Frozen `.frozen-dist-0ab0abdd8`.

`mikaela14` launched on it (the rest of the read set follows).

## mikaela12 read, 2026-09-24, 04:20 UTC: INCOMPLETE carried-evidence-lost in 15 min, class one hundred ten (a carried passage inside the neighbour's archive span), fixed in 457765221; mikaela13 launched

`mikaela12` (entry `mikaela_khara`,
frozen `21ea25993`,
pid 125750) stopped INCOMPLETE at 03:54 UTC 2026-09-24,
15 min after its 03:38 UTC start (TALLY `ms=905150`,
`error=translation repair interrupted: carried-evidence-lost`),
one attempt,
2,196 seats,
78 retry rounds,
1,744 calls,
0.71 USD by the meters (Bedrock 48.13 to 47.86,
OpenRouter 95.13 to 94.69),
on Bedrock and OpenRouter alone (Synthetic dry for the week,
Hyper dry).
Stages:
repair lane from 03:39:31 UTC,
translate lane from 03:42:38 UTC,
contest from 03:44:28 UTC (27 of 36 slices differ),
consolidation 03:45:17 to 03:54 UTC;
Jev 78 of 78;
49 abstention lines with reasons.
No page,
no artifact:
the entry stopped at the publish guard.

Class one hundred nine not exercised,
as expected:
no hold began inside the repair lane (every JUDGE SEATS line reads `synthetic=dry bedrock=wet hyper=dry openrouter=wet`),
no "checker stage re-seated" line;
all 16 checker rounds heard 2 of 3 (gemma-26b and the dry reading's gemma-4-e2b for the withheld Kimi) with no grace.
Class one hundred seven live on five slices (2,
15,
19,
20,
26:
`translate-archive-disputed`,
the repair lane's text standing in for the archive in the lanes and the consolidation).
The filers log live.

Class one hundred ten,
the stop.
The coverage admission found slices 12 and 14 `coverage=carried, missingDestinations=0`:
source-only paragraphs the roster said the page already renders.
Slice 14's evidence,
quoted by every voice,
was the September sentence
("By September,
I started noticing cracks in their relationship due to their financial strain and Mika’s dependency on Spring."),
which sits inside slice 15's archive span:
the archive merged two source paragraphs (the September paragraph and its neighbour) into one rendering,
and the pairing paired that rendering with the neighbour's source alone,
leaving slice 14 source-only.
The translate lane,
writing slice 15 from its own source alone,
wrote the neighbour without the September sentence;
the translate slate chose the candidate without "the surrounding passage" (the judges' words);
the contest chose translate;
the consolidation gate kept it;
and at publish `assertCarriedInsertionsRemain` (class twenty) found the carried region gone and stopped the entry
(`INTERRUPTED mikaela_khara: carried-insertion-evidence-lost slice 14`).
The guard was right and the lanes were blind:
nothing told the writer of slice 15 that its archive span also renders slice 14's source.

Fix (457765221,
guard red first 750e87978 with "does not provide an export named 'CARRIED_FOLDED_FINDING'"):
`foldCarriedInsertions` (`corpus-run/insertion-carried-fold.ts`) runs right after `decidePassInsertionAdmission` in `pass-entry.ts`.
Where every evidence region of a carried insertion locates (through `locateQuote`) inside exactly one paired slice's target span,
that slice stands one position away,
the carried slice is the insertion the admission names,
and the two sources abut with nothing but whitespace between them,
the carrier's source widens over both sources (`widenCarrier`),
the carried slice leaves the carried list as `folded` (`FoldedInsertion` on `InsertionAdmission`),
and the finding `insertion-carried-folded (slice 14 into slice 15)` prints.
Both lanes then write the carrier from the widened source,
so the September sentence is owed by the rule,
not remembered by the guard;
`translateDocument` skips folded positions as it skips carried ones;
the publish guard reads only what stays carried.
Only the unambiguous case folds:
evidence in a non-adjacent slice,
evidence the page never carried,
evidence straddling two slices,
or a source gap that is not blank all stand aside and the insertion stays carried as before.
Two unit cases (`insertion-carried-fold.unit.test.ts`,
cat-themed):
FOLDS and STANDS ASIDE.
Lint 0/0 on the touched files,
types clean,
`mise run build`,
the guard PASS,
full suite `suite-class110.log` 1114 PASS
with one load-sensitive failure (`lane-contest-stage` "RECORDS RAW HALF-QUORUM BALLOTS",
a grace-window timing case:
expected 2 usable,
saw 4 under the parallel run;
PASS alone;
`suite-class109.log` had no failure).
Not replayed over the real mikaela12 texts (the run left no artifact;
the fixture reproduces the shape).
Frozen `.frozen-dist-457765221`.

Reading the rest was moot:
no page shipped.

`mikaela13` (entry `mikaela_khara`,
frozen `457765221`,
pid 344865,
overlap 8)
launched 04:18 UTC on Bedrock and OpenRouter
(meters 47.86 USD Bedrock,
94.68 OpenRouter at launch;
Synthetic dry for the week,
Hyper dry),
waiter bvhf624bc.
Read for the `insertion-carried-folded (slice 14 into slice 15)` line and the carrier's widened source rendered on the page (the September sentence inside the neighbour's paragraph),
no carried-evidence-lost stop,
then classes seventy to seventy-seven,
ninety-six,
one hundred one and one hundred two beside every check of `mikaela11`
(𝓠𝓾𝓪𝓷 as the archive,
"𝓠𝓾𝓪𝓷’s" curled,
"Mika was outed",
the Epilogue one to one,
the life in the past,
front matter equal,
4 headings,
4 comments,
4 markers,
2 definitions,
no TA,
no error finish).
Then `yingying` or `zheermao101`.

## shi_Yumiaoya18 read, 2026-09-24, 03:45 UTC: SETTLED in 7 min, the first page on class one hundred nine (not exercised: no hold began inside the lane), every check as shi_Yumiaoya17, no class; mikaela12 launched

`shi_Yumiaoya18` (frozen `21ea25993`,
pid 91959) SETTLED at 03:35 UTC 2026-09-24,
7 min after the pass's 03:28 UTC start (TALLY `ms=423317`;
the launch command ran at 03:23 UTC),
one attempt,
865 seats,
38 retry rounds,
686 calls,
no abandoned stream,
0.38 USD by the meters (Bedrock 48.27 to 48.14,
OpenRouter 95.44 to 95.19),
on Bedrock and OpenRouter alone (Synthetic dry for the week,
Hyper dry;
Qwen3.8-27B 99 asked 99 threw and glm-5.3 79 asked 79 threw,
both dark by design).
Stages:
repair from 03:28:50 UTC,
translate lane from 03:30:08 UTC,
contest from 03:32:38 UTC,
consolidation 03:32:55 to 03:35:28 UTC;
Jev 24 of 24;
9 abstention lines with reasons.

Class one hundred nine not exercised live,
as expected:
no hold began inside the repair lane (every JUDGE SEATS line reads `synthetic=dry bedrock=wet hyper=dry openrouter=wet`,
`waited=0ms`),
so no "checker stage re-seated" line printed;
the only `re-seated` line is the translate lane's usual "re-seated before starting".
Both checker rounds of the run heard 2 of 3 (gemma-26b and the dry reading's gemma-4-e2b for the withheld Kimi) in 819 ms and 909 ms with no grace;
the run wrote one repaired chunk (`repairChanged=1`),
so the checker stage ran twice.
The class one hundred filers log is live (34 "filed by" lines).
Class one hundred seven silent this run:
no accepted addition claim against the archive,
no `translate-archive-disputed` line.

The lanes agreed on six slices (0,
2,
5,
9,
14,
16),
so the closing quote (slice 16) never reached the contest or the consolidation and shipped as the archive's two lines
("And in case I don't see you……good afternoon,
good evening,
and good night."
then "From *The Truman Show*",
no Chinese line above them):
classes eighty and one hundred two fine.
Class one hundred one holding (the `[^1]` definition the page's last line,
"below."
then the file's line ending;
one marker,
one definition).
The contest chose the translate lane on all twelve differing slices;
terminals:
consolidated 1,
4,
8,
10,
17;
slate-endorsed 3,
6,
7,
11,
15;
slate-declined 12;
gate-kept 13.
The two page-assembly passes silent (nothing trimmed,
nothing withdrawn,
no finding).
Class seventy-eight holding ("Chewing Gum and Danpian had each passed away as well").
Class seventy-nine holding ("she attempted to end her life in the early hours of January 16",
an attempt,
not a death;
the bench dropped the 吞下大量药物 clause this run as `shi_Yumiaoya14` did,
where `shi_Yumiaoya17` had "swallowed a large amount of medication").
The final-tweet paragraph reads "three bottles of a certain sedative-hypnotic" for 三瓶某种镇静催眠药,
the count the original's and the substance unnamed,
as `shi_Yumiaoya9` shipped and the reading of that run accepted;
minimax-m3 abstained on every slate carrying it under the reader-protection rule,
and the other judges chose against the abstention.
Classes ninety-two,
ninety-five and ninety-six fine (the six straight double quotes the archive's own JSX path literals;
the marker and definition on the page).
Every structural check as `shi_Yumiaoya17`:
4 headings,
front matter equal to the archive,
no TA,
no error finish,
no double blank line,
5 em-dashes (as `shi_Yumiaoya17`,
left per owner).
Han residue as `shi_Yumiaoya17` except the father sentence,
which reads 「逆子」—a disgrace (the source's own corner brackets,
the gloss appended) where `shi_Yumiaoya17` wrote “逆子”;
the archive's own 尼康 D200 caption and comments as before.
The nickname line reads "little yaoniang[^1]" where `shi_Yumiaoya17` wrote "little HRT girl[^1]";
the footnote explains the term either way,
the archive's comment says it needs no translation.
No class.

`mikaela12` (entry `mikaela_khara`,
frozen `21ea25993`,
pid 125750,
overlap 8)
launched 03:38 UTC on Bedrock and OpenRouter
(meters 48.14 USD Bedrock,
95.19 OpenRouter at launch;
Synthetic dry for the week,
Hyper dry),
waiter byun3a1z8.
Read for any "checker stage re-seated" line (none expected without a hold beginning inside the lane),
the checker rounds hearing 2 of 3 on the dry reading,
then classes seventy to seventy-seven,
ninety-six,
one hundred one and one hundred two beside every check of `mikaela11`
(𝓠𝓾𝓪𝓷 as the archive,
"𝓠𝓾𝓪𝓷’s" curled,
"Mika was outed",
the Epilogue one to one,
the life in the past,
front matter equal,
4 headings,
4 comments,
4 markers,
2 definitions,
no TA,
no error finish).
Then `yingying` or `zheermao101`.

## zheermao9 read, 2026-09-24, 03:20 UTC: SETTLED in 20 min, class one hundred three live under Synthetic's weekly dry-out, class one hundred six not exercised (the contest chose the repair lane 5 of 5), class one hundred seven live on slice 0; but the chunks in flight kept the bench read at their start, so seven of eight checker rounds after the dry-out heard 1 of 3 (class one hundred nine, fixed in 21ea25993); shi_Yumiaoya18 launched

`zheermao9` (entry `zheermao101`,
frozen `85ed2881f`,
pid 4089371) SETTLED at 03:04 UTC 2026-09-24,
20 min after its 02:44 UTC launch (TALLY `ms=1191927`),
one attempt,
988 seats asked,
759 calls,
0.37 USD by the meters (Bedrock 48.41 to 48.28,
OpenRouter 95.71 to 95.47),
Synthetic wet at the launch and dry from 02:56:03 UTC (`syntheticWeekly=0%`,
the weekly allowance,
not the five-hour window,
which read 2734 of 2750),
Bedrock and OpenRouter wet,
Hyper dry.
glm-5.3 dark (59 asked,
59 threw;
the Hyper-only seat,
by design).
Jev 29 of 29;
10 abstention lines with reasons.

Class one hundred six not exercised:
slice 9's contest chose the repair lane 5 of 5 with every ballot calling the archive flawed (`lane-won`,
not `settled-neither`,
so the run-off predicate stood aside by design),
and the page's reply label reads "One Among Us members sent her a reply that very night:"
for 那些秋叶的成员…连夜,
the `zheermao8` observation resolved by the contest itself.
Class one hundred seven live on slice 0 (`translate-archive-disputed`,
two accepted `accuracy/addition` claims;
the contest chose translate 3 of 4;
the page's opening quote comes from the translate lane).
Consolidation terminals:
slate-declined-standing on slices 0 and 9,
slate-unjudged on 1,
slate-endorsed on 3,
6,
13 and 14,
gate-kept on 4 and 5,
consolidated on 11;
no unendorsed-standing line.
Every check as `zheermao8`:
2 headings,
front matter equal,
no TA,
no error finish,
no double blank line;
the email label "English translation of the email conversation:"
one line (class seventy-seven holding;
the archive writes "English translation of the preceding email conversation:"
and "English translation of the preceding letter:"),
curly "we'll" (class ninety-six holding),
classes one hundred one,
two and four holding.
The page differs from `zheermao8`'s by 75 diff lines,
the reply label and the opening quote among them.

Class one hundred three live for the first time:
Synthetic dried at 02:56:03 UTC eleven minutes into the repair lane,
and five chunks starting after it logged "chunk re-seated under a hold:
checkers=hf:Qwen/Qwen3.8-27B,gemma-4-26b-a4b-it,google.gemma-4-e2b" (02:56:16 to 02:56:34 UTC),
the dry reading keeping the unreachable Qwen seat and substituting the withheld Kimi with `google.gemma-4-e2b`.

Class one hundred nine:
seven of the eight checker rounds after the dry-out still heard 1 of 3 (chunks 5,
9,
4,
3 and 0 "stage-quorum-unmet (checker 1/3)",
the introduced-defect probe the same,
"checker:
bench short of quorum,
reachable 1 of 3;
closing on 2 voices"),
asking the static bench Qwen3.8-27B and Kimi-K3 (both `NoProviderForModelError`;
SEAT Qwen 133 asked 116 threw,
Kimi 51 asked 34 threw) beside gemma-26b.
The class one hundred three re-seat lands only at a chunk's start;
with overlap 8 the chunks already in flight kept the bench read at their start while their checker stage ran a minute or more later,
after the dry-out.
Fixed in 21ea25993:
the checker stage re-reads the seating at the stage itself
(`repair-checker-reseat.ts`:
`checkerBenchAtStage` asks the lane's `beforeSlice` hook again,
keeps the chunk's bench when the hook names no checkers or the same ones,
and asserts quorum on a fresh bench before logging "checker stage re-seated: <fresh> (the chunk was seated with <old>)";
`standingSeating` is the default for callers without a hook;
`assertCheckerBench` holds the two bench assertions);
threaded as `reseat` from `repairPreparedDocument` through `settleRepairSlice`,
`buyRepairSlice` and `repairChunk` to `proveRepairedChunk` (`repair-chunk-proof.ts`,
the checker stage,
the region collection and the introduced-defect probe on the stage's bench;
`repair-chunk-evidence.ts` holds the parse and the neighbour window,
both split out of `repair-chunk.ts` for the line budget).
Guards red first at 1ab453219 (`repair-checker-reseat.unit.test.ts`:
keeps the chunk's bench,
asks the bench read at the stage,
refuses a bench below the floor;
`repair-translation.unit.test.ts`:
the hook answering `{}` at the chunk's start and the substitute roster at the stage seats the substitute on the checker round),
lint 0 and 0,
types clean,
full suite green (`suite-class109.log`,
1114 PASS);
the class thirteen "asks before every slice" guard now reads at least once per slice,
since the checker stage asks again.
Not exercised live yet:
it needs a provider to dry out inside the repair lane;
Synthetic is dry for the week,
so the next runs verify no regression only.

`shi_Yumiaoya18` (frozen `21ea25993`,
pid 91959,
overlap 8)
launched 03:23 UTC on Bedrock and OpenRouter
(meters 48.28 USD Bedrock,
95.47 OpenRouter at launch;
Synthetic dry for the week,
Hyper dry),
waiter wait-s18.
Read for any "checker stage re-seated" line (none expected without a hold beginning inside the lane),
the checker rounds hearing 2 of 3 on the dry reading (gemma-26b and gemma-4-e2b),
then classes seventy-eight,
seventy-nine,
ninety-two,
ninety-five,
ninety-six,
one hundred one and one hundred two beside every check of `shi_Yumiaoya17` (4 headings,
front matter equal,
the death paragraphs on the page,
the closing quote as the archive's two lines,
no TA,
no error finish,
no double blank line).
Then `mikaela_khara`.

## CuspariaKLSY12 read, 2026-09-24, 02:50 UTC: SETTLED in 25 min, class one hundred eight live on slice 3 (the softened detail refused on the translate slate, the contest and the gate), no class; zheermao9 launched

`CuspariaKLSY12` (frozen `85ed2881f`,
pid 3947732) SETTLED at 02:42 UTC 2026-09-24,
25 min after its 02:17 UTC launch (TALLY `ms=1478275`),
one attempt,
437 seats asked,
420 calls,
0.13 USD by the meters (Bedrock 48.46 to 48.41,
OpenRouter 95.79 to 95.71),
Synthetic wet again from the launch (five-hour window 2750 of 2750 at 02:17 UTC,
so the handover's "spent since 23:15:27 UTC" line was stale by then),
Hyper dry;
the time is Synthetic's again (Qwen3.8-27B streams there at 39 s,
the naturalness reviews 26 s in grace),
against `CuspariaKLSY11`'s 5 min on Bedrock and OpenRouter alone.
glm-5.3 dark (17 asked,
17 threw;
the Hyper-only seat with Hyper dry,
by design).
Jev 12 of 12;
10 abstention lines with reasons.

Class one hundred eight live on slice 3,
the death paragraph.
The repair lane softened the accepted addition again,
this run into "She fell asleep" (the repair lane's own sheets are unchanged,
as the ninth addendum says),
and the stand-in carried it into every later sheet with the ARCHIVE RENDERING DISPUTED block beside it:
the translate slate declined its first round,
ran off 2 of 6 (class eighty-two) and chose the candidate without it,
one ballot writing "Candidate 2 also adds 'She fell asleep'";
the contest chose translate 4 of 5 with every ballot calling the archive flawed,
two ballots naming the repair lane's "inference" and one "avoiding unsupported claims found in the archive rendering";
the gate heard 4 of 5 (standing 2,
consolidated 1,
neither 1) and kept the contest winner as the standing over a proposal differing only in "her friend" against "a friend",
one standing ballot writing "both omit the rejected medication detail".
The page reads "A conflict broke out while she was trying to console her friend,
and emotions boiled over on both sides.
After waking up,
she argued with her father again.
She then attempted suicide and was sent to the hospital for emergency treatment."
where `CuspariaKLSY11` shipped "She took medication that night";
双方情绪爆发,
又 and 抢救 all rendered,
the archive's "swallowed lots of her meds" and every softening of it gone.
Class one hundred seven live on slice 3 (`translate-archive-disputed`,
three accepted `accuracy/addition` claims,
in the lanes and the consolidation);
slice 1 undisputed this run (no accepted addition claim against it).
Classes one hundred four and five holding (the life in the past;
the gloss inline as "(Cold Water Fishy)" on the nickname line,
the restore standing aside by design).
Every check as `CuspariaKLSY11`:
1 heading,
front matter equal,
no TA,
no error finish,
no double blank line.
Terminals:
slice 1 gate-kept (2 to 2,
the standing carrying the gloss),
slice 2 slate-declined and unendorsed,
slice 3 gate-kept as read.
The archive's gloss line ("Ling Shui Yu Yu Zi" means fish in clear water) is on the page in the parenthetical form only,
as on `CuspariaKLSY8` to `11`.
No class.

`zheermao9` (entry `zheermao101`,
frozen `85ed2881f`,
pid 4089371,
overlap 8)
launched 02:44 UTC on Synthetic,
Bedrock and OpenRouter
(meters 48.41 USD Bedrock,
95.71 OpenRouter at launch),
waiter bhdypi1ya.
Read slice 9 first for class one hundred six (a `translate-declined-retried` finding on a consolidation slice after a contest with the archive flawed on every ballot;
the reply label rendering plural members that same night),
any `translate-archive-disputed` line and its ARCHIVE RENDERING DISPUTED block,
then classes seventy-seven,
ninety-six,
one hundred one,
one hundred two and one hundred four beside every check of `zheermao8` (2 headings,
front matter equal,
both labels as the archive,
no TA,
no error finish,
no double blank line).
Then `shi_Yumiaoya` or `mikaela_khara`.

## CuspariaKLSY11 read, 2026-09-24, 02:20 UTC: SETTLED in 5 min, class one hundred seven live on slices 1 and 3, the stand-in still carrying "took medication that night"; class one hundred eight built (the dispute note on every sheet), CuspariaKLSY12 launched

`CuspariaKLSY11` (frozen `a40c28cad`) SETTLED at 01:55 UTC 2026-09-24,
5 min after its 01:49 UTC launch (TALLY `ms=323459`),
one attempt,
327 seats,
13 retry rounds,
256 calls,
0.10 USD by the meters (Bedrock 48.50 to 48.46,
OpenRouter 95.88 to 95.80),
on Bedrock and OpenRouter alone (Synthetic's window spent,
Hyper dry),
the roster 8 after the gpt-oss-120b cull.
Jev 11 of 11;
5 abstention lines with reasons.

Class one hundred seven live:
`translate-archive-disputed` on slices 1 and 3 in the lanes and again in the consolidation (two accepted `accuracy/addition` claims each),
the repair text the incumbent on both,
slice 3 (the death paragraph) shipped as `{kind: incumbent}` gate-kept,
and the archive's "swallowed lots of her meds" nowhere on the page.
Classes one hundred four and five holding (the life in the past;
the gloss inline as "(Cold Water Fishy)" on the name's first appearance,
so the restore stood aside by design).
Every check as `CuspariaKLSY10`:
1 heading,
front matter equal,
no TA,
no error finish,
no double blank line.

Class one hundred eight,
found on slice 3:
the stand-in still reads "She took medication that night" where 服药 is nowhere in the original
(在劝慰朋友时发生矛盾，双方情绪爆发，醒来后又和其父亲发生争吵，后因尝试自杀送往医院抢救).
The repair lane softened the accepted critical addition instead of removing it;
the contest split 2 repair to 2 translate with one ballot calling the detail "from the original";
the consolidated proposal dropped it;
the gate heard 4 of 5 and split 2 to 2 (standing,
consolidated,
standing,
consolidated) and kept the standing,
the first standing ballot citing "dropped page content ... which the Chinese does not contradict",
the class eighty-five apparatus clause read over a text that stands in precisely because that detail was an accepted addition.
Nothing on any sheet said the slice was disputed or which claims had been accepted.

Built as class one hundred eight (guards red first `65d159d2a`,
built `85ed2881f`):
`archiveDisputeNote` (`archive-dispute.ts`) writes one block per disputed slice,
"ARCHIVE RENDERING DISPUTED:
the repair lane's adjudicators accepted N accuracy/addition claim(s) that the archive rendering says what the ORIGINAL never states;
the claims:
(1) ...;
(2) .... A detail those claims name is not page content and not the page's apparatus,
in the archive's wording or any softer one:
a candidate leaving it out has dropped nothing,
and a candidate keeping it carries an accepted addition.
Judge such a detail against the ORIGINAL alone.",
and every sheet that judges or writes against the stand-in carries it:
the consolidation writer,
slate judge and gate sheets (`consolidate-wire.ts`,
`consolidate-settle-context.ts`,
`consolidate-gate-wire.ts`),
the translate writer and slate judge sheets (`translate-wire.ts`,
`translate-judge.ts`,
threaded through `translate-slice-input.ts`,
`translate-stage.ts` and `translate-stage-repair.ts`),
and the lane contest sheet (`lane-contest-wire.ts`,
in the slice key through `lane-contest-key.ts`,
the notes read off the repair chunks in `corpus-run/pass-contest.ts` through `archiveDisputeNotesOf`).
`ArchiveDispute` now carries `acceptedClaims`.
The wording names no sheet's own incumbent because the lane contest shows the real archive while the consolidation and translate sheets show the stand-in.
Not built:
the repair lane's own sheets are unchanged,
so the lane may still soften an accepted addition rather than remove it;
the note reaches the contest and everything after it.
Lint 0 and 0,
types clean,
twelve touched suites green,
full suite green (`suite-class108.log`,
1113 PASS);
replayed offline over the real `CuspariaKLSY11` artifact:
slices 1 and 3 disputed,
the slice 3 note naming both accepted claims,
the gate sheet carrying it after CANDIDATE "standing".
Ninth ineligible-standing addendum in the docs commit.
Not exercised live yet.

`CuspariaKLSY12` (frozen `85ed2881f`,
pid 3947732,
overlap 8)
launched 02:17 UTC on Bedrock and OpenRouter
(meters 48.46 USD Bedrock,
95.80 OpenRouter at launch),
waiter buax5c511,
the first pass on class one hundred eight.
Read slice 3 first:
the ARCHIVE RENDERING DISPUTED block on the contest,
slate and gate sheets in the artifact,
the death paragraph without "took medication",
`translate-archive-disputed` on slices 1 and 3 again;
then classes one hundred four,
five and seven,
beside every check of `CuspariaKLSY11`.
Then `zheermao101` (slice 9 for class one hundred six),
then `shi_Yumiaoya` or `mikaela_khara`.
