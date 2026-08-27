# Corpus-pass overlap measurement

## Question

Choose corpus-pass slice-overlap fallback from matched live runs,
without confusing provider speed, cache resumes, or entry mix for an overlap effect.
Fallback remains `1` until this measurement is read.

## Launch invariant

Every arm uses:

- same committed build and built-in `180000` ms straggler window;
- same entry in each pair;
- no other provider-consuming process;
- a fresh run root, including separate artifacts, published pages and slice cache;
- explicit `TRANSLATION_REPAIR_SLICE_OVERLAP=1` or `4`;
- launch through the package `corpus-pass` mise task so both provider credentials are injected;
- overlap log line as arm attribution: `OVERLAP <entry> value=<n> source=TRANSLATION_REPAIR_SLICE_OVERLAP`.

No source rebuild or code commit lands between paired arms.
Documentation may be updated because running bundles do not import it.

## Live provider gate

`budget-sample` immediately before launch must report both providers wet.
The 2026-08-27 preflight did:
`~/temp/agent/pre-overlap-pass-budget.log`.
A provider outage voids timing from the affected pair rather than becoming evidence against its arm.

## Staged entry set

### Smoke pair

Run `keyword233` first at overlap `1`, then overlap `4`, in disjoint roots.
It is a live positive control for environment attribution, provider routing,
interleaved slice admission and artifact publication.
If preparation yields fewer than two eligible slices in a measured driver,
use `Weideriche_` as the smoke pair before starting the decision set.

### Decision pairs

Use these entries, one pair at a time:

- `ArtsEpiphany`, a one-slice null control;
- `Zha_Ke`;
- `keyword233`;
- `Weideriche_`;
- `Toka_ls`, a historical editor-fabrication hard case;
- `XIEPT2`, a historical pairing hard case.

Alternate arm order by entry so first-arm timing is not confounded with time of day.
The smoke pair may count as `keyword233`'s decision pair only after its launch mechanics and outputs verify.

If the paired normalized effects disagree or remain inside their own spread,
repeat pairs interleaved rather than forcing a conclusion from one run each.

## Readings per pair

Read only package-owned templates from logs.
For each arm record:

- TALLY status and wall milliseconds;
- stream elapsed sum, median and tail from `run-timing-report`;
- wall milliseconds divided by stream elapsed sum;
- rounds heard, configured voices, straggler cuts and recovery rounds;
- stage and provider failure counts;
- spend and provider meter state;
- settled artifact and `verify-published` result;
- persisted slice counts by namespace when an entry fails.

The effect is credible when paired wall-over-stream ratios improve consistently outside their observed spread.
Raw wall time alone cannot decide: unchanged calibration arms moved 37 percent with provider speed,
while their normalized spread was about 0.03.

## Quality gates

Overlap cannot become fallback when it adds an entry error,
loses a page or destination,
fails `verify-published`,
increases voice loss beyond the paired run's provider evidence,
or produces an unexplained persistence difference.

Refinement is the one driver without an in-run twin memo.
Check logs and artifacts for repeated refinement questions,
stream-sum inflation and refine-only between-arm differences before closing that caveat.

## Output-reading continuation

After deciding the fallback,
run the remaining fresh-reading entries under the selected arm:
`gaoyanger`, `Acheron`, `wangzihao980`, `dogesir_`,
plus any decision-set entry without a settled readable artifact.
Run `XingZ60` separately under the selected arm.

Each settled page is read against source and archive,
then checked by `verify-published`, rendering audit and damage probe.
Every defect is traced to artifact slice, lane and ballots before it is filed.
The durable reading record remains
`doc/audit/translation-repair-output-reading-20260826.md`.
