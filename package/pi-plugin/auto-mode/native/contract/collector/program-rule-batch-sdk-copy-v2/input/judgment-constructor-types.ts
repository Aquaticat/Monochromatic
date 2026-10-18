/**
 Original constructor inputs compose owned capabilities without widening authority. @module
 */
import type {
  DependencySources,
  DependencyFacadeInput
} from '../../../lifecycle/native-text-read-contract/dependency-types.ts';
import type { JudgmentBudgetInput } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { MainAgentRequestInput } from '../../request-producer-group-consumer/request-types.ts';
import type {
  JudgmentPreparationSources,
  JudgmentPreparationInput
} from './judgment-preparation-types.ts';
import type {
  JudgmentSourcesInput,
  JudgmentSourceReceipt
} from './judgment-source-types.ts';
import type { JudgmentInstructionsInput } from './instruction-types.ts';
import type { JudgmentLifecycleInput } from './judgment-lifecycle-types.ts';
import type { JudgmentResponseInput } from './judgment-member-types.ts';
import type { PreparedGroupContext } from '../../../integration/native-batch/prepared-group-types.ts';

//region Bootstrap and occurrence inputs retain source and root identities across owners.
/**
 Source collection supplies original dependency, preparation, and instruction projections.
 */
export type JudgmentConstructorSources = DependencySources & JudgmentPreparationSources
  & ReturnType<JudgmentInstructionsInput['readJudgmentSources']>;

/**
 Fixed bootstrap capabilities remain bound to the original source and root types.
 */
export type JudgmentConstructorInput<Source extends JudgmentConstructorSources, Root extends object> =
  Pick<JudgmentBudgetInput, 'now' | 'isRetryableTransportFailure'>
  & Pick<DependencyFacadeInput<Source, Root>, 'rootAdapter' | 'rootDirectory' | 'files' | 'trace'>
  & Pick<JudgmentPreparationInput<Source>, 'catalogText' | 'catalogSHA256'>
  & Pick<JudgmentInstructionsInput, 'parsePolicy'>
  & Readonly<{
    producerOwner: MainAgentRequestInput<JudgmentSourceReceipt<Source>>['producerOwner'];
    observer: JudgmentSourcesInput<Source>['observer'] & JudgmentPreparationInput<Source>['observer']
      & MainAgentRequestInput<JudgmentSourceReceipt<Source>>['observer'];
    collector: JudgmentSourcesInput<Source>['collector'];
    send: JudgmentLifecycleInput['send'];
  }>;

/**
 Original response occurrence starts one deadline and retains its exact native stream.
 */
export type JudgmentConstructionInput = Readonly<{
  startedAt: number;
  signal: AbortSignal;
  response: JudgmentResponseInput;
  stream: object;
  group: () => PreparedGroupContext;
}>;
//endregion
