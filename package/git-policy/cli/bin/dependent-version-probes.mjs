/**
 Predictions for the probe class and the planted defects of the dependent-version differential harness.

 A probe carries one feature whose result is meant to differ between the incumbent and the native planner.
 Its difference counts as explained only when it is exactly the predicted one; any other difference is reported.
 The planted defects are positive controls: each must make the harness report differences.
 */
// The bin scripts sit outside the package tsconfig's include list; this reference loads the Node types.
/// <reference types="node" />
import { isDeepStrictEqual } from 'node:util';

/** @typedef {import('./dependent-version-types.mjs').CaseResult} CaseResult */
/** @typedef {import('./dependent-version-types.mjs').PlanResult} PlanResult */
/** @typedef {import('./dependent-version-types.mjs').PolicyResult} PolicyResult */
/** @typedef {import('./dependent-version-types.mjs').WorkspaceResult} WorkspaceResult */
/** @typedef {(request: { key: string, left: unknown, right: unknown }) => boolean} Accept */

/** Byte-order mark as hexadecimal. */
const byteOrderMark = 'efbbbf';

/**
 Whether a value is a plain object.

 @param {unknown} value - value
 @returns {value is Record<string, unknown>} whether it is
 */
function isRecord(value) {
  return (value !== null) && ((typeof value) === 'object')
    && (!Array.isArray(value));
}

/**
 Whether two values differ only at leaves whose key is allowed, with the same structure elsewhere.

 @param {{ left: unknown, right: unknown, allowed: readonly string[], accept: Accept, key: string }} request - incumbent
   and native values, keys whose values may differ, the check of each allowed difference, and this value's key
 @returns {boolean} whether every difference is allowed and accepted
 */
function differsOnlyAt({
  left,
  right,
  allowed,
  accept,
  key
}) {
  if (isDeepStrictEqual(
    left,
    right
  ))
    return true;
  if (allowed.includes(key))
    return accept({
      key,
      left,
      right
    });
  if (Array.isArray(left) && Array.isArray(right))
    return (left.length === right.length) && left.every(function itemMatches(
      item,
      index
    ) {
      return differsOnlyAt({
        left: item,
        right: right[index],
        allowed,
        accept,
        key
      });
    });
  if (isRecord(left) && isRecord(right)) {
    const keys = Object.keys(left);
    return isDeepStrictEqual(
      keys,
      Object.keys(right)
    ) && keys.every(function memberMatches(member) {
      return differsOnlyAt({
        left: left[member],
        right: right[member],
        allowed,
        accept,
        key: member
      });
    });
  }
  return false;
}

/**
 Whether a native result part is the incumbent's, or a failure of the predicted class.

 @param {{ incumbent: PlanResult | PolicyResult, native: PlanResult | PolicyResult, error: string, detail?: string }}
   request - both parts, the predicted native failure class, and text its detail must contain
 @returns {boolean} whether it matches the prediction
 */
function equalOrNativeFailure({
  incumbent,
  native,
  error,
  detail = ''
}) {
  return isDeepStrictEqual(
    incumbent,
    native
  )
    || ((native.kind === 'failed')
      && (native.error === error)
      && native.detail
      .includes(detail));
}

/**
 The exact patch increment of a release version.

 @param {string} version - `major.minor.patch`
 @returns {string} bumped version
 */
function exactBump(version) {
  const [major, minor, patch] = version.split('.');
  return `${major ?? ''}.${minor ?? ''}.${(BigInt(patch ?? '0') + 1n).toString()}`;
}

/**
 Accept a byte-order mark the native bytes add before the incumbent's.

 @type {Accept}
 */
function addsByteOrderMark({
  left,
  right
}) {
  return right === `${byteOrderMark}${String(left)}`;
}

/**
 Accept any value of an allowed key.

 @type {Accept}
 */
function anyValue() {
  return true;
}

/**
 Predictions by feature over the workspace results of both planners.

 @type {Record<string, (request: { incumbent: WorkspaceResult, native: WorkspaceResult }) => boolean>}
 */
const predictions = {
  // The policy reader strips the mark, so the incumbent's patch drops it; the release reader keeps it and
  // `JSON.parse` refuses the text.
  'bom': function bom({
    incumbent,
    native
  }) {
    return differsOnlyAt({
      left: incumbent.policy,
      right: native.policy,
      allowed: [
        'original',
        'replacement'
      ],
      accept: addsByteOrderMark,
      key: ''
    })
      && (isDeepStrictEqual(
        incumbent.plan,
        native.plan
      ) || ((incumbent.plan
        .kind
        === 'failed') && (incumbent.plan
          .error
          === 'syntax')));
  },
  // The incumbent rounds a patch component at or above 2^53 through a double; the native increment is exact.
  'huge-patch': function hugePatch({
    incumbent,
    native
  }) {
    const exact = (native.plan
      .kind
      !== 'planned')
      || native.plan
      .bumps
      .every(function isExact(bump) {
      return bump.to === exactBump(bump.from);
    });
    return exact
      && differsOnlyAt({
        left: incumbent.plan,
        right: native.plan,
        allowed: [
          'to',
          'replacement'
        ],
        accept: anyValue,
        key: ''
      })
      && differsOnlyAt({
        left: incumbent.policy,
        right: native.policy,
        allowed: [
          'message',
          'replacement'
        ],
        accept: anyValue,
        key: ''
      });
  },
  'duplicate-name': function duplicateName({
    incumbent,
    native
  }) {
    return equalOrNativeFailure({
      incumbent: incumbent.plan,
      native: native.plan,
      error: 'graph'
    })
      && equalOrNativeFailure({
        incumbent: incumbent.policy,
        native: native.policy,
        error: 'graph'
      });
  },
  'unpaired-surrogate-name': function unpairedSurrogateName({
    incumbent,
    native
  }) {
    return equalOrNativeFailure({
      incumbent: incumbent.plan,
      native: native.plan,
      error: 'shape',
      detail: 'unpaired'
    })
      && equalOrNativeFailure({
        incumbent: incumbent.policy,
        native: native.policy,
        error: 'shape',
        detail: 'unpaired'
      });
  },
  'deep-nesting': function deepNesting({
    incumbent,
    native
  }) {
    return equalOrNativeFailure({
      incumbent: incumbent.plan,
      native: native.plan,
      error: 'syntax'
    })
      && equalOrNativeFailure({
        incumbent: incumbent.policy,
        native: native.policy,
        error: 'syntax'
      });
  },
  // The policy reader decodes strictly, as the native planner does; the release reader replaces bytes.
  'non-utf8-manifest': function nonUtf8Manifest({
    incumbent,
    native
  }) {
    return isDeepStrictEqual(
      incumbent.policy,
      native.policy
    )
      && equalOrNativeFailure({
        incumbent: incumbent.plan,
        native: native.plan,
        error: 'decode'
      });
  },
  'non-utf8-config': function nonUtf8Config({
    incumbent,
    native
  }) {
    return isDeepStrictEqual(
      incumbent.policy,
      native.policy
    )
      && equalOrNativeFailure({
        incumbent: incumbent.plan,
        native: native.plan,
        error: 'decode'
      });
  },
};

/**
 Whether a probe's difference is exactly the one its feature predicts.

 @param {{ feature: string, incumbent: CaseResult, native: CaseResult }} request - probe feature and both results
 @returns {boolean} whether the difference is explained
 */
export function explainProbe({
  feature,
  incumbent,
  native
}) {
  const prediction = predictions[feature];
  return (prediction !== undefined) && ('plan' in incumbent)
    && ('plan' in native)
    && prediction({
      incumbent,
      native
    });
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
