# Translation repair handover, historical record, part 02

Part 02 of [Translation repair handover, historical record](translation-repair-history-01-early-foundation-segment-01-part-01.md),
whose index lists every part in order.

## Immediate next steps

PICK UP HERE (2026-08-15,
after the overnight session).

READ FIRST,
if you are the user coming back to this:
`doc/planning/translation-repair-open-decisions.md`.
It holds the six questions that need your answer,
each with options,
pros,
cons,
a ranking and the measurements taken to make the question answerable.
Question 5 was raised by the bench itself and is the one that blocks wiring.
Everything below is the state those questions sit in.

THE SHORT VERSION OF THE NIGHT,
if you read one paragraph:
 both lanes now run over one preparation and neither is chosen over the other,
 which is the last thing that could be built without your answer to Question 5;
 the reassembled document is checked for broken footnotes in both lanes and a
 replacement that breaks one is withdrawn;
 an aborted run can no longer cache slices nobody examined;
 and the lane's budget is measured from calls already bought,
with the audit
 saying plainly which slices the bench never sampled.
Three defects found by review were fixed and are listed under decisions 14 and
15 and in the census correction below;
 one of them,
a footnote label folded differently by the parser and by our own
 scan,
would have silently thrown away every repair in any document a model
 wrote a word-labelled footnote into.

WHAT CHANGED OVERNIGHT,
2026-08-14 into 15:

-   THE ROSTER GUARD NOW MATCHES YOUR RULING (`285af2867`,
    `#91` guard limb).
    It still required two judges outside the producer set,
    so a roster where
    every model produces threw before any model was asked,
    and the bench below
    could not have run past four producers.
    It now refuses only rosters that could not decide a round however they
    voted,
    measured as available weight rather than as a count of seats.
-   IDENTICAL CANDIDATES MERGE THEIR AUTHORS (`8709e83aa`).
    The editor lane kept
    only the first proposer of identical text and the naturalness lane
    deduplicated nothing,
    so a model could vote at FULL weight for its own words
    whenever another model wrote them first.
    Found by an external review of the
    guard change.
-   SELECTION IS AUDITABLE (`8709e83aa`,
    `e8e5bdfbc`).
    Every ballot carries
    whether it was a self-vote,
    every candidate carries what it drew,
    a
    selection carries the position it won at,
    and the translate stage records
    the rotated slate the judges saw.
    Before this a stored ballot naming
    candidate 2 could not be joined to any text:
    the slate is rotated per slice
    and nothing recorded the order.
-   THE ROSTER-WIDTH BENCH EXISTS AND IS RUNNING (`6602831ee`).
    `mise run //package/module/translation-repair:roster-bench -- 10` over ten
    stratified slices at every width from two to six,
    width inner so each width
    meets the same provider weather,
    one width run twice for a run-to-run band.
    Rows land incrementally in
    `~/temp/agent/roster-bench-2026-08-15/roster-bench/rows.json`,
    log beside it.
    It already showed the band is wide:
    the same slice at the same width judged
    and replaced on one pass and declined for indecision on the next.
-   TWO MEASUREMENT ERRORS OF MINE WERE STRUCK,
    both in the questions document:
    the transcription class is enumerated now rather than estimated,
    and the
    claim that no image marker exists in the markdown was a bad search.

CONTINUED THROUGH THE NIGHT,
2026-08-15 early hours:

-   THE ROSTER GUARD WAS CORRECTED A SECOND TIME (`9e43d5afc`).
    My first weight
    rule measured what a candidate would draw if EVERY producer had a stake in
    it,
    and refused three authors judging only each other.
    That bench decides
    comfortably:
    a candidate one of them wrote draws half a vote from its author
    and a full one from each of the other two.
    Capacity is now measured over the
    most favourable candidate,
    which is the question a guard refusing rosters
    that could not decide HOWEVER they voted has to ask.
    The narrow case it was
    built for,
    one producer judged by itself and one other model at 1.5,
    still
    refuses.
    Found by an external review.
