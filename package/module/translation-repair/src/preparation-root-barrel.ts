//region Owning semantic preparation inputs, not phase or writer approval

export { buildPreparationRootInputs, } from './build-preparation-root-inputs.ts';
export {
  preparationRootNode,
  preparationRootParent,
  preparationRootPopulationParent,
} from './preparation-root-parent.ts';
export type {
  PreparationRootInputs,
  PreparationRootExclusion,
  PreparationRootReference,
  PreparationRootReferenceBinding,
  PreparationRootReferenceRole,
} from './preparation-root-reference-model.ts';
export type {
  PreparationRootEntry,
  PreparationRootNode,
  PreparationRootOriginalPolicy,
  PreparationRootParent,
  PreparationRootParentSide,
  PreparationRootPopulationParent,
  PreparationRootProtection,
  PreparationRootRawDocument,
} from './preparation-root-population-model.ts';
export type {
  PreparationRootDefinitionOrder,
  PreparationRootParentIdentity,
  PreparationRootParentRole,
  PreparationRootQuestionAliases,
  PreparationRootRegistration,
  PreparationRootUnalignedDefinitions,
} from './preparation-root-registration-model.ts';

//endregion Owning semantic preparation inputs, not phase or writer approval
