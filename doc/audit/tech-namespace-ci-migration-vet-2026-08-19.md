# Namespace CI migration vet report

- Status: active
- Lifecycle phase: context and rubric frozen; discovery pending
- Subject: Namespace CI migration
- Decision scope: whether migrating Monochromatic GitHub Actions execution to Namespace avoids repository splitting and
  fixes measured CI pressure
- Started: 2026-08-19
- Last updated: 2026-08-19
- Governing skill commit: `a05818ad70a40e5769a36de669697ba109891b31`
- Governing skill SHA-256: `393eb68c5b2b2f7b16c8f7f90c100fb8be43eefa4501511360cd0572e4ae8087`
- Compatibility fingerprint: `4274789320726bb9dc12e712353cae5246b2f89a31f16c6cf267ec42d5f77bb7`
- Active audit owner: current pi session
- Prior compatible report: none found

## Context

The user does not want to split this repository merely to accommodate CI.
That is a hard constraint.
The requested question is whether Namespace fixes all current CI problems, not whether Namespace can run any Linux job.

Measured on 2026-08-19:

- `Aquaticat/Monochromatic` is a public GitHub repository.
- The tracked tree contains 156 `package.json` files, 28 `Cargo.toml` files, and 3 `build.gradle.kts` files.
- Tracked files total 86,147,067 bytes; the local packed Git object store totals 165,129 KiB.
- The repository has 12 tracked GitHub Actions workflow files plus GitHub-managed CodeQL default setup.
- CodeQL default setup uses standard hosted runners and the extended query suite.
- The week beginning 2026-08-12 contains 511 commits.
- GitHub's Actions API returned its 1,000-run cap for that interval.
- Peak observed workflow starts were 131 in one hour.
- The latest 1,000 runs included 483 CodeQL push runs, with another 10 active when measured.
- Existing workflows use Linux, macOS, and Windows host evidence.
- Existing workflows also use `merge_group`, GitHub secrets, OIDC, provenance attestations, SARIF upload, and pinned actions.
- No self-hosted repository runners are currently registered.

The immediate measured pressure is repeated work after frequent auto-pushed commits, especially GitHub-managed CodeQL.
The repository also expects future path-filtered fuzz and mutation jobs.
Raw executor speed is therefore only one part of the problem.

## Compatibility fingerprint input

```json
{"baseCategories":["Managed service or SaaS"],"decisionScope":"Whether migrating Monochromatic GitHub Actions execution to Namespace avoids repository splitting and fixes measured CI pressure.","deployment":{"executor":"Managed cloud runners","orchestration":"GitHub Actions","repository":"Public GitHub.com monorepo"},"hardConstraints":["Do not require splitting the repository.","Keep GitHub Actions orchestration and GitHub-native integrations.","Preserve required Linux x64, macOS arm64, and Windows x64 host-evidence jobs.","Securely execute public-repository pull requests without persistent cross-job state."],"incumbent":"GitHub Actions standard hosted runners as of 2026-08-19","overlays":["high-trust CI execution","incumbent dependency replacement","multi-platform claim","sensitive credentials"],"schemaVersion":1,"subject":"Namespace CI migration","trustBoundary":"Third-party managed runners execute repository code, GitHub tokens, publishing credentials, and OIDC identities."}
```

## Classification

### Namespace

- Base category: managed service or SaaS.
- Local components: pending discovery.
- Overlays: incumbent replacement, high-trust CI execution, sensitive credentials, and multi-platform claim.
- State: discovered from the user's request.
- Screening result: pending.

### GitHub Actions standard hosted runners

- Base category: managed service or SaaS.
- Local components: GitHub Actions runner and action dependencies.
- Overlays: incumbent retention, high-trust CI execution, sensitive credentials, and multi-platform claim.
- State: discovered from repository configuration.
- Screening result: pending current-documentation refresh.

### GitHub Actions self-hosted runners

- Base category: managed GitHub control plane plus inspectable local runner technology.
- Overlays: incumbent execution replacement, high-trust CI execution, sensitive credentials, and multi-platform claim.
- State: discovered from `doc/decision/ci-provider.md`.
- Screening result: pending.

### Managed runner alternatives

Depot, Blacksmith, RunsOn, and BuildJet are discovery leads, not finalists.
They require the same screening depth before any ranking.

## Hard constraints

