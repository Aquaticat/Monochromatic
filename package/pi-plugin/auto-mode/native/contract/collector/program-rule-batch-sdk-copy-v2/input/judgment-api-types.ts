/**
 Original public judgment capabilities retain their separate operation boundaries. @module
 */
import type { JudgmentPrograms } from './program-api.ts';
import type { JudgmentDependencyChecks } from './judgment-dependency-types.ts';
import type { JudgmentInstructions } from './instruction-api.ts';
import type {
  JudgmentExecutionEntry,
  JudgmentExecutionOwnership
} from './execution-types.ts';
import type { JudgmentInspection } from './judgment-inspection-types.ts';
import type { JudgmentLifecycle } from './judgment-lifecycle-types.ts';
import type {
  JudgmentPreparation,
  JudgmentPreparationSources
} from './judgment-preparation-types.ts';
import type { JudgmentSources } from './judgment-source-types.ts';
import type { QuestionSelection } from '../../../lifecycle/claim-evidence-batch-selection/selection-owner.ts';

/**
 Original callable owners retain their argument and result contracts when assembled.
 */
export type JudgmentOwnedOperations<Source extends JudgmentPreparationSources = JudgmentPreparationSources> =
  JudgmentPrograms & Omit<JudgmentInstructions, 'resolveBinding'> & JudgmentExecutionEntry
  & Pick<JudgmentExecutionOwnership, 'memberFor'> & JudgmentInspection
  & Omit<JudgmentLifecycle, 'state' | 'operation'> & Pick<JudgmentPreparation, 'prepare'>
  & Pick<JudgmentSources<Source>, 'readSourceSnapshot' | 'readCurrentSourceBinding'>
  & Pick<JudgmentDependencyChecks, 'assertDependenciesCurrent'>;

/**
 Assembly captures original functions and resolves retained selection only at inspection time.
 */
export type JudgmentAPIInput<Source extends JudgmentPreparationSources = JudgmentPreparationSources> =
  JudgmentOwnedOperations<Source> & Pick<JudgmentLifecycle, 'operation'>
  & Pick<JudgmentPreparation, 'knownSelection'> & Readonly<{ active: () => void }>;

/**
 Frozen public judgment preserves original key order, guards, and direct method identities.
 */
export type JudgmentPublicAPI<Source extends JudgmentPreparationSources = JudgmentPreparationSources> =
  JudgmentOwnedOperations<Source> & Pick<QuestionSelection, 'inspectBatch' | 'inspectClaim'>
  & Readonly<{ checkpoint: () => void }>;
