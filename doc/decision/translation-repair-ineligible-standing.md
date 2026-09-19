# Consolidation refuses to ship a standing the deterministic gate rejected

Decided by the owner on 2026-09-04 ("Yes:
prefer the best valid proposal,
else fail the slice at once"),
asked with two options after the luxuanwen3 pass of that day.

## What happened

- luxuanwen3's archive front matter broke the identity rule in `validateFrontMatterTranslation` (see
    `translation-repair-front-matter-guard.md`,
    addendum of the same day).
    The translate lane kept the
    archive-shaped text,
    so the consolidation's standing text was ineligible from the start.
- `consolidate-driver.ts` logged `slice 0: consolidation standing text fails publication eligibility and
    remains retryable`,
    then bought its single attempt:
    the slate carried two valid proposals,
    the judges
    endorsed the standing over them (three ballots calling the archive's shape "the declared translated
    identity"),
    and `consolidate-slice-buy.ts` shipped it "with the finding recorded".
- `assertFrontMatterComplete` refused the assembled page (`invalid-page`) 63 minutes and 2.61 USD later:
    `TALLY luxuanwen3 status=INCOMPLETE`,
    no page (`~/temp/agent/luxuanwen3-shapes-20260904.log`).
- The same shape awaits every entry whose archive metadata breaks a structural rule the page guard
    enforces,
    the 15 archives naming the directory id among them.

## The rule

- The driver's `standingValid` (the deterministic `validateTranslatedSlice` verdict on the standing text)
    reaches the settlement as `standingEligible`,
    separately from `standingMayShip`,
    which is contest
    endorsement.
- When the standing is ineligible,
`settleConsolidation` withholds it from the slate:
the judges are asked
    with `incumbentKind: 'absent'` and no incumbent candidate,
    so they choose among the valid proposals or
    decline.
    The settlement records `ineligible-standing-withheld` among its findings.
- Every exit that would keep the standing throws `ConsolidationStandingIneligibleError` naming the slice
    and the terminal:
    an empty floor (`incumbent-only`),
    a judges' decline (`slate-declined-standing`,
    re-raised from the judge's absence error with that error as the cause),
    and a gate that keeps the
    standing (`gate-kept-standing`).
    A `consolidated` terminal ships as before.
- The entry stops at that slice,
before the remaining slices are bought.

## What this is not

- Not the no-loop decision reopened.
The single attempt of `consolidate-slice-buy.ts` stays for a standing
    that merely lacks contest endorsement:
    that standing has passed the deterministic gate,
    and quality
    machinery may not withhold the entry over it.
    An ineligible standing was never going to ship.
- Not a second judged round.
Preferring the best valid proposal is the judges' existing choice over a slate
    without the incumbent,
    bought once.

## What landed

- `consolidate-ineligible-standing.ts` (error class,
`slateIncumbentFor`,
`requireShippableTerminal`),
    threaded through `consolidate-slice-buy.ts` and `consolidate-driver.ts`;
    `consolidate-settle.ts` split
    its context and its gate-and-ship halves into `consolidate-settle-context.ts` and
    `consolidate-settle-gate.ts` at the line cap.
- Guards in `consolidate-settle.unit.test.ts` (withheld standing ships the proposal;
    gate-kept,
    declined and empty-floor exits throw) and `consolidate-driver.unit.test.ts` (a repair-lane standing that dropped a
    source destination now fails the slice,
    since the publisher refuses such an entry through `DroppedDestinationError`),
    shown to fail with the withholding and the refusal neutralised.

## Option rejected

- Keep the late refusal at the page guard:
    no code,
    but every such entry pays a full run before failing,
    which is what luxuanwen3 did.

## Addendum 2026-09-09: a valid incumbent is kept where the standing is ineligible

Decided by the owner on 2026-09-09 ("Keep the incumbent"),
asked with two options after the sixth `Mio` on Bedrock alone:
at slice 3 the translate lane's standing failed the deterministic gate,
the archive's paragraph and list for that slice were valid and were never offered,
and the entry stopped under the rule above.

- The consolidation reads the gate's verdict on the incumbent
    (`row.incumbentText`,
    the page text the slice replaces)
    beside the standing's.
- When the standing is ineligible and the incumbent is eligible,
    the slate offers the incumbent in the standing's place (`incumbentKind: 'present'`),
    the settlement records `ineligible-standing-replaced-by-incumbent`,
    and every exit that kept the standing keeps the incumbent instead:
    the empty floor,
    the judges' decline and the gate's refusal.
- When both are ineligible,
    or the standing is the archive's own text (luxuanwen3,
    where the two are one),
    the rule of 2026-09-04 stands and the entry stops.
