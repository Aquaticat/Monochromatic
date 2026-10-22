# Translation repair handover 2026-09-06: the landings, the zheermao22 restart and the state after K4, 2026-10-21

The landings of w262 and w260,
the runs `zheermao22`,
`CuspariaKLSY22`
and `XingZ6017` with the classes K1 to K4 their reads found,
the queue after them,
and the state after K4 landed.
This is the newest file of the record:
open it for the current state and the next steps.

Part of [Translation repair handover snapshot: 2026-09-06](translation-repair-handover-2026-09-06.md),
which lists every file of this record.
It continues [the reboot, Gemma measured and the katex shim](translation-repair-handover-2026-09-06-neuralwatt-provider-2026-10-20-the-reboot-gemma-measured-and-the-katex-shim.md).

The landings and the restart,
2026-10-21:

- Gate g146 on the w262 merge failed lint:
  oxlint 1.89.0,
  which main had taken in `148f47c951`,
  added `unicorn(prefer-string-raw)`,
  and 18 test files wrote backslash-bearing strings as escapes.
  `b81dbe9b0c` rewrote those 106 lines as `String.raw`,
  each value unchanged,
  and gate g147 was green
  (2732 pass,
  0 fail).
  w262 landed as `c0d0325899`.
- w260,
  merged with `b81dbe9b0c` and main,
  had gate g148 green at `2a336603bf`
  (2732 pass,
  0 fail)
  and a clean rotation sweep under salts 0 to 9;
  it landed as `2a336603bf`.
