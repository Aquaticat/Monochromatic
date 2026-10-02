/**
 Original host request capabilities and externally defined lookup absence semantics. @module
 */
import type {
  Provider,
  StreamFunction,
} from '@earendil-works/pi-ai';
import type { ModelRegistry, } from '@earendil-works/pi-coding-agent';
import type { ForeignBorrowed, ForeignHostCapability, } from '@monochromatic-dev/ownership-marker-foreign-borrowed/ts';
import type { PriorityApi, } from './constants.ts';

//region Native callback contracts

/**
 ModelRegistry.find supplies the exact native missing-model result.
 */
export type OriginalModelLookup = (id: string) => ReturnType<ModelRegistry['find']>;

/**
 Frozen capabilities around the session-owned mutable registry binding.
 */
export type OriginalDispatchCapabilities = {
  /**
   Store the initialized host capability on owned factory state.
   */
  readonly bind: (registry: ForeignHostCapability<ModelRegistry>) => void;
  /**
   Read only the original provider's effective catalog.
   */
  readonly getProvider: () => ForeignHostCapability<Provider>;
  /**
   Preserve native lookup absence until target resolution supplies its diagnostic.
   */
  readonly lookup: OriginalModelLookup;
  /**
   Check live original-provider availability without resolving request credentials.
   */
  readonly isConfigured: (signal: ForeignBorrowed<AbortSignal>) => Promise<boolean>;
  /**
   Native callback shape owns the externally dictated positional arguments.
   */
  readonly stream: StreamFunction<PriorityApi>;
};

//endregion