-   A SELECTION ROUND REFUSES A REPEATED JUDGE before spending a call
    (`c5444423b`).
    The stage guard already refused that,
    but `selectPerEnvelope`
    and `selectChunkPatch` are reachable without the stage,
    and two exchanges to
    one model are two ballots from one opinion,
    which reaches the minimum weight
    alone.
-   DOCUMENT PREPARATION IS SHARED (`610ea11b9` splice,
    preparation commit
    before it).
    Parsing,
    identity,
    alignment,
    subdivision and governance now
    live in `prepareDocumentPair`,
    taking no client,
    roster,
    config,
    signal or
    cache.
    Two lanes slicing separately would drift the moment either changed a
    budget,
    and each would still report slices that looked right on its own.
-   SPLICING IS LANE-NEUTRAL AND CAN FILL A GAP (`610ea11b9`).
    It consumes
    replacements rather than repair outcomes,
    inserts into zero-length spans,
    resolves indexes before sorting,
    refuses duplicates,
    and orders several
    insertions at one offset by slice index.
    Three defects went with it,
    each of
    which produced wrong text rather than an error.
-   THE MISMATCH THRESHOLD IS CALIBRATED (`#90`).
    Over all 1260 two-sided corpus
    slices the incumbent-to-source character ratio runs p50 2.95,
    p90 4.10,
    p95
    5.36,
    p99 23.78,
    max 521.9.
    So 3:1 is normal and a cut around 10 flags 25
    slices,
    including every known damage case.
    The bench case that started this,
    `windward0032#10` at 3 characters against 226,
    sits in the worst six.
-   THE BENCH DRAW AND WIDTH SWEEP ARE TESTED (`bench-draw.ts`).
    Both decide
    what a width comparison measures and both failed silently before.

THEN THE LANE GOT ITS DRIVER,
2026-08-15 pre-dawn:

-   ASSEMBLY REFUSES TWO SLICES CARRYING ONE INDEX (`e66a18749`),
    which is a
    wrong-text failure rather than an error.
-   THE ALIGNMENT GUARD LANDED,
    CALIBRATED (`c5e781956`,
    `d319f329e`).
    A
    replacement is refused when the incumbent is at least 128 code points and
    more than 16 times its source.
    Translation still runs and the judges'
    evidence is kept,
    so the record distinguishes "the judges kept the
    incumbent" from "the judges wanted a replacement and the guard refused".
    Calibrated over all 1260 two-sided corpus slices;
    it refuses 16,
    and every
    one of those 16 was read.
-   THE SLICE CACHE IS GENERIC OVER ITS LANE'S VALUE (`003e09f9d`) AND EACH LANE
    OWNS A NAMESPACE (`108329dc2`):
    a file prefix plus its own generation
    marker.
    One shared marker with a directory-wide delete,
    which is what this
    replaced,
    meant a translate change threw away every settled repair slice in
    the corpus and nothing reported the loss.
-   THE TRANSLATE DOCUMENT DRIVER EXISTS (`e2deabf4d`).
    One prepared pair in,
    every slice visited unconditionally,
    one settled record per slice,
    the
    document reassembled from per-slice decisions,
    its own schema version and
    its own cache namespace.
-   THE BENCH FINISHED AND RAISED QUESTION 5 (`7fe82a159`).
    Width does not
    measurably change agreement at n=10,
    but the lane replaced the archive's
    English in 44 of 60 rounds,
    and that is a decision rather than a finding.

AND THEN THE CACHE TURNED OUT TO BE POISONABLE,
which is why no pass should
start before these landed:

-   AN ABORTED RUN WAS CACHING SLICES IT NEVER BOUGHT (`1918c67a1`,
    `d89550076`).
    An abort reaches every exchange as a torn-down stream,
    the
    round records each as a LOST VOICE by design,
    and a stage that heard nothing
    keeps the incumbent and returns an ordinary settled record.
    Both drivers
    wrote that to the cache,
    so an entry stopped at its deadline recorded its
    unexamined tail as decided,
    and every later attempt RESUMED it.
    Both drivers
    now check the signal before buying a slice and again before persisting one,
    and report the abort by the caller's own reason rather than by whichever
    exchange happened to surface.
