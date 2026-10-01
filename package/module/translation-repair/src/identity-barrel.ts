//region Identity barrel
// Who a page names and how each name must survive a rewrite: the archive's
// contributor declarations and the lines that make them (ledger B81), the
// declared names a candidate must keep, and the identity context preparation
// builds. Split from `pipeline-barrel.ts`, which reached its line budget.

export {
  archiveContributorNameForms,
  type ContributorDeclarationLine,
  contributorDeclarationLines,
} from './contributor-name-authority.ts';
export {
  declaredNameForms,
  type DeclaredNameRefusalReport,
  declaredNameRefusalReport,
  findDroppedDeclaredNames,
} from './declared-name-survival.ts';
export {
  collectIdentityLines,
  type DeclaredIdentity,
  extractDeclaredIdentity,
  sourcePronounLines,
} from './identity-context.ts';

//endregion Identity barrel
