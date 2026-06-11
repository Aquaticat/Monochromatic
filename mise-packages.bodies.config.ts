// Source of the boilerplate mise task bodies for the includes renderer
// (mise-packages.render.config.ts): it emits these into shared mise-shared/*.toml
// files (bare full-body format) that each active packages/*/* mise.toml pulls in via
// `[task_config].includes`, and falls back to inlining a body verbatim for the few
// packages whose task set does not line up with a whole role file. Heavy logic stays
// in root `[vars]` (fanout, dispatch_workspace_node, parse_usage_args, run_test_files);
// these bodies only carry the thin wrappers that interpolate those vars, so the shared
// files and inline fallbacks reference `{{vars.fanout}}` etc. rather than duplicating it.
//
// These bodies mirror the root `[task_templates.*]` in mise.no-env.toml, which are
// retained (not deleted as the includes plan envisioned) because the archived
// `packages-deprecated/*/*` config root, plus a handful of root and bespoke tasks,
// still consume them via `extends`. Keep the two in sync; the templates are the bodies
// mise actually resolves for those `extends` consumers, and this file the source for
// the shared files the active packages include.

/**
 * One boilerplate mise task body. Shared role files render it as bare dotted-key
 * entries; inline fallbacks render it as a `[tasks.X]` section. `run` is the only
 * required field; the optional fields mirror the source `[task_templates.*]` exactly
 * so the generated task graph stays byte-equivalent to the extends baseline.
 */
export type TaskBody = {
  /** Human-facing task description, when the source template carried one. */
  readonly description?: string;
  /** mise `usage` spec (flags and positional args), when the source template carried one. */
  readonly usage?: string;
  /** Task shell; `node -e` for the `{{vars.*}}`-interpolating bodies, absent for plain `tsdown` leaves. */
  readonly shell?: string;
  /** Command or `node -e` script body; references root `[vars]` via `{{vars.*}}` for the heavy logic. */
  readonly run: string;
};

/**
 * Fanout-parent body shared by every build/lint aggregator: a `node -e` script that
 * discovers and runs its direct child tasks in parallel via the root `fanout` var.
 * Heterogeneity is by absence, so one body serves every aggregator regardless of
 * which leaves a package actually has.
 */
const FANOUT_BODY: TaskBody = {
  shell: 'node -e',
  run: '{{vars.fanout}}',
};

/**
 * Every boilerplate task body, keyed by task name. The renderer maps a package's
 * derived task set onto these entries; the manifest never restates a body.
 *
 * @example
 * ```ts
 * miseTaskBodies['build:js:node']; // { run: 'tsdown --config tsdown.node.config.ts' }
 * ```
 */
