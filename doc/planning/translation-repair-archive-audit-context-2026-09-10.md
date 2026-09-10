# Archive audit context measurement

## Scope and status

Task 20 is in progress.
Task 18's archive retention/revision boundary is verified through `ba01babda`.
No task 20 production change has been made.
No full-entry pass is active;
task 19's temporal/participant context and the full Mio reading remain pending.

## Observed boundary

The compiled stage retains the useful `Translation:` label,
then asks both existing naturalness responsibilities about that exact block.
All fourteen usable replies in
`~/temp/agent/archive-brief-integrated-20260910/report.json`
produce false findings:
most call it missing or empty translation content,
while one criticizes a Chinese heading outside the candidate.
The artifact is not missing the following English transcript.

`package/module/translation-repair/src/archive-block-naturalness.ts`
supplies the whole Chinese section and corroborated picture readings as `sourceText`,
the label as `candidateText`,
and `[blockText]` as the numbered paragraphs.
It supplies no surrounding English archive.
`absolute-naturalness-review-wire.ts` already calls the Chinese context-only
and says not to decide factual fidelity,
so repeating that existing sentence is not evidence of a remedy.

The direct-stage outcome returns those audit findings;
they cannot withhold the block.
`corpus-run/archive-block-repair.ts` retains only operation-level findings,
not those detailed naturalness findings.
Do not claim they caused a page removal or persisted in the final entry artifact.

## Positional evidence

There are repeated `Translation:` blocks in this archive.
The initial probe plan's assumption that the label text identified a unique node failed.
The actual label introducing the unique first chat block is parsed `block/10`,
with offsets `[1796, 1808)` in the archive snapshot.
The corrected plan identifies the chat node,
asserts its preceding node is the expected label,
and uses that node's parser offsets.
It does not split at the first arbitrary text match.

Production already has `UnclaimedTargetBlock.startOffset` and `endOffset`
in `corpus-run/archive-block-repair.ts`.
Any remedy must carry positional context from that ownership boundary,
not guess which identical label was meant inside `runArchiveBlockReviewStage`.
The current caller supplies the original archive snapshot to the review stage;
do not silently substitute later corrected output while claiming matched inputs.

## Experiment

The independent advisor supports testing positional context before adding a scope instruction.
The wording calls the subject the current archive block,
not an already-approved block whose status could bias acceptance.
Context is neither candidate text nor factual authority.
Only numbered candidate paragraphs may receive findings.

Ranked hypotheses:

- Missing English neighbors cause a label to look like a placeholder.
  Adding positional English context alone should remove false missing-content findings.
- The whole-candidate instruction is being mistaken for a whole-source translation obligation.
  With context held fixed,
  a block-scope clarification should remove the remaining false findings.
- Chinese source salience or a remaining role misunderstanding may dominate both remedies.
  If both fail,
  inspect the actual replies before changing the source view or adding another treatment.

`~/temp/agent/probe-archive-audit-context-20260910.mjs`
uses frozen `ba01babda`.
It captures the original asked seats for both audit responsibilities,
not a favorable subset of responses.
Their wider quorum basis remains eleven;
this fixed-seat experiment is per-seat evidence,
not a production-window verdict.

Arms:

- Actual label with the original messages.
  The offline plan proves all fourteen baseline payloads exist before any live call.
- Actual label with positional before/after English context and unchanged system instructions.
- Actual label with that same context plus the block-scope clarification.
- Dangling prose `She were a close friend who` replacing the label at the same position,
  with context and scope.
- Orphan label at the end of the archive,
  with no following content,
  using context and scope.

The actual-label source,
candidate and numbered paragraph bytes remain unchanged.
The first treatment changes only the context input;
the second keeps that input fixed and changes the scope instruction.
Controls are disposable views,
not corpus edits.
The source corpus stays pinned and unchanged.

Inspect exact findings,
not only `acceptable` counts.
Reject a supposed remedy that merely blesses labels or suppresses real grammar/role defects.
Do not introduce a new unanimity requirement,
skip required review,
lower quorums,
add a corrective production round,
or make this audit a withholding gate.

