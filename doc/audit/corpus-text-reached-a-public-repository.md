# Corpus text reached a public repository

Found 2026-08-25 while sweeping the package's documentation for line-length violations.
Not a line-length problem.

THIS DOCUMENT QUOTES NOTHING.
It names files and counts, which is the whole discipline that was breached,
so adding the evidence here would repeat the fault it records.

## What is true

The corpus lives in `one-among-us/data`, which is UNLICENSED, meaning all rights reserved.
It is read at runtime by `git show <sha>:<path>` from a pinned clone outside this repository,
precisely so that none of it is ever committed here.
Its entries are memorial pages about real, named, mostly deceased people.

Fifteen documentation files under `doc/` carry Chinese source text from that corpus,
185 lines in total:

-   `doc/handover/translation-repair-history.md`, 65 lines.
-   `doc/planning/wire-the-heading-aligner.md`, 48 lines.
-   `doc/audit/the-critics-are-shown-the-wrong-paragraph.md`, 14 lines.
-   `doc/planning/the-third-rendering.md`, 13 lines.
-   `doc/audit/eight-entries-read-against-the-original.md`, 11 lines.
-   `doc/planning/translation-pipeline-redesign.md`, 9 lines.
-   `doc/audit/the-damage-no-instrument-was-catching.md`, 6 lines.
-   `doc/handover/two-lane-outcome-vocabulary.md`, 5 lines.
-   `doc/planning/which-lane-ships.md`, 5 lines.
-   `doc/planning/translation-repair-milestone-replan.md`, 3 lines.
-   `doc/planning/translation-repair-open-decisions.md`, 2 lines.
-   `doc/audit/stream-guards-first-production-traffic.md`, 1 line.
-   `doc/decision/translation-repair-milestone-split.md`, 1 line.
-   `doc/decision/translation-repair-runaway-call-termination.md`, 1 line.
-   `doc/planning/translation-repair-ensemble-and-naturalness.md`, 1 line.

THAT COUNT IS A FLOOR, not the extent.
It was produced by scanning for Chinese characters,
and the English side of the corpus is in English.
`doc/planning/the-third-rendering.md` carries whole English sentences of one entry's
memorial text, standing and shipped renderings side by side, under the entry's own id.
A scan keyed on script cannot see those, and no scan keyed on anything else has been run.

## Why this matters more than a licence question

The repository is public.
An unauthenticated request to `https://api.github.com/repos/Aquaticat/Monochromatic`
answers 200, which a private repository would not.

The commits are pushed.
Auto-push is enabled, so every commit reaches `origin` as it is made.
The affected commits are contained in `origin/translation-repair-rebased`.
The earliest is `f51c2708b`, dated 2026-08-20,
so this has been publicly readable for five days.

NONE OF THESE FILES ARE ON `origin/main`.
That is the one piece of good news, and it is what makes remediation cheap:
the exposure is a working branch that has never been merged,
so rewriting it destroys no shared history.

## What was believed, and why it was wrong

The working rule recorded across sessions was that corpus text stays out of the repository
and out of the tracker, and lives only in artifacts and grading sheets under run directories.
That rule was relaxed once, in a session, to permit printing corpus text,
qualified as being fine "as long as it doesn't go public on github".

The qualifier was the whole rule and it was not checked.
Nothing verified that the repository was private, and it is not.
The relaxation was about a transcript; it was applied to commits.

## What is not remediation

Deleting the text from the working tree and committing forward
removes it from the tip and from nothing else.
Every affected commit remains reachable and readable on the public remote.
A reader who wants the text is not inconvenienced by a later commit that lacks it.

GitHub also keeps unreachable objects addressable for a period after a force-push,
so even a history rewrite is not instantaneous erasure
and may want a support request to purge caches.

Forks and existing clones are unaffected by anything done here.

## Decided by the owner, 2026-08-25: nothing is removed

Asked, and answered the same day:
exposing corpus text is sometimes fine,
because the owner is friends with the people who run the site the corpus comes from.

So none of the fifteen files change,
no history is rewritten,
the branch is not force-pushed,
and the repository stays public.
A later session finding this document should not reopen it.
The relationship that makes it fine is not visible from inside the repository,
which is exactly why it is written down here.

### What the decision does not license

The instruction that came with it was to take extra care not to expose more in commits later.
"Sometimes fine" is permission, not indifference, and it is not retroactive cover
for adding corpus text without thinking about it.

The rule going forward:
corpus text goes into a commit only when it carries evidence nothing else can carry,
only as much of it as the evidence needs,
and never as a convenience because quoting was easier than naming.
Prefer the entry id and the slice index.
Reach for the passage when the point IS the wording,
as it is where a rendering changed a tense or an aligner paired the wrong headings.

Everything else about handling the corpus stands unchanged:
it is still read at runtime from the pinned clone,
still never committed as corpus files,
and grading sheets and artifacts still live under run directories outside the repository.
