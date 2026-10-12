# Translation repair: OpenRouter as the paid fallback provider, part 08

Part 08 of [Translation repair: OpenRouter as the paid fallback provider](translation-repair-openrouter-2026-09-03.md),
whose index lists every part in order.

## The twelfth pass settles in 108 minutes under the three checks and rewrites the letter, 2026-09-08, 20:10 UTC

`TALLY hakureico status=SETTLED slices=17 repairStatus=repaired repairIssues=78 repairAccepted=52 repairResolved=47
repairFindings=223 repairChanged=13 translateStatus=complete translateChanged=13 documentsDiffer=16 pageChanged=15
pageSilent=0 alignmentFindings=4 selection=contested ms=6504858`
at 20:10 UTC:
108.4 minutes,
against the ninth's 83.3 on a whole bench.
Every seat line of the six phases read
`synthetic=dry bedrock=wet hyper=dry openrouter=wet wide=7 select=7 late=8 slate=8 checkers=3 translators=7
readers=5 writers=9 roster=9 withheld=hf:moonshotai/Kimi-K3 waited=0ms`;
Synthetic's rolling week returned at 19:48:52 UTC (`METERS synthetic=wet`,
1.23 percent used at the tally) and the per-chunk re-seating of the thirteenth class routed 159 calls to it
before the end
(gpt-oss-120b 71,
Qwen3.8-27B 68,
GLM-5.3-Flash 20).

The three checks.
The page's front matter is the archive's seven lines byte for byte
(`read-page.mjs` prints `frontMatterEqualsArchive: true`;
`name: Hanasaka`,
alias `Kagurazaka Hanasaka, Hakureico`),
the artifact carries `artifactSchemaVersion: 11` and `frontMatterAuthority: "archive"`,
the log `FRONT MATTER entry=hakureico authority=archive` at 18:21:58 UTC,
and the blank line after the front matter that the ninth page lacked is back,
since the archive's is what ships.
E2B in the translate lane:
18 ballots (`google.gemma-4-e2b chose candidate N at weight 1`,
one at weight 0.5),
two `translate-repair: google.gemma-4-e2b revised its candidate`,
and one win,
in the consolidation (`translate stage: google.gemma-4-e2b won weight 6.5` at 20:02:53 UTC);
the translate-stage winners across lane and consolidation were GLM-5.3-Flash 8,
minimax-m3 5,
Qwen3.8-27B 5,
gemma-4-26b-a4b-it 3,
deepseek-v4-flash-0731 2,
and one each for the incumbent,
gpt-oss-120b,
E2B,
glm-5.3 and deepseek-v4-pro-0813.
Eight `json false start` lines
(seven deepseek-v4-flash-0731 through OpenRouter at openings of 2 to 12 characters,
one Synthetic gpt-oss-120b at 19:45:04 UTC),
no `schema-mismatch` beside any of them:
eight voices kept.
No line names `finish_reason=error`,
no `InStreamProviderError`,
and no `retrying in` at all
(the eleventh had two transport retries;
this pass had none),
so the eighteenth class did not occur and its guard was not exercised live;
it stands on its unit suite.
The pass's one `schema-mismatch`,
19:45:21 UTC,
`produceConsolidations deepseek-v4-flash-0731: ... Unexpected end of JSON input (model stopped with
finish_reason=stop) raw=""`,
is an empty answer on a normal stop,
one writer of a consolidation slate that settled without it.

