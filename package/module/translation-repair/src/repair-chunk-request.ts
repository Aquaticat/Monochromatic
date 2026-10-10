import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { SyntheticClient, } from './chat-contract.ts';
import type {
  RepairModels,
  RepairSliceSeating,
} from './repair-contract.ts';
import type { AttestedDetail, } from './reference-attest-match.ts';
import type { StageSettings, } from './stage-settings.ts';

//region Chunk repair request
// What one chunk pair's repair takes, named apart from `repair-chunk.ts`,
// whose procedure fills that module's code-line budget; `repairChunk`
// documents each field where it reads it.

/**
 Everything one chunk pair's repair reads.

 @example
 ```ts
 const request: RepairChunkRequest = { client, sliceIndex: 0, sourceText, targetText, lineStructured: false, models, declaredNames: [], signal, perCallTimeoutMs, l, stageSettings, };
 ```
 */
export type RepairChunkRequest = {
  readonly client: SyntheticClient;
  readonly sliceIndex: number;
  readonly sourceText: string;
  readonly targetText: string;
  readonly lineStructured: boolean;
  readonly models: RepairModels;
  readonly reseat?: () => Promise<RepairSliceSeating>;
  readonly identityContext?: string;
  readonly referenceContext?: string;
  readonly attestedDetails?: readonly AttestedDetail[];
  readonly declaredNames: readonly string[];
  readonly neighbouringIncumbentText?: string;
  readonly neighbouringSourceText?: string;
  readonly documentSourceText?: string;
  readonly signal: AbortSignal;
  readonly perCallTimeoutMs: number;
  readonly l: Logger;
  readonly stageSettings: StageSettings;
};

//endregion Chunk repair request
