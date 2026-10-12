# Translation repair: OpenRouter as the paid fallback provider, part 21

Part 21 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## shi_Yumiaoya16 read, 2026-09-23, 22:45 UTC: SETTLED in 6 min, class one hundred one live, but the closing quote shipped its Chinese line beside the English because the lane offer's floor ran without the line-structured flag (class one hundred two); fixed in 6361d74d0, shi_Yumiaoya17 launched

`shi_Yumiaoya16` (frozen `314ca4b8c`,
pid 2942500) SETTLED at 22:29 UTC,
6 min after its 22:26 UTC launch (TALLY `ms=368514`),
one attempt,
880 seats,
32 retry rounds,
799 calls,
no abandoned stream,
0.60 USD by the meters (Bedrock 49.98 to 49.67,
OpenRouter 97.30 to 97.01),
on Bedrock and OpenRouter alone (Synthetic spent,
Hyper dry;
glm-5.3 and Qwen3.8-27B dark by design).
Stages:
repair from 22:24 UTC,
contest from 22:26 UTC,
consolidation 22:26 to 22:29 UTC;
Jev 20 of 20;
13 abstention lines with reasons;
terminals:
slate-endorsed 0,
1,
10,
17;
consolidated 3,
4,
16;
slate-declined 6,
7,
8,
11,
13;
gate-kept 9,
12,
15;
one unendorsed standing (0).