## Initial harness failure

`proc_7777` exited in ten seconds because the captured request retained the offline capture's
`exchangeTimeoutMs: 1000`.
Replacing its abort signal did not replace that independent client exchange bound.
The fourteen cached baseline results reproduce the false findings,
but the treatment groups mostly time out and do not establish a remedy.
Do not credit these timeouts to provider capacity or interpret the partial groups as a comparison.

The log is `~/temp/agent/archive-audit-context-probe-20260910.log`.
Its report remains at
`~/temp/agent/archive-audit-context-probe-20260910/report.json`.
The spend helper records 0.00337427 USD on Bedrock
and 0.00089276 USD of abandoned OpenRouter estimates.
Failed or cancelled usage not reported there is not claimed free.
The daily helper ran afterward.

The corrected capture requests the intended 360000 ms exchange bound.
The plan and each live dispatch assert that the captured field actually has that value.
Completed payloads from the first run remain reusable;
only uncompleted requests may be purchased again.

## Completed corrected run

`proc_724d` completed `translation-repair-archive-audit-context-probe-20260910-r2` in 463 seconds.
The corrected offline plan passed and is saved at
`~/temp/agent/archive-audit-context-plan-20260910-r2.out`.
The log is `~/temp/agent/archive-audit-context-probe-20260910-r2.log`.
The report is
`~/temp/agent/archive-audit-context-probe-20260910-r2/report.json`.

Actual results:

- Baseline: none of fourteen usable replies accept the label.
- Positional context only: two of twelve usable replies accept it;
  two replies fail schema validation.
- Context plus scope: eight of fourteen accept it.
  The remaining replies still report false missing content or the out-of-scope Chinese heading.
- Dangling prose: all fourteen reject it and identify real grammar or sentence-completeness defects.
- Orphan label: thirteen reject it and one accepts it,
  but several rejection reasons still mistakenly demand the whole source passage.
  Numerical rejection alone is not a correct diagnosis.

The context-plus-scope treatment improves the observed replies,
but does not establish elimination of the false findings.
No task 20 production change is yet justified as a complete remedy.
The run logged 0.00070104 USD on Bedrock,
four OpenRouter calls reporting zero,
and twenty unpriced Hyper plus twenty-four unpriced Synthetic calls.
The daily helper ran afterward.

The probe permits at most seventy requests,
seven concurrently,
with a 360000 ms exchange bound and 1200000 ms global bound.
Only new substantive prompts may reach providers;
the baseline reuses completed payloads from a copied disposable cache.
No provider SDK or reasoning-budget parameter is added.

## Active in-place presentation probe

The first presentation places both before/after context ahead of the candidate.
`proc_dc0f` runs `translation-repair-archive-audit-in-place-probe-20260910`
to test whether preserving reading order clarifies the block's function.
It changes only field order:
before-context,
exact candidate and numbered paragraph,
then after-context.
It keeps the scope instruction,
source and candidate bytes,
original asked seats,
response schema and completion caps.

Script:
`~/temp/agent/probe-archive-audit-in-place-20260910.mjs`.
Plan:
`~/temp/agent/archive-audit-in-place-plan-20260910.out`.
Log:
`~/temp/agent/archive-audit-in-place-probe-20260910.log`.
Report:
`~/temp/agent/archive-audit-in-place-probe-20260910/report.json`.

It tests the actual label and both controls,
with at most forty-two requests and seven concurrent calls.
The exchange and global bounds remain 360000 and 1200000 ms.
The prior scoped treatment remains the comparator;
no completed identical request is deliberately repurchased.

At the terminal notification:
read every arm's actual findings,
run the per-provider spend and daily helpers,
choose the supported input remedy,
and only then add its red/green integration guards and production change.
Verify ordinary review prompts remain unchanged when no archive context applies.
Do not make universal model compliance a new acceptance requirement.