-   A SLICE NOBODY EXAMINED IS NO LONGER CACHED (same commits).
    Zero translators
    heard,
    or zero critics heard,
    settles in memory for this run and is left out
    of the cache,
    so the next attempt asks again instead of resuming an outage
    as a verdict.
-   A ROUND NOW RAISES A CALLER ABORT THAT LANDS AFTER QUORUM (`182280185`),
    which its own comment already promised.
    Measured on the driver test:
    an
    abort inside the second slice previously let the whole judge roster fan out
    afterwards,
    12 judge calls attempted where 6 were owed.
-   THE REPAIR DRIVER NOW REFUSES A CACHED OUTCOME NAMING ANOTHER SLICE
    (`d89550076`),
    which the translate driver already did.
-   MEASURED,
    NOT ASSUMED:
    the 150 repair slices currently cached carry
    `heardCritics` 3,
    4,
    5 and 6 (1,
    3,
    92 and 54 slices),
    so NONE of them is
    poisoned and nothing has to be invalidated.
    A cache written before these
    fixes could only be resumed under its own pipeline digest anyway,
    and that
    digest has since moved.

AND THEN THE FIRST HALF OF `#92`,
the part that needs no quota:

-   THE REASSEMBLED DOCUMENT IS NOW CHECKED (`b77cff67b`,
    `48e20c20d`).
    A
    footnote is a relation BETWEEN slices,
    and selection settles each slice
    alone,
    so a candidate that drops or renumbers a marker validates perfectly
    inside its own slice and breaks the document.
    The lane now splices,
    parses
    the result,
    and diffs its footnote findings against the archive's,
    so a
    defect the archive already carried is neither blamed on the lane nor
    repaired by it.
    Replacements that broke the graph are WITHDRAWN.
-   IT ITERATES rather than checking once,
    and the case is pinned:
    one slice
    renumbers `[^1]` to `[^2]` while another supplies the `[^2]` definition,
    so
    withdrawing the first is what orphans the second.
    Demonstrated by capping
    the loop at one round and watching that case fail.
-   ATTRIBUTION IS BY ROLE,
    after an external review found the first key too
    coarse:
    a slice that turns `[^1]: the note` into prose saying `see[^1]`
    mentions the identifier exactly as often as before.
-   A DEFECT NOBODY CAN BE BLAMED FOR WITHDRAWS EVERYTHING.
    A stray comment
    opener masks markers document-wide,
    since masking runs over the whole body
    before parsing,
    and no slice's own mention count moves.
    The archive text is
    the one thing certain to parse as it did before.
-   THE LANE'S BUDGET IS MEASURED,
    from calls the bench had already bought,
    in
    `doc/audit/translation-repair-lane-budget.md`.
    Headline:
    594 of 602
    exchanges returned ok and the only failures were the straggler cut,
    both on
    the GLM models;
    a slice costs 10.2 calls and 34567 tokens at width 4;
    one
    corpus pass is 43.6M tokens at that width;
    and against the three-hour entry
    cap every entry fits at the median slice time,
    with the two largest falling
    out at p90.
    So the cap is not the binding constraint it was for repair.
-   MEASURED,
    over all 184 corpus documents at the pinned commit:
    209 GFM
    footnote markers across 45 files,
    and ZERO reference-style link definitions,
    ZERO reference-style link uses,
    ZERO heading-anchor links.
    So footnotes are
    the only cross-slice relation this corpus actually has,
    and the other graphs
    an external review proposed would be built against nothing.
    The
    `〔N〕` convention the parser also supports appears nowhere in this corpus
    either;
    it belongs to the other archive named in `footnote-model.ts`.
