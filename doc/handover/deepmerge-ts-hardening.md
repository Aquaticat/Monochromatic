# deepmerge-ts hardening grilling handover

## Status

Shared understanding confirmed 2026-09-23;
implementation authorized.
Track progress in `Planned sequence`.

User constraints from confirmation:
all security findings go into one combined private advisory draft,
all other upstream items go into one combined issue draft,
and both stay local until the user reviews and posts them personally.
Only those two drafts are held (user correction the same day):
the GitHub fork is created and non-embargoed fix branches are pushed to it.
Embargoed repros, properties, and fixes belong to the advisory and stay in `*.local.*` files (Q8).

Findings under disclosure embargo live only in gitignored `*.local.*` files
(see `Embargo`);
this public document never describes them.

## Objective

The user reported that <https://github.com/RebeccaStevens/deepmerge-ts>
"doesn't seem well-tested or fuzzed" and asked to resolve it.
The repo recommends the library in `doc/decision/cli-git-policies-platform.md`
and uses its semantics as the reference for rule-settings merging in `doc/handover/unified-linter.md`;
no workspace package depends on it at runtime.

## Evidence

Upstream audit run 2026-09-23 against `main` at `17fc99cb` (v8.0.2),
in a capped container (`podman run --memory=2g --cpus=2 --rm`, `node:24-slim`):

- Maintenance is active:
   v8.0.0 to v8.0.2 released in 2026-08,
   last commit 2026-09-03,
   zero open issues or PRs,
   private vulnerability reporting enabled.
- Vitest 4 suite:
   285 runtime tests pass,
   plus 109 `tsd` type assertions.
- Coverage is informational only:
   `vitest.config.ts` sets watermarks, not thresholds,
   and `.github/codecov.yml` marks project and patch status `informational: true`.
   Measured totals:
   statements 95.97%,
   branches 90.04%,
   functions 100%,
   lines 95.9%.
- No fuzzing or property-based testing:
   no `fast-check`, `jsfuzz`, or similar in manifests or the lockfile.
- The npm tarball of 8.0.2 ships `dist/index.mjs` and `dist/index.cjs` without source maps
   (`npm pack --dry-run deepmerge-ts@8.0.2`),
   so black-box coverage maps only onto built output.
- Public, non-embargoed defects reproduced by probe:
  - `getCyclicReferenceDepth` in `src/utils.ts` checks `parents.includes(object)` across all inputs' ancestors;
     `deepmerge({ k: s }, { k: { k2: s } })` returns `r.k.k2 === r.k`,
     a cycle absent from every input.
- Untested behaviour:
   getters (invoked and flattened, throwing getters propagate),
   frozen targets and sources,
   `constructor.prototype` and nested `__proto__` payloads,
   `deepmergeInto` with `filterValues`,
   `rootMetaData`,
   sparse arrays (holes dropped by `Array.prototype.flat`),
   merges past the default `maxDepth` of 1000 (silently fall back to last-value-wins).
- Monochromatic is a public repo with auto-push,
   and no fork `Aquaticat/deepmerge-ts` existed on 2026-09-23.

## Decisions

- Q1 and Q6:
   both an in-repo sidecar package `package/module/deepmerge-ts.fuzz`
   and a GitHub fork under the user's account.
   The sidecar is the durable test home using `module-test`, `mise`, and `fast-check`;
   the fork stays on upstream's toolchain and exists only to carry focused fix branches upstream.
- Q2:
   properties check both a reference model of documented semantics
   and invariants (no input mutation, no prototype pollution outside documented `FastUnsafe` variants,
   no crash, identity laws).
   The model is intended to double as the reference for the Rust unified-linter merge.
- Q3:
   upstream issues, PR descriptions, and advisories are drafted locally;
   the user files them.
- Q4 and Q5:
   two modes over the same properties:
   a fixed-seed bounded run inside `test:unit`,
   and an unbounded `fuzz` campaign that runs until a counterexample or interruption,
   persists the replayable seed and path,
   and runs under container resource caps per `RXI` and `BOX`.
- Q7:
   Vitest stays in the fork only;
   upstream PRs add Vitest regression tests in upstream style,
   and this repo never adopts Vitest.
