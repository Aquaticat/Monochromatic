# Translation repair handover snapshot: 2026-09-06, part 07

Part 07 of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
whose index lists every part in order.

## The twelfth page and the letter

The twelfth `hakureico` pass (`bb04656ef`,
18:21 to 20:10 UTC on 2026-09-08,
108.4 minutes,
`~/temp/agent/hakureico12-20260908`) settled on Bedrock and OpenRouter with Synthetic's week returning at 19:48 UTC.
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
The owner chose span authority ("1") and added that the whole-page case must be refused,
not repaired.
Landed as `439667ec3` and `58f647ab9`,
recorded in `doc/decision/translation-repair-archive-original.md`,
and verified live (`cheonwoomaeng` declined in 41 ms into `~/temp/agent/cheonwoomaeng-20260908`;
the thirteenth `hakureico` launch logged the sealed span `[3966, 4561)`).
The fifteenth `hakureico` page proves the letter shipped as the archive has it by existing,
since `assertArchiveOriginalComplete` refuses any other page.

## The nineteenth class

The `yuki418330012` page (`bb04656ef`,
20:18 to 21:22 UTC on 2026-09-08,
64.4 minutes,
`~/temp/agent/yuki418330012-20260908`) passed the three checks
(front matter the archive's,
30 `json false start` reads kept with no mismatch beside them,
no error finish),
`verify-published` matched at length (`wordings=8 silent=1`),
destinations 0.
Its prose carries the nineteenth class.
The original writes `洲洲[^2]` and `真理[^1]`;
the archive had renumbered by first appearance,
`Zhouzhou[^1]` and `Zhenli[^2]`,
with its two definitions numbered to match.
Every lane judged the body against the original,
so the body follows the original's labels,
while the archive's definitions stood as they were
(the roster paired neither and the original's definitions came through as an insertion withdrawn as duplicates;
`pageSilent=1`),
and the page carries `Zhenli[^1]` above `[^1]: Yuki's substitute parent`.
The footnote guard diffs unresolved,
orphan and duplicate findings against the incumbent,
and a swap is none of those.
Fixed upstream of every lane in `1ba94c27a`:
`archive-footnote-relabel.ts` reads a positional map off each paired slice's distinct reference labels
(`footnoteRelabelOf`),
refuses as ambiguous where two slices map one label two ways,
and rewrites references and definition openers in one pass (`applyFootnoteRelabel`);
`pass-footnote-relabel.ts` applies it after the first preparation and `pass-prepare.ts` prepares again over the
relabelled archive before the block correction round,
logging `FOOTNOTES entry=<id> relabelled [^1]->[^2], [^2]->[^1]`.
Corrected in `ea07a1512` after the fourteenth `hakureico` launch read slice 7 as one note against none and aborted:
the `hakureico` archive carries no `[^2]` at all
(the source's `HOSTED__WITH__GAE[^2]` inside the letter was never translated),
which is an omission the lanes see,
not a labelling conflict,
so a count mismatch now leaves that slice out of the reading,
named (`FOOTNOTES entry=<id> left out of the relabel reading: ...`),
and the map is read off the rest.
The reading is in the planning log under
"The letter sealed and the yuki page read and the nineteenth class fixed".

The class has a second face,
found by the third `yuki418330012` launch (`ea07a1512`,
22:08 UTC),
which did not relabel:
the roster's second pairing round had starved to two usable voices of eight
(`paired 3 of 8 original and 3 of 12 translation blocks`),
six refused as `pairing moves backwards ... at position 10`,
because every voice that paired the two definitions by content paired them crossed
(the original defines the sister then the parent,
the archive the parent then the sister)
and the wire reader's never-backwards rule is a rule about prose.
A footnote definition is an order-free block,
since a page renders its notes by reference order.
Fixed in `e5ff6c4f8`:
`readBlockPairing` takes the definition indices as `freeOrder` and reads the order rule over body pairs alone
(a definition still pairs only with a definition),
`splitDefinitionPairs` keeps a crossing definition pair out of the slicing and hands its labels on as
`footnoteDefinitionPairs`,
`footnoteRelabelOfDefinitions` reads the map off those pairs
(the positional slice reading stays as the fallback),
and `reorderFootnoteDefinitions` moves the archive's definitions into the original's order so the second
preparation pairs them in order.
The wire suite failed first;
full suite 973 `PASS` and 0 `FAIL`.
Recorded in the planning log under
"The nineteenth class's second face where the crossing definitions starve the pairing".

The fourth `yuki418330012` launch (`e5ff6c4f8`,
22:36 UTC) paired whole again (8 usable voices of 9,
the one refusal a definition paired with a body block,
the right refusal) and then showed a relabel bug:
the roster agreed on one of the two definition pairs,
the map moved the archive's `[^2]` onto `[^1]` and said nothing about the archive's own `[^1]`,
and the archive came out with two `[^1]` notes.
Fixed in `2da6e7f22` (`archive-footnote-closure.ts`):
`closeFootnoteRelabel` completes the one pair elimination forces
(exactly one label left unmapped on each side)
and refuses as open any map that lands on a label the archive carries and does not move;
the pass applies only a closed map and logs why the archive stands otherwise.
Full suite 975 `PASS` and 0 `FAIL`.
Recorded in the planning log under "The relabel must close over the archive's labels".

## The twentieth class

The fifth `yuki418330012` pass (`2da6e7f22`,
22:42 UTC) relabelled and reordered as designed
(`relabelled [^2]->[^1], [^1]->[^2] off the definitions the roster paired`,
the second pair by elimination;
`definitions moved into the original's order: [^1], [^2]`;
the re-preparation paired both definitions)
and stopped at 00:06 UTC as `carried-evidence-lost`,
83 minutes in.
The credits line the roster left unpaired was admitted as an insertion the archive already carries,
its evidence the anchored quote `Contributors for this entry: Zhenli, Sansan, Suona`;
the consolidation's semantic wrap shipped the changed slice with that line broken at its clauses,
`Contributors for this entry:\nZhenli,\nSansan,\nSuona`,
and `assertCarriedInsertionsRemain` compared the quote byte for byte.
A guard reading its evidence by a stricter reading than the one that produced it.
Fixed in `11143f681`:
the guard folds soft line breaks and normalizes punctuation on both sides,
the reading `locateQuote` anchored with,
and names each lost region in its findings.
Suite failed first;
full suite 975 `PASS` and 0 `FAIL`.
Recorded in the planning log under
"The twentieth class stops the fifth yuki pass at the carried-insertion guard and the Arita page is read".

The sixth `yuki418330012` pass (`11143f681`,
00:22 UTC) stopped at the same guard at 67 minutes,
on the folded reading.
The fold was right;
the lost region was another:
the coverage round had seven full votes quoting the credits line and one partial vote quoting an unrelated
sentence about suicide attempts,
`judgeCoverage` recorded every anchored quote as evidence whatever its degree,
and a lane rewrote that sentence.
Fixed in `d6db46519`:
evidence is the full votes' regions alone (the contract already said so),
and `tallyCaughtEntry` prints an interrupted entry's findings as `INTERRUPTED <id>: <finding>` lines
before the tally,
which two stops had lacked.
Verdict suite shown to fail first.
Recorded in the planning log under
"The twentieth class's second face where a partial vote's quote is not evidence".
The seventh `yuki418330012` pass (`d6db46519`,
01:35 to 02:51 UTC,
76.1 minutes) settled through the guard with the credits carried,
and its page carries `Zhouzhou[^2]` above the godmother note and `Zhenli[^1]` above the sister note:
the nineteenth class and the twentieth are closed on a read page.
Recorded in the planning log under
"The seventh yuki page settles under the closed relabel and the full-vote evidence".

## The Arita page

The second `Arita` pass (`2da6e7f22`,
22:42 to 00:13 UTC on 2026-09-09,
91.0 minutes,
`~/temp/agent/arita2-20260908`) settled beside two other passes on Bedrock and OpenRouter.
The three checks passed
(front matter the archive's,
8 `json false start` reads kept,
no error finish),
`verify-published` matched 1 of 1 at length (`wordings=12 silent=0`),
and the double-quoted component line shipped verbatim
(`<PhotoScroll photos={["${path}/photos/image0.webp"]} />`),
the first read page to carry it.
Quotes on the archive's conventions,
one ellipsis the archive dropped restored in the archive's three-dot convention,
`corroborated` 36 with `one-reader-only` 0.
113 voices lost at the straggler window and 15 `HTTP 429` retries,
three passes sharing the two providers.
No class found.
The full reading is in the planning log under the same heading as the twentieth class.

## The twenty-first class

The nineteenth `hakureico` pass (`d6db46519`,
01:35 to 03:03 UTC on 2026-09-09,
88 minutes,
`~/temp/agent/hakureico19-20260909`) settled with the seal holding
(`ARCHIVE ORIGINAL entry=hakureico span=0 [3966, 4561)`,
`artifactSchemaVersion: 12` with `archiveOriginalSpans`,
the letter byte for byte the archive's and ending the page),
the three checks passed,
`verify-published` matched at length (`wordings=14 silent=1`),
37 voices lost and no `HTTP 429`.
Its page carries `she used “Mayday”[^1]` (line 80) with no `[^1]` definition anywhere.
The translate lane rendered the source's two definitions as one insertion behind the sealed letter;
the letter is the archive's and has no `[^2]` marker;
`guardFootnoteAssembly` withdrew the whole insertion for the orphan `[^2]`,
the `[^1]` note with it;
the consolidation shipped the body's `[^1]`;
and no guard read the composed page,
since the assembly guard runs only inside each lane's assembly.
Fixed in `aedee7414`:
`assembly-orphan-trim.ts` cuts an orphan definition's own block out of a replacement that is nothing but
definition blocks (`assembly-footnote-trimmed`) before the guard blames a slice,
leaves prose replacements for the whole withdrawal,
and withdraws only a trim that lands on the incumbent;
`corpus-run/page-footnote-integrity.ts` reads the would-ship page's footnote graph against the archive and stops
the entry as `page-footnote-integrity` with each defect on an `INTERRUPTED` line;
`corpus-run/pass-page-guards.ts` runs it beside the carried guard from `pass-entry.ts`.
The trim case failed first;
full suite 979 `PASS` and 0 `FAIL`.
The twentieth `hakureico` (`aedee7414`,
03:21 to 04:28 UTC,
68 minutes,
`~/temp/agent/hakureico20-20260909`) stopped `status=ERROR` at the delivery reassembly invariant:
the guard trimmed slice 14,
the document carried one definition,
and the ledger's shipped row still carried the judges' two,
since nothing carried a trim from the guard to the ledger.
The second face,
fixed in `9abcbee50`:
`guardFootnoteAssembly` reports `trimmed`;
both lane results carry `trimmedReplacements`;
`buildSliceDelivery` reads a shipped row's text from them before the decision and refuses a trim naming an
unshipped slice;
`assertDeliveryCoherent` accepts a shipped row whose text is its decision with definition blocks cut and nothing
else (`isDefinitionTrim`).
Both ledger cases failed first.
The twenty-first `hakureico` (`9abcbee50`,
04:39 to 06:13 UTC,
93 minutes,
`~/temp/agent/hakureico21-20260909`) stopped INCOMPLETE at the page footnote guard,
the guard refusing the dangling `[^1]` the page would have carried a third time:
the bench wrote the two notes one line apart,
the trim read blocks at blank lines and saw one block,
and the assembly guard withdrew both notes and the reference.
The third face,
fixed in `379122379`:
a definition line opens a block to the trim whether or not a blank line precedes it,
gaps between blocks survive a cut as written,
`cutDefinitionBlocks` and `isDefinitionTrim` share the reading,
and both assemblers log every guard finding.
The guard case failed first.
The twenty-second `hakureico` (`379122379`,
06:20 to 07:46 UTC,
86 minutes,
`~/temp/agent/hakureico22-20260909`) stopped INCOMPLETE at the page footnote guard again:
the translate lane trimmed slice 14 (the log says so now),
and the consolidation's own rendering of the two notes put the orphan back,
since the page the polish,
the consolidation and the per-slice contest compose was a document no guard assembled.
The fourth face,
fixed in `3620004db` (artifact generation thirteen):
`pass-page-assembly.ts` composes the artifact,
`page-assembly-guard.ts` runs the assembly guard over the page it would ship,
and the outcome is written as the artifact's `pageAssembly` section
(`artifact-two-lane-page-assembly.ts`),
which `wouldShipTextFor` applies ahead of the polish,
the consolidation and the contest;
an older artifact reads with an empty section.
The would-ship case failed first.
The twenty-third `hakureico` (`3620004db`,
08:01 to 09:31 UTC,
89.7 minutes,
`~/temp/agent/hakureico23-20260909`) settled:
`“Mayday”[^1]` (line 77) above its one note (line 189,
after the sealed letter),
no `[^2]`,
the translate lane and the page-level guard each logging the trim of slice 14,
the artifact at generation 13 with `pageAssembly.trimmed` naming slice 14,
`verify-published` matched at length,
the three checks passed,
the seal holding,
two nits (a three-dot ellipsis where the archive has no convention;
a wrap break after `*osu!*`) and no class.
The twenty-first class is closed on a read page.
Recorded in the planning log under
"The nineteenth hakureico page is read and the twenty-first class takes the sibling note with the orphan",
"The twenty-first class's second face where the ledger says what was decided and the document carries the trim"
"The twenty-first class's third face where two notes one line apart are one block to the trim"
"The twenty-first class's fourth face where the consolidation puts the orphan back and the page is a document
nobody guarded"
and "The twenty-third hakureico page settles under the page assembly and closes the twenty-first class".

## The twenty-second class

The fourth `gqt` pass (`3620004db`,
08:01 to 09:46 UTC,
104.5 minutes,
`~/temp/agent/gqt4-20260909`) settled and read clean on the three shapes it was chosen for
(`### Timeline` at level 3,
the bold-led list items one per line with two wrapped after the bold lead's colon,
the italic paragraph as one emphasis across four wrapped lines),
with the source's footnote restored and the page guard silent.
Line 8 of the archive,
the source and the page is `<!-- (Original Language: Engish) -->`:
Ara wrote in English,
the Chinese page is the translation,
and the owner's rule of 2026-09-08 declines the entry.
`readNote` knew only the two Chinese wordings,
so the entry was repaired four times from its back-translation.
Fixed in `7bcea2dc4`:
`ENGLISH_WHOLE_PAGE_MARKS` matched on the lowercased note,
in the corpus's own spelling and the one it meant.
The recognizer case failed first;
the fifth `gqt` declined in 146 ms.
A census over both languages finds no other wording.
The three shapes go back to no read page;
`noname` (the level-3 heading) runs since 09:50 UTC,
`shi_Yumiaoya` (the emphasis,
with `Banner`) and `XingZ60` (the list,
with a rule and three components) are next.
Recorded in the planning log under
"The fourth gqt page is read and the twenty-second class declines an English original".

## The twenty-third class

The first `noname` pass (`7bcea2dc4`,
09:50 to 11:45 UTC,
115.4 minutes,
`~/temp/agent/noname1-20260909`) settled and read clean on the level-3 heading it was chosen for
(three `###` headings at the source's positions,
each a rendering of the source's heading where the archive's had added a date and a description),
with the three links verbatim,
the archive's broken `'${path} /photos/kuan4.webp'` repaired to the source's line,
the fullwidth colon and the `知乎` label rendered,
and the page guard silent.
The page lacks the `## 简介` heading the source opens with;
84 of 86 archives carry theirs.
Section 0 paired the heading with the archive's paragraph:
`agreePairs` kept source 0's `(0,0)` first and dropped source 1's agreed `(1,0)` as non-monotone,
because a later source's claim on the same target could only be a corroborated merge or a run-back.
Fixed in `efc9a4f3c`:
`pair-contested-target.ts` decides such a claim by votes,
as `bestVoted` decides one source named against two targets;
the earlier pair is taken back when outvoted,
a tie keeps neither,
and the finding names both sources and the votes.
Three cases failed first;
full suite 984 `PASS` and 0 `FAIL`.
The bare URL the census credited to `noname` was the inner URL of a `web.archive.org` link target
(`Mio`'s the same);
the corrected census names `shi_Yumiaoya` (a `Banner` prop) and `yingying` (a footnote definition).
Recorded in the planning log under
"The first noname page is read and the twenty-third class decides a contested target by votes".
The second `noname` (`efc9a4f3c`,
11:59 to 12:32 UTC,
`~/temp/agent/noname2-20260909`) confirms the fix at the pairing:
`contested target (target 0: source 1 outvotes source 0, 7 to 3)`,
the heading a slice of its own,
admitted as absent.
OpenRouter refused for payment at 12:22 UTC and the heading was rendered `## Introduction` by both reachable
translators and chosen by every judge who voted,
at weight 1.5 against the minimum of 2,
so it stays unfilled on that page;
the heading ships is read on the first full-bench pass.
Recorded in the planning log under
"The second noname page confirms the pairing on a bench OpenRouter left".

## The thin-bench questions

ANSWERED AT 17:25 UTC ON 2026-09-09:
the first by a share of the reachable weight (`doc/decision/translation-repair-short-bench-share.md`),
the second by keeping the incumbent
(addendum of `doc/decision/translation-repair-ineligible-standing.md`);
the build follows in "What to do next".
The questions as they were asked:

Two decisions for the owner,
raised by the second `noname` and the sixth `Mio` on Bedrock alone (2026-09-09,
12:22 to 12:33 UTC;
planning log,
the same section).

The first:
what a deciding bench short of quorum but not empty should do.
Today it runs on what is reachable (the thirteenth class),
and `MIN_SELECTION_WEIGHT` of 2 in `candidate-select-model.ts` seats a winner only when every reachable
Bedrock judge names it,
so insertions stay unfilled and slices ship unchanged.

- A,
  widen the fifteenth class:
  a deciding bench short of quorum stops the entry INCOMPLETE for a pass that has one.
  Pro:
  no thin page ships,
  deterministic,
  and the shape the owner chose for the empty bench.
  Con:
  on one provider nothing ships.
- B,
  ask a winner for a share of the reachable bench's weight rather than an absolute 2,
  keeping 2 as the floor against one judge deciding.
  Pro:
  Bedrock alone seats winners.
  Con:
  three judges decide,
  and the share is a number to choose.
- C,
  as now:
  the phase runs on what is reachable and the page ships with the findings saying so.
  Pro:
  no change.
  Con:
  a page one writer and three judges made goes to `fixed/` beside one a whole bench made.

Widening Bedrock's judge benches with `gemma-4-31b` is not an option:
it was measured for the judge seat on 2026-09-07 (6 of 12 complete-text picks against a seated median of 9.5,
declining the rest) and stayed out;
no other Bedrock model is approved.

Ranking A > B > C:
A over B because a floor that stands beats a threshold that moves,
and it is the answer the owner gave for the empty bench;
B over C because a page the findings alone distinguish is not a production page.

The second:
what the consolidation should do when the standing text is ineligible and the incumbent is valid.
The 2026-09-04 decision stops the entry;
it was taken on `luxuanwen3`,
where the incumbent itself was ineligible.
On `Mio` slice 3 the archive's paragraph and list were valid and were not offered.

- A,
  keep the incumbent for that slice with the finding recorded,
  and stop only when the incumbent is ineligible too.
  Pro:
  an entry is not lost over one slice whose safe text exists;
  the luxuanwen3 case still stops.
  Con:
  a slice the lanes wanted to change ships unchanged,
  said only in the findings.
- B,
  as now.
  Pro:
  the decision as written.
  Con:
  one thin slice costs the page.

Ranking A > B because the decision's reason ("an ineligible standing was never going to ship") does not reach
an incumbent that can.

## The glossary question

ANSWERED AT 17:25 UTC ON 2026-09-09:
both the corpus glossary file and the archive's rendering as a candidate the judges must weigh
(`doc/decision/translation-repair-community-glossary.md`);
the build follows in "What to do next".
The question as it was asked:

The same page rendered two community terms wrongly where the archive had them right:
`自切`,
the community's word for self-surgery,
shipped as `self-harmed by cutting` where the archive had `attempted self-surgery`;
`超天酱`,
the KAngel character of *Needy Streamer Overload*,
shipped as `Choco-chan` where the archive named the game.
Both are regressions of correct archive renderings by a bench that does not know the community's words,
and nothing in the pipeline tells it.
The seventh `yuki418330012` page (`d6db46519`) shipped both again,
`After she began cutting herself` and `Chōten-chan`.
This is a design question for the owner,
put in the session's report with the options and a ranking:
a corpus glossary of community terms fed to the identity context
(a file beside the corpus pin,
a term,
its rendering and one line of why,
read into every sheet that sees the term;
buys the archive's knowledge for every entry and costs curating it and keeping it out of terms the archive got
wrong),
the archive's rendering as a candidate the judges must weigh where a term of the glossary's shape appears
(no curation,
but the judges already saw the archive and chose against it twice),
or leaving it
(nothing to build,
and the community's own words ship wrong on a memorial).
Nothing is landed;
the owner decides.

## The shortfall budget question

ANSWERED AT 02:55 UTC ON 2026-09-19:
"Do #1",
the untranslated tail's own budget read off the pairing's last agreed pair
(`5bda732de`,
the pass log's heading dated 2026-09-19 03:20 UTC,
the absence-verdict decision's addendum on the tail).
Measured before building:
a neighbour-sized window refuses real omissions,
so the region is the tail alone,
admitted when its expectation exceeds the last agreed pair's whole rendering.
The question as it was asked:

Raised by the XingZ608 read on 2026-09-19
(the pass log's "Class fifty-nine" heading dated 2026-09-19 02:45 UTC).
The whole-page shortfall budget
(`doc/decision/translation-repair-absence-verdict.md`,
`coverage-corroboration.ts`)
reads how much English the page lacks against the corpus median of 2.65 code points per source code point,
and spends that over the absent-voted passages in document order.
XingZ60's archive stops at "Under Construction" with the source's second half untranslated,
and its translated half runs long
(about 3.3 code points per source code point),
so the budget reads 10,794 where the untranslated half alone expects about 13,600.
On XingZ608 that shortfall admitted the prose and refused the footnote definitions,
which class fifty-nine now admits by the page's own graph;
a longer untranslated tail would run out of budget on prose,
which no structural rule admits,
and the page would ship with a recorded gap.
The design says the budget is measured,
not tuned,
and the corpus median is used as is;
the options,
ranked,
are in the session's report of 2026-09-19:
a budget per aligned region
(the untranslated tail's own expectation,
read off the pairing's last agreed pair)
ahead of a whole-page budget that treats a page the archive left unfinished as one whose translated part is complete,
ahead of leaving the budget as it stands and reading the recorded gaps.
Built as `5bda732de`.

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
    The 19:53 UTC launch was killed under it after 264 calls.
-   The owner's rule of 2026-09-27:
    "Always fix and re-launch."
    Every rendering a read finds that can be translated better is fixed in the same turn
    (guard red first,
    fix,
    suite),
    then the running pass is killed and relaunched;
    a read never reports an "observation not built" or "not fixed" for a translation.
    The fix is general:
    a sentence-level error (a moved subject,
    a calque,
    a grammar slip) takes a rule on every sheet
    (`english-usage-policy.ts` through `house-policy.ts`),
    and the glossaries hold dictionary terms only:
    words,
    set phrases,
    names and the community's vocabulary,
    never a fragment of one sentence
    (owner,
    2026-09-27:
    "'kigurumi的记忆结束' - this isn't really a dictionary keyword though?").
    A glossary word refuses only forms that are wrong wherever the word stands;
    a form that is right for the same word in another context
    (交往 of a romance,
    喘不过气 after a run) goes in the why,
    not the refusals.
    The owner had to say this twice on 2026-09-26 and 2026-09-27
    (the TianqiChen66614 kigurumi quote was reported unbuilt).
    The rule is deliberately not in the root `AGENTS.md`.

## Costs

Measured at 18:25 UTC on 2026-09-09 with the scratch `costs-today.mjs` over every log of the day under
`~/temp/agent` (the `cost=` field of each `SPEND` line summed per log,
the first and last `METERS` balances beside it),
the catalogs' prices,
and the seat line of the seventh `Mio` launch.
A reckoned `estimated=abandoned` line is a ceiling (completion at the cap times the price),
so a log's sum can read above what the balance moved.

Prelaunch meter at 21:55 UTC on 2026-09-09:
OpenRouter 270.03 USD,
Bedrock 186.24 USD,
Synthetic zero of its rolling week with 2750/2750 in its five-hour window,
Hyper zero.
`~/temp/agent/class25-prelaunch-meters-20260909.log` is the live reading;
`costs-today.mjs 20260909` output is `~/temp/agent/class25-prelaunch-costs-20260909.out`.
Its `TOTAL logged OpenRouter cost=110.2945` is not an OpenRouter-only spend total:
the helper sums every provider and includes old `unit-*.log` fixtures (`cat/whiskers` alone contributes 1.25).
Use the named provider rows of actual pass logs and live balance movements,
not that label.
New test logs are `.out` or in a subdirectory so they do not enter the daily meter scan.

Historical balances at 20:29 UTC:

- OpenRouter 270.03 USD,
    the owner's final top-up ("I have topped up OpenRouter one final time";
    273.99 at the 16:45 UTC launch).
    The 3.96 spent since is the whole evening:
    the third `noname` 1.87 (1.14 of it the Kimi leak),
    the Mercury calibration 1.82 over 176 minutes,
    the seventh `Mio` 0.59,
    the three class-twenty-four probes 0.14,
    `hulicaijia` 0.06 before it stopped.
- Bedrock 186.24 USD of the 200 the owner will never top up;
    195.26 at 01:34 UTC today,
    so 9.02 spent today (gpt-oss-120b 5.00,
    gemma-4-26b-a4b 3.15,
    gemma-4-e2b 0.85,
    gemma-4-31b 0.02).
- A PASS NOW COSTS about 0.6 to 0.8 USD on OpenRouter and 0.2 on Bedrock with Synthetic dry,
    against the 4 to 9 USD of the morning's passes.
    At that rate the OpenRouter balance holds roughly 300 more passes,
    and Bedrock's credit is the scarcer one.
- Synthetic at zero of its rolling week since 17:25 UTC;
    it returns as the oldest usage ages out.
- Hyper at zero since 12:45 UTC on 2026-09-08 and never to be recharged.

WHAT THE DAY COST BEFORE THE LEVERS
(01:34 to 13:04 UTC,
the build before `037d1f650`,
Synthetic and Hyper dry throughout,
so every non-Bedrock call went to OpenRouter):
21 passes logged 104.31 USD on OpenRouter while the balance moved 130.99 to 0.09,
the 26.6 USD between them the abandoned streams the endpoints billed to the end before
`4f87555fc` wrote a line for them;
with the 69 USD spent between the 200.01 top-up of 2026-09-08 11:26 UTC and 01:34 UTC,
that is the 200 USD the owner asked about.
Per pass,
in launch order:
`hakureico19` 8.88 (SETTLED),
`yuki7` 4.64 (SETTLED),
`hakureico20` 6.15 (ERROR),
`gqt1` 5.72,
`mio1` 4.04,
`gqt2` 5.83,
`hakureico21` 6.84 (INCOMPLETE),
`mio2` 4.71,
`gqt3` 6.61,
`hakureico22` 3.87 (INCOMPLETE),
`mio3` 3.66,
`gqt4` 7.05 (SETTLED),
`hakureico23` 6.80 (SETTLED),
`mio4` 6.41,
`hulicaijia1` 0.26,
`hulicaijia2` 7.15,
`mio5` 5.32,
`noname1` 5.04 (SETTLED),
`hulicaijia3` 2.57 (ERROR),
`mio6` 1.05 (INCOMPLETE),
`noname2` 1.72 (SETTLED);
a pass with no status was killed for a fix and relaunched.
By model on OpenRouter today:
deepseek-v4-pro 39.77,
Qwen3.8-27B 24.10 (off the OpenRouter catalog since `037d1f650`),
glm-5.3 16.73 (off since `037d1f650`),
Kimi-K3 10.80 (the reach honours the withholding since `19b6043a3`),
deepseek-v4-flash 3.87,
minimax-m3 2.40,
glm-5.3-flash 0.77.

WHAT A PASS COSTS ON THE LEVERS
(since the 16:45 UTC launch of the third `noname` on `33a023445`):

- The third `noname`,
    83 minutes,
    SETTLED,
    Synthetic wet for its first 40 minutes:
    1.87 USD on OpenRouter,
    of which 1.14 was 22 Kimi-K3 calls the router sent there after Synthetic dried,
    so 0.73 for the other 382 OpenRouter calls;
    0.19 on Bedrock;
    28 abandoned streams reckoned at 0.44 (a ceiling;
    23 of them DeepSeek-flash at 0.05 in all).
- The Mercury producer calibration,
    0.98 USD logged on OpenRouter by round 21 of 40 (0.17 of it reckoned abandoned);
    every `inception/mercury-2.5` call so far billed `cost=0` on the Inception endpoint,
    against the listing of 0.04 and 0.15 USD per million.
- The seated-roster fidelity probe,
    0.02 USD.
- Since the top-up the balance moved 273.99 to 271.65 (2.34 USD),
    with 2.87 logged,
    the difference the reckoned ceilings.
- The seventh `Mio` (18:20 UTC,
    frozen `19b6043a3`) is the first pass with the leak closed;
    read its `SPEND` sum for what a page costs with Synthetic dry,
    expected near 0.7 to 1.0 USD on OpenRouter and 0.2 on Bedrock,
    which puts the balances at some 270 pages on OpenRouter and 600 on Bedrock.

PRICES THE CATALOGS CARRY,
USD per million prompt and completion tokens,
which `SPEND cost=` is read off the wire against:

- OpenRouter:
    deepseek-v4-pro 0.58 and 1.74 (paid 1.87 times that before the price sort of `1fe7ca2fe`),
    deepseek-v4-flash 0.065 and 0.18,
    minimax-m3 0.3 and 1.2,
    glm-5.3-flash 0.075 and 0.25,
    gpt-oss-120b 0.037 and 0.17,
    gemma-4-26b-a4b 0.07 and 0.34,
    mercury-2.5 0.04 and 0.15,
    kimi-k3 3 and 15 (served,
    not bought).
- Bedrock:
    gemma-4-e2b 0.04 and 0.08,
    gemma-4-26b-a4b 0.13 and 0.40,
    gemma-4-31b 0.14 and 0.40,
    gpt-oss-120b 0.1545 and 0.618.
- Synthetic and Hyper are prepaid quotas,
    not per token;
    what reaches them costs nothing per call,
    which is why the levers that cut tokens make them last longer and send less to OpenRouter.
