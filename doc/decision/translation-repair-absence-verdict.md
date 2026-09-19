# What counts as proof that a passage was never translated

Decided 2026-08-23. The owner delegated this one: the standing instruction is maximum quality,
which determines the answer without a preference being needed.

## The question as posed was wrong

It offered four options, A through D, as alternatives.
Three of them are not alternatives at all.

-   A, ask a roster whether the whole translation carries the passage, is the only one that
    PRODUCES an absence verdict. Nothing else here can.
-   C, require corroboration beyond the matcher's refusal, is a FILTER on a verdict.
    It cannot decide anything on its own, and it costs nothing to apply to A's output.
-   B, fix alignment, improves the CANDIDATES both of the others operate on.
    It is upstream of the question rather than an answer to it.
-   D, park both landings, is the only genuinely exclusive option, and maximum quality rules it
    out: entries measured this session run at 0.37 and 1.88 English characters per source
    character against a corpus median of 2.65, so the gaps are real and large.

## Decision

Take A as the verdict, gate insertion on C's corroboration, and land B as well.

-   THE COVERAGE ROSTER SUPPLIES THE VERDICT. It never consults the pairing, so the mispairings
    this question was opened over cannot reach it, and one mechanism answers both scales.
-   NO INSERTION WITHOUT DETERMINISTIC CORROBORATION. The roster must call the passage absent
    AND the page must be measurably too short to hold it. A false insertion duplicates text in
    a memorial page, which is the expensive error; a missed insertion leaves a gap the archive
    already had.
-   ALIGNMENT WORK LANDS TOO, because it decides which passages are ever asked about.

## Why the roster is trusted with it

Measured 2026-08-23, over six entries:

-   It notices a deleted rendering. Absence votes appeared on 8 of 9 targeted cuts, where the
    cut removed exactly the spans the roster itself had anchored on.
-   It does not simply react to damage. An equally sized cut taken where the roster had not
    pointed produced absence votes on 0 of 9.
-   It reproduces. The targeted arm returned identical verdicts on two runs, and the coverage
    path holds no cache, so the agreement was bought rather than replayed.

## Why corroboration is required anyway

English characters per source character, whole page, over all 92 pairs:
p5 1.42, p25 2.28, p50 2.65, p75 3.00, p95 4.52.

The three entries where the roster refused to call any candidate covered rank 2, 11 and 12
from the short end. The three where it called passages carried and noticed their deletion rank
55, 77 and 80. No overlap.

Two independent signals, one of which consults no model, agreeing on every entry measured.
Requiring both loses nothing that was measured and guards the case where they disagree,
which is exactly the case nobody has seen yet and therefore the one to be careful about.

## Both scales land

The recorded case against paragraph scale is "at most one of twenty-two, and plausibly none",
drawn entirely from `mikaela_khara`. That entry ranks 77 of 92 for translation completeness,
so it was the wrong place to learn what block candidates are made of.
On `shi_Yumiaoya`, rank 2, the roster called 7 of 8 blocks absent with 4 to 6 of 6 voices.

Block candidates remain the noisier population and the merge-versus-omission ambiguity is
sharpest there, which is precisely what the corroboration gate is for:
a merge leaves the content somewhere in a page of normal length,
so a merged pair fails the length test even when the roster is unsure.

## Addendum: local destination corroboration and publication refusal, 2026-08-27

The current-build `Toka_ls` output falsified one premise of page-wide shortfall:
a page of ordinary aggregate length does not imply every passage was merged somewhere.
Verbose translations elsewhere hid an entirely absent linked paragraph naming death date,
time, cause, location and age.
The artifact recorded source-only slice 13 as `not-corroborated`, bought no translation,
and published a known `gap-remains` page.

The decision is therefore refined:

-   The whole-document coverage roster must call source-only passage `absent`.
-   Independent deterministic corroboration is either remaining page-wide shortfall budget
    or a destination carried by that passage and absent from whole target page.
-   `carried`, `partly-carried`, `split` and `inconclusive` all refuse insertion.
-   Any passage still unfilled makes corpus entry fail before contest, artifact and publication.
    A known omission is evidence for retry or diagnosis, never settled output.
    This includes admitted passage whose translator roster loses every voice;
    provider outage retains cache and reports entry error rather than publishing gap.

The destination path reuses `dropped-destinations.ts`, including Markdown definitions,
bare addresses and trailing-slash equivalence.
It cannot repair a link-free omission hidden by aggregate length;
the publication refusal makes that residual class loud rather than silent.

Implemented in commits `c151e57ca` through `598401349`.
Unit cases cover both corroborators and all coverage verdict classes;
pass-level cases prove evidence reaches translation,
the linked passage reaches page,
and an unresolved gap writes neither page nor artifact.
Removing publication guard, pass handoff, destination corroborator,
coverage-absence conjunct or archive normalization makes its named guard test fail.
Logs: `~/temp/agent/gfp-toka-gap-*.log`.
Whole-package suite passed 834 cases with zero failures after names-only inventory correction;
log `~/temp/agent/buildAndTest-toka-gap-fix-v2-20260827.log`.
The widened current production roster passed live absence control on 2026-08-27.
Over three damageable cases it moved two targeted cuts from `carried` to `absent`
with 10 and 9 of 10 absence votes,
moved third to `partly-carried`,
and cast zero absence votes on all three equal-size decoys.
Both providers were wet throughout.
Log: `~/temp/agent/coverage-control-current-roster-20260827.log`.
Fixed-build `Toka_ls` then settled 15 wordings with zero silent and preserved source destination.
The omission and invisible-byte blocker is closed.
Page remains outside strict readiness for separate inherited person error that contest tied on;
see `doc/audit/translation-repair-output-reading-20260826.md`.

