# Translation repair: OpenRouter as the paid fallback provider, part 11

Part 11 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## Mio16 read, 2026-09-16, 09:42 UTC: settled, the chat's speakers swapped, class thirty-three

Frozen `8d058d102`,
160 minutes,
`TALLY Mio status=SETTLED slices=17 translateStatus=complete pageChanged=11 selection=contested`,
no interruption,
no INCOMPLETE,
no hold,
no payment refusal.
Page 9107 bytes against Mio12's 8867,
0 straight apostrophes in words,
33 curly,
26 curly double quotes,
1 CJK run (the 澪 the archive keeps in the opening quote),
2 `Translation:` labels (the archive's two,
Mio12 had lost the first),
front matter equal to the archive's.
Spend:
Bedrock 185.25 to 185.15 USD,
OpenRouter 267.02 to 266.97 USD,
Hyper 231 (the daily reset at 07:31 UTC) to 0,
Synthetic weekly 73.7 to 69.9 percent.

### Slice 14 and class thirty-two

The pairing did not set the poem's quote against the farewell paragraph this time:
slice 14 was cut the Mio12 way,
the poem inside the region with the second chat translation,
and no `no block of its kind` finding fired anywhere.
Class thirty-two stays verified by its unit cases only;
the page ships the farewell followed by the poem's quote with its five breaks
because the slice carried both as the page stood.

### The seven checks against Mio12

- The 澪 versus Mio opening:
  the page keeps 澪 (`澪? Not really.`) as the archive does;
  Mio12 had written "Mio?".
- The coming-out bullets:
  the archive's three bullets ship as the page stands,
  and the source sentence "曾在春の芽工作室 QQ 群担任管理员，还曾：" now also ships as prose before them,
  so the paragraph says she administered the group and the third bullet says she started to manage it;
  a redundancy,
  not a defect class,
  and the bullet's "Harunome Hanbai" is the archive's own rendering of 工作室.
- The university wording:
  `a local 985 university, one of China's top universities`.
- The SRS expansion:
  "SRS (sex reassignment surgery)".
- The first chat's `Translation:` label:
  restored.
- The "musculine" typo the reviewers named on Mio12:
  corrected to "masculine".
- The poem:
  five breaks,
  the credit line carried,
  under `May you rest in peace, Mio.`

### The first chat block: class thirty-three

The archive block review (5 heard,
7 answered unreadably of 12,
the one-transcript sheet) revised the archive's chat translation,
and the revision swaps the opening speakers.
The page reads `Me: Are you there? / Mio: I'm here.`
The picture (`photo6.webp`) shows the grey left bubble sending 在嘛 and the green right bubble answering 在的,
so Mio opened and the friend answered,
which is what the archive's human translation had
(`Mio: Do you have a moment right now? / Me: Sure.`).
The transcript in the sheet is bare lines
("在嘛 / 在的 / 我其实想问一下你是不是 mtf"),
with no side and no sticker,
so the judges guessed:
Kimi-K3 wrote "Bei Yan Yun Yi opening with 在嘛 (Mio answers 在的)" and Qwen3.8-27B "restores the correct speaker order".
The sticker Mio sent first is gone the same way:
not a word,
so never transcribed.
Two smaller slips in the same block:
"posting about SRS" where the picture says 搜过 (searched),
and "(sticker)" where the friend sent a screenshot of the post.

The fix (`170b6b40c`,
red guard `605e66228`,
wording measured in `ffd35334a`):
`READING_INSTRUCTION` asks the readers to begin every chat message with `[left]` or `[right]`
for the side its bubble is attached to,
judged by colour,
tail and the edge it hugs,
and to write `[sticker]` or `[image]` where a message is a picture;
`slicePictures` leads a side-marked context with one legend line
("[right] marks messages sent from the phone that took the screenshot and [left] the other party's").
The corroboration share is 0.3,
so the markers cannot break reader agreement.
Measured on `photo6.webp` and `photo7.webp` with the six seated readers
(`~/temp/agent/probe-sides-33-20260916.log` and `probe-sides-33-r2-20260916.log`):
under the first wording ("the side its bubble sits on") all six sided photo6 right but two of six sided photo7's wide green bubbles left,
because their text starts at the left edge;
under the landed wording photo6 reads right on six of six and photo7 on five of six,
gemma-4-26b-a4b siding everything left on photo7 both times.
The most-carried transcript therefore sides the chat the way the picture does.