- The reason of 2026-09-04,
    that an ineligible standing was never going to ship,
    does not reach an incumbent that can.
    The option rejected,
    stop as now,
    costs the page over one slice whose safe text exists.
- What landed:
    `consolidate-standing-verdict.ts` reads the incumbent's verdict and returns the wording the settlement runs
    against (`settlementText`),
    the replacement finding and `incumbentStandsIn`;
    `consolidate-driver.ts` runs the settlement and its cache key against that wording and carries the finding
    through `consolidate-slice-buy.ts` into the judged round;
    the artifact's shipped kind `incumbent` (`artifact-two-lane-consolidate.ts`,
    read by `artifact-two-lane-read-consolidate-parts.ts`) says a kept standing is the incumbent's text,
    and `would-ship-text.ts` writes it,
    since a bare "unchanged" would have the page assembled from the lane's wording the gate refused.
- Guards shown to fail with the replacement neutralised:
    `consolidate-standing-verdict.unit.test.ts` (stands in;
    both fail;
    the standing is the incumbent),
    `consolidate-driver.unit.test.ts` ("KEEPS A VALID INCUMBENT",
    beside the 2026-09-04 case whose incumbent fails too and still stops),
    `artifact-two-lane-read-consolidate.unit.test.ts` and `would-ship-text.unit.test.ts` for the shipped kind.

## Addendum 2026-09-18: a gate that settles on neither over an ineligible standing ships the slate's choice

