// Pure publish-planning helpers, built only so unit tests exercise the bundled artifact.
// The package declares no entry points, so it never publishes itself.
export {
  orderForPublishing,
  PnprConfigShapeError,
  prepareManifestForPnpr,
  readPnprPublishTarget,
  type PnprPublishTarget,
  type PublishCandidate,
} from './publish-plan.ts';
export {
  chooseDistTag,
  compareVersions,
} from './version-order.ts';
export {
  fieldOf,
  firstItem,
  isJsonRecord,
  isStringArray,
} from './json-shape.ts';
