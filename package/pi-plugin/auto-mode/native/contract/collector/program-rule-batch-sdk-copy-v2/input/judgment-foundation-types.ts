/**
 Original constructor foundation shares exact observation capabilities. @module
 */
import type {
  JudgmentConstructorInput,
  JudgmentConstructorSources,
  JudgmentConstructionInput
} from './judgment-constructor-types.ts';
import type { JudgmentBudget } from '../../../lifecycle/judgment-budget-error-occurrences/controls-private/types.ts';
import type { DependencyFacade } from '../../../lifecycle/native-text-read-contract/dependency-types.ts';
import type { MainAgentRequestInput } from '../../request-producer-group-consumer/request-types.ts';
import type {
  JudgmentSourceReceipt,
  JudgmentSources
} from './judgment-source-types.ts';
import type { PreparedGroupContext } from '../../../integration/native-batch/prepared-group-types.ts';

/**
 Original occurrence observations retain fixed bootstrap capabilities and lazy dependency checks.
 */
export type JudgmentFoundationInput<Source extends JudgmentConstructorSources, Root extends object> =
  Pick<JudgmentConstructorInput<Source, Root>, 'now' | 'producerOwner' | 'observer' | 'collector' | 'rootAdapter'
  | 'rootDirectory' | 'files' | 'isRetryableTransportFailure' | 'trace'> & JudgmentConstructionInput
  & Readonly<{ assertDependenciesCurrent: () => unknown }>;

/**
 Shared membership begins empty after original budget and source observations succeed.
 */
export type JudgmentFoundation<Source extends JudgmentConstructorSources> = PreparedGroupContext
  & Pick<JudgmentSources<Source>, 'receipt' | 'readCurrentSourceBinding'>
  & Readonly<{
    budget: JudgmentBudget;
    requestInput: MainAgentRequestInput<JudgmentSourceReceipt<Source>>;
    sourceOwner: JudgmentSources<Source>;
    facade: DependencyFacade;
  }>;
