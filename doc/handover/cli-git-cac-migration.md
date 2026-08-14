# cli-git CAC migration assessment handover

## Status

Assessment started on 2026-08-14.
The user narrowed this session to CAC only.
No other external CLI parser technology may be discovered,
audited,
scored,
or ranked.
No recommendation or adoption decision exists yet.
No product code,
dependency,
configuration,
or decision-record change is authorized by this assessment.

Keep this handover current when the evidence phase,
requirements,
hypotheses,
findings,
rejected paths,
or next action changes.
Detailed evidence belongs in
`doc/audit/tech-cli-git-parser-migration-to-cac-vet-2026-08-14-a48b54e2.md`.
The unqualified same-day report is the superseded broader-scope record and must not receive new evidence.

## User request

Assess the practicality of migrating `package/git-policy/cli/` to the open-source npm CLI framework CAC.
Write this handover immediately and refresh it during the assessment.

The practical question is not only whether CAC can parse one command.
The assessment must determine whether it can replace the consumed parser surfaces without weakening Git argv fidelity,
management-command diagnostics,
policy safety,
package distribution,
or platform behavior.

## Authority boundary

This is an evaluation request.
Documentation and reports may change in the main worktree.
Product code,
dependencies,
configuration,
build artifacts,
and lockfiles must not change.
Any migration probe must use a disposable fixture or throwaway worktree.
A later explicit adoption request is required before implementation or a decision record.

## Initial repository checkpoint

- Baseline branch: `main`.
- Baseline commit: `54ad78083e8baf95c62d3b0682843967722c563d`.
- Target package: `package/git-policy/cli/`.
- `package/git-policy/cli/package.json` currently declares neither CAC nor Optique.
- Its runtime dependencies are `nano-spawn`,
  `rolldown`,
  `type-fest`,
  `typescript`,
  `valibot`,
  `yuku-ast`,
  and `yuku-parser`.
- `package/git-policy/cli/src/management-parser.ts` describes a repository-owned management-command grammar that replaced
  the `@optique/core` facade.
- `package/git-policy/cli/src/parser/argv.ts` describes a repository-owned Git argv region parser that replaced
  `@optique/core` option parsing.
- Several source comments still use Optique terminology.
  These comments are historical signals,
  not evidence that Optique remains installed.
- The existing platform decision is `doc/decision/cli-git-policies-platform.md`.
- The existing implementation-state handover is `doc/handover/cli-git-policies-platform.md`.
- Unrelated modified files existed before this assessment:
  `.serena/project.yml`,
  `package/music-player/desktop-app/src/ui_binding_tests.rs`,
  and `package/music-player/desktop-app/ui/app.slint`.
  Do not stage,
  restore,
  stash,
  or otherwise disturb them.

## Governing evaluation method

The assessment follows `.agents/skills/choosing-technology/SKILL.md` at commit
`a05818ad70a40e5769a36de669697ba109891b31`,
SHA-256
`393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`.

CAC is an inspectable open-source local technology.
The applicable overlays are:

- incumbent replacement,
  where the incumbent is the current repository-owned parser set;
- high-trust execution,
  because cli-git shadows `git`,
  enforces safety policies,
  and runs in hooks and automation;
- multi-platform behavior,
  subject to the package's actual supported platform contract;
- human auditability,
  because parser behavior controls whether commands are blocked,
  transformed,
  or forwarded to real Git.

The repository-owned parser set remains only as CAC's replacement-parity baseline.
No other external CLI technology is in scope.
CAC cannot receive a practicality conclusion from README or registry metadata alone.

## Current parser map

The target does not have one replaceable parser boundary.
The measured source map at baseline is:

- `package/git-policy/cli/src/parse-global-options.ts` locates the real Git subcommand,
  applies ordered `-C` semantics,
  and preserves global help and version short-circuits.
- `package/git-policy/cli/src/management-parser.ts` implements the closed `git cli-git` grammar.
  It is 265 physical lines,
  including declarations and TSDoc.
- `package/git-policy/cli/src/parser/argv.ts` is the shared subset parser used by management and Git-region parsers.
  It is 415 physical lines and has eighteen direct unit cases.
- `package/git-policy/cli/src/parser/` contains twenty production TypeScript files and 3,953 physical lines.
  Most of this surface is Git-specific classification rather than generic command routing.