-   BOTH LANES ASSEMBLE THROUGH THE GUARD.
    In the repair lane the withdrawal
    also reaches the ISSUE RECORDS:
    an issue whose slice was taken back is
    recorded `withdrawn` and unresolved,
    the same disposition a non-translation
    block already used.
    Crediting it would have overstated precision by exactly
    the repairs no reader saw.
    Both lane guards were demonstrated by disabling
    the guard and watching the cases fail.
-   `repairPreparedDocument` (`b2fba072a`) takes a prepared pair,
    with
    `repairTranslation` the thin entry point that prepares and delegates.
    That
    is what a combined driver needs:
    ONE preparation handed to both lanes.
    Assembly moved to `repair-assemble.ts` and the result types to
    `repair-result.ts` at the line budget;
    `repair-translation.ts` re-exports
    them,
    so callers and the barrel are unchanged.

THEN A REVIEW OF THAT GUARD FOUND TWO THINGS IT BROKE OR LEFT BROKEN,
2026-08-15
morning:

-   A WITHDRAWN REWRITE WAS STILL RECORDED AS WHAT SHIPPED (`48dcce7ba`).
    `finalSliceText` was written whenever the naturalness lane rewrote a slice,
    which was correct until the guard could take a rewritten slice back.
    It is
    now written only where the document carries the rewrite.
    The artifact reader
    required that field of every rewritten record,
    so it had to learn the same
    rule in the same commit or refuse to read the run;
    it now requires it exactly
    where a repair SHIPPED and reads it wherever else it was written.
    The sheet
    says the rewrite was taken back instead of fencing an empty block under "the
    slice as actually returned",
    which is what it did before.
-   SHIPMENT IS NOW ASKED OF THE STEP THAT DECIDES IT (`74dafeb3b`).
    A record
    asks whether this slice's replacement is in the returned document,
    which
    dominance,
    the guard,
    and an unchanged selection can each answer no to.
    The
    third term restates `repairReplacements`,
    which emits nothing for an
    unchanged outcome;
    today that term changes no record,
    because
    `accuracyPatchSelected` is set FROM `changed` and the refine lane only ever
    sets `changed` true,
    but the record no longer depends on another file holding
    that invariant.
    `judgeDisposition` takes `repairReachedReader` rather than
    `blocked`,
    which stopped naming what it receives once the guard existed.
-   FOOTNOTE LABELS ARE FOLDED THE WAY THE PARSER FOLDS THEM (`9322cdaba`).
    mdast keys `[^Note]` and `[^note]` alike and hands back the folded spelling;
    the raw scans this guard attributes with saw the source spelling,
    so a
    finding about `note` was looked up in mentions keyed `Note`.
    Measured before
    the fix on a two-replacement fixture:
    no slice could be blamed and BOTH were
    withdrawn,
    including one that touched no footnote.
    Measured after:
    the guilty
    slice alone is reverted and the innocent edit ships.
    All 209 corpus markers
    are numeric,
    where folding is identity,
    so nothing settled is affected.
    `normalizeFootnoteIdentifier` reproduces `normalizeIdentifier(label)
    .toLowerCase()`,
    and its test compares against a real parse rather than
    against a restatement of the rule.

AND THEN BOTH LANES GOT ONE DRIVER,
which is the last Question 5 neutral piece
of `#89`:

-   `runDocumentLanes` (`document-lanes.ts`) takes one prepared pair,
    runs both
    lanes over it,
    and returns both documents.
    It ARBITRATES NOTHING:
    no winner,
    no preferred lane,
    no merged text,
    because choosing between them is Question
    5 and a driver that chose would answer it invisibly for every later count.
-   SEQUENTIAL,
    REPAIR FIRST.
    Concurrency buys nothing:
    the quota spent is the
    same and both lanes already serialize their own slices for provider-capacity
    reasons.
    Repair goes first because its naturalness phase settles AFTER the
    slice loop and nothing persists what that phase produced,
    while the translate
    lane caches every slice as it finishes;
    under a deadline that cuts the entry,
    running the uncheckpointed phase first loses less of what was bought.
    That
    reasoning is an external reviewer's and it is recorded in the driver.