## Mio17 launches on class thirty-three, 2026-09-16, 10:05 UTC

Frozen `ffd35334a`,
pass pid `1197118`,
runs `~/temp/agent/Mio17-20260916`,
log `~/temp/agent/Mio17-20260916.log`.
Meters at launch:
Synthetic 69.7 percent,
Hyper 0 (dry until the 07:31 UTC reset),
Bedrock 185.14 USD,
OpenRouter 266.93 USD.
Read the first chat block first:
whether the transcript in the archive-block-review sheet carries the side markers and the legend,
and whether the page has Mio opening (`Are you there?` or the archive's `Do you have a moment right now?`) and the friend answering;
then the seven checks against Mio12 as before.

## Mio17 read, 2026-09-16, 13:29 UTC: class thirty-three held, INCOMPLETE at slice 16, class thirty-four

Frozen `ffd35334a`,
203 minutes,
`TALLY Mio status=INCOMPLETE` at slice 16:
`the standing text failed the deterministic publication rule and the consolidation left nothing valid to ship (gate-kept-standing)`.
No page.
Spend:
Bedrock 185.14 to 185.05 USD,
OpenRouter 266.93 to 265.10 USD (Hyper dry all day,
so its seats bought on OpenRouter),
Synthetic weekly 69.7 to 65.8 percent.
Preparation took 61 minutes against Mio16's 37:
the archive block review ran 16 rounds where Mio16 ran 6.

### Class thirty-three held

The archive-block-review sheet carried the legend and the side-marked transcript
(a lane candidate that echoed the sheet is in the reply cache:
`[left] Are you there / [right] I'm here / [right] I actually wanted to ask — are you mtf`).
The first chat block's review heard 7 of 12 (5 usable),
and the winning revision (candidate 5,
weight 2 across 7 ballots) opens
`Mio: (Sticker) / Mio: Are you there? / Me: Yes. / Me: I actually wanted to ask, are you mtf?`,
Kimi-K3 naming `correct speaker flow for the opening exchange`,
minimax-m3 `preserves the correct speaker order (Bei Yan Yun Yi is Me), keeps the Sticker line`.
The speakers are the picture's,
the sticker is back.

### Slice 16: class thirty-four

Slice 16 is the poem alone (132 source characters,
one blockquote).
The pairing (both rounds,
6 usable voices) set the archive's second chat translation,
the blockquote rendering `photo3.webp`,
against the poem's blockquote,
so the PAGE AS IT STANDS for the slice was that chat quote and the floor's ceiling was one blockquote
(same kind,
so class thirty-two's allowance does not apply).
The lane winner rendered chat and poem (two blockquotes) and failed the floor;
consolidation withheld that standing;
the slate's winner was the poem alone (candidate 4,
weight 2.5 of 6),
which drops the chat translation;
the incumbent (chat alone) fails the link rule (the poem's bilibili link);
the consolidate gate settled on the withheld standing,
and the rule of 2026-09-09 stopped the entry.
Every outcome was wrong because the pair was wrong:
the chat quote translates a picture,
not the poem.

The pairing sheet had no way to know:
it shows the two block lists and nothing about the pictures,
and the judges pair by position when the kinds match.
Measured over the corpus,
2 of the 49 pages with pictures label a picture translation
(`Translation:`,
`Translation of the above photos:`,
`Translation of the above suicide note:`),
so a label rule would not carry.
The fix (`e964d2f3a`,
red guards `d7e514742`):
the pairing sheet carries WHAT THE PICTURES HERE SAY,
one most-carried transcript per picture rendered the way every other sheet has it,
with the rule that a translation block rendering what a picture says translates THE PICTURE and is left out
even where an original block stands in the same place;
the pairing cache key folds the picture context in after a second separator
(bare keys keep their golden bytes);
`pass-prepare` reads the pictures before deciding which archive blocks are unclaimed,
pairs again with them in the sheets,
runs the archive block review on that pairing,
and pairs the corrected archive with them too.
A source naming no picture reads nothing and seats nobody for it
(the six-seat-readings guard in `pass-entry.unit.test.ts` holds).
Cost:
one more pairing round per entry with pictures,
cached per section by the sighted key.

## Mio18 launches on class thirty-four, 2026-09-16, 13:52 UTC

Frozen `e964d2f3a`,
pass pid `1260175`,
runs `~/temp/agent/Mio18-20260916`,
log `~/temp/agent/Mio18-20260916.log`.
Meters at launch:
Synthetic 65.8 percent,
Hyper 0 (dry until the 07:31 UTC reset),
Bedrock 185.05 USD,
OpenRouter 265.08 USD.
Read the pairing first:
grep `pairs with` for the sighted rounds and `paired .* translation blocks` for the last section
(Mio17 paired 14 of 19;
the chat quotes and their `Translation:` labels should now be unpaired),
then slice 16 (chat quote and poem both on the page,
no `gate-kept-standing`),
then the first chat block's speakers,
then the seven checks against Mio12.

## Mio19 read, 2026-09-16, 16:05 UTC: settled, class thirty-four held, the page reads clean

Frozen `a88f52d5b`,
100 minutes (Mio16 took 160,
Mio17 203),
`TALLY Mio status=SETTLED slices=17 repairIssues=109 repairAccepted=80 repairResolved=79 pageChanged=11 alignmentFindings=6 selection=contested`,
no interruption,
no INCOMPLETE,
no hold,
no payment refusal,
no `gate-kept-standing`.
Page 296 lines against the archive's 235,
0 straight apostrophes in words,
32 curly,
18 curly double quotes (the archive 20),
4 unicode ellipses (the archive 4),
2 CJK runs (the 澪 the archive keeps in the opening quote,
and the reference link's title,
read under wording),
2 `Translation:` labels,
front matter equal to the archive's byte for byte.
Spend:
OpenRouter 265.00 to 264.76 USD (0.34 logged,
13 streams abandoned for 0.02),
Bedrock 185.05 to 184.95 USD,
Synthetic weekly 65.5 to 60.7 percent,
Hyper dry all day.
1,244 seats asked;
21 cap cuts (Mio16 17,
Mio17 54),
every one a `finish_reason=length` with empty content on a Synthetic reasoning seat,
read as a voice lost.

### The pairing: class thirty-four held

The sighted rounds carried 640 characters of picture transcript for section 1 (`photo6`,
`photo7`) and 1346 for section 2 (the tweets and `photo3`).
Section 1 paired 3 of 3 original and 3 of 5 translation blocks:
the `Translation:` label and the first chat quote unpaired.
Section 2 paired 12 of 13 original and 12 of 19 translation blocks
(Mio17 blind:
13 of 13 and 14 of 19).
The unpaired translation blocks are the archive's `And therefore:` line,
both picture labels,
the tweet quote,
the second chat quote,
the archive's second horizontal rule and the farewell;
the unpaired original is the poem,
which the archive never translated
(`preparation.blockPairing` in `artifacts/Mio.json`).
The chat quote no longer claims the poem.

### Slice 16

The page carries the archive's second chat translation
(its label and quote,
the archive's bytes re-wrapped at semantic boundaries,
rendering unchanged),
the farewell and the poem's quote with its five breaks and credit line,
in that order.
`slice 16: coverage=absent, missingDestinations=1` is the poem's insertion admission,
the line Mio16 printed too.

### The first chat block: class thirty-three held

One archive block review (5 of 6 heard,
`glm-5.3` unreachable),
no `answered unreadably`,
no `left the block unresolved`
(Mio16:
7 of 12 unreadable).
The winner (Kimi-K3's candidate 2,
weight 2 across 6 ballots) keeps the archive's dialogue as it stands and corrects `musculine` and `Wechat`;
the page opens `Mio: (Sticker) / Mio: Do you have a moment right now? / Me (...): Sure.`
The naturalness reviews of the retained block read unacceptable twice (6 of 10 and 5 of 10 usable);
by `archive-block-naturalness.ts` verdicts are evidence and never withhold,
so the block shipped with the findings recorded.

### Slice 14

`translate slice 14: holding 1916 characters of target-only English out of translation, judging 124 of 2042`,
no `no block of its kind` finding;
class thirty-two not exercised,
as on Mio16.

### The seven checks against Mio12

- The 澪 opening:
  the archive's block byte for byte
  (Mio16 had rewritten it).
- The coming-out bullets:
  three ship,
  the third now `She served as an administrator of the QQ group *Harunome Hanbai*` (the source's 担任管理员),
  and the prose no longer repeats it
  (Mio16's redundancy is gone).
- The university:
  `a local 985 (one of China's elite Project 985 universities)`.
- SRS:
  bare,
  as the source has it
  (the Mio12 read called the expansion unnecessary).
- The first chat's `Translation:` label:
  present.
- `musculine` and `Wechat`:
  corrected in the review's revision.
- The poem:
  five breaks,
  the credit carried,
  under the farewell.

### The three checks

Front matter equal;
no `json false start` line;
every `schema-mismatch` is a `finish_reason=length` cut with empty raw text
except one Mercury reply that stopped on malformed JSON at position 130
(one opening brace,
a voice lost);
no `finish_reason=error`,
no `InStreamProviderError`.

### Read under wording, not fixed

- The reference link's text keeps the source's Chinese title with an English gloss,
  `[北雁云依的博客・怀念 Mio (Beiyan Yunyi's Blog: In Memory of Mio)]`,
  from the repair lane's editor on chunk 12,
  where Mio12 and Mio16 translated it;
  the judges kept it through consolidation.
- The body's horizontal rule ships as `--- ` with one trailing space,
  from a translator's slate for slice 15 and carried through the consolidation polish.
  A thematic break renders the same,
  and content lines keep their trailing spaces by the 2026-09-02 rule (two are a hard break),
  so nothing trims one;
  fourteen other shipped pages under `~/temp/agent` carry trailing whitespace on a content line.
- The IQ quote's source hard break (`嘿嘿~` followed by two spaces) is not on the page,
  so the attribution shares the rendered line with the quote.
  The archive's own rendering has no break either,
  the explicit-break floor of class twenty-nine reads only where the original alone sets the floor,
  and the either-rendering decision admits the page's shape.
- The repair lane shipped slice 3 with the IQ quote nested one level deeper (`> > My IQ is 130`);
  the lane contest chose the translate lane's single-level quote,
  so the page is right.
  Whether the block floor reads a blockquote's depth is unmeasured.
- The archive's `She has an older sister who is also trans` lost `who is also trans` to the repair lane's editor;
  the source says 有一个姐姐 and nothing more,
  so this is source authority as decided,
  noted because it drops a fact the human translator added.

No defect class.
That closes the Mio reading owed for a horizontal rule in the body and a bare URL.

## hulicaijia5 launches on the tip, 2026-09-16, 15:58 UTC

Frozen `1cfd9d2fe` (code tip `099b69787`,
the model-card refactor,
value-identical to `a88f52d5b`),
pass pid `1470018`,
runs `~/temp/agent/hulicaijia5-20260916`,
log `~/temp/agent/hulicaijia5-20260916.log`.
Meters at launch:
Synthetic 62.7 percent,
Hyper 0 (dry until the 07:31 UTC reset),
Bedrock 184.95 USD,
OpenRouter 264.76 USD.
Read first the three shapes no read page has met:
the inline ruby annotation,
the Sakura component and the footnote;
then the archive block review
(its 2026-09-09 INCOMPLETE was class twenty-six),
then the seven steps and the three checks.

## Class thirty-five, 2026-09-16, 16:43 UTC: the sheets delete accurate detail the translator took from a cited page

The owner asked about the Mio19 wording note
("The archive's 'older sister who is also trans' lost the clause on source authority"):
"It is true though?
And the Chinese source does imply that,
if I remember correctly?"
Measured:
the Chinese page says 有一个姐姐 in all seven of its revisions
(`git log --follow` on the corpus),
the English clause arrived in the translation commit `c7cc3259`,
and the blog the page cites
(`stblog.penclub.club/posts/InMemoryOfMio/`,
fetched from its archived copy)
says 「Mio 的姐姐也是 MtF。她大我们八岁，在小学五年级时就第一次穿了女装」.
True,
and stated only by the reference.

Four critics filed the clause as `accuracy/addition` on absence alone
("not present in the source text"),
the panel supported all four,
the editor deleted it,
against the rule both sheets already carry
(the critic sheet:
accurate detail a translator added is not an addition,
report it only when wrong;
the adjudication sheet:
vote unsupported on a claim whose whole case is that the ORIGINAL does not carry it).
Measured over the repair lane's shipped addition edits:
Mio19 20 of 24,
Mio16 14 of 24,
Mio12 9 of 22,
hakureico23 11 of 12,
noname3 7 of 9;
among Mio19's twenty the sister,
the backpacks in `photo5`,
"no one was hurt",
"in mainland China",
"lucky" and the closing farewell.

Four options put to the owner
(only what the source contradicts;
facts stand and wording may go;
feed the cited reference to the critics;
keep source-only authority),
ranked A > C > D > B.
The owner chose the third:
"3,
and we have Exa.
Such Exa fetched results need to be cached too to avoid hitting reference links too much",
and while it was built:
"Cache Exa results semi-permanently on disk since the reference links rarely change their content."
Recorded in
[the cited-references decision](../decision/translation-repair-cited-references-2026-09-16.md).

The fix (`dff8c91d2`):
every link the original writes
(its own site and people's profiles left out,
at most eight)
is bought once through the Exa contents endpoint
(4,000 characters of page text)
into `~/.cache/translation-repair/lookup/reference/`,
keyed by the url's digest and never expiring,
and a `CITED REFERENCES, EVIDENCE ONLY` block with its rule rides after the pair on the critic sheet
and after the claims on the panel sheet;
the repair slice key folds it in only where the original links somewhere.
Verified live on the Mio source
(the blog carries 姐姐也是 in its block,
the archived copy timed out and is cached as such,
a GitHub user page and a bilibili space came back as chrome and are now excluded),
and the three guard suites fail with the block disabled.
Measured over the corpus:
59 of 92 originals link somewhere,
116 links.

`hulicaijia5` was killed at 16:43 UTC under always-kill-and-relaunch,
45 minutes in
(Bedrock 184.95 to 184.74 USD,
OpenRouter 264.76 to 264.37 USD);
it had reached the lanes and shipped nothing.

## Mio20 launches on class thirty-five, 2026-09-16, 16:43 UTC

Frozen `dff8c91d2`,
pass pid `1551070`,
runs `~/temp/agent/Mio20-20260916`,
log `~/temp/agent/Mio20-20260916.log`.
Meters at launch:
Synthetic 58.3 percent,
Hyper 0 (dry until the 07:31 UTC reset),
Bedrock 184.74 USD,
OpenRouter 264.37 USD.
The log opens with `REFERENCES cited=2 cached=2 bought=0`:
the blog read back from the cache at 2,729 characters,
the archived copy as its cached failure,
the two profile links never asked.
Read first whether `She has an older sister who is also trans` ships,
then the addition claims that shipped an edit against Mio19's 20 of 24
(`lanes.repair.result.issues` in `artifacts/Mio.json`),
then the seven steps and the three checks.

## Mio20 read, 2026-09-16, 18:44 UTC: the clause the panel now keeps is lost one stage later

Frozen `dff8c91d2`,
SETTLED in 121 minutes,
18 slices,
78 repair issues (45 accepted,
33 rejected),
selection contested,
1,278 seats asked.
Spend:
Bedrock 184.74 to 184.63 USD,
OpenRouter 264.37 to 263.97 USD,
Synthetic weekly 58.3 to 47.7 percent
(and 37.0 at the next launch twenty minutes later with nothing of mine running:
the owner was using DeepSeek V4.1 Flash on Synthetic for other work,
so Synthetic meter moves between passes are not pipeline spend),
Hyper dry throughout.
The log opened `REFERENCES cited=2 cached=2 bought=0`.

The page still says `She has an older sister.`
Traced through `artifacts/Mio.json`:

- The panel rejected all three addition claims on the clause,
  3 unsupported to 2 supported
  (Qwen3.8-27B,
  Kimi-K3 and minimax-m3 unsupported;
  gpt-oss-120b and gemma-4-26b-a4b supported),
  against Mio19's 4 to 1 the other way.
  Addition claims by adjudicated status:
  Mio20 10 rejected and 11 accepted of 21;
  Mio19 6 rejected and 30 accepted of 36.
  Class thirty-five did what it was built to do.
- The repair lane's final text for slice 2 kept
  `she has an older sister who is also trans`.
- The lane contest lost it:
  three of five judges named the repair candidate unsupported for the clause
  ("incorrectly states the sister is trans"),
  one chose translate for keeping 生前 while noting it "drops the archive's 'who is also trans' clause",
  and one voted neither with the right reading
  ("the archive-carried detail that the older sister is also trans,
  which the Chinese does not contradict and so must be kept").
  Translate won 3 to 0 with 2 neither.
- The consolidation wrote from the translate candidate and its ballots
  and shipped the sentence without the clause,
  five gate judges valid.

Class thirty-six:
the lane contest,
the consolidation writer,
the consolidation gate and the translate judge
(which also judges consolidation slates)
never see the cited references;
only the critic and panel sheets did.

The rest of the reading is clean and,
where it differs from Mio19,
better:
the archive's own wording survives where Mio19 rewrote it
(`musculine`,
`Wechat`,
`These are the last text messages she sent:`,
`> . . .`,
the multi-sentence lines of the Bei Yan Yun Yi paragraph and of the last chat block are all the archive's),
`In mainland China` stays where Mio19 deleted it as an addition
(the archive says `In China mainland`),
and the citation title is `Beiyan Yunyi's blog · In Memory of Mio` with no Chinese gloss.
Front matter equals the archive;
two headings both sides;
six photo scrolls;
no straight apostrophes or quotes;
four unicode ellipses both sides;
no footnotes;
no forbidden runs;
117 lines differ from the archive,
143 from Mio12,
188 from Mio19.
Seats:
wide 8,
select 8,
late 9,
slate 9,
translators 8,
readers 6,
writers 9 on three wet providers;
no holds,
no payment refusals,
no quorum shortfall.
Repair changed 11 slices,
translate 12,
the page 10.
The repair lane dropped 生前 in slice 2
("before her passing"),
which the contest judges caught and the consolidation restored;
noted,
not a class.

## Class thirty-six, 2026-09-16, 19:03 UTC: the candidate sheets read the cited references too

`20a7272dc`.
`referenceContext` from the prepared pair now reaches
`runPassContest` and the lane contest subject
(block after the candidates,
before the damage claims),
`runPassConsolidation` and the consolidation subject
(writer sheet block between the candidates and the findings;
the settle context's identity object carries it to the slate judge and the gate),
and the translate slice input through the stage and the round input into `judgeTranslateSlate`
(one labelled evidence entry after the declared names).
A candidate-sheet rule (`CITED_REFERENCE_CANDIDATE_RULE`) sits beside the critic rule:
a detail the archive rendering or a candidate carries that a cited page states
is never counted unsupported and never a reason to prefer the rendering that drops it;
the references never license adding,
never outrank the original,
never license a finding elsewhere.
The three run shapes
(`laneContestRunShape`,
`consolidateRunShape`,
`translateRunShape`)
fold the block in only when non-empty,
so the 33 entries that cite nothing key as before.
Guards on the three sheets,
the translate judge,
the three keys and the rule module;
all eight shown red with the block or the folds disabled
(`~/temp/agent/red-c36-20260916.log`),
green restored.
Build,
oxlint,
types and the unit suite green.

## Mio21 launches on class thirty-six, 2026-09-16, 19:04 UTC

Frozen `20a7272dc`,
pass pid `1635211`,
runs `~/temp/agent/Mio21-20260916`,
log `~/temp/agent/Mio21-20260916.log`.
Meters at launch:
Synthetic 37.0 percent,
Hyper dry,
Bedrock 184.63 USD,
OpenRouter 263.97 USD.
The log opens `REFERENCES cited=2 cached=2 bought=0`.
Read first whether the sister clause ships,
then the slice 2 contest ballots and consolidation,
then the addition claims by status against Mio20's 10 rejected of 21,
then the seven steps and the three checks.

## Mio21 read, 2026-09-16, 20:40 UTC: the clause ships by the archive standing, not by judgment

Frozen `20a7272dc`,
SETTLED in 87 minutes,
17 slices,
10 changed,
1,280 seats asked,
selection contested.
Spend:
Bedrock 184.63 to 184.34 USD (0.29 logged),
OpenRouter 263.97 to 262.62 USD (0.50 logged against 1.35 on the meter;
Mio20 logged 0.46 against 0.40,
so 0.85 USD of this pass is unexplained),
Hyper dry,
Synthetic wet at launch and dry from the translate lane on
(the owner was using it too),
so Kimi-K3 was withheld from the translate lane,
the lane contest and the consolidation,
and the checker and introduced-defect-probe rounds closed on two voices sixteen times
("short of quorum,
reachable 1 of 3").

The page carries `She has an older sister who is also trans.`,
but not because anything judged it accurate.
The panel supported the addition claim 3 to 2
(minimax-m3,
gemma-4-26b-a4b and gemma-4-e2b supported;
deepseek-v4.1-flash and mercury-2.5 unsupported;
Mio20 rejected it 3 to 2),
the repair lane dropped the clause,
the translate lane never had it,
the contest settled on neither
(one neither,
two repair,
two translate;
one judge:
"the archive rendering invents the sister being trans"),
the consolidation slate was declined,
and slice 2 shipped the archive unchanged.
Addition claims accepted 23,
rejected 5,
of 28
(Mio20:
11 and 10 of 21).
The references were on every sheet:
the judges' own replies cite them,
four select judges writing
"this is true per the cited reference ... but is NOT stated in the ORIGINAL passage,
so it is an addition that violates faithfulness"
and "background context not in the ORIGINAL passage".
The sheet's addition category outranks the rule block beside the references.
Class thirty-seven.

The first chat block was revised by the archive block review
(candidate 4 from minimax-m3 won 3.5 of 5;
in Mio20 the judges tied at weight 1 and the archive stood):
the revision restores the pat and the `mtf` question the transcript carries,
corrects the archive's `musculine`,
and drops the "WeChat post" line the transcript does not carry.
It shipped with 14 straight apostrophes inside words and 10 straight double quotes
on a page whose archive has none
(Mio20:
none):
the block review never called the typography restoration.
Class thirty-eight.

The rest read as Mio20 did:
headings 2 of 2,
no comments,
six PhotoScroll lines,
four unicode ellipses on four,
no footnotes,
no Chinese punctuation,
the one CJK run and the one refusal-pattern hit are the archive's own
(`春の芽工作室`,
"I can't delay it forever"),
no code fence,
no errors,
no holds,
no payment refusals.
202 lines differ from the archive
(Mio20:
117;
the revised chat block accounts for the rise).
The Mio20 note on `生前` in slice 2 stands
(repair "during her lifetime",
translate "before her death").

## Class thirty-eight, 2026-09-16, 20:46 UTC: the block review restores the archive's quote style

`6b853e5ce`.
Every revision candidate the archive block review builds is restored against the block it replaces
with the whole archive as convention before the judges read it,
so the selection and the gate read the shipped bytes.
Class seven restored the translate and consolidation candidates;
the block review was added later (class twenty-five) and never called `restoreTypography`.
Guard shown red without the fix.

## Class thirty-seven, 2026-09-16, 20:58 UTC: reference-backed archive details are attested word for word and screened before the panel

`35e9a0785`,
whitespace fix `887e5262c`.
Prose beside the references does not survive the sheets' own addition category,
so the mechanism is now partly mechanical.
At preparation,
when the original cites a page,
the bench is asked one focused question
(`reference-attest-wire.ts`):
which details the ARCHIVE RENDERING states that the ORIGINAL does not but a CITED REFERENCE does,
each as a verbatim archive quote plus a verbatim reference quote.
Both quotes are checked as substrings with every whitespace character removed
(`reference-attest-match.ts`;
Mio22 showed a voice spacing the reference's Chinese around its Latin tokens),
items from distinct voices whose archive quotes overlap merge into one detail,
and a detail is kept when at least half the heard voices gave it
(`rosterQuorumSize`).
The details ride the prepared pair as `attestedDetails`
and as `- attested: ...` lines under the references in `referenceContext`,
so every sheet and every cache key sees them;
both rule constants name the attested lines.
In the repair chunk
(`reference-attest-claims.ts`)
an `accuracy/addition` claim whose archive-side quote overlaps an attested quote
is recorded rejected with an empty tally and never reaches the panel or the editor;
the chunk logs `addition claim rejected before the panel, reference-attested`.
The log prints `ATTESTED heard=H answered=A verified=V needed=N details=D`,
one `ATTESTED item <seat>` line per verified item,
and one `- attested:` line per detail.
Four guards shown red with the verification,
the quorum filter and the screen disabled.

## Mio22 launches on class thirty-seven, 2026-09-16, 21:00 UTC, killed at 21:01 UTC

Frozen `35e9a0785`,
pid 1765887.
Its attestation read `ATTESTED heard=6 answered=4 verified=3 needed=3 details=0`:
three voices attested the sister clause against the blog
(`Mio的姐姐也是MtF。`),
one of them writing `Mio 的姐姐也是 MtF。`,
which the folding check rejected,
one voice attested the wrong archive line
("gentle big sister"),
two attested nothing.
Two voices against a quorum of three,
nothing attested.
Killed under ALWAYS KILL AND RELAUNCH once `887e5262c` landed.

## Mio23 launches on class thirty-seven, 2026-09-16, 21:05 UTC

Frozen `887e5262c`,
pid 1793041,
runs `~/temp/agent/Mio23-20260916`,
log `~/temp/agent/Mio23-20260916.log`.
Read first the `ATTESTED` lines
(expect the sister detail with three or more voices),
then slice 2's rejected issue with the empty tally and the chunk's reference-attested finding,
then whether the repair lane keeps the clause and what the contest and consolidation do,
then the first chat block's quote style,
then the seven steps and the three checks.
