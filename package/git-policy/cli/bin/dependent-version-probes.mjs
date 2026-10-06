/**
 Predictions for the probe class and the planted defects of the differential harness.

 A probe carries one feature whose result is meant to differ between the incumbent and the native planner.
 Its difference counts as explained only when it is exactly the predicted one; any other difference is reported.
 The planted defects are positive controls: each must make the harness report differences.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { isDeepStrictEqual } from 'node:util';

/** Byte-order mark as hexadecimal. */
const bom = 'efbbbf';

/**
 Whether two values differ only at leaves whose key is allowed, with the same structure elsewhere.

 @param {any} left - incumbent value
 @param {any} right - native value
 @param {readonly string[]} allowed - keys whose values may differ
 @param {(key: string, left: any, right: any) => boolean} accept - check of each allowed difference
 @param {string} [key] - key of this value in its parent
 @returns {boolean} whether every difference is allowed and accepted
 */
function differsOnlyAt(left, right, allowed, accept, key = '') {
  if (isDeepStrictEqual(left, right))
    return true;
  if (allowed.includes(key))
    return accept(key, left, right);
  if (Array.isArray(left) && Array.isArray(right))
    return left.length === right.length && left.every((item, index) => differsOnlyAt(item, right[index], allowed, accept, key));
  if ((left !== null) && (right !== null) && (typeof left === 'object') && (typeof right === 'object')) {
    const keys = Object.keys(left);
    return isDeepStrictEqual(keys, Object.keys(right)) && keys.every(member => differsOnlyAt(left[member], right[member], allowed, accept, member));
  }
  return false;
}

/**
 Whether a native result is the incumbent's, or a failure of the predicted class.

 @param {any} incumbent - incumbent result part
 @param {any} native - native result part
 @param {string} error - predicted native failure class
 @param {string} [detail] - text the native failure detail must contain
 @returns {boolean} whether it matches the prediction
 */
function equalOrNativeFailure(incumbent, native, error, detail = '') {
  return isDeepStrictEqual(incumbent, native) || (native.kind === 'failed' && native.error === error && native.detail.includes(detail));
}

/**
 The exact patch increment of a release version.

 @param {string} version - `major.minor.patch`
 @returns {string} bumped version
 */
function exactBump(version) {
  const [major, minor, patch] = version.split('.');
  return `${major}.${minor}.${(BigInt(patch) + 1n).toString()}`;
}

/**
 Whether a probe's difference is exactly the one its feature predicts.

 @param {string} feature - probe feature
 @param {any} incumbent - incumbent result
 @param {any} native - native result
 @returns {boolean} whether the difference is explained
 */
export function explainProbe(feature, incumbent, native) {
  switch (feature) {
    case 'bom':
      // The policy reader strips the mark, so the incumbent's patch drops it; the release reader keeps it and
      // `JSON.parse` refuses the text.
      return differsOnlyAt(incumbent.policy, native.policy, ['original', 'replacement'], (_key, left, right) => right === `${bom}${left}`)
        && (isDeepStrictEqual(incumbent.plan, native.plan) || (incumbent.plan.kind === 'failed' && incumbent.plan.error === 'syntax'));
    case 'huge-patch': {
      // The incumbent rounds a patch component above 2^53 through a double; the native increment is exact.
      const exact = (/** @type {any} */ result) => (result.kind !== 'planned') || result.bumps.every((/** @type {any} */ bump) => bump.to === exactBump(bump.from));
      const accept = () => true;
      return exact(native.plan)
        && differsOnlyAt(incumbent.plan, native.plan, ['to', 'replacement'], accept)
        && differsOnlyAt(incumbent.policy, native.policy, ['message', 'replacement'], accept);
    }
    case 'duplicate-name':
      return equalOrNativeFailure(incumbent.plan, native.plan, 'graph') && equalOrNativeFailure(incumbent.policy, native.policy, 'graph');
    case 'unpaired-surrogate-name':
      return equalOrNativeFailure(incumbent.plan, native.plan, 'shape', 'unpaired') && equalOrNativeFailure(incumbent.policy, native.policy, 'shape', 'unpaired');
    case 'deep-nesting':
      return equalOrNativeFailure(incumbent.plan, native.plan, 'syntax') && equalOrNativeFailure(incumbent.policy, native.policy, 'syntax');
    case 'non-utf8-manifest':
    case 'non-utf8-config':
      // The policy reader decodes strictly, as the native planner does; the release reader replaces bytes.
      return isDeepStrictEqual(incumbent.policy, native.policy) && equalOrNativeFailure(incumbent.plan, native.plan, 'decode');
    default:
      return false;
  }
}

/** Planted defects in the native planner; each must make the harness report differences. */
export const plants = [
  {
    name: 'wrong-component',
    file: 'src/native/dependent_version_release.rs',
    from: '            String::from_utf16_lossy(minor),\n            increment_decimal(patch)',
    to: '            increment_decimal(minor),\n            String::from_utf16_lossy(patch)',
  },
  {
    name: 'skip-peer-dependencies',
    file: 'src/native/dependent_version_manifest.rs',
    from: '&["dependencies", "peerDependencies", "optionalDependencies"];',
    to: '&["dependencies", "optionalDependencies"];',
  },
  {
    name: 'skip-bundled-edges',
    file: 'src/native/dependent_version_plan.rs',
    from: 'edge_names: [state.facts.runtime_dependency_names.clone(), edges].concat(),',
    to: 'edge_names: [state.facts.runtime_dependency_names.clone(), Vec::new(), edges.into_iter().take(0).collect()].concat(),',
  },
];