-   NO ABORT CHECK BETWEEN THE LANES,
    deliberately.
    Both drivers let a fully
    cached lane finish after an abort,
    since resuming buys nothing,
    and a gate
    there would refuse that.
-   ALIGNMENT FINDINGS ONCE,
    at the top level:
    they belong to the preparation
    both lanes shared,
    so counting them per lane would count one defect in the
    archive twice.
    The repair result still repeats them inside its own findings,
    which is that lane's existing contract and was left alone.
-   `repairPreparedDocument` NOW TAKES A PARENT LOGGER,
    defaulting to the
    pipeline root,
    so both lanes read as one entry rather than as two runs.
-   THE ABORT CASE COULD NOT PIN THE CONTRACT,
    and finding that out is the
    reason there are two failure cases rather than one.
    A driver that caught the
    repair lane's failure and ran translate anyway still passes an ABORT test,
    because the translate lane refuses on its own once the signal is aborted:
    two different mechanisms produce the same observation.
    The case that pins it
    hands the repair lane a cache whose resumed outcomes name other slices,
    which the driver refuses with nothing aborted anywhere.
    Demonstrated by
    swallowing the repair failure in a scratch build:
    that case fails at exactly
    the assertion that encodes the contract,
    and the abort case passes.
-   BOTH LANE RESULTS NOW NAME THEIR SLICES,
    not just count them:
    `shippedChunkIndices` and `withdrawnChunkIndices` on each.
    Read off the
    guard's own surviving replacements,
    because a per-slice record says what
    that slice CHOSE and the document may carry something else;
    a comparison
    built from the records would credit a lane with slices it did not change.
    The repair artifact records both,
    so the withdraw rate is countable over a
    settled directory.
    Artifacts from before 2026-08-15 lack the fields,
    and a
    reader must treat that as unknown rather than as empty.
-   THE BENCH NOW PRICES SENDING AND ANSWERING SEPARATELY (`95b93ff9b`),
    which
    was the first remaining item of `#92`.
    `BenchCall` carries `promptTokens`
    and `completionTokens` beside the server's own total,
    and the summary prints
    all three.
    The wrapper had NO tests at all before this;
    five cases cover
    both halves,
    the missing-total fallback,
    the no-usage case,
    schema naming,
    a
    recorded and rethrown transport failure,
    and the quota read that stays off
    the rows.
    The 602 exchanges already bought keep only their totals and cannot
    be re-split.
-   AND THE WIDTH SWEEP WAS RE-READ PER STAGE (`a4ba5b505`,
    `601a3af1f`) at no
    new cost,
    by grouping the same rows by response schema.
    The budget audit had
    said the judge round "is the same size at every width":
    true of its calls,
    which sit at 5.4 per slice at every width from three up,
    and FALSE of its
    tokens,
    which rise 58% from width 2 to width 6.
    It still dominates at both
    ends,
    60% of a slice at width 2 and 52% at width 6,
    so a cheaper decision
    procedure saves more than a narrower producing roster.
    The character
    arithmetic in Question 1 had predicted a ballot growing 69% from width 3 to
    6;
    the measured figure is 38%,
    because a ballot also carries the policy,
    the
    source and the incumbent,
    none of which widen.
-   WHAT NEITHER MEASUREMENT MAY CLAIM,
    corrected the same morning after a
    review caught it:
    WHICH HALF of a ballot grows is not knowable from rows
    carrying one total per exchange,
    and the first bench under the split is what
    settles it.
    The `CallTokens` TSDoc,
    the audit and the decisions doc had each
    asserted a mechanism (a prompt repeating every candidate) and a provider
    behaviour (a total exceeding both halves) that nothing here measured.
    Both
    now read as open.
    Keeping the stated total needs no such claim anyway:
    report what the provider billed rather than a derivation,
    and fall back to
    the sum only for servers that state no total.
