# Translation repair: the production readiness signal, and what it rests on

Proposal for the owner,
written 2026-08-26 ahead of the `AskUserQuestion` call the readiness task prescribes.
The signal is the owner's cue to disable branch protection temporarily so the corpus text committed along
the way can be sanitized (`doc/handover/translation-repair.md`,
"Corpus exposure is not a blocker").
This document is the evidence behind the question and the decisions the question bundles apart.

## Contents

This record is kept as one file per subject or span,
each of at most 1,000 lines and named for what it holds.
New text goes into the file whose subject it belongs to;
a file that would pass the limit gives up a subject to a new file,
named for that subject and listed here.

- [Readiness signal: the proposal and the owner's answers of 2026-08-26](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md):
  What the readiness signal first rested on,
  what was known and not done,
  and the sanitization inventory;
  the four decisions the question kept apart and the owner's answers,
  including the rejection that sent the work to the actual output;
  what changed after the answers the same day,
  and what had to come before any re-signal.
  Sections:
  - [What "ready" rests on](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#what-ready-rests-on)
  - [What is known and not done](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#what-is-known-and-not-done)
  - [Sanitization inventory](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#sanitization-inventory)
  - [The decisions the question keeps apart](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#the-decisions-the-question-keeps-apart)
  - [The owner's answers (2026-08-26)](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#the-owners-answers-2026-08-26)
  - [Since the answers (2026-08-26, updated the same day)](translation-repair-readiness-signal-proposal-and-owner-answers-2026-08-26.md#since-the-answers-2026-08-26-updated-the-same-day)
- [Readiness signal: the pages and launches read on 2026-09-04](translation-repair-readiness-signal-pages-read-on-2026-09-04.md):
  The six passes read that day and the three defects no gate had found;
  the luxuanwen3 runs on three builds,
  the SS3B_0016 page and the Uekawakuyuurei attempts;
  each launch's reading of the belief and what would move it.
  Sections:
  - [What the 2026-09-04 pages showed](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-the-2026-09-04-pages-showed)
  - [What the luxuanwen3 re-run of 2026-09-04 showed](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-the-luxuanwen3-re-run-of-2026-09-04-showed)
  - [What the luxuanwen3 re-run on the either-rendering build showed (2026-09-04, 12:43 UTC)](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-the-luxuanwen3-re-run-on-the-either-rendering-build-showed-2026-09-04-1243-utc)
  - [What the two runs on the publisher fix showed (2026-09-04, 13:51 UTC)](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-the-two-runs-on-the-publisher-fix-showed-2026-09-04-1351-utc)
  - [What the Uekawakuyuurei attempt on the pronoun build showed (2026-09-04, 15:03 UTC)](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-the-uekawakuyuurei-attempt-on-the-pronoun-build-showed-2026-09-04-1503-utc)
  - [What Uekawakuyuurei on the picture-fix build showed (2026-09-04, 15:25 UTC)](translation-repair-readiness-signal-pages-read-on-2026-09-04.md#what-uekawakuyuurei-on-the-picture-fix-build-showed-2026-09-04-1525-utc)
- [Readiness signal: the yulianNyanner launches and the TLL1122 page, 2026-09-06 to 2026-09-07](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md):
  The change to the plain invocation on 2026-09-06 and the first run on it;
  the pages on the class-six,
  class-seven and class-eight builds,
  each finding the next class;
  the TLL1122 page,
  the first read page with a footnote,
  which found no class.
  Sections:
  - [What 2026-09-06 changed before the next page](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-2026-09-06-changed-before-the-next-page)
  - [What the first plain-invocation run showed (2026-09-06, 20:21 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-first-plain-invocation-run-showed-2026-09-06-2021-utc)
  - [What the first page on the plain invocation showed (2026-09-06, 21:03 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-first-page-on-the-plain-invocation-showed-2026-09-06-2103-utc)
  - [What the page on the class-six build showed (2026-09-06, 22:10 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-page-on-the-class-six-build-showed-2026-09-06-2210-utc)
  - [What the page on the class-seven build showed (2026-09-06, 23:11 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-page-on-the-class-seven-build-showed-2026-09-06-2311-utc)
  - [What the page on the class-eight build showed (2026-09-07, 00:12 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-page-on-the-class-eight-build-showed-2026-09-07-0012-utc)
  - [What the TLL1122 page showed (2026-09-07, 01:11 UTC)](translation-repair-readiness-signal-yulian-nyanner-and-tll1122-launches-2026-09-06-to-2026-09-07.md#what-the-tll1122-page-showed-2026-09-07-0111-utc)
- [Readiness signal: the four Huasheng launches of 2026-09-07](translation-repair-readiness-signal-huasheng-launches-2026-09-07.md):
  The container class found before the first page,
  and the relaunch that stopped at the block floor;
  the directory-name refusal,
  with the owner's decision on the block floor and on the name check;
  the fourth launch,
  which settled with a page and found the provider-limit class.
  Sections:
  - [What the Huasheng attempt showed (2026-09-07, 01:44 UTC)](translation-repair-readiness-signal-huasheng-launches-2026-09-07.md#what-the-huasheng-attempt-showed-2026-09-07-0144-utc)
  - [What the Huasheng relaunch showed (2026-09-07, 03:09 UTC)](translation-repair-readiness-signal-huasheng-launches-2026-09-07.md#what-the-huasheng-relaunch-showed-2026-09-07-0309-utc)
  - [What the third Huasheng launch showed (2026-09-07, 08:43 UTC)](translation-repair-readiness-signal-huasheng-launches-2026-09-07.md#what-the-third-huasheng-launch-showed-2026-09-07-0843-utc)
  - [What the fourth Huasheng launch showed (2026-09-07, 15:43 UTC)](translation-repair-readiness-signal-huasheng-launches-2026-09-07.md#what-the-fourth-huasheng-launch-showed-2026-09-07-1543-utc)
- [Readiness signal: the hakureico launches and the front matter decision, from 2026-09-07 evening to the small hours of 2026-09-09](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md):
  The first to twelfth hakureico launches,
  from the wait after a hold to the whole-bench page;
  the owner's decision to publish the archive's front matter as is,
  and the E2B calibration and merge;
  the yuki418330012 launches and the letter's landing,
  whose closing paragraphs run on to launches started at 00:22 and 01:35 UTC on 2026-09-09.
  Sections:
  - [What the three hakureico launches of 2026-09-07 showed (21:00 to 22:00 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-three-hakureico-launches-of-2026-09-07-showed-2100-to-2200-utc)
  - [What the sixth hakureico launch showed (2026-09-08, 00:38 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-sixth-hakureico-launch-showed-2026-09-08-0038-utc)
  - [What the seventh and eighth hakureico launches on Bedrock alone showed (2026-09-08, 01:49 and 02:19 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-seventh-and-eighth-hakureico-launches-on-bedrock-alone-showed-2026-09-08-0149-and-0219-utc)
  - [What the ninth hakureico launch on four wet providers showed (2026-09-08, 11:27 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-ninth-hakureico-launch-on-four-wet-providers-showed-2026-09-08-1127-utc)
  - [What the owner decided on the front matter (2026-09-08, 13:15 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-owner-decided-on-the-front-matter-2026-09-08-1315-utc)
  - [What the E2B calibration and the merge showed (2026-09-08, 16:07 to 16:18 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-e2b-calibration-and-the-merge-showed-2026-09-08-1607-to-1618-utc)
  - [What the tenth hakureico launch showed (2026-09-08, 16:18 to 16:55 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-tenth-hakureico-launch-showed-2026-09-08-1618-to-1655-utc)
  - [What the eleventh hakureico launch showed (2026-09-08, 16:56 to 18:21 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-eleventh-hakureico-launch-showed-2026-09-08-1656-to-1821-utc)
  - [What the twelfth hakureico launch showed (2026-09-08, 18:21 to 20:10 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-twelfth-hakureico-launch-showed-2026-09-08-1821-to-2010-utc)
  - [What the yuki418330012 launch and the letter's landing showed (2026-09-08, 20:18 to 22:10 UTC)](translation-repair-readiness-signal-hakureico-and-yuki-launches-2026-09-07-to-2026-09-09.md#what-the-yuki418330012-launch-and-the-letters-landing-showed-2026-09-08-2018-to-2210-utc)
- [Readiness signal: the launches read on 2026-09-09, from 01:35 to 23:32 UTC](translation-repair-readiness-signal-launches-2026-09-09.md):
  The seventh yuki418330012 launch and hakureico launches nineteen to twenty-three,
  with the four faces of the footnote class;
  the fourth gqt launch,
  the noname launches,
  the Mio and hulicaijia launches,
  and the eighth Mio launch that ended the day.
  Sections:
  - [What the seventh yuki418330012 launch showed (2026-09-09, 01:35 to 02:51 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-seventh-yuki418330012-launch-showed-2026-09-09-0135-to-0251-utc)
  - [What the nineteenth hakureico launch showed (2026-09-09, 01:35 to 03:03 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-nineteenth-hakureico-launch-showed-2026-09-09-0135-to-0303-utc)
  - [What the twentieth hakureico launch showed (2026-09-09, 03:21 to 04:28 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-twentieth-hakureico-launch-showed-2026-09-09-0321-to-0428-utc)
  - [What the twenty-first hakureico launch showed (2026-09-09, 04:39 to 06:13 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-twenty-first-hakureico-launch-showed-2026-09-09-0439-to-0613-utc)
  - [What the twenty-second hakureico launch showed (2026-09-09, 06:20 to 07:46 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-twenty-second-hakureico-launch-showed-2026-09-09-0620-to-0746-utc)
  - [What the twenty-third hakureico launch showed (2026-09-09, 08:01 to 09:31 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-twenty-third-hakureico-launch-showed-2026-09-09-0801-to-0931-utc)
  - [What the fourth gqt launch showed (2026-09-09, 08:01 to 09:46 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-fourth-gqt-launch-showed-2026-09-09-0801-to-0946-utc)
  - [What the first noname launch showed (2026-09-09, 09:50 to 11:45 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-first-noname-launch-showed-2026-09-09-0950-to-1145-utc)
  - [What the second noname and sixth Mio launches showed (2026-09-09, 11:59 to 12:33 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-second-noname-and-sixth-mio-launches-showed-2026-09-09-1159-to-1233-utc)
  - [What the third noname launch showed (2026-09-09, 16:45 to 18:08 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-third-noname-launch-showed-2026-09-09-1645-to-1808-utc)
  - [What the Mio and hulicaijia launches showed (2026-09-09, 18:20 to 20:30 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-mio-and-hulicaijia-launches-showed-2026-09-09-1820-to-2030-utc)
  - [What the eighth Mio launch showed (2026-09-09, 21:58 to 23:32 UTC)](translation-repair-readiness-signal-launches-2026-09-09.md#what-the-eighth-mio-launch-showed-2026-09-09-2158-to-2332-utc)
- [Readiness signal: the Mio verse remedy and the evidence gathered from 2026-09-09 night to 2026-09-10](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md):
  The ninth and tenth Mio launches and the classes they found;
  the verse remedy measured,
  reviewed and withdrawn as a first claim,
  and the Mio12 page that preserved the poem;
  the naming and archive-correction evidence written by later sessions,
  in reverse order of writing.
  Sections:
  - [Archive correction has current-stage evidence; audit and temporal context remain (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#archive-correction-has-current-stage-evidence-audit-and-temporal-context-remain-2026-09-10)
  - [Naming has current-stage evidence; archive and context work remains (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#naming-has-current-stage-evidence-archive-and-context-work-remains-2026-09-10)
  - [The stored-review mismatch is fixed; wording follow-up remains (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#the-stored-review-mismatch-is-fixed-wording-follow-up-remains-2026-09-10)
  - [Mio12 preserves published verse but does not establish readiness (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#mio12-preserves-published-verse-but-does-not-establish-readiness-2026-09-10)
  - [The verse remedy has passage-level evidence (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#the-verse-remedy-has-passage-level-evidence-2026-09-10)
  - [The upstream verse remedy is being measured (2026-09-10)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#the-upstream-verse-remedy-is-being-measured-2026-09-10)
  - [The verse remedy is under review (2026-09-10, 02:18 UTC)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#the-verse-remedy-is-under-review-2026-09-10-0218-utc)
  - [What Mio10 showed (2026-09-10, 00:15 to 01:36 UTC)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#what-mio10-showed-2026-09-10-0015-to-0136-utc)
  - [What the ninth Mio launch showed (2026-09-09, 23:49 UTC to 2026-09-10, 00:07 UTC)](translation-repair-readiness-signal-mio-verse-remedy-and-follow-up-evidence-2026-09-10.md#what-the-ninth-mio-launch-showed-2026-09-09-2349-utc-to-2026-09-10-0007-utc)

## The owner's words on the goal, 2026-09-04

Asked when a supervised sweep over all 92 entries should launch,
the owner answered:

> We never ever need a all 92 entries launch.
> If you believe it's ready for all 92 entries launch after reading the artifacts,
> that means we had reached the goal of making it production ready.

So the deliverable is the pipeline's readiness,
judged by reading its artifacts and pages,
and no 92-entry sweep is planned or budgeted.
The 2026-09-03 OpenRouter budget arithmetic that priced such a sweep in
[`translation-repair-openrouter-2026-09-03.md`](translation-repair-openrouter-2026-09-03.md)
is an upper bound on what the corpus would cost if it were ever run,
not a plan.
The readiness signal is put when a reading of the artifacts would let the sweep launch,
whether or not it does.

## Where readiness stands on 2026-09-24

The sections dated 2026-09-09 and 2026-09-10 are those days' readings and stay as evidence.
The current state is in the handover
([`translation-repair-handover-2026-09-06.md`](../handover/translation-repair-handover-2026-09-06.md),
"What to do next")
and the pass log;
this section is the readiness reading of it.

- The signal is still not given.
  The rule of this document holds:
  a class found on a read page is fixed before the next launch,
  and a page is read before the next entry is launched.
  Classes twenty-six to one hundred nineteen were found that way between 2026-09-16 and 2026-09-24,
  one hundred nineteen in all,
  and the rate has not fallen to zero:
  of the last fifteen reads (yingying8 at 00:31 UTC to CuspariaKLSY13 at 09:15 UTC 2026-09-24),
  four found no class,
  ten found one each
  (one hundred eight to one hundred sixteen,
  with the chain arm of one hundred eleven found on its own read)
  and CuspariaKLSY13 found two (one hundred seventeen,
  list spacing,
  and one hundred eighteen,
  GLM-5.3-Flash's latency on Synthetic).
  The eight reads before zheermao12 each found one,
  five of them on `mikaela_khara`,
  where the carried-insertion fold and the pairing met new shapes in a row,
  yingying10's on the translate slate rather than the page
  and zheermao11's on the clock (a translate lane of 616 s against 77,
  the page itself clean).
  zheermao12 found none,
  the class one hundred sixteen rule taking the translate lane to 62 s with the Hyper seats still asked.
  CuspariaKLSY13's page was faithful in wording,
  the death paragraph complete for the first time;
  its two classes are a spacing the archive keeps and a seat's latency,
  not a mistranslation.
  CuspariaKLSY14 and hulicaijia17 found no class.
  shi_Yumiaoya19 found one (one hundred nineteen):
  小药娘 shipped in Han,
  a third rendering in three runs,
  settled by the owner's answer of 2026-09-24 as "trans girl" or "trans woman" and built as a glossary entry with a floor.
  shi_Yumiaoya22 found none:
  both lines read "trans girl" on the page,
  with no Han and no pinyin outside the archive's comment.
  XingZ6010 found one (one hundred twenty):
  a page-assembly pass wrote a song title into a heading's `align` attribute because the tag spaces its equals sign,
  a broken page the bench did not cause;
  fixed and replayed over the run.
  mikaela17 found one (one hundred twenty-one):
  a judge preferred "Xiawafang" to the archive's XIAWAFANG,
  so the body and its footnote spelled the station two ways;
  the archive's all-capitals form is now restored at page assembly,
  and a corpus census shows the rule firing only on acronyms and names.
- What "ready" would rest on now:
  a rotation over every entry in the read set
  (`XingZ60`,
  `hulicaijia`,
  `mikaela_khara`,
  `shi_Yumiaoya`,
  `zheermao101`,
  `CuspariaKLSY`,
  `yingying`)
  in which every page ships SETTLED and every read finds no class,
  on one frozen build,
  under the seven-hour ceiling,
  on whichever providers are wet.
  No such rotation has completed;
  the longest run of no-class reads on one build is three
  (hulicaijia16,
  mikaela11 on `0f685f551`;
  shi_Yumiaoya17,
  yingying7,
  zheermao7 on `6361d74d0` before class one hundred three).
- The entries never run on a recent build are the rest of the 92-entry corpus.
  The owner's rule stands:
  "We never ever need a all 92 entries launch";
  readiness is claimed on the read set and the classes it stopped finding.
- Money is not the constraint:
  Bedrock 46.57 USD and OpenRouter 92.81 USD at 08:10 UTC,
  a full rotation of the read set about 16 USD on Bedrock and OpenRouter alone.