## Addendum 2026-09-18: one container's halves are admitted together

The coverage round reads each source-only slice on its own,
and the slicer gives a container's opening tag to the first block inside it and its closing tag to the last
(`container-extents.ts`),
so a disclosure block the archive never carried is two or more source-only slices:
the opening half with its summary,
the body,
the closing half.
On XingZ607 the round split on the summary of two such blocks
(one voice anchored a poem's title in another summary the archive does carry)
while every voice found their bodies absent and the page short of them.
The bodies and closing halves were admitted,
the opening halves were not,
and the translate lane assembled a page with two closing tags and no opening,
which the strict grammar refused and the guard answered by withdrawing every slice of the lane.

A container is one element.
Once any slice of it is admitted on its own evidence,
the page is short of the element,
and both halves are admitted with it
(`insertion-container-halves.ts`,
finding `insertion-container-half-admitted`).
The two signatures this decision requires are read at the container:
the roster left its body unplaced and the page is measurably short of it.
A container none of whose slices is admitted stays unfilled whole.
Independently,
both assemblies withhold a half whose partner ships nothing
(`assembly-container-halves.ts`,
finding `assembly-container-half-withheld`),
so no later refusal of one half can put the other on the page alone.

## Addendum 2026-09-19: a definition ships with the marker that references it

The whole-page shortfall budget is spent over the absent-voted passages in document order,
and a page's footnote definitions stand last.
On XingZ608 the passages before them spent 10,714 of a budget of 10,794 code points,
the eight definition slices were refused,
and the translate lane's assembly then reverted every slice carrying a marker with no definition,
one of them holding the page's only rendering of a source link;
the entry stopped at publish.

A marker the page will carry with no definition under its label is the page's own footnote graph saying the definition is absent.
That is an independent signal of the same kind as a missing destination,
which this decision's first addendum already reads past the budget,
so a definition whose label the standing page or an admitted slice references,
and which nothing on the shipping page defines,
is admitted with the marker
(`insertion-referenced-definitions.ts`,
finding `insertion-definition-admitted`).
The two signatures are still read:
the roster left the definition unplaced,
and the page's graph is measurably short of it.
A definition nothing references stays with the budget.

The budget's own reading of a page whose archive stops early and runs long was an open question,
answered in the next addendum.

## Addendum 2026-09-19: the untranslated tail is budgeted from the pairing

Owner,
2026-09-19,
"Do #1".
The whole-page budget treats a page the archive left unfinished as one whose translated part is complete:
XingZ60's archive ends at "Under Construction" with the source's second half untranslated,
its translated half runs at about 3.3 code points per source code point against the median of 2.65,
and the budget read 10,794 where the untranslated half alone expects about 14,900 at the page's own rate.

The region that gets its own budget is the untranslated tail:
every source-only slice after the pairing's last agreed pair,
expected at the page's own expansion over its paired slices
(`coverage-tail.ts`).
Not a neighbour-sized window:
measured over every run that left an artifact and a log,
a window of one paired neighbour each side refused passages the pages needed
(hakureico's last line,
8 of xiept2's 25 interior passages,
shi_Yumiaoya's slice 4),
because one paragraph's expansion is noisy by more than a small passage's size.
The whole-page budget stays for the interior,
with an admitted tail's source left out.

The second signature stays model-free.
The pairing is a roster's work,
so "nothing after the last pair" is not the deterministic reading this decision requires;
size is.
A tail whose expectation exceeds the last agreed pair's whole rendering cannot have been merged into it,
the one place a tail could hide,
and is admitted on that bound;
a smaller tail stays with the whole-page budget.
The roster-free `admitInsertions` path,
which has no coverage verdict as its first signal,
is unchanged.

## Addendum 2026-09-19: inside the admitted tail the bound decides a split

Class sixty,
XingZ610.
The tail rule first admitted absent verdicts and unanchored splits alone,
the pool the whole-page budget spends from.
Three tail slices,
two paragraphs and the second footnote definition
(split on every run of the entry),
stayed unresolved because one voice anchored a claim of coverage on an archive line the pairing had assigned to nobody,
and shipped as gaps.
A split is no majority for coverage;
where the bound has already said the tail cannot be on the page,
a minority claim does not stand it down,
and the slice is admitted with `insertion-split-in-tail` naming the tallies.
A verdict a majority carried
(`carried` or `partly-carried`)
still stays out of the admission,
as does a split outside the tail,
which the whole-page budget never spends on.

## What this supersedes

`doc/planning/translation-repair-open-decisions.md` question 28, whose ranking was A > C > B > D
and which framed the four as exclusive. The wiring gate recorded on `#106` is released by this
decision, and the stopgap copy in `doc/handover/translation-repair-history.md` is replaced by this file.