Taken under the rule of 2026-09-04 itself
("prefer the best valid proposal,
else fail the slice at once"),
after XingZ604 stopped INCOMPLETE at 4h53m on its slice 13.

- The archive's funeral paragraph and the contest winner both carried the original's neutral pronoun
    untranslated,
    so the standing was ineligible and no incumbent could stand in
    (the 2026-09-09 addendum's "both are ineligible" case).
- The slate,
    with the standing withheld,
    chose a valid proposal 3 of 4.
    The consolidate gate went 5 of 7 usable with neither rendering at quorum over the other,
    and the gate's tie rule kept the standing;
    `requireShippableTerminal` refused `gate-kept-standing` and the entry stopped.
- The gate's indecision is not a refusal.
    Its fallback to the standing is a conservative default,
    and an ineligible standing offers nothing conservative to keep;
    stopping there discards a valid text the judges endorsed,
    which is the opposite of the rule's first clause.
- `shipPastUndecidedGate` (`consolidate-ineligible-standing.ts`) now resolves a `neither` verdict toward
    the consolidation when the standing is ineligible,
    recording `undecided-gate-ships-proposal` on the settlement,
    and `gateAndShip` wraps and ships that outcome.
    A gate that refuses the consolidation at quorum still keeps the standing and still stops the slice;
    an eligible standing keeps the slice on indecision exactly as before.
- Guard shown to fail first (`b8b32e28d`):
    `consolidate-settle.unit.test.ts`
    ("SHIPS THE PROPOSAL THE SLATE CHOSE when the standing is ineligible and the gate settles on neither",
    with the eligible-standing contrast in the same case).
    Fixed in `0d0747200`.

## Addendum 2026-09-18, second: a tied slate over an ineligible standing is challenged once

Taken under the same rule after XingZ605 stopped INCOMPLETE at 4h08m on the same slice 13,
this time at the slate:
four valid proposals,
the judges 2 to 2,
and the decline named `slate-declined-standing`.

- The translate lane has challenged a declined slate once under `decline-challenge` since class fifty-three,
    narrowing a tie to the candidates that drew a ballot (`judgeSlateWithRetry`).
    The consolidation called the judge directly and gave the slice up on the first decline.
- `settleConsolidation` now routes the slate through the same challenge when the standing is ineligible,
    because there a decline stops the entry;
    an eligible standing keeps its single round,
    because there a decline keeps text the contest endorsed.
- A slate declined twice still ends the slice as before.
- Guard shown to fail first (`c6ec06788`),
    fixed in `adca69d4e`.

## Addendum 2026-09-19, sixth: a run-off is decided on the ballot floor

Taken under the same rule after mikaela4 stopped INCOMPLETE at 24 min on slice 28,
the Epilogue,
whose contest standing merged two of nine lines:
the slate 1.5 to 1 to 1 to 1,
the run-off over the two leaders 1.5 to 1 with two abstentions,
both calling the finalists ineligible on grounds the rule had answered,
`slate-declined-standing`.

- The fourth addendum left a run-off short of the minimum to end the slice.
    That is the case where the judges who chose agreed
    and the judges who abstained answered a question the run-off did not ask:
    the finalists were valid by the rule and by the slate's own verdicts,
    so the question was which,
    and an abstention answers neither.
- In a run-off (`runoff` passed from the retry with the finalists),
    the leader wins on the two-ballot floor under the weight minimum,
    carrying `select-runoff-under-minimum`;
    the minimum stands everywhere else.
- A run-off whose leader one judge alone named,
    or that ties,
    still ends the slice.
- Guard shown to fail first (`49b9dccca`),
    fixed in `6a9a7ce27`.

## Addendum 2026-09-19, fifth: the translate slate carries only what the rule accepts

Taken under the same rule after XingZ615 stopped INCOMPLETE at 2h41m on slice 91,
the closing poem,
`slate-declined-standing` with one floor-valid candidate,
the Chinese original respaced.

- The standing was ineligible because the translate lane's judges chose a candidate the deterministic rule had refused
    (the attribution moved out of the quote)
    over two valid renderings;
    the lane keeps a refused candidate on its slate after its repair turn
    (the decision of 2026-08-14),
    and the judges do not apply the rule.
- `translate-floor.ts` now withholds from the translate slate every candidate the rule still refuses after that turn,
    recorded as `translate-candidate-refused`;
    the repair turn and the model's defence are unchanged,
    and a rule that cannot say keeps the candidate.
    This is "prefer the best valid proposal" applied one stage earlier,
    and it narrows the 2026-08-14 reading;
    the owner may veto it.
- The untranslated check compares in all but whitespace,
    so a copy of the original with respaced quote lines is refused at every floor.
- Guards shown to fail first (`636d56a8c`),
    fixed in `6eada935a`.

## Addendum 2026-09-19, fourth: the run-off is over the leaders

Taken under the same rule after XingZ613 stopped INCOMPLETE at 3h02m on slice 84,
the `其九：空白` heading,
whose archive rendering drops a line:
four valid proposals,
the judges at 1.5 to 1 to 1 against the minimum of 2,
the challenge round the same three-way question,
the same split,
`slate-declined-standing`.

- The class fifty-three run-off offered every candidate that drew a ballot,
    which on a plurality is the slate less the unnamed;
    the candidates below the leaders have lost the ranking as surely as the unnamed ones.
- `runoffFinalists` now offers the leaders alone:
    the candidates tied at the top on a tie,
    the leader and its runner-up on a plurality under the minimum,
    the runner-up by weight,
    then ballots,
    then slate position.
    Two candidates is a question a bench of whole and half ballots settles unless it abstains.
- The minimum and the two-ballot floor are unchanged;
    a run-off short of them still ends the slice as before.
- Guard shown to fail first (`9176c9819`),
    fixed in `4193495fa`.

## Addendum 2026-09-18, third: the gate is told when the standing cannot ship

Taken under the same rule after XingZ606 stopped INCOMPLETE at 3h04m on its slice 33,
this time at the gate:
the slate chose a valid proposal,
the gate kept the ineligible standing 4 of 5,
and the log said nothing of why.

- The gate sheet showed the ineligible standing as a rendering to keep and asked which of the two the
    original supports better,
    a comparison against a text that was never going to ship.
- `readStandingVerdict` now returns the refusal it logs (`standingRefusal`),
    threaded through `consolidate-driver.ts`,
    `consolidate-slice-buy.ts`,
    `consolidate-settle.ts` and `consolidate-settle-gate.ts` to the gate subject,
    and `buildConsolidateGateMessages` says the standing cannot ship,
    why,
    and that choosing it stops the entry.
- `gateConsolidatedSlice` logs every ballot with its model,
    choice and reason.
- A gate that refuses at quorum still stops the slice:
    the rule of 2026-09-04 is unchanged,
    the judges are informed.
- Guards shown to fail first (`90e5e2a19`):
    `consolidate-gate-wire.unit.test.ts` (the block on the sheet,
    absent over an eligible standing)
    and `consolidate-settle.unit.test.ts` (the refusal reaches every gate sheet).
    Fixed in `139a7f99a`.