Class one hundred one live:
the page written past the wording check with the source's `[^1]` definition as its last line,
ending "below."
with no trailing space (the composer's body),
and both `[^1]` markers the source carries on the page (line 29 and the bullying sentence;
`shi_Yumiaoya14` had carried one).
The two page-assembly passes silent (no `page assembly:` line).
Classes seventy-eight and seventy-nine holding ("Chewing Gum and Danpian had both",
"she attempted to end her life by swallowing a large amount of medication" before the ICU waking),
classes ninety-two,
ninety-five and ninety-six fine (marker and definition on the page,
the six straight double quotes the archive's own JSX path literals),
every structural check as `shi_Yumiaoya14` (4 headings,
front matter equal,
no TA,
no error finish,
no double blank line).
Han residue as `shi_Yumiaoya14`:
"an underage 药娘[^1]" on the bullying sentence (the same line in Han on 14),
the archive's own 尼康 D200 caption and comments.

Class one hundred two.
The closing quote shipped three lines,
the source's Chinese line 如果再也不能见到你 above the film's English and the attribution,
where the archive carries the English and the attribution alone and `shi_Yumiaoya13` and `14` had shipped the archive's two lines.
The repair lane won the contest with that three-line text;
at the consolidation the standing failed the deterministic rule on the class eighty pair bound
("the EXISTING TRANSLATION carries the block holding it as 2 lines.
Yours carries 3"),
the incumbent stood in,
and the class forty lane offer (`consolidate-lane-offer.ts`) put the same repair text on the slate:
its `validateTranslatedSlice` call carried no `lineStructured`,
so the line floor and the pair bound inside it never ran,
the text read valid,
the judges chose it,
the gate confirmed it 3 of 4 ("preserves the Chinese greeting"),
the polish validated against its own base,
and the page carried what the standing check had refused.
Replayed off the built dist:
the shipped text invalid under `lineStructured: true` and valid without it;
the offer over the run's real slice 16 data returns `repair` without the flag and nothing with it.
Fixed in 6361d74d0:
`laneTextsForSlate` takes `lineStructured` and passes it to the rule;
`consolidate-driver.ts` passes the slice's flag it already holds for the proposals;
guard red first at 404b5dada (`consolidate-lane-offer.unit.test.ts`:
a line-structured slice whose repair text carries the Chinese line of a bilingual pair is left out and the two-line translate text offered;
positive control run through the floor first),
lint 0 and 0,
types clean,
full suite green (`suite-class102.log`,
1103 PASS,
exit 0).
Open beside it,
not built:
the repair lane itself shipped the three-line text into the contest,
so the lane's own floor does not read the pair bound either;
the consolidation refuses it now at both doors.

`shi_Yumiaoya17` (frozen `6361d74d0`,
pid 2953486,
overlap 8)
launched 22:36 UTC on Bedrock and OpenRouter
(meters 49.64 USD Bedrock,
96.97 OpenRouter at launch),
waiter bpts8jr04.
Read for class one hundred two live (the closing quote as the archive's two lines,
no lane text carrying the Chinese line on the slate;
the `lane texts offered` line on slice 16 naming no lane,
or the slice settled another way),
class one hundred one holding (the `[^1]` definition on the page whatever whitespace its candidate ends in),
classes seventy-eight to eighty,
ninety-two,
ninety-five and ninety-six holding,
beside every check of `shi_Yumiaoya14` (4 headings,
front matter equal,
no TA,
no error finish,
no double blank line).

## shi_Yumiaoya15 read, 2026-09-23, 22:30 UTC: TALLY ERROR twice at publish, the footnote definition's wording "not in the page" because the insertion composer cuts the two spaces its lane text ended in while the wording check searched them (class one hundred one); fixed in 314ca4b8c, shi_Yumiaoya16 launched

`shi_Yumiaoya15` (frozen `0f685f551`,
pid 2923082) stopped ERROR at 22:14 UTC,
7 min after its 22:07 UTC launch (first attempt TALLY `ms=415307`,
the second resumed from the caches and stopped again in `ms=1521`),
two attempts,
1,020 seats,
39 retry rounds,
794 calls,
no abandoned stream,
0.53 USD by the meters (Bedrock 50.29 to 49.98,
OpenRouter 97.52 to 97.30),
on Bedrock and OpenRouter alone (Synthetic spent,
Hyper dry;
glm-5.3 and Qwen3.8-27B dark by design).
Stages:
repair from 22:08 UTC,
translate from 22:10 UTC,
contest from 22:11 UTC,
consolidation 22:12 to 22:14 UTC;
Jev 25 of 25;
24 abstention lines with reasons;
one unendorsed standing (16,
the closing quote,
slate-declined).
No page and no artifact were written:
`refusePageThatDisagrees` refused the composed page before the write with
"1 wording(s) the artifact says would ship are not in the page in slice order,
at slices 17 (237 characters)".

Class one hundred one.
Slice 17 is the source's own `[^1]` footnote definition (the 小药娘 note),
admitted as an insertion (`coverage=absent`) since the archive glosses the term inline and carries no definition;
the translate lane's winning candidate (GLM-5.3-Flash,
chosen at weight 3 of 5 ballots) ended in two spaces after its full stop,
237 characters with them,
and the consolidation shipped it as the standing.
The splice writes an inserted slice through `composeInsertion`,
whose `fragmentBody` cuts the blank lines around a fragment and the spaces at its end (documented there since e2c624fa9:
safe because fragments are joined by a blank line),
so the page carried every word of the definition and ended "below.\n";
`pageCarriesEveryWording` (`corpus-run/published-page-check.ts`) searched the raw would-ship wording,
"below.
 ",
found no such stretch,
and the entry stopped ERROR.
The two page-assembly passes of classes ninety-nine and one hundred were silent (no `page assembly:` line),
so the class is the check's,
not theirs;
class seventy-five had taught the weight check to read through `matchSpanEdges` (c5470163d) and left the wording check reading the stage's text.
`shi_Yumiaoya1` to `14` never met it because no chosen candidate on an inserted slice had ended in spaces;
the check has been one-sided in the wrong direction since the publish fix of 2026-08-24 for silent anchors whenever one does.

Fixed in 314ca4b8c:
the wording scan searches `fragmentBody({ fragment: reading.text })`,
the body both splice paths leave on the page
(an inserted slice writes exactly that body;
a content span keeps its interior with the archive span's line-ending edges,
and the body is inside it),
so the check stays one-sided and can still refuse a lost or reordered passage;
guard red first at 4c36039b0 (`published-page-check.unit.test.ts`:
an inserted wording ending in the two spaces the composer cuts,
reported missing on the old dist with 39 characters),
lint 0 and 0,
types clean,
full suite green (`suite-class101.log`,
1103 PASS,
exit 0),
replayed off the built dist over the real 237-character wording of the run's translate cache through `composeInsertion` and `pageCarriesEveryWording`:
nothing missing.

`shi_Yumiaoya16` (frozen `314ca4b8c`,
pid 2942500,
overlap 8)
launched 22:26 UTC on Bedrock and OpenRouter
(meters 49.98 USD Bedrock,
97.30 OpenRouter at launch),
waiter bxei53tuc.
Read for class one hundred one live (the page written past the wording check with the `[^1]` definition on it,
whatever whitespace its candidate ends in),
the two page-assembly passes (none expected),
classes seventy-eight to eighty,
ninety-two,
ninety-five and ninety-six holding,
beside every check of `shi_Yumiaoya14` (4 headings,
front matter equal,
no TA,
no error finish,
no double blank line).

## mikaela11 read, 2026-09-23, 22:10 UTC: SETTLED in 11 min, the two page-assembly passes silent, classes seventy to seventy-seven and ninety-six holding, no class; shi_Yumiaoya15 launched

`mikaela11` (frozen `0f685f551`,
pid 2920908,
entry id `mikaela_khara`) SETTLED at 22:07 UTC,
11 min after its 21:56 UTC launch (TALLY `ms=644898`),
one attempt,
2,124 seats,
60 retry rounds,
1,848 calls,
1 abandoned stream (0.002 USD),
1.07 USD by the meters (Bedrock 50.95 to 50.30,
OpenRouter 97.95 to 97.53),
on Bedrock and OpenRouter alone;
Jev 75 of 75.
No `jsx-attribute-restored` and no `title-reference-` line (the archive renders every heading).
Classes seventy to seventy-seven and ninety-six holding:
𝓠𝓾𝓪𝓷 eight times as the archive with the possessive "𝓠𝓾𝓪𝓷’s" curled,
no straight apostrophe in a word,
"Mika was outed",
the Epilogue section as `mikaela10` line for line,
the life in the past.
Every check as `mikaela10`:
front matter equal,
4 headings,
4 comments,
4 markers,
2 definitions,
no TA,
no error finish,
the page's one double blank line the archive's own before the details block;
four unendorsed standings (0,
7,
12,
29),
67 abstention lines with reasons.
No class.

`shi_Yumiaoya15` (frozen `0f685f551`,
pid 2923082,
overlap 8)
launched 22:07 UTC on Bedrock and OpenRouter
(meters 50.29 USD Bedrock,
97.52 OpenRouter at launch),
waiter bx91ra6hw.
Read for the two page-assembly passes (none expected),
classes seventy-eight to eighty,
ninety-two,
ninety-five and ninety-six holding ("Chewing Gum" and "Danpian",
the attempt survived on January 16,
the closing quote as the archive's two lines,
the marker and definition on the page),
beside every check of `shi_Yumiaoya14` (4 headings,
front matter equal,
no TA,
no error finish,
no double blank line).

## hulicaijia16 read, 2026-09-23, 22:00 UTC: SETTLED in 27 min, the two page-assembly passes silent on a page whose archive renders every heading, no class; mikaela11 launched

`hulicaijia16` (frozen `0f685f551`,
pid 2917545) SETTLED at 21:55 UTC,
27 min after its 21:29 UTC launch (TALLY `ms=1596637`),
one attempt,
4,482 seats,
144 retry rounds,
3,722 calls,
no abandoned stream,
3.81 USD by the meters (Bedrock 52.98 to 50.95,
OpenRouter 99.75 to 97.97),
on Bedrock and OpenRouter alone (Synthetic spent,
Hyper dry).
Stages:
repair from 21:32 UTC,
translate from 21:45 UTC,
contest from 21:47 UTC,
consolidation 21:49 to 21:55 UTC,
the fastest hulicaijia run to date (37 min on `hulicaijia15`,
68 on `hulicaijia13`).
Endpoints:
deepseek on Morph 646 streams at 3.4 s (1 CoreWeave fallback),
GLM-5.3-Flash on Wafer 220 at 4.4 s,
minimax-m3 on CoreWeave 600 at 1.8 s,
Mercury on Inception 444 at 6.5 s;
Jev 132 of 132.

Classes ninety-nine and one hundred silent by design:
no `jsx-attribute-restored` and no `title-reference-` line,
the archive rendering every heading of this page and carrying no tag attribute the bench rewrote;
the passes ran over the page (the guard logs every finding) and found nothing to change,
the first entry other than XingZ60 through them.
Classes eighty-four,
ninety-two,
ninety-five and ninety-six holding:
18 markers and 9 definitions with no trim,
revert or marker-drop refusal,
no straight apostrophe in a word.
Every check as `hulicaijia15`:
13 headings (the archive's "Conflict" for 左右),
18 markers,
9 definitions,
2 links,
3 Sakura,
front matter equal,
no TA,
no error finish,
no double blank line;
one unendorsed standing (35),
15 gate-kept,
19 slate-declined,
130 abstention lines with reasons.
No class.

`mikaela11` (frozen `0f685f551`,
pid 2920908,
overlap 8,
entry id `mikaela_khara`)
launched 21:56 UTC on Bedrock and OpenRouter
(meters 50.95 USD Bedrock,
97.95 OpenRouter at launch),
waiter boq6zxv1i.
Read for the two page-assembly passes (none expected;
any line read against the archive),
classes seventy to seventy-seven and ninety-six holding (the excerpt line curled,
𝓠𝓾𝓪𝓷 as the archive,
"Mika was outed",
the Epilogue one to one,
the life in the past,
"𝓠𝓾𝓪𝓷’s" curled),
beside every check of `mikaela10` (front matter equal,
4 headings,
4 comments,
4 markers,
2 definitions,
no TA,
no error finish).

## XingZ631 read, 2026-09-23, 21:50 UTC: SETTLED in 43 min, classes ninety-nine and one hundred live on the markers, the linked credit and both song credits; the quote search read a tag attribute's quotes and stood aside once, fixed in 0f685f551, hulicaijia16 launched

`XingZ631` (frozen `5e21134ee`,
pid 2893880) SETTLED at 21:22 UTC,
43 min after its 20:39 UTC launch (TALLY `ms=2607181`),
one attempt,
8,077 seats,
244 retry rounds,
7,246 calls,
1 abandoned stream (0.004 USD),
8.59 USD by the meters (Bedrock 57.75 to 52.99,
OpenRouter 103.65 to 99.82),
on Bedrock and OpenRouter alone (Synthetic spent,
Hyper dry;
glm-5.3 and Qwen3.8-27B dark by design).
Stages:
repair from 20:44 UTC,
translate from 20:57 UTC,
contest from 21:05 UTC,
consolidation 21:08 to 21:22 UTC,
the fastest XingZ60 run to date.
Endpoints:
deepseek on Morph 1,194 streams at 5.1 s (4 CoreWeave fallbacks),
GLM-5.3-Flash on Wafer 426 at 5.9 s,
minimax-m3 on CoreWeave 865 at 5.8 s and Together 281 at 3.5 s,
Mercury on Inception 847 at 7.1 s;
2 cap cuts;
Jev 248 of 248.

Class ninety-nine live:
one `jsx-attribute-restored` line (slice 12,
`<DottedNumber n="二"/>` to `<DottedNumber n="II"/>`,
the bench having left the Han this run) and the six markers on the page read `II` to `VII` as the archive writes them.
Class one hundred live:
one `title-reference-unified` line (slice 101,
the second song credit's pinyin "Ling Chong Qi Yuan" to the heading's "Zero-Layer Prayer",
a form no floor names and the judges had endorsed),
the linked credit `[Bird in a Cage](…)` and the heading "Bird in a Cage" one rendering,
the first credit “Nonuple Reality” and its heading one rendering,
footnote 6 "the piece “Zero-Layer Prayer”" and its heading one rendering.
Class ninety-eight on the wire again (one refusal for a Han title).
Class ninety-seven on the wire (seventeen refusals,
the page in the second person).
Classes eighty-eight to ninety-three holding (two `handle-gloss-placed`,
eight `heading-series-unified`,
four contributor-name restores,
nine definitions and no trim,
Morph and Wafer serving);
class ninety-four not exercised (the placeholder kept again,
the fifth treatment in six runs).
Every structural check as `XingZ630`:
fourteen headings,
both links,
nine definitions,
3 TextRing,
eleven details blocks,
front matter equal,
no TA,
no error finish,
no double blank line,
the ten section headings by name alone;
five unendorsed standings (18,
27,
54,
57,
65),
30 gate-kept,
36 slate-declined,
196 abstention lines with reasons.
The Han census over the page against the archive finds only 妄想症 in the album's own name and 螐儿.

One `title-reference-ambiguous` line on slice 98,
the first credit:
the credit already quoted the heading,
"—— Yuli 【Paranoia】 "Nonuple Reality"",
but the slice also carries the `<TextRing text="☿☿☿☿☿☿" fontSize="1.25rem"/>` tag whose two quoted attribute values the quote search read as spans,
so the search stood aside without comparing;
the page was right by the bench's own choice,
not by the pass.
Fixed in 0f685f551 (`corpus-run/title-reference-marks.ts`,
the mark search split out of the locator):
a quote span that follows an attribute's equals sign is skipped,
and among several spans the one that already carries the heading's rendering settles the reading;
guard red first at 1c67cb139,
lint 0 and 0,
types clean,
full suite green (`suite-class100b.log`),
replayed over the `XingZ631` artifact with slice 98 read as consistent and the two rewrites unchanged.
Observations,
not built:
the coined 螐 shipped as "A little wun[^7]" on the cage line and "螐儿's last words" two lines later,
two treatments of one coined character on one page where `XingZ630` wrote "A wu[^7] bird" and `XingZ629` kept the character (three runs,
three treatments;
the footnote explains a character the page no longer shows on the first line);
the album 【妄想症Paranoia】 shipped as "【Paranoia】" on the first credit and in full on the second,
a Latin-bearing title the judges own.

`hulicaijia16` (frozen `0f685f551`,
pid 2917545,
overlap 8)
launched 21:29 UTC on Bedrock and OpenRouter
(meters 52.98 USD Bedrock,
99.75 OpenRouter at launch),
waiter bz8xt9q42,
the first entry other than XingZ60 on the two page-assembly passes.
Read for `jsx-attribute-restored` and `title-reference-unified` lines (none expected on a page whose archive renders every heading;
any line is read against the archive),
classes eighty-four,
ninety-two,
ninety-five and ninety-six holding,
beside every check of `hulicaijia15` (13 headings,
18 markers,
9 definitions,
2 links,
3 Sakura,
front matter equal,
no TA,
no double blank line).

## XingZ630 read, 2026-09-23, 20:45 UTC: SETTLED in 76 min, class ninety-eight live on both song credits and the linked title, but the marker series shipped in three numeral styles (class ninety-nine) and two section titles in two renderings each (class one hundred); fixed in 5e21134ee, XingZ631 launched

`XingZ630` (frozen `2c3a80370`,
pid 2844294) SETTLED at 20:15 UTC,
76 min after its 18:59 UTC launch (TALLY `ms=4572808`),
one attempt,
8,436 seats,
326 retry rounds,
7,560 calls,
7 abandoned streams (0.04 USD),
8.98 USD by the meters (Bedrock 62.51 to 57.78,
OpenRouter 107.96 to 103.71),
on Bedrock and OpenRouter alone (Synthetic read wet on one meter reading at 19:20 UTC,
`syntheticWeekly=2%`,
and served no completed stream;
Hyper dry;
glm-5.3 and Qwen3.8-27B dark by design).
Stages:
repair from 19:06 UTC,
translate from 19:38 UTC,
contest from 19:51 UTC,
consolidation 19:54 to 20:15 UTC;
the repair lane took 32 min against `XingZ629`'s 16 and the translate lane 13 against 6.
Endpoints:
deepseek on Morph 1,221 streams at 9.2 s (3 CoreWeave fallbacks at 35.6 s),
GLM-5.3-Flash on Wafer 384 at 8.5 s (5 InferenceNet fallbacks at 77.6 s,
2 Morph at 25.4 s),
minimax-m3 on CoreWeave 782 at 7.2 s and Together 368 at 2.3 s,
Mercury on Inception 879 at 6.8 s;
no cap cut;
Jev 235 of 244 usable,
9 threw.
The slower run is the endpoints' own latency (Morph 9.2 s against 7.2,
Wafer 8.5 against 5.3),
the preferred endpoints holding (class ninety-three).

Class ninety-eight live.
The floor refused one gemma-4-e2b translate candidate on slice 94 for leaving 《九重现实》 in Han (three `translate-invalid` and `translate-candidate-refused` pairs in `artifacts/XingZ60.json`);
the first credit shipped "—— Yuli (Rain Fox) 【妄想症Paranoia】《Nonuple Reality》",
the second "—— Yuli,
from “Paranoia,”
Zero-Layer Prayer (零重祈愿)" with the Han in parentheses after the English as the policy bullet allows,
and the Bird in a Cage credit links `[The Caged Bird](…)` in English;
the Han census over the page against the archive finds only the album's own name,
that parenthetical gloss and the JSX ordinal 七 (class ninety-nine).
The first credit now carries the album name `XingZ629` had dropped.
Class ninety-seven on the wire again:
thirteen `carries no "you"` refusals across the artifact,
the page addressing her ("You tried to delve deep into virtual worlds.",
"You thought of becoming a boy,").
Classes eighty-eight to ninety-three holding:
three `handle-gloss-placed` lines (Jinxin glossed in the Part Ten heading and bare on the signature;
Yuli glossed on the first credit,
bare on the second),
ten `heading-series-unified` lines and the ten section headings by name alone,
five contributor-name restores,
nine definitions with no trim line,
Morph and Wafer serving.
Class ninety-four not exercised:
the archive block review kept "**Come back later!**" this run (the fourth treatment in five runs:
kept,
removed,
removed,
revised,
kept),
no double blank line.
Every structural check as `XingZ629`:
fourteen headings,
both links,
nine definitions,
3 TextRing,
eleven details blocks,
front matter equal,
no TA,
no error finish,
no double blank line;
five unendorsed standings (17,
18,
27,
31,
40),
29 gate-kept,
34 slate-declined,
one incumbent-only (87,
the memorial attribution line with its rule and details close),
207 abstention lines with reasons.

Class ninety-nine.
The original's dotted section markers `<DottedNumber n="二"/>` to `<DottedNumber n="七"/>` shipped as `n="II"`,
`n="III"`,
`n="IV"`,
`n="5"`,
`n="VI"` and `n="七"` where the archive writes Roman numerals throughout (`II` to `VII`);
`XingZ629` had shipped `n="五"` in the same series.
The translate lane wrote `n="5"` on slice 34 and `n="VII"` on slice 41,
the repair lane's `n="七"` won slice 41;
a tag's string attribute is apparatus no judge weighs and every slice is judged alone,
so the numeral style moves slice to slice.
Class one hundred.
The original heads a section 笼中之鸟 and credits the song as `《[笼中之鸟](…)》`,
heads another 零重祈愿,
credits it as 《零重祈愿》 and points footnote 6 at 「零重祈愿」篇;
the page headed "Bird in a Cage" over the linked credit "The Caged Bird" and "Zero-Layer Prayer" over the footnote's "Zero-Degree Prayer" (零重 read as a degree),
and `XingZ629` had headed "The Bird in the Cage" over the link "Bird in a Cage".
The archive renders none of these three headings,
so the heading's rendering is the bench's each run and no judge sees the heading beside the reference.
An observation beside them,
not built:
the coined 螐 with its footnote shipped as "A wu[^7] bird" where `XingZ629` kept the character;
the note "It can be read either as an insect or as a bird" now explains a syllable.

Classes ninety-nine and one hundred fixed in 5e21134ee (2f8bcfe93 and 5e21134ee),
two page-assembly passes after the heading series pass:
`restoreJsxAttributes` (`corpus-run/jsx-attribute-restore.ts`,
tags read by index scan in `tag-attributes.ts`) takes the archive's value of every quoted attribute where the page carries the archive slice's tags in order,
leaving a slice whose tag sequence differs and a slice the archive never carried;
`unifyTitleReferences` (`corpus-run/title-reference-unify.ts`) pairs every Han heading,
ATX or `<hN>` (`heading-title-lines.ts`),
with its page rendering by position and rewrites each bracketed reference in a replaced slice to the heading's rendering,
located by the link's destination,
by the Han gloss after the English,
by title brackets or by quotes (`title-reference-locate.ts`),
the bracket and quote searches held to the page's definition line where the original references the title on a footnote line (`title-reference-scope.ts`),
reporting `title-reference-ambiguous` where a slice offers two spans of one shape rather than guessing;
findings `jsx-attribute-restored` and `title-reference-unified`,
both passes exported through the readiness barrel.
Guards red first at a86a3757e and a1ce2c580 (`jsx-attribute-restore.unit.test.ts`,
`title-reference-unify.unit.test.ts`),
lint 0 and 0,
types clean,
full suite green twice (`suite-class99-100.log` 1103 PASS,
`suite-class99-100b.log`).
Replayed off the built dist over the real artifacts:
`XingZ630` slice 34 `n="5"` to `n="V"` and slice 41 `n="七"` to `n="VII"`,
slice 94 "The Caged Bird" to "Bird in a Cage",
slice 117 "Zero-Degree Prayer" to "Zero-Layer Prayer";
`XingZ629` slice 95 "Bird in a Cage" to its heading's "The Bird in the Cage" and slice 101's Han credit to "Zero-Layer Prayer".

`XingZ631` (frozen `5e21134ee`,
pid 2893880,
overlap 8)
launched 20:39 UTC on Bedrock and OpenRouter
(meters 57.75 USD Bedrock,
103.65 OpenRouter at launch),
waiter b9ywlheib.
Read for classes ninety-nine and one hundred live (`jsx-attribute-restored` and `title-reference-unified` lines in the log;
the six markers `II` to `VII`;
the linked credit,
the two song credits and footnote 6 carrying the headings' own renderings),
class ninety-eight again on the credits,
classes eighty-eight to ninety-seven holding,
beside every check of `XingZ630`.

## XingZ629 read, 2026-09-23, 19:03 UTC: SETTLED in 50 min, class ninety-seven live on the meteor address, classes eighty-eight to ninety-three holding, but the second song credit shipped its title in Han (class ninety-eight); fixed in 2c3a80370, XingZ630 launched

`XingZ629` (frozen `e78515f56`,
pid 2793259) SETTLED at 18:39 UTC,
50 min after its 17:49 UTC launch (TALLY `ms=3007748`),
one attempt,
8,350 seats,
286 retry rounds,
7,377 calls,
1 abandoned stream (0.004 USD),
8.70 USD by the meters (Bedrock 67.38 to 62.52,
OpenRouter 111.86 to 108.02),
on Bedrock and OpenRouter alone (Synthetic spent,
Hyper dry;
glm-5.3 asked 577 and threw 577,
Qwen3.8-27B asked 1,164 and threw 1,164,
both Hyper-only seats dark by design).
Stages:
repair from 17:55 UTC,
translate from 18:11 UTC,
contest from 18:17 UTC,
consolidation 18:20 to 18:39 UTC.
Endpoints:
deepseek on Morph 1,203 streams at 7.2 s (2 CoreWeave fallbacks,
1 Fireworks),
GLM-5.3-Flash on Wafer 424 at 5.3 s,
minimax-m3 on CoreWeave 1,041 at 6.5 s and Together 110 at 4.5 s,
Mercury on Inception 881 at 7.8 s;
no cap cut;
Jev 273 of 273.

Class ninety-seven on the wire.
Two minimax-m3 translate candidates were refused on slices 111 and 115,
the closing address to the meteor
("the ORIGINAL passage writes 你 or 您 6 times,
and your translation carries no "you" but "she",
"her",
"they" in its place");
both slices were lane-won by the translate lane
(111 stood slate-declined,
115 consolidated with two ballots for the consolidation and three for neither),
and the page addresses her:
"You tried going deep into virtual worlds."
and "You thought of becoming a boy,"
where the original writes 你.
No contest winner failed the floor this run,
so the withheld-standing path of yingying6 was not exercised.

Classes eighty-eight to ninety-three holding:
one `handle-gloss-placed` line (slice 108:
"### Jinxin (Brocade Heart)" in the heading,
"——Jinxin,
February 10,
2025" bare on the signature;
Yuli never glossed by the bench),
seven `heading-series-unified` lines and the ten section headings by name alone (Irako to Jinxin),
six contributor-name restores,
nine definitions with no trim line (class ninety-two),
Morph and Wafer serving (class ninety-three).
Class ninety-four not exercised:
the archive block review did not remove the placeholder this run but revised it,
"**Come back later!**" to "[!Warning] This page is still under construction.
Please check back later."
(minimax's revision 3.5 of 5,
gemma-4-e2b alone keeping the archive's line),
the third treatment of that block in four runs (kept on `XingZ626`,
removed on `XingZ627` and `XingZ628`);
the placeholder's status as apparatus stays the open question for the owner.
Every structural check as `XingZ628`:
fourteen headings,
both links,
nine definitions,
3 TextRing,
eleven details blocks,
front matter equal,
no TA,
no error finish,
no double blank line;
eight unendorsed standings (9,
18,
49,
59,
73,
78,
82,
83),
three of them gate-kept (49,
59, 82) and five slate-declined;
183 abstention lines with reasons.
The opening quote now wraps at semantic boundaries where `XingZ628` shipped it on one line (the owner's 2026-09-19 answer:
line breaks are fine).

Class ninety-eight.
The second song credit shipped "— Yuli 【妄想症Paranoia】《零重祈愿》" with the song's title in Han,
where `XingZ627` and `XingZ628` had written "《Zero-Layer Prayer》" for it and every run wrote the first credit's 《九重现实》 as "Nonuple Reality";
the translate lane won slice 101 and the slate endorsed it,
one ballot calling the Han title "consistent with the presence of a series name" while another abstention on the footnote slice cited the web lookup's English for the same title.
The house rule already says a work the ORIGINAL names is called by its official English title where one exists and by a translation where none does;
no floor asked for it.
`XingZ619` and `XingZ628` had shipped the Bird in a Cage link text the same way (`《[笼中之鸟](…)》`),
the observation left open since 2026-09-19.
A Han census over the seven latest read pages (`hulicaijia15`,
`mikaela10`,
`shi_Yumiaoya14`,
`yingying6`,
`zheermao6`,
`CuspariaKLSY8`,
`XingZ629`) found the rest of this page's Han legitimate:
a JSX attribute (`<DottedNumber n="五"/>`),
the Japanese lyric line,
the coined 螐 with its footnote,
"Werewolf (狼人杀)" glossed,
the album's own bilingual name 【妄想症Paranoia】;
`shi_Yumiaoya14` carries 「逆子」 with a dash gloss and the other five carry no Han the archive lacks.
An observation beside it:
the first credit dropped the album name the original carries ("—— Yuli《Nonuple Reality》" for "—— 雨狸【妄想症Paranoia】《九重现实》"),
an omission the judges did not see;
one run,
recorded,
not built.

Class ninety-eight fixed in 2c3a80370 (012cec9a1 and 2c3a80370):
`hanTitleFindings` (`translate-han-title.ts`) refuses before any judge a candidate that leaves a title the ORIGINAL brackets in 《》 standing in Han,
where the title carries a Han ideograph and no Latin letter (`han-only-text.ts`,
the unified block as the name index reads it),
the occurrence has no English gloss in parentheses after it and stands in none,
and the page the candidate would replace never wrote it;
a `《[title](url)》` bracket is read by its link text,
so a Han link text is refused too;
comments are cut on both sides.
The marker,
address and title floors fold into `sourceCarryFindings` (`translate-source-carry.ts`) so `translate-validate.ts` keeps its line budget;
the policy's work-title bullet now ends "A title is never left in Han as the work's name:
the Han may follow the English title in parentheses the first time it appears,
and never stands alone."
Guards red first at 5d58ca85c and 051e7b060 (`han-title.unit.test.ts`:
the Han title refused,
the translated,
glossed,
Latin-bearing,
page-kept and comment-only forms accepted,
the link text refused and its translation accepted),
lint 0 and 0,
types clean,
full suite green twice (`suite-class98.log` and `suite-class98b.log`,
1101 PASS).
Replayed off the built dist over the real slices:
`XingZ629` slice 101's shipped text refused ("leaves the title 《零重祈愿》 in Han"),
`XingZ628` slice 95's shipped text refused ("leaves the title 《笼中之鸟》 in Han"),
`XingZ629` slice 95 (English link text) and both runs' slice 98 (the translated first credit) accepted.

`XingZ630` (frozen `2c3a80370`,
pid 2844294,
overlap 8)
launched 18:59 UTC on Bedrock and OpenRouter
(meters 62.51 USD Bedrock,
107.96 OpenRouter at launch),
waiter boqkmvcsw.
Read for class ninety-eight live (the "leaves the title" refusal lines in `artifacts/XingZ60.json`;
both song credits and the Bird in a Cage link in English on the page,
no Han title outside the album name),
class ninety-seven again on the meteor address,
classes eighty-eight to ninety-four holding,
beside every check of `XingZ629`.