-   BOTH LANES NOW REPORT WHAT THEY DECIDED FOR EVERY SLICE,
    beside the
    archive's own wording,
    and a pure function compares the two documents slice
    by slice.
    `LaneSliceText` (`lane-slice-text.ts`) is one entry per PREPARED
    slice:
    index,
    incumbent,
    accepted.
    `compareDocumentLanes`
    (`lane-comparison.ts`) joins two lane results on the index and names each
    slice `archive-stands`,
    `repair-only`,
    `translate-only`,
    `both-agree` or
    `both-differ`.
-   THE SHIPPED FLAG IS DELIBERATELY NOT ON THE SLICE RECORD,
    which is the whole
    design.
    Whether a slice shipped is decided by an assembly guard reading the
    WHOLE document,
    and the same slice can ship in one run and be withdrawn in
    the next when a neighbouring replacement changes.
    Membership in
    `shippedChunkIndices` is that fact.
    Putting it on a per-slice record would
    put a per-run verdict on a cacheable record,
    which is the defect class the
    last three days were spent removing;
    the translate lane's slice records are
    literally its cache values,
    so a resumed slice would have served a stale
    verdict.
    The comparison reads the index sets and derives what each document
    carries:
    accepted where it shipped,
    incumbent where it did not.
-   AND FOR THE SAME REASON THE WORDINGS ARE BUILT AT THE DOCUMENT LEVEL,
    from
    `prepared.slices`,
    rather than stored per slice.
    An incumbent belongs to a
    PREPARATION;
    a slice resumed from an earlier run would otherwise report the
    wording that preparation had then.
    Neither lane's cache schema changed,
    so
    the 150 settled repair slices on disk survive this.
-   COVERAGE IS CHECKED RATHER THAN ASSUMED.
    `buildLaneSliceTexts` throws
    `LaneSliceCoverageError` when a lane leaves a prepared slice undecided or
    names a slice the preparation never produced,
    and `compareDocumentLanes`
    throws `LaneComparisonError` on differing slice counts,
    a missing slice,
    or
    two lanes disagreeing about one slice's incumbent.
    All three mean the two
    sides came from different preparations,
    which no later reader could detect:
    the rows would line up and describe different passages.
-   THE BLOCKED REPAIR EXIT NOW CARRIES WORDINGS TOO,
    which closes a consumer
    trap a review had flagged:
    that exit returns both index sets empty while
    every issue record reads `withdrawn`.
    Read with the wordings it now states
    "this lane had repairs and the document carries none of them",
    which two
    empty sets alone could not say.
-   AND THE FIRST VERSION OF IT WAS WRONG,
    caught by an external review before
    it was committed.
    `repairPreparedDocument` runs the dominance check INSIDE
    the slice loop and returns at the earliest crossing,
    so the blocked exit
    holds FEWER outcomes than prepared slices.
    A builder that demanded a
    decision per slice threw there,
    which would have turned a documented
    blocked result into a crash.
    `acceptedText` is now `string | null`,
    null
    meaning the lane never reached that slice,
    and the builder takes an
    explicit policy:
    `refuse` where the lane visits everything,
    `not-evaluated`
    only where it stops early by design.
    The tests did not catch it because no
    test drives the blocked exit with a partial outcome list,
    which is itself
    worth fixing.
-   THREE SOL REVIEWS LANDED ON 2026-08-15 MORNING and their findings are
    recorded as tasks rather than left in the transcript:
    `#93` (empty-roster
    placement,
    now answered:
    the check belongs in `repairPreparedDocument`
    because `runDocumentLanes` bypasses `repairTranslation` entirely),
    `#94`
    (index contracts claim sortedness,
    uniqueness,
    disjointness and range and
    enforce none),
    `#95` (a cached slice can claim a change it did not make),
    `#96` (the artifact is repair-only,
    unversioned,
    and cannot express
    unknown),
    `#97` (a checker verdict may describe pre-refinement text),
    `#98`
    (equal section counts skip the aligner entirely),
    `#99` (`chunkIndex` means
    three different things),
    `#100` (one-sided slicing:
    the design answers),
    `#101` (splice ordering and separator ownership),
    `#102` (what remains of
    the delivery ledger).
    Read `#98`,
    `#99` and `#100` together:
    they are one
    change to how a slice gets its identity and its span.