The seven steps.
`verify-published` matched 1 of 1 at the length the artifact implies
(`wordings=17 silent=0 chars=4864/expected 4861+separators missing=0`,
exit 0).
`DESTINATIONS hakureico source=0 page=0 dropped=0`;
one `PhotoScroll`,
single-quoted paths as the archive's;
four footnote markers (two references,
two definitions) on an archive with none;
three headings as the source;
the archive's three translator notes carried (the source has none);
Chinese punctuation 11 and CJK runs 14,
equal to the archive's (the notes and the Japanese lyric).
Refusal vocabulary 0 (the one `attempt` hit is a ballot's prose).
Straight apostrophes after a letter 0,
curly 9 (archive 8);
straight double quotes 0,
curly 16 (archive 18);
three-dot ellipses 1,
U+2026 0 (archive 0 and 0;
the source's one `……` closes the solo-journeys sentence).
No run of two or more blank lines:
the seam of three blank lines before the closing sentence that the ninth page carried is gone.
`cost=` fields summed 6.49;
the meters moved OpenRouter 185.59 to 177.62 USD (7.97),
Bedrock 197.85 to 197.37 (0.48),
Synthetic weekly 0 to 1.23 percent;
Hyper 0.

What the prose read found,
beside the source and the archive.
THE LETTER.
The archive's note above it
(`这段话以下全部，包括结尾的两句祝愿，原文都是英文，中文是反向翻译的，请仅修可能造成误解或明显的非刻意语法错误，不大修`:
everything from here,
the two closing wishes included,
was written in English,
the Chinese is a back-translation,
fix only what misleads or is plainly unintended grammar,
no heavy revision)
ships on the page,
and the page still rewrote the English original in five places:
`I am never gone` became `I am never really gone`;
`If you happen to see this` became `If you happen to see this little poem`;
`And who’s by your side w` became `And no matter who’s by your side w`;
`I will always be with you` moved from before the two `No matter` lines to after them,
the back-translation's order;
and the archive's two closing wishes
(`Now these accounts are free. May she be free too.` and `Time to sleep friends, and keep smiling, stay alive.`)
became one sentence rendered from the source
(`It’s time to say goodnight. May everyone keep smiling and live well.`),
the source carrying only the second.
The ninth page had gone further
(`I actually never left`,
`Just changed places`,
`From the earth to heaven above owo`,
`Cause cats have nine lives`);
the twelfth keeps `From ground to heaven owo`,
`Cause neko has 9 lives =w=`,
`Aug. 8th, 2018` and the signature.
The page's first note
(`本文的大部分引用原文都是英文，引用部分请仅修语法和可能造成误解的错误`:
most quoted passages were English,
fix only grammar and what misleads)
is followed for the two short quotes,
which ship verbatim
(`Finally went to hell as a devil.` with `updated 18-08-09`,
and `May the world treat you well.` with `At least better than me.`),
and not for the letter.
The notes reach the slices (the sixth class's fix carries them with their position),
so this is the models' judgment on a long quoted span,
not a missing note;
nothing on the pipeline's side makes the archive the authority for a span whose note says the archive is the
original,
which is the front-matter rule's shape (the archive's text is the original and ships as it stands) applied to a
span instead of the front matter.
Measured across the pinned corpus:
22 of the 93 archive pages carry a translator note,
and 2 carry one saying the English is the original
(this page's,
and `cheonwoomaeng`'s,
saying the whole page is the author's English and must not be touched).
A DESIGN QUESTION for the owner,
recorded in the handover under "The twelfth page and the letter";
nothing landed.
Smaller:
`“Mayday”[^1]` puts the footnote marker outside the closing quote where the source has it inside the brackets
(`「Mayday[^1]」`) and the ninth page had `“Mayday[^1]”`,
the English convention;
one em dash (`rhythm games — she also focused`) on an archive page with none,
where 38 of the corpus's 93 archive pages carry one;
seven lines ending in a space (the Mayday quote's blank `> ` lines) where the archive has 23 and the ninth page 21,
the letter's blank quote lines being bare `>`;
the `osu!` line break inside its sentence (`her *osu!*` then `account was still online.`),
recorded at the sixth pass;
`feeling down` for 精神不好 where the ninth had `struggling mentally`,
softer than the source.
The rest reads true to the source:
the Giftia paragraph,
the transponder quote with three and two Maydays as the source (the archive's four and three) and the archive's
bold,
`Hanasaka’s Letter` for 千歌的信 under the name rendering,
the departure paragraphs.

The straggler count against the ninth (`SEAT ... threw=`):
Qwen3.8-27B 35 of 245 (ninth 17 of 258),
deepseek-v4-pro-0813 21 of 241 (0 of 248),
deepseek-v4-flash-0731 9 of 193 (0 of 198),
glm-5.3 8 of 121 (3 of 120),
GLM-5.3-Flash 7 of 73 (7 of 75),
gemma-4-26b-a4b-it 1 of 245 (0 of 219),
minimax-m3 0 of 230 (1 of 240),
gpt-oss-120b 0 of 227 (0 of 242),
E2B 0 of 223 (0 of 180),
Gemma 31B 0 of 2 (0 of 2),
Kimi-K3 withheld (3 of 258).
81 lost voices against 38,
by round:
select 26,
critic 16,
panel 15,
lane contest 7,
translate 6,
consolidation writers 5 (one of them the empty answer),
refiner 3,
editor 1,
checker 1,
naturalness review 1;
every one but the empty answer abandoned after quorum at the straggler window.
With five readers and nine seats against the ninth's six and ten,
quorum came from the fast seats and the window cut the long reasoners
(Qwen3.8-27B through CoreWeave at 2.9 to 3.2 M delivered characters per cut,
deepseek-v4-pro-0813 at 0.85 M);
that is a reading of the lines,
not a measurement of who answered first.
Quorum held in every round (`quorum-not-met` 0,
`one-reader-only` 0,
43 corroborated),
so no seat moves;
the 25 minutes over the ninth are the window's price on a shorter bench.
GLM-5.3-Flash on `photo1.webp`:
`stream cut after 7127626 characters (CallTimeoutError: ... exceeded its 360000ms deadline)`,
eight passes of eight;
four readers corroborated the picture at overlap 0.598.

`yuki418330012` launched at 20:18 UTC on `bb04656ef` (tree `ba7ce85a9`) into `~/temp/agent/yuki418330012-20260908`,
log beside it,
pid 393298,
on three providers
(`JUDGE SEATS phase=preparation synthetic=wet bedrock=wet hyper=dry openrouter=wet wide=8 select=8 late=9 slate=9
checkers=3 translators=8 readers=6 writers=10 roster=10 withheld=none waited=0ms`)
and `FRONT MATTER entry=yuki418330012 authority=archive` at 20:18:17 UTC.
Watched by the filtered poller that reports only the tally,
a stop,
a crash,
an error-finish regression or the process exit;
read by the seven steps plus the three checks when it settles.

## The letter sealed and the yuki page read and the nineteenth class fixed, 2026-09-08, 22:10 UTC

The owner answered the letter question after the twelfth page was reported (20:20 UTC):
"1",
span authority from the note,
and "in this specific case our pipeline should refuse to 'repair' that specific entry" for `cheonwoomaeng`,
whose note says the whole page is the author's own English.
Landed as `439667ec3` (the seal and the decline) and `58f647ab9` (the fixtures and
`doc/decision/translation-repair-archive-original.md`).
The seal:
`archive-original-note.ts` reads the archive's HTML comments for the marks
(`以下` with `原文` and `英文` for a span,
`原文即英文` or `不要动本篇` for the whole page),
a span runs from the note's end to the next heading or the end of the page,
`groupNodesSealed` keeps the sealed translation blocks and the originals paired with them as `SealedRun`s through
merge and anchor and drops them before slicing
(an original the source carries behind the seal becomes an insertion at the seal's end),
the preparation records `archiveOriginalSpans` (artifact generation twelve),
`assertArchiveOriginalComplete` refuses a page that does not carry every sealed span byte for byte,
and the pass logs `ARCHIVE ORIGINAL entry=<id> span=<k> [start, end) of the archive ships as it stands under the note`.
The decline:
`runEntryPipeline` reads the note before any purchase,
writes `declined/<id>.json`,
prints `TALLY <id> status=DECLINED reason=archive-original`,
the scheduler counts the id as done from the artifacts and the declines together,
and `verify-published` prints `declined=N` and flags `DECLINED AND PUBLISHED ANYWAY`.
Verified live:
`cheonwoomaeng` into `~/temp/agent/cheonwoomaeng-20260908` declined in 41 ms,
`declined/cheonwoomaeng.json` written and no page;
the thirteenth `hakureico` launch (`439667ec3`,
`~/temp/agent/hakureico13-20260908`,
21:46 UTC) logged `ARCHIVE ORIGINAL entry=hakureico span=0 [3966, 4561)` under the letter's note at 21:46:19 UTC
and reached the lanes at 21:52 UTC.
One thing `verify-published` still does:
a runs dir holding only declines prints `NOTHING VERIFIED` and exits 2,
since no page was published;
a whole-corpus pass always has pages beside its declines,
so the exit is right there and wrong only on a decline-only dir.

The `yuki418330012` page (`bb04656ef`,
20:18 to 21:22 UTC,
`~/temp/agent/yuki418330012-20260908`),
read by the seven steps plus the three checks.
`TALLY yuki418330012 status=SETTLED slices=9 repairStatus=repaired repairIssues=68 repairAccepted=46
repairResolved=44 repairFindings=107 repairChanged=5 translateStatus=complete translateChanged=6 documentsDiffer=6
pageChanged=5 pageSilent=1 alignmentFindings=8 selection=contested ms=3862504`:
64.4 minutes on three providers
(`synthetic=wet bedrock=wet hyper=dry openrouter=wet wide=8 select=8 late=9 slate=9 checkers=3 translators=8
readers=6 writers=10 roster=10 withheld=none` at the preparation;
Synthetic refused at 20:33 UTC and was held out for 300 s under the fourteenth class's reading,
14 `HTTP 429` retries at 20:32 to 20:33 UTC).
The three checks passed:
the front matter is the archive's byte for byte (`FRONT MATTER entry=yuki418330012 authority=archive`),
30 `json false start` reads (26 of them deepseek-v4-flash-0731) every one kept with no `schema-mismatch` beside it,
and no error finish occurred.
`verify-published` matched at length (`wordings=8 silent=1`),
destinations 0,
0 and 0.
Seats that threw at the straggler window:
Qwen3.8-27B 28 of 118 calls,
deepseek-v4-flash 9 of 90,
Kimi-K3 6 of 67,
GLM-5.3-Flash 3 of 48,
deepseek-v4-pro 2 of 115,
E2B 1 of 101.
Meters at the tally:
OpenRouter 172.94 USD,
Bedrock 197.20 USD.

The prose read found three things.
THE NINETEENTH CLASS,
the footnote label swap:
the original writes `洲洲[^2]` and `真理[^1]`;
the archive had renumbered by first appearance,
`Zhouzhou[^1]` and `Zhenli[^2]`,
with its two definitions numbered to match
(`[^1]: Yuki's substitute parent ... Zhouzhou`,
`[^2]: She's younger ... sister`).
Every lane judged the body against the original,
so the page's body follows the original's labels,
while the archive's definitions stood as they were:
the roster paired neither
(section 1 paired 6 of 8 original and 10 of 12 translation blocks),
the original's definitions came through as an insertion and were withdrawn as duplicates,
`pageSilent=1`.
The page carries `Zhenli[^1]` above `[^1]: Yuki's substitute parent`:
each marker points at the other's note.
The assembly guard (`introducedFootnoteFindings`) diffs only unresolved,
orphan and duplicate findings against the incumbent,
and a swap is none of those.
Second,
`自切`,
community slang for self-surgery,
rendered `self-harmed by cutting` where the archive had `attempted self-surgery`.
Third,
`超天酱`,
the KAngel character of *Needy Streamer Overload*,
rendered `Choco-chan` where the archive named the game.
The second and third are regressions of correct archive renderings by a bench that does not know the community's
words;
they are the glossary question put to the owner in the handover.

The fix for the nineteenth class,
landed as `1ba94c27a` and corrected as `ea07a1512`,
sits upstream of every lane:
once the archive's labels are rewritten to the original's,
label equality is the correspondence,
a definition pairs with the definition of the same label,
and a definition that renders the wrong note is a fidelity defect the lanes see.
`archive-footnote-relabel.ts`:
`referenceLabels` lists a text's distinct GFM reference labels in first-appearance order,
definition openers left out;
`footnoteRelabelOf` reads a positional map off each paired slice
(the k-th distinct marker on one side is the k-th on the other),
leaves a slice whose sides carry different counts out of the reading with a note naming it,
and refuses as ambiguous where two slices map one label two ways;
`applyFootnoteRelabel` rewrites references and definition openers of the mapped labels in one pass.
`pass-footnote-relabel.ts` applies it after the first preparation and `pass-prepare.ts` prepares again over the
relabelled archive before the block correction round
(one preparation,
at most one relabel with its re-preparation,
at most one correction round with its re-preparation),
logging `FOOTNOTES entry=<id> relabelled [^1]->[^2], [^2]->[^1]`,
`FOOTNOTES entry=<id> left out of the relabel reading: slice N references ...`,
or `FOOTNOTES entry=<id> archive labels stand, since the slices disagree: ...`.
The suite failed first on the old build (`does not provide an export named 'applyFootnoteRelabel'`),
then passed;
the full suite on `1ba94c27a` printed 967 `PASS` and 0 `FAIL`.

The correction:
the fourteenth `hakureico` launch (`1ba94c27a`,
22:05 UTC) read
`FOOTNOTES entry=hakureico archive labels stand, since the slices disagree: slice 7 references 1 distinct notes in
the original and 0 in the archive`,
because the archive of `hakureico` carries no `[^2]` at all
(the source's `HOSTED__WITH__GAE[^2]` inside the letter and its definition `即 Google App Engine` were never
translated).
An omitted or added note is the fidelity defect the lanes see,
not a labelling conflict,
so the first build's abort on a count mismatch was wrong;
`ea07a1512` leaves that slice out of the reading,
named,
and reads the map off the rest.
Under the kill-and-relaunch rule the thirteenth pass was killed at 22:04 UTC for `1ba94c27a`,
the fourteenth and the second `yuki418330012` (22:05 UTC) at 22:07 UTC for `ea07a1512`,
and the fifteenth `hakureico` (`~/temp/agent/hakureico15-20260908`,
pid 461533) and the third `yuki418330012` (`~/temp/agent/yuki3-20260908`,
pid 461634) launched at 22:08 UTC on `ea07a1512`,
both on Bedrock and OpenRouter
(`synthetic=dry bedrock=wet hyper=dry openrouter=wet wide=7 select=7 late=8 slate=8 checkers=3 translators=7
readers=5 writers=9 roster=9 withheld=hf:moonshotai/Kimi-K3`),
each watched by the filtered poller.
What their pages must show:
`hakureico`,
the letter byte for byte the archive's under the seal
(`assertArchiveOriginalComplete` would have refused the page otherwise),
the source's footnote definitions after the span,
`[^1]` agreeing on both sides,
slice 7 named as left out;
`yuki418330012`,
`FOOTNOTES entry=yuki418330012 relabelled [^1]->[^2], [^2]->[^1]`,
`Zhouzhou[^2]` above `[^2]: ... substitute parent` and `Zhenli[^1]` above `[^1]: ... sister`,
and whether `自切` and `超天酱` regress again.

## The nineteenth class's second face where the crossing definitions starve the pairing, 2026-09-08, 22:36 UTC

The third `yuki418330012` launch (`ea07a1512`,
22:08 UTC) did not relabel.
Its log read
`FOOTNOTES entry=yuki418330012 left out of the relabel reading: slice 4 references 0 distinct notes in the original
and 2 in the archive`
and no relabel line,
because the roster's second pairing round had starved:
`paired 3 of 8 original and 3 of 12 translation blocks across 3 relations, from 2 usable voices of 8 heard`,
with six voices refused,
three as `pairing moves backwards on the original side at position 10` and three as
`pairing moves backwards on the translation side at position 10`.
Position 10 is the definitions.
The original defines `[^1]` (the sister) then `[^2]` (the substitute parent);
the archive defines `[^1]` (the parent) then `[^2]` (the sister);
every voice that paired the two definitions by content paired them crossed,
and the wire reader's rule that a correspondence never steps backwards refused each of them.
The rule is a rule about prose,
and a footnote definition is an order-free block:
a page renders its notes by reference order,
so two documents may define the same notes in different orders and both be right.
The first `yuki418330012` run had paired 6 of 8 and 10 of 12 in that section for the same reason,
the two definitions unpaired on each side,
which is how the archive's definitions came to stand unrepaired under the original's markers.
So the swap wrecks the pairing before the relabel can read it:
the same class,
seen from the other side.

The fix (`e5ff6c4f8`),
in four pieces.
`readBlockPairing` takes the chunk-local indices of the definition blocks on each side as `freeOrder`,
reads the order rule over the body pairs alone,
and refuses a pair that joins a definition with a body block;
the stage threads the indices through and `prepareDocumentPairWithRoster` computes them from the nodes' zones.
`splitDefinitionPairs` (`pair-definition-order.ts`) reads each chunk's agreed pairing after the media claim:
where the definition pairs cross they are kept out of what the slicer walks
(its runs must be in document order on both sides),
named as `block-pairing section N: the footnote definitions cross, kept out of the slicing and read for the relabel`,
and every definition pair is handed on by label as `footnoteDefinitionPairs` on the paired preparation.
`footnoteRelabelOfDefinitions` reads the map off those pairs,
the exact evidence
(the archive's definition of a note carries the archive's label for it,
the original's carries the original's),
and the positional slice reading of `1ba94c27a` stays as the fallback where the roster paired no definition.
`reorderFootnoteDefinitions` (`archive-footnote-order.ts`) then moves the archive's definition blocks into the
original's definition order,
a contiguous run only,
so the second preparation pairs them in order like any other block and the slices carry both sides;
the relabel step logs `FOOTNOTES entry=<id> relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired`
and `FOOTNOTES entry=<id> definitions moved into the original's order: [^1], [^2]`.
The wire suite failed first on the old build
(the crossing pairs refused,
the mixed pair accepted),
then passed;
the footnote exports moved to `footnote-barrel.ts` at the pipeline barrel's line budget;
full suite 973 `PASS` and 0 `FAIL`,
oxlint and types clean.
The fifteenth `hakureico` and the third `yuki418330012` were killed at 22:16 UTC under the rule
(the last reading before the kills:
Bedrock 197.01 USD,
OpenRouter 170.95 USD),
and the sixteenth `hakureico` (`~/temp/agent/hakureico16-20260908`,
pid 489831) and the fourth `yuki418330012` (`~/temp/agent/yuki4-20260908`,
pid 489956) launched at 22:36 UTC on `e5ff6c4f8`,
each watched by the filtered poller.
What their logs must show before their pages are read:
`yuki418330012`,
the second pairing round with every voice usable,
`block-pairing section 1: the footnote definitions cross`,
the relabel off the definitions the roster paired,
the definitions moved,
and a re-preparation whose section 1 pairs the definitions in order;
`hakureico`,
slice 7 still named as left out (the archive carries no `[^2]`),
no definition moved,
the seal as before.

## The relabel must close over the archive's labels, 2026-09-08, 22:42 UTC

The fourth `yuki418330012` launch (`e5ff6c4f8`,
22:36 UTC) showed the pairing whole again
(`paired 6 of 8 original and 10 of 12 translation blocks across 10 relations, from 8 usable voices of 9 heard`,
the one refusal `google.gemma-4-e2b returned an unusable pairing: pairing pairs a footnote definition with a
body block at position 5`,
the right refusal)
and then a relabel bug:
`FOOTNOTES entry=yuki418330012 relabelled [^2]->[^1] off the definitions the roster paired`,
one pair,
not two.
The roster agreed on the sister's definitions (`[^1]` in the original,
`[^2]` in the archive) and not on the parent's,
so the map moved the archive's `[^2]` onto `[^1]` and said nothing about the archive's own `[^1]`,
and the rewrite gave the archive two `[^1]` notes.
A map whose target label the archive already carries must also move that label away,
or it is a merge.
Fixed in `2da6e7f22` (`archive-footnote-closure.ts`):
`documentLabels` lists every distinct label a text carries,
references and definition openers alike;
`closeFootnoteRelabel` completes the one pair elimination forces
(exactly one label left unmapped on each side and not the identity)
and refuses as open any map that lands on a label the archive carries and does not move,
naming the labels and how many stand unaccounted for on each side;
the pass applies only a closed map,
skips the reorder when the map is open,
and logs
`FOOTNOTES entry=<id> archive labels stand, since the map read off <basis> does not close: ...`.
The suite failed first (`does not provide an export named 'closeFootnoteRelabel'`),
then passed;
full suite 975 `PASS` and 0 `FAIL`,
oxlint and types clean.
The sixteenth `hakureico`,
the fourth `yuki418330012` and the first `Arita` (launched 22:38 UTC beside them,
the next entry in the queue) were killed at 22:39 UTC under the rule,
and the seventeenth `hakureico` (`~/temp/agent/hakureico17-20260908`,
pid 500384),
the fifth `yuki418330012` (`~/temp/agent/yuki5-20260908`,
pid 501073) and the second `Arita` (`~/temp/agent/arita2-20260908`,
pid 501893) launched at 22:42 UTC on `2da6e7f22`,
each watched by the filtered poller.
What `yuki418330012`'s log must show:
`relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired`
(the second pair by elimination where the roster agrees on one),
`definitions moved into the original's order: [^1], [^2]`,
and a re-preparation whose section pairs both definitions in order.

## The twentieth class stops the fifth yuki pass at the carried-insertion guard and the Arita page is read, 2026-09-09, 00:25 UTC

The fifth `yuki418330012` pass (`2da6e7f22`,
22:42 UTC) did what the closure was built for:
`FOOTNOTES entry=yuki418330012 relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired`
(the roster agreed on one pair,
`7 usable voices of 8 heard`,
the one refusal a definition paired with a body block,
and elimination gave the other),
`FOOTNOTES entry=yuki418330012 definitions moved into the original's order: [^1], [^2]`,
and the re-preparation paired `7 of 8 original and 11 of 12 translation blocks across 11 relations`,
both definitions among them.
It then stopped at 00:06 UTC,
83 minutes in,
`TALLY yuki418330012 status=INCOMPLETE ms=4998139 aborted=false error=translation repair interrupted:
carried-evidence-lost`.
The one unpaired original was the credits line (`条目贡献：真理 三三 娑娜`),
admitted as an insertion the archive already carries
(`slice 8: coverage=carried, missingDestinations=0`,
the roster's quote `Contributors for this entry: Zhenli, Sansan, Suona` anchored on the archive's one line).
The stage caches show what became of that line:
the repair and translate lanes shipped it as the archive had it,
and the consolidation's slate,
incumbent and every fresh candidate alike,
carried `Contributors for this entry:\nZhenli,\nSansan,\nSuona`.
That is the semantic wrap (`consolidate-wrap.ts`,
`wrapConsolidation`,
the site's own line-break convention applied to a slice the lanes changed),
and `assertCarriedInsertionsRemain` compared the anchored quote byte for byte against the wrapped page.
Every word of the credits was on the page.
THE TWENTIETH CLASS:
a guard that reads its evidence by a stricter reading than the one that produced it.
Fixed in `11143f681`:
the guard folds soft line breaks and normalizes punctuation on both sides,
the reading `locateQuote` anchored the quote with,
and its findings name each lost region
(`carried-insertion-evidence-lost slice N: "..."`) instead of a count alone.
The suite failed first
(the new case,
a carried region broken across a soft break),
then passed;
full suite 975 `PASS` and 0 `FAIL`,
oxlint and types clean.
Under the rule the seventeenth `hakureico` was killed at 00:22 UTC,
in consolidation since 23:46 UTC,
and the eighteenth `hakureico` (`~/temp/agent/hakureico18-20260908`,
pid 528810) and the sixth `yuki418330012` (`~/temp/agent/yuki6-20260908`,
pid 528921) launched at 00:22 UTC on `11143f681`,
each watched by the filtered poller.

The second `Arita` pass (`2da6e7f22`,
22:42 to 00:13 UTC,
`~/temp/agent/arita2-20260908`) settled on the build before the guard fix and is read as evidence for it,
since the fix touches only a guard the pass never tripped.
`TALLY Arita status=SETTLED slices=12 repairStatus=repaired repairIssues=44 repairAccepted=25 repairResolved=24
repairFindings=139 repairChanged=9 translateStatus=complete translateChanged=10 documentsDiffer=10 pageChanged=9
pageSilent=0 alignmentFindings=1 selection=contested ms=5459151`:
91.0 minutes on Bedrock and OpenRouter beside two other passes,
Synthetic's week returning for the translate lane.
The three checks passed:
the front matter is the archive's byte for byte (`FRONT MATTER entry=Arita authority=archive`),
8 `json false start` reads kept,
one `schema-mismatch` that was no false start
(deepseek-v4-flash-0731 returned an empty reply on `finish_reason=stop` in a consolidation round,
a voice lost),
and no error finish occurred;
one `InStreamProviderError` rode the retry ladder.
`verify-published` matched 1 of 1 at length (`wordings=12 silent=0 chars=6963=expected missing=0`).
The component this entry was queued for,
the double-quoted path,
shipped verbatim:
`<PhotoScroll photos={["${path}/photos/image0.webp"]} />` at line 156,
the archive's line 37.
Quotes on the archive's conventions (straight 2 and curly 14 on both),
apostrophes curly (24 against the archive's 21,
the three new ones inside rendered text),
one three-dot ellipsis where the archive has one and a second where the source carries one the archive dropped
(`不管从现在起命运的道路将会把我带向何方...只要我保持耐心`,
rendered `No matter where the path of destiny leads me from now on... as long as I stay patient`),
in the archive's three-dot convention.
Rounds:
editor 9,
refiner 17,
translate 12,
naturalness review 10,
lane contest 11,
polish gate 9,
`gate-kept-standing` 0,
`one-reader-only` 0,
`corroborated` 36.
113 voices lost at the straggler window and 15 `HTTP 429` retries,
three passes sharing the two providers.
Meters at the tally:
OpenRouter 147.83 USD,
Bedrock 195.98 USD.
The page is the first read page to carry the component.
The prose read against the source:
the archive's two errors are repaired
(`人间失格` is *No Longer Human*,
where the archive had *Indignation in the World*;
the sentence about dying on her birthday in 2027 and being one day younger,
which the archive dropped,
is back),
the roommate passage carries the direct question the archive softened,
and two nits stand:
`meet — won’t we?` spaces its dash where the archive writes them closed,
and the Yeats line keeps the archive's comma in `breast, or his lips` where the source quotes the poem without
one.
No class.

## The twentieth class's second face where a partial vote's quote is not evidence, 2026-09-09, 01:35 UTC

The sixth `yuki418330012` pass (`11143f681`,
00:22 UTC) relabelled,
reordered and re-prepared as the fifth had,
and stopped at 01:30 UTC,
67 minutes in,
as `carried-evidence-lost` again,
on the folded guard.
The fold was measured right
(the wrapped credits and the anchored one-line quote fold to the same string),
so the region the guard lost was another one.
The coverage round that admitted the credits line as carried had eight anchored voices:
seven said `full` and quoted `Contributors for this entry: Zhenli, Sansan, Suona`,
one said `partial` and quoted `She had attempted suicide many times before.`,
a sentence from another part of the page.
`judgeCoverage` recorded every anchored quote as evidence whatever its degree
(`weighed.filter(isAnchored)`),
against its own contract
("Exact target regions supporting full-coverage votes"),
and a lane rewrote that sentence
(the consolidation ships `defused many of Yuki's suicide crises` where the archive had
`rescued Yuki many times from suicide`),
so the guard stopped the entry over a region no full vote ever named.
The fifth pass had carried the same eighth vote;
its stop had two causes and the fold removed one.
Fixed in `d6db46519`:
the verdict's evidence is the full votes' regions alone,
the verdict suite's carried case now expects three regions of four voices and a new case pins the partial
voter's quote out,
shown to fail first;
and `tallyCaughtEntry` prints each finding of a `TranslationRepairInterruptedError` as
`INTERRUPTED <id>: <finding>` before the tally line,
since the tally carried the reason alone and two passes stopped with nothing in the log naming the region.
Full suite 975 `PASS` and 0 `FAIL`,
oxlint and types clean.
Under the rule the eighteenth `hakureico` was killed at 01:34 UTC,
in consolidation since 01:19 UTC,
and the nineteenth `hakureico` (`~/temp/agent/hakureico19-20260909`,
pid 546904) and the seventh `yuki418330012` (`~/temp/agent/yuki7-20260909`,
pid 547017) launched at 01:35 UTC on `d6db46519`,
each watched by the filtered poller.
The last reading before the kill:
Bedrock 195.29 USD,
OpenRouter 132.20 USD.
What the seventh `yuki418330012` must show:
the relabel and the reorder as before,
no `carried-evidence-lost`,
and a settled page.

## The seventh yuki page settles under the closed relabel and the full-vote evidence, 2026-09-09, 02:55 UTC

`TALLY yuki418330012 status=SETTLED slices=9 repairStatus=repaired repairIssues=33 repairAccepted=20
repairResolved=18 repairFindings=128 repairChanged=5 translateStatus=complete translateChanged=7 documentsDiffer=7
pageChanged=6 pageSilent=1 alignmentFindings=5 selection=contested ms=4563909`
at 02:51 UTC on `d6db46519`,
76.1 minutes on Bedrock and OpenRouter beside the nineteenth `hakureico`,
`~/temp/agent/yuki7-20260909`.
The log in order:
the roster paired the definitions by content
(`7 usable voices of 8 heard`,
the one refusal a definition paired with a body block),
`FOOTNOTES entry=yuki418330012 relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired`,
`FOOTNOTES entry=yuki418330012 definitions moved into the original's order: [^1], [^2]`,
the re-preparation paired `7 of 8 original and 11 of 12 translation blocks`,
the credits line was admitted as carried (`slice 8: coverage=carried, missingDestinations=0`),
and no `INTERRUPTED` line:
the guard read the wrapped credits as the full votes' evidence and passed.
The three checks passed:
the front matter is the archive's byte for byte,
1 `json false start` read kept with no `schema-mismatch` beside it,
no error finish.
`verify-published` matched 1 of 1 at length (`wordings=8 silent=1 chars=5225=expected missing=0`);
the silent slice is slice 2,
which both lanes left as the archive has it (`archive-stands`).
Destinations 0,
quorum held (`quorum-not-met` 0,
`one-reader-only` 0,
`corroborated` 22),
73 voices lost at the straggler window and no `HTTP 429`.
Meters at the tally:
OpenRouter 114.14 USD,
Bedrock 194.66 USD.

THE NINETEENTH CLASS IS FIXED ON THE PAGE.
`Zhouzhou[^2] took her in and they lived together;` (line 103) stands above
`[^2]: Yuki’s godmother? They were like mother and daughter. Zhouzhou cared for Yuki for a long time and averted
many of Yuki’s suicide crises.` (line 136),
and `Yuki went to stay with Zhenli[^1] to take a breather.` (line 109) above
`[^1]: She was younger than Yuki, but she treated Yuki like an older sister would. She liked Yuki a lot, bought
her gifts, and cooked her meals.` (line 134):
each marker at its own note,
the original's labels,
the original's definition order,
four markers on each side.
The credits ship as `Contributors for this entry:\nZhenli,\nSansan,\nSuona`,
the semantic wrap's shape,
which the twentieth class's two fixes let through.

THE TWO SLANG REGRESSIONS STAND,
now on a second page:
`自切` ships as `After she began cutting herself, their attitude improved significantly` (line 52) where the archive
had `After she attempted self-surgery`,
and `超天酱` ships as `Chōten-chan` (line 17) where the archive named *Needy Streamer Overload*.
The bench does not know the community's words;
the glossary question stands with the owner.