- Corrective comments were posted on `b1a88def13`
  (commitcomment-206042846:
  9 of 14 cases failed before the fix,
  not 9 of 15)
  and on `97e17dc6dc`
  (commitcomment-206042849:
  the run package's readers-bench cases stay red from that commit until `d1e463bb46`).
- The branch worktree was rebuilt at `2a336603bf`.
  The corpus-pass build digests to
  `sha256-tree-v1:5d4265dfab83b5a6e61b5b8c23d597519c7ca24293065473c883ec82af54c78c`
  there and in the gated `tr-w260` alike,
  and the launcher holds that digest as the rotation's frozen build.
  No second sweep ran:
  the clean sweep was on the same commit.
- `zheermao22`
  (entry `zheermao101`)
  started at 21:05:30 UTC,
  and its START line names the frozen digest.
  It ended with `DONE processed=1 of pending=1; artifacts=1/1 declined=0`
  after 4741466 ms
  (79.0 min,
  against 40.7 min for `zheermao21`).
  Its read
  (`zheermao22-read.md` in the reads folder,
  23:16 UTC)
  found the email and the opening quote recovered and Arts's letter regressed.
  The extra time came from stragglers:
  Synthetic went dry at 22:14:48 UTC while Hyper stayed wet,
  so Qwen,
  Kimi and mercury replies held rounds open,
  and rounds that waited 100 s or more of grace rose from 7 to 30.
  It names three code classes and one design class:
  - K1:
    NeuralWatt text calls carry no `reasoning_effort`
    (`neuralwatt-client.ts:392` and `:424` send it on picture calls only),
    so `glm-5.3-flash` runs at its default `max`.
    Four of its text calls ended at the 18,316-token cap with no content
    (SPEND lines at 21:17:32 UTC,
    21:20:36 UTC,
    21:37:15 UTC and 21:40:06 UTC),
    and three of the Hyper re-asks after them capped too.
    The owner's lift ("only for NeuralWatt") covers text calls as well.
  - K2:
    `STREAM_FIRST_BYTE_MS` and `STREAM_IDLE_MS` are 600,000 ms
    (`stream-idle-guard.ts:60` and `:89`),
    longer than the 360,000 ms per-call timeout,
    so neither guard can fire;
    and an SSE comment line resets the idle timer.
    Eleven `inception/mercury-2.5` streams sent no content and were cut only by the 120 s grace.
  - K3:
    a minor accepted repair claim is lost when the lane contest settles `neither`,
    because the polish writers are never shown the accepted claims
    (slice 8's 因着 claim,
    accepted 4 to 1).
  - K4
    (design):
    the composite revision refuses any revision that changes a block's line count,
    so the letter shipped a partial revision.
  - Untraced:
    Hyper returns tool input with its keys in alphabetical order
    (200 of 227 multi-key objects),
    so the reason-before-vote ruling cannot be confirmed on Hyper without a keyed probe;
    and the boundary between slices 1 and 2 moved against `zheermao21`.
- `CuspariaKLSY22`
  (entry `CuspariaKLSY`)
  started at 22:25:13 UTC,
  and its START line names the frozen digest.
  It ended SETTLED
  (`slices=4`,
  `repairChanged=4`,
  `alignmentFindings=1`)
  after 2355731 ms
  (39.3 min).
  Its read
  (`CuspariaKLSY22-read.md` in the reads folder,
  23:41 UTC)
  found the page mixed:
  slices 0 to 2 better than `CuspariaKLSY21`'s,
  slice 3 worse
  ("When she came to" loses 又;
  "rushed" and "her friend" added).
  No new ruling was shown to act:
  the three polish gates settled by lead,
  and the one consolidation tie
  (slice 2,
  weight 1)
  left no slate in the artifact to say whether a run-off was owed.
  It confirms two findings of the `zheermao22` read on a second entry:
  102 of 103 Hyper vote replies have their keys in alphabetical order,
  against reason first on all 44 from NeuralWatt and OpenRouter;
  and 33 `inception/mercury-2.5` streams were abandoned with no content,
  each waited out to the grace,
  because the tally never counts an abandoned call against its seat
  (`seat-tally.ts:120` to `122`).
  It also shows the run still asks Bedrock once per run and is refused with HTTP 401 before holding it out,
  though the owner ruled to leave Bedrock off,
  and that `METERS` lines read `bedrock=wet` while `JUDGE SEATS` reads `bedrock=dry`.
  NeuralWatt's plan meter rose 37.3 Wh over the run against 21.11 Wh of this run's own calls;
  the rest is most likely other use of the account in that window,
  which is unverified.
- `XingZ6017`
  (entry `XingZ60`)
  started at 23:05:12 UTC,
  and its START line names the frozen digest.
  It is the first `XingZ60` run since the Gemma readers were lifted.

Next,
in order:
fix K1,
K2,
K3 and the run-off line that says "2 tied finalists" for a plurality
(`translate-runoff.ts:90`)
in a new scratch worktree,
and K4 in a second one;
then a third round:
Bedrock off by configuration so no run asks it,
the `METERS` and `JUDGE SEATS` readings of a held provider made to agree,
a seat whose streams keep ending with no content counted against that seat
(it is never counted now,
so every round waits it out),
and Hyper's key order
(either schema keys whose alphabetical order is the declared order,
or a keyed probe first if that is cheaper to decide);
gate each,
land,
rebuild the branch worktree once no pass runs there,
digest,
sweep,
and restart the rotation at `zheermao23`.
K4 is done in `tr-w264`
(ledger B803,
open to the owner's veto,
landed `f829fc31b6` after gate g149 passed with 2,734 tests and no failure):
the composite now reads each revision by a line diff and composes hunks that do not collide.
Replayed over the `zheermao22` artifact,
none of the three refused attempts builds under it either,
since each pair collides on a real line
(the letter's two revisions both change line 7),
so it would not have changed what shipped.
The letter that shipped is the one complete revision,
chosen by the judges over whole texts,
not a fallback.
The same worktree breaks the B712 and B714 ledger entries at their semantic boundaries:
that file failed the Markdown linter on main,
as do eight more translation-repair docs
(96 findings in all),
which the gate never lints.
`tr-w266` fixes those and adds a guard so the gate does
(ledger D35,
head `0a7cef6278`):
a source scan in `source-scans` runs the Markdown linter over the package docs and the living repository docs
and fails on any finding.
It stays red until `tr-w264` lands,
since the B712 file is fixed there,
so the order is:
gate g149,
land `tr-w264`,
merge main into `tr-w266`,
gate it,
land.
Outside the D27 living set,
33 older translation-repair docs
(`the-third-rendering*`,
`two-lane-*`,
`wire-the-heading-aligner`,
`critic-attribution`,
`artifact-stores-*` and others)
carry 5,423 line-break findings.
The `--fix` rewrap changes neither their words nor their parsed tree,
so a later round fixes them too and widens the guard to them;
the D27 archive families
(history segments,
dated snapshots,
run-continuity parts,
interface candidates)
stay byte for byte.
Meanwhile the rotation continues on `2a336603bf` for evidence:
finish the read of `CuspariaKLSY22`,
record both reads in the pass log and the readiness signal,
and read `XingZ6017` when it ends;
then continue the rotation with `yingying`,
`hulicaijia`,
`mikaela_khara`,
`shi_Yumiaoya`
and `TianqiChen666`.
The `@deepseek-ai/dsh-*` lockfile drift
(alpha.4 to rc.2,
from `package/dsh-plugin`)
is another session's and stays out of these commits.
Whether oxlint 1.89.0 also breaks lint in packages outside translation-repair is unmeasured;
those packages are other owners'.

State after K4 landed:
- `tr-w266` merged main cleanly at `9a69585ed1`;
  gate g150 runs on it,
  and it lands when green.
- The `CuspariaKLSY22` read is filed:
  landed `f2d0885976`
  (the gemma-lift restart planning files for `cuspariaklsy22`,
  the pass log index and the readiness signal).
- The third round is in `tr-w265`.
  Bedrock off (B760),
  silent abandons counted against the seat (B761)
  and `METERS` agreeing with `JUDGE SEATS` (B763)
  are fixed there with their tests green.
  Hyper's key order (B762) has its scan written red:
  sixteen answer schemas declare their properties out of alphabetical order.
  Decided,
  open to the owner's veto:
  rename or reorder so that every schema's declared order is its alphabetical order,
  keeping the ruling "Reason first everywhere" and the exceptions B732 recorded,
  instead of a keyed probe of where Hyper sorts,
  because that order holds on every provider whatever the probe would show.
  An agent does the rename in `tr-w265` after merging main;
  then gate it and land.
- `tr-w263`
  (K1,
  K2,
  K3 and the run-off wording)
  is done in twelve commits:
  NeuralWatt GLM text calls send `reasoning_effort` `low`,
  the stream guards count only generated text and refuse bounds past the call deadline,
  the polish writers see the accepted repair claims
  (`CONSOLIDATE_CACHE_VERSION` 29 to 30),
  and the run-off line tells a tie from a plurality.
  Its K1 ledger entry took B803,
  which main already holds for K4,
  so it is renumbered.
  Decided,
  open to the owner's veto:
  the first-content window goes from 120 s to 180 s,
  since the logs record only time to first byte,
  a lower bound,
  and the largest healthy first byte was 115.7 s;
  the idle window stays 120 s.
  Also decided:
  the polish round's rewrite judges are shown the same accepted claims,
  by the rule that judges of a text see what its writer saw,
  and the dispute note reaches the polish writers if the polish gate is shown it.
  An agent makes these changes after merging main;
  then gate and land it,
  one gate at a time with `tr-w265`.
  Commit `e13dc11c610e` has scope `translate-stage` where the package name is `translation-repair-translate-stage`;
  it gets a corrective commit comment once it lands.
- `tr-w266` landed `a334a5f794` after gate g150
  (2,735 tests,
  no failure).
  The older family docs are rewrapped in `tr-w267`
  (36 docs read by a shared stem list in `living-docs.test-fixture.ts`,
  5,511 findings to none,
  words and parsed tree unchanged in all 36);
  gate g151 runs on `0994fbf492`,
  and it lands when green.
  Left after it,
  decided and open to the owner's veto:
  the 20 `doc/audit` docs
  (1,432 findings)
  and the 14 troubleshooting docs
  (171 findings)
  made under the family's commit scopes are the family's,
  so a next round rewraps them and adds their stems;
  six of those troubleshooting docs hold only `rust/require-rustdoc` on fenced Rust code,
  which a rewrap cannot clear,
  so that round reads each fence first.
  The three repository-policy docs
  (`doc/planning/unused-import-lint-policy.md`,
  `doc/decision/corpus-deny-list-for-forbidden-strings.md`,
  `doc/decision/forbidden-strings-cannot-gate-corpus-text-by-shape.md`;
  136 findings)
  govern the whole repository,
  so they are left to their owners.
- `google.gemma-4-e2b` is served only by Bedrock,
  so with Bedrock off it stays an unserved seat under the 2026-09-09 short-bench rule;
  open to the owner's veto.

State after `tr-w263` landed,
2026-10-22 (UTC):
- `tr-w267` landed `8e2d156d72` after gate g152.
  Gate g151 had failed on the line limit:
  the rewrap left `wire-the-heading-aligner.md` at 2,256 lines,
  so it was filed by subject as an index and eight files,
  with the pointers by position that crossed files turned into relative links.
- `tr-w263` landed `e336d8efc7` after gate g154
  (2,744 tests,
  no failure),
  and its worktree is retired.
  Its K1 ledger entry is B807.
  The corrective comment on `e13dc11c610e` is commitcomment-206074575.
  Gate g153 had failed because this handover held 1,017 lines and the streams ledger 1,010:
  the lead session had landed docs-only commits without running
  `mise run //package/translation-repair/source-scan:test:unit`,
  the only task that runs the line-limit guard,
  so main was red.
  Both files were split by subject in `tr-w263`,
  D35 moved to `audit-ledger-markdown-linter-gate-and-the-split-of-long-docs.md`,
  and the prevention docs now require that task before any docs-only landing.
- `tr-w268` brings the 20 `doc/audit` docs and six troubleshooting docs made under the family's scopes under the Markdown guards
  (45 stems),
  and files the picture-reading audit by subject.
  It merged main as `e82d2cb260`,
  carrying its closed account of D35 into the new D35 file;
  gate g155 runs on it,
  and it lands when green.
  Left out:
  the three repository-policy docs and two oxlint plugin troubleshooting docs,
  which belong to other owners,
  and six troubleshooting docs whose only finding is `rust/require-rustdoc` on fenced Rust quoted word for word.
  Exempting those six needs a linter configuration change,
  which needs the owner's approval first.
- `tr-w265` waits for its B762 rename agent;
  then it merges main,
  which now holds `tr-w263`'s changes to the consolidation sheets and cache versions,
  gates and lands.
- The ledger numbers B800 to B809 that `tr-w260` reserved are stale:
  main's ledger already holds B803 to B807 from other rounds,
  so a new entry takes the next number free on main.
- `XingZ6017` still runs in the branch worktree;
  read it when it ends,
  with the `XingZ6016` read as the template.
  After `tr-w265` lands and no pass runs there:
  rebuild the branch worktree,
  digest it,
  set the launcher's frozen digest,
  run the rotation sweep,
  and restart the rotation at `zheermao23`,
  then `CuspariaKLSY23` and `XingZ6018`.
