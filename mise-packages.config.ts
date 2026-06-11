// Flag manifest for per-package mise.toml generation (file-enforcer, extends renderer).
// Build flavors (build:js:{node,browser,client}) and their watch leaves derive from
// tsdown.{flavor}.config.ts presence on disk and are NOT listed here.
// Bespoke tasks live verbatim in mise-packages/<cat>/<pkg>.toml.
// Regenerate per-package mise.toml: `node file-enforcer.config.ts` (do not hand-edit the outputs).
/** Build flavor identifier; the only disk-derived axis of per-package mise generation. */
export type MiseFlavor = 'node' | 'browser' | 'client';

/**
 * Non-derivable per-package mise generation facts, keyed by repo-relative package path.
 * Fields hold space-separated task names so the manifest stays greppable and compact.
 *
 * @example
 * ```ts
 * misePackages['packages/cli/git'];
 * // { lintTest: 'lint lint:types lint:oxlint test:unit', }
 * ```
 */
export type MisePackageEntry = {
  /** Space-separated lint/test boilerplate this package extends: subset of `lint lint:types watch:lint:types lint:oxlint test:unit`. */
  readonly lintTest: string;
  /** Override for derived build-aggregator set (`build build:js watch:build watch:build:js`); empty string means none. Omit for standard all-four-when-flavored default. */
  readonly buildAggregators?: string;
  /** Disk-present build flavors whose `watch:build:js:{flavor}` leaf is intentionally absent. */
  readonly noWatch?: string;
  /** Task names carrying `hide = true`. */
  readonly hide?: string;
};

/**
 * Generation manifest: every package with at least one boilerplate task. Fully-custom
 * packages (no derivable boilerplate) are intentionally absent and left hand-maintained.
 *
 * @example
 * ```ts
 * for (const [pkg, entry] of Object.entries(misePackages)) renderPackageMiseToml({ pkg, entry });
 * ```
 */
export const misePackages = {
  'packages/build-tool/css': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/claude-code-plugins/bash-output-filter': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/claude-spawn': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/correction-reminder': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/guardrail': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/hook-types': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/prompt-time': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/session-start-housekeeping': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/source': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/claude-code-plugins/stop-reminders': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/claude-code-plugins/terminal-title': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/cli/fy': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/git': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/git-clone-size': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/markdown-lint': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/mvm': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/rgffplay': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/terminal-exec': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/cli/vmsync': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/config/oxlint': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/config/stylelint': { lintTest: 'lint', },
  'packages/config/tofu': { lintTest: 'lint:types lint:oxlint', },
  'packages/config/tsdown': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/desktop-daemon/hall-monitor': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/dev-script/backup-path': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/dev-script/catalog-tighten': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/deps-cube': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/file-enforcer': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/mutation-test': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/page-weight': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/dev-script/task-util': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/vm-builder': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/dev-script/watch-restart': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/figma-parsers/kiwi': { lintTest: 'lint lint:types lint:oxlint', hide: 'lint:types', },
  'packages/figma-parsers/penpot': { lintTest: 'lint lint:types lint:oxlint', hide: 'lint:types', },
  'packages/intellij-plugins/islands-black': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/mcp/mvm': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/mcp/stdio': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/async-iter': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/async-time': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/const': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/current-time-context': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/dom': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/fs-path': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/function-arity': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/hyperscript': { lintTest: 'lint lint:types lint:oxlint', buildAggregators: 'build build:js', noWatch: 'browser', },
  'packages/module/i18n-compose': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/image-diff': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/kv-store': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/llm-types': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/logger': { lintTest: 'lint lint:types watch:lint:types lint:oxlint', hide: 'lint:types watch:lint:types', },
  'packages/module/matrix': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/memoize': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/numeric-format': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/module/observable': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/or-throw': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/pipe': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/test': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/throws': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/token-count': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/toml-edit': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/module/zip-writer': { lintTest: 'lint lint:types watch:lint:types lint:oxlint', hide: 'lint:types watch:lint:types', },
  'packages/oxlint-plugins/no-restricted-syntax': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/oxlint-plugins/stylistic': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/oxlint-plugins/tsdoc': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi-shared/model-selection': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/advisor': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/auto-mode': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/current-time-context': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/morph-compact': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/spawn': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/statusline': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/terminal-title': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/pi/thinking-defaults': { lintTest: 'lint lint:types lint:oxlint test:unit', },
  'packages/rolldown-plugins/import-attributes': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/runtime-error/bun': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/shim/node-domexception': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/shim/proper-lockfile': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/shim/readable-stream': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/shim/ungap-structured-clone': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/stub/silent': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/stub/throwing': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/test-fixture/data-sequences': { lintTest: 'lint lint:types', },
  'packages/test-fixture/file-enforcer-perf': { lintTest: 'lint lint:types', },
  'packages/test-fixture/oxlint-tsdoc': { lintTest: 'lint lint:types', },
  'packages/typeface/aquaticat': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/webapp-content/messages-demo': { lintTest: 'lint lint:types lint:oxlint test:unit', buildAggregators: 'build watch:build watch:build:js', hide: 'lint:types', },
  'packages/webapp-content/ssg-test': { lintTest: 'lint lint:types lint:oxlint', buildAggregators: '', noWatch: 'client', hide: 'lint:types', },
  'packages/webapp-productivity/done': { lintTest: 'lint lint:types lint:oxlint', hide: 'lint:types', },
  'packages/webapp-productivity/done-postcss': { lintTest: 'lint lint:types lint:oxlint', buildAggregators: 'build watch:build watch:build:js', hide: 'lint:types', },
  'packages/webapp-productivity/doodle-widget': { lintTest: 'lint lint:types lint:oxlint', buildAggregators: '', noWatch: 'client', },
  'packages/webapp-productivity/rss': { lintTest: 'lint lint:types lint:oxlint', },
  'packages/webapp-productivity/syllable-break-demo': { lintTest: 'lint lint:types lint:oxlint', buildAggregators: '', noWatch: 'client', },
} satisfies Record<string, MisePackageEntry>;