- `parseArgv` or `tryParseArgv` is consumed by management plus the `add`,
  `clean`,
  `reset`,
  `stash`,
  `commit`,
  `push`,
  and `status` regions.
- Branch creation uses a separate linear scan over `branch`,
  `checkout`,
  and `switch` because it must model creation modes,
  Git's accepted option abbreviations,
  option arity,
  and implicit remote-branch guessing.
- Commit parsing separately normalizes attached short-option values,
  identifies pathspecs,
  and extracts transaction paths.
- Clean parsing separately resolves left-to-right positive and negated mode toggles.
- Add parsing separately distinguishes broad staging tokens from option values and pathspecs.

A technology result therefore needs an integration shape:

- keep the owned parsers;
- use CAC only for the closed management namespace;
- use CAC for management plus shared Git-region tokenization while retaining Git-specific scanners;
- or replace every parser path with CAC plus adapters.

The last shape cannot be credited with deleting the complete parser directory unless a prototype demonstrates the Git-specific
facts without recreating those scans around CAC.

## Frozen hard constraints

These constraints come from current source,
`package/git-policy/cli/SPEC.md`,
`doc/decision/cli-git-policies-platform.md`,
and maintained CI or performance contracts.
A candidate or integration shape that fails one is ineligible.

- Preserve exact wrapper argv until an explicit cli-git transform or escape removal owns a change.
- Preserve Git global-option layout,
  chained `-C`,
  and real Git help or version short-circuits before management dispatch.
- Preserve the complete management grammar in `package/git-policy/cli/SPEC.md`.
- Preserve successful namespace and trust help on stdout with exit `0`,
  before real-Git resolution,
  transaction recovery,
  config discovery,
  candidate building,
  or trust-registry access.
- Preserve usage failures on stderr with exit `2` and no repository config load.
- Preserve pathspec bytes after `--` without wrapper reinterpretation.
- Preserve repeated `--policy` values,
  stable first-occurrence deduplication,
  exact scope validation,
  and unknown-option rejection for management commands.
- Preserve Git-region subset behavior where undeclared options remain forwardable,
  declared values may begin with `-`,
  options may follow positionals,
  joined values are classified correctly,
  and a missing declared value fails closed.
- Preserve Git-supported long-option abbreviations and short-option clusters wherever current guards depend on them.
- Preserve fail-closed policy facts for ambiguous or malformed guarded invocations.
- Keep the package-root import side-effect free and the packed package to one self-contained MJS artifact.
- Support the package's Node range,
  `^22.18.0 || >=24.11.0`.
- Keep Linux,
  macOS,
  and Windows compatibility exercised by the cli-git host-evidence matrix.
- Remain within every maintained lifecycle budget.
  The current `wide-commit` wrapper-added ceiling is 925 milliseconds for 256 changed paths in the bounded benchmark.
- Pass the complete relevant upstream suite and cli-git consumer-boundary suite from a disposable,
  secret-free environment.
- Use inspectable source with compatible license,
  source-to-package provenance,
  and no unaudited native,
  Wasm,
  downloaded,
  or generated runtime boundary.

## Frozen soft criteria

The user supplied no priority ordering,
so every applicable criterion has weight 1 before candidate-specific evidence is rated:

- net removal of repository-owned parser and adapter code;
- human auditability of the resulting parse and forwarding boundary;
- runtime and bundle overhead within the hard budget;
- direct and transitive runtime dependency surface;
- TypeScript inference and declaration compatibility;
- help and diagnostic control without process-global interception;
- upstream maintenance and release health;
- migration and regression-test burden;
- future management-command extensibility;
- fit with the existing pure-parser plus process-adapter seam.

A structurally avoided risk receives a strong evidenced rating.
No soft score can offset a hard-gate failure.

## Questions the evidence must answer

- Which cli-git parsing surfaces are true framework candidates,
  and which are Git-specific scanners that a general CLI framework should not own?
- Can CAC preserve tokens after `--`,
  repeated values,
  option values beginning with `-`,
  Git global options,
  long-option abbreviations,
  clustered short options,
  wrapper-only escapes,
  and unknown or future Git syntax where cli-git must fail conservatively or forward unchanged?
- Can CAC express the `git cli-git` management grammar and its exact stdout,
  stderr,
  help,
  and exit-code contracts without relying on process-global side effects?
- Does CAC permit pure parsing with injectable argv and output,
  or would integration require intercepting process mutation or termination?