- Keep the repository monolithic.
- Keep GitHub Actions orchestration and GitHub-native integrations.
- Preserve required Linux x64, macOS arm64, and Windows x64 host-evidence jobs.
- Securely execute public-repository pull requests without persistent cross-job state.
- Preserve publishing credentials, OIDC identities, provenance attestations, and SARIF uploads.
- Provide a practical route for GitHub-managed CodeQL or explicitly identify it as unsolved.

A candidate that only accelerates Linux jobs cannot be a full migration.
It may still be evaluated as a partial executor overlay, but must be described that way.

## Frozen soft criteria

The user supplied no relative weights beyond keeping the monorepo, which is already a hard constraint.
Every soft criterion therefore has weight 1.

- Redundant-work control.
- Queue and concurrency behavior.
- Warm and cold execution speed.
- Cache effectiveness for pnpm, Rust, Gradle, and container builds.
- GitHub workflow compatibility and migration effort.
- Security isolation and credential boundary.
- Platform coverage.
- Reliability and support.
- Price for a public, high-frequency repository.
- Exit cost and configuration portability.
- Human auditability of runner-side components.

## Frozen discovery schedule

The schedule is finite.
One de-duplicated expansion round may be appended from newly discovered taxonomy.

### Official service and ecosystem sources

- Namespace documentation: `GitHub Actions runners architecture isolation ephemeral`.
- Namespace documentation: `pricing open source public repositories concurrency limits`.
- Namespace documentation: `runner profiles x64 arm64 macOS Windows GPU`.
- Namespace documentation: `cache volumes container builds monorepo`.
- Namespace documentation: `security privacy retention SOC 2 OIDC secrets`.
- Namespace documentation: `status history SLA support export deletion`.
- GitHub Marketplace: `Namespace runners`.
- GitHub documentation: `hosted runner concurrency public repository limits`.
- GitHub documentation: `default setup CodeQL custom runner`.
- GitHub documentation: `self-hosted runners public repository pull request security`.

### Repository-host sources

- GitHub organization and repositories for `namespacelabs` and `namespace-so` runner integrations.
- GitHub code search for Namespace runner labels and setup actions.
- GitHub releases, security policies, workflows, and issue trackers for discovered local components.
- Repository workflow and decision records for the incumbent and hand-rolled alternatives.

### Broader web sources

- `managed GitHub Actions runners public open source monorepo`.
- `Namespace alternatives GitHub Actions runners`.
- `Namespace vs Depot GitHub Actions runners`.
- `Namespace vs Blacksmith GitHub Actions runners`.
- `Namespace vs RunsOn GitHub Actions runners`.
- `Namespace vs BuildJet GitHub Actions runners`.
- `managed GitHub Actions runners macOS Windows Linux arm64`.
- `Namespace outage security incident layoffs funding reviews suspension billing cancellation`.

## Evidence records

### Repository execution demand

- Candidate: all.
- Claim: executor replacement must address high-frequency redundant CodeQL runs, not only individual job speed.
- Gate: category fit and scored redundant-work control.
- Status: pass as repository-context evidence.
- Primary evidence: live `gh api` and `gh run list` measurements on 2026-08-19.
- Outcome: Namespace must document trigger suppression, cancellation, or CodeQL integration before claiming complete relief.

### Cross-platform boundary

- Candidate: all.
- Claim: Linux-only execution cannot replace every current job.
- Gate: multi-platform hard gate.
- Status: pass as repository-context evidence.
- Primary evidence: `.github/workflows/cli-git-trust.yml`, `.github/workflows/fs-id.yml`, and
  `.github/workflows/readonly-semantic-bridge.yml`.
- Outcome: candidate platform claims will be checked against Linux x64, macOS arm64, and Windows x64.

## Unresolved evidence

- Namespace platform matrix, pricing, plan limits, and public-repository terms.
- Namespace handling of GitHub default-setup CodeQL.
- Namespace runner image source, local agents, artifact provenance, and isolation lifecycle.
- Namespace service history, terms, privacy, support, export, and account-enforcement evidence.
- Equal-depth current evidence for alternatives.
- Runtime validation feasibility without authorizing installation or account linkage.

## Recommendation

No recommendation yet.
Discovery, screening, targeted evidence, equal-depth finalist validation, scoring, and sensitivity remain open.