export const miseTaskBodies = {
  'build': FANOUT_BODY,
  'build:js': FANOUT_BODY,
  'watch:build': FANOUT_BODY,
  'watch:build:js': FANOUT_BODY,
  'build:js:node': { run: 'tsdown --config tsdown.node.config.ts', },
  'build:js:browser': { run: 'tsdown --config tsdown.browser.config.ts', },
  'build:js:client': { run: 'tsdown --config tsdown.client.config.ts', },
  'watch:build:js:node': { run: 'tsdown --watch --config tsdown.node.config.ts', },
  'watch:build:js:browser': { run: 'tsdown --watch --config tsdown.browser.config.ts', },
  'watch:build:js:client': { run: 'tsdown --watch --config tsdown.client.config.ts', },
  'lint': FANOUT_BODY,
  'lint:types': {
    description: 'TypeScript',
    shell: 'node -e',
    run: `{{vars.dispatch_workspace_node}}
runWorkspaceNode('packages/dev-script/task-util', 'tsgo-filter', ['--build'])`,
  },
  'watch:lint:types': {
    description: 'Type check in watch mode',
    run: 'tsgo --watch',
  },
  'lint:oxlint': {
    description: 'Lint with Oxlint',
    shell: 'node -e',
    run: `{{vars.dispatch_workspace_node}}
ensureOxlintConfig()
runWorkspaceNode('packages/dev-script/task-util', 'oxlint-wrapper', ['--type-aware'])`,
  },
  'test:unit': {
    description:
      'Run *.unit.test.ts in parallel via node (excludes /deprecated/ and *.expensive.* unless --all); pass file paths to filter',
    usage: `flag "--all" help="Include /deprecated/ and *.expensive.* files; cannot be combined with file paths"
arg "[args]" var=#true help="Test file paths to run (when provided, only those files run); cannot be combined with --all"`,
    shell: 'node -e',
    run: `{{vars.parse_usage_args}}
{{vars.run_test_files}}
const { existsSync } = await import('node:fs')
const { glob } = await import('node:fs/promises')
const { join } = await import('node:path')
const args = parseUsageArgs(process.env.usage_args ?? '')
const all = (process.env.usage_all ?? '').trim() === 'true'
if (all && args.length > 0) { throw new Error('--all cannot be combined with file paths') }
let files
if (args.length === 0) {
  files = []
  for await (const file of glob('**/*.unit.test.ts', { exclude: (name) => name.includes('node_modules') })) {
    if (all || (!file.includes('/deprecated/') && !file.includes('.expensive.'))) { files.push(file) }
  }
} else {
  // Package-scoped tasks run with cwd = MISE_CONFIG_ROOT (the package dir), so a repo-root-relative
  // path passed verbatim resolves under the package. Resolve each arg against the monorepo root
  // (modern mise), then the mise invocation dir, then cwd.
  const base = process.env.MISE_MONOREPO_ROOT ?? process.env.MISE_ORIGINAL_CWD ?? process.cwd()
  files = args.map((file) => existsSync(file) ? file : join(base, file))
}
await runTestFiles(files, [])`,
  },
} satisfies Record<string, TaskBody>;

/**
 * Task name that owns a boilerplate body in {@link miseTaskBodies}.
 */
export type MiseTaskName = keyof typeof miseTaskBodies;

/**
 * One shared role file: a `mise-shared/<file>` plus the boilerplate tasks it carries.
 * Decomposed by role (not by build profile) so heterogeneity is free: a package
 * simply omits the file for a leaf it lacks. A package includes a role file only when
 * its derived task set is a superset of `tasks`, so flavor-less packages never pick up
 * spurious build aggregators and `noWatch` packages never pick up an absent watch leaf.
 */
export type MiseRoleFile = {
  /** File name under mise-shared/ (e.g. `base.toml`). */
  readonly file: string;
  /** Task names this file defines; included as a unit or not at all. */
  readonly tasks: readonly MiseTaskName[];
};

/**
 * Role-file decomposition, ordered for deterministic include lists. Build aggregators
 * are separated from lint tasks (flavor-less packages have lint without build), and
 * each lint/test toggle is its own file (lint, lint:types, watch:lint:types, lint:oxlint,
 * test:unit vary independently per package). Flavor leaves pair their build and watch
 * tasks; a `noWatch` package falls back to inlining the build leaf instead.
 *
 * @example
 * ```ts
 * miseRoleFiles.find((role) => role.file === 'node.toml')?.tasks;
 * // ['build:js:node', 'watch:build:js:node']
 * ```
 */
export const miseRoleFiles: readonly MiseRoleFile[] = [
  { file: 'base.toml', tasks: ['build', 'build:js', 'watch:build', 'watch:build:js',], },
  { file: 'node.toml', tasks: ['build:js:node', 'watch:build:js:node',], },
  { file: 'browser.toml', tasks: ['build:js:browser', 'watch:build:js:browser',], },
  { file: 'client.toml', tasks: ['build:js:client', 'watch:build:js:client',], },
  { file: 'lint.toml', tasks: ['lint',], },
  { file: 'lint-types.toml', tasks: ['lint:types',], },
  { file: 'watch-lint-types.toml', tasks: ['watch:lint:types',], },
  { file: 'oxlint.toml', tasks: ['lint:oxlint',], },
  { file: 'test-unit.toml', tasks: ['test:unit',], },
];