- Q8:
   embargoed findings, their repro, their property,
   and advisory drafts live only in files matching `*.local.*`
   (ignored by `.gitignore:11`);
   they land publicly after upstream publishes an advisory,
   or after 90 days without response.
- Q9:
   the sidecar tests the npm release by default
   and can target a build of a fork branch for source-mapped coverage and pre-release fix verification.

## Settled without asking (veto open)

- The sidecar targets the npm package `deepmerge-ts`,
   not `jsr:@rebeccastevens/deepmerge`,
   because the workspace installs from npm.
- Every exported function is covered,
   including the four `FastUnsafe` variants,
   per `PKG` and `TCV`;
   pollution invariants exempt `FastUnsafe` variants where upstream documents them as unsafe.
- Non-embargoed fix branches may be pushed to the user's fork (`PX3`);
   opening PRs waits for the user (Q3).
- Any further finding with plausible security impact joins the embargo (Q8).

## Embargo

Details:
`doc/handover/deepmerge-ts-hardening.local.md` (gitignored, local machine only).

## Open questions

None.
Frontier empty on 2026-09-23;
confirmed by the user the same day.

## Answered 2026-09-23 (round 5)

- Q14:
   a local draft issue proposes contributing the property suite upstream
   (fast-check under their Vitest);
   contribute only if the maintainer agrees.
- Q15:
   do not propose enforced coverage thresholds upstream.
- Q16:
   the sidecar keeps a V8 coverage-reachability gate with a committed baseline,
   mirroring `package/module/logger.fuzz` `fuzz:coverage`;
   the baseline refreezes when the pinned deepmerge-ts version changes.
- Settled (veto open):
   known unfixed defects never leave `test:unit` red (`PKG`).
   Model-equality properties exclude each known-defect region,
   and a paired known-defect test asserts the defect still reproduces,
   citing its draft issue,
   so an upstream fix flips it and forces re-inclusion.
- Settled (veto open):
   public generators stay inside bounds that avoid embargoed findings;
   the excluded regions are exercised only by `*.local.*` properties until the embargo lifts.

## Planned sequence

1. One combined local advisory draft for every embargoed finding, for the user to file privately.
2. Sidecar `package/module/deepmerge-ts.fuzz`:
   reference model,
   invariants,
   fixed-seed `test:unit`,
   unbounded containerized `fuzz`,
   `fuzz:coverage` gate,
   `README.md`.
3. GitHub fork `Aquaticat/deepmerge-ts`,
   local checkout under `~/temp/agent` pushing only to the fork,
   and sidecar support for targeting a local branch build.
4. Fix branches with Vitest regression tests for non-embargoed defects,
   pushed to the fork;
   no upstream PRs until the user posts the combined issue.
5. One combined local issue draft:
   non-embargoed defects,
   `maxDepth` fallback docs request,
   sparse-hole intent question,
   property-suite proposal.

## Answered 2026-09-23 (round 4)

- Q10:
   the model accepts the silent last-value-wins fallback past `maxDepth`;
   a local draft issue asks upstream to document it.
- Q11:
   sparse-array holes are neither defect nor accepted yet;
   a local draft issue asks upstream for the intended behaviour.
   Until answered,
   model-equality properties generate dense arrays only,
   and one characterization test pins current hole-dropping so an upstream change is noticed.
- Q12:
   getters are accepted as read-and-flatten,
   matching object spread;
   a throwing getter propagating is expected behaviour.
- Q13:
   the Rust fixture export waits for the merge-crate vet named in `doc/handover/unified-linter.md`;
   model cases are written JSON-serializable now.
- Settled (veto open):
   the embargoed advisory draft is written first,
   because its disclosure clock starts only once the user files it.

## Rejected ideas

- Replacing deepmerge-ts with an in-house merge module (Q1 option C):
   duplicates an actively maintained library.
- Dropping the recommendation (Q1 option D):
   pushes untested ad hoc merges onto every consumer.
- Porting upstream's Vitest suite into `module-test` (Q7 V2):
   duplicates passing tests and drifts every release.
- Committing embargoed repro publicly (Q8 C).
