# Translation repair: OpenRouter as the paid fallback provider, part 32

Part 32 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Class forty-nine, 2026-09-17, 16:25 UTC: a candidate defines a note its passage only refers to, and the assembly withdraws both carriers

Found by the shi_Yumiaoya3 read.
The original defines its one footnote in its last slice and refers to it from the opening section.
The translate lane's rendering of the opening section ended with the note written out as a definition
(the block floor had refused one such candidate for carrying seven blocks against six,
and passed the chosen one);
the last slice rendered the definition as well.
The assembly's footnote guard found `[^1]` defined twice,
attributed the defect to every replacement whose mention count moved,
which on a skeleton archive is both carriers,
and withdrew both:
the opening section
(with the film's Wikipedia link)
and the definition left the page,
the contest then saw the lanes agree on nothing there,
and the publish check refused the page for the dropped link after 78 minutes.
Fixed in `cd789763c`
(guard red first at `a22dcffde`):
the slice rule refuses a candidate defining a footnote neither the original passage nor the page slice defines
(`translate-definition-leak.ts`,
after the sheet-label check),
with the finding telling the writer to keep the marker and leave the definition out;
and the assembly attributes a doubled definition to the carriers whose original does not define it,
keeping the slice that owns the note
(`withoutOwners` in `assembly-integrity.ts`).
Run over shi_Yumiaoya3's own cached rendering of the opening section,
the rule refuses it for exactly the leaked definition and passes it once the definition is stripped.

## shi_Yumiaoya3 read, 2026-09-17, 16:20 UTC: INCOMPLETE at publish, the opening section withdrawn with its link

Frozen `56307dca5`,
78 minutes
(`ms=4692712`),
`status=INCOMPLETE` at publish
("would drop 1 source destination(s)"),
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 178.38 to 178.17,
OpenRouter 254.80 to 254.44,
0.57 USD;
`pass-spend.mjs` logs 0.64 USD over 948 seats,
31 retry rounds,
9 abandoned streams (0.11 USD).
Class forty-eight live:
slice 13's coverage round split again with no anchored claim,
the passage was admitted,
the translate lane wrote it in 17 minutes and the consolidation settled it.
Class forty-seven live:
the archive's rendering of the farewell passed the line floor,
was offered on the consolidation slate as a lane text,
and the slate chose Qwen's doubled rendering
(both the Chinese line's translation and the English original,
the attribution twice)
over it;
the floor no longer stops the entry,
and the judges' preference for the doubled quote is a judge question still open.
Then the translate lane's assembly withdrew two replacements
(`assembly-footnote-reverted duplicate-definition gfm 1` twice),
the opening section and the definition,
class forty-nine.
glm-5.3 dark for the run (83 thrown);
Synthetic dry throughout.

## shi_Yumiaoya3 launches on classes forty-seven and forty-eight, 2026-09-17, 14:56 UTC

Frozen `56307dca5` (classes forty-one to forty-eight),
pid 3571748,
runs `~/temp/agent/shi_Yumiaoya3`,
log `~/temp/agent/shi_Yumiaoya3.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch.
Read first slice 16's farewell:
the Truman Show line and its attribution once each in English on the page,
no `LINE-STRUCTURED` refusal of the archive's rendering in the consolidation log,
and whether the slate still doubled the quote;
then slice 13 (the cameras and the will) admitted and on the page,
with an `insertion-split-unanchored` finding if its round split again;
then the four body links,
the four skeleton sections filled,
the community-term footnote,
then the seven steps and the three checks.

## Classes forty-seven and forty-eight, 2026-09-17, 14:50 UTC: a bilingual quote fails the line floor unless doubled, and a split nobody anchored drops a passage

Both found by the shi_Yumiaoya2 read.

Class forty-seven.
The original's farewell quotes a film line in Chinese with its English original beside it,
and the attribution the same way,
inside one blockquote whose lines are set off by bare `>` lines.
The line-structured floor (`compareLineCounts`) counted every non-blank line of the original,
bare markers included,
and refused any rendering carrying fewer:
ten owed,
the archive's rendering (English once) carrying seven,
the standing carrying nine.
So the only rendering that passed the floor quoted the line twice in two wordings,
which is what both translate slate candidates did;
on shi_Yumiaoya1 that doubled text shipped through the consolidation,
and on shi_Yumiaoya2 the consolidation withheld the standing and the incumbent alike
and stopped the entry (`gate-kept-standing`) at 48 minutes.
Fixed in `56307dca5`
(guard red first at `d692d5f1d`):
a line carrying only quote markers is not content,
and a Han line adjacent to an English line of the original
(a line with Latin letters and no ideograph)
is owed no line of its own,
since the English line beside it is its rendering;
the floor stays a shortfall check,
a longer rendering still passes.
Run over the entry's own slice 16,
the archive's rendering now passes the floor and a rendering that merges the two prose lines still fails.
Whether the slate still prefers the doubled quote is a judge question the floor cannot settle;
the archive's rendering is at least eligible again.

Class forty-eight.
Slice 13
(the cameras,
the skirt,
the flowers and the will)
is source-only on a skeleton archive.
Its coverage round asked two seats
(the checkers bench is three and glm-5.3 has been dark since the morning),
one voted absent,
one claimed partial coverage and quoted the Chinese passage itself,
which anchors nowhere on an English page.
A majority needs two of two,
so the verdict was `split`,
the single admission round left the passage unadmitted,
and the page shipped without it as a recorded gap
(`source-passage-unfilled (slice 13, not-corroborated)`),
on shi_Yumiaoya1 and shi_Yumiaoya2 alike.
Fixed in `56307dca5`
(guard red first at `d692d5f1d`):
a split verdict carrying no anchored claim of coverage and at least one absent vote
joins the absent rows before the whole-page shortfall corroboration,
which decides as it does for a majority;
an unanchorable claim is still no vote for absence,
and a split with an anchored claim stays unresolved.
The old split-roster fixture in `pass-insertion-admission.unit.test.ts`
quoted a sentence that occurs twenty times in its target and never anchored
(`ambiguous-quote`),
so it was the class-forty-eight shape by accident;
its quote now carries the heading and anchors,
and the test keeps its meaning.
The no-loop design's premise that an insertion is supplementary content
(its section on insertion placement in a single round)
does not hold on a skeleton archive,
where every body passage is an insertion;
this is the evidence that section asked for,
applied as the smallest change and open to veto.

## shi_Yumiaoya2 read, 2026-09-17, 14:40 UTC: INCOMPLETE at the farewell, the will's paragraph a silent gap

Frozen `cde09e8bc`,
48 minutes
(`ms=2904901`),
`status=INCOMPLETE` at slice 16
("the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship"),
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 178.66 to 178.38,
OpenRouter 255.22 to 254.81,
0.69 USD;
`pass-spend.mjs` logs 0.70 USD over 840 seats,
39 retry rounds,
13 abandoned streams (0.05 USD).
Class forty-six held:
no destination refusal.
Two dark seats (glm-5.3 76 thrown,
Qwen3.8-27B 108 thrown,
Synthetic dry the whole run).
Slice 13 unadmitted again on `coverage=split`,
recorded as a gap (class forty-eight);
slice 16's standing and incumbent both refused by the line floor (class forty-seven).
The rest of the lanes ran as on shi_Yumiaoya1.

## shi_Yumiaoya2 launches on class forty-six, 2026-09-17, 13:45 UTC

Frozen `cde09e8bc` (classes forty-one to forty-six),
pid 3531497,
runs `~/temp/agent/shi_Yumiaoya2`,
log `~/temp/agent/shi_Yumiaoya2.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch.
A fresh run,
not the launcher's re-attempt,
since shi_Yumiaoya1's caches would reproduce the same page
and the fix sits in the publish check,
not in a stage.
Read first the four body links on the page
(the film's Wikipedia page,
two profile pages,
the contributor's account)
and that the commented-out profile link is neither on the page nor refused,
then the archive's four skeleton sections filled from the original,
then the community-term footnote,
then the seven steps and the three checks.

## Class forty-six, 2026-09-17, 13:42 UTC: a link inside the original's HTML comment is a destination the page owes

Found by the shi_Yumiaoya1 read.
The original carries five body links and one more inside an HTML comment
(a profile link the author commented out).
The publish check `droppedDestinations` unions two readers:
the tree reader,
which parses the body the way the pipeline does
(front matter split,
invisible lines and HTML comments masked),
and the bare-run scanner,
which walked the raw text so that front matter and HTML attributes count.
The raw walk counted the commented-out link as a source destination;
every stage masks comments
(class five),
so no lane text carried it,
and the page was refused after 53 minutes:
"would drop 1 source destination(s)".
The error names counts only,
so the log did not say which;
the ledger showed every lane and slate candidate carrying its link,
and the check run over the original against the original with its comments stripped named the commented-out one.
Fixed in `cde09e8bc`
(guard red first at `9ba9520ab`):
the bare-run scanner reads the comment-masked text on every side,
so a link no reader can follow is owed by no page;
front matter and HTML attributes still count.
Run over shi_Yumiaoya's original against the same text with its comments stripped,
the fixed check drops nothing,
and drops the contributor's link when that is removed
(the positive control).

## shi_Yumiaoya1 read, 2026-09-17, 13:40 UTC: INCOMPLETE at publish over a commented-out link, the lanes' page whole

Frozen `978bd7d20`,
53 minutes
(`ms=3197795`),
`status=INCOMPLETE`,
no page written,
`attempts.json` reads 1.
Spend by the meters:
Bedrock 178.91 to 178.66,
OpenRouter 255.65 to 255.23,
0.67 USD,
plus Synthetic
(wet at launch,
dry by the end);
`pass-spend.mjs` logs 0.72 USD over 923 seats,
37 retry rounds,
5 abandoned streams (0.07 USD).
The entry's archive is a skeleton:
the banner,
four headings,
the translator's own HTML comments
(camera and car names,
a note that 小药娘 needs no translation),
the closing Truman Show quote and the credit line,
against an original of 138 lines.
So eighteen slices,
of which the lanes translated the whole body:
the repair lane exited `no-translation` on every source-only slice,
the translate lane wrote them,
the contest chose translate on eleven of fourteen differing slices,
repair on the banner and one heading
("About Yumiao's Passing" over the archive's "Departure",
three of four for 离世 saying she died),
neither once.
Insertion admission read four source-only slices as `coverage=absent`
with their links counted as missing from the archive,
which is the healthy reading of a skeleton,
and left slice 13 unadmitted on a split verdict
(to be read on shi_Yumiaoya2).
The consolidation declined on both linked paragraphs
(every candidate carried the link;
the slates could not agree on wording,
one minimax ballot refusing all four for naming the sedative against the reader-protection rule),
so the lane texts stood.
Every lane and slate candidate carried its link;
what the page lacked was the commented-out one,
class forty-six.
The attestation bought the film's Wikipedia page (2,230 characters) and answered nothing on it
(`ATTESTED heard=6 answered=0`).
glm-5.3 dark for the run (76 calls thrown,
no wet provider);
Kimi-K3 withheld.

## shi_Yumiaoya1 launches, 2026-09-17, 12:42 UTC

Frozen `978bd7d20` (unchanged since hulicaijia7),
pid 3508311,
runs `~/temp/agent/shi_Yumiaoya1`,
log `~/temp/agent/shi_Yumiaoya1.log`,
Synthetic,
Bedrock and OpenRouter wet,
Hyper dry.
The queue's second entry after Mio,
on the hulicaijia7 page reading clean.
The original has four level-2 headings,
one footnote defining a community term,
and a picture component;
the archive is 54 lines against the original's 138,
so read first how much of the original the archive renders
(the lanes' slice count and any `declined` line),
then the footnote,
then the seven steps and the three checks.
The attestation bought its one cited reference and answered nothing on it
(`ATTESTED heard=6 answered=0`),
the same shape as hulicaijia's government page.

## hulicaijia7 read, 2026-09-17, 12:50 UTC: the page is whole, the headings distinct, nothing restored

Frozen `978bd7d20`,
SETTLED on the first attempt
(`attempts.json` reads 1),
150 minutes
(`ms=8977922`),
72 slices,
page changed on 36,
selection contested.
Spend by the meters:
Bedrock 180.82 to 178.91,
OpenRouter 258.16 to 255.66,
4.41 USD;
`pass-spend.mjs` logs 4.47 USD over 4,694 seats,
146 retry rounds,
20 abandoned streams (0.16 USD).
Synthetic came back wet during the run (weekly 1.12 percent at the end).

Class forty-five,
the reason for the relaunch:
the page carries thirteen level-2 headings for the original's thirteen,
all distinct,
and the artifact's `pageAssembly` is empty
(nothing trimmed,
withdrawn or restored).
The lanes rendered 初识 as `First Meeting` and 相遇 as `The Encounter`
where hulicaijia6 had rendered 相遇 as the archive's `Meeting`,
so the collision never arose and the restoration is still unmeasured live;
the unit guard remains its only evidence.
Four headings differ from the archive:
初识 `Meeting` to `First Meeting`,
相遇 `Soulmate` to `The Encounter`,
左右 `Conflict` to `Left and Right`,
长夜 `Insomnia` to `The Long Night`.
On 左右 the consolidation slate chose the literal three of three,
mercury writing that `Conflict` "substitutes an interpretation not explicit in the original";
the archive's interpretive headings lose to literal renderings whenever the slate reads them,
which is the heading-wording note already open,
now with a fourth example.

The three shapes no read page had met:
the inline ruby annotation
(`<ruby>コネクト<rt>Connect</rt></ruby>` in the original)
is rendered by the archive as `*Connect*` and the page keeps the archive's line byte for byte,
so the shape never reached a lane;
the Sakura component ships as the archive has it,
the last line of the page;
the footnotes are the original's eight,
relabelled in order
(class nineteen),
every marker in place.
The archive carried ten notes;
its two translator-added notes are gone from the page:
the Naixue rename note
(the note reads Formerly Nayuki,
renamed Naìsnow in 2025;
the marker on At Naixue dropped with it)
and the goodnight-amantadine homophone gloss,
whose place the original's own note takes
(which reads That is,
the amantadine mentioned earlier).
Both are additions with no counterpart in the original and no cited reference,
so the standing rule drops them;
recorded here because the homophone gloss is what made the quoted line readable in English,
and a reader of the page now meets "the hallucinations from goodnight" with only the pointer.
Any reversal of that is the owner's call
(a translator's gloss as a kind of note the review keeps),
not a class.

The seven steps and the three checks:
front matter equals the archive byte for byte
(`FRONT MATTER ... authority=archive`);
47 `json false start` lines,
all read past
(gpt-oss-120b's two-character opening,
mercury's 36);
no `finish_reason=error`;
four cap cuts
(`finish_reason=length`,
one each in archive-block-review select,
translate-repair GLM-5.3-Flash,
consolidate-gate gemma-26b and slate select gpt-oss),
none fatal;
no `carries the sheet's own` refusal
(class forty-four's second live pass with nothing to catch);
no Chinese punctuation,
no CJK run,
no refusal text,
no code fence on the page;
apostrophes curly (94 against the archive's 100),
straight double quotes 14 against the archive's 14,
all inside `<p style="text-align: center;">` captions;
three-dot ellipses 27 against 27.
The reader's note at the top now says "drug abuse" where the archive said "drug overdose"
(the original's 滥用;
a slate ballot names the distinction).
Paragraphs:
137 on the page against the archive's 138,
97 identical to an archive paragraph,
the rest rewrapped one clause per line or reworded.
Seats:
glm-5.3 dark for the whole run
(326 calls thrown,
no provider serving it wet;
the SEATS DARK line says so),
Kimi-K3 withheld as always;
GLM-5.3-Flash on OpenRouter ran to the 360 s cut twice
(2.6 M raw characters once),
the runaway noted on Mio26.
The attestation bought nothing (the cq.gov.cn page cached from hulicaijia6) and answered nothing twice,
as on hulicaijia6.

## hulicaijia7 launches on class forty-five, 2026-09-17, 10:10 UTC

Frozen `978bd7d20` (classes forty-one to forty-five),
pid 3491560,
runs `~/temp/agent/hulicaijia7`,
log `~/temp/agent/hulicaijia7.log`,
Bedrock and OpenRouter wet,
Synthetic and Hyper dry at launch
(the launch log names glm-5.3 and Qwen3.8-27B with no provider on the attestation).
Read first the class forty-five finding in the page assembly's findings
(`repeats another section's heading` in the log or the artifact's `pageAssembly`)
and the thirteen headings on the page,
then the three shapes no read page has met
(the inline ruby annotation,
the Sakura component and the footnote),
then any `carries the sheet's own` refusal,
then the `ATTESTED` lines,
then the seven steps and the three checks.

## Class forty-five, 2026-09-17, 10:05 UTC: a lane renders one section under another section's heading and the page dies at publish

Found by the hulicaijia6 read.
The entry has thirteen level-2 headings,
and the archive renders every one distinctly
(初识 as `## Meeting`,
相遇 as `## Soulmate`,
among them).
The repair lane rendered slice 8's 相遇 as `## Meeting`,
which is a fair rendering of the word and the archive's heading for 初识 two sections earlier;
every slice floor passed it,
since a slice holds one heading and nothing in a slice's evidence names another section's;
the consolidation wrote from it;
and the publish guard
(`assertHeadingsStayDistinct`,
built for the twenty-third hakureico read)
refused the page after 205 minutes:
"would render 13 distinct source heading(s) as 12 distinct page heading(s)".
The launcher's re-attempt resumed the same cached slice texts and would have died the same way,
so it was killed at 09:54 UTC.
The fault is the place of the check,
not the check:
the one stage that sees every heading the page would carry sat after the last decision.
Fixed in `978bd7d20`
(guard red first at `b6bfd2b96`,
the commit before it):
`restoreCollidingHeadings` (`corpus-run/heading-collision-restore.ts`)
runs inside `guardPageAssembly`,
which now takes the original's text.
It reads the headings the page would carry slice by slice
(the replacement where one ships,
the archive's text where none does),
and where the original and the archive have the same number of headings,
a page heading repeats another section's,
the original's two headings differ,
and the page's rendering is not the archive's at that position,
it puts the archive's heading back into that slice's text.
The restored slice is recorded as a page assembly override
(the same `trimmed` row a footnote trim writes;
`would-ship-text.ts` reads it as the page's wording,
`decidedBy: page-assembly`)
with a finding naming both headings.
Measured at pin `a41fc607` no archive renders two distinct source headings identically,
so the archive's rendering is always a distinct fallback;
the publish guard keeps the last word for a page the restoration cannot mend
(a page carrying fewer headings than the original,
which the block floor owns).
A restoration that returns a slice to the archive's exact wording is left out of the footnote guard's input,
whose invariant refuses an unchanged replacement,
and still rides the override.

## hulicaijia6 read, 2026-09-17, 09:54 UTC: ERROR at publish, thirteen headings rendered as twelve

Frozen `0986c871f`,
205 minutes to the TALLY
(`ms=12288953`),
`status=ERROR`,
no page written
(`fixed/` empty;
`attempts.json` reads 2,
the re-attempt killed by pid at 09:54 UTC before it could resume the same texts).
Spend by `pass-spend.mjs`:
3.71 USD logged,
5,312 seats asked,
137 retry rounds,
19 abandoned OpenRouter streams (0.14 USD);
Bedrock 1.92 (gemma-26b 650 calls,
gemma-e2b 610,
gpt-oss-120b 524),
OpenRouter 1.64 (deepseek-v4.1-flash 463 calls with 1.7 M cached prompt tokens,
mercury 569,
minimax 449),
Hyper 680 calls at no meter,
Synthetic dry by the end.
Meters at the kill:
Bedrock 180.83 USD,
OpenRouter 258.20 USD.
What the log says before the error:
the attestation bought the one cited reference
(cq.gov.cn,
2,525 characters)
and answered nothing on it twice
(`ATTESTED heard=5 answered=0 verified=0 needed=3`),
which is the healthy reading of a government page cited for a date;
72 slices translated with no `carries the sheet's own` refusal
(class forty-four's first live measurement:
zero of the pass's candidates carried a label);
the 长夜 heading was argued at length by the slate judges
("Long Night" against "The Long Night")
and stayed distinct.
The ruby annotation,
the Sakura component and the footnote were never read,
since no page was written;
hulicaijia7 reads them.
The heading collision is class forty-five,
recorded under its own heading.

## hulicaijia6 launches on class forty-four, 2026-09-17, 06:15 UTC

Frozen `0986c871f` (classes forty-one to forty-four),
pid 3369011,
runs `~/temp/agent/hulicaijia6-20260917`,
log `~/temp/agent/hulicaijia6-20260917.log`,
Synthetic back wet since 05:30 UTC,
Hyper dry,
Bedrock and OpenRouter wet.
The queue resumes here on the Mio27 page reading clean.
Read first the three shapes no read page has met:
the inline ruby annotation,
the Sakura component and the footnote;
then any `carries the sheet's own` refusal in the translate log
(class forty-four's first live measurement),
then the `ATTESTED` lines
(hulicaijia cites pages or it does not;
`REFERENCE` lines in the preparation say which),
then the seven steps and the three checks.

## Class forty-four, 2026-09-17, 06:10 UTC: the writers copy the sheet's picture transcript into their candidates

Found by the Mio27 read.
Of the pass's 68 translate slate candidates,
four carried the writer sheet's own `WHAT THE PICTURES HERE SAY` block,
copied under the picture component with the readers' transcript inside,
and both slices that had one chose it:
slice 11 (photo4 and the rule) three of four candidates carried it and the judges chose one three of four,
gpt-oss-120b for "the full PhotoScroll component,
the heading,
and all transcribed text exactly as in the ORIGINAL",
deepseek and gemma-26b alike,
minimax abstaining because a candidate "changes the original heading";
slice 17 (the poem,
unpaired this time) one of four carried it,
the judges chose it,
the contest chose translate five of five without a ballot naming the block,
and the consolidation replaced it three of five because the standing was "10.9x" the original,
not because anyone named the block.
The judge sheet labels the transcript
"WHAT THE PICTURES HERE SAY,
transcribed by two readers that agreed",
which the judges read as a heading of the original.
The deterministic rule had no opinion:
a candidate carrying the sheet's evidence was as valid as one without.
Fixed in `0986c871f`
(guard red first at `d138f456b`):
`sheetLeakFindings` refuses a candidate carrying any of the sheets' fence labels
(`WHAT THE PICTURES HERE SAY`,
`EXISTING TRANSLATION`,
`ATTESTED DETAILS`,
`DECLARED NAMES`,
`CITED REFERENCES`,
`LATEST REJECTION`,
`ARCHIVE RENDERING`) that neither the original nor the page carries,
before any shape is read,
so such a candidate never reaches a judge;
run on Mio27's two chosen lane texts it refuses both.
The page was clean because slice 11's contest settled neither with the archive endorsed
and slice 17's consolidation wrote its own text.

## Mio27 read, 2026-09-17, 06:05 UTC: the sister clause ships end to end, the poem keeps its five breaks

`TALLY Mio status=SETTLED slices=18` in 116.9 minutes,
one attempt
(`attempts.json` reads 1).
The pairing gave 18 slices this time and left the poem unpaired
(slice 17,
incumbent empty),
where Mio25's pairing had set the farewell paragraph against it.

The attestation
(class forty-three's first pass):
`ATTESTED heard=5 answered=7 verified=6 needed=3 details=1` after
`ATTESTED CONFIRM heard=5 candidates=2 needed=3 confirmed=1`.
Four voices extracted the sister
(minimax-m3,
gemma-4-26b-a4b,
gpt-oss-120b,
mercury-2.5),
the confirmation ratified it five of five,
and minimax's other candidate,
pairing "she became a gentle big sister to many people" with the reference's sentence on Mio's sister,
was confirmed by one voice and dropped.
So the confirmation ratified rather than rescued;
its rescue path is still unmeasured on a live entry.

Slice 2.
The repair lane kept the sister clause and wrote
"With her brilliant mind and clever hands,
she was studying at a local 985 (one of China's elite universities)"
with an em dash before the gloss;
the translate lane dropped the clause.
The contest chose repair five of six,
four ballots naming the attestation
("keeps the attested archive detail that Mio's older sister is also trans"),
one ballot for translate on the class thirty-seven reading
("while attested in the references,
is not in the provided Chinese original").
The consolidation gate split two consolidated,
two standing,
one neither
("both candidates add the unsupported detail"),
so the standing repair text stood
(`gate-kept-standing`).
The polish
(class forty-one's first pass):
deepseek-v4.1-flash's proposal changed "handles everything at home" to "homemaker" and "clever hands" to
"deft hands",
kept the clause,
and the polish gate chose it five of five,
two ballots saying so in words
("retain the attested sister detail").
The page's line 20 reads "She has an older sister who is also trans.",
the first Mio page to carry the clause through every stage since class thirty-five was found.
The naturalness review's one finding on the clause
("'also' lacks an antecedent") is recorded as evidence.

Slice 17,
the poem:
the translate lane wrote it with five `<br/>` breaks,
the title as "Lamenting Autumn",
the credit as `——[Xiao Chui](https://space.bilibili.com/246513889)`;
the contest chose translate five of five
(the repair lane was empty,
the poem being unpaired);
the consolidation wrote its own rendering
("a final sigh of regret",
"created for Mio") and the gate chose it three of five;
the page ends `May you rest in peace, Mio.`,
a blank line,
then the poem as a blockquote with five `<br/>` and the link.
Class forty-two's substitute floor was not exercised
(no page block stood against the poem);
the source-only floor held as before.
No `repeats the ORIGINAL untranslated` refusal fired.
Class forty fired once:
slice 4's contest tied three to three and settled neither,
the standing was the archive's paragraph,
the repair lane's text was offered on the slate,
the slate declined it,
and the archive's wording shipped.

The first chat block ships with the archive's translation,
its `Translation:` label and its speakers;
"masculine" corrected;
0 straight double quotes,
31 curly apostrophes against the archive's 29.
The opening quote is the archive's own line
("Does my name mean 澪,
you ask?"),
which Mio25 had rewritten.
The three checks:
front matter equals the archive's,
one `json false start` kept,
no `finish_reason=error`,
no `InStreamProviderError`.
The seven checks against Mio12:
澪 kept in the archive's own sentence;
the coming-out paragraph and its three bullets as the archive has them
(no prose duplication this time);
the university as "a local 985 (one of China's elite universities)" with the dash;
SRS unexpanded;
the `Translation:` label;
"masculine";
the poem with five breaks and the credit line under the farewell.
Wording notes,
not fixed:
"## Found a Best Friend" in title case;
"Beiyan Yunyi" where Mio25 wrote "Bei Yan Yun Yi";
the dash in the 985 gloss.

Spend:
1,314 seats asked,
46 retry rounds,
1,202 SPEND lines,
26 abandoned streams at 0.07 USD;
Bedrock 183.06 to 182.74,
OpenRouter 260.63 to 259.92 against 0.99 logged
(the meter moved less than the log),
1.03 USD in all.
Synthetic came back wet at 05:30 UTC
(weekly 0.14 percent),
so the Kimi,
Qwen and GLM seats were reachable for the lanes and the contest.

## Mio27 launches on class forty-three, 2026-09-17, 04:07 UTC

Frozen `f7aa7c675` (classes forty-one,
forty-two and forty-three),
pid 3011126,
runs `~/temp/agent/Mio27-20260917`,
log `~/temp/agent/Mio27-20260917.log`,
Synthetic and Hyper dry,
Bedrock and OpenRouter wet.
Read first the `ATTESTED CONFIRM heard=H candidates=C needed=N confirmed=K` line
and the `ATTESTED` line after it
(the sister should be attested whenever one voice extracts it and the bench confirms it),
then the Mio26 reading order:
slice 2's polish,
the page's sentence on the sister,
slice 16's hard breaks,
any untranslated refusal,
`attempts.json`,
then the Mio25 reading.

## Mio26 killed at 04:07 UTC in its pictures phase

Under ALWAYS KILL AND RELAUNCH once `f7aa7c675` landed;
42 minutes in,
still reading pictures,
no contest run.
Its attestation is class forty-three's evidence and is recorded there;
nothing else of it was read.

## Class forty-three, 2026-09-17, 04:00 UTC: the attestation's open question is answered empty by voices that never looked

Mio26's attestation printed `ATTESTED heard=5 answered=2 verified=1 needed=3 details=0`.
The replies,
read back from the payload cache:
minimax-m3 `{"attested":[]}` in 6 completion tokens,
gemma-4-e2b the same in 6,
gpt-oss-120b the same in 666,
mercury-2.5 the same in 2,416,
gemma-4-26b-a4b the sister with both quotes verifying
(plus one item on the QQ group that did not verify),
deepseek-v4.1-flash cut by its completion cap at 13,082 tokens with no content
(`finish_reason=length`,
voice lost),
GLM-5.3-Flash abandoned after 866,605 delivered characters,
Qwen and glm-5.3 unreachable with Synthetic dry.
One verified voice against a quorum of three,
on the same bench that attested the sister five of six on Mio25,
four of five on Mio24 and five of six on Mio23:
the open question ("list every detail...") is one a cheap voice answers in six tokens without reading,
and an empty list is not a vote that the detail is false.
Fixed in `f7aa7c675`
(guard red first at `b41ff966c`):
extraction proposes and confirmation disposes.
Every verified detail,
one voice or more,
goes back to the same bench as a numbered candidate carrying its archive quote and its reference quote
(`buildReferenceAttestConfirmMessages` in `reference-attest-confirm-wire.ts`),
each voice answers `{"confirmed":[n,...]}`,
and a candidate confirmed by at least half the confirming voices is attested with the confirmation's counts
(`confirmedDetails`).
No candidate means no second round;
a confirmation nobody answers leaves the extraction quorum standing.
The log prints `ATTESTED CONFIRM heard=H candidates=C needed=N confirmed=K` before the `ATTESTED` line,
and the findings carry
`reference attestation confirmed K of C candidates by H voices`.
Not fixed here:
deepseek's cap cut and GLM-5.3-Flash's runaway on a 5,000-token sheet,
which the confirmation's shorter question may or may not repeat;
Mio27 measures it.
