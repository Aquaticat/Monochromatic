//region Scoped archive naming evidence
// Separates initial occurrence observations from qualified history and policy.

export type {
  ArchiveNamingRevisionResult,
  ArchiveReferenceKind,
  ArchiveUseBallot,
  ArchiveUseKind,
  InitialArchiveAnchor,
  InitialArchiveUse,
  QualifiedArchiveNamingRevision,
} from './archive-naming-model.ts';

export { ArchiveNamingEvidenceError, } from './archive-naming-error.ts';
export { readQualifiedArchiveNamingRevisions, } from './archive-naming-revision.ts';

//endregion Scoped archive naming evidence
