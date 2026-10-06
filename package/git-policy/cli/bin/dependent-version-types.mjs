/**
 Shapes shared by the dependent-version differential harness: cases both planners read and the canonical results both
 write. Byte strings (paths, file contents) are lower-case hexadecimal.
 */

/**
 One tracked file of a workspace case. `current` is `null` for a file whose bytes the harness did not provide, so
 any read of it fails; `base` is `null` when the base lacks the file and `true` when it equals `current`.

 @typedef {{ path: string, mode: string, current: string | null, base: string | true | null }} FixtureFile
 */

/**
 One candidate path of a workspace case.

 @typedef {{ path: string, change: string }} FixtureCandidate
 */

/**
 A workspace case's input: an optional shared workspace, the case's own files, and the lifecycle.

 @typedef {{
   workspace: string | null,
   files: FixtureFile[],
   trigger: string,
   forwardsCommit: boolean,
   candidates: FixtureCandidate[],
 }} WorkspaceInput
 */

/**
 One graph node of a `planDependentBumps` case.

 @typedef {{ name: string, directory: string, version: string | null, edgeNames: string[] }} GraphNode
 */

/**
 A differential case, by kind.

 @typedef {{ name: string, kind: 'workspace', input: WorkspaceInput }
   | { name: string, kind: 'patchBumpVersion', input: { name: string, version: string } }
   | { name: string, kind: 'planDependentBumps', input: { manifests: GraphNode[], bumpedNames: string[], publishableNames: string[] } }
   | { name: string, kind: 'readManifestDependencyFacts', input: { path: string, text: string } }
   | { name: string, kind: 'replaceManifestVersion', input: { path: string, text: string, from: string, to: string } }
   | { name: string, kind: 'importsPackage', input: { sourceText: string, packageName: string } }
   | { name: string, kind: 'isNonTestSourcePath', input: { directory: string, path: string } }
   | { name: string, kind: 'readPublishableNames', input: { configText: string } }} DifferentialCase
 */

/**
 A case of the corpus, with its class and the probe features it carries.

 @typedef {DifferentialCase & { label: string, features: string[] }} CorpusCase
 */

/**
 A failure: its class and, for shape problems, the incumbent's message.

 @typedef {{ kind: 'failed', error: string, detail: string }} FailedResult
 */

/**
 One planned manifest bump.

 @typedef {{
   name: string,
   directory: string,
   from: string,
   to: string,
   path: string,
   original: string,
   replacement: string,
 }} BumpResult
 */

/**
 A plan result.

 @typedef {{ kind: 'planned', bumpedNames: string[], bumps: BumpResult[] }
   | { kind: 'unsupported', message: string }
   | FailedResult} PlanResult
 */

/**
 One policy finding.

 @typedef {{
   code: string,
   message: string,
   path: string | null,
   patch: { path: string, original: string, replacement: string } | null,
 }} FindingResult
 */

/**
 A policy result.

 @typedef {{ kind: 'findings', findings: FindingResult[] } | FailedResult} PolicyResult
 */

/**
 The result of a workspace case.

 @typedef {{ plan: PlanResult, policy: PolicyResult }} WorkspaceResult
 */

/**
 The result of any case.

 @typedef {WorkspaceResult
   | { kind: 'ok', value: string }
   | { kind: 'unsupported', message: string }
   | { kind: 'bumps', value: { name: string, directory: string, from: string, to: string }[] }
   | { kind: 'facts', name: string, version: string | null, runtime: readonly string[], dev: readonly string[] }
   | { kind: 'bool', value: boolean }
   | { kind: 'names', value: readonly string[] }
   | FailedResult} CaseResult
 */

/**
 Loads a shared workspace file of the corpus by name.

 @typedef {(name: string) => FixtureFile[]} SharedWorkspace
 */

export {};