- What runtime dependency,
  transitive dependency,
  source-size,
  maintenance,
  license,
  release,
  and package-artifact changes would migration introduce?
- Does CAC's TypeScript surface preserve cli-git's static command and option guarantees under this repository's compiler and
  declaration settings?
- Does a migration delete more repository-owned parser complexity than the adapter and compatibility code it adds?
- Which current tests establish replacement parity,
  and which consumer-boundary fixtures are missing?

## Assessment sequence

1. Inventory every parser entry point,
   caller,
   behavior branch,
   test,
   and public diagnostic contract in `package/git-policy/cli/`.
2. Freeze hard constraints and equal-weight soft criteria from measured repository evidence.
3. Freeze and run the CAC-only discovery query schedule.
4. Screen CAC through license,
   provenance,
   security,
   platform,
   source,
   maintenance,
   and auditability gates.
   Use the incumbent only for replacement parity.
5. Clone serious external candidates under private `~/temp/agent/` paths and inspect the consumed source paths.
6. Validate finalists equally,
   then exercise relevant cli-git boundaries in secret-free disposable fixtures.
7. Score validated finalists,
   run sensitivity checks,
   and publish pros,
   cons,
   a complete ranking,
   and either a recommendation or an explicit no-recommendation result.
8. Synchronize this handover after each material evidence phase and complete the CAC-only vet report before concluding.

## Evidence log

### 2026-08-14 initial checkpoint

The first repository read changes the framing from "replace Optique with CAC" to "compare CAC with the current owned parser
set."
The package manifest shows Optique has already been removed.
The key practicality threshold is therefore net simplification with strict behavioral parity,
not removal of an installed framework.
This is a starting hypothesis only.

### 2026-08-14 incumbent audit checkpoint

Repository history shows that cli-git removed Optique on 2026-07-15:

- `1e53f52e02989b152576c0683f6f228b24c40140` added the owned Git argv region parser;
- `4879a44e6a2460ab3c2531744e24a1f2aef27aeb` moved commit-region parsing to it;
- `be3c522375d9c2652f44921c7396233c93c2397d` moved management parsing and removed the dependency.

The change was not only dependency cleanup.
The commit history records a thousand-path commit taking 4.24 seconds through Optique,
with 2.56 seconds in discarded option-mismatch suggestion work,
then 0.89 seconds through the owned parser.
Treat these values as historical motivation,
not a current CAC comparison.
The maintained benchmark now measures thirty recorded runs after six warm-ups in a bounded two-CPU,
2 GiB container.
Its 2026-07-16 wide-commit evidence had a 456.3-millisecond maximum wrapper-added result for 256 changed paths;
the current contract allows 925 milliseconds.

The source audit also shows why a framework-wide migration may be a category mismatch.
The closed management grammar is conventional CLI parsing.
The forwarded Git surfaces are partial semantic inspections of an external grammar:
they intentionally accept unknown future options,
model only guard-relevant arity,
and leave raw argv for real Git.
CAC must be evaluated separately for these two roles.

Current verification layers include direct argv parser cases,
commit parser cases,
policy and transform tests that consume parser facts,
ninety-six wrapper tests in `src/bin.unit.test.ts`,
trust management subprocess tests,
packed JSONL boundary fixtures,
and a packed lifecycle benchmark.
Migration completeness requires mapping every affected parser branch to these tests rather than treating management examples alone
as parity.

### 2026-08-14 CAC-only scope checkpoint

The user excluded every other external CLI parser technology from this session.
The active compatibility fingerprint is
`a48b54e274b6d6bda3057027fbcc2ced424ea8c0a00b03a2ce868425a534f986`.
The original unqualified vet report is superseded because its fingerprint included broad alternative discovery.
CAC integration shapes may still be compared with each other,
and current owned behavior remains the required parity baseline.

## Open risks

- CAC may fit management subcommands while being unsuitable for transparent Git-argv inspection.
- A split result may be best:
  framework use for `git cli-git` management commands while retaining purpose-built Git region parsers.
  This must be scored as a concrete integration shape rather than assumed.
- Existing historical comments can obscure which parser behavior is current.
  Source and tests,
  not comments alone,
  are authoritative.
- The target package is a shadowing `git` executable.
  A parser that exits,
  writes help,
  or normalizes argv unexpectedly can alter safety and automation behavior even when ordinary examples pass.

## Next action

Run the frozen CAC-only discovery schedule,
then inspect CAC's pinned source and package provenance without executing third-party code.
