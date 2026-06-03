/**
 * Global dependency blocklist hook for substitution policies.
 *
 * This file owns the mechanism: a pnpm `readPackage` hook that rewrites every
 * dependency entry pointing at a blocked package to a workspace stub. The policy
 * table itself (the data) lives in `.pnpmfile.policies.json`, imported below, so
 * the blocklist churns independently of this hook logic.
 *
 * Companion to the `overrides` block in `pnpm-workspace.yaml`, which owns the
 * removal cases (`"banned-pkg": "-"`). This hook owns the cases where a stub
 * should land in `node_modules` so consumers can still resolve the import.
 *
 * See `docs/dependency-blocklist.md` for the policy reference, the decision
 * rule between throw / silent / remove, and worked examples.
 */

import policiesJson from './.pnpmfile.policies.json' with { type: 'json' };

/**
 * @typedef {object} Policy
 * @property {'throw' | 'silent'} action
 *   `throw`: substitute with @monochromatic-dev/stub-throwing. Loading the
 *   module throws an error naming the policy file. Use when at least one
 *   importer hard-imports the package (no `try/catch` guard) and you want a
 *   loud, informative failure at the import site.
 *
 *   `silent`: substitute with @monochromatic-dev/stub-silent. Property reads,
 *   function calls, and `new` invocations return the stub itself. `in` checks
 *   return `false`. Use for soft migrations where build-green matters more
 *   than runtime correctness.
 *
 *   Removal is not an action here. Add `"name": "-"` to the `overrides` block
 *   in `pnpm-workspace.yaml` instead, since pnpm has a native primitive.
 * @property {string} reason
 *   One-line explanation surfaced in the install-time warning. Cite the
 *   replacement, the migration ticket, or the rationale.
 * @property {readonly string[]} [allowed]
 *   Optional allowlist of consumer package names that should keep resolving
 *   to the real dependency. Useful for legacy packages mid-migration. For
 *   removal entries, use pnpm's parent-scoped `"consumer>banned": "<version>"`
 *   form in `overrides` instead.
 */

/**
 * Policy table sourced from `.pnpmfile.policies.json`. Sentinel comment keys
 * (those starting with `//`) carry rationale JSON cannot express as comments;
 * they are dropped here so the frozen table is a clean `Record<string, Policy>`.
 * The hook only ever indexes `POLICY[depName]` and never enumerates the table,
 * so the filter is a forward-looking guard rather than a correctness fix.
 *
 * @type {Readonly<Record<string, Policy>>}
 */
const POLICY = Object.freeze(
  Object.fromEntries(
    Object.entries(policiesJson,).filter(function isPolicyEntry([name,],) {
      return !name.startsWith('//',);
    },),
  ),
);

const STUB_SPECIFIER = Object.freeze({
  throw: 'workspace:@monochromatic-dev/stub-throwing@*',
  silent: 'workspace:@monochromatic-dev/stub-silent@*',
},);

/**
 * Fields pnpm installs for a transitive dependency: regular `dependencies` and
 * `optionalDependencies`. `devDependencies` only matter for direct workspace
 * deps (which pnpm reads from the local package.json, not via readPackage), so
 * iterating them here just produces noise for every transitive package that
 * happens to test against the blocked one. `peerDependencies` are not
 * auto-installed in this repo (`autoInstallPeers: false`) so substituting them
 * has no effect.
 */
const DEP_FIELDS = Object.freeze([
  'dependencies',
  'optionalDependencies',
],);

const warned = new Set();

/**
 * Emit a one-line warning to stderr for a `(dependent, blocked, action)` tuple
 * the first time it is seen during a single install. pnpm calls `readPackage`
 * once per `(package, version)` resolution; the dedupe set keeps output from
 * exploding when a blocked dep is pulled in by many ancestors.
 *
 * @param {string} key
 * @param {string} message
 */
function warnOnce({
  key,
  message,
},) {
  if (warned.has(key,))
    return;
  warned.add(key,);
  console.warn(message,);
}

/**
 * Walk every dependency field on the manifest. For each entry that matches a
 * POLICY key (and is not allowlisted for this dependent), warn once and rewrite
 * the version specifier to the matching workspace stub. Returns the mutated
 * manifest; the hook contract requires the same object pnpm passed in.
 *
 * @param {object} pkg
 * @returns {object}
 */
function applyBlocklist({ pkg, },) {
  const dependentName = (typeof pkg.name) === 'string' ? pkg.name : '<unknown>';
  const dependentVersion = (typeof pkg.version) === 'string' ? pkg.version : '0.0.0';

  for (const field of DEP_FIELDS) {
    const deps = pkg[field];
    if ((deps === null) || (deps === undefined)
      || ((typeof deps) !== 'object'))
      continue;
    for (const [name, currentSpec,] of Object.entries(deps,)) {
      const policy = POLICY[name];
      if (policy === undefined)
        continue;
      if (policy.allowed
        ?.includes(dependentName,)
        === true)
        continue;

      const key = `${dependentName}@${dependentVersion} -> ${name} [${policy.action}]`;
      const message =
        `[blocked-dep] ${key}: substituting with stub-${policy.action}. ${policy.reason} (previous spec: ${
          String(currentSpec,)
        })`;
      warnOnce({
        key,
        message,
      },);

      deps[name] = STUB_SPECIFIER[policy.action];
    }
  }

  return pkg;
}

export const hooks = {
  readPackage(pkg,) {
    return applyBlocklist({ pkg, },);
  },
};
