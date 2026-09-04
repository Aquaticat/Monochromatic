# Consolidation refuses to ship a standing the deterministic gate rejected

Decided by the owner on 2026-09-04 ("Yes: prefer the best valid proposal, else fail the slice at once"),
asked with two options after the luxuanwen3 pass of that day.

## What happened

- luxuanwen3's archive front matter broke the identity rule in `validateFrontMatterTranslation` (see
    `translation-repair-front-matter-guard.md`, addendum of the same day). The translate lane kept the
    archive-shaped text, so the consolidation's standing text was ineligible from the start.
- `consolidate-driver.ts` logged `slice 0: consolidation standing text fails publication eligibility and
    remains retryable`, then bought its single attempt: the slate carried two valid proposals, the judges
    endorsed the standing over them (three ballots calling the archive's shape "the declared translated
    identity"), and `consolidate-slice-buy.ts` shipped it "with the finding recorded".
- `assertFrontMatterComplete` refused the assembled page (`invalid-page`) 63 minutes and 2.61 USD later:
    `TALLY luxuanwen3 status=INCOMPLETE`, no page (`~/temp/agent/luxuanwen3-shapes-20260904.log`).
- The same shape awaits every entry whose archive metadata breaks a structural rule the page guard
    enforces, the 15 archives naming the directory id among them.

## The rule

- The driver's `standingValid` (the deterministic `validateTranslatedSlice` verdict on the standing text)
    reaches the settlement as `standingEligible`, separately from `standingMayShip`, which is contest
    endorsement.
- When the standing is ineligible, `settleConsolidation` withholds it from the slate: the judges are asked
    with `incumbentKind: 'absent'` and no incumbent candidate, so they choose among the valid proposals or
    decline. The settlement records `ineligible-standing-withheld` among its findings.
- Every exit that would keep the standing throws `ConsolidationStandingIneligibleError` naming the slice
    and the terminal: an empty floor (`incumbent-only`), a judges' decline (`slate-declined-standing`,
    re-raised from the judge's absence error with that error as the cause), and a gate that keeps the
    standing (`gate-kept-standing`). A `consolidated` terminal ships as before.
- The entry stops at that slice, before the remaining slices are bought.

## What this is not

- Not the no-loop decision reopened. The single attempt of `consolidate-slice-buy.ts` stays for a standing
    that merely lacks contest endorsement: that standing has passed the deterministic gate, and quality
    machinery may not withhold the entry over it. An ineligible standing was never going to ship.
- Not a second judged round. Preferring the best valid proposal is the judges' existing choice over a slate
    without the incumbent, bought once.

## What landed

- `consolidate-ineligible-standing.ts` (error class, `slateIncumbentFor`, `requireShippableTerminal`),
    threaded through `consolidate-slice-buy.ts` and `consolidate-driver.ts`; `consolidate-settle.ts` split
    its context and its gate-and-ship halves into `consolidate-settle-context.ts` and
    `consolidate-settle-gate.ts` at the line cap.
- Guards in `consolidate-settle.unit.test.ts` (withheld standing ships the proposal; gate-kept, declined and
    empty-floor exits throw) and `consolidate-driver.unit.test.ts` (a repair-lane standing that dropped a
    source destination now fails the slice, since the publisher refuses such an entry through
    `DroppedDestinationError`), shown to fail with the withholding and the refusal neutralised.

## Option rejected

- Keep the late refusal at the page guard: no code, but every such entry pays a full run before failing,
    which is what luxuanwen3 did.