-   AND BOTH LANES NOW REFUSE A CHANGE THE DOCUMENT DOES NOT CARRY
    (`assembly-invariant.ts`).
    `assertReplacementsChange` runs before the
    footnote guard and refuses a replacement that repeats its slice's incumbent,
    or names a slice the preparation never produced.
    `assertDocumentChangeAgrees` runs after assembly and refuses a returned
    document that disagrees with its own change set in either direction.
    And
    `orderedChangeSets` checks both index sets against each other,
    integers,
    in
    range,
    no repeats,
    disjoint,
    and returns BOTH ascending:
    the withdrawn one
    never was sorted,
    so two lanes compared slice by slice were being read from
    lists ordered by different rules.
    `RepairTranslationResult` also carries
    `sliceCount` now,
    which the translate side always had and which is what a
    standalone consumer needs to range-check an index at all.
-   THE REACHABLE WAY IN WAS THE SLICE CACHE,
    which is why these are assertions
    rather than comments.
    A cached record is trusted on its chunk index alone,
    so one claiming a change while holding the archive's own wording reached the
    guard,
    survived it untouched,
    and landed in the shipped set beside a
    document nobody changed.
    A truncated write that still parses,
    or a slicing
    that moved while the pipeline digest did not,
    both produce that record.
-   THEY THROW,
    and that is not obviously right:
    both run after model calls
    costing minutes and quota,
    inside a pass that settles one entry at a time.
    A throw loses the entry's unpersisted work;
    a finding lets a wrong count
    settle into an artifact.
    Nothing is at risk today because no pass is
    running.
    `#95` records the open question and the measurement that would
    settle it,
    which is whether `ChunkRepairOutcome.changed` can be true while
    the repaired text equals the incumbent:
    the cached outcomes on disk do not
    carry the incumbent,
    so answering it needs a re-preparation of each entry,
    which costs no quota.
-   AND THE FIRST OF THE REVIEW FINDINGS WAS MEASURED RATHER THAN QUEUED.
    `#98`
    says the aligner's mirrored fast path skips alignment whenever the section
    counts match,
    which is `#71`'s defect arriving by an uncovered path.
    Over
    the pinned corpus:
    85 of 92 pairs take that fast path,
    and the forced
    aligner would pair NONE of them differently.
    The positive control ran first
    and shows the probe can see the defect,
    on invented headings with one
    section dropped and one added.
    But the same control also shows the forced
    aligner pairing three WHOLLY UNRELATED headings by position without a single
    refusal,
    and on this corpus every source heading is Chinese against an
    English target,
    so it has no signal to work from and degrades to exactly the
    positional pairing the fast path already does.
    THE ZERO IS NOT EVIDENCE THE
    85 PAIRINGS ARE RIGHT;
    it says running the aligner on them would change
    nothing,
    because the aligner is blind here.
    That is the same blindness `#71`
    named and the instrument weakness `#74` is about,
    so `#98` alone would land
    a change that provably alters no pairing while looking like a fix.
-   WHAT IT STILL DOES NOT DO.
    Nothing CALLS `compareDocumentLanes` yet:
    the
    corpus pass writes a repair-only artifact,
    and wiring it for two lanes is
    the part Question 5 shapes.
    The settled artifact also records no per-slice
    wording,
    so a grader reading a settled directory still cannot see what a
    lane decided for a slice it did not ship.
    That is the remaining `#89` item
    and the same work as the `sliceSelections` artifact field;
    the contract it
    needed now exists.
