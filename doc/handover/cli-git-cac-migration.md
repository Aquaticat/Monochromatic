# cli-git CAC migration assessment handover

## Status

Assessment started on 2026-08-14.
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
The detailed technology evidence will live in the vet report required by
`.agents/skills/choosing-technology/SKILL.md` once external screening crosses its substantial-evaluation threshold.

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

The keeping-the-incumbent candidate remains in scope.
At least two other concrete CLI technologies must receive evidence-backed screening so CAC is not assessed in isolation.
No candidate can be recommended from README or registry metadata alone.

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
3. Freeze and run the required discovery query schedule.
4. Screen CAC,
   the incumbent,
   and concrete alternatives through license,
   provenance,
   security,
   platform,
   source,
   maintenance,
   and auditability gates.
5. Clone serious external candidates under private `~/temp/agent/` paths and inspect the consumed source paths.
6. Validate finalists equally,
   then exercise relevant cli-git boundaries in secret-free disposable fixtures.
7. Score validated finalists,
   run sensitivity checks,
   and publish pros,
   cons,
   a complete ranking,
   and either a recommendation or an explicit no-recommendation result.
8. Synchronize this handover after each material evidence phase and complete the vet report before concluding.

## Evidence log

### 2026-08-14 initial checkpoint

The first repository read changes the framing from "replace Optique with CAC" to "compare CAC with the current owned parser
set."
The package manifest shows Optique has already been removed.
The key practicality threshold is therefore net simplification with strict behavioral parity,
not removal of an installed framework.
This is a starting hypothesis only.

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

Inventory the complete current cli-git parsing and diagnostic surface,
then update this handover with frozen hard constraints before external candidate screening.
